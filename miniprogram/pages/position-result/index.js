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
  const steps = [
    "先把这个区间当成定位锚点，不直接当成最终志愿结论。",
    "下一步用近三年院校专业组录取位次，拆出冲、稳、保三层。",
  ];
  if (!score) steps.unshift("如果已有一模/二模分数，建议补充分数后重新测一次，区间会更收窄。");
  if (confidence !== "高") steps.push("当前置信度不是高，建议优先核对年级总人数和排名口径。");
  return steps;
}

Page({
  data: { hasResult: false, payload: null, rangeDisplay: "-", confidenceTone: "tone-low", nextSteps: [] },
  onLoad() {
    let payload = null;
    try { payload = wx.getStorageSync("latestPositionResult"); } catch (error) { payload = null; }
    if (!payload || !payload.result) return this.setData({ hasResult: false });
    const result = payload.result;
    const rangeDisplay = result.minRank && result.maxRank ? `${formatNumber(result.minRank)} - ${formatNumber(result.maxRank)}` : result.rankRange || "-";
    this.setData({ hasResult: true, payload, rangeDisplay, confidenceTone: confidenceTone(result.confidence), nextSteps: buildNextSteps(payload) });
  },
  handleBackEdit() { wx.navigateBack({ delta: 1 }); },
  handleNextVolunteer() { wx.showToast({ title: "下一步将接入院校专业组初筛", icon: "none" }); },
});
