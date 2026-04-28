# 项目状态快照：北京高考志愿填报小程序

日期：2026-04-27  
校准更新：2026-04-28

> 本文档已在 2026-04-28 按当前 Git、页面、工具模块和微信开发者工具反馈修复状态重新校准。后续以本文档 + `docs/handoff_2026-04-28.md` 为当前交接基准。

## 1. 当前项目一句话状态

当前项目已经完成了从“产品想法”到“可运行小程序原型链路”的第一阶段：

> 北京公办高中标准库 + 校排转市排估算参数 + 校排入口页 + 北京定位结果页 + 冲稳保预览页。

目前还不是正式上线版本，仍属于：

> 真实导出数据模块 + 前端同口径估算逻辑 + 微信开发者工具导入反馈修复后的 V1 原型。

## 2. 已完成内容

### 2.1 产品方向

已明确：

- V1 只做北京。
- V1 重点做北京公办高中。
- 首页/主入口优先解决“家长不知道孩子在北京大概什么位置”的定位焦虑。
- 支持两类入口：分数 / 官方位次入口、校内排名入口。
- 校排入口必须要求用户补齐：所在区、学校、校排名、年级总人数、排名口径。
- 一模 / 二模分数作为可选参考，不作为必填。

### 2.2 数据边界

已明确：

- 没有公开统一的官方数据库可以直接回答“某高中校排第 N 名 = 北京市第几名”。
- 因此系统分成两层：官方参考层、学校估算层。
- 输出必须是区间、置信度、解释，不伪装成官方位次。

### 2.3 年度数据策略

已明确：

- 2025 是当前完整基线年。
- 2026、2027 等后续年份不覆盖 2025。
- 年度数据应并存，支持回测、对比、追溯和参数校准。

### 2.4 北京公办高中标准库

已完成：

- 2025 标准学校库重建。
- 当前标准库记录数：195 所。
- 已包含 `school_id`、`official_name`、`short_name`、`district`、`entity_type`、`canonical_school_name`、`aliases`、`search_tokens` 等字段。
- 已区分 `main_school`、`branch_school`、`campus`、`co_branded_school`。

### 2.5 校排估算参数层

已完成：

- 195 所学校全量初始估算参数表。
- T1 / T2 学校精调覆盖。
- T1 / T2 覆盖情况：重点学校 42 所，已精调覆盖 42 所，缺失 0。

当前梯队分布：

- T1：20 所。
- T2：22 所。
- T3：97 所。
- T4：45 所。
- T5：11 所。

### 2.6 回测样例库

已完成：

- 已建立回测样例库。
- 当前样例数：14。
- 覆盖 T1 主校、T2 主校、分校、校区、低置信度场景、输入错误场景。

### 2.7 参数校准记录机制

已完成：

- 参数校准日志。
- 参数校准 manifest。
- 参数校准脚本。
- 当前校准日志记录数：2。

### 2.8 小程序前端原型

当前 `miniprogram/app.json` 已注册三个页面：

1. 校排入口页：`miniprogram/pages/school-rank-entry/index`
2. 北京定位结果页：`miniprogram/pages/position-result/index`
3. 冲稳保预览页：`miniprogram/pages/volunteer-preview/index`

当前页面链路：

1. 用户选择所在区。
2. 搜索并选中高中。
3. 输入校排名、年级总人数、排名口径。
4. 可选输入一模 / 二模分数，或选择“不确定”。
5. 前端用真实导出数据模块进行估算。
6. 写入 `latestPositionResult`。
7. 跳转到北京定位结果页。
8. 展示市排名区间、定位段位、置信度、风险提示和下一步建议。
9. 点击“继续看冲稳保”进入冲稳保预览页，展示冲 / 稳 / 保三档参考区间。

### 2.9 前端逻辑模块化

已完成第一轮前端工程整理：

- 学校标签和固定选项已抽到 `miniprogram/utils/school-labels.js`。
- 学校搜索逻辑已抽到 `miniprogram/utils/school-search.js`。
- 校排估算逻辑已抽到 `miniprogram/utils/school-rank-estimator.js`。

校排入口页现在主要负责页面状态、表单校验、payload 组装和跳转，不再承载大量业务计算逻辑。

### 2.10 微信开发者工具反馈修复

已根据首次体验反馈完成：

- 首页增加一模 / 二模分数，且不作为必填。
- 学校搜索强匹配时自动选中。
- 修复结果页顶部导航标题乱码。
- 新增冲稳保预览页，避免按钮只弹 toast。
- 配置合法 AppID / sitemap，并压制游客环境下 async secinfo 类干扰错误。

### 2.11 页面视觉预览

已生成预览图：

- `output/page-preview/school-rank-entry-preview.png`
- `output/page-preview/position-result-preview.png`

另外，已经用 imagegen 生成过一版更丰富的结果页视觉方向，但尚未落地到代码。

### 2.12 Git 版本管理

当前项目已经是 Git 仓库。

当前分支：`codex/baseline-v1`

最近已提交内容包括：

- 微信开发者工具导入说明。
- DevTools 首次运行流程修复。
- async secinfo 干扰错误处理。
- 合法 AppID / sitemap 配置。
- 项目描述编码归一。

## 3. 当前关键文件

当前主产品手册：

- `PRODUCT_V1_clean.md`

当前状态 / 交接文档：

- `docs/project_status_2026-04-27.md`
- `docs/handoff_2026-04-28.md`
- `docs/wechat_devtools_feedback_fixes_2026-04-27.md`
- `docs/devtools_cli_debug_notes_2026-04-27.md`

当前关键前端文件：

- `miniprogram/app.json`
- `miniprogram/pages/school-rank-entry/index.js`
- `miniprogram/pages/position-result/index.js`
- `miniprogram/pages/volunteer-preview/index.js`
- `miniprogram/utils/school-labels.js`
- `miniprogram/utils/school-search.js`
- `miniprogram/utils/school-rank-estimator.js`

当前关键数据模块：

- `miniprogram/data/school-library.js`
- `miniprogram/data/school-estimation-params.js`
- `miniprogram/data/beijing-rank-map.js`

注意：

- `PRODUCT_V1_clean.md` 是当前主手册。
- `PRODUCT_V1.md` 和部分早期 docs 属于历史文档，可能不是最新状态。
- 后续应以 `PRODUCT_V1_clean.md` + 当前状态文档 + `docs/handoff_2026-04-28.md` 为准。

## 4. 本次校验结果

2026-04-28 已执行并通过：

### 4.1 JS 语法校验

已执行：

- `node --check miniprogram/pages/school-rank-entry/index.js`
- `node --check miniprogram/pages/position-result/index.js`
- `node --check miniprogram/pages/volunteer-preview/index.js`
- `node --check miniprogram/utils/school-labels.js`
- `node --check miniprogram/utils/school-search.js`
- `node --check miniprogram/utils/school-rank-estimator.js`

结果：JS 语法通过。

### 4.2 JSON 解析校验

已校验：

- `miniprogram/app.json`
- `miniprogram/pages/school-rank-entry/index.json`
- `miniprogram/pages/position-result/index.json`
- `miniprogram/pages/volunteer-preview/index.json`
- `project.config.json`
- `project.private.config.json`

结果：JSON 可解析。

### 4.3 回测脚本

已执行：

- `python scripts/run_estimation_test_cases.py`

结果：`cases=14`

### 4.4 文本编码检查

已检查关键文件：

- 无 Unicode replacement character 替换符。
- 无连续问号乱码。

说明：

- PowerShell 直接 `Get-Content` 显示中文时，偶尔会出现终端编码乱码。
- 但用 Python 读取 UTF-8 文件检查后，文件本身是正常的。

## 5. 还没有完成的内容

### 5.1 尚未接正式后端 API

当前页面是：真实导出数据模块 + 前端同口径估算逻辑。还不是云函数 / 后端 API。

后续需要：

- 搜索 API。
- 估算 API。
- 结果查询 API。
- 数据版本 API。
- 推荐 API。

### 5.2 前端逻辑已完成第一轮共享模块抽取，但尚未接后端 adapter

后续仍需要：

- 将同口径逻辑接入云函数 / 后端 API。
- 保持前端原型逻辑与后端正式逻辑一致，避免重复实现。

### 5.3 还没有院校专业组数据

还未建立：

- 2025 院校专业组录取数据。
- 专业组代码。
- 选科要求。
- 专业限制。
- 色弱/色盲/体检限制。
- 学校 + 专业组 + 专业层级结构。

### 5.4 已有冲稳保预览页，但还不是正式推荐页

当前“继续看冲稳保”已能进入：`miniprogram/pages/volunteer-preview/index`。

它会根据定位区间生成冲 / 稳 / 保三档参考位次范围。

但正式推荐页仍未完成，还缺：

- 院校专业组列表。
- 近三年录取位次。
- 推荐理由。
- 风险标签。
- 选科要求与专业限制提醒。
- 色弱 / 色盲 / 体检限制。

### 5.5 还没有正式 UI 美化落地

目前页面已经能跑，但视觉仍偏原型。

已生成更高级视觉方向，但尚未改入小程序代码。

### 5.6 微信开发者工具还缺完整验收闭环

已做首次导入反馈修复，但还缺：

- 微信开发者工具重新编译后的完整记录。
- 模拟器点击流程验收截图或日志。
- 真机预览。
- 控制台业务错误检查。

### 5.7 Git 已建立，后续需要保持阶段性提交

后续要求：

- 每完成一个稳定阶段做一次 commit。
- 修改前先看 `git status`，避免混入无关文件。
- 重要页面或数据改动同步更新文档。

## 6. 当前风险点

### 风险 1：数据可信度仍需持续补强

当前参数表是 V1 初始参数 + T1/T2 精调，不等同于最终真实模型。

### 风险 2：前端原型逻辑和未来后端逻辑仍需保持同口径

前端已经完成第一轮共享模块抽取，但后续接云函数 / 后端 API 时仍要避免重新写一套不一致的估算逻辑。

### 风险 3：Git 已建立，但需要坚持阶段性提交

当前已有 Git 分支和提交，风险从“无法回滚”变成“后续改动如果不及时提交，仍可能难以追踪”。

### 风险 4：微信开发者工具仍缺完整验收记录

已根据首次体验反馈修复若干问题，但还需要重新编译、模拟器点击和真机预览记录。

## 7. 建议下一步

建议按这个顺序继续：

1. 用微信开发者工具重新编译并完整走一遍模拟器流程。
2. 把当前 `project_status_2026-04-27.md` 与 `docs/handoff_2026-04-28.md` 作为后续工作基准。
3. 把 imagegen 视觉方向转成小程序页面样式。
4. 开始建立 2025 院校专业组数据结构。
5. 将冲稳保预览页升级为接入院校专业组数据的推荐页。
6. 每完成一个稳定阶段及时提交 Git。

## 8. 当前结论

当前项目不是“只停留在想法”，已经有了可验证的工程雏形。

但它也还不是“可上线产品”，距离上线还缺：

- 后端 API。
- 院校专业组数据。
- 正式冲稳保推荐链路。
- 微信开发者工具完整验收。
- 阶段性 Git 提交纪律。
- 正式 UI 打磨。

## 9. 2026-04-28 选科与冲稳保推荐方向更新

本次根据微信开发者工具实际体验，确认并推进以下调整：

1. 首页新增北京 3+3 选科组合。
   - 固定 20 种组合。
   - 使用选择器，不自由输入。
   - 选科组合写入 `latestPositionResult.input.subjectCombination`。

2. 冲稳保页从“位次范围预览”升级为“院校专业组卡片”。
   - 卡片展示学校名、专业组、推荐层级、2025 投档分、位次、选科要求、推荐理由和风险提醒。
   - 推荐对象改为“院校 + 专业组”，不是单纯学校名。

3. 新增官方投档线种子数据。
   - 来源：北京教育考试院《2025年北京市高招本科普通批录取投档线》PDF。
   - 小程序侧数据模块：`miniprogram/data/college-admission-groups.js`。
   - 构建脚本：`scripts/build_college_admission_group_seed.py`。

4. 新增文档：
   - `docs/college_admission_groups_data_design.md`
   - `docs/volunteer_recommendation_api_design.md`

当前边界：专业明细、招生计划、体检限制、色弱/色盲限制尚未全量接入，后续继续从官方招生专业目录补齐。

## 10. 2026-04-28 专业目录来源状态

已定位北京教育考试院官方《2025普通高等学校招生专业目录》PDF，并下载到本地 raw 数据目录。该 PDF 为扫描/图片型文件，直接文本抽取为空。

本次新增专业目录结构化管线说明和前端状态模块：

- `docs/major_catalog_pipeline.md`
- `miniprogram/data/major-catalog-status.js`

当前冲稳保页仍使用官方投档线种子数据展示学校和专业组；专业明细、招生计划、体检限制和色弱/色盲限制进入 OCR/人工校验待办。
