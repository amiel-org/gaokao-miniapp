from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
HITS_PATH = ROOT / "data/staging/major_catalog_ocr/target_page_hits.json"
OUT_JSON = ROOT / "data/staging/major_catalog_ocr/major_catalog_candidate_seed.json"
OUT_MD = ROOT / "docs/major_catalog_candidate_seed.md"

GROUP_PATTERN = re.compile(r"[({（]\s*(?P<group>[0-9A-Z]{2})\s*[)}）]\s*(?P<req>[^:\n]{0,30}?选考科目|不限选考科目|[^:\n]{0,30}?必须选考)[：:]")
MAJOR_PATTERN = re.compile(r"(?P<code>[0-9A-Z]{2})\s*[\"”]?(?P<name>[\u4e00-\u9fa5A-Za-z0-9（）()·、]+?)\s+(?P<count>\d+)人")


def normalize_text(text):
    return text.replace("（", "(").replace("）", ")")


def extract_group_blocks(text):
    text = normalize_text(text)
    matches = list(GROUP_PATTERN.finditer(text))
    blocks = []
    for idx, m in enumerate(matches):
        start = m.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        blocks.append({
            "groupCode": m.group("group"),
            "requirementText": m.group("req").strip(),
            "block": text[start:end],
        })
    return blocks


def extract_majors(block):
    majors = []
    for m in MAJOR_PATTERN.finditer(block):
        name = m.group("name").strip()
        if len(name) < 2:
            continue
        majors.append({
            "majorCode": m.group("code"),
            "majorName": name,
            "planCount": int(m.group("count")),
            "raw": m.group(0),
            "reviewStatus": "ocr_candidate_needs_review",
        })
    return majors


def main():
    hits = json.loads(HITS_PATH.read_text(encoding="utf-8"))
    candidates = []
    for page in hits:
        text = (ROOT / page["text"]).read_text(encoding="utf-8", errors="ignore")
        blocks = extract_group_blocks(text)
        for hit in page["hits"]:
            target_groups = {g["groupCode"] for g in hit.get("targetGroups", [])}
            for block in blocks:
                if block["groupCode"] not in target_groups:
                    continue
                majors = extract_majors(block["block"])
                candidates.append({
                    "page": page["page"],
                    "collegeCode": hit["collegeCode"],
                    "collegeName": hit["collegeName"],
                    "groupCode": block["groupCode"],
                    "requirementText": block["requirementText"],
                    "majors": majors,
                    "rawBlock": block["block"][:2200],
                    "sourceText": page["text"],
                    "reviewStatus": "ocr_candidate_needs_review",
                })
    OUT_JSON.write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# 专业目录 OCR 候选种子", "", "日期：2026-04-28", "", "以下为 OCR 自动抽取候选，不直接进入正式推荐。每条都需要人工校验。", ""]
    for item in candidates:
        lines.append(f"## 第 {item['page']} 页：{item['collegeCode']} {item['collegeName']} {item['groupCode']}组")
        lines.append("")
        lines.append(f"- 选科识别：{item['requirementText']}")
        lines.append(f"- 候选专业数：{len(item['majors'])}")
        for major in item["majors"][:20]:
            lines.append(f"  - {major['majorCode']} {major['majorName']}：{major['planCount']}人")
        if not item["majors"]:
            lines.append("  - 暂未从 OCR 文本中稳定抽取专业，需要查看 rawBlock。")
        lines.append("")
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"candidates={len(candidates)}")
    print(f"with_majors={sum(1 for x in candidates if x['majors'])}")
    print(f"json={OUT_JSON}")
    print(f"md={OUT_MD}")


if __name__ == "__main__":
    main()
