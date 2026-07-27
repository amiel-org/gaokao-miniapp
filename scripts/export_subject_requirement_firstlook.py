"""Export compact BJEEA subject-requirement firstlook data for the miniapp.

Input:
  data/staging/bjeea_subject_requirements/bjeea_2024_subject_requirements.sample.json

Output:
  miniprogram/data/college-subject-requirement-firstlook.js

The output is intentionally compact: for each college we keep a small list of
readable major categories aligned to broad requirement buckets. It is used only
as a fallback/reference for recommendation cards, not as a full 2026 admission
plan.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "staging" / "bjeea_subject_requirements" / "bjeea_2024_subject_requirements.sample.json"
OUTPUT = ROOT / "miniprogram" / "data" / "college-subject-requirement-firstlook.js"
REPORT = ROOT / "docs" / "college_subject_requirement_firstlook_report.md"


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", "", value or "").strip()


def is_readable(value: str) -> bool:
    name = normalize_name(value)
    if len(name) < 2:
        return False
    if re.fullmatch(r"[A-Za-z0-9（）()]+", name):
        return False
    if "体育" in name or "艺术" in name and len(name) <= 4:
        # Keep broader academic categories ahead of single special-admission labels.
        return True
    return bool(re.search(r"[\u4e00-\u9fff]", name))


def bucket(requirement: str) -> str:
    text = requirement or ""
    if "不限" in text:
        return "unlimited"
    if "物理" in text and "化学" in text:
        return "physicsChemistry"
    if "物理" in text:
        return "physics"
    if "思想政治" in text or "政治" in text:
        return "politics"
    if "历史" in text:
        return "history"
    if "地理" in text:
        return "geography"
    if "生物" in text:
        return "biology"
    if "化学" in text:
        return "chemistry"
    return "general"


def add_unique(target: list[str], value: str, limit: int) -> None:
    name = normalize_name(value)
    if not is_readable(name):
        return
    if name not in target:
        target.append(name)
    del target[limit:]


def main() -> None:
    payload = json.loads(INPUT.read_text(encoding="utf-8"))
    by_college: dict[str, dict] = {}
    for item in payload.get("requirements", []):
        code = item.get("collegeCode")
        name = item.get("collegeName")
        if not code or not name:
            continue
        record = by_college.setdefault(code, {
            "collegeCode": code,
            "collegeName": name,
            "source": "北京教育考试院 2024 选考要求",
            "sourceYear": 2024,
            "sourceType": "subject_requirement_reference",
            "buckets": {},
            "topMajors": [],
        })
        key = bucket(item.get("subjectRequirement", ""))
        values = record["buckets"].setdefault(key, [])
        add_unique(values, item.get("majorCategory", ""), 8)
        add_unique(record["topMajors"], item.get("majorCategory", ""), 12)

    records = sorted(by_college.values(), key=lambda x: x["collegeCode"])
    OUTPUT.write_text(
        "module.exports = "
        + json.dumps(records, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )

    covered = len(records)
    firstlook_count = sum(len(item["topMajors"]) for item in records)
    lines = [
        "# 院校选考要求首轮专业方向库",
        "",
        "日期：2026-05-19",
        "",
        f"- 输出文件：`{OUTPUT.relative_to(ROOT)}`",
        f"- 覆盖院校数：{covered}",
        f"- 院校专业方向标签数：{firstlook_count}",
        "- 来源：北京教育考试院 2024 年普通高校在京招生专业选考查询",
        "",
        "## 使用口径",
        "",
        "该库用于小程序推荐卡片的专业方向兜底：当正式专业明细和本地专业方向不足时，优先用同院校公开选考要求中的专业/专业类名称补充展示。",
        "",
        "它不是 2026 招生计划，不能替代招生人数、学制、收费、外语语种和当年专业组正式目录。",
    ]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT),
        "records": covered,
        "firstlookMajorLabels": firstlook_count,
        "report": str(REPORT),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
