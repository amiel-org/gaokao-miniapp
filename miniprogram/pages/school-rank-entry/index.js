const schoolLibrary = require("../../data/school-library.js");
const parameterLibrary = require("../../data/school-estimation-params.js");
const rankMap = require("../../data/beijing-rank-map.js");

const districtOptions = [
  "东城区",
  "西城区",
  "朝阳区",
  "海淀区",
  "丰台区",
  "石景山区",
  "通州区",
  "大兴区",
];

const rankingBasisLabels = {
  same_track: "同类选科排名",
  full_grade: "全年级排名",
  unknown: "不确定口径",
};

function normalize(text) {
  return (text || "").replace(/\s+/g, "").toLowerCase();
}

function entityTypeLabel(entityType) {
  if (entityType === "branch_school") return "分校";
  if (entityType === "campus") return "校区";
  if (entityType === "co_branded_school") return "合作校";
  return "主校";
}

function matchReasonLabel(score) {
  if (score >= 110) return "强匹配";
  if (score >= 95) return "高匹配";
  return "可参考";
}

function scoreSchoolMatch(item, normalized) {
  const official = normalize(item.official_name);
  const shortName = normalize(item.short_name);
  const canonical = normalize(item.canonical_school_name);
  const aliases = item.aliases.map(normalize);
  const tokens = (item.search_tokens || []).map(normalize);

  if (normalized === official) return 120;
  if (normalized === shortName) return 110;
  if (normalized === canonical) return 108;
  if (aliases.includes(normalized)) return 105;
  if (tokens.includes(normalized)) return 100;
  if (official.startsWith(normalized)) return 95;
  if (shortName.startsWith(normalized)) return 92;
  if (canonical.startsWith(normalized)) return 90;
  if (aliases.some((alias) => alias.startsWith(normalized))) return 88;
  if (official.includes(normalized)) return 80;
  if (shortName.includes(normalized)) return 78;
  if (canonical.includes(normalized)) return 76;
  if (aliases.some((alias) => alias.includes(normalized))) return 74;
  if (tokens.some((token) => token.includes(normalized))) return 70;
  return 0;
}

function searchSchools(query, district) {
  const normalized = normalize(query);
  if (!normalized) return [];

  return schoolLibrary
    .filter((item) => !district || item.district === district)
    .map((item) => ({ ...item, matchScore: scoreSchoolMatch(item, normalized) }))
    .filter((item) => item.matchScore > 0)
    .map((item) => ({
      ...item,
      matchReasonLabel: matchReasonLabel(item.matchScore),
      entityTypeLabel: entityTypeLabel(item.entity_type),
    }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);
}

function confidenceLabel(score) {
  if (score >= 0.75) return "高";
  if (score >= 0.5) return "中";
  return "低";
}

function levelByRank(maxRank) {
  if (maxRank <= 1500) return "全市头部段";
  if (maxRank <= 5000) return "重点竞争段";
  if (maxRank <= 12000) return "本科强竞争段";
  if (maxRank <= 25000) return "本科主流段";
  return "需要重点拉开保底梯度";
}

function bandText(maxRank) {
  if (maxRank <= 1500) return "通常对应全市非常靠前的位置，后续更需要精细比较院校专业组与专业限制。";
  if (maxRank <= 5000) return "已经进入北京优质院校专业组的重点竞争区间，适合尽早做冲稳保分层。";
  if (maxRank <= 12000) return "处在本科志愿选择空间较大的区间，专业组冷热和选科限制会明显影响结果。";
  if (maxRank <= 25000) return "更适合先扩大可选池，再用近三年录取位次逐步收窄。";
  return "建议优先确认本科线、专业方向和保底院校，避免只看学校名称。";
}

function estimateCityRank({ school, gradeRank, gradeTotal, rankingBasis, score }) {
  const params = parameterLibrary.find((item) => item.school_id === school.school_id);
  if (!params) {
    return {
      selectedSchool: school.official_name,
      schoolShortName: school.short_name,
      district: school.district,
      entityType: entityTypeLabel(school.entity_type),
      rankRange: "-",
      minRank: null,
      maxRank: null,
      confidence: "低",
      level: "暂不能定位",
      explanation: "未命中学校参数表，当前无法估算。",
      warnings: ["学校参数缺失，不能输出有效市排名区间。"],
      parameterSnapshot: {},
    };
  }

  const percentile = gradeRank / gradeTotal;
  let confidenceScore = 0.5 + params.confidence_adjustment;
  const warnings = [];
  let explanation = "当前结果为预测区间，不等同于官方位次。";

  if (school.entity_type !== "main_school") {
    warnings.push("当前学校为分校/校区/合作校，已按更保守口径处理。");
    explanation += " " + warnings[warnings.length - 1];
  }

  const rankingWeight = (params.ranking_basis_weight || {})[rankingBasis] ?? (params.ranking_basis_weight || {}).unknown ?? 0.75;
  confidenceScore += rankingWeight - 0.75;
  if (rankingBasis === "unknown") {
    warnings.push("排名口径不明确，系统已降低置信度并放宽解释边界。");
    explanation += " 排名口径不明确，已降低置信度。";
  }

  const officialRank = score ? rankMap[String(score)] : null;
  if (score && officialRank) {
    confidenceScore += (params.score_reference_weight || 0.8) - 0.8;
  } else if (score && !officialRank) {
    warnings.push("输入分数未命中当前 2025 一分一段映射，暂按校排估算。");
  }

  if (gradeTotal < (params.min_sample_size || 80)) {
    confidenceScore -= 0.08;
    warnings.push("年级样本规模偏小，结果波动风险较高。");
    explanation += " 年级样本规模偏小，结果波动风险较高。";
  }

  confidenceScore = Math.max(0.2, Math.min(confidenceScore, 0.9));

  let min;
  let max;
  if (officialRank) {
    min = Math.max(1, Math.round(officialRank * params.range_factor_min));
    max = Math.round(officialRank * params.range_factor_max);
  } else {
    min = Math.max(1, Math.round(percentile * 10000 * params.range_factor_min));
    max = Math.round(percentile * 15000 * params.range_factor_max);
  }

  const minRank = Math.max(1, min);
  const maxRank = Math.max(minRank + 1, max);

  return {
    selectedSchool: school.official_name,
    schoolShortName: school.short_name,
    district: school.district,
    entityType: entityTypeLabel(school.entity_type),
    rankRange: `${minRank} - ${maxRank}`,
    minRank,
    maxRank,
    confidence: confidenceLabel(confidenceScore),
    confidenceScore: Math.round(confidenceScore * 100),
    level: levelByRank(maxRank),
    bandText: bandText(maxRank),
    explanation,
    warnings,
    parameterSnapshot: {
      tierCode: params.tier_code,
      tierName: params.tier_name,
      rangeFactorMin: params.range_factor_min,
      rangeFactorMax: params.range_factor_max,
      parameterStatus: params.parameter_status,
    },
  };
}

Page({
  data: {
    districtOptions,
    districtIndex: -1,
    districtLabel: "",
    schoolQuery: "",
    searchResults: [],
    selectedSchool: {},
    gradeRank: "",
    gradeTotal: "",
    rankingBasis: "same_track",
    score: "",
    estimateResult: null,
  },

  handleDistrictChange(event) {
    const index = Number(event.detail.value);
    const districtLabel = districtOptions[index] || "";
    this.setData({ districtIndex: index, districtLabel, searchResults: [], selectedSchool: {}, estimateResult: null });
    if (this.data.schoolQuery) this.setData({ searchResults: searchSchools(this.data.schoolQuery, districtLabel) });
  },

  handleSchoolQueryInput(event) {
    const schoolQuery = event.detail.value;
    this.setData({ schoolQuery, searchResults: searchSchools(schoolQuery, this.data.districtLabel), selectedSchool: {}, estimateResult: null });
  },

  handleSchoolSelect(event) {
    const item = event.currentTarget.dataset.item;
    this.setData({ selectedSchool: item, schoolQuery: item.short_name, searchResults: [], estimateResult: null });
  },

  handleGradeRankInput(event) { this.setData({ gradeRank: event.detail.value, estimateResult: null }); },
  handleGradeTotalInput(event) { this.setData({ gradeTotal: event.detail.value, estimateResult: null }); },
  handleScoreInput(event) { this.setData({ score: event.detail.value, estimateResult: null }); },
  handleRankingBasisSelect(event) { this.setData({ rankingBasis: event.currentTarget.dataset.value, estimateResult: null }); },

  handleEstimate() {
    const { districtLabel, selectedSchool, gradeRank, gradeTotal, rankingBasis, score } = this.data;
    if (!districtLabel) return wx.showToast({ title: "请先选择所在区", icon: "none" });
    if (!selectedSchool.school_id) return wx.showToast({ title: "请先选中高中", icon: "none" });
    if (!gradeRank || !gradeTotal) return wx.showToast({ title: "请补全年级排名和总人数", icon: "none" });

    const rank = Number(gradeRank);
    const total = Number(gradeTotal);
    if (rank <= 0 || total <= 0 || rank > total) return wx.showToast({ title: "校排和总人数不合理", icon: "none" });

    const numericScore = score ? Number(score) : null;
    const estimateResult = estimateCityRank({ school: selectedSchool, gradeRank: rank, gradeTotal: total, rankingBasis, score: numericScore });
    const payload = {
      source: "school_rank_entry",
      baselineYear: 2025,
      generatedAt: new Date().toISOString(),
      input: {
        district: districtLabel,
        schoolId: selectedSchool.school_id,
        schoolName: selectedSchool.official_name,
        schoolShortName: selectedSchool.short_name,
        entityType: selectedSchool.entity_type,
        entityTypeLabel: entityTypeLabel(selectedSchool.entity_type),
        gradeRank: rank,
        gradeTotal: total,
        schoolPercentile: Math.round((rank / total) * 10000) / 100,
        rankingBasis,
        rankingBasisLabel: rankingBasisLabels[rankingBasis],
        score: numericScore,
      },
      result: estimateResult,
    };

    try { wx.setStorageSync("latestPositionResult", payload); } catch (error) {}
    this.setData({ estimateResult });
    wx.navigateTo({ url: "/pages/position-result/index", fail: () => wx.showToast({ title: "结果页打开失败，已在本页显示", icon: "none" }) });
  },
});
