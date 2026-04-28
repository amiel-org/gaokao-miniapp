# 院校专业组库数据设计：college_admission_groups

日期：2026-04-28  
适用项目：北京高考志愿填报小程序 V1

## 1. 设计目标

`college_admission_groups` 是冲稳保推荐的核心数据表。推荐对象不再只是“学校”，而是：

> 院校 + 专业组 + 选科要求 + 录取位次 + 专业/体检限制。

这张表要承接首页选科、定位结果和冲稳保推荐页，避免只按学校名粗糙推荐。

## 2. 数据纪律

1. 投档线、最低分、院校专业组必须来自官方或可追溯权威来源。
2. 北京项目优先使用北京教育考试院官方材料。
3. AI 可以辅助抽取、清洗、校验，但不能编造事实字段。
4. 不确定内容必须留空或进入 exceptions，不硬塞进正式数据。
5. 每条记录必须保留 `source`、`version`、`updatedAt`。

## 3. 主表字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 建议格式：`year_collegeCode_groupCode` |
| `year` | number | 是 | 招生年份，例如 2025 |
| `province` | string | 是 | 省份，V1 固定北京 |
| `batch` | string | 是 | 批次，例如本科普通批 |
| `collegeCode` | string | 是 | 院校代码 |
| `collegeName` | string | 是 | 院校名称 |
| `groupCode` | string | 是 | 专业组代码 |
| `groupName` | string | 是 | 专业组展示名 |
| `subjectRequirement` | object | 是 | 选科要求 |
| `minScore` | number/null | 是 | 最低投档分 |
| `minRank` | number/null | 是 | 最低投档位次，可由官方一分一段映射得到 |
| `planCount` | number/null | 否 | 招生计划数 |
| `majors` | array | 否 | 专业明细 |
| `medicalRestrictionRisk` | array | 否 | 体检限制风险 |
| `colorWeaknessRisk` | array | 否 | 色弱/色盲限制风险 |
| `otherRestrictionRisk` | array | 否 | 外语、单科、性别等限制 |
| `source` | object | 是 | 数据来源 |
| `version` | string | 是 | 版本号，例如 `2025.official.seed.v1` |
| `updatedAt` | string | 是 | 更新时间 |
| `status` | string | 是 | `active` / `needs_review` / `deprecated` |

## 4. subjectRequirement 示例

```json
{
  "mode": "all_required",
  "subjects": ["物理", "化学"],
  "displayText": "物理＋化学",
  "matchRule": "考生选科必须同时包含物理和化学"
}
```

常见模式：

- `unlimited`：不限选科。
- `all_required`：必须同时满足列出的科目。
- `any_one`：满足其中一门即可。
- `custom`：特殊要求，必须人工复核。

## 5. majors 示例

```json
[
  {
    "majorCode": "080901",
    "majorName": "计算机科学与技术",
    "planCount": 2,
    "restrictionTags": ["色弱慎报"],
    "notes": "以当年招生专业目录为准"
  }
]
```

## 6. source 示例

```json
{
  "publisher": "北京教育考试院",
  "title": "2025年北京市高招本科普通批录取投档线",
  "url": "https://www.bjeea.cn/uploads/soft/250720/178-250H0201058.pdf",
  "retrievedAt": "2026-04-28"
}
```

## 7. 当前阶段边界

当前已经建立官方投档线种子数据：

- 来源：北京教育考试院 2025 本科普通批投档线 PDF。
- 已抽取字段：院校、专业组、选科要求、最低分。
- 最低位次：用项目内 2025 北京分数-位次映射转换。
- 尚未完成：专业明细、招生计划、体检限制、色弱/色盲限制。

因此前端可以先展示“院校专业组卡片”，但推荐解释必须提示后续还要核对专业明细和限制条件。

## 8. 专业目录结构化状态

2026-04-28 已定位北京教育考试院官方《2025普通高等学校招生专业目录》PDF：

- 附件地址：`https://www.bjeea.cn/uploads/20250613/202506131926-3.pdf`
- 本地路径：`data/raw/admissions/2025/bjeea_2025_admission_major_catalog.pdf`

已验证该 PDF 为扫描/图片型文件，直接文本抽取为空。因此当前不能把专业明细、招生计划、体检限制、色弱/色盲限制直接写入正式数据。

后续应走 OCR/人工校验管线，优先处理当前推荐卡片中命中的院校专业组，再逐步扩展全量目录。

详见：`docs/major_catalog_pipeline.md`。
