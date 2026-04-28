
const collegeAdmissionGroups = require("../../data/college-admission-groups.js");

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

function classifyGroup(group, minRank, maxRank) {
  const rank = group.minRank;
  if (!rank) return null;
  if (rank >= Math.round(minRank * 0.72) && rank <= Math.round(minRank * 1.03)) return "\u51b2";
  if (rank >= Math.round(minRank * 0.95) && rank <= Math.round(maxRank * 1.12)) return "\u7a33";
  if (rank >= Math.round(maxRank * 1.02) && rank <= Math.round(maxRank * 1.75)) return "\u4fdd";
  return null;
}

function groupReason(level, group, result) {
  const rankText = formatNumber(group.minRank);
  if (level === "\u51b2") return `2025 \u6295\u6863\u4f4d\u6b21 ${rankText}\uff0c\u9ad8\u4e8e\u5f53\u524d\u5b9a\u4f4d\u533a\u95f4\uff0c\u9002\u5408\u4f5c\u4e3a\u5c0f\u6bd4\u4f8b\u51b2\u523a\u3002`;
  if (level === "\u7a33") return `2025 \u6295\u6863\u4f4d\u6b21 ${rankText}\uff0c\u4e0e\u5f53\u524d\u5b9a\u4f4d\u533a\u95f4\u91cd\u53e0\u5ea6\u8f83\u9ad8\uff0c\u662f\u540e\u7eed\u7cbe\u7b5b\u7684\u91cd\u70b9\u3002`;
  return `2025 \u6295\u6863\u4f4d\u6b21 ${rankText}\uff0c\u4f4e\u4e8e\u5f53\u524d\u5b9a\u4f4d\u533a\u95f4\uff0c\u7528\u4e8e\u62c9\u5f00\u4fdd\u5e95\u68af\u5ea6\u3002`;
}

function buildRecommendations(payload) {
  const result = payload && payload.result ? payload.result : {};
  const input = payload && payload.input ? payload.input : {};
  const minRank = result.minRank || null;
  const maxRank = result.maxRank || null;
  const subjectCombination = input.subjectCombination || null;

  if (!minRank || !maxRank) return [];

  const buckets = { "\u51b2": [], "\u7a33": [], "\u4fdd": [] };
  collegeAdmissionGroups.forEach((group) => {
    if (!group.minRank || !isSubjectMatched(group, subjectCombination)) return;
    const level = classifyGroup(group, minRank, maxRank);
    if (!level) return;
    buckets[level].push(group);
  });

  return ["\u51b2", "\u7a33", "\u4fdd"].map((level) => {
    const items = buckets[level]
      .sort((a, b) => Math.abs((a.minRank || 0) - (level === "\u51b2" ? minRank : level === "\u7a33" ? Math.round((minRank + maxRank) / 2) : maxRank)) - Math.abs((b.minRank || 0) - (level === "\u51b2" ? minRank : level === "\u7a33" ? Math.round((minRank + maxRank) / 2) : maxRank)))
      .slice(0, 4)
      .map((group) => ({
        id: `${group.collegeCode}-${group.groupCode}`,
        level,
        collegeName: group.collegeName,
        groupName: `${group.groupCode}\u7ec4`,
        subjectRequirement: subjectRequirementText(group),
        minScore: group.minScore,
        minRankText: formatNumber(group.minRank),
        reason: groupReason(level, group, result),
        riskText: "\u5df2\u6309\u9009\u79d1\u521d\u6b65\u5339\u914d\uff1b\u4e13\u4e1a\u660e\u7ec6\u3001\u4f53\u68c0\u548c\u8272\u5f31\u9650\u5236\u9700\u7ed3\u5408\u62db\u751f\u4e13\u4e1a\u76ee\u5f55\u7ee7\u7eed\u6838\u5bf9\u3002",
      }));
    return {
      level,
      title: level === "\u51b2" ? "\u51b2\u523a\u5c42" : level === "\u7a33" ? "\u7a33\u59a5\u5c42" : "\u4fdd\u5e95\u5c42",
      items,
      emptyText: "\u5f53\u524d\u5b98\u65b9\u79cd\u5b50\u6570\u636e\u91cc\u6682\u672a\u547d\u4e2d\u8fd9\u4e00\u5c42\uff0c\u540e\u7eed\u6269\u5145\u5168\u91cf\u9662\u6821\u4e13\u4e1a\u7ec4\u540e\u4f1a\u8865\u9f50\u3002",
    };
  });
}

Page({
  data: {
    hasResult: false,
    payload: null,
    recommendations: [],
    subjectCombinationLabel: "",
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
