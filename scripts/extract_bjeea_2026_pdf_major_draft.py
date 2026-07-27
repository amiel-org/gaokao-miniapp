"""Extract a full-review draft from column OCR of the official 2026 catalog.

The output is not formal mini-program data.  It is a complete target-college
draft used to accelerate manual verification: OCR candidates must still be
checked against the page image before being exported as verified records.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCATIONS_JSON = ROOT / "data/staging/major_catalog_ocr/bjeea_2026_target_college_page_candidates.json"
OUT_JSON = ROOT / "data/staging/major_catalog_ocr/bjeea_2026_target_major_draft.json"
OUT_MD = ROOT / "docs/bjeea_2026_target_major_draft_review.md"

COLLEGE_HEADING_RE = re.compile(r"^\s*[”\"']?\s*(\d{4})\s+(.+?)\s+(\d+)\s*人")
GROUP_RE = re.compile(r"^\s*[\{(（]\s*([0-9A-Za-z]{2})\s*[\})）]\s*(.+?)(?:[:：]\s*)?$")
MAJOR_RE = re.compile(r"^\s*([0-9A-Za-z]{2})\s+[”\"“']?\s*(.+?)\s+(\d+)\s*人(?:\s*[（(](.*?)[）)])?\s*$")


def normalize_group_code(value: str) -> str:
    value = value.strip().upper()
    # OCR often reads {01} as {Ol}/{O1}.
    return value.replace("O", "0").replace("L", "1") if value in {"OL", "O1"} else value


def normalize_major_code(value: str) -> str:
    return value.strip().upper().replace("O", "0") if value.strip().upper() in {"O1", "O2"} else value.strip().upper()


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def line_has_heading(line: str) -> bool:
    return bool(COLLEGE_HEADING_RE.search(line))


def find_block(lines: list[str], code: str, name: str) -> list[str]:
    start = -1
    for idx, line in enumerate(lines):
        c = re.sub(r"\s+", "", line)
        if code and code in c and name in c:
            start = idx
            break
        if code and c.startswith(code):
            start = idx
            break
    if start < 0:
        for idx, line in enumerate(lines):
            if name in line:
                start = idx
                break
    if start < 0:
        return []
    end = len(lines)
    for idx in range(start + 1, len(lines)):
        if line_has_heading(lines[idx]):
            end = idx
            break
    return lines[start:end]


def parse_groups(block_lines: list[str]) -> list[dict]:
    groups: list[dict] = []
    current: dict | None = None
    current_major: dict | None = None

    for raw in block_lines[1:]:
        line = clean(raw)
        if not line:
            continue
        gm = GROUP_RE.match(line)
        if gm and ("选考" in line or "必须" in line or "均须" in line or "不限" in line or "中外合作" in line):
            current = {
                "groupCode": normalize_group_code(gm.group(1)),
                "subjectRequirementText": clean(gm.group(2)),
                "majors": [],
                "rawLines": [raw],
            }
            groups.append(current)
            current_major = None
            continue
        if current is None:
            continue
        current["rawLines"].append(raw)
        mm = MAJOR_RE.match(line)
        if mm:
            current_major = {
                "majorCode": normalize_major_code(mm.group(1)),
                "majorName": clean(mm.group(2).strip("，,、:：")),
                "planCount": int(mm.group(3)),
                "raw": line,
                "notesOcr": clean(mm.group(4) or ""),
                "reviewStatus": "needs_human_confirm",
            }
            current["majors"].append(current_major)
        elif current_major and (line.startswith(("(", "（")) or line.endswith((")", "）")) or "元" in line or "含" in line or "不招" in line or "只招" in line):
            current_major["raw"] += " " + line
            if current_major["notesOcr"]:
                current_major["notesOcr"] += " " + line
            else:
                current_major["notesOcr"] = line
    return groups


def main() -> None:
    locations = json.loads(LOCATIONS_JSON.read_text(encoding="utf-8"))
    drafts = []
    for item in locations["items"]:
        if not item.get("located") or not item.get("candidates"):
            drafts.append({**item, "reviewStatus": "location_missing", "groups": []})
            continue
        candidate = item["candidates"][0]
        text_path = ROOT / candidate["textPath"]
        lines = [line.rstrip() for line in text_path.read_text(encoding="utf-8", errors="ignore").splitlines()]
        block_lines = find_block(lines, item["collegeCode"], item["collegeName"])
        groups = parse_groups(block_lines)
        drafts.append(
            {
                "collegeCode": item["collegeCode"],
                "collegeName": item["collegeName"],
                "collegeLevel": item["collegeLevel"],
                "catalogPage": candidate["page"],
                "catalogColumn": candidate.get("column"),
                "reviewImage": candidate.get("reviewImage"),
                "columnImage": candidate.get("columnImage"),
                "ocrText": candidate["textPath"],
                "reviewStatus": "needs_human_confirm",
                "groups": groups,
                "rawBlockText": "\n".join(block_lines[:220]),
            }
        )

    OUT_JSON.write_text(json.dumps(drafts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    group_count = sum(len(item.get("groups", [])) for item in drafts)
    major_count = sum(len(group.get("majors", [])) for item in drafts for group in item.get("groups", []))

    lines = [
        "# 北京2026目标院校专业目录 OCR 草稿",
        "",
        "生成日期：2026-06-22",
        "",
        "本文件来自官方 PDF 本科普通批页码的分栏 OCR，只作为人工核验草稿；不得直接冒充已核验正式数据。",
        "",
        f"- 目标院校：{len(drafts)} 所",
        f"- OCR 抽取专业组：{group_count} 个",
        f"- OCR 抽取专业条目：{major_count} 条",
        "",
        "| 院校代码 | 院校名称 | 页码 | 栏 | OCR专业组 | OCR专业条目 | 状态 |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for item in drafts:
        gc = len(item.get("groups", []))
        mc = sum(len(group.get("majors", [])) for group in item.get("groups", []))
        lines.append(
            f"| {item['collegeCode']} | {item['collegeName']} | {item.get('catalogPage','')} | {item.get('catalogColumn','')} | {gc} | {mc} | {item['reviewStatus']} |"
        )
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"colleges={len(drafts)}")
    print(f"draft_groups={group_count}")
    print(f"draft_majors={major_count}")
    print(f"json={OUT_JSON}")
    print(f"md={OUT_MD}")


if __name__ == "__main__":
    main()
