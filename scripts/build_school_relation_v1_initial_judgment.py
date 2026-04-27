from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
DOCS_DIR = ROOT / "docs"

REVIEW_SHEET = REF_DIR / "beijing_public_high_schools.relationship_review_sheet.json"
OUT_JSON = REF_DIR / "beijing_public_high_schools.relationship_review_sheet.v1_initial.json"
OUT_MD = DOCS_DIR / "beijing_public_high_schools_relationship_v1_initial_judgment.md"


MANUAL_REVIEW_IDS = set()


OVERRIDE_RULES = {
    "REL-003": {
        "final_entity_type": "campus",
        "final_relation_type": "main_campus",
        "final_independent_admission": False,
        "final_dedup_decision": "merge_as_campus_note",
        "review_notes": "按用户确认处理：与主校视为同一学校，按前面的名称作为规范名。",
    },
    "REL-005": {
        "final_entity_type": "co_branded_school",
        "final_relation_type": "brand_cooperation",
    },
    "REL-007": {
        "final_entity_type": "co_branded_school",
        "final_relation_type": "brand_cooperation",
    },
    "REL-011": {
        "final_entity_type": "co_branded_school",
        "final_relation_type": "brand_cooperation",
    },
    "REL-019": {
        "final_entity_type": "co_branded_school",
        "final_relation_type": "brand_cooperation",
    },
    "REL-015": {
        "final_entity_type": "campus",
        "final_relation_type": "main_campus",
        "final_independent_admission": False,
        "final_dedup_decision": "merge_as_campus_note",
        "review_notes": "按用户确认处理：与前面的学校视为同一学校，按前面的名称作为规范名。",
    },
    "REL-016": {
        "final_entity_type": "branch_school",
        "final_relation_type": "main_branch",
        "final_independent_admission": False,
        "final_dedup_decision": "merge_as_alias",
        "review_notes": "按用户确认处理：与前面的学校视为同一学校，按前面的名称作为规范名。",
    },
}


def apply_initial_judgment(row: dict) -> dict:
    result = dict(row)
    review_id = result["review_id"]

    if review_id in MANUAL_REVIEW_IDS:
        result["review_status"] = "needs_manual_review"
        result["review_notes"] = "V1 暂不硬判，保留独立实体，等待人工确认具体关系。"
        result["final_entity_type"] = "unknown"
        result["final_relation_type"] = "manual_review"
        result["final_independent_admission"] = True
        result["final_dedup_decision"] = "manual_review"
        return result

    result["review_status"] = "v1_initial_judged"
    result["review_notes"] = "按 V1 初判规则生成，默认保留独立实体。"
    result["final_entity_type"] = result["recommended_entity_type"]
    result["final_relation_type"] = result["recommended_relation_type"]
    result["final_independent_admission"] = True
    result["final_dedup_decision"] = "keep_independent"

    if review_id in OVERRIDE_RULES:
        result.update(OVERRIDE_RULES[review_id])
        if "review_notes" not in OVERRIDE_RULES[review_id]:
            result["review_notes"] = "按 V1 初判规则识别为品牌合作或挂靠型独立实体，默认保留。"

    return result


def build_rows() -> list[dict]:
    rows = json.loads(REVIEW_SHEET.read_text(encoding="utf-8"))
    return [apply_initial_judgment(row) for row in rows]


def write_json(rows: list[dict]) -> None:
    OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def write_md(rows: list[dict]) -> None:
    lines = [
        "# 北京公办高中关系 V1 初判结果",
        "",
        "## 1. 说明",
        "",
        "这份文档是在关系判定表基础上生成的 V1 初判结果。",
        "",
        "处理原则：",
        "",
        "- 明显的分校，先判为 `branch_school`",
        "- 明显的校区，先判为 `campus`",
        "- 明显带有品牌合作特征的，先判为 `co_branded_school`",
        "- 边界不稳的关系继续保留为 `manual_review`",
        "- 所有记录默认先保留为独立实体，不直接并回主校",
        "",
        "## 2. 初判统计",
        "",
    ]

    total = len(rows)
    manual = sum(1 for row in rows if row["review_status"] == "needs_manual_review")
    judged = total - manual
    lines.append(f"- 总关系数：`{total}`")
    lines.append(f"- 已做 V1 初判：`{judged}`")
    lines.append(f"- 仍需人工复核：`{manual}`")
    lines.append("")
    lines.append("## 3. 明细")
    lines.append("")
    lines.append("| review_id | 区 | 主校 | 待判定学校 | final_entity_type | final_relation_type | final_dedup_decision | review_status |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")

    for row in rows:
        lines.append(
            f"| {row['review_id']} | {row['district']} | {row['parent_school_name']} | {row['candidate_school_name']} | "
            f"{row['final_entity_type']} | {row['final_relation_type']} | {row['final_dedup_decision']} | {row['review_status']} |"
        )

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows = build_rows()
    write_json(rows)
    write_md(rows)
    judged = sum(1 for row in rows if row["review_status"] == "v1_initial_judged")
    manual = sum(1 for row in rows if row["review_status"] == "needs_manual_review")
    print(f"total={len(rows)}")
    print(f"judged={judged}")
    print(f"manual={manual}")


if __name__ == "__main__":
    main()
