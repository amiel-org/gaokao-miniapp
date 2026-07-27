"""Check local college coverage against BJEEA 2024 subject requirements.

This is a staging-quality cross-check. It does not prove 2026 admission-plan
coverage, but it does verify that most Beijing local colleges have public
subject-requirement rows that can be used to validate major-direction wording
and selection-subject compatibility.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SUBJECT_REQUIREMENT_PATH = ROOT / "data" / "staging" / "bjeea_subject_requirements" / "bjeea_2024_subject_requirements.sample.json"
REPORT_PATH = ROOT / "docs" / "bjeea_subject_requirement_coverage_2024.md"


def load_coverage_names() -> list[str]:
    script = "const cov=require('./miniprogram/data/beijing-undergraduate-school-coverage.js'); console.log(JSON.stringify(cov.map(x=>x.name)));"
    output = subprocess.check_output(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8")
    return json.loads(output)


def main() -> None:
    if not SUBJECT_REQUIREMENT_PATH.exists():
        raise SystemExit(f"missing {SUBJECT_REQUIREMENT_PATH}; run fetch_bjeea_subject_requirement_2024.py first")

    payload = json.loads(SUBJECT_REQUIREMENT_PATH.read_text(encoding="utf-8"))
    requirements = payload.get("requirements", [])
    requirement_names = sorted({item["collegeName"] for item in requirements if item.get("collegeName")})
    coverage_names = sorted(set(load_coverage_names()))
    matched = sorted(set(coverage_names) & set(requirement_names))
    missing = sorted(set(coverage_names) - set(requirement_names))
    extras = sorted(set(requirement_names) - set(coverage_names))

    by_college = {}
    for item in requirements:
        by_college.setdefault(item["collegeName"], 0)
        by_college[item["collegeName"]] += 1

    lines = [
        "# 北京教育考试院 2024 选考要求覆盖核验",
        "",
        "日期：2026-05-19",
        "",
        "## 数据来源",
        "",
        "- 来源页面：`https://query.bjeea.cn/queryService/rest/plan/134`",
        "- 页面标题：2024 年普通高校在京招生专业选考查询",
        "- 本文件只作为专业方向和选科要求交叉核验，不等同于 2026 招生专业目录或招生计划。",
        "",
        "## 覆盖结果",
        "",
        f"- 北京非民办本科覆盖库院校数：{len(coverage_names)}",
        f"- 2024 选考要求抓取北京院校数：{len(requirement_names)}",
        f"- 与覆盖库命中院校数：{len(matched)}",
        f"- 未命中覆盖库院校数：{len(missing)}",
        f"- 抓取专业/专业类选考要求行数：{len(requirements)}",
        "",
        "## 覆盖库中未命中 2024 选考要求的院校",
        "",
    ]
    if missing:
        lines.extend(f"- {name}" for name in missing)
    else:
        lines.append("- 无")

    lines.extend([
        "",
        "## 命中院校样例统计",
        "",
        "| 院校 | 选考要求行数 |",
        "| --- | ---: |",
    ])
    for name in matched[:30]:
        lines.append(f"| {name} | {by_college.get(name, 0)} |")

    lines.extend([
        "",
        "## 结论",
        "",
        "这次新增的是可复用的数据核验管道：可从北京教育考试院公开查询页抓取 2024 专业/专业类选考要求，用于校验小程序推荐卡片里的“专业方向”和“选科要求”是否合理。",
        "",
        "但它仍不是 2026 普通批招生专业目录：不能直接替代当年专业计划、招生人数、学制、收费、外语语种等正式字段。正式上线如需承诺专业明细全量准确，仍需继续抓取或人工校验 2026 官方招生计划/专业目录。",
        "",
        f"过程数据：`{SUBJECT_REQUIREMENT_PATH.relative_to(ROOT)}`",
    ])
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({
        "coverage": len(coverage_names),
        "subjectRequirementColleges": len(requirement_names),
        "matched": len(matched),
        "missing": len(missing),
        "requirements": len(requirements),
        "report": str(REPORT_PATH),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
