"""Locate 2026 target colleges inside OCR text from the official BJEEA PDF.

This is the next step after discovering/downloading the scanned catalog: before
we can claim full 2026 data, every target college must have a page candidate and
then the corresponding college block must be extracted and reviewed.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS_JSON = ROOT / "data/staging/major_catalog_ocr/bjeea_2026_target_colleges.json"
OCR_TEXT_DIR = ROOT / "data/staging/major_catalog_ocr/text"
OCR_COLUMN_TEXT_DIR = ROOT / "data/staging/major_catalog_ocr/ordinary_columns/text"
OUT_JSON = ROOT / "data/staging/major_catalog_ocr/bjeea_2026_target_college_page_candidates.json"
OUT_MD = ROOT / "docs/bjeea_2026_full_backfill_gap_report.md"
MANUAL_REVIEW_QUEUE = ROOT / "data/review/college_major_details_manual_review_queue.json"

# In the official PDF, "本科普通批 招生院校 专业及人数" starts at page 29.
# Earlier pages include advance/special categories and can mention the same
# target colleges; using them would pollute ordinary-batch backfill.
ORDINARY_BATCH_PAGE_START = 29
ORDINARY_BATCH_PAGE_END = 44


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def excerpt_around(text: str, needle: str, radius: int = 180) -> str:
    pos = text.find(needle)
    if pos < 0:
        pos = compact(text).find(compact(needle))
        if pos < 0:
            return ""
        # Compact offsets cannot be mapped perfectly; fall back to short text.
        return text[:800].strip()
    return text[max(0, pos - radius) : pos + len(needle) + radius].strip()


def read_targets() -> list[dict]:
    payload = json.loads(TARGETS_JSON.read_text(encoding="utf-8"))
    return payload["targets"]


def read_ocr_pages() -> list[dict]:
    pages = []
    column_paths = sorted(OCR_COLUMN_TEXT_DIR.glob("p*_c*.txt"))
    if column_paths:
        for path in column_paths:
            match = re.match(r"p(\d{3})_c(\d+)$", path.stem)
            if not match:
                continue
            page_no = int(match.group(1))
            if page_no < ORDINARY_BATCH_PAGE_START or page_no > ORDINARY_BATCH_PAGE_END:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            pages.append(
                {
                    "page": page_no,
                    "column": int(match.group(2)),
                    "textPath": str(path.relative_to(ROOT)),
                    "text": text,
                    "compact": compact(text),
                }
            )
        return pages

    for path in sorted(OCR_TEXT_DIR.glob("page_*.txt")):
        try:
            page_no = int(path.stem.split("_")[1])
        except Exception:
            continue
        if page_no < ORDINARY_BATCH_PAGE_START or page_no > ORDINARY_BATCH_PAGE_END:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        pages.append({"page": page_no, "column": None, "textPath": str(path.relative_to(ROOT)), "text": text, "compact": compact(text)})
    return pages


def score_page(page: dict, target: dict) -> tuple[int, str, str]:
    code = target.get("collegeCode", "")
    name = target["collegeName"]
    c = page["compact"]
    score = 0
    reason = ""
    needle_for_excerpt = name

    if code and code + name in c:
        score = 100
        reason = "code_and_name_compact_match"
        needle_for_excerpt = code
    elif code and re.search(rf"{re.escape(code)}.{{0,12}}{re.escape(name)}", page["text"]):
        score = 90
        reason = "code_near_name_text_match"
        needle_for_excerpt = code
    elif re.search(rf"\d{{4}}.{{0,12}}{re.escape(name)}", page["text"]):
        score = 70
        reason = "any_code_near_name_text_match"
    elif name in page["text"] or name in c:
        score = 35
        reason = "name_only_match"

    if score:
        excerpt = excerpt_around(page["text"], needle_for_excerpt)
        count_match = re.search(rf"{re.escape(name)}[^\n]{{0,20}}?(\d+)\s*人", excerpt)
        plan_count = int(count_match.group(1)) if count_match else None
        if plan_count and plan_count >= 20:
            score += 8
            reason += "_plan_count_seen"
        return score, reason, excerpt
    return 0, "", ""


def load_verified_ids() -> set[str]:
    if not MANUAL_REVIEW_QUEUE.exists():
        return set()
    queue = json.loads(MANUAL_REVIEW_QUEUE.read_text(encoding="utf-8"))
    result = set()
    for item in queue:
        if item.get("manualReview", {}).get("status") == "verified":
            result.add(str(item.get("collegeCode", "")))
    return result


def main() -> None:
    targets = read_targets()
    pages = read_ocr_pages()
    verified_codes = load_verified_ids()
    located = []
    for target in targets:
        candidates = []
        for page in pages:
            score, reason, excerpt = score_page(page, target)
            if score:
                candidates.append(
                    {
                        "page": page["page"],
                        "column": page.get("column"),
                        "score": score,
                        "reason": reason,
                        "textPath": page["textPath"],
                        "reviewImage": f"output/major-catalog-review/2026-official-pages-clean/p{page['page']:03d}.jpg",
                        "columnImage": f"data/staging/major_catalog_ocr/ordinary_columns/images/p{page['page']:03d}_c{page.get('column')}.png"
                        if page.get("column")
                        else "",
                        "excerpt": excerpt[:900],
                    }
                )
        candidates.sort(key=lambda x: (-x["score"], x["page"]))
        best = candidates[0] if candidates else None
        located.append(
            {
                **target,
                "located": bool(best and best["score"] >= 70),
                "bestPage": best["page"] if best else None,
                "bestColumn": best.get("column") if best else None,
                "bestScore": best["score"] if best else 0,
                "candidateCount": len(candidates),
                "manualVerifiedAlready": target.get("collegeCode") in verified_codes,
                "candidates": candidates[:5],
            }
        )

    located_count = sum(1 for item in located if item["located"])
    verified_count = sum(1 for item in located if item["manualVerifiedAlready"])
    payload = {
        "targetCount": len(targets),
        "locatedCount": located_count,
        "notLocatedCount": len(targets) - located_count,
        "manualVerifiedCollegeCount": verified_count,
        "ocrPageRange": f"page_{ORDINARY_BATCH_PAGE_START:03d}-page_{ORDINARY_BATCH_PAGE_END:03d}",
        "items": located,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# 北京2026招生专业目录全量补齐缺口报告",
        "",
        "生成日期：2026-06-22",
        "",
        "## 结论",
        "",
        f"- 目标院校：{len(targets)} 所（北京高校、本科普通批、二本及以上层次；二本以下不收录）",
        f"- 已在官方 PDF OCR 文本中定位：{located_count} 所",
        f"- 尚未稳定定位：{len(targets) - located_count} 所",
        f"- 已进入人工核验正式出口的院校：{verified_count} 所（专业组层面当前为 10 组 / 38 条专业）",
        "",
        f"说明：本报告只证明“已定位到官方 PDF 本科普通批页码”（第 {ORDINARY_BATCH_PAGE_START}-{ORDINARY_BATCH_PAGE_END} 页），不等同于专业明细已全量人工核验。下一步需要按定位页裁切院校块、抽取专业组、逐项核验后再导出到小程序正式数据。",
        "",
        "## 定位清单",
        "",
        "| 院校代码 | 院校名称 | 层次 | 定位页 | 栏 | 候选块数 | 已人工核验 | 状态 |",
        "| --- | --- | --- | ---: | ---: | ---: | --- | --- |",
    ]
    for item in located:
        status = "已定位" if item["located"] else "待复核"
        page = item["bestPage"] or ""
        column = item["bestColumn"] or ""
        verified = "是" if item["manualVerifiedAlready"] else "否"
        lines.append(
            f"| {item['collegeCode']} | {item['collegeName']} | {item['collegeLevel']} | {page} | {column} | {item['candidateCount']} | {verified} | {status} |"
        )
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"target_count={len(targets)}")
    print(f"located_count={located_count}")
    print(f"not_located_count={len(targets) - located_count}")
    print(f"manual_verified_college_count={verified_count}")
    print(f"json={OUT_JSON}")
    print(f"md={OUT_MD}")


if __name__ == "__main__":
    main()
