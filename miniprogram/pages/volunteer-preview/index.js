function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function buildPreviewGroups(result) {
  const minRank = result && result.minRank ? result.minRank : null;
  const maxRank = result && result.maxRank ? result.maxRank : null;

  if (!minRank || !maxRank) {
    return [
      { type: "冲", title: "先补齐定位结果", desc: "当前没有可用位次区间，暂不能生成冲稳保预览。", range: "-" },
    ];
  }

  return [
    {
      type: "冲",
      title: "可冲院校专业组",
      desc: "优先看略高于当前区间的院校专业组，后续要重点核查选科和体检限制。",
      range: `${formatNumber(Math.max(1, Math.round(minRank * 0.75)))} - ${formatNumber(Math.round(minRank * 1.02))}`,
    },
    {
      type: "稳",
      title: "稳妥院校专业组",
      desc: "优先看与当前区间重叠度较高的院校专业组，是后续推荐页的核心区域。",
      range: `${formatNumber(Math.round(minRank * 0.95))} - ${formatNumber(Math.round(maxRank * 1.08))}`,
    },
    {
      type: "保",
      title: "保底院校专业组",
      desc: "优先看低于当前区间的院校专业组，避免只追学校名导致志愿梯度过窄。",
      range: `${formatNumber(Math.round(maxRank * 1.05))} - ${formatNumber(Math.round(maxRank * 1.45))}`,
    },
  ];
}

Page({
  data: {
    hasResult: false,
    payload: null,
    groups: [],
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
      groups: buildPreviewGroups(payload.result),
    });
  },

  handleBackResult() {
    wx.navigateBack({ delta: 1 });
  },
});
