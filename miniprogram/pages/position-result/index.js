function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function confidenceTone(confidence) {
  if (confidence === "高") return "tone-high";
  if (confidence === "中") return "tone-mid";
  return "tone-low";
}

function buildNextSteps(payload) {
  const confidence = payload && payload.result ? payload.result.confidence : "低";
  const score = payload && payload.input ? payload.input.score : null;
  const scoreSource = payload && payload.input ? payload.input.referenceScoreSource : "none";
  const steps = [
    "先把该区间作为定位锚点，不直接等同于最终志愿方案。",
    "下一步先确定专业方向优先级，再比较北京高校的专业实力与冲稳保梯度。",
  ];
  if (!score) {
    steps.unshift("如已有最终成绩、一模或二模，建议补充后重新测算，区间会更收敛。");
  } else if (scoreSource !== "final_exam") {
    steps.unshift("如果后续拿到最终成绩，建议优先用最终成绩再测一遍，参考会更稳。");
  }
  if (confidence !== "高") {
    steps.push("当前置信度未达高档，建议优先核对年级规模与校排口径。");
  }
  return steps;
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
    rangeDisplay: "-",
    confidenceTone: "tone-low",
    nextSteps: [],
  },

  onLoad() {
    enableShareMenu();

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

    const result = payload.result;
    const rangeDisplay = result.minRank && result.maxRank
      ? `${formatNumber(result.minRank)} - ${formatNumber(result.maxRank)}`
      : result.rankRange || "-";

    this.setData({
      hasResult: true,
      payload,
      rangeDisplay,
      confidenceTone: confidenceTone(result.confidence),
      nextSteps: buildNextSteps(payload),
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

  handleBackEntry() {
    const pages = getCurrentPages ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.redirectTo({ url: "/pages/school-rank-entry/index" });
  },

  handleNextVolunteer() {
    wx.navigateTo({ url: "/subpackages/volunteer/pages/major-preference/index" });
  },
});


