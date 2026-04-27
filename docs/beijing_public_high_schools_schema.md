# 北京公办高中标准库字段说明

## 1. 目标

这份标准库用于支持以下能力：

- 高中搜索与联想
- 高中名称标准化识别
- aliases 归一
- 校内排名转市排名区间预测
- 搜索日志回流补全

V1 先聚焦北京核心公办高中，首批覆盖 80 到 120 所，重点确保城八区高频学校全覆盖。

## 2. 数据文件

当前建议维护两类文件：

- `data/reference/beijing_public_high_schools.template.json`
- `data/reference/beijing_public_high_schools.sample.json`

其中：

- `template` 用于定义字段结构
- `sample` 用于提供真实样例

## 3. 字段定义

### 3.1 基础标识字段

#### `school_id`

- 类型：`string`
- 示例：`BJ_HS_HD_0001`
- 作用：唯一主键，供搜索、预测、日志、后端接口统一引用

#### `official_name`

- 类型：`string`
- 示例：`中国人民大学附属中学`
- 作用：标准全称，用于正式展示与结果输出

#### `short_name`

- 类型：`string`
- 示例：`人大附中`
- 作用：短名称，用于卡片、搜索候选和紧凑展示

#### `district`

- 类型：`string`
- 示例：`海淀区`
- 作用：用于筛选和减少搜索歧义

#### `is_public`

- 类型：`boolean`
- 示例：`true`
- 作用：V1 只收录北京公办高中

#### `status`

- 类型：`integer`
- 示例：`1`
- 约定：
  - `1`：启用
  - `0`：停用
- 作用：应对学校改名、合并、暂不纳入等情况

## 3.2 搜索与归一字段

#### `aliases`

- 类型：`string[]`
- 示例：`["人大附中", "人大附", "人大附本校"]`
- 作用：承接家长常见简称、俗称、非标准输入

#### `search_tokens`

- 类型：`string[]`
- 示例：`["中国人民大学附属中学", "人大附中", "人大附", "海淀"]`
- 作用：提供更直接的搜索命中词集合

#### `pinyin_initials`

- 类型：`string[]`
- 示例：`["rdfz", "rdfz"]`
- 作用：支持拼音首字母和简拼搜索

#### `input_hints`

- 类型：`string[]`
- 示例：`["优先选择标准学校，不建议手填", "搜不到时再手动输入"]`
- 作用：可选字段，用于前端提示

## 3.3 预测与算法字段

#### `tier_level`

- 类型：`integer`
- 示例：`1`
- 建议约定：
  - `1`：头部强校
  - `2`：市级强校
  - `3`：区级重点/优质高中
  - `4`：普通公办高中
  - `5`：数据待补或波动较大的学校
- 作用：V1 预测规则的核心输入之一

#### `conversion_confidence`

- 类型：`number`
- 示例：`0.9`
- 建议范围：`0` 到 `1`
- 作用：控制校排转市排区间的置信度和区间宽窄

#### `default_enrollment_scale`

- 类型：`integer`
- 示例：`650`
- 作用：当家长不知道年级总人数时，作为默认估算基数

#### `ranking_notes`

- 类型：`string`
- 示例：`样例学校，历史生源稳定，适合较窄区间估算。`
- 作用：记录该校预测使用时的业务说明

## 3.4 维护与追踪字段

#### `source_type`

- 类型：`string`
- 示例：`manual_seed`
- 建议值：
  - `manual_seed`
  - `generated`
  - `reviewed`
- 作用：标记该记录的来源状态

#### `last_reviewed_at`

- 类型：`string`
- 示例：`2026-04-15`
- 作用：标记最近人工复核日期

#### `enabled`

- 类型：`boolean`
- 示例：`true`
- 作用：前端与后端是否对外启用

## 4. aliases 的生成原则

V1 不建议完全依赖人工手写所有 aliases，也不建议完全依赖机器自动拍板。

推荐流程：

1. 程序自动生成第一批 aliases 候选
2. 人工快速审核高频学校
3. 前端搜索结果让家长二次确认
4. 后续根据真实搜索日志持续补全

程序自动生成时可优先处理：

- 去掉“北京市”
- 去掉“中学/学校/附属中学”等后缀
- 生成常见简称
- 统一数字写法
- 生成拼音首字母

## 5. V1 维护原则

- 首批不求全量，但求高频学校准确
- 城八区优先
- aliases 必须服务真实搜索，不追求形式上很多
- `tier_level` V1 先按业务经验定级
- `conversion_confidence` 初期允许人工给值，后续再结合数据校正

## 6. 后续扩展方向

后续可以新增但 V1 暂不强制的字段：

- `school_group`
- `campus_notes`
- `cross_district_notes`
- `historical_rank_band`
- `search_popularity`
- `manual_review_notes`

