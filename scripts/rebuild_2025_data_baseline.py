from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"
DOCS_DIR = ROOT / "docs"

STD_FILE = REF_DIR / "beijing_public_high_schools.standard_seed.v1.json"
PARAM_FILE = REF_DIR / "school_rank_estimation_parameter_backlog.v1.json"
REPORT_FILE = DOCS_DIR / "rebuild_2025_data_baseline_report.md"


def run_script(path: Path) -> None:
    subprocess.run(["python", str(path)], check=True, cwd=str(ROOT))


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def summarize_standard_seed(rows: list[dict]) -> dict:
    summary = {
        "total": len(rows),
        "missing_school_id": 0,
        "missing_short_name": 0,
        "missing_aliases": 0,
        "missing_search_tokens": 0,
        "duplicate_short_names": 0,
    }

    short_name_counts: dict[str, int] = {}
    for row in rows:
        if not row.get("school_id"):
            summary["missing_school_id"] += 1
        if not row.get("short_name"):
            summary["missing_short_name"] += 1
        if not row.get("aliases"):
            summary["missing_aliases"] += 1
        if not row.get("search_tokens"):
            summary["missing_search_tokens"] += 1
        short_name = row.get("short_name", "")
        short_name_counts[short_name] = short_name_counts.get(short_name, 0) + 1

    summary["duplicate_short_names"] = sum(1 for count in short_name_counts.values() if count > 1)
    return summary


def summarize_parameter_rows(rows: list[dict]) -> dict:
    summary = {
        "total": len(rows),
        "missing_tier": 0,
        "missing_range": 0,
        "missing_weights": 0,
    }
    for row in rows:
        if not row.get("tier_code"):
            summary["missing_tier"] += 1
        if row.get("range_factor_min") is None or row.get("range_factor_max") is None:
            summary["missing_range"] += 1
        if not row.get("ranking_basis_weight"):
            summary["missing_weights"] += 1
    return summary


def build_report(std_summary: dict, param_summary: dict) -> str:
    return f"""# 2025 数据基线重建报告

## 1. 说明

本次操作的目标是：

- 对 2025 标准学校库做一次流程级重建
- 联动重跑全量参数表
- 输出可验证的校验结果

## 2. 重建动作

本次已执行：

1. 重跑学校标准库生成脚本
2. 重跑全量参数表生成脚本
3. 对两份输出做程序级校验

## 3. 标准学校库校验

- 总记录数：`{std_summary['total']}`
- 缺失 `school_id`：`{std_summary['missing_school_id']}`
- 缺失 `short_name`：`{std_summary['missing_short_name']}`
- 缺失 `aliases`：`{std_summary['missing_aliases']}`
- 缺失 `search_tokens`：`{std_summary['missing_search_tokens']}`
- `short_name` 重名数：`{std_summary['duplicate_short_names']}`

## 4. 全量参数表校验

- 总记录数：`{param_summary['total']}`
- 缺失 `tier_code`：`{param_summary['missing_tier']}`
- 缺失 `range_factor`：`{param_summary['missing_range']}`
- 缺失 `ranking_basis_weight`：`{param_summary['missing_weights']}`

## 5. 当前结论

如果以上关键字段都为 0，则说明：

- 2025 标准学校库已经可作为唯一上游
- 全量参数表已经可作为估算参数层

## 6. 下一步建议

在确认本次重建通过后，下一步应继续做：

- 参数驱动的校排估算回测
- T1 / T2 学校更细校准
- 再接前端页面原型
"""


def main() -> None:
    run_script(ROOT / "scripts" / "build_high_school_standard_seed_v1.py")
    run_script(ROOT / "scripts" / "build_estimation_parameter_backlog.py")

    std_rows = load_json(STD_FILE)
    param_rows = load_json(PARAM_FILE)

    std_summary = summarize_standard_seed(std_rows)
    param_summary = summarize_parameter_rows(param_rows)

    REPORT_FILE.write_text(build_report(std_summary, param_summary), encoding="utf-8")

    print(json.dumps({"standard_seed": std_summary, "parameter_table": param_summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
