"""Export verified college major details from the manual review queue.

This script is intentionally strict: OCR candidates are never exported directly.
Only records with manualReview.status == "verified" and non-empty verifiedMajors
enter the formal mini-program seed.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/review/college_major_details_manual_review_queue.json"
OUT_JS = ROOT / "miniprogram/data/college-major-details.js"

SOURCE_TITLE = "北京市2026年普通高等学校招生专业目录"
SOURCE_URL = "https://www.bjeea.cn/uploads/soft/260621/北京市2026年普通高等学校招生专业目录.pdf"
def normalize_major(raw: dict) -> dict:
    return {
        "majorCode": str(raw.get("majorCode", "")).strip(),
        "majorName": str(raw.get("majorName", "")).strip(),
        "planCount": raw.get("planCount"),
        "tuition": raw.get("tuition"),
        "duration": raw.get("duration"),
        "restrictionTags": raw.get("restrictionTags", []),
        "notes": raw.get("notes", ""),
    }


def build_record(item: dict) -> dict | None:
    review = item.get("manualReview", {})
    if review.get("status") != "verified":
        return None
    majors = [normalize_major(x) for x in review.get("verifiedMajors", [])]
    majors = [x for x in majors if x["majorCode"] and x["majorName"]]
    if not majors:
        return None
    return {
        "id": item["id"],
        "year": item.get("year", 2026),
        "province": item.get("province", "北京"),
        "batch": item.get("batch", "本科普通批"),
        "collegeCode": item["collegeCode"],
        "collegeName": item["collegeName"],
        "groupCode": item["groupCode"],
        "groupName": item.get("groupName") or f"{item['collegeName']}{item['groupCode']}专业组",
        "catalogPage": item.get("catalogPage"),
        "subjectRequirementText": review.get("subjectRequirementText") or item.get("subjectRequirementTextOcr", ""),
        "majors": majors,
        "majorNames": [x["majorName"] for x in majors],
        "groupRestrictionTags": review.get("groupRestrictionTags", []),
        "groupNotes": review.get("groupNotes", ""),
        "colorWeaknessRisk": review.get("colorWeaknessRisk", "unknown"),
        "hasMedicalRestriction": review.get("hasMedicalRestriction"),
        "review": {
            "status": "verified",
            "reviewer": review.get("reviewer", ""),
            "reviewedAt": review.get("reviewedAt", ""),
            "notes": review.get("reviewNotes", ""),
        },
        "source": {
            "publisher": "北京教育考试院",
            "title": SOURCE_TITLE,
            "url": SOURCE_URL,
            "catalogPage": item.get("catalogPage"),
            "reviewImage": item.get("reviewImage", ""),
        },
        "dataStatus": "official_catalog_manual_verified",
        "version": "2026.official.major_details.v1",
        "updatedAt": "2026-06-22",
    }


def main() -> None:
    if not QUEUE.exists():
        raise FileNotFoundError(f"manual review queue not found: {QUEUE}")
    queue = json.loads(QUEUE.read_text(encoding="utf-8"))
    records = [x for x in (build_record(item) for item in queue) if x]
    records.sort(key=lambda x: (x["collegeCode"], x["groupCode"]))
    OUT_JS.write_text("module.exports = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"queue_records={len(queue)}")
    print(f"verified_records={len(records)}")
    print(f"out={OUT_JS}")


if __name__ == "__main__":
    main()
