const { districtOptions, rankingBasisLabels, entityTypeLabel } = require("../../utils/school-labels.js");
const { searchSchools } = require("../../utils/school-search.js");
const { estimateCityRank } = require("../../utils/school-rank-estimator.js");

Page({
  data: {
    districtOptions,
    districtIndex: -1,
    districtLabel: "",
    schoolQuery: "",
    searchResults: [],
    selectedSchool: {},
    gradeRank: "",
    gradeTotal: "",
    rankingBasis: "same_track",
    score: "",
    examType: "mock_unknown",
    estimateResult: null,
  },

  handleDistrictChange(event) {
    const index = Number(event.detail.value);
    const districtLabel = districtOptions[index] || "";
    this.setData({
      districtIndex: index,
      districtLabel,
      searchResults: [],
      selectedSchool: {},
      estimateResult: null,
    });

    if (this.data.schoolQuery) {
      this.setData({
        searchResults: searchSchools(this.data.schoolQuery, districtLabel),
      });
    }
  },

  handleSchoolQueryInput(event) {
    const schoolQuery = event.detail.value;
    const searchResults = searchSchools(schoolQuery, this.data.districtLabel);
    const shouldAutoSelect = searchResults.length > 0 && searchResults[0].matchScore >= 105;

    this.setData({
      schoolQuery,
      searchResults: shouldAutoSelect ? searchResults.slice(1) : searchResults,
      selectedSchool: shouldAutoSelect ? searchResults[0] : {},
      estimateResult: null,
    });
  },

  handleSchoolSelect(event) {
    const item = event.currentTarget.dataset.item;
    this.setData({
      selectedSchool: item,
      schoolQuery: item.short_name,
      searchResults: [],
      estimateResult: null,
    });
  },

  handleGradeRankInput(event) {
    this.setData({ gradeRank: event.detail.value, estimateResult: null });
  },

  handleGradeTotalInput(event) {
    this.setData({ gradeTotal: event.detail.value, estimateResult: null });
  },

  handleScoreInput(event) {
    this.setData({ score: event.detail.value, estimateResult: null });
  },

  handleExamTypeSelect(event) {
    this.setData({
      examType: event.currentTarget.dataset.value,
      estimateResult: null,
    });
  },

  handleRankingBasisSelect(event) {
    this.setData({
      rankingBasis: event.currentTarget.dataset.value,
      estimateResult: null,
    });
  },

  buildPositionPayload({ selectedSchool, rank, total, rankingBasis, numericScore, estimateResult }) {
    return {
      source: "school_rank_entry",
      baselineYear: 2025,
      generatedAt: new Date().toISOString(),
      input: {
        district: this.data.districtLabel,
        schoolId: selectedSchool.school_id,
        schoolName: selectedSchool.official_name,
        schoolShortName: selectedSchool.short_name,
        entityType: selectedSchool.entity_type,
        entityTypeLabel: entityTypeLabel(selectedSchool.entity_type),
        gradeRank: rank,
        gradeTotal: total,
        schoolPercentile: Math.round((rank / total) * 10000) / 100,
        rankingBasis,
        rankingBasisLabel: rankingBasisLabels[rankingBasis],
        score: numericScore,
        examType: this.data.examType,
      },
      result: estimateResult,
    };
  },

  handleEstimate() {
    const { districtLabel, selectedSchool, gradeRank, gradeTotal, rankingBasis, score } = this.data;

    if (!districtLabel) {
      wx.showToast({ title: "请先选择所在区", icon: "none" });
      return;
    }

    if (!selectedSchool.school_id) {
      wx.showToast({ title: "请先选中高中", icon: "none" });
      return;
    }

    if (!gradeRank || !gradeTotal) {
      wx.showToast({ title: "请补全年级排名和总人数", icon: "none" });
      return;
    }

    const rank = Number(gradeRank);
    const total = Number(gradeTotal);
    if (rank <= 0 || total <= 0 || rank > total) {
      wx.showToast({ title: "校排和总人数不合理", icon: "none" });
      return;
    }

    const numericScore = score ? Number(score) : null;
    const estimateResult = estimateCityRank({
      school: selectedSchool,
      gradeRank: rank,
      gradeTotal: total,
      rankingBasis,
      score: numericScore,
    });

    const payload = this.buildPositionPayload({
      selectedSchool,
      rank,
      total,
      rankingBasis,
      numericScore,
      estimateResult,
    });

    try {
      wx.setStorageSync("latestPositionResult", payload);
    } catch (error) {
      // 本地缓存失败时，仍在当前页保留估算结果，避免用户完全丢失反馈。
    }

    this.setData({ estimateResult });
    wx.navigateTo({
      url: "/pages/position-result/index",
      fail: () => {
        wx.showToast({ title: "结果页打开失败，已在本页显示", icon: "none" });
      },
    });
  },
});
