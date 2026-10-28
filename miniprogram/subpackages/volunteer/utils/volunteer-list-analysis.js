function normalizeRank(value) {
  const match = String(value || "").replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : null;
}
function acceptanceText(value) {
  return value === "all" ? "接受组内专业" : (value === "selected" ? "仅接受意向专业" : "尚未确认");
}
function analyzeList(items, position) {
  const source = Array.isArray(items) ? items : [];
  const planning = position && (position.positionSource === "school_rank_prediction" || position.positionSource === "mock_school_rank_prediction");
  const counts = { "冲": 0, "稳": 0, "保": 0 };
  const issues = [];
  const decorated = source.map((item, index) => {
    counts[item.level] = (counts[item.level] || 0) + 1;
    const acceptance = item.majorAcceptance || "unknown";
    const risk = acceptance === "selected" ? "只接受意向专业时，不能把进入专业组等同于进入该专业；不服从调剂还需核对退档风险。" : "";
    const currentRank = normalizeRank(item.referenceRankText);
    const previousRank = index ? normalizeRank(source[index - 1].referenceRankText) : null;
    const inverted = currentRank !== null && previousRank !== null && currentRank < previousRank;
    return Object.assign({}, item, { acceptance, acceptanceText: acceptanceText(acceptance), majorRisk: risk, inverted });
  });
  if (!source.length) return { items: decorated, counts, issues, planning, ready: false, summary: "先收藏专业组，再检查志愿结构。" };
  const pending = decorated.filter((item) => item.acceptance === "unknown").length;
  if (pending) issues.push({ type: "decision", title: `${pending} 项尚未确认专业接受度`, detail: "进入专业组不等于进入意向专业，请逐项确认是否能接受组内其他专业。" });
  if (decorated.some((item) => item.acceptance === "selected")) issues.push({ type: "decision", title: "存在只接受意向专业的项目", detail: "这不等于建议不服从调剂；请结合组内专业、调剂范围和退档后果人工核对。" });
  if (decorated.some((item) => item.inverted)) issues.push({ type: "order", title: "部分相邻项目的历史位次倒置", detail: "标记项目比上一项的 2025 参考位次更靠前。若确为更喜欢它可保留，否则请检查排序。" });
  if (source.length >= 3 && counts["冲"] === source.length) issues.push({ type: "structure", title: "当前全部为冲刺参考", detail: "没有匹配或低位次参考项，不能只靠冲刺项形成完整梯度。" });
  if (source.length >= 3 && counts["保"] === 0) issues.push({ type: "structure", title: "缺少低位次参考项", detail: planning ? "当前是校排推演，不能承诺保底；请补充不同位次层次的候选，出分后重建。" : "这不代表一定落榜，但现有清单缺少梯度缓冲，请补充候选并核对多年数据。" });
  if (source.length >= 2 && counts["稳"] === 0) issues.push({ type: "structure", title: "中间层次存在空档", detail: "冲与低位次参考之间没有匹配参考项，建议回推荐池补充比较。" });
  return { items: decorated, counts, issues, planning, ready: true, summary: issues.length ? `发现 ${issues.length} 类需要人工核对的问题` : "结构检查未发现明显空档，仍须逐项核对招生章程。" };
}
module.exports = { analyzeList, acceptanceText };
