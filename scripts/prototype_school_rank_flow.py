from __future__ import annotations

import json
import sys

from prototype_high_school_search import search_schools
from prototype_school_rank_to_city_rank import build_result


def run_flow(query: str, district: str, grade_rank: int, grade_total: int, ranking_basis: str, score: int | None = None, limit: int = 5) -> dict:
    search_items = search_schools(query=query, district=district, limit=limit)
    if not search_items:
        return {
            "ok": False,
            "stage": "search",
            "errors": ["未找到匹配学校，请尝试更完整的名称或更换区筛选。"],
        }

    selected = search_items[0]
    payload = {
        "district": selected["district"],
        "selected_school_id": selected["school_id"],
        "selected_school_name": selected["official_name"],
        "grade_rank": grade_rank,
        "grade_total": grade_total,
        "ranking_basis": ranking_basis,
    }
    if score is not None:
        payload["score"] = score

    estimate_result = build_result(payload)
    return {
        "ok": estimate_result.get("ok", False),
        "query": query,
        "selected_school": selected,
        "estimate_result": estimate_result,
    }


def main() -> None:
    if len(sys.argv) < 6:
        print("Usage: python prototype_school_rank_flow.py <query> <district> <grade_rank> <grade_total> <ranking_basis> [score]")
        sys.exit(1)

    query = sys.argv[1]
    district = sys.argv[2]
    grade_rank = int(sys.argv[3])
    grade_total = int(sys.argv[4])
    ranking_basis = sys.argv[5]
    score = int(sys.argv[6]) if len(sys.argv) > 6 else None

    result = run_flow(
        query=query,
        district=district,
        grade_rank=grade_rank,
        grade_total=grade_total,
        ranking_basis=ranking_basis,
        score=score,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
