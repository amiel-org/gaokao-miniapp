# 前端逻辑重构记录：搜索与估算工具模块

日期：2026-04-27

## 1. 本次重构目标

本次重构不是新增产品功能，而是做工程整理：

> 把校排入口页里的学校搜索、标签映射、校排估算逻辑抽成可复用工具模块。

这样后续做 UI 美化、云函数、后端 API adapter 时，不需要在页面文件里反复复制业务逻辑。

## 2. 重构前状态

原来主要逻辑都在：

`miniprogram/pages/school-rank-entry/index.js`

包括：

- 区列表。
- 排名口径文案。
- 学校实体类型文案。
- 学校搜索匹配。
- 搜索匹配分数。
- 校排转市排估算。
- 结果解释。

页面文件过重，不利于维护。

## 3. 重构后模块

新增：

### 3.1 标签与固定选项

`miniprogram/utils/school-labels.js`

负责：

- `districtOptions`
- `rankingBasisLabels`
- `entityTypeLabel`

### 3.2 学校搜索

`miniprogram/utils/school-search.js`

负责：

- `normalize`
- `matchReasonLabel`
- `scoreSchoolMatch`
- `searchSchools`

当前仍读取：

`miniprogram/data/school-library.js`

### 3.3 校排估算

`miniprogram/utils/school-rank-estimator.js`

负责：

- `confidenceLabel`
- `levelByRank`
- `bandText`
- `estimateCityRank`

当前仍读取：

- `miniprogram/data/school-estimation-params.js`
- `miniprogram/data/beijing-rank-map.js`

## 4. 页面改造

`miniprogram/pages/school-rank-entry/index.js` 现在只负责：

- 表单状态。
- 用户输入。
- 表单校验。
- 调用搜索工具。
- 调用估算工具。
- 组装结果 payload。
- 跳转结果页。

页面文件从“大量业务逻辑混合”变成“页面控制器”。

## 5. 对后续后端 API 的意义

后续可以更平滑地替换为：

- `searchSchools` 调用搜索 API。
- `estimateCityRank` 调用估算 API。
- 或在工具模块里增加 adapter，让页面代码不用大改。

## 6. 当前边界

当前仍是前端本地数据模块估算，不是正式后端服务。

本次只是让前端代码结构更稳，为后续接云函数 / 后端 API 做准备。

