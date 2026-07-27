# 2026 招生专业目录接入交接记录

日期：2026-05-20

## 目标

把北京教育考试院 2026 高招招生专业目录/招生计划接入推荐页，范围限定为：北京高校、本科普通批、二本以上层次（985/211/双一流、普通一本、普通二本）。

## 当前结论

已完成接入管线、页面数据结构、覆盖检查和上线阻断；但北京教育考试院公开查询页当前没有返回可确认的 2026 本科普通批专业计划记录，因此不能宣布“已包含 2026 最新招生专业目录”。

- 官方入口：https://query.bjeea.cn/queryService/rest/plan/115
- 当前抓取状态：`official_year_option_missing`
- 目标院校数：46
- 已覆盖 2026 官方专业计划院校数：0
- 2026 官方专业计划记录数：0
- 官网文件发现状态：`official_catalog_file_not_found`
- 已巡检北京教育考试院最新通知页、招生工作规定与北京考试报高招专版共 7 个页面；深度历史页与附件猜测已改为 `discover:plan2026:download:probe` 按需执行，避免常规监控超时。
- 北京考试报高招月历页面提示《北京市2026年普通高等学校招生专业目录》在 6 月下发；该页面只能证明预计发布窗口，不能替代目录本体。
- DWR 候选 examId `5727`、`5785` 已回填公开查询验证，仍未返回北京本科普通批学校行或专业明细。

## 已新增/修改文件

### 抓取与导出

- `scripts/discover_bjeea_2026_catalog_sources.py`
  - 巡检北京教育考试院高考高招最新通知列表，寻找 2026 招生专业目录 PDF/Excel/CSV。
  - 当前已扩大巡检至北京教育考试院通知列表、招生工作规定、北京考试报高招专版与高招月历；未发现可下载的官方 2026 普通高等学校招生专业目录文件。
  - 支持 `--download`，一旦发现官方 PDF/Excel/CSV 候选，会下载到 `data/raw/admissions/2026/` 并记录 sha256、大小和来源页。
  - 支持 `--probe-probable-notices`，按 2025 官方目录页面 `/html/gkgz/tzgg/2025/0620/87155.html` 的路径规律，探测 2026 年 6 月可能尚未被搜索引擎收录的目录通知页。
  - 支持 `--probe-attachment-guesses`，按需探测 `/upload/soft/202606/` 与 `/uploads/soft/2606DD/` 下常见 PDF/Excel 文件名；该深度探测较慢，只放在 `discover:plan2026:download:probe`，不再阻塞日常 `monitor:plan2026:download`。
- `scripts/fetch_bjeea_admission_plan_2026.py`
  - 抓取北京教育考试院 `/plan/115`。
  - 只在页面暴露 2026 年度并返回本科普通批记录时才采信数据。
  - 对 DWR 候选 examId 做公开查询回填验证；隐藏候选未被公开年度标签确认前不接入为正式 2026 数据。
  - 当前输出 0 条记录，并保存页面证据。
- `data/staging/bjeea_admission_plan_2026/bjeea_2026_admission_plan.json`
  - 抓取结果与探测状态。
- `scripts/import_bjeea_2026_admission_plan_excel.py`
  - 支持用户提供北京教育考试院官方 Excel 后直接导入同一 staging 数据。
  - 支持 `--output` 先写入临时 JSON；支持 `--fail-if-empty` 防止空导入误判。
- `scripts/import_bjeea_2026_admission_plan_pdf.py`
  - 支持文本型官方 PDF 导入；扫描版 PDF 需 OCR/人工复核后再导入。
  - 支持 `--output` 先写入临时 JSON；支持 `--fail-if-empty` 防止空导入误判。
- `scripts/sync_bjeea_2026_downloaded_catalog.py`
  - 扫描 `data/raw/admissions/2026/` 与发现脚本下载记录，自动尝试导入官方 PDF/Excel。
  - 只有导入出北京高校、本科普通批、二本以上目标记录时，才会提升为主 staging；空文件/扫描件/非目标文件不会覆盖当前官方查询证据。
- `scripts/export_bjeea_2026_admission_plan_firstlook.js`
  - 将官方 2026 专业计划导出为小程序数据模块。
- `miniprogram/data/beijing-2026-admission-plan-firstlook.js`
  - 小程序侧 2026 招生计划数据模块。
- `scripts/check_bjeea_2026_admission_plan_coverage.js`
  - 检查 2026 官方计划覆盖情况。
  - `--require-ready` 会在记录为空或覆盖不足时失败，阻止上线。
- `scripts/report_bjeea_2026_plan_status.js`
  - 汇总官方查询、官网目录发现、DWR 候选验证和下一步动作，生成 `docs/bjeea_2026_release_monitor.md`。
  - `npm run status:plan2026` 可单独查看当前能否上线；`npm run monitor:plan2026` 会先刷新官方源再生成状态报告。
- `data/staging/bjeea_admission_plan_2026/bjeea_2026_admission_plan_exceptions.json`
  - 46 所目标院校缺口清单。
- `docs/bjeea_2026_admission_plan_connection_report.md`
  - 接入报告。
- `docs/bjeea_2026_catalog_source_discovery.md`
  - 官网目录文件发现记录。

### 前端接入

- `miniprogram/pages/volunteer-preview/index.js`
  - 已接入 `beijing-2026-admission-plan-firstlook.js`。
  - 若有官方 2026 专业计划，会优先展示专业名、计划人数、学制、学费、外语语种、选科要求。
  - 若无官方记录，则显示清楚的未开放状态，不用旧数据冒充。
- `miniprogram/pages/volunteer-preview/index.wxml`
  - 新增「2026 招生计划」模块。
- `miniprogram/pages/volunteer-preview/index.wxss`
  - 新增招生计划模块样式。
- `miniprogram/data/major-catalog-status.js`
  - 更新为 2026 官方接入状态。

### 发布检查

- `package.json`
  - 新增 `check:plan2026`。
  - `check:release` 已串联 `check:plan2026:ready`。
  - 当前 `npm run check:release` 会失败，这是正确行为：缺少可确认 2026 官方专业计划，不能上线。

## 已执行验证

```bash
npm run monitor:plan2026:download
npm run refresh:plan2026
python scripts/fetch_bjeea_admission_plan_2026.py --probe-dwr --probe-start 5700 --probe-end 5900
node scripts/export_bjeea_2026_admission_plan_firstlook.js
node scripts/report_bjeea_2026_plan_status.js
python scripts/sync_bjeea_2026_downloaded_catalog.py
node scripts/check_syntax.js
node scripts/check_data.js
node scripts/check_release_readiness.js
npm run check:plan2026
npm run check:release
```

结果：

- 基础语法、数据、页面可用性检查通过。
- `npm run monitor:plan2026:download` 已跑通：官方文件候选 0、下载候选 0、2026 官方专业计划记录 0。
- `npm run check:plan2026` 输出 readyForRelease=false。
- `npm run check:release` 按预期失败，原因是北京教育考试院 2026 招生专业目录尚未接入可用记录。

## 下一步

任选其一：

1. 等北京教育考试院 `/plan/115` 正式开放 2026 年度与本科普通批记录后，重新执行：

```bash
npm run monitor:plan2026
npm run check:release
```

2. 如果北京教育考试院先发布目录 PDF/Excel，但查询页还未开放，可执行：

```bash
npm run monitor:plan2026:download
```

该命令会自动下载官方候选文件并尝试导入；只有导入出有效目标记录才会提升为主 staging。若报告显示没有提升，再按文件类型人工复核。

如果 6 月官方目录刚发布但搜索引擎还没收录，可优先跑：

```bash
npm run discover:plan2026:download:probe
npm run sync:plan2026:downloaded
npm run export:plan2026
npm run check:release
```

3. 如果用户已有官方 2026 招生专业目录 PDF/Excel，可放入 `data/raw/admissions/2026/`，然后执行：

```bash
python scripts/import_bjeea_2026_admission_plan_excel.py data/raw/admissions/2026/官方目录.xlsx
# 或文本型 PDF：
python scripts/import_bjeea_2026_admission_plan_pdf.py data/raw/admissions/2026/官方目录.pdf
node scripts/export_bjeea_2026_admission_plan_firstlook.js
npm run check:release
```

导入仍必须保留来源、页码/表格证据和 exceptions；扫描型 PDF 不能未经 OCR/人工复核直接入库。

## 上线原则

不能用 2025 投档线、2024 选考要求或本地专业方向库冒充 2026 招生专业目录。只有 `scripts/check_bjeea_2026_admission_plan_coverage.js --require-ready` 通过后，才允许上传审核。
