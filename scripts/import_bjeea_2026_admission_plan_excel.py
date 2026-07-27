"""Import official BJEEA 2026 admission plan from an Excel workbook.

Usage:
  python scripts/import_bjeea_2026_admission_plan_excel.py data/raw/admissions/2026/catalog.xlsx

The importer is strict about source metadata and target scope. It accepts common
column names from the BJEEA query/table export, filters to Beijing colleges,
ordinary undergraduate batch, and the project-defined second-tier-or-above
一本及以上 coverage list, then writes the same staging JSON consumed by
export_bjeea_2026_admission_plan_firstlook.js.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
TARGET_YEAR = 2026
TARGET_BATCH = "本科普通批"
SOURCE_URL = "https://query.bjeea.cn/queryService/rest/plan/115"
RUN_DATE = date.today().isoformat()
CORE_LEVELS = {"985/211/双一流", "211/双一流", "双一流/普通一本", "普通一本", "普通二本"}

COLUMN_ALIASES = {
    "collegeCode": ["学校代码", "院校代号", "院校代码", "collegeCode"],
    "collegeName": ["学校名称", "院校名称", "collegeName"],
    "majorCode": ["专业代码", "专业 代码", "majorCode"],
    "majorName": ["专业名称", "专业", "majorName"],
    "subjectRequirement": ["{专业组}选考科目要求", "专业组 选考科目要求", "选考科目要求", "{专业组} 选考科目要求", "subjectRequirement"],
    "enrollBatch": ["录取批次", "批次", "enrollBatch"],
    "planCount": ["计划招生数", "计划 招生数", "招生计划数", "计划数", "planCount"],
    "durationYears": ["学制（年）", "学制", "durationYears"],
    "tuition": ["收费标准（元/年）", "收费标准", "学费", "tuition"],
    "foreignLanguage": ["外语语种", "外语", "foreignLanguage"],
    "province": ["所在地区", "地区", "省份", "province"],
}


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
    sourcePublisher: str = "北京教育考试院"
    sourceType: str = "official_2026_admission_plan"


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_header(value: Any) -> str:
    return clean_text(value).replace(" ", "").replace("\n", "")


def text_to_int(value: Any) -> int | None:
    text = clean_text(value).replace(",", "")
    if not text or not re.search(r"\d", text):
        return None
    return int(re.search(r"\d+", text).group(0))


def load_target_schools() -> dict[str, str]:
    # The JS file is JSON-like enough to parse between module.exports = and ;.
    coverage_path = ROOT / "miniprogram" / "data" / "beijing-undergraduate-school-coverage.js"
    text = coverage_path.read_text(encoding="utf-8-sig").strip()
    match = re.search(r"module\.exports\s*=\s*(\[.*\])\s*;?\s*$", text, re.S)
    if not match:
        raise RuntimeError("cannot parse beijing-undergraduate-school-coverage.js")
    rows = json.loads(match.group(1))
    return {
        row["name"]: row["collegeLevel"]
        for row in rows
        if row.get("admissionCategory") == "ordinary_batch" and row.get("collegeLevel") in CORE_LEVELS
    }


def find_header_row(rows: list[list[Any]]) -> tuple[int, dict[str, int]]:
    alias_map = {field: [normalize_header(alias) for alias in aliases] for field, aliases in COLUMN_ALIASES.items()}
    best: tuple[int, dict[str, int]] | None = None
    best_score = 0
    for row_index, row in enumerate(rows[:30]):
        normalized = [normalize_header(cell) for cell in row]
        mapping: dict[str, int] = {}
        for field, aliases in alias_map.items():
            for col_index, header in enumerate(normalized):
                if header in aliases:
                    mapping[field] = col_index
                    break
        score = len(mapping)
        if score > best_score:
            best_score = score
            best = (row_index, mapping)
    required = {"collegeCode", "collegeName", "majorCode", "majorName", "subjectRequirement", "enrollBatch", "planCount"}
    if not best or not required.issubset(best[1].keys()):
        raise RuntimeError(f"cannot identify required headers; best={best}")
    return best


def row_value(row: list[Any], mapping: dict[str, int], field: str) -> str:
    index = mapping.get(field)
    if index is None or index >= len(row):
        return ""
    return clean_text(row[index])


def import_excel(path: Path) -> tuple[list[AdmissionPlanRecord], dict[str, Any]]:
    target_schools = load_target_schools()
    wb = load_workbook(path, data_only=True, read_only=True)
    records: list[AdmissionPlanRecord] = []
    sheet_summaries: list[dict[str, Any]] = []
    for ws in wb.worksheets:
        rows = [list(row) for row in ws.iter_rows(values_only=True)]
        if not rows:
            continue
        try:
            header_index, mapping = find_header_row(rows)
        except RuntimeError:
            sheet_summaries.append({"sheet": ws.title, "status": "header_not_found", "rows": len(rows)})
            continue
        before = len(records)
        for row in rows[header_index + 1:]:
            college_name = row_value(row, mapping, "collegeName")
            if not college_name or college_name not in target_schools:
                continue
            province = row_value(row, mapping, "province")
            if province and "北京" not in province:
                continue
            batch = row_value(row, mapping, "enrollBatch")
            if TARGET_BATCH not in batch:
                continue
            major_code = row_value(row, mapping, "majorCode")
            major_name = row_value(row, mapping, "majorName")
            if not major_code or not major_name:
                continue
            records.append(
                AdmissionPlanRecord(
                    year=TARGET_YEAR,
                    collegeCode=row_value(row, mapping, "collegeCode"),
                    collegeName=college_name,
                    majorCode=major_code,
                    majorName=major_name,
                    subjectRequirement=row_value(row, mapping, "subjectRequirement"),
                    enrollBatch=batch,
                    planCount=text_to_int(row_value(row, mapping, "planCount")),
                    durationYears=row_value(row, mapping, "durationYears"),
                    tuition=row_value(row, mapping, "tuition"),
                    foreignLanguage=row_value(row, mapping, "foreignLanguage"),
                    sourceUrl=SOURCE_URL,
                )
            )
        sheet_summaries.append({"sheet": ws.title, "status": "parsed", "rows": len(rows), "addedRecords": len(records) - before})
    meta = {"workbook": str(path), "sheets": sheet_summaries, "targetCollegeCount": len(target_schools)}
    return records, meta


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("excel_path")
    parser.add_argument("--source-title", default="2026 年北京普通高等学校招生专业目录")
    parser.add_argument("--source-url", default=SOURCE_URL)
    parser.add_argument("--output", default="", help="Write staging JSON to this path instead of the default pipeline file.")
    parser.add_argument("--fail-if-empty", action="store_true", help="Exit non-zero when no target records are imported.")
    args = parser.parse_args()

    excel_path = Path(args.excel_path).resolve()
    if not excel_path.exists():
        raise SystemExit(f"file not found: {excel_path}")

    records, import_meta = import_excel(excel_path)
    college_names = sorted({record.collegeName for record in records})
    payload = {
        "source": {
            "publisher": "北京教育考试院",
            "url": args.source_url,
            "title": args.source_title,
            "year": TARGET_YEAR,
            "retrievedAt": RUN_DATE,
            "localPath": str(excel_path),
        },
        "status": "official_plan_connected" if records else "official_file_imported_no_target_records",
        "examIdsFromPage": [],
        "selectedExamId": None,
        "target": {"year": TARGET_YEAR, "province": "北京市", "enrollBatch": TARGET_BATCH},
        "schoolIndexCount": len(college_names),
        "recordCount": len(records),
        "notes": ["通过用户提供或本地下载的北京教育考试院官方 Excel 招生专业目录导入。"],
        "importMeta": import_meta,
        "schoolIndex": [],
        "records": [asdict(record) for record in records],
    }
    out_path = Path(args.output).resolve() if args.output else ROOT / "data" / "staging" / "bjeea_admission_plan_2026" / "bjeea_2026_admission_plan.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": payload["status"], "recordCount": len(records), "collegeCount": len(college_names)}, ensure_ascii=False, indent=2))
    print(f"saved {out_path}")
    if args.fail_if_empty and not records:
        raise SystemExit("official Excel imported zero target records; refusing to treat it as ready.")


if __name__ == "__main__":
    main()
