const collegeAdmissionGroups = require("../../data/college-admission-groups.js");
const beijingLocalCollegePrograms = require("../../data/beijing-local-college-programs.js");
const beijingSchoolCoverage = require("../../data/beijing-undergraduate-school-coverage.js");
const majorCatalogStatus = require("../../data/major-catalog-status.js");
const admissionPlan2026 = require("../../data/beijing-2026-admission-plan-firstlook.js");
const verifiedMajorDetails = require("../../data/college-major-details.js");
const strengthDataset = require("../../data/beijing-major-strength-evidence.js");
const { getFirstlookMajors } = require("../../data/college-major-firstlook.js");
const {
  normalizePreference,
  buildMajorMatch,
  getStrengthEvidence,
  buildDirectionSummaries,
  collegePlatformScore,
} = require("../../utils/major-recommendation.js");

const collegeLevelMap = {};
beijingSchoolCoverage.forEach((item) => {
  if (item.name && item.collegeLevel) collegeLevelMap[item.name] = item.collegeLevel;
});
beijingLocalCollegePrograms.forEach((item) => {
  if (item.collegeName && item.collegeLevel && !collegeLevelMap[item.collegeName]) {
    collegeLevelMap[item.collegeName] = item.collegeLevel;
  }
});

function levelForCollege(name, fallback) {
  return fallback || collegeLevelMap[name] || "本科院校";
}

const targetCollegeNames = {};
verifiedMajorDetails.forEach((item) => {
  if (item.collegeName) targetCollegeNames[item.collegeName] = true;
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

const admissionPlanRecords2026 = (admissionPlan2026 && admissionPlan2026.records) || [];
const admissionPlanByCollege = {};
const admissionPlanByGroup = {};
admissionPlanRecords2026.forEach((record) => {
  if (!record || record.year !== 2026 || !record.collegeName) return;
  if (!admissionPlanByCollege[record.collegeName]) admissionPlanByCollege[record.collegeName] = [];
  admissionPlanByCollege[record.collegeName].push(record);
  const groupMatch = String(record.subjectRequirement || "").match(/(\d{2})\s*专业组/);
  if (groupMatch) {
    const key = record.collegeName + "_" + groupMatch[1];
    if (!admissionPlanByGroup[key]) admissionPlanByGroup[key] = [];
    admissionPlanByGroup[key].push(record);
  }
});

function planKey(group) {
  if (!group) return "";
  return (group.collegeName || "") + "_" + (group.groupCode || "");
}

function getOfficial2026Plans(group, limit) {
  if (!group || !admissionPlanRecords2026.length) return [];
  const exact = admissionPlanByGroup[planKey(group)] || [];
  const pool = exact.length ? exact : (admissionPlanByCollege[group.collegeName] || []);
  return pool.slice(0, limit || 5);
}

function majorNamesFromPlans(plans) {
  const seen = {};
  const result = [];
  (plans || []).forEach((plan) => {
    const name = plan.majorName || "";
    if (!name || seen[name]) return;
    seen[name] = true;
    result.push(name);
  });
  return result;
}

function sortItemsByPreferredNames(items, preferredNames, getName) {
  const preferred = {};
  (preferredNames || []).forEach((name, index) => {
    preferred[name] = index + 1;
  });
  return (items || []).slice().sort((a, b) => {
    const aName = getName(a);
    const bName = getName(b);
    const aOrder = preferred[aName] || 999;
    const bOrder = preferred[bName] || 999;
    return aOrder - bOrder;
  });
}

function buildPlanHighlights(plans, preferredNames) {
  return sortItemsByPreferredNames(plans, preferredNames, (item) => item.majorName).slice(0, 3).map((plan) => ({
    majorCode: plan.majorCode,
    majorName: plan.majorName,
    planCountText: plan.planCount === null || plan.planCount === undefined ? "以目录为准" : String(plan.planCount) + "人",
    durationYears: plan.durationYears || "-",
    tuition: plan.tuition || "-",
    foreignLanguage: plan.foreignLanguage || "-",
    subjectRequirement: plan.subjectRequirement || "以目录为准",
  }));
}

function buildVerifiedCatalogHighlights(verifiedDetail, preferredNames) {
  const majors = verifiedDetail && verifiedDetail.majors ? verifiedDetail.majors : [];
  const subjectRequirement = verifiedDetail && verifiedDetail.subjectRequirementText
    ? verifiedDetail.subjectRequirementText
    : "以目录为准";
  return sortItemsByPreferredNames(majors, preferredNames, (item) => item.majorName).slice(0, 3).map((major) => ({
    majorCode: major.majorCode,
    majorName: major.majorName,
    planCountText: major.planCount === null || major.planCount === undefined ? "以目录为准" : String(major.planCount) + "人",
    durationYears: major.duration || "-",
    tuition: major.tuition === 0 ? "免收学费" : (major.tuition ? String(major.tuition) + "元/年" : "-"),
    foreignLanguage: (major.restrictionTags || []).filter((tag) => String(tag).indexOf("英语") >= 0).join("、") || "-",
    subjectRequirement,
  }));
}

function buildCoverageText() {
  const total = beijingSchoolCoverage.length;
  const withProgram = beijingSchoolCoverage.filter((item) => item.hasProgramSeed).length;
  const officialGroupColleges = {};
  collegeAdmissionGroups.forEach((item) => {
    if (item.collegeName) officialGroupColleges[item.collegeName] = true;
  });
  const officialCount = Object.keys(officialGroupColleges).length;
  const pending = total - withProgram;
  const planMeta = admissionPlan2026 && admissionPlan2026.meta ? admissionPlan2026.meta : {};
  const manualSummary = majorCatalogStatus.manualVerifiedSummary || {};
  const fullBackfillSummary = majorCatalogStatus.fullBackfillSummary || {};
  const manualText = manualSummary.verifiedGroupCount
    ? `官方 PDF 已按二本及以上口径人工核验 ${manualSummary.verifiedCollegeCount || 0}/${manualSummary.targetCollegeCount || fullBackfillSummary.targetCollegeCount || 0} 所目标院校，其中普通二本 2 所，其余 44 所为普通一本及以上层次；${manualSummary.verifiedGroupCount} 个专业组、${manualSummary.verifiedMajorCount} 条专业明细，推荐卡片命中时优先展示“2026 已核验招生专业”。`
    : "";
  const backfillText = fullBackfillSummary.locatedCollegeCount
    ? `北京本科普通批 ${fullBackfillSummary.targetCollegeCount || 46} 所二本及以上目标院校已完成页码定位；其中普通二本 2 所，其余 44 所为普通一本及以上层次；二本以下不收录。`
    : "";
  const planText = planMeta.isOfficialPlanReady
    ? `已接入北京教育考试院 2026 本科普通批专业计划 ${planMeta.recordCount} 条，覆盖目标院校 ${planMeta.coveredCollegeCount}/${planMeta.targetCollegeCount} 所。`
    : `北京教育考试院 /plan/115 结构化查询页尚未返回 2026 本科普通批计划接口；本版本使用考试院已发布的 2026 官方招生专业目录 PDF 人工核验结果，不用历史数据冒充当年专业。`;
  return `已纳入北京非民办本科院校覆盖库 ${total} 所；其中 ${officialCount} 所有官方普通批专业组投档线，${withProgram} 所已有普通批/专业方向数据，${pending} 所特殊类型或暂无普通批数据院校待官方目录继续补齐。${backfillText}${manualText}${planText}`;
}

function buildStrengthScopeText() {
  return `专业实力层采用${strengthDataset.source.shortTitle}，当前46所北京目标院校中有${strengthDataset.evidenceCollegeCount}所命中公开建设学科证据；该证据用于识别国家级优势方向，不等同于本科专业精确全国名次。`;
}

function buildAdmissionPlanStatus() {
  const meta = admissionPlan2026 && admissionPlan2026.meta ? admissionPlan2026.meta : {};
  if (meta.isOfficialPlanReady) {
    return {
      tag: "已接入",
      title: "2026 招生计划已同步",
      text: `已接入北京教育考试院 2026 本科普通批专业计划 ${meta.recordCount} 条，覆盖目标院校 ${meta.coveredCollegeCount}/${meta.targetCollegeCount} 所。推荐卡片优先展示当年专业、计划数、学制、收费与外语要求。`,
      tone: "ready",
    };
  }
  const manualSummary = majorCatalogStatus.manualVerifiedSummary || {};
  if (manualSummary.verifiedGroupCount) {
    const isManualComplete = manualSummary.pendingGroupCount === 0
      && manualSummary.targetCollegeCount
      && manualSummary.verifiedCollegeCount >= manualSummary.targetCollegeCount;
    return {
      tag: isManualComplete ? "已核验" : "核验中",
      title: isManualComplete ? "2026年官方高招目录已补充" : "2026 官方目录已人工核验并完成页码定位",
      text: isManualComplete
        ? `北京教育考试院 2026 年官方高招目录已发布，已完成人工核验 ${manualSummary.verifiedCollegeCount || 46} 所二本及以上目标院校，覆盖 ${manualSummary.verifiedGroupCount} 个专业组、${manualSummary.verifiedMajorCount} 条专业明细。推荐卡片命中已核验专业组时，优先展示当年专业、计划数、学费与选科要求。`
        : `北京教育考试院 2026 招生专业目录 PDF 已发布；当前已完成北京本科普通批 ${manualSummary.verifiedCollegeCount || 0} 所目标院校人工核验，已核验 ${manualSummary.verifiedGroupCount} 个专业组、${manualSummary.verifiedMajorCount} 条专业明细。推荐卡片命中已核验专业组时优先展示当年专业和计划数；未覆盖院校/专业组仍需以官方目录和志愿系统逐项核对。`,
      tone: isManualComplete ? "ready" : "partial",
    };
  }
  const candidate = meta.candidateVerification || {};
  const candidateText = candidate.dwrCandidateCount
    ? `已复核隐藏候选 ${candidate.dwrCandidateCount} 个，暂未返回北京本科普通批学校/专业计划行。`
    : "暂未发现可验证的隐藏候选招生计划行。";
  return {
    tag: "待核验",
    title: "2026 招生目录待核验",
    text: `北京教育考试院 2026 招生专业目录接入通道已就绪，但当前未读取到可发布的人工核验专业明细。${candidateText} 本页仅用于开发校验；正式上线前会继续阻断，避免给家长展示未核验数据。`,
    tone: "pending",
  };
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function subjectRequirementText(group) {
  const requirement = group.subjectRequirement || {};
  if (requirement.raw) return requirement.raw;
  if (requirement.mode === "unlimited") return "不限";
  return (requirement.subjects || []).join(" + ") || "待核对";
}

function hasSelectedSubject(subjectCombination) {
  return !!(subjectCombination && subjectCombination.subjects && subjectCombination.subjects.length > 0);
}

function isSubjectMatched(group, subjectCombination) {
  const requirement = group.subjectRequirement || {};
  const raw = requirement.raw || "";
  const requiredSubjects = requirement.subjects || [];
  if (!hasSelectedSubject(subjectCombination)) return true;
  if (requirement.mode === "unlimited" || raw.indexOf("不限") >= 0 || requiredSubjects.indexOf("不限") >= 0) return true;
  return requiredSubjects.every((subject) => subjectCombination.subjects.indexOf(subject) >= 0);
}

function targetRankForLevel(level, minRank, maxRank) {
  if (level === "冲") return Math.max(1, Math.round(minRank * 0.88));
  if (level === "稳") return Math.round((minRank + maxRank) / 2);
  return Math.round(maxRank * 1.2);
}

function rankWindowForLevel(level, minRank, maxRank) {
  const span = Math.max(1200, maxRank - minRank);
  if (level === "冲") {
    return {
      min: Math.max(1, Math.round(minRank * 0.25)),
      max: Math.max(Math.round(minRank * 0.99), minRank - 1),
    };
  }
  if (level === "稳") {
    return {
      min: Math.max(1, Math.round(minRank * 0.9)),
      max: Math.round(maxRank * 1.18 + span * 0.12),
    };
  }
  return {
    min: Math.max(1, Math.round(maxRank * 0.98)),
    max: Math.round(maxRank * 2.2 + span * 0.25),
  };
}

function levelTitle(level) {
  if (level === "冲") return "冲刺层";
  if (level === "稳") return "稳妥层";
  return "保底层";
}

function levelTone(level) {
  if (level === "冲") return "略高于当前定位，用于保留上探空间。";
  if (level === "稳") return "与当前定位接近，是优先精筛的学校池。";
  return "低于当前定位，用来拉开安全边界。";
}

function groupReason(level, group) {
  const rankText = formatNumber(group.minRank);
  if (level === "冲") return `历史投档位次 ${rankText}，高于当前定位，适合少量冲刺。`;
  if (level === "稳") return `历史投档位次 ${rankText}，与当前定位区间接近，适合重点比较专业组。`;
  return `历史投档位次 ${rankText}，低于当前定位，适合作为保底梯度候选。`;
}

function subjectReason(group, subjectCombination) {
  if (!hasSelectedSubject(subjectCombination)) {
    return "当前未选择选科，已按宽松口径纳入候选；补充选科后会进一步过滤专业组。";
  }
  const label = subjectCombination && subjectCombination.label ? subjectCombination.label : "当前选科";
  return `已按 ${label} 初步匹配该组的选科要求：${subjectRequirementText(group)}。`;
}

function levelReason(group) {
  return `${levelForCollege(group.collegeName, group.collegeLevel)}层次，纳入同档比较，避免只按学校名称判断。`;
}

function majorReason(majorInfo) {
  if (majorInfo.hasOfficial2026Plan) {
    return `已接入北京教育考试院 2026 本科普通批招生计划，优先按当年专业、计划数、学制、收费和外语语种做精筛。`;
  }
  if (majorInfo.hasVerified2026Catalog) {
    return `已接入北京教育考试院 2026 招生专业目录人工核验数据，优先按当年专业名称、计划数和收费口径做精筛。`;
  }
  if (majorInfo.sourceLabel && majorInfo.sourceLabel.indexOf("北京教育考试院") >= 0) {
    return `${majorInfo.sourceLabel}，用于首轮专业方向判断；正式填报前仍以 2026 当年招生专业目录逐项核对。`;
  }
  return `${majorInfo.sourceLabel}，用于第一轮专业方向筛选。`;
}

function ensureMajorCount(majors, group) {
  const fallback = getFirstlookMajors(group, 5).majors;
  const seen = {};
  const result = [];
  (majors || []).concat(fallback).forEach((name) => {
    if (!name || seen[name]) return;
    seen[name] = true;
    result.push(name);
  });
  return result.slice(0, 5);
}

function verifiedMajorNames(majorInfo) {
  const detail = majorInfo && majorInfo.verifiedDetail;
  return detail && detail.majors
    ? detail.majors.map((item) => item.majorName).filter(Boolean)
    : [];
}

function prioritizeDisplayMajors(allMajorNames, fallbackMajors, majorMatch) {
  const preferred = majorMatch && majorMatch.hasMatch ? majorMatch.matchedMajors : [];
  return unique(preferred.concat(fallbackMajors || []).concat(allMajorNames || [])).slice(0, 5);
}

function normalizeCandidate(group, sourceType, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  const collegeLevel = levelForCollege(group.collegeName, group.collegeLevel || "");
  const majorInfo = getFirstlookMajors(group, 8);
  const detailMajors = verifiedMajorNames(majorInfo);
  if (sourceType === "official") {
    const official2026Plans = getOfficial2026Plans(group, 100);
    const planMajors = majorNamesFromPlans(official2026Plans);
    const allMajorNames = unique(planMajors.concat(detailMajors, group.majorNames || []));
    const majorMatch = buildMajorMatch(allMajorNames, preference);
    const strengthEvidence = getStrengthEvidence(group.collegeName, preference, majorMatch.matchedDirectionIds);
    const recommendedMajors = prioritizeDisplayMajors(allMajorNames, majorInfo.majors, majorMatch);
    const verifiedCatalogHighlights = buildVerifiedCatalogHighlights(majorInfo.verifiedDetail, majorMatch.matchedMajors);
    const hasVerified2026Catalog = !!(majorInfo.hasVerified2026Catalog && verifiedCatalogHighlights.length);
    return {
      id: `official-${group.collegeCode}-${group.groupCode}`,
      sourceType,
      collegeCode: group.collegeCode,
      collegeName: group.collegeName,
      groupName: `${group.groupCode}组`,
      collegeLevel,
      subjectRequirement: group.subjectRequirement,
      minScore: group.minScore,
      minRank: group.minRank,
      allMajorNames,
      majorMatch,
      strengthEvidence,
      recommendedMajors,
      official2026Plans,
      planHighlights: official2026Plans.length
        ? buildPlanHighlights(official2026Plans, majorMatch.matchedMajors)
        : verifiedCatalogHighlights,
      planBlockTitle: official2026Plans.length ? "2026 招生计划" : (hasVerified2026Catalog ? "2026 已核验招生专业" : "2026 招生专业"),
      hasVerified2026Catalog,
      sourceLabel: official2026Plans.length ? "北京教育考试院 2026 招生计划" : majorInfo.sourceLabel,
      riskText: official2026Plans.length
        ? "当前展示为北京教育考试院 2026 招生计划查询数据；正式填报前仍以市高招办下发的当年招生专业目录、院校招生章程和最终志愿系统为准。"
        : (hasVerified2026Catalog
          ? "当前展示为北京教育考试院 2026 官方招生专业目录人工核验数据；正式填报前仍以最终志愿系统、院校招生章程和市高招办口径为准。"
          : "当前 2026 招生专业计划尚未返回可确认记录，本结果仅用于首轮择校定位；最终以北京教育考试院当年招生专业目录、院校专业组和高校要求为准。"),
    };
  }
  const seedMajors = ensureMajorCount(group.majorNames || [], group);
  const allMajorNames = unique((group.majorNames || []).concat(detailMajors));
  const majorMatch = buildMajorMatch(allMajorNames, preference);
  const strengthEvidence = getStrengthEvidence(group.collegeName, preference, majorMatch.matchedDirectionIds);
  const recommendedMajors = prioritizeDisplayMajors(allMajorNames, seedMajors, majorMatch);
  const verifiedCatalogHighlights = buildVerifiedCatalogHighlights(majorInfo.verifiedDetail, majorMatch.matchedMajors);
  const hasVerified2026Catalog = !!(majorInfo.hasVerified2026Catalog && verifiedCatalogHighlights.length);
  return {
    id: `local-${group.id}`,
    sourceType,
    collegeCode: group.collegeCode || group.collegeName || group.id,
    collegeName: group.collegeName,
    groupName: group.groupName || "专业方向组/首轮筛选组",
    collegeLevel,
    subjectRequirement: group.subjectRequirement,
    minScore: group.minScore,
    minRank: group.minRank,
    allMajorNames,
    majorMatch,
    strengthEvidence,
    recommendedMajors,
    official2026Plans: [],
    planHighlights: verifiedCatalogHighlights,
    planBlockTitle: hasVerified2026Catalog ? "2026 已核验招生专业" : "2026 招生专业",
    hasVerified2026Catalog,
    sourceLabel: hasVerified2026Catalog ? majorInfo.sourceLabel : "本地院校专业方向库",
    riskText: hasVerified2026Catalog
      ? "当前展示为北京教育考试院 2026 官方招生专业目录人工核验数据；正式填报前仍以最终志愿系统、院校招生章程和市高招办口径为准。"
      : (group.restrictionSummary || "当前 2026 招生专业计划尚未返回可确认记录，本结果仅用于首轮择校定位；最终以北京教育考试院当年招生专业目录、院校专业组和高校要求为准。"),
  };
}

function majorPreferenceReason(group, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  if (preference.undecided) return "当前暂未确定专业方向，按均衡口径保留更宽的院校专业组范围。";
  const match = group.majorMatch || {};
  if (!match.hasMatch) {
    return `该组未直接命中当前专业优先级，作为${preference.modeLabel}下的补充比较项。`;
  }
  const direction = match.directionMatches[0];
  const majorText = match.matchedMajors.slice(0, 3).join("、");
  return `命中第 ${direction.priority} 优先方向“${direction.directionLabel}”，组内已核验专业包括 ${majorText}。`;
}

function strengthReason(group) {
  const evidence = group.strengthEvidence || {};
  if (evidence.hasDirectEvidence) {
    return `${evidence.sourceLabel}显示，该校相关建设学科包括 ${evidence.detail}。`;
  }
  if (evidence.score > 0) {
    return `${evidence.sourceLabel}列明该校为双一流建设高校；${evidence.detail}。`;
  }
  return "未用来源不明的专业名次替代权威证据，当前主要依据专业匹配和录取位次排序。";
}

function makeRecommendation(level, group, subjectCombination, preferenceValue) {
  const majorInfo = {
    majors: group.recommendedMajors || [],
    sourceLabel: group.sourceLabel,
    hasOfficial2026Plan: !!(group.official2026Plans && group.official2026Plans.length),
    hasVerified2026Catalog: !!group.hasVerified2026Catalog,
  };
  const preference = normalizePreference(preferenceValue);
  const majorMatch = group.majorMatch || { matchedMajors: [], matchedDirectionLabels: [] };
  const strengthEvidence = group.strengthEvidence || { score: 0 };
  const officialRisk = group.riskText && (group.riskText.indexOf("官方") >= 0 || group.riskText.indexOf("人工核验") >= 0)
    ? group.riskText
    : "当前 2026 招生专业计划尚未返回可确认记录，本结果仅用于首轮择校定位；最终以北京教育考试院官方当年招生专业目录、院校专业组和高校要求为准。";
  return {
    id: `${level}-${group.id}`,
    level,
    collegeCode: group.collegeCode,
    collegeName: group.collegeName,
    collegeLevel: group.collegeLevel,
    groupName: group.groupName,
    subjectRequirement: subjectRequirementText(group),
    minScore: group.minScore,
    minRank: group.minRank,
    minRankText: formatNumber(group.minRank),
    recommendedMajors: majorInfo.majors,
    matchedMajors: majorMatch.matchedMajors || [],
    matchedMajorText: (majorMatch.matchedMajors || []).slice(0, 3).join("、"),
    matchedDirectionText: (majorMatch.matchedDirectionLabels || []).join("、"),
    hasMajorMatch: !!majorMatch.hasMatch,
    majorCoverageText: majorMatch.hasMatch
      ? `该专业组共核验 ${group.allMajorNames.length} 个招生专业，其中 ${majorMatch.matchedMajors.length} 个命中当前方向。`
      : "当前专业组未直接命中已选方向。",
    hasStrengthEvidence: strengthEvidence.score > 0,
    hasDirectStrengthEvidence: !!strengthEvidence.hasDirectEvidence,
    strengthLabel: strengthEvidence.label || "",
    strengthDetail: strengthEvidence.detail || "",
    strengthSourceLabel: strengthEvidence.sourceLabel || "",
    planHighlights: group.planHighlights || [],
    planBlockTitle: group.planBlockTitle || "2026 招生专业",
    hasOfficial2026Plan: !!(group.official2026Plans && group.official2026Plans.length),
    hasVerified2026Catalog: !!group.hasVerified2026Catalog,
    hasPlanHighlights: !!(group.planHighlights && group.planHighlights.length),
    sourceLabel: majorInfo.sourceLabel,
    reasonLines: [
      majorPreferenceReason(group, preference),
      strengthReason(group),
      groupReason(level, group),
      subjectReason(group, subjectCombination),
      majorReason(majorInfo),
      levelReason(group),
    ].filter(Boolean),
    riskText: `${officialRisk} 历史投档参考对应院校专业组，不等同于目标专业录取保证。`,
  };
}

function groupPriority(group, level, minRank, maxRank, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  const target = targetRankForLevel(level, minRank, maxRank);
  const span = Math.max(1200, maxRank - minRank);
  let score = Math.abs((group.minRank || 0) - target);
  const raw = group.subjectRequirement && group.subjectRequirement.raw ? group.subjectRequirement.raw : "";
  if (raw.indexOf("中外合办") >= 0) score += 1800;
  if (raw.indexOf("女") >= 0) score += 2500;
  if (group.sourceType === "local") score += 900;
  if (!preference.undecided) {
    const hasMatch = group.majorMatch && group.majorMatch.hasMatch;
    const noMatchMultiplier = preference.mode === "major_first" ? 5 : (preference.mode === "balanced" ? 1.5 : 0.45);
    if (!hasMatch) {
      score += span * noMatchMultiplier;
    } else {
      const priorityMultiplier = preference.mode === "major_first" ? 2.2 : (preference.mode === "balanced" ? 0.7 : 0.2);
      score += Math.max(0, (group.majorMatch.bestPriority || 1) - 1) * span * priorityMultiplier;
      const strengthMultiplier = preference.mode === "major_first" ? 0.55 : (preference.mode === "balanced" ? 0.32 : 0.16);
      score -= (group.strengthEvidence ? group.strengthEvidence.score : 0) * span * strengthMultiplier;
    }
  }
  const platformMultiplier = preference.mode === "school_first" ? 260 : (preference.mode === "balanced" ? 150 : 80);
  score -= collegePlatformScore(group.collegeLevel) * platformMultiplier;
  return score;
}

function pickLevelItems(candidates, level, minRank, maxRank, globalUsedColleges, fallbackCandidates, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  const picked = [];
  const localUsed = {};
  const canUseFallback = !(preference.mode === "major_first" && !preference.undecided);
  const sorted = (candidates.length ? candidates : (canUseFallback ? fallbackCandidates : []))
    .slice()
    .sort((a, b) => groupPriority(a, level, minRank, maxRank, preference) - groupPriority(b, level, minRank, maxRank, preference));

  function tryPick(avoidGlobalDuplicate) {
    for (let i = 0; i < sorted.length && picked.length < 3; i += 1) {
      const group = sorted[i];
      if (localUsed[group.collegeCode]) continue;
      if (avoidGlobalDuplicate && globalUsedColleges[group.collegeCode]) continue;
      localUsed[group.collegeCode] = true;
      globalUsedColleges[group.collegeCode] = true;
      picked.push(group);
    }
  }

  tryPick(true);
  tryPick(false);
  if (picked.length === 0 && sorted.length > 0) picked.push(sorted[0]);
  return picked;
}

function buildCandidatePool(payload, preferenceValue) {
  const input = payload && payload.input ? payload.input : {};
  const subjectCombination = input.subjectCombination || null;
  const preference = normalizePreference(preferenceValue);
  const candidates = [];
  const officialCollegeNames = {};
  collegeAdmissionGroups.forEach((group) => {
    if (group.collegeName) officialCollegeNames[group.collegeName] = true;
    if (!targetCollegeNames[group.collegeName]) return;
    if (!group.minRank || !isSubjectMatched(group, subjectCombination)) return;
    candidates.push(normalizeCandidate(group, "official", preference));
  });
  beijingLocalCollegePrograms.forEach((group) => {
    if (officialCollegeNames[group.collegeName]) return;
    if (!targetCollegeNames[group.collegeName]) return;
    if (!group.minRank || !isSubjectMatched(group, subjectCombination)) return;
    candidates.push(normalizeCandidate(group, "local", preference));
  });
  return candidates;
}

function buildRecommendations(payload, preferenceValue, candidatePool) {
  const result = payload && payload.result ? payload.result : {};
  const input = payload && payload.input ? payload.input : {};
  const minRank = result.minRank || null;
  const maxRank = result.maxRank || null;
  const subjectCombination = input.subjectCombination || null;
  const preference = normalizePreference(preferenceValue);

  const baseSections = ["冲", "稳", "保"].map((level) => ({
    level,
    title: levelTitle(level),
    summary: levelTone(level),
    items: [],
    emptyText: "当前输入下暂未匹配到足够学校，可返回调整选科或补充模考分数后再试。",
  }));

  if (!minRank || !maxRank) return baseSections;

  const candidates = candidatePool || buildCandidatePool(payload, preference);
  const eligibleCandidates = preference.mode === "major_first" && !preference.undecided
    ? candidates.filter((group) => group.majorMatch && group.majorMatch.hasMatch)
    : candidates;

  const buckets = { "冲": [], "稳": [], "保": [] };
  eligibleCandidates.forEach((group) => {
    ["冲", "稳", "保"].forEach((level) => {
      const window = rankWindowForLevel(level, minRank, maxRank);
      if (group.minRank >= window.min && group.minRank <= window.max) {
        buckets[level].push(group);
      }
    });
  });
  if (preference.mode === "major_first" && !preference.undecided) {
    ["冲", "稳", "保"].forEach((level) => {
      if (buckets[level].length) return;
      buckets[level] = eligibleCandidates.filter((group) => {
        if (level === "冲") return group.minRank < minRank;
        if (level === "稳") return group.minRank >= minRank && group.minRank <= maxRank;
        return group.minRank > maxRank;
      });
    });
  }

  const globalUsedColleges = {};
  return baseSections.map((section) => {
    const selected = pickLevelItems(
      buckets[section.level],
      section.level,
      minRank,
      maxRank,
      globalUsedColleges,
      eligibleCandidates,
      preference,
    );
    return Object.assign({}, section, {
      items: selected.map((group) => makeRecommendation(section.level, group, subjectCombination, preference)),
      emptyText: preference.mode === "major_first" && !preference.undecided
        ? "当前位次档内未找到同时命中专业方向的北京高校专业组，可调整专业优先级或切换均衡推荐。"
        : "当前输入下这一档候选较少，建议补充选科或模考分数后再试。",
    });
  });
}

function enableShareMenu() {
  if (typeof wx !== "undefined" && wx.showShareMenu) {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage", "shareTimeline"],
    });
  }
}

Page({
  data: {
    hasResult: false,
    payload: null,
    recommendations: [],
    preference: normalizePreference(null),
    preferenceModeLabel: "均衡推荐",
    preferenceDirectionText: "暂未确定专业方向",
    hasMajorPreference: false,
    directionSummaries: [],
    subjectCombinationLabel: "",
    subjectWarningText: "",
    majorCatalogStatusText: majorCatalogStatus.userFacingStatus,
    admissionPlanStatus: buildAdmissionPlanStatus(),
    admissionPlanStatusText: buildAdmissionPlanStatus().text,
    coverageText: buildCoverageText(),
    majorStrengthScopeText: buildStrengthScopeText(),
  },

  onLoad() {
    enableShareMenu();

    let payload = null;
    let storedPreference = null;
    try {
      payload = wx.getStorageSync("latestPositionResult");
      storedPreference = wx.getStorageSync("latestMajorPreference");
    } catch (error) {
      payload = null;
      storedPreference = null;
    }

    if (!payload || !payload.result) {
      this.setData({ hasResult: false });
      return;
    }

    const preference = normalizePreference(storedPreference);
    const candidatePool = buildCandidatePool(payload, preference);
    this.setData({
      hasResult: true,
      payload,
      preference,
      preferenceModeLabel: preference.modeLabel,
      preferenceDirectionText: preference.undecided
        ? "暂未确定专业方向"
        : preference.selectedDirectionLabels.join(" → "),
      hasMajorPreference: !preference.undecided,
      directionSummaries: buildDirectionSummaries(candidatePool, preference),
      subjectCombinationLabel: payload.input && payload.input.subjectCombination ? payload.input.subjectCombination.label : "未选择选科",
      subjectWarningText: payload.input && payload.input.subjectCombination ? "" : "未选择选科，当前为宽松初筛；补充选科后匹配会更准确。",
      recommendations: buildRecommendations(payload, preference, candidatePool),
    });
  },

  onShow() {
    enableShareMenu();
  },

  onShareAppMessage() {
    return {
      title: "京考择校指南｜用校排先定位大学层次",
      path: "/pages/school-rank-entry/index",
    };
  },

  onShareTimeline() {
    return {
      title: "京考择校指南｜高考择校定位",
      query: "",
    };
  },

  handleBackResult() {
    const pages = getCurrentPages ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.redirectTo({ url: "/pages/position-result/index" });
  },

  handleAdjustMajor() {
    wx.redirectTo({ url: "/subpackages/volunteer/pages/major-preference/index" });
  },

  handleBackEntry() {
    wx.redirectTo({ url: "/pages/school-rank-entry/index" });
  },
});


