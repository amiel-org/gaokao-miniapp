"""Import official BJEEA 2026 admission plan from a text-based PDF.

This is a fallback for official PDFs that contain extractable text tables. It is
not intended for scanned image PDFs; those should be OCRed/reviewed first and
then imported through Excel or a curated CSV.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
TARGET_YEAR = 2026
TARGET_BATCH = "本科普通批"
SOURCE_URL = "https://query.bjeea.cn/queryService/rest/plan/115"
RUN_DATE = date.today().isoformat()
CORE_LEVELS = {"985/211/双一流", "211/双一流", "双一流/普通一本", "普通一本", "普通二本"}


@dataclass
class AdmissionPlanRecord:
    year: int
    collegeCode: str
    collegeName: str
    majorCode: str
    majorName: str
    subjectRequirement: str
    enrollBatch: str
    planCount: int | None
    durationYears: str
    tuition: str
    foreignLanguage: str
    sourceUrl: str
    sourcePage: int
    sourcePublisher: str = "北京教育考试院"
    sourceType: str = "official_2026_admission_plan"


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def text_to_int(value: object) -> int | None:
    text = clean_text(value).replace(",", "")
    if not re.search(r"\d", text):
        return None
    return int(re.search(r"\d+", text).group(0))


def load_target_schools() -> dict[str, str]:
    text = (ROOT / "miniprogram" / "data" / "beijing-undergraduate-school-coverage.js").read_text(encoding="utf-8-sig").strip()
    match = re.search(r"module\.exports\s*=\s*(\[.*\])\s*;?\s*$", text, re.S)
    if not match:
        raise RuntimeError("cannot parse beijing-undergraduate-school-coverage.js")
    rows = json.loads(match.group(1))
    return {
        row["name"]: row["collegeLevel"]
        for row in rows
        if row.get("admissionCategory") == "ordinary_batch" and row.get("collegeLevel") in CORE_LEVELS
    }


def split_cells(line: str) -> list[str]:
    # Prefer table-like whitespace. If unavailable, keep the full line and let
    # parse_line reject it.
    return [clean_text(cell) for cell in re.split(r"\s{2,}|\t+", clean_text(line)) if clean_text(cell)]


def parse_line(line: str, page_no: int, current_college: tuple[str, str] | None, targets: dict[str, str]) -> AdmissionPlanRecord | None:
    text = clean_text(line)
    if not text or TARGET_BATCH not in text:
        return None
    cells = split_cells(text)
    # Expected row from query/PDF table:
    # 学校代码 学校名称 专业代码 专业名称 {专业组}选考科目要求 录取批次 计划招生数 学制 收费标准 外语语种
    if len(cells) >= 10 and cells[1] in targets:
        college_code, college_name = cells[0], cells[1]
        major_code, major_name = cells[2], cells[3]
        requirement = cells[4]
        batch = cells[5]
        plan_count = cells[6]
        duration = cells[7]
        tuition = cells[8]
        foreign_language = cells[9]
    elif current_college and len(cells) >= 8:
        college_code, college_name = current_college
        major_code, major_name = cells[0], cells[1]
        requirement = cells[2]
        batch = cells[3]
        plan_count = cells[4]
        duration = cells[5]
        tuition = cells[6]
        foreign_language = cells[7]
    else:
        return None
    if college_name not in targets or TARGET_BATCH not in batch or not major_code or not major_name:
        return None
    return AdmissionPlanRecord(
        year=TARGET_YEAR,
        collegeCode=college_code,
        collegeName=college_name,
        majorCode=major_code,
        majorName=major_name,
        subjectRequirement=requirement,
        enrollBatch=batch,
        planCount=text_to_int(plan_count),
        durationYears=duration,
        tuition=tuition,
        foreignLanguage=foreign_language,
        sourceUrl=SOURCE_URL,
        sourcePage=page_no,
    )


def detect_college(line: str, targets: dict[str, str]) -> tuple[str, str] | None:
    text = clean_text(line)
    for name in targets:
        if name in text:
            code_match = re.search(r"(?<!\d)(\d{4})(?!\d)", text)
            return (code_match.group(1) if code_match else "", name)
    return None


def import_pdf(path: Path) -> tuple[list[AdmissionPlanRecord], dict[str, object]]:
    targets = load_target_schools()
    records: list[AdmissionPlanRecord] = []
    pages_with_text = 0
    current_college: tuple[str, str] | None = None
    with pdfplumber.open(path) as pdf:
        for page_index, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            if text.strip():
                pages_with_text += 1
            for line in text.splitlines():
                detected = detect_college(line, targets)
                if detected:
                    current_college = detected
                record = parse_line(line, page_index, current_college, targets)
                if record:
                    records.append(record)
    meta = {"pdf": str(path), "pagesWithText": pages_with_text, "recordCount": len(records)}
    return records, meta


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path")
    parser.add_argument("--source-title", default="2026 年北京普通高等学校招生专业目录")
    parser.add_argument("--source-url", default=SOURCE_URL)
    parser.add_argument("--output", default="", help="Write staging JSON to this path instead of the default pipeline file.")
    parser.add_argument("--fail-if-empty", action="store_true", help="Exit non-zero when no target records are imported.")
    args = parser.parse_args()
    pdf_path = Path(args.pdf_path).resolve()
    if not pdf_path.exists():
        raise SystemExit(f"file not found: {pdf_path}")
    records, import_meta = import_pdf(pdf_path)
    college_names = sorted({record.collegeName for record in records})
    payload = {
        "source": {
            "publisher": "北京教育考试院",
            "url": args.source_url,
            "title": args.source_title,
            "year": TARGET_YEAR,
            "retrievedAt": RUN_DATE,
            "localPath": str(pdf_path),
        },
        "status": "official_plan_connected" if records else "official_pdf_imported_no_target_records",
        "examIdsFromPage": [],
        "selectedExamId": None,
        "target": {"year": TARGET_YEAR, "province": "北京市", "enrollBatch": TARGET_BATCH},
        "schoolIndexCount": len(college_names),
        "recordCount": len(records),
        "notes": ["通过北京教育考试院官方 PDF 招生专业目录导入；若 pagesWithText=0，说明 PDF 可能为扫描版，需 OCR 后再导入。"],
        "importMeta": import_meta,
        "schoolIndex": [],
        "records": [asdict(record) for record in records],
    }
    out_path = Path(args.output).resolve() if args.output else ROOT / "data" / "staging" / "bjeea_admission_plan_2026" / "bjeea_2026_admission_plan.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": payload["status"], "recordCount": len(records), "collegeCount": len(college_names), "pagesWithText": import_meta["pagesWithText"]}, ensure_ascii=False, indent=2))
    print(f"saved {out_path}")
    if args.fail_if_empty and not records:
        raise SystemExit("official PDF imported zero target records; refusing to treat it as ready.")


if __name__ == "__main__":
    main()
