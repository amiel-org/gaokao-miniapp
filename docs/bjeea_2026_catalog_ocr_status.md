# 北京 2026 招生专业目录接入与小程序可用性报告

生成时间：2026-06-22

## 结论

官方目录已经发布并下载到本地；第一批 10 个目标专业组已经按官方 PDF 高清页人工核验完成，并导出到小程序正式专业明细出口。当前可用范围是“已核验专业方向/专业组明细”，不是全量 `/plan/115` 结构化招生计划。

## 官方源与本地文件

- 官方标题：北京市2026年普通高等学校招生专业目录
- 官方页面：https://www.bjeea.cn/html/gkgz/tzgg/2026/0621/88227.html
- 官方 PDF：https://www.bjeea.cn/uploads/soft/260621/北京市2026年普通高等学校招生专业目录.pdf
- 本地路径：`data/raw/admissions/2026/bjeea_2026_北京市2026年普通高等学校招生专业目录.pdf`
- 文件大小：220,335,461 字节
- PDF 页数：121
- SHA256：`fb62c16c9341298d275eae4071d1e4695cbaa1857620eeac950b2673e5169a42`

## 小程序当前数据层可用性

| 数据层 | 当前状态 | 是否可直接用于小程序 | 说明 |
| --- | --- | --- | --- |
| `college-major-details.js` | 10 组 / 38 条专业，`official_catalog_manual_verified` | 是 | 第一批人工核验完成，推荐卡片可优先展示“已核验招生专业”。 |
| `college_major_details_manual_review_queue.json` | 10 条均为 `verified` | 是 | 保留审核人、日期、来源页、限制标签和审核备注。 |
| 官方 PDF 原件 | 已下载 | 是，作为核验依据 | 扫描版 PDF，不能直接全自动入库。 |
| OCR 草稿 | 已生成 | 否 | 只用于定位和人工比对，不直接进入正式推荐。 |
| `beijing-2026-admission-plan-firstlook.js` | `recordCount=0` | 否 | 高招计划查询 `/plan/115` 仍未暴露 2026 结构化年度行。 |
| `major-catalog-status.js` | 已更新 | 是 | 前端可展示“官方目录已发布/结构化核验中”。 |

## 第一批已核验清单

- 1027 北京化工大学 01组：2 条，页码 32，状态 `verified`
- 1031 北京中医药大学 01组：4 条，页码 33，状态 `verified`
- 1035 北京语言大学 01组：9 条，页码 34，状态 `verified`
- 1038 对外经济贸易大学 02组：1 条，页码 35，状态 `verified`
- 1042 中国石油大学(北京) 01组：1 条，页码 35，状态 `verified`
- 1043 中国地质大学(北京) 01组：7 条，页码 35，状态 `verified`
- 1053 北京第二外国语学院 01组：6 条，页码 41，状态 `verified`
- 1055 首都经济贸易大学 02组：5 条，页码 41，状态 `verified`
- 1062 北方工业大学 02组：2 条，页码 42，状态 `verified`
- 1076 北京联合大学 01组：1 条，页码 43，状态 `verified`

## 验证结果

- `python scripts/export_verified_college_major_details.py`：`verified_records=10`
- `node --check miniprogram/data/college-major-details.js`：通过
- `npm run check:syntax`：通过
- `npm run check:data`：通过
- `npm run check:plan2026`：通过但 `readyForRelease=false`，原因是 `/plan/115` 结构化计划记录仍为 0
- `npm run check:release`：仍被 `check:plan2026:ready` 拦截；这是全量结构化计划门禁，不代表本批人工核验数据失败。

## 建议下一步

1. 继续按 `output/major-catalog-review/2026-official-pages-clean/` 的官方页扩大人工核验范围。
2. 若短期上线，前端明确展示“已核验专业明细覆盖部分专业组”，不要宣称全量 2026 结构化计划已接入。
3. 继续监测 `/plan/115` 是否开放 2026 年度；开放后再用结构化接口补齐全量计划和 release gate。