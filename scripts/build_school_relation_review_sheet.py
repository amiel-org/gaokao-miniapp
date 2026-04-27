from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
DOCS_DIR = ROOT / "docs"

SUSPECT_PATH = REF_DIR / "beijing_public_high_schools.suspected_duplicates.json"
OUT_JSON = REF_DIR / "beijing_public_high_schools.relationship_review_sheet.json"
OUT_MD = DOCS_DIR / "beijing_public_high_schools_relationship_review_sheet.md"


def recommended_entity_type(name: str) -> str:
    if "分校" in name:
        return "branch_school"
    if "校区" in name:
        return "campus"
    if "学校" in name and "中学" not in name:
        return "co_branded_school"
    return "unknown"


def recommended_relation_type(name: str) -> str:
    if "分校" in name:
        return "main_branch"
    if "校区" in name:
        return "main_campus"
    if "学校" in name and "中学" not in name:
        return "brand_cooperation"
    return "manual_review"


def recommended_decision(name: str) -> str:
    if "分校" in name or "校区" in name or "学校" in name:
        return "keep_independent"
    return "manual_review"


def build_rows() -> list[dict]:
    suspects = json.loads(SUSPECT_PATH.read_text(encoding="utf-8"))
    rows: list[dict] = []
    for idx, item in enumerate(suspects, start=1):
        parent = item["left_name"]
        child = item["right_name"]
        rows.append(
            {
                "review_id": f"REL-{idx:03d}",
                "district": item["district"],
                "parent_school_name": parent,
                "candidate_school_name": child,
                "detected_relation_type": item["relation_type"],
                "recommended_entity_type": recommended_entity_type(child),
                "recommended_relation_type": recommended_relation_type(child),
                "recommended_independent_admission": True,
                "recommended_dedup_decision": recommended_decision(child),
                "review_status": "pending",
                "review_notes": "",
                "final_entity_type": "",
                "final_relation_type": "",
                "final_independent_admission": "",
                "final_dedup_decision": "",
                "left_source_batch": item["left_source_batch"],
                "right_source_batch": item["right_source_batch"],
            }
        )
    return rows


def write_json(rows: list[dict]) -> None:
    OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def write_md(rows: list[dict]) -> None:
    lines = [
        "# 北京公办高中关系判定表",
        "",
        "## 1. 说明",
        "",
        "这份表不是用来删数据，而是用来判断主校、分校、校区、合作校之间的关系。",
        "",
        "当前原则：",
        "",
        "- 默认优先保留为独立学校实体",
        "- 不直接合并回主校",
        "- 先建立关系字段，再决定后续搜索与展示方式",
        "",
        "## 2. 字段说明",
        "",
        "- `parent_school_name`：当前推定的主校或基础学校名",
        "- `candidate_school_name`：当前待判定的分校/校区/合作校名称",
        "- `recommended_entity_type`：程序建议的实体类型",
        "- `recommended_relation_type`：程序建议的关系类型",
        "- `recommended_dedup_decision`：程序建议的处理方式",
        "- `final_*`：人工最终判定结果",
        "",
        "## 3. 建议枚举值",
        "",
        "- `entity_type`：`main_school` / `branch_school` / `campus` / `co_branded_school` / `unknown`",
        "- `relation_type`：`main_branch` / `main_campus` / `brand_cooperation` / `manual_review`",
        "- `dedup_decision`：`keep_independent` / `merge_as_campus_note` / `merge_as_alias` / `manual_review`",
        "",
        "## 4. 当前待判定清单",
        "",
        "| review_id | 区 | 主校 | 待判定学校 | 程序建议实体类型 | 程序建议关系 | 程序建议处理 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]

    for row in rows:
        lines.append(
            f"| {row['review_id']} | {row['district']} | {row['parent_school_name']} | {row['candidate_school_name']} | "
            f"{row['recommended_entity_type']} | {row['recommended_relation_type']} | {row['recommended_dedup_decision']} |"
        )

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows = build_rows()
    write_json(rows)
    write_md(rows)
    print(f"review_rows={len(rows)}")


if __name__ == "__main__":
    main()
