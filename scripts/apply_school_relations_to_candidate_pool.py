from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
DOCS_DIR = ROOT / "docs"

CANDIDATE_POOL = REF_DIR / "beijing_public_high_schools.candidate_pool.pre_dedup.json"
RELATION_SHEET = REF_DIR / "beijing_public_high_schools.relationship_review_sheet.v1_initial.json"

OUT_POOL = REF_DIR / "beijing_public_high_schools.candidate_pool.with_relations.json"
OUT_CANONICAL_MAP = REF_DIR / "beijing_public_high_schools.canonical_name_map.json"
OUT_DOC = DOCS_DIR / "beijing_public_high_schools_candidate_pool_with_relations.md"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def initialize_row(row: dict) -> dict:
    item = dict(row)
    item["entity_type"] = "main_school"
    item["parent_school_name"] = ""
    item["relation_type"] = ""
    item["independent_admission"] = True
    item["dedup_decision"] = "keep_independent"
    item["canonical_school_name"] = row["official_name"]
    item["relation_review_status"] = "not_in_relation_sheet"
    return item


def apply_relations(rows: list[dict], relations: list[dict]) -> list[dict]:
    indexed = {
        (row["district"], row["official_name"]): initialize_row(row)
        for row in rows
    }

    for rel in relations:
        parent_key = (rel["district"], rel["parent_school_name"])
        child_key = (rel["district"], rel["candidate_school_name"])

        if parent_key in indexed:
            indexed[parent_key]["entity_type"] = indexed[parent_key].get("entity_type") or "main_school"
            indexed[parent_key]["canonical_school_name"] = rel["parent_school_name"]
            indexed[parent_key]["relation_review_status"] = rel["review_status"]

        if child_key not in indexed:
            continue

        child = indexed[child_key]
        child["entity_type"] = rel["final_entity_type"]
        child["parent_school_name"] = rel["parent_school_name"]
        child["relation_type"] = rel["final_relation_type"]
        child["independent_admission"] = rel["final_independent_admission"]
        child["dedup_decision"] = rel["final_dedup_decision"]
        child["canonical_school_name"] = rel["parent_school_name"]
        child["relation_review_status"] = rel["review_status"]

    return list(indexed.values())


def build_canonical_map(rows: list[dict]) -> list[dict]:
    mapping = []
    for row in rows:
        if row["official_name"] == row["canonical_school_name"]:
            continue
        mapping.append(
            {
                "district": row["district"],
                "official_name": row["official_name"],
                "canonical_school_name": row["canonical_school_name"],
                "entity_type": row["entity_type"],
                "relation_type": row["relation_type"],
                "dedup_decision": row["dedup_decision"],
            }
        )
    mapping.sort(key=lambda x: (x["district"], x["canonical_school_name"], x["official_name"]))
    return mapping


def write_doc(rows: list[dict], canonical_map: list[dict]) -> None:
    total = len(rows)
    relation_tagged = sum(1 for row in rows if row["relation_review_status"] != "not_in_relation_sheet")
    merged_alias = sum(1 for row in rows if row["dedup_decision"] == "merge_as_alias")
    merged_campus = sum(1 for row in rows if row["dedup_decision"] == "merge_as_campus_note")

    lines = [
        "# 北京公办高中候选池关系回填结果",
        "",
        "## 1. 说明",
        "",
        "这份结果是在候选总池基础上，将 V1 初判关系结果回填后的版本。",
        "",
        "它的作用是：",
        "",
        "- 标注哪些是主校",
        "- 标注哪些是分校、校区、合作校",
        "- 标出当前规范名（canonical_school_name）",
        "- 为后续 school_id、short_name、aliases 生成做准备",
        "",
        "## 2. 当前统计",
        "",
        f"- 候选总池记录数：`{total}`",
        f"- 已挂关系标签记录数：`{relation_tagged}`",
        f"- 合并为校区说明：`{merged_campus}`",
        f"- 合并为别名：`{merged_alias}`",
        "",
        "## 3. 规范名映射样例",
        "",
        "| 区 | 当前名称 | 规范名 | entity_type | relation_type | dedup_decision |",
        "| --- | --- | --- | --- | --- | --- |",
    ]

    for row in canonical_map[:30]:
        lines.append(
            f"| {row['district']} | {row['official_name']} | {row['canonical_school_name']} | "
            f"{row['entity_type']} | {row['relation_type']} | {row['dedup_decision']} |"
        )

    OUT_DOC.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows = read_json(CANDIDATE_POOL)
    relations = read_json(RELATION_SHEET)
    rows_with_relations = apply_relations(rows, relations)
    canonical_map = build_canonical_map(rows_with_relations)
    write_json(OUT_POOL, rows_with_relations)
    write_json(OUT_CANONICAL_MAP, canonical_map)
    write_doc(rows_with_relations, canonical_map)
    print(f"rows={len(rows_with_relations)}")
    print(f"canonical_map={len(canonical_map)}")


if __name__ == "__main__":
    main()
