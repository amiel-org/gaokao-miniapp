"""Report the remaining manual-review backlog for 2026 BJEEA major details.

The official catalog PDF has been OCR'd into a draft, but only records in
data/review/college_major_details_manual_review_queue.json with
manualReview.status == "verified" are allowed into the formal mini-program
seed.  This helper gives an auditable queue of what is still missing so the
full backfill can be completed in small batches.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRAFT_JSON = ROOT / "data/staging/major_catalog_ocr/bjeea_2026_target_major_draft.json"
QUEUE_JSON = ROOT / "data/review/college_major_details_manual_review_queue.json"
OUT_JSON = ROOT / "data/review/bjeea_2026_major_manual_review_backlog.json"
OUT_MD = ROOT / "docs/bjeea_2026_major_manual_review_backlog.md"
CORE_LEVELS = {"985/211/双一流", "211/双一流", "双一流/普通一本", "普通一本", "普通二本"}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def group_key(college_code: str, group_code: str) -> str:
    return f"{college_code}_{group_code}"


def main() -> None:
    draft = load_json(DRAFT_JSON)
    queue = load_json(QUEUE_JSON)

    verified_items = [
        item
        for item in queue
        if item.get("manualReview", {}).get("status") == "verified"
    ]
    suppressed_items = [
        item
        for item in queue
        if item.get("manualReview", {}).get("suppressBacklog")
    ]
    verified = {
        group_key(str(item.get("collegeCode", "")), str(item.get("groupCode", "")))
        for item in verified_items + suppressed_items
    }

    backlog_map = {}
    verified_colleges = {
        str(item.get("collegeCode", ""))
        for item in verified_items
        if item.get("collegeCode")
    }
    draft_group_count = 0
    draft_major_count = 0

    for college in draft:
        if college.get("collegeLevel") not in CORE_LEVELS:
            continue
        code = str(college.get("collegeCode", ""))
        groups = college.get("groups", []) or []
        for group in groups:
            group_code = str(group.get("groupCode", ""))
            if not group_code:
                continue
            draft_group_count += 1
            majors = group.get("majors", []) or []
            draft_major_count += len(majors)
            key = group_key(code, group_code)
            if key in verified:
                continue
            candidate = {
                "id": f"2026_{code}_{group_code}",
                "collegeCode": code,
                "collegeName": college.get("collegeName", ""),
                "collegeLevel": college.get("collegeLevel", ""),
                "groupCode": group_code,
                "subjectRequirementTextOcr": group.get("subjectRequirementText", ""),
                "catalogPage": college.get("catalogPage"),
                "catalogColumn": college.get("catalogColumn"),
                "reviewImage": college.get("reviewImage", ""),
                "columnImage": college.get("columnImage", ""),
                "ocrText": college.get("ocrText", ""),
                "ocrMajorCount": len(majors),
                "ocrCandidates": majors,
                "rawLines": group.get("rawLines", []),
                "reviewStatus": "needs_human_confirm",
                "nextAction": "按 reviewImage/columnImage 人工核验专业代码、名称、计划数、学费和限制后，追加到 college_major_details_manual_review_queue.json。",
            }
            current = backlog_map.get(key)
            if current is None or candidate["ocrMajorCount"] > current["ocrMajorCount"]:
                backlog_map[key] = candidate

    backlog = sorted(backlog_map.values(), key=lambda item: (item["collegeCode"], item["groupCode"]))
    OUT_JSON.write_text(json.dumps(backlog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    verified_records = len(verified_items)
    lines = [
        "# 北京2026招生专业目录人工核验剩余队列",
        "",
        "生成日期：2026-06-22",
        "",
        "本文件只列出仍需人工核验的 OCR 草稿专业组；不得把本文件直接当正式数据导入。",
        "",
        "## 摘要",
        "",
        f"- OCR 草稿专业组：{draft_group_count}",
        f"- OCR 草稿专业条目：{draft_major_count}",
        f"- 已人工核验正式专业组：{verified_records}",
        f"- 剩余待核验专业组：{len(backlog)}",
        f"- 已命中人工核验院校数：{len(verified_colleges)}",
        "",
        "## 剩余队列",
        "",
        "| 院校代码 | 院校名称 | 组 | 页码 | 栏 | OCR专业数 | 审核图 |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for item in backlog:
        lines.append(
            f"| {item['collegeCode']} | {item['collegeName']} | {item['groupCode']} | "
            f"{item.get('catalogPage','')} | {item.get('catalogColumn','')} | {item['ocrMajorCount']} | "
            f"`{item.get('reviewImage','')}` |"
        )
    lines.extend(["", "## 前 20 个待核验草稿", ""])
    for item in backlog[:20]:
        lines.append(f"### {item['collegeCode']} {item['collegeName']} {item['groupCode']}组")
        lines.append("")
        lines.append(f"- 选科 OCR：{item['subjectRequirementTextOcr']}")
        lines.append(f"- 审核图：`{item.get('reviewImage','')}`")
        lines.append(f"- 分栏图：`{item.get('columnImage','')}`")
        if item["ocrCandidates"]:
            for major in item["ocrCandidates"]:
                lines.append(
                    f"  - {major.get('majorCode','')} {major.get('majorName','')}："
                    f"{major.get('planCount','')}人"
                )
        else:
            lines.append("  - OCR 暂未稳定抽取专业，请人工查看审核图。")
        lines.append("")
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({
        "draftGroupCount": draft_group_count,
        "draftMajorCount": draft_major_count,
        "verifiedGroupCount": verified_records,
        "pendingGroupCount": len(backlog),
        "json": str(OUT_JSON.relative_to(ROOT)),
        "md": str(OUT_MD.relative_to(ROOT)),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
