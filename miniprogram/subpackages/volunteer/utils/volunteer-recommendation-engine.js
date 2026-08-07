const collegeAdmissionGroups = require("../data/college-admission-groups.js");
const beijingLocalCollegePrograms = require("../data/beijing-local-college-programs.js");
const beijingSchoolCoverage = require("../data/beijing-undergraduate-school-coverage.js");
const admissionPlan2026 = require("../data/beijing-2026-admission-plan-firstlook.js");
const verifiedMajorDetails = require("../data/college-major-details.js");
const {
  normalizePreference,
  buildMajorMatch,
  getStrengthEvidence,
  collegePlatformScore,
} = require("./major-recommendation.js");

const SUBJECT_ORDER = ["物理", "化学", "生物", "思想政治", "历史", "地理"];
const LEVELS = ["冲", "稳", "保"];

const collegeLevelMap = {};
beijingSchoolCoverage.forEach((item) => {
  if (item.name && item.collegeLevel) collegeLevelMap[item.name] = item.collegeLevel;
});
beijingLocalCollegePrograms.forEach((item) => {
  if (item.collegeName && item.collegeLevel && !collegeLevelMap[item.collegeName]) {
    collegeLevelMap[item.collegeName] = item.collegeLevel;
  }
});

const officialGroupsByCollege = {};
collegeAdmissionGroups.forEach((group) => {
  if (!officialGroupsByCollege[group.collegeName]) officialGroupsByCollege[group.collegeName] = [];
  officialGroupsByCollege[group.collegeName].push(group);
});

const localGroupsByCollege = {};
beijingLocalCollegePrograms.forEach((group) => {
  if (!localGroupsByCollege[group.collegeName]) localGroupsByCollege[group.collegeName] = [];
  localGroupsByCollege[group.collegeName].push(group);
});

const admissionPlanByGroup2026 = {};
((admissionPlan2026 && admissionPlan2026.records) || []).forEach((record) => {
  if (!record || record.year !== 2026 || !record.collegeName) return;
  const groupMatch = String(record.subjectRequirement || "").match(/(\d{2})\s*专业组/);
  if (!groupMatch) return;
  const key = `${record.collegeName}_${groupMatch[1]}`;
  if (!admissionPlanByGroup2026[key]) admissionPlanByGroup2026[key] = [];
  admissionPlanByGroup2026[key].push(record);
});

function unique(values) {
  const seen = {};
  const result = [];
  (values || []).forEach((value) => {
    const text = String(value || "").trim();
    if (!text || seen[text]) return;
    seen[text] = true;
    result.push(text);
  });
  return result;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function levelForCollege(name, fallback) {
  return fallback || collegeLevelMap[name] || "本科院校";
}

function parseCatalogSubjectRequirement(text) {
  const raw = String(text || "").trim();
  if (!raw || raw.indexOf("不限") >= 0) {
    return {
      raw: raw || "不限选考科目",
      subjects: [],
      mode: "unlimited",
      displayText: "不限",
    };
  }
  const subjects = SUBJECT_ORDER.filter((subject) => raw.indexOf(subject) >= 0);
  const mode = raw.indexOf("其中一门") >= 0 || raw.indexOf("任选") >= 0
    ? "any_one"
    : "all_required";
  return {
    raw,
    subjects,
    mode,
    displayText: subjects.join(" + ") || "待核对",
  };
}

function normalizeRequirement(requirement) {
  if (typeof requirement === "string") return parseCatalogSubjectRequirement(requirement);
  const value = requirement || {};
  if (value.mode === "unlimited" || String(value.raw || "").indexOf("不限") >= 0) {
    return {
      raw: value.raw || value.displayText || "不限",
      subjects: [],
      mode: "unlimited",
      displayText: "不限",
    };
  }
  const subjects = SUBJECT_ORDER.filter((subject) => (value.subjects || []).indexOf(subject) >= 0);
  return {
    raw: value.raw || value.displayText || subjects.join(" + "),
    subjects,
    mode: value.mode || "all_required",
    displayText: subjects.join(" + ") || "待核对",
  };
}

function requirementKey(requirement) {
  const value = normalizeRequirement(requirement);
  if (value.mode === "unlimited") return "unlimited";
  return `${value.mode}:${value.subjects.join("+")}`;
}

function hasSelectedSubject(subjectCombination) {
  return !!(subjectCombination && subjectCombination.subjects && subjectCombination.subjects.length > 0);
}

function isSubjectMatched(requirementOrGroup, subjectCombination) {
  if (!hasSelectedSubject(subjectCombination)) return true;
  const source = requirementOrGroup && requirementOrGroup.subjectRequirement
    ? requirementOrGroup.subjectRequirement
    : requirementOrGroup;
  const requirement = normalizeRequirement(source);
  if (requirement.mode === "unlimited") return true;
  if (requirement.mode === "any_one") {
    return requirement.subjects.some((subject) => subjectCombination.subjects.indexOf(subject) >= 0);
  }
  return requirement.subjects.every((subject) => subjectCombination.subjects.indexOf(subject) >= 0);
}

function containsFlag(values, keyword) {
  return (values || []).some((value) => String(value || "").indexOf(keyword) >= 0);
}

function allMajorsContainFlag(detail, keyword) {
  const majors = (detail && detail.majors) || [];
  return majors.length > 0 && majors.every((major) => containsFlag(major.restrictionTags, keyword));
}

function detailSpecialSignature(detail) {
  const subjectText = String((detail && detail.subjectRequirementText) || "");
  const groupTags = (detail && detail.groupRestrictionTags) || [];
  const cooperative = subjectText.indexOf("中外合作") >= 0
    || containsFlag(groupTags, "中外合作")
    || allMajorsContainFlag(detail, "中外合作");
  const femaleOnly = containsFlag(groupTags, "只招女生") || allMajorsContainFlag(detail, "只招女生");
  return `${cooperative ? "cooperative" : "regular"}|${femaleOnly ? "female" : "all"}`;
}

function historicalSpecialSignature(group) {
  const requirement = (group && group.subjectRequirement) || {};
  const rawValues = [requirement.raw].concat(requirement.extraFlags || [], group.riskTags || []);
  const cooperative = containsFlag(rawValues, "中外合") || containsFlag(rawValues, "合作办学");
  const femaleOnly = containsFlag(rawValues, "女");
  return `${cooperative ? "cooperative" : "regular"}|${femaleOnly ? "female" : "all"}`;
}

function groupCodeText(group) {
  if (group.groupCode) return `${group.groupCode}组`;
  return group.groupName || "专业方向参考组";
}

function buildHistoricalReference(detail) {
  const collegeName = detail.collegeName;
  const officialPool = officialGroupsByCollege[collegeName] || [];
  const useOfficial = officialPool.length > 0;
  const pool = useOfficial ? officialPool : (localGroupsByCollege[collegeName] || []);
  const targetRequirement = parseCatalogSubjectRequirement(detail.subjectRequirementText);
  const targetRequirementKey = requirementKey(targetRequirement);
  const targetSignature = detailSpecialSignature(detail);
  const matches = pool.filter((group) => (
    group.minRank
    && requirementKey(group.subjectRequirement) === targetRequirementKey
    && historicalSpecialSignature(group) === targetSignature
  ));

  if (!matches.length) return null;

  const sorted = matches.slice().sort((a, b) => a.minRank - b.minRank);
  const hardest = sorted[0];
  const easiest = sorted[sorted.length - 1];
  const groupLabels = unique(sorted.map(groupCodeText));
  const rankRangeText = hardest.minRank === easiest.minRank
    ? formatNumber(hardest.minRank)
    : `${formatNumber(hardest.minRank)} - ${formatNumber(easiest.minRank)}`;
  return {
    year: 2025,
    sourceType: useOfficial ? "official" : "local",
    sourceLabel: useOfficial ? "北京教育考试院 2025 本科普通批投档线" : "2025 本地规划工作簿参考",
    mappingMethod: useOfficial
      ? (sorted.length === 1 ? "subject_semantic_unique" : "subject_semantic_multiple")
      : "local_subject_semantic",
    confidence: useOfficial ? (sorted.length === 1 ? "高" : "中") : "低",
    requirementKey: targetRequirementKey,
    specialSignature: targetSignature,
    groups: sorted,
    groupLabels,
    groupText: groupLabels.join("、"),
    hardestRank: hardest.minRank,
    easiestRank: easiest.minRank,
    anchorRank: hardest.minRank,
    anchorScore: hardest.minScore,
    rankRangeText,
    note: sorted.length === 1
      ? "同校且选科语义一致的历史组唯一命中。"
      : "同校同选科存在多个历史组，分档采用其中较高要求的投档位次。",
  };
}

function normalizeStudentProfile(input) {
  const raw = input && input.studentProfile ? input.studentProfile : {};
  const genders = ["male", "female", "unknown"];
  const colorVisions = ["normal", "color_weak", "color_blind", "monochromacy", "unknown"];
  const foreignLanguages = ["english", "other", "unknown"];
  return {
    gender: genders.indexOf(raw.gender) >= 0 ? raw.gender : "unknown",
    colorVision: colorVisions.indexOf(raw.colorVision) >= 0 ? raw.colorVision : "unknown",
    foreignLanguage: foreignLanguages.indexOf(raw.foreignLanguage) >= 0 ? raw.foreignLanguage : "unknown",
    acceptCooperative: raw.acceptCooperative === true || raw.acceptCooperative === false
      ? raw.acceptCooperative
      : null,
  };
}

function tagConflictsWithProfile(tag, profile) {
  const text = String(tag || "");
  if (profile.gender === "male" && text.indexOf("只招女生") >= 0) return true;
  if (profile.colorVision === "color_weak" && (
    text.indexOf("不招色弱") >= 0 || text.indexOf("色弱、色盲") >= 0
  )) return true;
  if (profile.colorVision === "color_blind" && (
    text.indexOf("不招色盲") >= 0 || text.indexOf("色弱、色盲") >= 0
  )) return true;
  if (profile.colorVision === "monochromacy" && (
    text.indexOf("单色识别") >= 0 || text.indexOf("不招色盲") >= 0 || text.indexOf("色弱、色盲") >= 0
  )) return true;
  if (profile.foreignLanguage === "other" && text.indexOf("只招英语") >= 0) return true;
  return false;
}

function assessRestrictions(detail, input) {
  const profile = normalizeStudentProfile(input);
  const groupTags = unique(detail.groupRestrictionTags || []);
  const cooperative = detailSpecialSignature(detail).indexOf("cooperative") === 0;
  const groupConflictTags = groupTags.filter((tag) => tagConflictsWithProfile(tag, profile));
  if (profile.acceptCooperative === false && cooperative) groupConflictTags.push("不接受中外合作办学");

  const eligibleMajors = [];
  const excludedMajors = [];
  (detail.majors || []).forEach((major) => {
    const conflicts = (major.restrictionTags || []).filter((tag) => tagConflictsWithProfile(tag, profile));
    if (groupConflictTags.length || conflicts.length) {
      excludedMajors.push({
        majorName: major.majorName,
        reasons: unique(groupConflictTags.concat(conflicts)),
      });
      return;
    }
    eligibleMajors.push(major);
  });

  return {
    profile,
    cooperative,
    hardExcluded: eligibleMajors.length === 0,
    eligibleMajors,
    excludedMajors,
    groupTags,
    displayTags: unique(groupTags.concat(
      (detail.majors || []).reduce((result, major) => result.concat(major.restrictionTags || []), []),
    )).slice(0, 5),
  };
}

function getOfficial2026Plans(detail) {
  const key = `${detail.collegeName}_${detail.groupCode}`;
  return (admissionPlanByGroup2026[key] || []).slice();
}

function majorNamesFromPlans(plans) {
  return unique((plans || []).map((plan) => plan.majorName));
}

function sortItemsByPreferredNames(items, preferredNames, getName) {
  const preferred = {};
  (preferredNames || []).forEach((name, index) => {
    preferred[name] = index + 1;
  });
  return (items || []).slice().sort((a, b) => (
    (preferred[getName(a)] || 999) - (preferred[getName(b)] || 999)
  ));
}

function buildPlanHighlightsFromPlans(plans, preferredNames) {
  return sortItemsByPreferredNames(plans, preferredNames, (item) => item.majorName).slice(0, 3).map((plan) => ({
    majorCode: plan.majorCode,
    majorName: plan.majorName,
    planCountText: plan.planCount === null || plan.planCount === undefined ? "以目录为准" : `${plan.planCount}人`,
    durationYears: plan.durationYears || "-",
    tuition: plan.tuition || "-",
    foreignLanguage: plan.foreignLanguage || "-",
    subjectRequirement: plan.subjectRequirement || "以目录为准",
    restrictionText: "",
  }));
}

function buildPlanHighlightsFromDetails(detail, majors, preferredNames) {
  const requirement = parseCatalogSubjectRequirement(detail.subjectRequirementText);
  return sortItemsByPreferredNames(majors, preferredNames, (item) => item.majorName).slice(0, 3).map((major) => ({
    majorCode: major.majorCode,
    majorName: major.majorName,
    planCountText: major.planCount === null || major.planCount === undefined ? "以目录为准" : `${major.planCount}人`,
    durationYears: major.duration || "-",
    tuition: major.tuition === 0 ? "免收学费" : (major.tuition ? `${major.tuition}元/年` : "-"),
    foreignLanguage: (major.restrictionTags || []).filter((tag) => String(tag).indexOf("英语") >= 0).join("、") || "-",
    subjectRequirement: requirement.displayText,
    restrictionText: (major.restrictionTags || []).join("、"),
  }));
}

function buildProfessionalFidelity(majors, majorMatch, preference) {
  const totalMajorCount = majors.length;
  const totalPlanCount = majors.reduce((sum, major) => sum + (Number(major.planCount) || 0), 0);
  const matchedNames = (majorMatch && majorMatch.matchedMajors) || [];
  const matched = majors.filter((major) => matchedNames.indexOf(major.majorName) >= 0);
  const matchedPlanCount = matched.reduce((sum, major) => sum + (Number(major.planCount) || 0), 0);
  const majorShare = totalMajorCount ? matched.length / totalMajorCount : 0;
  const planShare = totalPlanCount ? matchedPlanCount / totalPlanCount : majorShare;
  let band = "未评估";
  let risk = "未选择专业方向，暂不评估调剂风险";
  let score = 0;
  if (!preference.undecided && majorMatch && majorMatch.hasMatch) {
    if (planShare >= 0.8) {
      band = "高";
      risk = "目标专业计划占比较高，组内调剂偏离风险相对较低";
      score = 3;
    } else if (planShare >= 0.5) {
      band = "较高";
      risk = "目标专业计划过半，仍需核对组内其他专业";
      score = 2;
    } else if (planShare >= 0.25) {
      band = "中";
      risk = "目标专业计划占比一般，存在组内调剂偏离风险";
      score = 1;
    } else {
      band = "较低";
      risk = "目标专业计划占比较低，不能把进组等同于进目标专业";
      score = 0;
    }
  }
  return {
    band,
    score,
    risk,
    totalMajorCount,
    matchedMajorCount: matched.length,
    totalPlanCount,
    matchedPlanCount,
    majorShare,
    planShare,
    planShareText: `${Math.round(planShare * 100)}%`,
  };
}

function prioritizeDisplayMajors(allMajorNames, majorMatch) {
  const preferred = majorMatch && majorMatch.hasMatch ? majorMatch.matchedMajors : [];
  return unique(preferred.concat(allMajorNames || [])).slice(0, 5);
}

function normalizeCandidate(detail, historicalReference, preferenceValue, input) {
  const preference = normalizePreference(preferenceValue);
  const targetRequirement = parseCatalogSubjectRequirement(detail.subjectRequirementText);
  const restrictionAssessment = assessRestrictions(detail, input);
  if (restrictionAssessment.hardExcluded) return null;
  const official2026Plans = getOfficial2026Plans(detail);
  const eligibleMajors = restrictionAssessment.eligibleMajors;
  const planMajors = majorNamesFromPlans(official2026Plans);
  const detailMajors = eligibleMajors.map((major) => major.majorName);
  const allMajorNames = unique(planMajors.concat(detailMajors));
  const majorMatch = buildMajorMatch(allMajorNames, preference);
  const strengthEvidence = getStrengthEvidence(detail.collegeName, preference, majorMatch.matchedDirectionIds);
  const professionalFidelity = buildProfessionalFidelity(eligibleMajors, majorMatch, preference);
  const recommendedMajors = prioritizeDisplayMajors(allMajorNames, majorMatch);
  const planHighlights = official2026Plans.length
    ? buildPlanHighlightsFromPlans(official2026Plans, majorMatch.matchedMajors)
    : buildPlanHighlightsFromDetails(detail, eligibleMajors, majorMatch.matchedMajors);
  return {
    id: `target-2026-${detail.collegeCode}-${detail.groupCode}`,
    sourceType: historicalReference.sourceType,
    collegeCode: detail.collegeCode,
    collegeName: detail.collegeName,
    collegeLevel: levelForCollege(detail.collegeName, ""),
    targetYear: 2026,
    targetGroupCode: detail.groupCode,
    targetGroupName: `${detail.groupCode}组`,
    groupName: `${detail.groupCode}组`,
    subjectRequirement: targetRequirement,
    historicalReference,
    referenceYear: 2025,
    minScore: historicalReference.anchorScore,
    minRank: historicalReference.anchorRank,
    allMajorNames,
    majorMatch,
    strengthEvidence,
    professionalFidelity,
    restrictionAssessment,
    recommendedMajors,
    official2026Plans,
    planHighlights,
    planBlockTitle: official2026Plans.length ? "2026 招生计划" : "2026 已核验招生专业",
    hasVerified2026Catalog: true,
    sourceLabel: official2026Plans.length
      ? "北京教育考试院 2026 招生计划"
      : "北京教育考试院 2026 已核验招生专业",
    riskText: "2025 录取参考组与 2026 目标专业组已按同校、选科语义和特殊类型关联，未按相同组号直接跨年拼接。",
  };
}

function buildCandidatePool(payload, preferenceValue) {
  const input = payload && payload.input ? payload.input : {};
  const subjectCombination = input.subjectCombination || null;
  const preference = normalizePreference(preferenceValue);
  const candidates = [];
  verifiedMajorDetails.forEach((detail) => {
    if (!detail || detail.year !== 2026 || !detail.collegeName || !detail.groupCode) return;
    const targetRequirement = parseCatalogSubjectRequirement(detail.subjectRequirementText);
    if (!isSubjectMatched(targetRequirement, subjectCombination)) return;
    const historicalReference = buildHistoricalReference(detail);
    if (!historicalReference) return;
    const candidate = normalizeCandidate(detail, historicalReference, preference, input);
    if (candidate) candidates.push(candidate);
  });
  return candidates;
}

function targetRankForLevel(level, minRank, maxRank) {
  if (level === "冲") return Math.max(1, Math.round(minRank * 0.82));
  if (level === "稳") return Math.round((minRank + maxRank) / 2);
  return Math.round(maxRank * 1.25);
}

function rankWindowForLevel(level, minRank, maxRank) {
  const low = Math.max(1, Math.min(minRank, maxRank));
  const high = Math.max(low, Math.max(minRank, maxRank));
  const span = Math.max(800, high - low);
  if (level === "冲") {
    return {
      min: Math.max(1, Math.round(low * 0.45)),
      max: low - 1,
    };
  }
  if (level === "稳") {
    return { min: low, max: high };
  }
  return {
    min: high + 1,
    max: Math.round(high * 2.2 + span * 0.25),
  };
}

function levelForRank(rank, minRank, maxRank) {
  for (let i = 0; i < LEVELS.length; i += 1) {
    const level = LEVELS[i];
    const window = rankWindowForLevel(level, minRank, maxRank);
    if (rank >= window.min && rank <= window.max) return level;
  }
  return null;
}

function isRankWithinLevel(rank, level, minRank, maxRank) {
  const window = rankWindowForLevel(level, minRank, maxRank);
  return rank >= window.min && rank <= window.max;
}

function levelTitle(level) {
  if (level === "冲") return "冲刺层";
  if (level === "稳") return "稳妥层";
  return "保底层";
}

function levelTone(level) {
  if (level === "冲") return "2025 同选科历史参考高于当前定位，用于保留少量上探空间。";
  if (level === "稳") return "2025 同选科历史参考落在当前定位区间内，适合优先精筛。";
  return "2025 同选科历史参考低于当前定位，用于拉开安全边界。";
}

function majorPreferenceReason(candidate, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  if (preference.undecided) return "当前暂未确定专业方向，按均衡口径保留更宽的目标专业组范围。";
  const match = candidate.majorMatch || {};
  if (!match.hasMatch) {
    return `该 2026 目标组未直接命中当前专业优先级，作为${preference.modeLabel}下的补充比较项。`;
  }
  const direction = match.directionMatches[0];
  const majorText = match.matchedMajors.slice(0, 3).join("、");
  return `命中第 ${direction.priority} 优先方向“${direction.directionLabel}”，2026 已核验专业包括 ${majorText}。`;
}

function strengthReason(candidate) {
  const evidence = candidate.strengthEvidence || {};
  if (evidence.hasDirectEvidence) {
    return `${evidence.sourceLabel}显示，该校相关建设学科包括 ${evidence.detail}。`;
  }
  if (evidence.score > 0) {
    return `${evidence.sourceLabel}列明该校为双一流建设高校；${evidence.detail}。`;
  }
  return "未用来源不明的专业名次替代权威证据，当前主要依据专业匹配、专业计划占比和录取位次排序。";
}

function historicalReason(level, candidate) {
  const reference = candidate.historicalReference;
  const levelText = level === "冲" ? "高于" : (level === "稳" ? "落在" : "低于");
  return `2025 同选科可比组为 ${reference.groupText}，投档位次 ${reference.rankRangeText}，按较保守位次 ${formatNumber(reference.anchorRank)} 分档，${levelText}当前定位。`;
}

function subjectReason(candidate, subjectCombination) {
  const selected = subjectCombination && subjectCombination.label ? subjectCombination.label : "当前选科";
  return `已按 ${selected} 匹配 2026 目标 ${candidate.targetGroupName} 的选科要求：${candidate.subjectRequirement.displayText}。`;
}

function professionalFidelityReason(candidate, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  const fidelity = candidate.professionalFidelity;
  if (preference.undecided || !candidate.majorMatch.hasMatch) return "当前未形成目标专业计划占比，需先确定专业方向。";
  return `目标专业计划 ${fidelity.matchedPlanCount}/${fidelity.totalPlanCount} 人，占该组 ${fidelity.planShareText}；专业保真度${fidelity.band}。`;
}

function groupPriority(candidate, level, minRank, maxRank, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  const target = targetRankForLevel(level, minRank, maxRank);
  const span = Math.max(1200, maxRank - minRank);
  let score = Math.abs((candidate.minRank || 0) - target);
  if (candidate.historicalReference.sourceType === "local") score += 900;
  if (candidate.restrictionAssessment.cooperative) score += 1200;
  if (!preference.undecided) {
    const hasMatch = candidate.majorMatch && candidate.majorMatch.hasMatch;
    const noMatchMultiplier = preference.mode === "major_first" ? 5 : (preference.mode === "balanced" ? 1.5 : 0.45);
    if (!hasMatch) {
      score += span * noMatchMultiplier;
    } else {
      const priorityMultiplier = preference.mode === "major_first" ? 2.2 : (preference.mode === "balanced" ? 0.7 : 0.2);
      score += Math.max(0, (candidate.majorMatch.bestPriority || 1) - 1) * span * priorityMultiplier;
      const strengthMultiplier = preference.mode === "major_first" ? 0.55 : (preference.mode === "balanced" ? 0.32 : 0.16);
      score -= (candidate.strengthEvidence ? candidate.strengthEvidence.score : 0) * span * strengthMultiplier;
      const fidelityMultiplier = preference.mode === "major_first" ? 0.38 : (preference.mode === "balanced" ? 0.22 : 0.1);
      score -= (candidate.professionalFidelity ? candidate.professionalFidelity.score : 0) * span * fidelityMultiplier;
    }
  }
  const platformMultiplier = preference.mode === "school_first" ? 260 : (preference.mode === "balanced" ? 150 : 80);
  score -= collegePlatformScore(candidate.collegeLevel) * platformMultiplier;
  return score;
}

function pickLevelItems(candidates, level, minRank, maxRank, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  const picked = [];
  const usedColleges = {};
  candidates.slice()
    .sort((a, b) => groupPriority(a, level, minRank, maxRank, preference) - groupPriority(b, level, minRank, maxRank, preference))
    .forEach((candidate) => {
      if (picked.length >= 3 || usedColleges[candidate.collegeCode]) return;
      usedColleges[candidate.collegeCode] = true;
      picked.push(candidate);
    });
  return picked;
}

function makeRecommendation(level, candidate, subjectCombination, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  const majorMatch = candidate.majorMatch || { matchedMajors: [], matchedDirectionLabels: [] };
  const strengthEvidence = candidate.strengthEvidence || { score: 0 };
  const reference = candidate.historicalReference;
  const fidelity = candidate.professionalFidelity;
  return {
    id: `${level}-${candidate.id}`,
    level,
    collegeCode: candidate.collegeCode,
    collegeName: candidate.collegeName,
    collegeLevel: candidate.collegeLevel,
    targetYear: 2026,
    targetGroupCode: candidate.targetGroupCode,
    targetGroupName: candidate.targetGroupName,
    groupName: candidate.targetGroupName,
    subjectRequirement: candidate.subjectRequirement.displayText,
    referenceYear: 2025,
    referenceGroupText: reference.groupText,
    referenceRankText: reference.rankRangeText,
    referenceConfidence: reference.confidence,
    referenceSourceLabel: reference.sourceLabel,
    referenceMappingNote: reference.note,
    minScore: candidate.minScore,
    minRank: candidate.minRank,
    minRankText: formatNumber(candidate.minRank),
    recommendedMajors: candidate.recommendedMajors,
    matchedMajors: majorMatch.matchedMajors || [],
    matchedMajorText: (majorMatch.matchedMajors || []).slice(0, 3).join("、"),
    matchedDirectionText: (majorMatch.matchedDirectionLabels || []).join("、"),
    hasMajorMatch: !!majorMatch.hasMatch,
    majorCoverageText: majorMatch.hasMatch
      ? `2026 ${candidate.targetGroupName} 共核验 ${candidate.allMajorNames.length} 个可报专业，其中 ${majorMatch.matchedMajors.length} 个命中当前方向。`
      : "当前 2026 目标组未直接命中已选方向。",
    professionalFidelityBand: fidelity.band,
    professionalFidelityText: fidelity.risk,
    professionalPlanShareText: fidelity.planShareText,
    hasProfessionalFidelity: !preference.undecided && !!majorMatch.hasMatch,
    hasStrengthEvidence: strengthEvidence.score > 0,
    hasDirectStrengthEvidence: !!strengthEvidence.hasDirectEvidence,
    strengthLabel: strengthEvidence.label || "",
    strengthDetail: strengthEvidence.detail || "",
    strengthSourceLabel: strengthEvidence.sourceLabel || "",
    restrictionTags: candidate.restrictionAssessment.displayTags,
    hasRestrictionTags: candidate.restrictionAssessment.displayTags.length > 0,
    planHighlights: candidate.planHighlights || [],
    planBlockTitle: candidate.planBlockTitle,
    hasOfficial2026Plan: !!(candidate.official2026Plans && candidate.official2026Plans.length),
    hasVerified2026Catalog: !!candidate.hasVerified2026Catalog,
    hasPlanHighlights: !!(candidate.planHighlights && candidate.planHighlights.length),
    sourceLabel: candidate.sourceLabel,
    reasonLines: [
      majorPreferenceReason(candidate, preference),
      professionalFidelityReason(candidate, preference),
      strengthReason(candidate),
      historicalReason(level, candidate),
      subjectReason(candidate, subjectCombination),
      `${candidate.collegeLevel}层次，用于同档比较。`,
    ].filter(Boolean),
    riskText: `${candidate.riskText} ${fidelity.risk}。正式填报仍须核对院校章程和最终志愿系统。`,
  };
}

function buildRecommendations(payload, preferenceValue, candidatePool) {
  const result = payload && payload.result ? payload.result : {};
  const input = payload && payload.input ? payload.input : {};
  const minRank = result.minRank || null;
  const maxRank = result.maxRank || null;
  const subjectCombination = input.subjectCombination || null;
  const preference = normalizePreference(preferenceValue);
  const baseSections = LEVELS.map((level) => ({
    level,
    title: levelTitle(level),
    summary: levelTone(level),
    items: [],
    emptyText: "当前条件下该档没有可靠候选，不跨档补位。",
  }));
  if (!minRank || !maxRank) return baseSections;

  const candidates = candidatePool || buildCandidatePool(payload, preference);
  const eligibleCandidates = preference.mode === "major_first" && !preference.undecided
    ? candidates.filter((candidate) => candidate.majorMatch && candidate.majorMatch.hasMatch)
    : candidates;
  const buckets = { "冲": [], "稳": [], "保": [] };
  eligibleCandidates.forEach((candidate) => {
    const level = levelForRank(candidate.minRank, minRank, maxRank);
    if (level) buckets[level].push(candidate);
  });

  return baseSections.map((section) => {
    const selected = pickLevelItems(buckets[section.level], section.level, minRank, maxRank, preference);
    return Object.assign({}, section, {
      items: selected.map((candidate) => makeRecommendation(section.level, candidate, subjectCombination, preference)),
      emptyText: preference.mode === "major_first" && !preference.undecided
        ? "当前位次档内没有同时满足选科、专业方向和可靠历史映射的候选，不跨档补位。"
        : "当前条件下该档没有可靠候选，不跨档补位。",
    });
  });
}

module.exports = {
  SUBJECT_ORDER,
  LEVELS,
  parseCatalogSubjectRequirement,
  normalizeRequirement,
  requirementKey,
  isSubjectMatched,
  buildHistoricalReference,
  normalizeStudentProfile,
  assessRestrictions,
  buildProfessionalFidelity,
  buildCandidatePool,
  rankWindowForLevel,
  levelForRank,
  isRankWithinLevel,
  buildRecommendations,
};
