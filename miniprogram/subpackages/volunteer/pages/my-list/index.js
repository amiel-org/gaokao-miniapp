const store = require("../../utils/volunteer-list-store.js");
const { analyzeList } = require("../../utils/volunteer-list-analysis.js");
Page({
  data: { items: [], count: 0, ready: false, analysis: { counts: {}, issues: [], summary: "" } },
  onShow() { this.refresh(); },
  refresh() {
    const saved = store.readList();
    let position = null;
    try { const payload = wx.getStorageSync("latestPositionResult"); position = payload && payload.result; } catch (error) { position = null; }
    const rawAnalysis = analyzeList(saved, position);
    const analysis = Object.assign({}, rawAnalysis, { counts: [{ label: '冲', value: rawAnalysis.counts['冲'] || 0 }, { label: '匹配', value: rawAnalysis.counts['稳'] || 0 }, { label: '低位次', value: rawAnalysis.counts['保'] || 0 }] });
    const items = analysis.items.map((item, index) => Object.assign({}, item, { order: index + 1, isFirst: index === 0 }));
    this.setData({ items, count: items.length, analysis, ready: true });
  },
  handleMove(event) { const { id, direction } = event.currentTarget.dataset; store.moveItem(id, Number(direction)); this.refresh(); },
  handleRemove(event) { store.removeItem(event.currentTarget.dataset.id); this.refresh(); },
  handleDecision(event) { const { id, field, value } = event.currentTarget.dataset; store.setDecision(id, field, value); this.refresh(); },
  handleBack() { const pages = getCurrentPages ? getCurrentPages() : []; if (pages.length > 1) wx.navigateBack({ delta: 1 }); else wx.redirectTo({ url: "/pages/school-rank-entry/index" }); },
  handleCopy() {
    const text = ["我的志愿核对清单（北京地区二本及以上院校）"].concat(this.data.items.map((item) => `${item.order}. ${item.collegeName} 2026 ${item.targetGroupName}｜${item.level}档参考｜选科 ${item.subjectRequirement}｜2025 参考位次 ${item.referenceRankText}｜${item.acceptanceText}`), this.data.analysis.issues.map((issue) => `核对：${issue.title}——${issue.detail}`), ["请核对当年招生章程、专业调剂规则及北京教育考试院志愿系统。"]).join("\n");
    wx.setClipboardData({ data: text });
  },
  onShareAppMessage() { return { title: "京考择校指南｜高考择校定位", path: "/pages/school-rank-entry/index" }; },
  onShareTimeline() { return { title: "京考择校指南｜高考择校定位", query: "" }; },
});
