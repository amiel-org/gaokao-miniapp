# 项目状态快照：北京高考志愿填报小程序

日期：2026-04-27

## 1. 当前项目一句话状态

当前项目已经完成了从“产品想法”到“可运行原型链路”的第一阶段：

> 北京公办高中标准库 + 校排转市排估算参数 + 校排入口页 + 北京定位结果页。

目前还不是正式上线版本，仍属于：

> 真实导出数据模块 + 前端同口径估算逻辑 + 页面原型。

## 2. 已经完成的内容

### 2.1 产品方向

已明确：

- V1 只做北京。
- V1 重点做北京公办高中。
- 首页/主入口优先解决“家长不知道孩子在北京大概什么位置”的定位焦虑。
- 支持两类入口：
  - 分数 / 官方位次入口。
  - 校内排名入口。
- 校排入口必须要求用户补齐：
  - 所在区。
  - 学校。
  - 校排名。
  - 年级总人数。
  - 排名口径。
- 分数和选科作为推荐补充字段。

### 2.2 数据边界

已明确：

- 没有公开统一的官方数据库可以直接回答“某高中校排第 N 名 = 北京市第几名”。
- 因此系统分成两层：
  - 官方参考层：分数到北京市位次参考。
  - 学校估算层：校排到市排区间预测。
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
- 已包含字段：
  - `school_id`
  - `official_name`
  - `short_name`
  - `district`
  - `entity_type`
  - `canonical_school_name`
  - `aliases`
  - `search_tokens`
- 已区分实体关系：
  - `main_school`
  - `branch_school`
  - `campus`
  - `co_branded_school`

### 2.5 学校关系与去重

已完成：

- 第一批、第二批候选学校池合并。
- 主校、分校、校区、合作校不再简单当重复删除。
- 建立关系建模规则。
- 对部分用户确认的学校关系做了归一处理。

### 2.6 校排估算参数层

已完成：

- 195 所学校全量初始估算参数表。
- T1 / T2 学校精调覆盖。
- T1 / T2 覆盖情况：
  - 重点学校数：42。
  - 已精调覆盖：42。
  - 缺失：0。

当前梯队分布：

- T1：20 所。
- T2：22 所。
- T3：97 所。
- T4：45 所。
- T5：11 所。

### 2.7 回测样例库

已完成：

- 已建立回测样例库。
- 当前样例数：14。
- 覆盖：
  - T1 主校。
  - T2 主校。
  - 分校。
  - 校区。
  - 低置信度场景。
  - 输入错误场景。

### 2.8 参数校准记录机制

已完成：

- 参数校准日志。
- 参数校准 manifest。
- 参数校准脚本。
- 当前校准日志记录数：2。

### 2.9 小程序前端原型

已完成两个页面：

1. 校排入口页：
   - `miniprogram/pages/school-rank-entry/index`
2. 北京定位结果页：
   - `miniprogram/pages/position-result/index`

当前页面链路：

1. 用户选择所在区。
2. 搜索并选中高中。
3. 输入校排名、年级总人数、排名口径。
4. 可选输入分数。
5. 前端用真实导出数据模块进行估算。
6. 写入 `latestPositionResult`。
7. 跳转到北京定位结果页。
8. 展示市排名区间、定位段位、置信度、风险提示和下一步建议。

### 2.10 前端逻辑模块化

已完成一次前端工程整理：

- 学校标签和固定选项已抽到 `miniprogram/utils/school-labels.js`。
- 学校搜索逻辑已抽到 `miniprogram/utils/school-search.js`。
- 校排估算逻辑已抽到 `miniprogram/utils/school-rank-estimator.js`。

校排入口页现在主要负责页面状态、表单校验、payload 组装和跳转，不再承载大量业务计算逻辑。

### 2.11 页面视觉预览

已生成预览图：

- 校排入口页预览：
  - `output/page-preview/school-rank-entry-preview.png`
- 北京定位结果页预览：
  - `output/page-preview/position-result-preview.png`

另外，已经用 imagegen 生成过一版更丰富的结果页视觉方向，但尚未落地到代码。

## 3. 已经更新过的文档

当前主产品手册：

- `PRODUCT_V1_clean.md`

当前已补充的关键文档：

- `docs/data_baseline_policy.md`
- `docs/implementation_roadmap.md`
- `docs/product_v1_increment_frontend_integration.md`
- `docs/product_v1_increment_position_result_page.md`
- `docs/frontend_logic_refactor_2026-04-27.md`
- `docs/school_rank_entry_prototype.md`
- `docs/school_rank_to_city_rank_prototype.md`
- `docs/school_rank_estimation_data_layer.md`
- `docs/parameter_calibration_mechanism.md`
- `docs/rebuild_2025_data_baseline_report.md`

注意：

- `PRODUCT_V1_clean.md` 是当前主手册。
- `PRODUCT_V1.md` 和部分早期 docs 属于历史文档，可能不是最新状态。
- 后续应以 `PRODUCT_V1_clean.md` + 当前状态文档为准。

## 4. 已经做过的校验

### 4.1 数据校验

本次体检结果：

- 标准学校库：195 条。
- 学校缺失 `school_id`：0。
- 学校缺失 `aliases`：0。
- 学校缺失 `search_tokens`：0。
- 参数表：195 条。
- 参数表缺失 `school_id`：0。
- T1 / T2 覆盖：42 / 42。
- 回测样例：14 条。

### 4.2 小程序文件校验

已校验：

- `miniprogram/app.json`
- `miniprogram/pages/school-rank-entry/index.json`
- `miniprogram/pages/position-result/index.json`

结果：

- JSON 可解析。

### 4.3 JS 语法校验

已执行：

- `node --check miniprogram/pages/school-rank-entry/index.js`
- `node --check miniprogram/pages/position-result/index.js`

结果：

- JS 语法通过。

### 4.4 回测脚本

已执行：

- `python scripts/run_estimation_test_cases.py`

结果：

- cases = 14。
- 脚本可运行。

### 4.5 文本编码检查

已检查关键文件：

- 无 Unicode replacement character 替换符。
- 无连续问号乱码。

说明：

- PowerShell 直接 `Get-Content` 显示中文时，偶尔会出现终端编码乱码。
- 但用 Python 读取 UTF-8 文件检查后，文件本身是正常的。

## 5. 还没有完成的内容

### 5.1 尚未接正式后端 API

当前页面是：

> 真实导出数据模块 + 前端同口径估算逻辑。

还不是：

> 云函数 / 后端 API。

后续需要：

- 搜索 API。
- 估算 API。
- 结果查询 API。
- 数据版本 API。

### 5.2 逻辑还没有抽成共享模块

当前 `searchSchools` 和 `estimateCityRank` 仍在页面 JS 中。

后续应抽到：

- `miniprogram/utils/search.js`
- `miniprogram/utils/estimate.js`
- 或后续云函数 adapter。

### 5.3 还没有院校专业组数据

还未建立：

- 2025 院校专业组录取数据。
- 专业组代码。
- 选科要求。
- 专业限制。
- 色弱/色盲/体检限制。
- 学校 + 专业组 + 专业层级结构。

### 5.4 还没有冲稳保推荐页

当前“继续看冲稳保”按钮只是占位。

还未完成：

- 冲稳保推荐页。
- 院校专业组列表。
- 推荐理由。
- 风险标签。
- 专业限制提醒。

### 5.5 还没有正式 UI 美化落地

目前页面已经能跑，但视觉仍偏原型。

已生成更高级视觉方向，但尚未改入小程序代码。

### 5.6 还没有微信开发者工具真机/模拟器验收记录

当前完成的是本地文件与脚本校验。

还缺：

- 微信开发者工具导入。
- 页面编译。
- 模拟器点击流程。
- 真机预览。
- 控制台错误检查。

### 5.7 还没有 Git 版本管理闭环

当前目录不是 Git 仓库，无法进行：

- commit。
- diff 审查。
- 分支管理。
- 回滚。

建议后续初始化 Git，至少做到每个阶段一个 commit。

## 6. 当前风险点

### 风险 1：数据可信度仍需持续补强

当前参数表是 V1 初始参数 + T1/T2 精调，不等同于最终真实模型。

### 风险 2：前端逻辑和未来后端逻辑可能重复

如果不尽快抽共享模块，后续接 API 时容易重复实现。

### 风险 3：没有 Git 仓库会影响可回滚性

如果后续改动越来越多，没有版本管理会很危险。

### 风险 4：页面还没经过微信开发者工具验收

JS 语法通过不代表微信小程序编译一定完全通过。

## 7. 建议下一步

建议按这个顺序继续：

1. 初始化 Git 仓库并做一次当前基线提交。
2. 用微信开发者工具导入项目，做一次模拟器验收。
3. 把 imagegen 视觉方向转成小程序页面样式。
4. 开始建立 2025 院校专业组数据结构。
5. 做冲稳保推荐页原型。

## 8. 当前结论

当前项目不是“只停留在想法”，已经有了可验证的工程雏形。

但它也还不是“可上线产品”，距离上线还缺：

- 后端 API。
- 院校专业组数据。
- 冲稳保推荐链路。
- 微信开发者工具验收。
- Git 版本管理。
- 正式 UI 打磨。
