
const collegeAdmissionGroups = require("../../data/college-admission-groups.js");
const majorCatalogStatus = require("../../data/major-catalog-status.js");
const { getFirstlookMajors } = require("../../data/college-major-firstlook.js");

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function subjectRequirementText(group) {
  const requirement = group.subjectRequirement || {};
  if (requirement.raw) return requirement.raw;
  if (requirement.mode === "unlimited") return "\u4e0d\u9650";
  return (requirement.subjects || []).join(" + ") || "\u5f85\u6838\u5bf9";
}

function isSubjectMatched(group, subjectCombination) {
  const requirement = group.subjectRequirement || {};
  const raw = requirement.raw || "";
  const requiredSubjects = requirement.subjects || [];
  if (requirement.mode === "unlimited" || raw === "\u4e0d\u9650" || requiredSubjects.indexOf("\u4e0d\u9650") >= 0) return true;
  if (!subjectCombination || !subjectCombination.subjects) return false;
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
      min: Math.max(1, Math.round(minRank * 0.52)),
      max: Math.round(minRank * 0.99),
    };
  }
  if (level === "稳") {
    return {
      min: Math.max(1, Math.round(minRank * 0.9)),
      max: Math.round(maxRank * 1.18 + span * 0.12),
    };
  }
  return {
    min: Math.max(1, Math.round(maxRank * 1.03)),
    max: Math.round(maxRank * 2.2 + span * 0.25),
  };
}

function levelTitle(level) {
  if (level === "冲") return "冲刺层";
  if (level === "稳") return "稳妥层";
  return "保底层";
}

function levelTone(level) {
  if (level === "冲") return "录取位次高于当前定位，适合少量冲刺。";
  if (level === "稳") return "与当前定位区间接近，是优先精筛对象。";
  return "录取位次低于当前定位，用来拉开保底梯度。";
}

function groupReason(level, group) {
  const rankText = formatNumber(group.minRank);
  if (level === "冲") return `2025 投档位次 ${rankText}，高于当前定位区间，适合放在冲刺层观察。`;
  if (level === "稳") return `2025 投档位次 ${rankText}，与当前定位区间重叠度较高，适合重点比较专业组。`;
  return `2025 投档位次 ${rankText}，低于当前定位区间，适合作为保底梯度候选。`;
}

function subjectReason(group, subjectCombination) {
  const label = subjectCombination && subjectCombination.label ? subjectCombination.label : "当前选科";
  return `已按 ${label} 初步匹配该专业组的选科要求：${subjectRequirementText(group)}。`;
}

function majorReason(majorInfo) {
  return `${majorInfo.sourceLabel}，先用于家长和孩子做第一轮方向筛选。`;
}

function makeRecommendation(level, group, subjectCombination) {
  const majorInfo = getFirstlookMajors(group, 5);
  return {
    id: `${level}-${group.collegeCode}-${group.groupCode}`,
    level,
    collegeCode: group.collegeCode,
    collegeName: group.collegeName,
    groupName: `${group.groupCode}组`,
    subjectRequirement: subjectRequirementText(group),
    minScore: group.minScore,
    minRank: group.minRank,
    minRankText: formatNumber(group.minRank),
    recommendedMajors: majorInfo.majors,
    sourceLabel: majorInfo.sourceLabel,
    reasonLines: [
      groupReason(level, group),
      subjectReason(group, subjectCombination),
      majorReason(majorInfo),
    ],
    riskText: "本结果用于初筛，最终以当年官方招生目录、院校专业组要求和学校体检限制为准。",
  };
}

function groupPriority(group, level, minRank, maxRank) {
  const target = targetRankForLevel(level, minRank, maxRank);
  let score = Math.abs((group.minRank || 0) - target);
  const raw = group.subjectRequirement && group.subjectRequirement.raw ? group.subjectRequirement.raw : "";
  if (raw.indexOf("中外合办") >= 0) score += 1800;
  if (raw.indexOf("女") >= 0) score += 2500;
  return score;
}

function pickLevelItems(candidates, level, minRank, maxRank, globalUsedColleges) {
  const picked = [];
  const localUsed = {};
  const sorted = candidates
    .slice()
    .sort((a, b) => groupPriority(a, level, minRank, maxRank) - groupPriority(b, level, minRank, maxRank));

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
  return picked;
}

function buildRecommendations(payload) {
  const result = payload && payload.result ? payload.result : {};
  const input = payload && payload.input ? payload.input : {};
  const minRank = result.minRank || null;
  const maxRank = result.maxRank || null;
  const subjectCombination = input.subjectCombination || null;

  const baseSections = ["冲", "稳", "保"].map((level) => ({
    level,
    title: levelTitle(level),
    summary: levelTone(level),
    items: [],
    emptyText: "当前输入下暂未匹配到足够院校，可返回调整选科或补充分数后再试。",
  }));

  if (!minRank || !maxRank || !subjectCombination || !subjectCombination.subjects) return baseSections;

  const buckets = { "冲": [], "稳": [], "保": [] };
  collegeAdmissionGroups.forEach((group) => {
    if (!group.minRank || !isSubjectMatched(group, subjectCombination)) return;
    ["冲", "稳", "保"].forEach((level) => {
      const window = rankWindowForLevel(level, minRank, maxRank);
      if (group.minRank >= window.min && group.minRank <= window.max) {
        buckets[level].push(group);
      }
    });
  });

  const globalUsedColleges = {};
  return baseSections.map((section) => {
    const selected = pickLevelItems(buckets[section.level], section.level, minRank, maxRank, globalUsedColleges);
    return Object.assign({}, section, {
      items: selected.map((group) => makeRecommendation(section.level, group, subjectCombination)),
      emptyText: "当前官方投档线种子数据里这一档不足 3 所，后续扩展院校库后会继续补齐。",
    });
  });
}

Page({
  data: {
    hasResult: false,
    payload: null,
    recommendations: [],
    subjectCombinationLabel: "",
    majorCatalogStatusText: majorCatalogStatus.userFacingStatus,
  },

  onLoad() {
    let payload = null;
    try {
      payload = wx.getStorageSync("latestPositionResult");
    } catch (error) {
      payload = null;
    }

    if (!payload || !payload.result) {
      this.setData({ hasResult: false });
      return;
    }

    this.setData({
      hasResult: true,
      payload,
      subjectCombinationLabel: payload.input && payload.input.subjectCombination ? payload.input.subjectCombination.label : "\u672a\u9009\u62e9\u9009\u79d1",
      recommendations: buildRecommendations(payload),
    });
  },

  handleBackResult() {
    wx.navigateBack({ delta: 1 });
  },
});
