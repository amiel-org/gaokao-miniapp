"""Build a human-review draft for college major details from cropped OCR blocks.

The output is deliberately kept in staging/review status. OCR text from the
scanned official catalog is not authoritative enough to feed the frontend or
formal recommendation data without manual verification.
"""

from pathlib import Path
import json
import os
import re

ROOT = Path(__file__).resolve().parents[1]
OCR_ROOT = Path(os.environ.get("MAJOR_CATALOG_OCR_DIR", str(ROOT / "data/staging/major_catalog_ocr")))
MANIFEST = Path(os.environ.get("MAJOR_CATALOG_MANIFEST", str(OCR_ROOT / "college_block_manifest.json")))
OUT_JSON = Path(os.environ.get("MAJOR_CATALOG_DRAFT_JSON", str(OCR_ROOT / "college_major_details_draft.json")))
OUT_MD = Path(os.environ.get("MAJOR_CATALOG_DRAFT_MD", str(ROOT / "docs/college_major_details_draft_review.md")))
SOURCE_TITLE = os.environ.get("MAJOR_CATALOG_SOURCE_TITLE", "2025普通高等学校招生专业目录")
SOURCE_URL = os.environ.get("MAJOR_CATALOG_SOURCE_URL", "https://www.bjeea.cn/uploads/20250613/202506131926-3.pdf")

COLLEGE_CODE_RE = re.compile(r"(?m)^\s*(\d{4})\s+[^\n]{2,30}")
GROUP_RE_TEMPLATE = r"[{{(（]\s*{group}\s*[}})）]\s*(?P<req>[^:\n]{{0,40}}?(?:选考科目|必须选考))\s*[：:]"
MAJOR_RE = re.compile(r"(?P<code>[0-9A-Z]{2})\s+[\"”]?(?P<name>[\u4e00-\u9fa5A-Za-z0-9（）()·、]+?)\s+(?P<count>\d+)人")


def read_text(rel):
    return (ROOT / rel).read_text(encoding="utf-8", errors="ignore")


def isolate_college_text(text, college_code):
    pos = text.find(college_code)
    if pos < 0:
        return ""
    rest = text[pos:]
    matches = list(COLLEGE_CODE_RE.finditer(rest))
    if len(matches) >= 2:
        return rest[:matches[1].start()].strip()
    return rest.strip()


def isolate_group_text(college_text, group_code):
    pattern = re.compile(GROUP_RE_TEMPLATE.format(group=re.escape(group_code)))
    m = pattern.search(college_text)
    if not m:
        return "", ""
    start = m.start()
    next_m = re.search(r"[({（]\s*[0-9A-Z]{2}\s*[)}）]\s*[^:\n]{0,40}(?:选考科目|必须选考)\s*[：:]", college_text[m.end():])
    end = m.end() + next_m.start() if next_m else len(college_text)
    return college_text[start:end].strip(), m.group("req").strip()


def extract_majors(group_text):
    majors = []
    for m in MAJOR_RE.finditer(group_text):
        name = m.group("name").strip()
        # Filter obvious OCR garbage headings.
        if len(name) < 2 or "北京" in name and len(name) < 8:
            continue
        majors.append({
            "majorCode": m.group("code"),
            "majorName": name,
            "planCount": int(m.group("count")),
            "raw": m.group(0),
            "reviewStatus": "needs_human_confirm",
        })
    return majors


def dedupe_key(item):
    return (item["collegeCode"], item["groupCode"])


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    drafts = {}
    for item in manifest:
        if item.get("status") != "grid_crop_ocr_matched":
            continue
        text = read_text(item["ocrText"])
        college_text = isolate_college_text(text, item["collegeCode"])
        if not college_text:
            continue
        for target in item.get("targetGroups", []):
            group_code = target.get("groupCode")
            group_text, req = isolate_group_text(college_text, group_code)
            if not group_text:
                continue
            majors = extract_majors(group_text)
            key = (item["collegeCode"], group_code)
            current = drafts.get(key)
            candidate = {
                "collegeCode": item["collegeCode"],
                "collegeName": item["collegeName"],
                "groupCode": group_code,
                "catalogPage": item["page"],
                "subjectRequirementText": req,
                "majors": majors,
                "rawGroupText": group_text,
                "reviewImage": item.get("reviewImage"),
                "sourceBoxImage": item.get("sourceBoxImage"),
                "ocrText": item.get("ocrText"),
                "reviewStatus": "needs_human_confirm",
                "source": {
                    "publisher": "北京教育考试院",
                    "title": SOURCE_TITLE,
                    "url": SOURCE_URL,
                },
            }
            # Keep the candidate with more extracted majors for same group.
            if current is None or len(candidate["majors"]) > len(current["majors"]):
                drafts[key] = candidate
    results = list(drafts.values())
    results.sort(key=lambda x: (x["collegeCode"], x["groupCode"]))
    OUT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# college_major_details 第一批草稿审核",
        "",
        "日期：2026-05-11",
        "",
        "用户已确认裁切块整体可用。本文件从裁切块 OCR 中抽取目标专业组草稿，但仍需人工确认后才能进入正式数据。",
        "",
        "## 本批摘要",
        "",
        f"- 草稿专业组数：{len(results)}",
        f"- 已抽取到候选专业的专业组数：{sum(1 for x in results if x['majors'])}",
        "- 数据状态：`needs_human_confirm`，只作为人工审核草稿，不接入前端正式推荐。",
        "- 审核建议：以审核图为准逐项核对专业代码、专业名称、计划数、学费、体检/色弱限制。",
        "",
    ]
    for item in results:
        lines.append(f"## {item['collegeCode']} {item['collegeName']} {item['groupCode']}组")
        lines.append("")
        lines.append(f"- 页码：{item['catalogPage']}")
        lines.append(f"- 选科识别：{item['subjectRequirementText']}")
        lines.append(f"- 审核图：`{item.get('reviewImage','')}`")
        lines.append(f"- 候选专业数：{len(item['majors'])}")
        if item["majors"]:
            for major in item["majors"]:
                lines.append(f"  - {major['majorCode']} {major['majorName']}：{major['planCount']}人")
        else:
            lines.append("  - 暂未稳定抽取到专业，请人工查看审核图和 rawGroupText。")
        lines.append("")
        lines.append("```text")
        lines.append(item["rawGroupText"][:1200])
        lines.append("```")
        lines.append("")
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"draft_groups={len(results)}")
    print(f"groups_with_majors={sum(1 for x in results if x['majors'])}")
    print(f"json={OUT_JSON}")
    print(f"md={OUT_MD}")


if __name__ == "__main__":
    main()
