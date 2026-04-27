# 北京公办高中关系 V1 初判结果

## 1. 说明

这份文档是在关系判定表基础上生成的 V1 初判结果。

处理原则：

- 明显的分校，先判为 `branch_school`
- 明显的校区，先判为 `campus`
- 明显带有品牌合作特征的，先判为 `co_branded_school`
- 边界不稳的关系继续保留为 `manual_review`
- 所有记录默认先保留为独立实体，不直接并回主校

## 2. 初判统计

- 总关系数：`24`
- 已做 V1 初判：`24`
- 仍需人工复核：`0`

## 3. 明细

| review_id | 区 | 主校 | 待判定学校 | final_entity_type | final_relation_type | final_dedup_decision | review_status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REL-001 | 东城区 | 北京市第五十中学 | 北京市第五十中学分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-002 | 丰台区 | 北京市第十中学 | 北京市第十中学晓月苑分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-003 | 丰台区 | 北京市第十八中学 | 北京市第十八中学蒲芳学校 | campus | main_campus | merge_as_campus_note | v1_initial_judged |
| REL-004 | 大兴区 | 北京市大兴区第一中学 | 北京市大兴区第一中学东校区 | campus | main_campus | keep_independent | v1_initial_judged |
| REL-005 | 朝阳区 | 北京中学 | 中国传媒大学附属中学（北京中学传媒分校） | co_branded_school | brand_cooperation | keep_independent | v1_initial_judged |
| REL-006 | 朝阳区 | 北京中学 | 北京中学科技分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-007 | 朝阳区 | 北京中学 | 北京第二外国语学院附属中学（北京中学外语分校） | co_branded_school | brand_cooperation | keep_independent | v1_initial_judged |
| REL-008 | 朝阳区 | 北京市第八十中学 | 北京市第八十中学睿德分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-009 | 朝阳区 | 北京市陈经纶中学 | 北京市陈经纶中学团结湖分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-010 | 海淀区 | 中国人民大学附属中学 | 中国人民大学附属中学第二分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-011 | 海淀区 | 中国人民大学附属中学 | 中国人民大学附属中学翠微学校 | co_branded_school | brand_cooperation | keep_independent | v1_initial_judged |
| REL-012 | 海淀区 | 北京交通大学附属中学 | 北京交通大学附属中学东校区 | campus | main_campus | keep_independent | v1_initial_judged |
| REL-013 | 海淀区 | 北京交通大学附属中学 | 北京交通大学附属中学分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-014 | 海淀区 | 北京交通大学附属中学 | 北京交通大学附属中学第二分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-015 | 海淀区 | 北京交通大学附属中学分校 | 北京交通大学附属中学东校区 | campus | main_campus | merge_as_campus_note | v1_initial_judged |
| REL-016 | 海淀区 | 北京交通大学附属中学第二分校 | 北京交通大学附属中学分校 | branch_school | main_branch | merge_as_alias | v1_initial_judged |
| REL-017 | 海淀区 | 北京大学附属中学 | 北京大学附属中学北医分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-018 | 海淀区 | 北京市中关村中学 | 北京市中关村中学知春分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-019 | 海淀区 | 北京市八一学校 | 北京市八一学校附属玉泉中学 | co_branded_school | brand_cooperation | keep_independent | v1_initial_judged |
| REL-020 | 海淀区 | 北京市第五十七中学 | 北京市第五十七中学上庄分校 | branch_school | main_branch | keep_independent | v1_initial_judged |
| REL-021 | 海淀区 | 北京市第十九中学 | 北京市第十九中学闵庄校区 | campus | main_campus | keep_independent | v1_initial_judged |
| REL-022 | 海淀区 | 北京市育英学校 | 北京市育英学校航天校区 | campus | main_campus | keep_independent | v1_initial_judged |
| REL-023 | 通州区 | 北京市通州区潞河中学 | 北京市通州区潞河中学于家务校区 | campus | main_campus | keep_independent | v1_initial_judged |
| REL-024 | 通州区 | 北京市通州区运河中学 | 北京市通州区运河中学东校区 | campus | main_campus | keep_independent | v1_initial_judged |
