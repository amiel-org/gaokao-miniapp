# 北京公办高中候选池关系回填结果

## 1. 说明

这份结果是在候选总池基础上，将 V1 初判关系结果回填后的版本。

它的作用是：

- 标注哪些是主校
- 标注哪些是分校、校区、合作校
- 标出当前规范名（canonical_school_name）
- 为后续 school_id、short_name、aliases 生成做准备

## 2. 当前统计

- 候选总池记录数：`195`
- 已挂关系标签记录数：`39`
- 合并为校区说明：`2`
- 合并为别名：`1`

## 3. 规范名映射样例

| 区 | 当前名称 | 规范名 | entity_type | relation_type | dedup_decision |
| --- | --- | --- | --- | --- | --- |
| 东城区 | 北京市第五十中学分校 | 北京市第五十中学 | branch_school | main_branch | keep_independent |
| 丰台区 | 北京市第十中学晓月苑分校 | 北京市第十中学 | branch_school | main_branch | keep_independent |
| 丰台区 | 北京市第十八中学蒲芳学校 | 北京市第十八中学 | campus | main_campus | merge_as_campus_note |
| 大兴区 | 北京市大兴区第一中学东校区 | 北京市大兴区第一中学 | campus | main_campus | keep_independent |
| 朝阳区 | 中国传媒大学附属中学（北京中学传媒分校） | 北京中学 | co_branded_school | brand_cooperation | keep_independent |
| 朝阳区 | 北京中学科技分校 | 北京中学 | branch_school | main_branch | keep_independent |
| 朝阳区 | 北京第二外国语学院附属中学（北京中学外语分校） | 北京中学 | co_branded_school | brand_cooperation | keep_independent |
| 朝阳区 | 北京市第八十中学睿德分校 | 北京市第八十中学 | branch_school | main_branch | keep_independent |
| 朝阳区 | 北京市陈经纶中学团结湖分校 | 北京市陈经纶中学 | branch_school | main_branch | keep_independent |
| 海淀区 | 中国人民大学附属中学第二分校 | 中国人民大学附属中学 | branch_school | main_branch | keep_independent |
| 海淀区 | 中国人民大学附属中学翠微学校 | 中国人民大学附属中学 | co_branded_school | brand_cooperation | keep_independent |
| 海淀区 | 北京交通大学附属中学东校区 | 北京交通大学附属中学分校 | campus | main_campus | merge_as_campus_note |
| 海淀区 | 北京交通大学附属中学分校 | 北京交通大学附属中学第二分校 | branch_school | main_branch | merge_as_alias |
| 海淀区 | 北京大学附属中学北医分校 | 北京大学附属中学 | branch_school | main_branch | keep_independent |
| 海淀区 | 北京市中关村中学知春分校 | 北京市中关村中学 | branch_school | main_branch | keep_independent |
| 海淀区 | 北京市八一学校附属玉泉中学 | 北京市八一学校 | co_branded_school | brand_cooperation | keep_independent |
| 海淀区 | 北京市第五十七中学上庄分校 | 北京市第五十七中学 | branch_school | main_branch | keep_independent |
| 海淀区 | 北京市第十九中学闵庄校区 | 北京市第十九中学 | campus | main_campus | keep_independent |
| 海淀区 | 北京市育英学校航天校区 | 北京市育英学校 | campus | main_campus | keep_independent |
| 通州区 | 北京市通州区潞河中学于家务校区 | 北京市通州区潞河中学 | campus | main_campus | keep_independent |
| 通州区 | 北京市通州区运河中学东校区 | 北京市通州区运河中学 | campus | main_campus | keep_independent |
