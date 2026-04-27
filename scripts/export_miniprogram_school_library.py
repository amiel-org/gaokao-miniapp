from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
MINI_DATA_DIR = ROOT / "miniprogram" / "data"

SOURCE = REF_DIR / "beijing_public_high_schools.standard_seed.v1.json"
OUT_JS = MINI_DATA_DIR / "school-library.js"


def build_miniprogram_rows(rows: list[dict]) -> list[dict]:
    items = []
    for row in rows:
        items.append(
            {
                "school_id": row["school_id"],
                "official_name": row["official_name"],
                "short_name": row["short_name"],
                "district": row["district"],
                "entity_type": row["entity_type"],
                "canonical_school_name": row["canonical_school_name"],
                "aliases": row["aliases"],
                "search_tokens": row["search_tokens"],
                "independent_admission": row["independent_admission"],
            }
        )
    return items


def main() -> None:
    rows = json.loads(SOURCE.read_text(encoding="utf-8"))
    items = build_miniprogram_rows(rows)
    MINI_DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = "module.exports = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n"
    OUT_JS.write_text(payload, encoding="utf-8")
    print(f"exported={len(items)}")


if __name__ == "__main__":
    main()
