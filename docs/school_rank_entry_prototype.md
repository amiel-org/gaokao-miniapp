# 校排入口输入结构与搜索结果接口原型

## 1. 回到目标

这个模块不是孤立功能，它服务的是产品主链：

1. 家长进入“我只知道校内排名”
2. 搜索并选中北京公办高中
3. 输入校内排名、年级人数和排名口径
4. 系统估算北京市位次区间
5. 再进入北京市定位和志愿初筛

所以这个模块最关键的要求不是“能搜”，而是：

- 搜得准
- 选得稳
- 能把后续预测需要的上下文带出来

## 2. 校排入口输入结构

## 2.1 页面目标

帮助家长在“只知道校内排名”的情况下，快速形成后续预测所需的最小输入集。

## 2.2 输入字段

建议输入结构如下：

```json
{
  "input_mode": "school_rank",
  "district": "海淀区",
  "school_query": "人大附",
  "selected_school_id": "BJ_HS_HD_0001",
  "selected_school_name": "中国人民大学附属中学",
  "grade_rank": 120,
  "grade_total": 680,
  "ranking_basis": "same_track",
  "score": 640,
  "subject_group": "物化",
  "risk_tags": ["色弱"],
  "city_preference": [],
  "school_level_preference": [],
  "major_preference": []
}
```

## 2.3 字段说明

### 必填字段

- `input_mode`
  - 固定值：`school_rank`

- `district`
  - 所在区
  - 优先通过选择组件输入

- `school_query`
  - 家长输入的学校搜索词
  - 用于搜索日志分析，不作为最终标准学校字段

- `selected_school_id`
  - 最终选中的标准学校 ID
  - 这是后续所有预测逻辑的主键

- `selected_school_name`
  - 最终确认展示给用户的学校名

- `grade_rank`
  - 年级排名

- `grade_total`
  - 年级总人数

- `ranking_basis`
  - 推荐枚举值：
    - `same_track`：同类选科有效排名
    - `full_grade`：全年级大排名
    - `unknown`：家长不确定

### 选填字段

- `score`
  - 当前分数
  - 用于收窄预测区间

- `subject_group`
  - 选科组合

- `risk_tags`
  - 风险标签数组

- `city_preference`
  - 城市偏好

- `school_level_preference`
  - 院校层次偏好

- `major_preference`
  - 专业偏好

## 3. 学校搜索接口原型

## 3.1 接口目标

把家长的自然输入词转换成稳定的学校候选列表，供前端选择。

## 3.2 请求结构

```json
{
  "query": "人大附",
  "district": "海淀区",
  "limit": 10
}
```

字段说明：

- `query`
  - 家长输入的学校关键词

- `district`
  - 可选
  - 如果已选择所在区，应作为优先过滤条件

- `limit`
  - 可选
  - 默认 10

## 3.3 响应结构

```json
{
  "query": "人大附",
  "district": "海淀区",
  "total": 5,
  "items": [
    {
      "school_id": "BJ_HS_HD_0001",
      "official_name": "中国人民大学附属中学",
      "short_name": "人大附中",
      "district": "海淀区",
      "entity_type": "main_school",
      "canonical_school_name": "中国人民大学附属中学",
      "independent_admission": true,
      "match_score": 110,
      "match_reason": "short_name_exact"
    }
  ]
}
```

## 3.4 响应字段说明

- `query`
  - 原始查询词

- `district`
  - 当前区过滤条件

- `total`
  - 返回的候选数量

- `items`
  - 学校候选项数组

每个候选项包含：

- `school_id`
- `official_name`
- `short_name`
- `district`
- `entity_type`
  - `main_school`
  - `branch_school`
  - `campus`
  - `co_branded_school`

- `canonical_school_name`
  - 当前规范名

- `independent_admission`
  - 是否按独立招生实体处理

- `match_score`
  - 匹配分

- `match_reason`
  - 匹配来源

## 4. 前端展示建议

搜索候选项建议展示成：

```text
人大附中
中国人民大学附属中学｜海淀区｜主校
```

如果是分校/校区/合作校，可展示为：

```text
人大附中第二分校
中国人民大学附属中学第二分校｜海淀区｜分校
```

```text
北交附中东校区
北京交通大学附属中学东校区｜海淀区｜校区
```

这样家长更容易选对，而不是把主校、分校和校区混掉。

## 5. 当前原型已覆盖的能力

当前本地原型已经具备：

- 基于 `official_name`
- 基于 `short_name`
- 基于 `aliases`
- 基于 `search_tokens`

的匹配能力，并支持区过滤与排序。

## 6. 下一步如何衔接主链

当前模块完成后，下一步应直接进入：

- `校排转市排输入校验`
- `校排转市排输出结构原型`

因为搜索模块已经足够支撑“选中学校”这一步。

