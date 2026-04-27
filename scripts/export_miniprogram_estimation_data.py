from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
RAW_DIR = ROOT.parents[0] / "data" / "raw"
MINI_DATA_DIR = ROOT / "miniprogram" / "data"

PARAM_SOURCE = REF_DIR / "school_rank_estimation_parameter_backlog.v1.json"
RANK_MAP_SOURCE = RAW_DIR / "beijing_rank_map.json"

OUT_PARAM_JS = MINI_DATA_DIR / "school-estimation-params.js"
OUT_RANK_JS = MINI_DATA_DIR / "beijing-rank-map.js"


def main() -> None:
    params = json.loads(PARAM_SOURCE.read_text(encoding="utf-8"))
    rank_map = json.loads(RANK_MAP_SOURCE.read_text(encoding="utf-8"))

    MINI_DATA_DIR.mkdir(parents=True, exist_ok=True)

    param_payload = "module.exports = " + json.dumps(params, ensure_ascii=False, indent=2) + ";\n"
    rank_payload = "module.exports = " + json.dumps(rank_map, ensure_ascii=False, indent=2) + ";\n"

    OUT_PARAM_JS.write_text(param_payload, encoding="utf-8")
    OUT_RANK_JS.write_text(rank_payload, encoding="utf-8")

    print(f"params={len(params)}")
    print(f"rank_map={len(rank_map)}")


if __name__ == "__main__":
    main()
