const { districtOptions, rankingBasisLabels, entityTypeLabel } = require("../../utils/school-labels.js");
const { searchSchools } = require("../../utils/school-search.js");
const { estimateCityRank } = require("../../utils/school-rank-estimator.js");
const subjectCombinations = require("../../data/subject-combinations.js");

const subjectOptions = ["物理", "化学", "生物", "思想政治", "历史", "地理"];

function getReferenceScoreLabel(source) {
  if (source === "final_exam") return "最终成绩";
  if (source === "second_mock") return "二模";
  if (source === "first_mock") return "一模";
  return "未填写";
}

function resolveReferenceScore({ scoreMode, finalExamScore, secondMockScore, firstMockScore }) {
  if (scoreMode === "after_exam") {
    if (finalExamScore) {
      return { source: "final_exam", value: Number(finalExamScore) };
    }
    return { source: "none", value: null };
  }

  if (secondMockScore) {
    return { source: "second_mock", value: Number(secondMockScore) };
  }
  if (firstMockScore) {
    return { source: "first_mock", value: Number(firstMockScore) };
  }
  if (finalExamScore) {
    return { source: "final_exam", value: Number(finalExamScore) };
  }
  return { source: "none", value: null };
}

function normalizeSubjectKey(subjects) {
  return subjectOptions.filter((subject) => subjects.indexOf(subject) >= 0).join("|");
}

function findSubjectCombination(subjects) {
  const key = normalizeSubjectKey(subjects);
  return subjectCombinations.find((item) => normalizeSubjectKey(item.subjects) === key) || null;
}

function buildSubjectOptionItems(selectedSubjects) {
  return subjectOptions.map((name) => ({
    name,
    selected: selectedSubjects.indexOf(name) >= 0,
  }));
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
    districtOptions,
    subjectOptions: buildSubjectOptionItems([]),
    selectedSubjects: [],
    subjectCombinationLabel: "",
    subjectCombinationIndex: -1,
    subjectCombination: null,
    gender: "unknown",
    colorVision: "unknown",
    foreignLanguage: "unknown",
    acceptCooperative: "unknown",
    districtIndex: -1,
    districtLabel: "",
    schoolQuery: "",
    searchResults: [],
    selectedSchool: {},
    scoreMode: "after_exam",
    knownCityRank: "",
    gradeRank: "",
    gradeTotal: "",
    rankingBasis: "same_track",
    finalExamScore: "",
    firstMockScore: "",
    secondMockScore: "",
    estimateResult: null,
  },

  onLoad() {
    enableShareMenu();
  },

  onShow() {
    enableShareMenu();
  },

  onShareAppMessage() {
    return {
      title: "京考择校指南｜从位次到专业与院校方案",
      path: "/pages/school-rank-entry/index",
    };
  },

  onShareTimeline() {
    return {
      title: "京考择校指南｜高考择校定位",
      query: "",
    };
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

  handleScoreModeSelect(event) {
    this.setData({
      scoreMode: event.currentTarget.dataset.mode,
      estimateResult: null,
    });
  },

  handleFirstMockScoreInput(event) {
    this.setData({ firstMockScore: event.detail.value, estimateResult: null });
  },

  handleSecondMockScoreInput(event) {
    this.setData({ secondMockScore: event.detail.value, estimateResult: null });
  },

  handleFinalExamScoreInput(event) {
    this.setData({ finalExamScore: event.detail.value, estimateResult: null });
  },

  handleKnownCityRankInput(event) {
    this.setData({ knownCityRank: event.detail.value, estimateResult: null });
  },

  handleRankingBasisSelect(event) {
    this.setData({
      rankingBasis: event.currentTarget.dataset.value,
      estimateResult: null,
    });
  },

  handleProfileSelect(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value;
    if (["gender", "colorVision", "foreignLanguage", "acceptCooperative"].indexOf(field) < 0) return;
    this.setData({ [field]: value, estimateResult: null });
  },

  handleSubjectToggle(event) {
    const subject = event.currentTarget.dataset.subject;
    const selectedSubjects = this.data.selectedSubjects.slice();
    const existingIndex = selectedSubjects.indexOf(subject);

    if (existingIndex >= 0) {
      selectedSubjects.splice(existingIndex, 1);
    } else {
      if (selectedSubjects.length >= 3) {
        wx.showToast({ title: "最多选择 3 门，请先取消一个科目", icon: "none" });
        return;
      }
      selectedSubjects.push(subject);
    }

    const combination = selectedSubjects.length === 3 ? findSubjectCombination(selectedSubjects) : null;
    this.setData({
      selectedSubjects,
      subjectOptions: buildSubjectOptionItems(selectedSubjects),
      subjectCombination: combination,
      subjectCombinationLabel: combination ? combination.label : selectedSubjects.join("＋"),
      subjectCombinationIndex: combination ? subjectCombinations.findIndex((item) => item.id === combination.id) : -1,
      estimateResult: null,
    });
  },

  buildPositionPayload({ selectedSchool, rank, total, rankingBasis, numericScore, referenceScoreSource, knownCityRank, estimateResult }) {
    const referenceScoreSourceLabel = getReferenceScoreLabel(referenceScoreSource);
    const scoreModeLabel = this.data.scoreMode === "after_exam" ? "已出分填报" : "未出分预测";
    const school = selectedSchool || {};
    return {
      source: "school_rank_entry",
      schemaVersion: 2,
      dataYears: {
        rankMap: estimateResult.dataYear || null,
        admissionReference: 2025,
        targetMajorCatalog: 2026,
        majorStrengthEvidence: 2022,
      },
      generatedAt: new Date().toISOString(),
      input: {
        scoreMode: this.data.scoreMode,
        scoreModeLabel,
        positionSource: estimateResult.positionSource,
        positionSourceLabel: estimateResult.positionSourceLabel,
        knownCityRank: knownCityRank || null,
        district: this.data.districtLabel || "",
        schoolId: school.school_id || "",
        schoolName: school.official_name || "",
        schoolShortName: school.short_name || "",
        entityType: school.entity_type || "",
        entityTypeLabel: school.entity_type ? entityTypeLabel(school.entity_type) : "-",
        gradeRank: rank,
        gradeTotal: total,
        schoolPercentile: rank && total ? Math.round((rank / total) * 10000) / 100 : null,
        rankingBasis,
        rankingBasisLabel: rankingBasisLabels[rankingBasis],
        subjectCombination: this.data.subjectCombination,
        studentProfile: {
          gender: this.data.gender,
          colorVision: this.data.colorVision,
          foreignLanguage: this.data.foreignLanguage,
          acceptCooperative: this.data.acceptCooperative === "yes"
            ? true
            : (this.data.acceptCooperative === "no" ? false : null),
        },
        studentProfileLabel: [
          this.data.gender === "male" ? "男生" : (this.data.gender === "female" ? "女生" : "性别未填"),
          this.data.colorVision === "normal" ? "色觉正常" : (
            this.data.colorVision === "color_weak" ? "色弱" : (
              this.data.colorVision === "color_blind" ? "色盲" : (
                this.data.colorVision === "monochromacy" ? "单色识别异常" : "色觉未填"
              )
            )
          ),
          this.data.foreignLanguage === "english" ? "英语" : (this.data.foreignLanguage === "other" ? "非英语" : "外语未填"),
          this.data.acceptCooperative === "yes" ? "接受中外合作" : (this.data.acceptCooperative === "no" ? "不接受中外合作" : "中外合作未定"),
        ].join("｜"),
        score: numericScore,
        scoreDisplayText: numericScore === null ? "未填写" : `${referenceScoreSourceLabel} ${numericScore}`,
        referenceScoreSource,
        referenceScoreSourceLabel,
        finalExamScore: this.data.finalExamScore ? Number(this.data.finalExamScore) : null,
        firstMockScore: this.data.firstMockScore ? Number(this.data.firstMockScore) : null,
        secondMockScore: this.data.secondMockScore ? Number(this.data.secondMockScore) : null,
      },
      result: estimateResult,
    };
  },

  handleEstimate() {
    const { districtLabel, selectedSchool, knownCityRank, gradeRank, gradeTotal, rankingBasis, subjectCombination, finalExamScore, firstMockScore, secondMockScore, scoreMode } = this.data;

    if (!subjectCombination) {
      wx.showToast({ title: "请选择 3 门选科，用于后续择校匹配", icon: "none" });
      return;
    }

    const isAfterExam = scoreMode === "after_exam";
    const numericKnownCityRank = knownCityRank ? Number(knownCityRank) : null;
    const rank = gradeRank ? Number(gradeRank) : null;
    const total = gradeTotal ? Number(gradeTotal) : null;
    if (isAfterExam) {
      if (!knownCityRank && !finalExamScore) {
        wx.showToast({ title: "请填写北京市位次或最终成绩", icon: "none" });
        return;
      }
      if (knownCityRank && (!Number.isFinite(numericKnownCityRank) || numericKnownCityRank <= 0 || numericKnownCityRank > 100000)) {
        wx.showToast({ title: "北京市位次不合理", icon: "none" });
        return;
      }
    } else {
      if (!districtLabel) {
        wx.showToast({ title: "请先选择所在区", icon: "none" });
        return;
      }
      if (!selectedSchool.school_id) {
        wx.showToast({ title: "请先确认就读高中", icon: "none" });
        return;
      }
      if (!gradeRank || !gradeTotal) {
        wx.showToast({ title: "请补全校排和年级规模", icon: "none" });
        return;
      }
      if (rank <= 0 || total <= 0 || rank > total) {
        wx.showToast({ title: "校排或年级规模不合理", icon: "none" });
        return;
      }
    }

    const referenceScore = resolveReferenceScore({ scoreMode, finalExamScore, secondMockScore, firstMockScore });
    const numericScore = referenceScore.value;
    if (
      (finalExamScore && (Number(finalExamScore) <= 0 || Number(finalExamScore) > 750)) ||
      (firstMockScore && (Number(firstMockScore) <= 0 || Number(firstMockScore) > 750)) ||
      (secondMockScore && (Number(secondMockScore) <= 0 || Number(secondMockScore) > 750))
    ) {
      wx.showToast({ title: "成绩分数不合理", icon: "none" });
      return;
    }
    const estimateResult = estimateCityRank({
      school: selectedSchool,
      gradeRank: rank,
      gradeTotal: total,
      rankingBasis,
      score: numericScore,
      referenceScoreSource: referenceScore.source,
      knownCityRank: numericKnownCityRank,
    });

    const payload = this.buildPositionPayload({
      selectedSchool,
      rank,
      total,
      rankingBasis,
      numericScore,
      referenceScoreSource: referenceScore.source,
      knownCityRank: numericKnownCityRank,
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



