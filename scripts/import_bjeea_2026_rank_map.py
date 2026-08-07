from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "data" / "raw" / "admissions" / "2026" / "bjeea_2026_gaokao_score_distribution.pdf"
REFERENCE_PATH = ROOT / "data" / "reference" / "beijing_rank_map_2026.json"
MINIPROGRAM_PATH = ROOT / "miniprogram" / "data" / "beijing-rank-map-2026.js"
SOURCE_URL = "https://www.bjeea.cn/uploads/soft/260625/2026年北京市高考考生分数分布.pdf"
SOURCE_PAGE_URL = "https://www.bjeea.cn/html/gkgz/tzgg/2026/0624/88238.html"


def extract_rank_map(pdf_path: Path) -> dict[str, int]:
    reader = PdfReader(pdf_path)
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    rows: dict[int, tuple[int, int]] = {}
    pattern = re.compile(r"^(\d{3})(?:分以上)?\s+(\d+)\s+(\d+)$")
    for raw_line in text.splitlines():
        match = pattern.match(raw_line.strip())
        if not match:
            continue
        score, segment_count, cumulative_count = map(int, match.groups())
        if score < 380 or score > 692:
            continue
        rows[score] = (segment_count, cumulative_count)

    expected_scores = list(range(380, 693))
    missing_scores = [score for score in expected_scores if score not in rows]
    if missing_scores:
        raise ValueError(f"missing score rows: {missing_scores[:10]}")

    previous_cumulative = 0
    for score in range(692, 379, -1):
        segment_count, cumulative_count = rows[score]
        if cumulative_count <= previous_cumulative:
            raise ValueError(f"non-increasing cumulative count at score {score}")
        if cumulative_count - previous_cumulative != segment_count:
            raise ValueError(
                f"segment count mismatch at score {score}: "
                f"expected {cumulative_count - previous_cumulative}, got {segment_count}"
            )
        previous_cumulative = cumulative_count

    return {str(score): rows[score][1] for score in expected_scores}


def main() -> None:
    if not PDF_PATH.exists():
        raise FileNotFoundError(PDF_PATH)
    pdf_bytes = PDF_PATH.read_bytes()
    rank_map = extract_rank_map(PDF_PATH)
    payload = {
        "meta": {
            "year": 2026,
            "publisher": "北京教育考试院",
            "title": "北京市2026年高考考生分数分布",
            "sourcePageUrl": SOURCE_PAGE_URL,
            "sourceUrl": SOURCE_URL,
            "localPath": str(PDF_PATH.relative_to(ROOT)).replace("\\", "/"),
            "sha256": hashlib.sha256(pdf_bytes).hexdigest(),
            "scoreMin": 380,
            "scoreMax": 692,
            "recordCount": len(rank_map),
            "lowestExactScoreCumulativeCount": rank_map["380"],
            "note": "380至692分为逐分累计人数；380分以下官方PDF按10分段汇总，不生成伪逐分位次。",
        },
        "ranks": rank_map,
    }
    REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    MINIPROGRAM_PATH.parent.mkdir(parents=True, exist_ok=True)
    REFERENCE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MINIPROGRAM_PATH.write_text(
        "module.exports=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
