"""Build Beijing non-private undergraduate school coverage data.

The recommendation seed has score/rank/program data for schools that appear in
ordinary-batch sources. This coverage file tracks the broader Beijing
non-private undergraduate universe so missing/special-admission schools are
explicit instead of silently absent.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_JS = ROOT / "miniprogram" / "data" / "beijing-undergraduate-school-coverage.js"
OUT_REPORT = ROOT / "docs" / "beijing_undergraduate_school_coverage_report.md"
PROGRAMS_JS = ROOT / "miniprogram" / "data" / "beijing-local-college-programs.js"
OFFICIAL_GROUPS_JS = ROOT / "miniprogram" / "data" / "college-admission-groups.js"

SOURCE = {
    "publisher": "教育部",
    "title": "全国高等学校名单",
    "url": "https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A03/202506/t20250627_1195683.html",
    "checkedAt": "2026-05-18",
}

# 北京本科院校中排除民办本科和专科后，用于 V1 院校覆盖核对。
# admissionCategory 仅用于解释推荐可用性，不替代官方招生章程。
SCHOOLS = [
    ("北京大学", "教育部", "985/211/双一流", "ordinary_batch"),
    ("中国人民大学", "教育部", "985/211/双一流", "ordinary_batch"),
    ("清华大学", "教育部", "985/211/双一流", "ordinary_batch"),
    ("北京交通大学", "教育部", "211/双一流", "ordinary_batch"),
    ("北京工业大学", "北京市", "双一流/普通一本", "ordinary_batch"),
    ("北京航空航天大学", "工业和信息化部", "985/211/双一流", "ordinary_batch"),
    ("北京理工大学", "工业和信息化部", "985/211/双一流", "ordinary_batch"),
    ("北京科技大学", "教育部", "211/双一流", "ordinary_batch"),
    ("北方工业大学", "北京市", "普通一本", "ordinary_batch"),
    ("北京化工大学", "教育部", "211/双一流", "ordinary_batch"),
    ("北京工商大学", "北京市", "普通一本", "ordinary_batch"),
    ("北京服装学院", "北京市", "普通二本", "ordinary_batch"),
    ("北京邮电大学", "教育部", "211/双一流", "ordinary_batch"),
    ("北京印刷学院", "北京市", "普通一本", "ordinary_batch"),
    ("北京建筑大学", "北京市", "普通一本", "ordinary_batch"),
    ("北京石油化工学院", "北京市", "普通一本", "ordinary_batch"),
    ("北京电子科技学院", "中央办公厅", "特殊类型/提前批", "special_or_no_ordinary_batch"),
    ("中国农业大学", "教育部", "985/211/双一流", "ordinary_batch"),
    ("北京农学院", "北京市", "普通一本", "ordinary_batch"),
    ("北京林业大学", "教育部", "211/双一流", "ordinary_batch"),
    ("北京协和医学院", "国家卫生健康委员会", "双一流/普通一本", "ordinary_batch"),
    ("首都医科大学", "北京市", "双一流/普通一本", "ordinary_batch"),
    ("北京中医药大学", "教育部", "211/双一流", "ordinary_batch"),
    ("北京师范大学", "教育部", "985/211/双一流", "ordinary_batch"),
    ("首都师范大学", "北京市", "双一流/普通一本", "ordinary_batch"),
    ("首都体育学院", "北京市", "普通一本", "ordinary_batch"),
    ("北京外国语大学", "教育部", "211/双一流", "ordinary_batch"),
    ("北京第二外国语学院", "北京市", "普通一本", "ordinary_batch"),
    ("北京语言大学", "教育部", "普通一本", "ordinary_batch"),
    ("中国传媒大学", "教育部", "211/双一流", "ordinary_batch"),
    ("中央财经大学", "教育部", "211/双一流", "ordinary_batch"),
    ("对外经济贸易大学", "教育部", "211/双一流", "ordinary_batch"),
    ("北京物资学院", "北京市", "普通一本", "ordinary_batch"),
    ("首都经济贸易大学", "北京市", "普通一本", "ordinary_batch"),
    ("中国消防救援学院", "应急管理部", "特殊类型/提前批", "special_or_no_ordinary_batch"),
    ("外交学院", "外交部", "特殊类型/提前批", "special_or_no_ordinary_batch"),
    ("中国人民公安大学", "公安部", "特殊类型/提前批", "special_or_no_ordinary_batch"),
    ("国际关系学院", "教育部", "特殊类型/提前批", "special_or_no_ordinary_batch"),
    ("北京体育大学", "国家体育总局", "双一流/普通一本", "ordinary_batch"),
    ("中央音乐学院", "教育部", "双一流/艺术类", "special_or_no_ordinary_batch"),
    ("中国音乐学院", "北京市", "双一流/艺术类", "ordinary_batch"),
    ("中央美术学院", "教育部", "双一流/艺术类", "ordinary_batch"),
    ("中央戏剧学院", "教育部", "双一流/艺术类", "ordinary_batch"),
    ("中国戏曲学院", "北京市", "艺术类", "ordinary_batch"),
    ("北京电影学院", "北京市", "艺术类", "ordinary_batch"),
    ("北京舞蹈学院", "北京市", "艺术类", "ordinary_batch"),
    ("中央民族大学", "国家民族事务委员会", "985/211/双一流", "ordinary_batch"),
    ("中国政法大学", "教育部", "211/双一流", "ordinary_batch"),
    ("华北电力大学(北京)", "教育部", "211/双一流", "ordinary_batch"),
    ("中华女子学院", "中华全国妇女联合会", "普通一本", "ordinary_batch"),
    ("北京信息科技大学", "北京市", "普通一本", "ordinary_batch"),
    ("中国矿业大学(北京)", "教育部", "211/双一流", "ordinary_batch"),
    ("中国石油大学(北京)", "教育部", "211/双一流", "ordinary_batch"),
    ("中国地质大学(北京)", "教育部", "211/双一流", "ordinary_batch"),
    ("北京联合大学", "北京市", "普通二本", "ordinary_batch"),
    ("中国青年政治学院", "共青团中央", "特殊类型/不稳定普通批", "special_or_no_ordinary_batch"),
    ("首钢工学院", "北京市", "普通本科", "special_or_no_ordinary_batch"),
    ("中国劳动关系学院", "中华全国总工会", "普通一本", "ordinary_batch"),
    ("北京警察学院", "北京市", "特殊类型/提前批", "special_or_no_ordinary_batch"),
    ("中国科学院大学", "中国科学院", "双一流/普通一本", "ordinary_batch"),
    ("中国社会科学院大学", "中国社会科学院", "普通一本", "ordinary_batch"),
    ("民政职业大学", "民政部", "职业本科", "special_or_no_ordinary_batch"),
    ("北京科技职业大学", "北京市", "职业本科", "special_or_no_ordinary_batch"),
]


def extract_college_names(js_path: Path) -> set[str]:
    text = js_path.read_text(encoding="utf-8")
    return set(re.findall(r'"collegeName":\s*"([^"]+)"', text))


def main() -> None:
    program_schools = extract_college_names(PROGRAMS_JS)
    official_group_schools = extract_college_names(OFFICIAL_GROUPS_JS)
    records = []
    for index, (name, supervisor, level, admission_category) in enumerate(SCHOOLS, start=1):
        has_program_seed = name in program_schools
        has_official_group_seed = name in official_group_schools
        # The planning workbook uses Beijing大学医学部 as the ordinary-batch
        # proxy for Beijing协和医学院 medical enrollment references.
        if name == "北京协和医学院" and "北京协和医学院" not in program_schools:
            has_program_seed = True
        if has_program_seed:
            data_status = "program_seed_available"
        elif has_official_group_seed:
            data_status = "official_group_seed_available"
        else:
            data_status = "coverage_only_pending_2026_catalog"
        records.append({
            "id": f"bj_undergrad_{index:03d}",
            "name": name,
            "province": "北京",
            "educationLevel": "本科",
            "ownership": "非民办",
            "supervisor": supervisor,
            "collegeLevel": level,
            "admissionCategory": admission_category,
            "hasProgramSeed": has_program_seed,
            "hasOfficialGroupSeed": has_official_group_seed,
            "dataStatus": data_status,
            "source": SOURCE,
            "notes": "普通批分数推荐优先使用已有投档线/专业方向数据；特殊类型或暂无普通批数据院校先进入覆盖库，等待2026官方招生专业目录发布后补齐。",
        })
    OUT_JS.write_text("module.exports = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")

    missing = [r for r in records if not r["hasProgramSeed"]]
    special_missing = [r for r in missing if r["admissionCategory"] == "special_or_no_ordinary_batch"]
    lines = [
        "# 北京非民办本科院校覆盖报告",
        "",
        "日期：2026-05-18",
        "",
        f"- 覆盖北京非民办本科院校数：{len(records)}",
        f"- 已有专业方向 seed 院校数：{sum(1 for r in records if r['hasProgramSeed'])}",
        f"- 仅覆盖、待 2026 专业目录补齐院校数：{len(missing)}",
        f"- 其中多为提前批/特殊类型/职业本科或暂无普通批专业方向数据：{len(special_missing)}",
        "",
        "## 仅覆盖待补齐院校",
        "",
    ]
    for r in missing:
        lines.append(f"- {r['name']}：{r['collegeLevel']}，{r['admissionCategory']}，状态 `{r['dataStatus']}`")
    lines.extend([
        "",
        "## 2026 专业目录状态",
        "",
        "截至 2026-05-18，已核查北京教育考试院官网，未确认发布可下载的《2026 普通高等学校招生专业目录》普通批 PDF。当前不能伪造 2026 专业计划数据；待官方目录发布后，用本覆盖库作为 checklist 逐校补齐。",
    ])
    OUT_REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"coverage_schools={len(records)}")
    print(f"program_seed_schools={sum(1 for r in records if r['hasProgramSeed'])}")
    print(f"coverage_only={len(missing)}")
    print(f"out={OUT_JS}")
    print(f"report={OUT_REPORT}")


if __name__ == "__main__":
    main()
