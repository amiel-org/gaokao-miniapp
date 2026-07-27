const {
  MODE_OPTIONS,
  majorDirections,
  normalizePreference,
} = require("../../utils/major-recommendation.js");

function enableShareMenu() {
  if (typeof wx !== "undefined" && wx.showShareMenu) {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ["shareAppMessage", "shareTimeline"],
    });
  }
}

function buildModeOptions(activeMode) {
  return MODE_OPTIONS.map((item) => Object.assign({}, item, {
    active: item.id === activeMode,
  }));
}

function buildDirectionOptions(selectedIds) {
  return majorDirections.map((item) => {
    const selectedIndex = selectedIds.indexOf(item.id);
    return Object.assign({}, item, {
      selected: selectedIndex >= 0,
      priority: selectedIndex >= 0 ? selectedIndex + 1 : 0,
      priorityText: selectedIndex >= 0 ? `优先 ${selectedIndex + 1}` : "",
    });
  });
}

Page({
  data: {
    hasResult: false,
    payload: null,
    mode: "balanced",
    modeOptions: buildModeOptions("balanced"),
    directionOptions: buildDirectionOptions([]),
    selectedDirectionIds: [],
    selectedDirectionLabels: [],
    undecided: false,
    subjectCombinationLabel: "未选择选科",
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
    this.setData({
      hasResult: true,
      payload,
      mode: preference.mode,
      modeOptions: buildModeOptions(preference.mode),
      directionOptions: buildDirectionOptions(preference.selectedDirectionIds),
      selectedDirectionIds: preference.selectedDirectionIds,
      selectedDirectionLabels: preference.selectedDirectionLabels,
      undecided: preference.undecided && !!storedPreference,
      subjectCombinationLabel: payload.input && payload.input.subjectCombination
        ? payload.input.subjectCombination.label
        : "未选择选科",
    });
  },

  onShow() {
    enableShareMenu();
  },

  handleModeTap(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!MODE_OPTIONS.some((item) => item.id === mode)) return;
    this.setData({
      mode,
      modeOptions: buildModeOptions(mode),
    });
  },

  handleDirectionTap(event) {
    const directionId = event.currentTarget.dataset.directionId;
    let selected = this.data.selectedDirectionIds.slice();
    const index = selected.indexOf(directionId);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      if (selected.length >= 3) {
        wx.showToast({ title: "最多选择三个方向", icon: "none" });
        return;
      }
      selected.push(directionId);
    }
    const selectedLabels = selected.map((id) => {
      const direction = majorDirections.find((item) => item.id === id);
      return direction ? direction.label : id;
    });
    this.setData({
      selectedDirectionIds: selected,
      selectedDirectionLabels: selectedLabels,
      directionOptions: buildDirectionOptions(selected),
      undecided: false,
    });
  },

  handleUndecidedChange(event) {
    const undecided = !!event.detail.value;
    this.setData({
      undecided,
      selectedDirectionIds: undecided ? [] : this.data.selectedDirectionIds,
      selectedDirectionLabels: undecided ? [] : this.data.selectedDirectionLabels,
      directionOptions: undecided ? buildDirectionOptions([]) : this.data.directionOptions,
      mode: undecided ? "balanced" : this.data.mode,
      modeOptions: undecided ? buildModeOptions("balanced") : this.data.modeOptions,
    });
  },

  handleSubmit() {
    if (!this.data.undecided && this.data.selectedDirectionIds.length === 0) {
      wx.showToast({ title: "请选择专业方向或勾选暂未确定", icon: "none" });
      return;
    }
    const preference = normalizePreference({
      mode: this.data.mode,
      selectedDirectionIds: this.data.selectedDirectionIds,
      undecided: this.data.undecided,
    });
    preference.updatedAt = new Date().toISOString();
    try {
      wx.setStorageSync("latestMajorPreference", preference);
    } catch (error) {
      wx.showToast({ title: "保存失败，请重试", icon: "none" });
      return;
    }
    wx.redirectTo({ url: "/subpackages/volunteer/pages/volunteer-preview/index" });
  },

  handleBackResult() {
    const pages = getCurrentPages ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.redirectTo({ url: "/pages/position-result/index" });
  },

  onShareAppMessage() {
    return {
      title: "京考择校指南｜先定专业方向，再选北京高校",
      path: "/pages/school-rank-entry/index",
    };
  },

  onShareTimeline() {
    return {
      title: "京考择校指南｜专业与院校匹配",
      query: "",
    };
  },
});
