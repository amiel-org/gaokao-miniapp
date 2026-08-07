const collegeAdmissionGroups = require("../../data/college-admission-groups.js");
const beijingSchoolCoverage = require("../../data/beijing-undergraduate-school-coverage.js");
const majorCatalogStatus = require("../../data/major-catalog-status.js");
const admissionPlan2026 = require("../../data/beijing-2026-admission-plan-firstlook.js");
const strengthDataset = require("../../data/beijing-major-strength-evidence.js");
const {
  normalizePreference,
  buildDirectionSummaries,
} = require("../../utils/major-recommendation.js");
const recommendationEngine = require("../../utils/volunteer-recommendation-engine.js");
const {
  isCurrentPositionPayload,
  removeStalePositionPayload,
} = require("../../../../utils/position-payload.js");

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
    ? `官方 PDF 已按二本及以上口径人工核验 ${manualSummary.verifiedCollegeCount || 0}/${manualSummary.targetCollegeCount || fullBackfillSummary.targetCollegeCount || 0} 所目标院校，其中普通二本 2 所，其余 44 所为普通一本及以上层次；${manualSummary.verifiedGroupCount} 个专业组、${manualSummary.verifiedMajorCount} 条专业明细。`
    : "";
  const backfillText = fullBackfillSummary.locatedCollegeCount
    ? `北京本科普通批 ${fullBackfillSummary.targetCollegeCount || 46} 所二本及以上目标院校已完成页码定位；其中普通二本 2 所，其余 44 所为普通一本及以上层次；二本以下不收录。`
    : "";
  const planText = planMeta.isOfficialPlanReady
    ? `已接入北京教育考试院 2026 本科普通批专业计划 ${planMeta.recordCount} 条，覆盖目标院校 ${planMeta.coveredCollegeCount}/${planMeta.targetCollegeCount} 所。`
    : "北京教育考试院 /plan/115 结构化查询页尚未返回 2026 本科普通批计划接口；本版本使用考试院已发布的 2026 官方招生专业目录 PDF 人工核验结果。";
  return `已纳入北京非民办本科院校覆盖库 ${total} 所；其中 ${officialCount} 所有 2025 官方普通批专业组投档线，${withProgram} 所已有普通批或专业方向数据，${pending} 所特殊类型或暂无普通批数据院校待继续补齐。${backfillText}${manualText}${planText}`;
}

function buildStrengthScopeText() {
  return `专业实力层采用${strengthDataset.source.shortTitle}，当前 46 所北京目标院校中有 ${strengthDataset.evidenceCollegeCount} 所命中公开建设学科证据；该证据用于识别国家级优势方向，不等同于本科专业精确全国名次。`;
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
      title: isManualComplete ? "2026 年官方高招目录已补充" : "2026 官方目录已人工核验并完成页码定位",
      text: isManualComplete
        ? `北京教育考试院 2026 年官方高招目录已完成人工核验 ${manualSummary.verifiedCollegeCount || 46} 所二本及以上目标院校，覆盖 ${manualSummary.verifiedGroupCount} 个专业组、${manualSummary.verifiedMajorCount} 条专业明细。`
        : `北京教育考试院 2026 招生专业目录 PDF 已发布；当前已完成 ${manualSummary.verifiedCollegeCount || 0} 所目标院校、${manualSummary.verifiedGroupCount} 个专业组、${manualSummary.verifiedMajorCount} 条专业明细人工核验。`,
      tone: isManualComplete ? "ready" : "partial",
    };
  }
  const candidate = meta.candidateVerification || {};
  const candidateText = candidate.dwrCandidateCount
    ? `已复核隐藏候选 ${candidate.dwrCandidateCount} 个，暂未返回北京本科普通批学校或专业计划行。`
    : "暂未发现可验证的隐藏候选招生计划行。";
  return {
    tag: "待核验",
    title: "2026 招生目录待核验",
    text: `北京教育考试院 2026 招生专业目录接入通道已就绪，但当前未读取到可发布的人工核验专业明细。${candidateText}`,
    tone: "pending",
  };
}

function enableShareMenu() {
  if (typeof wx !== "undefined" && wx.showShareMenu) {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage", "shareTimeline"],
    });
  }
}

function buildRestrictionWarning(payload) {
  const input = payload && payload.input ? payload.input : {};
  const profile = input.studentProfile || {};
  const missing = [];
  if (!profile.gender || profile.gender === "unknown") missing.push("性别");
  if (!profile.colorVision || profile.colorVision === "unknown") missing.push("色觉");
  if (!profile.foreignLanguage || profile.foreignLanguage === "unknown") missing.push("外语语种");
  if (profile.acceptCooperative === null || profile.acceptCooperative === undefined) missing.push("中外合作意向");
  return missing.length
    ? `${missing.join("、")}尚未确认，相关限制当前只提示、不做硬排除。`
    : "";
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
    restrictionWarningText: "",
    majorCatalogStatusText: "2026 招生专业目录已完成 46 所目标院校、292 个专业组和 1312 条专业明细人工核验；2025 投档线只用于同选科历史录取参考。",
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

    if (!isCurrentPositionPayload(payload)) {
      removeStalePositionPayload();
      this.setData({ hasResult: false });
      return;
    }

    const preference = normalizePreference(storedPreference);
    const candidatePool = recommendationEngine.buildCandidatePool(payload, preference);
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
      subjectCombinationLabel: payload.input && payload.input.subjectCombination
        ? payload.input.subjectCombination.label
        : "未选择选科",
      subjectWarningText: payload.input && payload.input.subjectCombination
        ? ""
        : "未选择选科，当前为宽松初筛；补充选科后匹配会更准确。",
      restrictionWarningText: buildRestrictionWarning(payload),
      recommendations: recommendationEngine.buildRecommendations(payload, preference, candidatePool),
    });
  },

  onShow() {
    enableShareMenu();
  },

  onShareAppMessage() {
    return {
      title: "京考择校指南｜用位次和专业方向筛选北京高校",
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
