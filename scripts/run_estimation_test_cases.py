from __future__ import annotations

import json
from pathlib import Path

from prototype_school_rank_flow_v2 import run_flow


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
DOCS_DIR = ROOT / "docs"

CASES_FILE = REF_DIR / "school_rank_estimation_test_cases.v1.json"
OUT_JSON = REF_DIR / "school_rank_estimation_test_results.v1.json"
OUT_MD = DOCS_DIR / "school_rank_estimation_test_results.v1.md"


def evaluate_expectation(case: dict, result: dict) -> dict:
    expected = case.get("expected", {})
    checks = []

    if expected.get("should_fail"):
        checks.append(
            {
                "name": "should_fail",
                "expected": True,
                "actual": not result["ok"],
                "passed": not result["ok"],
            }
        )
        return {
            "all_passed": all(item["passed"] for item in checks),
            "checks": checks,
        }

    if not result["ok"]:
        checks.append(
            {
                "name": "pipeline_success",
                "expected": True,
                "actual": False,
                "passed": False,
            }
        )
        return {
            "all_passed": False,
            "checks": checks,
        }

    selected = result["selected_school"]
    estimate = result["estimate_result"]["estimated_city_rank"]

    if "selected_school_name" in expected:
        checks.append(
            {
                "name": "selected_school_name",
                "expected": expected["selected_school_name"],
                "actual": selected["official_name"],
                "passed": expected["selected_school_name"] == selected["official_name"],
            }
        )
    if "confidence_level" in expected:
        checks.append(
            {
                "name": "confidence_level",
                "expected": expected["confidence_level"],
                "actual": estimate["confidence_level"],
                "passed": expected["confidence_level"] == estimate["confidence_level"],
            }
        )
    if "entity_type" in expected:
        checks.append(
            {
                "name": "entity_type",
                "expected": expected["entity_type"],
                "actual": selected["entity_type"],
                "passed": expected["entity_type"] == selected["entity_type"],
            }
        )

    return {
        "all_passed": all(item["passed"] for item in checks),
        "checks": checks,
    }


def main() -> None:
    cases = json.loads(CASES_FILE.read_text(encoding="utf-8"))
    results = []

    for case in cases:
        result = run_flow(
            query=case["query"],
            district=case["district"],
            grade_rank=case["grade_rank"],
            grade_total=case["grade_total"],
            ranking_basis=case["ranking_basis"],
            score=case.get("score"),
        )
        evaluation = evaluate_expectation(case, result)
        results.append(
            {
                "case_id": case["case_id"],
                "description": case["description"],
                "ok": result["ok"],
                "query": case["query"],
                "district": case["district"],
                "selected_school": result.get("selected_school"),
                "estimate_result": result.get("estimate_result"),
                "errors": result.get("errors", []),
                "expected": case.get("expected", {}),
                "evaluation": evaluation,
            }
        )

    OUT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# 校排转市排回测样例结果 V1",
        "",
        f"- 样例总数：`{len(results)}`",
        "",
        "| case_id | ok | selected_school | confidence | assertion_passed |",
        "| --- | --- | --- | --- | --- |",
    ]

    for item in results:
        if item["ok"]:
            selected = item["selected_school"]["official_name"]
            confidence = item["estimate_result"]["estimated_city_rank"]["confidence_level"]
        else:
            selected = "-"
            confidence = "-"

        lines.append(
            f"| {item['case_id']} | {item['ok']} | {selected} | {confidence} | {item['evaluation']['all_passed']} |"
        )

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"cases={len(results)}")


if __name__ == "__main__":
    main()
