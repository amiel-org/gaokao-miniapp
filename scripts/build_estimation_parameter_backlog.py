from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
DOCS_DIR = ROOT / "docs"

SCHOOL_SOURCE = REF_DIR / "beijing_public_high_schools.standard_seed.v1.json"
TIERS_SOURCE = REF_DIR / "school_rank_estimation_tiers.v1.json"
OVERRIDES_SOURCE = REF_DIR / "school_rank_estimation_t12_overrides.v1.json"

OUT_JSON = REF_DIR / "school_rank_estimation_parameter_backlog.v1.json"
OUT_MD = DOCS_DIR / "school_rank_estimation_parameter_backlog.v1.md"


def infer_tier(entity_type: str, short_name: str, district: str) -> str:
    if entity_type in {"campus", "co_branded_school"}:
        return "T5"

    top_keywords = [
        "人大附中",
        "清华附中",
        "北大附中",
        "北师大实验",
        "北师大二附中",
        "第四中学",
        "十一学校",
    ]
    if any(keyword in short_name for keyword in top_keywords):
        return "T1"

    strong_keywords = [
        "北师大附中",
        "首师大附中",
        "北交附中",
        "北理工附中",
        "第八十中学",
        "陈经纶中学",
        "景山学校",
        "八一学校",
        "广渠门中学",
        "汇文中学",
    ]
    if any(keyword in short_name for keyword in strong_keywords):
        return "T2"

    if district in {"海淀区", "西城区", "东城区", "朝阳区"}:
        return "T3"

    return "T4"


def build_parameter_row(row: dict, tier: dict) -> dict:
    same_track_weight = 1.0
    full_grade_weight = 0.9
    unknown_weight = 0.75
    score_reference_weight = 0.9
    school_percentile_weight = 1.0
    min_sample_size = 80
    notes = "2025 基线年 V1 初始参数。后续可按真实样本继续校准。"

    if row["entity_type"] == "branch_school":
        score_reference_weight = 0.85
        full_grade_weight = 0.85
        unknown_weight = 0.7
        notes = "分校类型，默认较主校保守。"
    elif row["entity_type"] == "campus":
        score_reference_weight = 0.8
        school_percentile_weight = 0.9
        full_grade_weight = 0.82
        unknown_weight = 0.68
        min_sample_size = 100
        notes = "校区类型，默认不直接套用主校经验。"
    elif row["entity_type"] == "co_branded_school":
        score_reference_weight = 0.78
        school_percentile_weight = 0.88
        full_grade_weight = 0.8
        unknown_weight = 0.65
        min_sample_size = 100
        notes = "合作校类型，默认按保守口径估算。"

    return {
        "school_id": row["school_id"],
        "official_name": row["official_name"],
        "short_name": row["short_name"],
        "district": row["district"],
        "entity_type": row["entity_type"],
        "canonical_school_name": row["canonical_school_name"],
        "independent_admission": row["independent_admission"],
        "tier_code": tier["tier_code"],
        "tier_name": tier["tier_name"],
        "ranking_basis_weight": {
            "same_track": same_track_weight,
            "full_grade": full_grade_weight,
            "unknown": unknown_weight,
        },
        "score_reference_weight": score_reference_weight,
        "school_percentile_weight": school_percentile_weight,
        "confidence_adjustment": tier["default_confidence_bonus"],
        "range_factor_min": tier["default_range_factor_min"],
        "range_factor_max": tier["default_range_factor_max"],
        "min_sample_size": min_sample_size,
        "parameter_status": "v1_initial_ready",
        "notes": notes,
    }


def main() -> None:
    schools = json.loads(SCHOOL_SOURCE.read_text(encoding="utf-8"))
    tiers = {item["tier_code"]: item for item in json.loads(TIERS_SOURCE.read_text(encoding="utf-8"))}
    overrides = {
        item["school_id"]: item
        for item in json.loads(OVERRIDES_SOURCE.read_text(encoding="utf-8"))
    }

    backlog = []
    for row in schools:
        tier_code = infer_tier(row["entity_type"], row["short_name"], row["district"])
        tier = tiers[tier_code]
        item = build_parameter_row(row, tier)
        override = overrides.get(row["school_id"])
        if override:
            item.update(
                {
                    "tier_code": override["tier_code"],
                    "tier_name": tiers[override["tier_code"]]["tier_name"],
                    "ranking_basis_weight": override["ranking_basis_weight"],
                    "score_reference_weight": override["score_reference_weight"],
                    "school_percentile_weight": override["school_percentile_weight"],
                    "confidence_adjustment": override["confidence_adjustment"],
                    "range_factor_min": override["range_factor_min"],
                    "range_factor_max": override["range_factor_max"],
                    "min_sample_size": override["min_sample_size"],
                    "notes": override["notes"],
                    "parameter_status": "v1_t12_calibrated",
                }
            )
        backlog.append(item)

    OUT_JSON.write_text(json.dumps(backlog, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# 校排转市排参数全量初始表 V1",
        "",
        "## 1. 说明",
        "",
        "这份表是 2025 基线年的全量学校初始参数表。",
        "",
        "用途：",
        "",
        "- 让 195 所学校全部进入可配置状态",
        "- 支撑 V1 的学校估算层",
        "- 为后续年度更新和真实样本校准保留入口",
        "",
        f"- 学校总数：`{len(backlog)}`",
        "",
        "## 2. 样例",
        "",
        "| school_id | 区 | official_name | entity_type | tier_code | range_min | range_max | confidence_adjustment |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]

    for row in backlog[:40]:
        lines.append(
            f"| {row['school_id']} | {row['district']} | {row['official_name']} | {row['entity_type']} | "
            f"{row['tier_code']} | {row['range_factor_min']} | {row['range_factor_max']} | {row['confidence_adjustment']} |"
        )

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"backlog={len(backlog)}")


if __name__ == "__main__":
    main()
