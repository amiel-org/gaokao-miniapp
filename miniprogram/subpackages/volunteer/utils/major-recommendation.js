const majorDirections = require("../data/major-directions.js");
const strengthDataset = require("../data/beijing-major-strength-evidence.js");

const MODE_OPTIONS = [
  {
    id: "major_first",
    label: "专业优先",
    description: "优先保专业方向和专业实力",
  },
  {
    id: "balanced",
    label: "均衡推荐",
    description: "兼顾专业、学校平台与录取梯度",
  },
  {
    id: "school_first",
    label: "学校优先",
    description: "优先学校平台，专业范围更宽",
  },
];

const directionById = {};
majorDirections.forEach((item) => {
  directionById[item.id] = item;
});

const strengthByCollege = {};
(strengthDataset.records || []).forEach((item) => {
  strengthByCollege[normalizeCollegeName(item.collegeName)] = item;
});

function normalizeCollegeName(value) {
  return String(value || "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\s+/g, "")
    .trim();
}

function unique(values) {
  const seen = {};
  const result = [];
  (values || []).forEach((value) => {
    const text = String(value || "").trim();
    if (!text || seen[text]) return;
    seen[text] = true;
    result.push(text);
  });
  return result;
}

function getModeOption(mode) {
  return MODE_OPTIONS.find((item) => item.id === mode) || MODE_OPTIONS[1];
}

function normalizePreference(value) {
  const raw = value && typeof value === "object" ? value : {};
  const mode = getModeOption(raw.mode).id;
  const selectedDirectionIds = unique(raw.selectedDirectionIds)
    .filter((id) => !!directionById[id])
    .slice(0, 3);
  const undecided = !!raw.undecided || selectedDirectionIds.length === 0;
  return {
    version: "beijing-major-preference-v1",
    mode,
    modeLabel: getModeOption(mode).label,
    selectedDirectionIds: undecided ? [] : selectedDirectionIds,
    selectedDirectionLabels: undecided ? [] : selectedDirectionIds.map((id) => directionById[id].label),
    undecided,
  };
}

function directionMatchesMajor(direction, majorName) {
  const name = String(majorName || "").replace(/\s+/g, "");
  if (!name || !direction) return false;
  if ((direction.excludeKeywords || []).some((keyword) => name.indexOf(keyword) >= 0)) return false;
  return (direction.keywords || []).some((keyword) => name.indexOf(keyword) >= 0);
}

function buildMajorMatch(majorNames, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  const names = unique(majorNames);
  const directionMatches = preference.selectedDirectionIds.map((directionId, index) => {
    const direction = directionById[directionId];
    const matchedMajors = names.filter((name) => directionMatchesMajor(direction, name));
    return {
      directionId,
      directionLabel: direction.label,
      priority: index + 1,
      matchedMajors,
    };
  }).filter((item) => item.matchedMajors.length > 0);
  const matchedMajors = unique(directionMatches.reduce((result, item) => result.concat(item.matchedMajors), []));
  return {
    hasPreference: !preference.undecided,
    hasMatch: directionMatches.length > 0,
    bestPriority: directionMatches.length ? directionMatches[0].priority : null,
    directionMatches,
    matchedDirectionIds: directionMatches.map((item) => item.directionId),
    matchedDirectionLabels: directionMatches.map((item) => item.directionLabel),
    matchedMajors,
  };
}

function getStrengthEvidence(collegeName, preferenceValue, matchedDirectionIds) {
  const preference = normalizePreference(preferenceValue);
  const record = strengthByCollege[normalizeCollegeName(collegeName)] || null;
  if (!record) {
    return {
      score: 0,
      hasDirectEvidence: false,
      hasPlatformEvidence: false,
      label: "",
      detail: "",
      sourceLabel: strengthDataset.source.shortTitle,
    };
  }
  const selected = preference.selectedDirectionIds.length
    ? preference.selectedDirectionIds
    : unique(matchedDirectionIds);
  const direct = (record.disciplineEvidence || []).filter((item) => (
    (item.directionIds || []).some((id) => selected.indexOf(id) >= 0)
  ));
  if (direct.length) {
    return {
      score: 3,
      hasDirectEvidence: true,
      hasPlatformEvidence: true,
      label: "国家级优势学科证据",
      detail: unique(direct.map((item) => item.discipline)).slice(0, 4).join("、"),
      sourceLabel: strengthDataset.source.shortTitle,
      sourceUrl: strengthDataset.source.url,
    };
  }
  if (record.selfPublished) {
    return {
      score: 1,
      hasDirectEvidence: false,
      hasPlatformEvidence: true,
      label: "双一流建设高校",
      detail: "建设学科由学校自主确定并公布",
      sourceLabel: strengthDataset.source.shortTitle,
      sourceUrl: strengthDataset.source.url,
    };
  }
  return {
    score: 0,
    hasDirectEvidence: false,
    hasPlatformEvidence: true,
    label: "双一流建设高校",
    detail: "当前所选方向未命中该校公开建设学科",
    sourceLabel: strengthDataset.source.shortTitle,
    sourceUrl: strengthDataset.source.url,
  };
}

function buildDirectionSummaries(candidates, preferenceValue) {
  const preference = normalizePreference(preferenceValue);
  return preference.selectedDirectionIds.map((directionId, index) => {
    const direction = directionById[directionId];
    const matched = (candidates || []).filter((item) => (
      item.majorMatch && item.majorMatch.matchedDirectionIds.indexOf(directionId) >= 0
    ));
    const colleges = unique(matched.map((item) => item.collegeName));
    const evidenceColleges = unique(matched.filter((item) => (
      item.strengthEvidence && item.strengthEvidence.hasDirectEvidence
    )).map((item) => item.collegeName));
    const sampleMajors = unique(matched.reduce((result, item) => (
      result.concat(item.majorMatch ? item.majorMatch.matchedMajors : [])
    ), [])).slice(0, 3);
    return {
      id: directionId,
      priority: index + 1,
      label: direction.label,
      description: direction.description,
      collegeCount: colleges.length,
      evidenceCollegeCount: evidenceColleges.length,
      sampleMajors,
      sampleMajorText: sampleMajors.join("、") || "以当年招生专业目录为准",
    };
  });
}

function collegePlatformScore(level) {
  const value = String(level || "");
  if (value.indexOf("985") >= 0) return 3;
  if (value.indexOf("211") >= 0) return 2;
  if (value.indexOf("双一流") >= 0) return 1.5;
  if (value.indexOf("普通一本") >= 0) return 1;
  return 0.5;
}

module.exports = {
  MODE_OPTIONS,
  majorDirections,
  getModeOption,
  normalizePreference,
  directionMatchesMajor,
  buildMajorMatch,
  getStrengthEvidence,
  buildDirectionSummaries,
  collegePlatformScore,
};
