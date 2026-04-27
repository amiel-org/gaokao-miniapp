from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
SOURCE = REF_DIR / "beijing_public_high_schools.standard_seed.v1.json"


def normalize(text: str) -> str:
    return "".join(text.split()).strip().lower()


def score_match(query: str, row: dict) -> tuple[int, str]:
    query_n = normalize(query)
    official = normalize(row["official_name"])
    short_name = normalize(row["short_name"])
    canonical = normalize(row["canonical_school_name"])
    district = normalize(row["district"])
    aliases = [normalize(x) for x in row["aliases"]]
    tokens = [normalize(x) for x in row["search_tokens"]]

    if not query_n:
        return 0, "empty_query"

    if query_n == official:
        return 120, "official_exact"
    if query_n == short_name:
        return 110, "short_name_exact"
    if query_n == canonical:
        return 108, "canonical_exact"
    if query_n in aliases:
        return 105, "alias_exact"
    if query_n in tokens:
        return 100, "token_exact"

    if official.startswith(query_n):
        return 95, "official_prefix"
    if short_name.startswith(query_n):
        return 92, "short_name_prefix"
    if canonical.startswith(query_n):
        return 90, "canonical_prefix"
    if any(alias.startswith(query_n) for alias in aliases):
        return 88, "alias_prefix"

    if query_n in official:
        return 80, "official_contains"
    if query_n in short_name:
        return 78, "short_name_contains"
    if query_n in canonical:
        return 76, "canonical_contains"
    if any(query_n in alias for alias in aliases):
        return 74, "alias_contains"
    if any(query_n in token for token in tokens):
        return 70, "token_contains"

    if district and district in query_n:
        return 20, "district_weak"

    return 0, "no_match"


def build_result(row: dict, score: int, reason: str) -> dict:
    return {
        "school_id": row["school_id"],
        "official_name": row["official_name"],
        "short_name": row["short_name"],
        "district": row["district"],
        "entity_type": row["entity_type"],
        "canonical_school_name": row["canonical_school_name"],
        "independent_admission": row["independent_admission"],
        "match_score": score,
        "match_reason": reason,
    }


def search_schools(query: str, district: str | None = None, limit: int = 10) -> list[dict]:
    rows = json.loads(SOURCE.read_text(encoding="utf-8"))
    district_n = normalize(district or "")

    candidates = []
    for row in rows:
        if district_n and normalize(row["district"]) != district_n:
            continue
        score, reason = score_match(query, row)
        if score <= 0:
            continue
        candidates.append(build_result(row, score, reason))

    candidates.sort(
        key=lambda x: (
            -x["match_score"],
            x["district"],
            x["canonical_school_name"],
            x["official_name"],
        )
    )
    return candidates[:limit]


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python prototype_high_school_search.py <query> [district]")
        sys.exit(1)

    query = sys.argv[1]
    district = sys.argv[2] if len(sys.argv) > 2 else None
    results = search_schools(query, district=district)
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
