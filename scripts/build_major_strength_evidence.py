from __future__ import annotations

import json
import re
from datetime import date
from io import BytesIO
from pathlib import Path

import requests
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
TARGET_MAJOR_DATA = ROOT / "miniprogram" / "subpackages" / "volunteer" / "data" / "college-major-details.js"
OUTPUT = ROOT / "miniprogram" / "subpackages" / "volunteer" / "data" / "beijing-major-strength-evidence.js"
SOURCE_PAGE = "http://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html"
SOURCE_PDF = "http://www.moe.gov.cn/srcsite/A22/s7065/202202/W020220214318455516037.pdf"


DISCIPLINE_DIRECTIONS = {
    "哲学": ["language-humanities"],
    "理论经济学": ["economics-finance"],
    "应用经济学": ["economics-finance"],
    "法学": ["law-governance"],
    "政治学": ["law-governance"],
    "社会学": ["law-governance"],
    "马克思主义理论": ["law-governance"],
    "民族学": ["law-governance"],
    "公安学": ["law-governance"],
    "新闻传播学": ["media-art"],
    "中国史": ["language-humanities"],
    "外国语言文学": ["language-humanities"],
    "中国语言文学": ["language-humanities"],
    "统计学": ["math-physics", "economics-finance"],
    "数学": ["math-physics"],
    "物理学": ["math-physics"],
    "系统科学": ["math-physics"],
    "科学技术史": ["math-physics", "language-humanities"],
    "工商管理": ["management-accounting"],
    "农林经济管理": ["management-accounting", "agriculture-food"],
    "公共管理": ["management-accounting", "law-governance"],
    "图书情报与档案管理": ["management-accounting"],
    "管理科学与工程": ["management-accounting"],
    "教育学": ["education-psychology"],
    "心理学": ["education-psychology"],
    "体育学": ["sports"],
    "戏剧与影视学": ["media-art"],
    "音乐与舞蹈学": ["media-art"],
    "美术学": ["media-art"],
    "设计学": ["media-art"],
    "土木工程": ["architecture-transport"],
    "建筑学": ["architecture-transport"],
    "城乡规划学": ["architecture-transport"],
    "风景园林学": ["architecture-transport", "agriculture-food"],
    "交通运输工程": ["architecture-transport"],
    "测绘科学与技术": ["architecture-transport"],
    "力学": ["mechanical-aerospace"],
    "机械工程": ["mechanical-aerospace"],
    "航空宇航科学与技术": ["mechanical-aerospace"],
    "兵器科学与技术": ["mechanical-aerospace"],
    "仪器科学与技术": ["electronic-automation"],
    "控制科学与工程": ["electronic-automation"],
    "电子科学与技术": ["electronic-automation"],
    "信息与通信工程": ["electronic-automation", "computer-ai"],
    "电气工程": ["electronic-automation"],
    "计算机科学与技术": ["computer-ai"],
    "软件工程": ["computer-ai"],
    "材料科学与工程": ["materials-chemical"],
    "冶金工程": ["materials-chemical"],
    "化学工程与技术": ["materials-chemical"],
    "化学": ["chemistry-environment"],
    "地理学": ["chemistry-environment"],
    "生态学": ["chemistry-environment", "biology-life"],
    "环境科学与工程": ["chemistry-environment"],
    "地质学": ["earth-energy"],
    "地质资源与地质工程": ["earth-energy"],
    "矿业工程": ["earth-energy"],
    "安全科学与工程": ["earth-energy"],
    "石油与天然气工程": ["earth-energy"],
    "生物学": ["biology-life"],
    "生物医学工程": ["medicine-health", "biology-life"],
    "基础医学": ["medicine-health"],
    "临床医学": ["medicine-health"],
    "口腔医学": ["medicine-health"],
    "公共卫生与预防医学": ["medicine-health"],
    "护理学": ["medicine-health"],
    "药学": ["pharmacy-tcm"],
    "中医学": ["pharmacy-tcm"],
    "中西医结合": ["pharmacy-tcm"],
    "中药学": ["pharmacy-tcm"],
    "农业工程": ["agriculture-food"],
    "食品科学与工程": ["agriculture-food"],
    "作物学": ["agriculture-food"],
    "农业资源与环境": ["agriculture-food", "chemistry-environment"],
    "植物保护": ["agriculture-food"],
    "畜牧学": ["agriculture-food"],
    "兽医学": ["agriculture-food"],
    "草学": ["agriculture-food"],
    "林学": ["agriculture-food"],
}


COLLEGE_ALIASES = {
    "华北电力大学(北京)": "华北电力大学",
    "中国矿业大学(北京)": "中国矿业大学（北京）",
    "中国石油大学(北京)": "中国石油大学（北京）",
    "中国地质大学(北京)": "中国地质大学（北京）",
}


def target_colleges() -> list[str]:
    source = TARGET_MAJOR_DATA.read_text(encoding="utf-8")
    names = re.findall(r'"collegeName":"([^"]+)"', source)
    return list(dict.fromkeys(names))


def extract_pdf_text() -> str:
    response = requests.get(SOURCE_PDF, timeout=30)
    response.raise_for_status()
    reader = PdfReader(BytesIO(response.content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def parse_entries(text: str) -> dict[str, str]:
    entries: dict[str, str] = {}
    current_name: str | None = None
    parts: list[str] = []
    for raw_line in text.splitlines():
        line = re.sub(r"\s+", "", raw_line)
        if not line or line.startswith("附件") or line.startswith("第二轮") or line.startswith("（按学校代码"):
            continue
        if "：" in line:
            name, content = line.split("：", 1)
            if 2 <= len(name) <= 30:
                if current_name:
                    entries[current_name] = "".join(parts)
                current_name = name
                parts = [content]
                continue
        if current_name:
            parts.append(line)
    if current_name:
        entries[current_name] = "".join(parts)
    return entries


def discipline_list(value: str) -> list[str]:
    if "自主确定建设学科" in value:
        return []
    cleaned = value.strip("。；; ")
    return [item.strip("。；; ") for item in cleaned.split("、") if item.strip("。；; ")]


def build_records(entries: dict[str, str]) -> list[dict]:
    records = []
    for college in target_colleges():
        source_name = COLLEGE_ALIASES.get(college, college)
        value = entries.get(source_name)
        if not value:
            continue
        disciplines = discipline_list(value)
        evidence = []
        for discipline in disciplines:
            evidence.append({
                "discipline": discipline,
                "directionIds": DISCIPLINE_DIRECTIONS.get(discipline, []),
            })
        records.append({
            "collegeName": college,
            "sourceCollegeName": source_name,
            "selfPublished": "自主确定建设学科" in value,
            "disciplineEvidence": evidence,
        })
    return records


def write_js(records: list[dict]) -> None:
    payload = {
        "source": {
            "id": "moe-double-first-class-round2-2022",
            "publisher": "教育部、财政部、国家发展改革委",
            "title": "第二轮“双一流”建设高校及建设学科名单",
            "shortTitle": "教育部第二轮“双一流”建设学科名单",
            "publishedAt": "2022-02-11",
            "url": SOURCE_PAGE,
            "pdfUrl": SOURCE_PDF,
            "retrievedAt": date.today().isoformat(),
            "scopeNote": "用于国家级优势学科证据，不等同于本科专业精确全国名次。",
        },
        "targetCollegeCount": len(target_colleges()),
        "evidenceCollegeCount": len(records),
        "records": records,
    }
    body = "module.exports = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    OUTPUT.write_text(body, encoding="utf-8")


def main() -> None:
    entries = parse_entries(extract_pdf_text())
    records = build_records(entries)
    if len(records) < 25:
        raise RuntimeError(f"parsed evidence colleges too few: {len(records)}")
    write_js(records)
    mapped = sum(1 for record in records for item in record["disciplineEvidence"] if item["directionIds"])
    print(json.dumps({
        "output": str(OUTPUT),
        "targetCollegeCount": len(target_colleges()),
        "evidenceCollegeCount": len(records),
        "mappedDisciplineCount": mapped,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
