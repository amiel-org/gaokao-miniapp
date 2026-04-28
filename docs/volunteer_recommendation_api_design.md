# 志愿推荐后端接口设计

日期：2026-04-28  
适用项目：北京高考志愿填报小程序 V1

## 1. 设计目标

后端接口要支撑完整链路：

1. 首页选择北京 3+3 选科组合。
2. 校排/分数定位接口输出北京市位次区间。
3. 冲稳保推荐接口按“院校专业组”返回候选项。
4. 院校专业组详情接口提供选科、录取、专业和限制信息。

推荐结果不应只返回位次范围，而应返回可展示给家长的学校和专业组卡片。

## 2. GET /subject-combinations

返回北京 3+3 的 20 种固定选科组合。

### Response

```json
{
  "items": [
    {
      "id": "phy_chem_bio",
      "subjects": ["物理", "化学", "生物"],
      "label": "物理 + 化学 + 生物"
    }
  ],
  "version": "beijing-3plus3-v1"
}
```

### 20 种组合

物理+化学+生物、物理+化学+政治、物理+化学+历史、物理+化学+地理、物理+生物+政治、物理+生物+历史、物理+生物+地理、物理+政治+历史、物理+政治+地理、物理+历史+地理、化学+生物+政治、化学+生物+历史、化学+生物+地理、化学+政治+历史、化学+政治+地理、化学+历史+地理、生物+政治+历史、生物+政治+地理、生物+历史+地理、政治+历史+地理。

## 3. POST /rank-estimate

把校内排名/分数转换为北京市位次区间。

### Request

```json
{
  "subjectCombinationId": "phy_chem_bio",
  "entryType": "school_rank",
  "score": 620,
  "knownRank": null,
  "schoolRank": {
    "district": "海淀区",
    "schoolId": "bj_hd_xxx",
    "schoolName": "某高中",
    "rank": 120,
    "gradeSize": 600,
    "rankScope": "grade_total"
  },
  "examContext": {
    "firstMockScore": 615,
    "secondMockScore": 620
  }
}
```

### Response

```json
{
  "requestId": "req_xxx",
  "resultId": "rank_xxx",
  "rankRange": {
    "low": 4800,
    "high": 6200,
    "displayText": "约 4800 - 6200 名"
  },
  "confidence": "medium",
  "explanations": ["基于校排、年级人数和排名口径估算"],
  "warnings": ["结果为预测区间，不等同于官方位次"],
  "dataVersion": "2025.baseline.v1"
}
```

## 4. POST /volunteer-recommendations

按位次区间和选科组合返回冲稳保推荐。

### Request

```json
{
  "rankRange": {
    "low": 4800,
    "high": 6200
  },
  "subjectCombinationId": "phy_chem_bio",
  "riskPreference": "balanced",
  "province": "北京",
  "year": 2025,
  "filters": {
    "excludeMedicalRisk": false,
    "colorWeaknessSensitive": true
  }
}
```

### Response

```json
{
  "items": [
    {
      "level": "稳",
      "collegeCode": "1025",
      "collegeName": "北京交通大学",
      "groupCode": "02",
      "groupName": "02组",
      "subjectRequirement": "物理＋化学",
      "minScore": 640,
      "minRank": 4431,
      "reason": "2025投档位次与当前定位区间重叠度较高",
      "riskTags": ["需核查具体专业体检限制"],
      "sourceVersion": "2025.official.seed.v1"
    }
  ],
  "dataCompleteness": {
    "cutoff": "official",
    "majorDetails": "pending",
    "medicalRestriction": "pending"
  }
}
```

## 5. GET /college-groups

查询院校专业组详情。

### Query

```text
GET /college-groups?year=2025&collegeCode=1025&subjectCombinationId=phy_chem_bio
```

### Response

```json
{
  "items": [
    {
      "collegeName": "北京交通大学",
      "groupCode": "02",
      "subjectRequirement": "物理＋化学",
      "minScore": 640,
      "minRank": 4431,
      "majors": [],
      "medicalRestrictionRisk": [],
      "source": {
        "publisher": "北京教育考试院"
      }
    }
  ]
}
```

## 6. 前端展示要求

冲稳保页应展示：

- 学校名。
- 专业组。
- 推荐层级：冲 / 稳 / 保。
- 2025 投档分和位次。
- 选科要求。
- 推荐理由。
- 风险提醒。

UI 不应出现“正式版”“预览层”“不是最终推荐”等开发话术。用户看到的是产品化建议，而内部边界写在文档和数据状态里。
