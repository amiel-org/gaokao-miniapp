# 北京公办高中关系判定表

## 1. 说明

这份表不是用来删数据，而是用来判断主校、分校、校区、合作校之间的关系。

当前原则：

- 默认优先保留为独立学校实体
- 不直接合并回主校
- 先建立关系字段，再决定后续搜索与展示方式

## 2. 字段说明

- `parent_school_name`：当前推定的主校或基础学校名
- `candidate_school_name`：当前待判定的分校/校区/合作校名称
- `recommended_entity_type`：程序建议的实体类型
- `recommended_relation_type`：程序建议的关系类型
- `recommended_dedup_decision`：程序建议的处理方式
- `final_*`：人工最终判定结果

## 3. 建议枚举值

- `entity_type`：`main_school` / `branch_school` / `campus` / `co_branded_school` / `unknown`
- `relation_type`：`main_branch` / `main_campus` / `brand_cooperation` / `manual_review`
- `dedup_decision`：`keep_independent` / `merge_as_campus_note` / `merge_as_alias` / `manual_review`

## 4. 当前待判定清单

| review_id | 区 | 主校 | 待判定学校 | 程序建议实体类型 | 程序建议关系 | 程序建议处理 |
| --- | --- | --- | --- | --- | --- | --- |
| REL-001 | 东城区 | 北京市第五十中学 | 北京市第五十中学分校 | branch_school | main_branch | keep_independent |
| REL-002 | 丰台区 | 北京市第十中学 | 北京市第十中学晓月苑分校 | branch_school | main_branch | keep_independent |
| REL-003 | 丰台区 | 北京市第十八中学 | 北京市第十八中学蒲芳学校 | unknown | manual_review | keep_independent |
| REL-004 | 大兴区 | 北京市大兴区第一中学 | 北京市大兴区第一中学东校区 | campus | main_campus | keep_independent |
| REL-005 | 朝阳区 | 北京中学 | 中国传媒大学附属中学（北京中学传媒分校） | branch_school | main_branch | keep_independent |
| REL-006 | 朝阳区 | 北京中学 | 北京中学科技分校 | branch_school | main_branch | keep_independent |
| REL-007 | 朝阳区 | 北京中学 | 北京第二外国语学院附属中学（北京中学外语分校） | branch_school | main_branch | keep_independent |
| REL-008 | 朝阳区 | 北京市第八十中学 | 北京市第八十中学睿德分校 | branch_school | main_branch | keep_independent |
| REL-009 | 朝阳区 | 北京市陈经纶中学 | 北京市陈经纶中学团结湖分校 | branch_school | main_branch | keep_independent |
| REL-010 | 海淀区 | 中国人民大学附属中学 | 中国人民大学附属中学第二分校 | branch_school | main_branch | keep_independent |
| REL-011 | 海淀区 | 中国人民大学附属中学 | 中国人民大学附属中学翠微学校 | unknown | manual_review | keep_independent |
| REL-012 | 海淀区 | 北京交通大学附属中学 | 北京交通大学附属中学东校区 | campus | main_campus | keep_independent |
| REL-013 | 海淀区 | 北京交通大学附属中学 | 北京交通大学附属中学分校 | branch_school | main_branch | keep_independent |
| REL-014 | 海淀区 | 北京交通大学附属中学 | 北京交通大学附属中学第二分校 | branch_school | main_branch | keep_independent |
| REL-015 | 海淀区 | 北京交通大学附属中学分校 | 北京交通大学附属中学东校区 | campus | main_campus | keep_independent |
| REL-016 | 海淀区 | 北京交通大学附属中学第二分校 | 北京交通大学附属中学分校 | branch_school | main_branch | keep_independent |
| REL-017 | 海淀区 | 北京大学附属中学 | 北京大学附属中学北医分校 | branch_school | main_branch | keep_independent |
| REL-018 | 海淀区 | 北京市中关村中学 | 北京市中关村中学知春分校 | branch_school | main_branch | keep_independent |
| REL-019 | 海淀区 | 北京市八一学校 | 北京市八一学校附属玉泉中学 | unknown | manual_review | keep_independent |
| REL-020 | 海淀区 | 北京市第五十七中学 | 北京市第五十七中学上庄分校 | branch_school | main_branch | keep_independent |
| REL-021 | 海淀区 | 北京市第十九中学 | 北京市第十九中学闵庄校区 | campus | main_campus | keep_independent |
| REL-022 | 海淀区 | 北京市育英学校 | 北京市育英学校航天校区 | campus | main_campus | keep_independent |
| REL-023 | 通州区 | 北京市通州区潞河中学 | 北京市通州区潞河中学于家务校区 | campus | main_campus | keep_independent |
| REL-024 | 通州区 | 北京市通州区运河中学 | 北京市通州区运河中学东校区 | campus | main_campus | keep_independent |
