from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"

FIRST_BATCH = REF_DIR / "beijing_public_high_schools.first_batch.draft.json"
SECOND_BATCH = REF_DIR / "beijing_public_high_schools.second_batch_2025.draft.json"

MERGED_OUT = REF_DIR / "beijing_public_high_schools.candidate_pool.pre_dedup.json"
SUSPECT_OUT = REF_DIR / "beijing_public_high_schools.suspected_duplicates.json"
RULES_DOC_OUT = ROOT / "docs" / "beijing_public_high_schools_dedup_rules.md"


DERIVED_MARKERS = [
    "分校",
    "校区",
    "东校区",
    "西校区",
    "北校区",
    "南校区",
    "本校",
]


def read_rows(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", "", name).strip()


def strip_parenthetical(name: str) -> str:
    return re.sub(r"[（(].*?[）)]", "", name).strip()


def remove_derived_markers(name: str) -> str:
    result = name
    for marker in DERIVED_MARKERS:
        result = result.replace(marker, "")
    return result.strip()


def base_key(name: str) -> str:
    value = normalize_name(name)
    value = strip_parenthetical(value)
    value = remove_derived_markers(value)
    return value


def classify_relation(name: str, other: str) -> str:
    if base_key(name) == base_key(other) and normalize_name(name) != normalize_name(other):
        return "same_base_with_campus_or_branch_suffix"
    if base_key(name) in normalize_name(other) or base_key(other) in normalize_name(name):
        return "name_contains_same_base"
    return "manual_review"


def build_candidate_pool() -> list[dict]:
    rows = []
    for source_name, path in [
        ("first_batch", FIRST_BATCH),
        ("second_batch_2025", SECOND_BATCH),
    ]:
        for idx, row in enumerate(read_rows(path), start=1):
            item = dict(row)
            item["source_batch_file"] = path.name
            item["source_batch_name"] = source_name
            item["source_row_no"] = idx
            rows.append(item)
    return rows


def find_suspects(rows: list[dict]) -> list[dict]:
    by_district: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_district[row["district"]].append(row)

    suspects: list[dict] = []
    seen_pairs: set[tuple[str, str, str]] = set()

    for district, items in by_district.items():
        for i, left in enumerate(items):
            left_name = left["official_name"]
            left_norm = normalize_name(left_name)
            left_base = base_key(left_name)
            for right in items[i + 1 :]:
                right_name = right["official_name"]
                right_norm = normalize_name(right_name)
                right_base = base_key(right_name)

                is_suspect = False
                if left_base == right_base and left_norm != right_norm:
                    is_suspect = True
                elif left_base and right_base and (left_base in right_norm or right_base in left_norm):
                    is_suspect = True

                if not is_suspect:
                    continue

                pair_key = (district, left_name, right_name)
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                suspects.append(
                    {
                        "district": district,
                        "left_name": left_name,
                        "right_name": right_name,
                        "left_base_key": left_base,
                        "right_base_key": right_base,
                        "relation_type": classify_relation(left_name, right_name),
                        "left_source_batch": left["source_batch_name"],
                        "right_source_batch": right["source_batch_name"],
                    }
                )

    suspects.sort(key=lambda x: (x["district"], x["left_base_key"], x["left_name"], x["right_name"]))
    return suspects


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_rules_doc() -> None:
    content = """# 北京公办高中候选池去重规则

## 1. 当前目标

当前阶段不直接删除记录，而是先完成：

- 合并首批与第二批学校池
- 输出去重前总池
- 标记疑似重复、分校、校区和派生实体

## 2. 当前处理原则

### 保留原则

- 现阶段保留所有原始候选学校
- 不在没有复核前直接合并或删除
- 所有去重动作先基于规则标记，再进入人工确认

### 疑似重复识别规则

当前主要识别以下情况：

1. 同区内学校名称去掉括号说明、分校/校区等后缀后，基础名一致
2. 同区内一个学校名明显包含另一个学校基础名
3. 含“分校”“校区”“东校区”“西校区”“北校区”“南校区”“本校”等派生标记

## 3. 当前输出文件

- `beijing_public_high_schools.candidate_pool.pre_dedup.json`
  说明：合并后的去重前总池

- `beijing_public_high_schools.suspected_duplicates.json`
  说明：疑似重复/分校/校区清单

## 4. 下一步建议

1. 人工确认疑似重复清单
2. 决定哪些作为独立学校保留
3. 决定哪些降级为 aliases、校区说明或附属字段
4. 再生成正式标准库 seed
"""
    RULES_DOC_OUT.write_text(content, encoding="utf-8")


def main() -> None:
    rows = build_candidate_pool()
    suspects = find_suspects(rows)
    write_json(MERGED_OUT, rows)
    write_json(SUSPECT_OUT, suspects)
    write_rules_doc()
    print(f"merged={len(rows)}")
    print(f"suspects={len(suspects)}")


if __name__ == "__main__":
    main()
