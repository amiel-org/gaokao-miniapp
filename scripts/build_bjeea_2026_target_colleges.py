"""Build the target-college checklist for the 2026 BJEEA PDF backfill.

The mini-program recommendation pool is Beijing-focused.  For the 2026 full
backfill we need a stable list of Beijing ordinary-batch undergraduate
colleges at 二本及以上层次, then locate their entries inside the official scanned
PDF before extracting/validating majors.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COVERAGE_JS = ROOT / "miniprogram/subpackages/volunteer/data/beijing-undergraduate-school-coverage.js"
ADMISSION_GROUPS_JS = ROOT / "miniprogram/subpackages/volunteer/data/college-admission-groups.js"
OUT_JSON = ROOT / "data/staging/major_catalog_ocr/bjeea_2026_target_colleges.json"
OUT_TSV = ROOT / "output/beijing_colleges_second_tier_or_above.tsv"

CORE_LEVELS = {"985/211/双一流", "211/双一流", "双一流/普通一本", "普通一本", "普通二本"}

# Codes below were confirmed from the official 2026 catalog page images/OCR.
# They fill gaps where the older 2025 admission-group seed did not include the
# college, but the college is in the current recommendation coverage.
PDF_CONFIRMED_CODES = {
    "北京工业大学": "1049",
    "北京航空航天大学": "1047",
    "北京理工大学": "1048",
    "北京协和医学院": "1046",
    "首都体育学院": "1012",
    "北京体育大学": "1010",
    "中央民族大学": "1020",
    "中国政法大学": "1039",
    "北京信息科技大学": "1064",
    "中国科学院大学": "1019",
    "中国社会科学院大学": "1011",
}


def load_js_module(path: Path):
    text = path.read_text(encoding="utf-8-sig").strip()
    if text.startswith("module.exports"):
        text = text.split("=", 1)[1].strip()
    if text.endswith(";"):
        text = text[:-1]
    return json.loads(text)


def main() -> None:
    coverage = load_js_module(COVERAGE_JS)
    groups = load_js_module(ADMISSION_GROUPS_JS)
    code_by_name: dict[str, str] = {}
    for group in groups:
        name = group.get("collegeName")
        code = group.get("collegeCode")
        if name and code and name not in code_by_name:
            code_by_name[name] = str(code)
    code_by_name.update(PDF_CONFIRMED_CODES)

    targets = []
    for item in coverage:
        if item.get("admissionCategory") != "ordinary_batch":
            continue
        if item.get("collegeLevel") not in CORE_LEVELS:
            continue
        name = item["name"]
        targets.append(
            {
                "collegeCode": code_by_name.get(name, ""),
                "collegeName": name,
                "collegeLevel": item.get("collegeLevel", ""),
                "admissionCategory": item.get("admissionCategory", ""),
                "hasProgramSeed": bool(item.get("hasProgramSeed")),
                "codeSource": "2026_pdf_page_ocr_confirmed"
                if name in PDF_CONFIRMED_CODES
                else "existing_2025_group_seed",
                "targetScope": "北京高校、本科普通批、二本及以上层次",
            }
        )

    targets.sort(key=lambda x: (x["collegeCode"] or "9999", x["collegeName"]))
    missing_codes = [item["collegeName"] for item in targets if not item["collegeCode"]]
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(
            {
                "source": "miniprogram/data/beijing-undergraduate-school-coverage.js",
                "targetScope": "北京高校、本科普通批、二本及以上层次；二本以下不收录",
                "targetCount": len(targets),
                "missingCodeCount": len(missing_codes),
                "missingCodes": missing_codes,
                "targets": targets,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    OUT_TSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_TSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(["院校", "层次", "录取类别"])
        writer.writerows(
            [item["collegeName"], item["collegeLevel"], item["admissionCategory"]]
            for item in targets
        )
    print(f"target_count={len(targets)}")
    print(f"missing_code_count={len(missing_codes)}")
    print(f"out={OUT_JSON}")
    print(f"tsv={OUT_TSV}")


if __name__ == "__main__":
    main()
