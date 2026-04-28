from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
HITS_PATH = ROOT / "data/staging/major_catalog_ocr/target_page_hits.json"
OUT_JSON = ROOT / "data/staging/major_catalog_ocr/target_excerpts.json"
OUT_MD = ROOT / "docs/major_catalog_ocr_excerpts.md"


def compact_index(text):
    chars = []
    positions = []
    for i, ch in enumerate(text):
        if not ch.isspace():
            chars.append(ch)
            positions.append(i)
    return "".join(chars), positions


def excerpt_around(text, needle, radius=500):
    c, positions = compact_index(text)
    pos = c.find(needle)
    if pos < 0:
        return ""
    start_c = max(0, pos - radius)
    end_c = min(len(c) - 1, pos + len(needle) + radius)
    start = positions[start_c]
    end = positions[end_c]
    return text[start:end].strip()


def main():
    hits = json.loads(HITS_PATH.read_text(encoding="utf-8"))
    excerpts = []
    for page in hits:
        text_path = ROOT / page["text"]
        text = text_path.read_text(encoding="utf-8", errors="ignore")
        for hit in page["hits"]:
            code = hit["collegeCode"]
            name = hit["collegeName"]
            excerpt = excerpt_around(text, code) or excerpt_around(text, name)
            excerpts.append({
                "page": page["page"],
                "collegeCode": code,
                "collegeName": name,
                "targetGroups": hit.get("targetGroups", []),
                "excerpt": excerpt,
                "ocrStatus": "raw_excerpt_needs_review",
            })
    OUT_JSON.write_text(json.dumps(excerpts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# 专业目录 OCR 定位结果摘要",
        "",
        "日期：2026-04-28",
        "",
        "本文件只记录 OCR 定位结果摘要。原始 OCR 文本位于 `data/staging/major_catalog_ocr/text/`，属于过程文件，不提交 Git。",
        "",
        "| 页码 | 院校代码 | 院校名称 | 目标专业组 | 状态 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for item in excerpts:
        group_codes = "、".join(sorted({g.get("groupCode", "") + "组" for g in item.get("targetGroups", []) if g.get("groupCode")}))
        lines.append(f"| {item['page']} | {item['collegeCode']} | {item['collegeName']} | {group_codes} | 待人工校验 |")
    lines += [
        "",
        "## 质量判断",
        "",
        "Tesseract 已能识别中文院校和专业文本，但扫描 PDF 是多栏排版，自动按块抽取专业明细时会串列，存在明显误配风险。",
        "",
        "因此本轮结果只用于定位院校所在页和辅助人工校验，暂不直接写入正式推荐数据。",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"excerpts={len(excerpts)}")
    print(f"json={OUT_JSON}")
    print(f"md={OUT_MD}")


if __name__ == "__main__":
    main()
