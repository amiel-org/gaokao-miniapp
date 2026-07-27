const { entityTypeLabel } = require("./school-labels.js");

let schoolLibraryCache = null;

function getSchoolLibrary() {
  if (!schoolLibraryCache) {
    schoolLibraryCache = require("../data/school-library.js");
  }
  return schoolLibraryCache;
}

function normalize(text) {
  return (text || "")
    .replace(/\s+/g, "")
    .replace(/北京(市)?/g, "")
    .toLowerCase();
}

function canonicalQueryAliases(normalized) {
  const aliases = [normalized];
  const chineseNumberMap = {
    "一": "1",
    "二": "2",
    "三": "3",
    "四": "4",
    "五": "5",
    "六": "6",
    "七": "7",
    "八": "8",
    "九": "9",
    "十": "10",
  };

  Object.keys(chineseNumberMap).forEach((cn) => {
    if (normalized.includes(cn)) {
      aliases.push(normalized.replace(cn, chineseNumberMap[cn]));
    }
  });

  return [...new Set(aliases)];
}

function matchReasonLabel(score) {
  if (score >= 110) return "强匹配";
  if (score >= 95) return "高匹配";
  return "可参考";
}

function scoreSchoolMatchOne(item, normalized) {
  const official = normalize(item.official_name);
  const shortName = normalize(item.short_name);
  const canonical = normalize(item.canonical_school_name);
  const aliases = (item.aliases || []).map(normalize);
  const tokens = (item.search_tokens || []).map(normalize);

  if (normalized === official) return 120;
  if (normalized === shortName) return 110;
  if (normalized === canonical) return 108;
  if (aliases.includes(normalized)) return 105;
  if (tokens.includes(normalized)) return 100;
  if (official.startsWith(normalized)) return 95;
  if (shortName.startsWith(normalized)) return 92;
  if (canonical.startsWith(normalized)) return 90;
  if (aliases.some((alias) => alias.startsWith(normalized))) return 88;
  if (official.includes(normalized)) return 72;
  if (shortName.includes(normalized)) return 72;
  if (canonical.includes(normalized)) return 72;
  if (aliases.some((alias) => alias.includes(normalized))) return 72;
  if (tokens.some((token) => token.includes(normalized))) return 70;
  return 0;
}

function scoreSchoolMatch(item, normalized) {
  return Math.max(...canonicalQueryAliases(normalized).map((query) => scoreSchoolMatchOne(item, query)));
}

function searchSchools(query, district) {
  const normalized = normalize(query);
  if (!normalized) return [];
  const schoolLibrary = getSchoolLibrary();

  return schoolLibrary
    .filter((item) => !district || item.district === district)
    .map((item) => ({ ...item, matchScore: scoreSchoolMatch(item, normalized) }))
    .filter((item) => item.matchScore > 0)
    .map((item) => ({
      ...item,
      matchReasonLabel: matchReasonLabel(item.matchScore),
      entityTypeLabel: entityTypeLabel(item.entity_type),
    }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);
}

module.exports = {
  normalize,
  matchReasonLabel,
  scoreSchoolMatch,
  searchSchools,
};
