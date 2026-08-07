const { entityTypeLabel } = require("./school-labels.js");

let parameterLibraryCache = null;
let rankDatasetCache = null;

function getParameterLibrary() {
  if (!parameterLibraryCache) {
    parameterLibraryCache = require("../data/school-estimation-params.js");
  }
  return parameterLibraryCache;
}

function getRankDataset() {
  if (!rankDatasetCache) {
    rankDatasetCache = require("../data/beijing-rank-map-2026.js");
  }
  return rankDatasetCache;
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
  if (maxRank <= 1500) {
    return "处于全市前列，后续应重点比较院校专业组、专业约束与录取波动。";
  }
  if (maxRank <= 5000) {
    return "已进入北京优质院校专业组的重点竞争区间，适合尽早建立冲稳保梯度。";
  }
  if (maxRank <= 12000) {
    return "处于本科志愿选择空间较大的区间，专业组热度与选科限制将显著影响最终方案。";
  }
  if (maxRank <= 25000) {
    return "建议先扩大候选学校池，再结合录取位次与专业组要求逐步收窄。";
  }
  return "建议优先确认本科线、专业方向与保底边界，避免只按学校名称做判断。";
}

function buildUnavailableResult(message, warnings) {
  return {
    selectedSchool: "",
    schoolShortName: "",
    district: "",
    entityType: "-",
    rankRange: "-",
    minRank: null,
    maxRank: null,
    confidence: "低",
    confidenceScore: 0,
    level: "暂不能定位",
    bandText: "请补充有效的北京市位次、最终成绩，或完整校排信息。",
    explanation: message,
    warnings: warnings || [],
    positionSource: "unavailable",
    positionSourceLabel: "信息不足",
    dataYear: null,
    parameterSnapshot: {},
  };
}

function scoreToRankRange(score) {
  const numericScore = Number(score);
  const dataset = getRankDataset();
  const rankMap = dataset.ranks || {};
  const maxScore = dataset.meta.scoreMax;
  const mappedScore = numericScore >= maxScore ? maxScore : numericScore;
  const worstRank = rankMap[String(mappedScore)] || null;
  if (!worstRank) return null;
  const higherScoreRank = mappedScore >= maxScore ? 0 : (rankMap[String(mappedScore + 1)] || 0);
  return {
    minRank: Math.max(1, higherScoreRank + 1),
    maxRank: worstRank,
    score: numericScore,
    mappedScore,
    dataYear: dataset.meta.year,
  };
}

function buildRankResult({
  minRank,
  maxRank,
  confidenceScore,
  explanation,
  warnings,
  positionSource,
  positionSourceLabel,
  dataYear,
  school,
  parameterSnapshot,
}) {
  const low = Math.max(1, Math.min(minRank, maxRank));
  const high = Math.max(low, Math.max(minRank, maxRank));
  return {
    selectedSchool: school ? school.official_name : "",
    schoolShortName: school ? school.short_name : "",
    district: school ? school.district : "",
    entityType: school ? entityTypeLabel(school.entity_type) : "-",
    rankRange: low === high ? String(low) : `${low} - ${high}`,
    minRank: low,
    maxRank: high,
    confidence: confidenceLabel(confidenceScore),
    confidenceScore: Math.round(confidenceScore * 100),
    level: levelByRank(high),
    bandText: bandText(high),
    explanation,
    warnings: warnings || [],
    positionSource,
    positionSourceLabel,
    dataYear,
    parameterSnapshot: parameterSnapshot || {},
  };
}

function estimateFromKnownCityRank(knownCityRank) {
  const rank = Number(knownCityRank);
  if (!Number.isFinite(rank) || rank <= 0 || rank > 100000) {
    return buildUnavailableResult("北京市位次无效。", ["请输入 1 至 100000 之间的北京市官方位次。"]);
  }
  const normalizedRank = Math.round(rank);
  return buildRankResult({
    minRank: normalizedRank,
    maxRank: normalizedRank,
    confidenceScore: 1,
    explanation: "直接采用用户填写的北京市官方位次，不再经过高中或校排参数调整。",
    warnings: [],
    positionSource: "official_city_rank",
    positionSourceLabel: "北京市官方位次",
    dataYear: 2026,
    school: null,
    parameterSnapshot: {
      parameterStatus: "official_rank_direct",
    },
  });
}

function estimateFromFinalScore(score) {
  const mapped = scoreToRankRange(score);
  if (!mapped) {
    return buildUnavailableResult(
      "最终成绩未命中当前内置的一分一段数据。",
      ["建议直接填写北京市官方位次；当前不会使用高中参数修改最终成绩结果。"],
    );
  }
  return buildRankResult({
    minRank: mapped.minRank,
    maxRank: mapped.maxRank,
    confidenceScore: 0.95,
    explanation: `最终成绩 ${mapped.score} 分按北京教育考试院 2026 一分一段映射为同分位次区间，不应用高中参数。`,
    warnings: mapped.score >= 692
      ? ["官方分数分布将 692 分及以上合并统计，当前位次区间为 1 至 111。"]
      : ["同分考生只能定位到官方累计人数区间；如已知本人确切位次，请直接填写官方位次。"],
    positionSource: "final_score_official_map",
    positionSourceLabel: "最终成绩（2026 官方一分一段）",
    dataYear: 2026,
    school: null,
    parameterSnapshot: {
      parameterStatus: "score_rank_map_2026_official",
    },
  });
}

function estimateFromSchoolRank({ school, gradeRank, gradeTotal, rankingBasis, referenceScoreSource }) {
  if (!school || !school.school_id) {
    return buildUnavailableResult("未确认就读高中。", ["校排预测必须先选择高中。"]);
  }
  const rank = Number(gradeRank);
  const total = Number(gradeTotal);
  if (!Number.isFinite(rank) || !Number.isFinite(total) || rank <= 0 || total <= 0 || rank > total) {
    return buildUnavailableResult("校排或年级规模不合理。", ["校排预测需要有效的校排和年级规模。"]);
  }
  const parameterLibrary = getParameterLibrary();
  const params = parameterLibrary.find((item) => item.school_id === school.school_id);
  if (!params) {
    const unavailable = buildUnavailableResult("未命中学校参数表，当前无法估算。", ["学校参数缺失，不能输出有效市排名区间。"]);
    unavailable.selectedSchool = school.official_name;
    unavailable.schoolShortName = school.short_name;
    unavailable.district = school.district;
    unavailable.entityType = entityTypeLabel(school.entity_type);
    return unavailable;
  }

  const percentile = rank / total;
  let confidenceScore = 0.5 + params.confidence_adjustment;
  const warnings = [];
  let explanation = "当前结果由校排和年级规模估算，不等同于北京市官方位次。";

  if (school.entity_type !== "main_school") {
    warnings.push("当前学校为分校/校区/合作校，系统已采用更保守口径。");
    explanation += ` ${warnings[warnings.length - 1]}`;
  }

  const rankingWeights = params.ranking_basis_weight || {};
  const rankingWeight = rankingWeights[rankingBasis] !== undefined
    ? rankingWeights[rankingBasis]
    : (rankingWeights.unknown !== undefined ? rankingWeights.unknown : 0.75);
  confidenceScore += rankingWeight - 0.75;
  if (rankingBasis === "unknown") {
    warnings.push("校排口径尚不明确，系统已降低置信度并放宽区间边界。");
    explanation += " 校排口径不明确，已降低置信度。";
  }

  if (referenceScoreSource === "first_mock" || referenceScoreSource === "second_mock") {
    warnings.push("一模、二模原始分不直接套用高考一分一段；当前仍以校排预测为主。");
    explanation += " 模考分数仅记录为预测背景。";
  }

  if (total < (params.min_sample_size || 80)) {
    confidenceScore -= 0.08;
    warnings.push("年级规模偏小，定位区间可能波动。");
    explanation += " 年级规模偏小，定位区间可能波动。";
  }

  warnings.push("当前学校参数尚缺真实届次回测样本，校排结果统一按低置信度宽区间使用。");
  explanation += " 当前模型尚未完成真实样本回测。";
  confidenceScore = Math.max(0.2, Math.min(confidenceScore, 0.49));

  const rawMin = Math.max(1, Math.round(percentile * 10000 * params.range_factor_min));
  const rawMax = Math.round(percentile * 15000 * params.range_factor_max);
  const uncertainty = Math.max(1500, rawMax - rawMin, Math.round(rawMax * 0.35));
  const minRank = Math.max(1, rawMin - uncertainty);
  const maxRank = Math.min(70000, Math.max(minRank + 1, rawMax + uncertainty));

  return buildRankResult({
    minRank,
    maxRank,
    confidenceScore,
    explanation,
    warnings,
    positionSource: referenceScoreSource === "first_mock" || referenceScoreSource === "second_mock"
      ? "mock_school_rank_prediction"
      : "school_rank_prediction",
    positionSourceLabel: referenceScoreSource === "second_mock"
      ? "二模背景 + 校排粗略预测"
      : (referenceScoreSource === "first_mock" ? "一模背景 + 校排粗略预测" : "仅校排粗略预测"),
    dataYear: 2025,
    school,
    parameterSnapshot: {
      tierCode: params.tier_code,
      tierName: params.tier_name,
      rangeFactorMin: params.range_factor_min,
      rangeFactorMax: params.range_factor_max,
      parameterStatus: params.parameter_status,
      validationStatus: "not_ground_truth_validated",
    },
  });
}

function estimateCityRank({
  school,
  gradeRank,
  gradeTotal,
  rankingBasis,
  score,
  referenceScoreSource,
  knownCityRank,
}) {
  if (knownCityRank !== null && knownCityRank !== undefined && knownCityRank !== "") {
    return estimateFromKnownCityRank(knownCityRank);
  }
  if (referenceScoreSource === "final_exam" && score) {
    return estimateFromFinalScore(score);
  }
  return estimateFromSchoolRank({
    school,
    gradeRank,
    gradeTotal,
    rankingBasis: rankingBasis || "unknown",
    referenceScoreSource: referenceScoreSource || "none",
  });
}

module.exports = {
  confidenceLabel,
  levelByRank,
  bandText,
  scoreToRankRange,
  estimateFromKnownCityRank,
  estimateFromFinalScore,
  estimateFromSchoolRank,
  estimateCityRank,
};


