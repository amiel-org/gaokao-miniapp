const parameterLibrary = require("../data/school-estimation-params.js");
const rankMap = require("../data/beijing-rank-map.js");
const { entityTypeLabel } = require("./school-labels.js");

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
  if (maxRank <= 1500) {
    return "通常对应全市非常靠前的位置，后续更需要精细比较院校专业组与专业限制。";
  }
  if (maxRank <= 5000) {
    return "已经进入北京优质院校专业组的重点竞争区间，适合尽早做冲稳保分层。";
  }
  if (maxRank <= 12000) {
    return "处在本科志愿选择空间较大的区间，专业组冷热和选科限制会明显影响结果。";
  }
  if (maxRank <= 25000) {
    return "更适合先扩大可选池，再用近三年录取位次逐步收窄。";
  }
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
    explanation += ` ${warnings[warnings.length - 1]}`;
  }

  const rankingWeights = params.ranking_basis_weight || {};
  const rankingWeight = rankingWeights[rankingBasis] ?? rankingWeights.unknown ?? 0.75;
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

module.exports = {
  confidenceLabel,
  levelByRank,
  bandText,
  estimateCityRank,
};
