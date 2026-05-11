# college_major_details 人工核验队列

日期：2026-05-11

用途：把 OCR 草稿变成人工可核验队列。只有 `manualReview.status=verified` 的记录，才允许进入正式 seed；未核验记录不得接入前端推荐。

## 核验口径

每个专业组至少核对：

- 专业组代码和选科要求。
- 专业代码。
- 专业名称。
- 招生计划数。
- 学费/学制等备注。
- 是否不招色盲、色弱、单色识别能力异常。
- 是否存在其他体检、外语、性别、单科限制。

状态约定：

- `needs_human_confirm`：待人工核验。
- `verified`：已按官方目录图片逐项核验，可进入正式 seed。
- `rejected`：OCR/裁切不可靠，不进入正式 seed。

## 本批队列

### 2025_1027_01 北京化工大学 01组

- 页码：32
- 审核图：`output\major-catalog-review\college-blocks\p032_1027_m1.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：4
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 10 工商管理类休文科经管法)：21人
- 20 工科试验班(安德书院)：4人
- 21 工科试验班(生物制造高精尖班)：2人
- 22 (EIR)：4人

### 2025_1031_01 北京中医药大学 01组

- 页码：33
- 审核图：`output\major-catalog-review\college-blocks\p033_1031_m1.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：4
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 10 针儿推拿学五年)：14人
- 11 公共事业管理(卫生管理)：3人
- 12 法学(医药卫生)：9人
- 14 英语(中医药国际传播：6人

### 2025_1035_01 北京语言大学 01组

- 页码：34
- 审核图：`output\major-catalog-review\college-blocks\p034_1035_m1.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：6
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 10 ZEA)：6人
- 11 AAAI：6人
- 12 金融学司智金融：6人
- 13 国际经济与贸易仇智商务)：6人
- 14 外国语言文学类(英语和翻译)：14人
- 15 翻译(AI翻译实验班)：5人

### 2025_1038_02 对外经济贸易大学 02组

- 页码：34
- 审核图：`output\major-catalog-review\college-blocks\p034_1038_m2.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：0
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

### 2025_1042_01 中国石油大学(北京) 01组

- 页码：35
- 审核图：`output\major-catalog-review\college-blocks\p035_1042_m1.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：9
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 10 英语(全球能源治理)：5人
- 20 经济学类：3人
- 21 能源经济傅能源工程双学士学位)：5人
- 22 工商管理类：7人
- 23 信息管理与信息系统：5人
- 32 石油工程：8人
- 33 石油工程(阿语复合人才实验班)：5人
- 35 能源化学工程：3人
- 36 环境工程：5人

### 2025_1043_01 中国地质大学(北京) 01组

- 页码：35
- 审核图：`output\major-catalog-review\college-blocks\p035_1043_m1.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：1
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 10 工商管理：1人

### 2025_1053_01 北京第二外国语学院 01组

- 页码：37
- 审核图：`output\major-catalog-review\college-blocks\p037_1053_m1.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：6
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 10 英语：28人
- 11 英语(英语教育：52人
- 12 日语(中日人文交流)：23人
- 13 日语(智能翻译与国际传播：19人
- 14 德语(智能语言服务：23人
- 15 法语(智能语言服务：11人

### 2025_1055_02 首都经济贸易大学 02组

- 页码：38
- 审核图：`output\major-catalog-review\college-blocks\p038_1055_m1.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：2
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 20 会计学：62人
- 23 财务管理(数科与大数据双学位)：24人

### 2025_1062_02 北方工业大学 02组

- 页码：38
- 审核图：`output\major-catalog-review\college-blocks\p038_1062_m2.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：1
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 20 建筑学五年)：60人

### 2025_1076_01 北京联合大学 01组

- 页码：41
- 审核图：`output\major-catalog-review\college-blocks\p041_1076_m1.png`
- OCR 识别选科：不限选考科目
- OCR 候选专业数：1
- 核验状态：`needs_human_confirm`

待填写字段：

```json
{
  "status": "needs_human_confirm",
  "reviewer": "",
  "reviewedAt": "",
  "subjectRequirementText": "",
  "verifiedMajors": [],
  "groupRestrictionTags": [],
  "colorWeaknessRisk": "unknown",
  "hasMedicalRestriction": null,
  "reviewNotes": ""
}
```

OCR 候选，仅供对照：

- 10 特殊教育师范)：20人
