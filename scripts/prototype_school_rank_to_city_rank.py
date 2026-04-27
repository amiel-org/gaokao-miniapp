from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
RAW_DIR = ROOT.parents[0] / "data" / "raw"

SCHOOL_SOURCE = REF_DIR / "beijing_public_high_schools.standard_seed.v1.json"
PARAM_SOURCE = REF_DIR / "school_rank_estimation_parameter_backlog.v1.json"
RANK_MAP_SOURCE = RAW_DIR / "beijing_rank_map.json"


def load_school_rows() -> list[dict]:
    return json.loads(SCHOOL_SOURCE.read_text(encoding="utf-8"))


def load_school_map() -> dict[str, dict]:
    return {row["school_id"]: row for row in load_school_rows()}


def load_parameter_map() -> dict[str, dict]:
    rows = json.loads(PARAM_SOURCE.read_text(encoding="utf-8"))
    return {row["school_id"]: row for row in rows}


def load_rank_map() -> dict[str, int]:
    return json.loads(RANK_MAP_SOURCE.read_text(encoding="utf-8"))


def validate_input(payload: dict, school_map: dict[str, dict]) -> list[str]:
    errors: list[str] = []
    required_fields = [
        "district",
        "selected_school_id",
        "selected_school_name",
        "grade_rank",
        "grade_total",
        "ranking_basis",
    ]

    for field in required_fields:
        if payload.get(field) in (None, "", []):
            errors.append(f"{field} 不能为空")

    if errors:
        return errors

    if payload["selected_school_id"] not in school_map:
        errors.append("selected_school_id 未命中标准学校库")
        return errors

    school = school_map[payload["selected_school_id"]]
    if payload["selected_school_name"] != school["official_name"]:
        errors.append("selected_school_name 与标准学校库不一致")

    try:
        grade_rank = int(payload["grade_rank"])
        grade_total = int(payload["grade_total"])
    except Exception:
        errors.append("grade_rank 和 grade_total 必须为整数")
        return errors

    if grade_rank <= 0:
        errors.append("grade_rank 必须大于 0")
    if grade_total <= 0:
        errors.append("grade_total 必须大于 0")
    if grade_rank > grade_total:
        errors.append("grade_rank 不能大于 grade_total")

    score = payload.get("score")
    if score is not None:
        try:
            score_val = int(score)
            if score_val < 300 or score_val > 750:
                errors.append("score 超出合理范围")
        except Exception:
            errors.append("score 必须为整数")

    return errors


def score_rank_reference(score: int | None, rank_map: dict[str, int]) -> int | None:
    if score is None:
        return None
    return rank_map.get(str(score))


def estimate_range(official_rank: int | None, school_percentile: float, params: dict) -> tuple[int, int, list[str]]:
    estimation_basis: list[str] = ["school_rank_input"]
    if official_rank is not None:
        estimation_basis.append("score_reference")
        rank_min = max(1, int(official_rank * params["range_factor_min"]))
        rank_max = int(official_rank * params["range_factor_max"])
        return rank_min, rank_max, estimation_basis

    # 没有分数时，只能做更保守的占位估算
    estimation_basis.append("placeholder_without_score")
    rank_min = max(1, int(school_percentile * 10000 * params["range_factor_min"]))
    rank_max = int(school_percentile * 15000 * params["range_factor_max"])
    return rank_min, rank_max, estimation_basis


def build_result(payload: dict) -> dict:
    school_map = load_school_map()
    parameter_map = load_parameter_map()
    rank_map = load_rank_map()

    errors = validate_input(payload, school_map)
    if errors:
        return {"ok": False, "errors": errors}

    school = school_map[payload["selected_school_id"]]
    params = parameter_map.get(payload["selected_school_id"])
    if not params:
        return {"ok": False, "errors": ["未命中学校估算参数表"]}

    score = int(payload["score"]) if payload.get("score") is not None else None
    official_rank = score_rank_reference(score, rank_map)

    grade_rank = int(payload["grade_rank"])
    grade_total = int(payload["grade_total"])
    school_percentile = round(grade_rank / grade_total, 4)

    explanation = "当前结果为预测区间，不等同于官方位次。"
    confidence_score = 0.5 + params["confidence_adjustment"]

    if school["entity_type"] != "main_school":
        explanation += " 当前学校为分校/校区/合作校，已按更保守口径处理。"

    ranking_basis = payload["ranking_basis"]
    confidence_score += params["ranking_basis_weight"].get(ranking_basis, params["ranking_basis_weight"]["unknown"]) - 0.75
    if ranking_basis == "unknown":
        explanation += " 排名口径不明确，已降低置信度。"

    if score is not None and official_rank is not None:
        confidence_score += params["score_reference_weight"] - 0.8

    if grade_total < params["min_sample_size"]:
        confidence_score -= 0.08
        explanation += " 年级样本规模偏小，结果波动风险较高。"

    confidence_score = max(0.2, min(confidence_score, 0.9))
    if confidence_score >= 0.75:
        confidence_level = "high"
    elif confidence_score >= 0.5:
        confidence_level = "medium"
    else:
        confidence_level = "low"

    rank_min, rank_max, estimation_basis = estimate_range(
        official_rank=official_rank,
        school_percentile=school_percentile,
        params=params,
    )

    if school["entity_type"] == "main_school":
        estimation_basis.append("main_school_context")
    else:
        estimation_basis.append(school["entity_type"])

    return {
        "ok": True,
        "input_summary": {
            "district": payload["district"],
            "school_id": payload["selected_school_id"],
            "school_name": payload["selected_school_name"],
            "grade_rank": grade_rank,
            "grade_total": grade_total,
            "ranking_basis": ranking_basis,
            "score": score,
        },
        "school_context": {
            "entity_type": school["entity_type"],
            "canonical_school_name": school["canonical_school_name"],
            "independent_admission": school["independent_admission"],
        },
        "parameter_context": {
            "tier_code": params["tier_code"],
            "tier_name": params["tier_name"],
            "range_factor_min": params["range_factor_min"],
            "range_factor_max": params["range_factor_max"],
            "confidence_adjustment": params["confidence_adjustment"],
            "min_sample_size": params["min_sample_size"],
        },
        "official_reference": {
            "score_rank_reference": official_rank,
            "reference_source": "北京教育考试院分数分布 / 本地 rank_map",
        },
        "estimated_city_rank": {
            "rank_min": rank_min,
            "rank_max": rank_max,
            "confidence_level": confidence_level,
            "confidence_score": round(confidence_score, 2),
            "estimation_basis": estimation_basis,
            "school_percentile": school_percentile,
            "explanation": explanation,
        },
        "next_step_hint": {
            "can_continue_to_recommendation": True,
            "recommended_action": "进入北京市定位与志愿初筛",
        },
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python prototype_school_rank_to_city_rank.py '<json_payload>'")
        sys.exit(1)

    payload = json.loads(sys.argv[1])
    result = build_result(payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
