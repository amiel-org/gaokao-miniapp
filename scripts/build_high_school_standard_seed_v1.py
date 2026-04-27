from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
DOCS_DIR = ROOT / "docs"

SOURCE_POOL = REF_DIR / "beijing_public_high_schools.candidate_pool.with_relations.json"
OUT_JSON = REF_DIR / "beijing_public_high_schools.standard_seed.v1.json"
OUT_DOC = DOCS_DIR / "beijing_public_high_schools_standard_seed_v1.md"


DISTRICT_CODES = {
    "东城区": "DC",
    "西城区": "XC",
    "朝阳区": "CY",
    "海淀区": "HD",
    "丰台区": "FT",
    "石景山区": "SJS",
    "通州区": "TZ",
    "大兴区": "DX",
}

DISTRICT_SHORT_NAMES = {
    "东城区": "东城",
    "西城区": "西城",
    "朝阳区": "朝阳",
    "海淀区": "海淀",
    "丰台区": "丰台",
    "石景山区": "石景山",
    "通州区": "通州",
    "大兴区": "大兴",
}

# Keep the full "北京..." prefix for true brand names where stripping would
# collapse the school into an over-generic short name.
KEEP_BEIJING_PREFIX = {
    "北京中学",
    "北京学校",
}

SHORT_NAME_RULES = [
    ("中国人民大学附属中学", "人大附中"),
    ("北京大学附属中学", "北大附中"),
    ("清华大学附属中学", "清华附中"),
    ("北京师范大学第二附属中学", "北师大二附中"),
    ("北京师范大学附属实验中学", "北师大实验"),
    ("北京师范大学附属中学", "北师大附中"),
    ("师范大学第二附属中学", "北师大二附中"),
    ("师范大学附属实验中学", "北师大实验"),
    ("师范大学附属中学", "北师大附中"),
    ("首都师范大学第二附属中学", "首师大二附中"),
    ("首都师范大学附属中学", "首师大附中"),
    ("北京交通大学附属中学", "北交附中"),
    ("交通大学附属中学", "北交附中"),
    ("北京理工大学附属中学", "北理工附中"),
    ("理工大学附属中学", "北理工附中"),
    ("北京工业大学附属中学", "北工大附中"),
    ("工业大学附属中学", "北工大附中"),
    ("北京外国语大学附属中学", "北外附中"),
    ("外国语大学附属中学", "北外附中"),
    ("北京建筑大学附属中学", "北建大附中"),
    ("建筑大学附属中学", "北建大附中"),
    ("北京化工大学附属中学", "北化附中"),
    ("化工大学附属中学", "北化附中"),
    ("北京第二外国语学院附属中学", "北二外附中"),
    ("第二外国语学院附属中学", "北二外附中"),
    ("中国传媒大学附属中学", "中传附中"),
    ("传媒大学附属中学", "中传附中"),
    ("中国农业大学附属中学", "农大附中"),
    ("农业大学附属中学", "农大附中"),
    ("中央民族大学附属中学", "民大附中"),
    ("民族大学附属中学", "民大附中"),
    ("中央工艺美术学院附属中学", "工美附中"),
    ("工艺美术学院附属中学", "工美附中"),
    ("中央美术学院附属实验学校", "央美附校"),
    ("美术学院附属实验学校", "央美附校"),
    ("中国科学院附属实验学校", "中科院附校"),
    ("科学院附属实验学校", "中科院附校"),
]

NUM_CHAR_MAP = {
    "零": "0",
    "〇": "0",
    "一": "1",
    "二": "2",
    "三": "3",
    "四": "4",
    "五": "5",
    "六": "6",
    "七": "7",
    "八": "8",
    "九": "9",
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", "", text).strip()


def strip_parenthetical(text: str) -> str:
    return re.sub(r"[（(].*?[）)]", "", text).strip()


def extract_parenthetical_parts(text: str) -> list[str]:
    return [normalize(part) for part in re.findall(r"[（(](.*?)[）)]", text) if normalize(part)]


def strip_beijing_prefix(text: str) -> str:
    value = normalize(text)
    if value in KEEP_BEIJING_PREFIX:
        return value
    for prefix in ("北京市", "北京"):
        if value.startswith(prefix):
            stripped = value[len(prefix) :]
            # Avoid reducing to overly generic labels such as "中学" / "学校".
            if stripped not in {"中学", "学校", "实验中学", "附属中学"}:
                return stripped
    return value


def school_number_alias(text: str) -> str | None:
    value = normalize(text)
    match = re.search(r"第([零〇一二三四五六七八九]+)中学", value)
    if not match:
        return None
    digits = "".join(NUM_CHAR_MAP.get(ch, "") for ch in match.group(1))
    if not digits:
        return None
    return value.replace(match.group(0), f"{digits}中")


def base_short_name(official_name: str) -> str:
    value = strip_beijing_prefix(strip_parenthetical(official_name))
    for full, alias in SHORT_NAME_RULES:
        if value.startswith(full):
            suffix = value[len(full) :].strip()
            return alias + suffix
    return value


def disambiguate_short_names(rows: list[dict]) -> None:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["short_name"]].append(row)

    for short_name, items in grouped.items():
        if len(items) <= 1:
            continue
        for item in items:
            district_short = DISTRICT_SHORT_NAMES.get(item["district"], item["district"])
            if item["entity_type"] == "campus":
                item["short_name"] = f"{short_name}{district_short}校区"
            elif item["entity_type"] == "branch_school":
                item["short_name"] = f"{short_name}{district_short}分校"
            elif item["entity_type"] == "co_branded_school":
                item["short_name"] = f"{short_name}{district_short}合作校"
            else:
                item["short_name"] = f"{short_name}{district_short}"


def generate_aliases(row: dict) -> list[str]:
    official = normalize(row["official_name"])
    short_name = normalize(row["short_name"])
    base_name = normalize(row["base_short_name"])
    canonical = normalize(row["canonical_school_name"])

    aliases = {
        official,
        short_name,
        base_name,
        canonical,
        strip_beijing_prefix(official),
        strip_beijing_prefix(canonical),
        strip_parenthetical(official),
    }

    for part in extract_parenthetical_parts(official):
        aliases.add(part)
        aliases.add(strip_beijing_prefix(part))

    numeric_official = school_number_alias(official)
    if numeric_official:
        aliases.add(numeric_official)
    numeric_base = school_number_alias(base_name)
    if numeric_base:
        aliases.add(numeric_base)

    if short_name.endswith("中学"):
        aliases.add(short_name[:-2] + "中")
    if base_name.endswith("中学"):
        aliases.add(base_name[:-2] + "中")
    if short_name.endswith("学校"):
        aliases.add(short_name[:-2])
    if base_name.endswith("学校"):
        aliases.add(base_name[:-2])

    for full, alias in SHORT_NAME_RULES:
        base_official = strip_parenthetical(official)
        if base_official.startswith(full):
            suffix = base_official[len(full) :].strip()
            aliases.add(alias + suffix)

    if row["entity_type"] == "branch_school":
        aliases.add(short_name.replace("分校", ""))
    if row["entity_type"] == "campus":
        aliases.add(short_name.replace("校区", ""))

    return sorted({item for item in aliases if item})


def build_search_tokens(row: dict) -> list[str]:
    tokens = set(row["aliases"])
    tokens.add(row["district"])
    tokens.add(row["official_name"])
    tokens.add(row["canonical_school_name"])
    if row["parent_school_name"]:
        tokens.add(row["parent_school_name"])
    return sorted(tokens)


def build_school_ids(rows: list[dict]) -> dict[tuple[str, str], str]:
    counters: dict[str, int] = defaultdict(int)
    mapping: dict[tuple[str, str], str] = {}
    for row in sorted(rows, key=lambda x: (x["district"], x["official_name"])):
        district = row["district"]
        counters[district] += 1
        mapping[(district, row["official_name"])] = f"BJ_HS_{DISTRICT_CODES.get(district, 'UNK')}_{counters[district]:04d}"
    return mapping


def build_rows() -> list[dict]:
    rows = json.loads(SOURCE_POOL.read_text(encoding="utf-8"))
    school_ids = build_school_ids(rows)

    out = []
    for row in rows:
        item = dict(row)
        item["school_id"] = school_ids[(row["district"], row["official_name"])]
        item["base_short_name"] = base_short_name(row["official_name"])
        item["short_name"] = item["base_short_name"]
        item["aliases"] = []
        item["search_tokens"] = []
        out.append(item)

    disambiguate_short_names(out)

    for item in out:
        item["aliases"] = generate_aliases(item)
        item["search_tokens"] = build_search_tokens(item)

    return out


def write_json(rows: list[dict]) -> None:
    OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def write_doc(rows: list[dict]) -> None:
    duplicate_count = sum(1 for _, count in Counter(row["short_name"] for row in rows).items() if count > 1)
    lines = [
        "# 北京公办高中标准库 Seed V1",
        "",
        "## 1. 说明",
        "",
        "这是基于候选总池和关系回填结果生成的第一版标准库 seed。",
        "",
        "当前已生成：",
        "",
        "- `school_id`",
        "- `short_name`",
        "- `aliases`",
        "- `search_tokens`",
        "",
        "## 2. 当前规模",
        "",
        f"- 记录数：`{len(rows)}`",
        f"- `short_name` 重名数：`{duplicate_count}`",
        "",
        "## 3. 样例",
        "",
        "| school_id | 区 | official_name | short_name | entity_type | canonical_school_name | aliases_count |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]

    for row in rows[:30]:
        lines.append(
            f"| {row['school_id']} | {row['district']} | {row['official_name']} | {row['short_name']} | "
            f"{row['entity_type']} | {row['canonical_school_name']} | {len(row['aliases'])} |"
        )

    OUT_DOC.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows = build_rows()
    write_json(rows)
    write_doc(rows)
    print(f"rows={len(rows)}")


if __name__ == "__main__":
    main()
