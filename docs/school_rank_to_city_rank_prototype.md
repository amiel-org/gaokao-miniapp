# 校排转市排输入校验与输出结构原型

## 1. 回到目标

这个模块服务的不是“精准算命式排名”，而是帮助北京家长在只有校内排名时，先得到一个可解释、可标注置信度的市级区间参考。

产品目标仍然是：

1. 先知道孩子大概在北京什么位置
2. 再做志愿初筛
3. 再看风险和限制

所以这里必须区分两层：

- 官方参考层
- 学校映射估算层

## 2. 目前已确认的可用数据

### 官方参考层

可确认存在：

- 北京市教育考试院发布的 2025 年考生分数分布 PDF
- 本地已有 `beijing_rank_map.json`

这意味着：

- 分数 -> 北京市位次，可以走“官方参考层”

### 学校映射估算层

当前没有稳定可用的、逐个高中官方公开的“校排 -> 市排”统一标准库。

因此这一层当前只能做：

- 基于学校层级
- 基于校内百分位
- 基于可选分数
- 基于输入完整度

的区间估算

并且必须显式标注：

- 预测
- 置信度
- 说明文字

## 3. 输入校验原型

## 3.1 输入结构

```json
{
  "input_mode": "school_rank",
  "district": "海淀区",
  "selected_school_id": "BJ_HS_HD_0001",
  "selected_school_name": "中国人民大学附属中学",
  "grade_rank": 120,
  "grade_total": 680,
  "ranking_basis": "same_track",
  "score": 640,
  "subject_group": "物化"
}
```

## 3.2 校验规则

### 必填校验

- `district` 不能为空
- `selected_school_id` 不能为空
- `selected_school_name` 不能为空
- `grade_rank` 不能为空
- `grade_total` 不能为空
- `ranking_basis` 不能为空

### 数值校验

- `grade_rank` 必须大于 0
- `grade_total` 必须大于 0
- `grade_rank` 不能大于 `grade_total`

### 范围校验

- 如果 `grade_total < 50`，提示样本基数偏小，可信度降低
- 如果 `grade_rank / grade_total > 1`，直接报错
- 如果 `score` 存在，应在合理高考分数范围内

### 学校存在性校验

- `selected_school_id` 必须能在标准库中找到
- `selected_school_name` 必须与标准库中该 `school_id` 对应记录一致

### 关系型学校提示

如果学校记录为：

- `branch_school`
- `campus`
- `co_branded_school`

则应附加提示：

- 当前选择的是分校/校区/合作校
- 不建议直接套用主校经验

## 4. 输出结构原型

## 4.1 目标

输出要能同时承接：

- 前端展示
- 后续推荐逻辑
- 置信度解释
- 数据来源透明度

## 4.2 输出结构

```json
{
  "input_summary": {
    "district": "海淀区",
    "school_id": "BJ_HS_HD_0001",
    "school_name": "中国人民大学附属中学",
    "grade_rank": 120,
    "grade_total": 680,
    "ranking_basis": "same_track",
    "score": 640
  },
  "school_context": {
    "entity_type": "main_school",
    "canonical_school_name": "中国人民大学附属中学",
    "independent_admission": true
  },
  "official_reference": {
    "score_rank_reference": 4200,
    "reference_source": "北京教育考试院分数分布 / 本地 rank_map"
  },
  "estimated_city_rank": {
    "rank_min": 3500,
    "rank_max": 5000,
    "confidence_level": "medium",
    "confidence_score": 0.68,
    "estimation_basis": [
      "school_tier",
      "school_percentile",
      "score_reference"
    ],
    "explanation": "当前结果为预测区间，不等同于官方位次。"
  },
  "next_step_hint": {
    "can_continue_to_recommendation": true,
    "recommended_action": "进入北京市定位与志愿初筛"
  }
}
```

## 4.3 字段说明

### `input_summary`

用于前端回显用户输入

### `school_context`

用于说明当前学校的关系属性：

- 是主校还是分校
- 当前规范名是什么
- 是否按独立招生实体处理

### `official_reference`

如果用户提供了 `score`，则可以基于本地 `rank_map` 给出一个“官方参考层”结果。

注意：

- 这里只能表达“分数对应的大致市位次参考”
- 不能把它说成校排换算结果

### `estimated_city_rank`

这是学校映射估算层。

必须包含：

- `rank_min`
- `rank_max`
- `confidence_level`
- `confidence_score`
- `estimation_basis`
- `explanation`

### `next_step_hint`

用于控制前端是否可继续进入推荐页。

## 5. 置信度建议

建议采用三档：

- `high`
- `medium`
- `low`

并保留数值型 `confidence_score`

建议初期计算因素：

- 是否标准学校命中
- 是否主校 / 分校 / 校区
- 排名口径是否明确
- 是否提供分数
- 年级总人数是否合理

## 6. 明确不能做的事

当前阶段不要做：

- 输出单点精确市排名
- 把估算结果伪装成官方数据
- 把主校经验无差别套给分校/校区

## 7. 当前最适合的下一步

文档和结构原型定完后，下一步应做：

1. 输入校验函数原型
2. 使用现有 `rank_map` 接入官方参考层
3. 再写学校映射估算占位逻辑

