const verifiedMajorDetails = require("./college-major-details.js");

const DRAFT_MAJOR_DIRECTIONS = {
  "1027_01": ["工商管理类", "会计学", "国际经济与贸易", "法学", "公共事业管理"],
  "1027_02": ["化学工程与工艺", "高分子材料与工程", "生物工程", "化学", "材料类"],
  "1027_03": ["自动化类", "计算机类", "电子信息类", "机械类", "安全工程"],
  "1027_05": ["化工与制药类", "材料科学与工程", "生物工程", "环境工程", "国际化工方向"],
  "1031_01": ["针灸推拿学", "公共事业管理", "法学", "英语", "中医药国际传播"],
  "1031_02": ["中医学", "中西医临床医学", "中药学", "药学", "康复治疗学"],
  "1035_01": ["金融学", "国际经济与贸易", "外国语言文学类", "翻译", "汉语国际教育"],
  "1035_02": ["计算机类", "信息管理", "数字媒体技术", "语言智能", "数据科学方向"],
  "1035_03": ["国际政治", "国际事务", "新闻传播", "区域国别研究", "外语复合方向"],
  "1035_04": ["计算机类", "人工智能", "语言智能", "数据科学", "信息技术方向"],
  "1038_02": ["金融学类", "经济学类", "国际经济与贸易", "工商管理类", "法学类"],
  "1042_01": ["工商管理类", "经济学类", "英语", "思想政治教育", "公共管理方向"],
  "1042_02": ["管理科学与工程", "信息管理", "能源经济", "数学类", "应用物理方向"],
  "1042_03": ["石油工程", "化学工程与工艺", "机械类", "计算机类", "新能源科学与工程"],
  "1043_01": ["工商管理类", "经济学", "法学", "英语", "土地资源管理"],
  "1043_02": ["地理信息科学", "信息管理", "工程管理", "大数据管理", "测绘方向"],
  "1043_03": ["地质学类", "资源勘查工程", "计算机类", "环境工程", "材料类"],
  "1053_01": ["英语", "日语", "德语", "翻译", "旅游管理"],
  "1055_01": ["经济学", "金融学", "工商管理", "会计学", "法学"],
  "1055_02": ["经济学", "财政学", "工商管理", "公共管理", "贸易经济"],
  "1055_07": ["管理科学与工程", "信息管理", "金融工程", "数据科学方向", "电子商务"],
  "1062_01": ["经济与金融", "法学", "英语", "建筑学", "城乡规划"],
  "1062_02": ["会计学", "工商管理", "国际经济与贸易", "知识产权", "广告学"],
  "1062_03": ["计算机科学与技术", "电子信息工程", "自动化", "机械设计制造及其自动化", "数据科学与大数据技术"],
  "1076_01": ["会计学", "金融学", "法学", "新闻学", "旅游管理"],
  "1076_12": ["信息管理与信息系统", "工程管理", "物流工程", "电子商务", "金融科技"],
  "1076_14": ["计算机科学与技术", "软件工程", "电子信息工程", "自动化", "机器人工程"]
};

const FALLBACK_BY_REQUIREMENT = {
  unlimited: ["经济管理", "法学", "外语", "新闻传播", "公共管理"],
  physicsChemistry: ["计算机类", "电子信息类", "自动化类", "机械/材料/化工", "生物医药"],
  physics: ["电子信息", "管理科学", "工程管理", "金融工程", "信息管理"],
  politics: ["法学", "思想政治教育", "国际政治", "公共管理", "新闻传播"],
  history: ["历史学", "考古学", "汉语言文学", "文化产业管理", "文博方向"],
  geography: ["地理科学", "地理信息科学", "城乡规划", "旅游管理", "资源环境"],
  biology: ["生物科学", "生物技术", "食品科学", "生态学", "生物医药"],
  chemistry: ["化学", "应用化学", "材料化学", "药学", "化工方向"],
  general: ["优势专业组", "特色实验班", "就业优势方向", "升学深造方向", "交叉复合方向"]
};

function normalizeMajorName(value) {
  return String(value || "").replace(/[“”\"'\\`]/g, "").replace(/\s+/g, "").trim();
}

function isReadableMajorName(value) {
  const name = normalizeMajorName(value);
  if (!name || name.length < 2) return false;
  if (/^[A-Za-z0-9（）()]+$/.test(name)) return false;
  if (/[A-Z]{3,}/.test(name)) return false;
  if (/^[0-9]+$/.test(name)) return false;
  return /[\u4e00-\u9fa5]/.test(name);
}

function dedupe(list) {
  const seen = {};
  const result = [];
  list.forEach((item) => {
    const name = normalizeMajorName(item);
    if (!name || seen[name]) return;
    seen[name] = true;
    result.push(name);
  });
  return result;
}

function getVerifiedMajors(group) {
  const key = group.collegeCode + "_" + group.groupCode;
  const detail = (verifiedMajorDetails || []).find((item) => item.id === "2025_" + key || (item.collegeCode === group.collegeCode && item.groupCode === group.groupCode));
  if (!detail || !detail.majors) return [];
  return detail.majors.map((major) => major.majorName).filter(isReadableMajorName);
}

function getDraftMajors(group) {
  const key = group.collegeCode + "_" + group.groupCode;
  return (DRAFT_MAJOR_DIRECTIONS[key] || []).filter(isReadableMajorName);
}

function fallbackKey(group) {
  const requirement = group.subjectRequirement || {};
  const raw = requirement.raw || "";
  const subjects = requirement.subjects || [];
  if (requirement.mode === "unlimited" || raw.indexOf("不限") >= 0 || subjects.length === 0) return "unlimited";
  if (subjects.indexOf("物理") >= 0 && subjects.indexOf("化学") >= 0) return "physicsChemistry";
  if (subjects.indexOf("物理") >= 0) return "physics";
  if (subjects.indexOf("思想政治") >= 0) return "politics";
  if (subjects.indexOf("历史") >= 0) return "history";
  if (subjects.indexOf("地理") >= 0) return "geography";
  if (subjects.indexOf("生物") >= 0) return "biology";
  if (subjects.indexOf("化学") >= 0) return "chemistry";
  return "general";
}

function getFallbackMajors(group) {
  return FALLBACK_BY_REQUIREMENT[fallbackKey(group)] || FALLBACK_BY_REQUIREMENT.general;
}

function getFirstlookMajors(group, limit) {
  const verified = getVerifiedMajors(group);
  const draft = getDraftMajors(group);
  const fallback = getFallbackMajors(group);
  const majors = dedupe([].concat(verified, draft, fallback)).slice(0, limit || 5);
  let sourceLabel = "按选科生成的初筛专业方向";
  if (verified.length) sourceLabel = "已核验招生专业";
  else if (draft.length) sourceLabel = "官方目录草稿 + 初筛补充";
  return { majors, sourceLabel };
}

module.exports = {
  getFirstlookMajors,
};

