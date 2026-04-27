from __future__ import annotations

import json
import sys
from pathlib import Path

from prototype_high_school_search import search_schools


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"


def build_search_response(query: str, district: str | None = None, limit: int = 10) -> dict:
    items = search_schools(query=query, district=district, limit=limit)
    return {
        "query": query,
        "district": district or "",
        "total": len(items),
        "items": items,
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python prototype_school_rank_entry_api.py <query> [district] [limit]")
        sys.exit(1)

    query = sys.argv[1]
    district = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    payload = build_search_response(query=query, district=district, limit=limit)
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
