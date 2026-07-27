const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataDir = path.join(root, 'miniprogram', 'data');
const volunteerDataDir = path.join(root, 'miniprogram', 'subpackages', 'volunteer', 'data');
function load(name) {
  const mainPath = path.join(dataDir, name + '.js');
  const volunteerPath = path.join(volunteerDataDir, name + '.js');
  return require(fs.existsSync(mainPath) ? mainPath : volunteerPath);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function hasNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

const schoolLibrary = load('school-library');
const estimationParams = load('school-estimation-params');
const rankMap = load('beijing-rank-map');
const subjectCombinations = load('subject-combinations');
const admissionGroups = load('college-admission-groups');
const localPrograms = load('beijing-local-college-programs');
const coverage = load('beijing-undergraduate-school-coverage');
const subjectRequirementFirstlook = load('college-subject-requirement-firstlook');
const majorFirstlook = load('college-major-firstlook');
const majorDirections = load('major-directions');
const strengthEvidence = load('beijing-major-strength-evidence');
const majorRecommendation = require(path.join(root, 'miniprogram', 'subpackages', 'volunteer', 'utils', 'major-recommendation.js'));

assert(Array.isArray(schoolLibrary) && schoolLibrary.length >= 80, `school-library count too small: ${schoolLibrary.length}`);
assert(Array.isArray(estimationParams) && estimationParams.length === schoolLibrary.length, `estimation params count ${estimationParams.length} != schools ${schoolLibrary.length}`);
assert(Object.keys(rankMap).length > 0, 'beijing-rank-map is empty');
assert(Array.isArray(subjectCombinations) && subjectCombinations.length === 20, `subject combinations should be 20, got ${subjectCombinations.length}`);
assert(Array.isArray(admissionGroups) && admissionGroups.length > 0, 'college-admission-groups is empty');
assert(Array.isArray(localPrograms) && localPrograms.length > 0, 'beijing-local-college-programs is empty');
assert(Array.isArray(coverage) && coverage.length > 0, 'beijing-undergraduate-school-coverage is empty');
assert(Array.isArray(subjectRequirementFirstlook) && subjectRequirementFirstlook.length >= 50, `college-subject-requirement-firstlook count too small: ${subjectRequirementFirstlook.length}`);
assert(majorFirstlook && typeof majorFirstlook.getFirstlookMajors === 'function', 'college-major-firstlook missing getFirstlookMajors');
assert(Array.isArray(majorDirections) && majorDirections.length >= 15, `major directions count too small: ${majorDirections.length}`);
assert(strengthEvidence && strengthEvidence.targetCollegeCount === 46, 'major strength evidence target scope should be 46 colleges');
assert(strengthEvidence.evidenceCollegeCount >= 25, `major strength evidence college count too small: ${strengthEvidence.evidenceCollegeCount}`);
assert(strengthEvidence.source && strengthEvidence.source.publisher.indexOf('教育部') >= 0, 'major strength evidence should use official ministry source');
assert(majorRecommendation && typeof majorRecommendation.buildMajorMatch === 'function', 'major recommendation utility missing');

const directionIds = new Set();
majorDirections.forEach((direction) => {
  assert(direction.id && direction.label, 'major direction missing id or label');
  assert(!directionIds.has(direction.id), `duplicate major direction id ${direction.id}`);
  assert(Array.isArray(direction.keywords) && direction.keywords.length > 0, `major direction ${direction.id} has no keywords`);
  directionIds.add(direction.id);
});
strengthEvidence.records.forEach((record) => {
  assert(record.collegeName, 'major strength record missing collegeName');
  (record.disciplineEvidence || []).forEach((evidence) => {
    assert(evidence.discipline, `major strength record ${record.collegeName} has empty discipline`);
    (evidence.directionIds || []).forEach((id) => assert(directionIds.has(id), `unknown major direction ${id} in strength evidence`));
  });
});
const majorMatchProbe = majorRecommendation.buildMajorMatch(
  ['计算机科学与技术(实验班)', '金融学'],
  { mode: 'major_first', selectedDirectionIds: ['computer-ai'] },
);
assert(majorMatchProbe.hasMatch && majorMatchProbe.matchedMajors.length === 1, 'major direction matcher probe failed');

const schoolIds = new Set();
const requiredSchoolFields = ['school_id', 'official_name', 'short_name', 'district', 'entity_type', 'search_tokens'];
schoolLibrary.forEach((school, index) => {
  requiredSchoolFields.forEach((field) => assert(school[field] !== undefined && school[field] !== '', `school ${index} missing ${field}`));
  assert(!schoolIds.has(school.school_id), `duplicate school_id ${school.school_id}`);
  schoolIds.add(school.school_id);
  assert(Array.isArray(school.search_tokens) && school.search_tokens.length > 0, `school ${school.school_id} has no search tokens`);
});

estimationParams.forEach((param) => {
  assert(schoolIds.has(param.school_id), `param references unknown school_id ${param.school_id}`);
  assert(param.tier_code && param.tier_name, `param ${param.school_id} missing tier fields`);
  assert(param.ranking_basis_weight && typeof param.ranking_basis_weight === 'object', `param ${param.school_id} missing ranking_basis_weight`);
  ['same_track', 'full_grade', 'unknown'].forEach((key) => assert(hasNumber(param.ranking_basis_weight[key]), `param ${param.school_id} missing ranking_basis_weight.${key}`));
  ['score_reference_weight', 'school_percentile_weight', 'confidence_adjustment', 'range_factor_min', 'range_factor_max', 'min_sample_size'].forEach((field) => assert(hasNumber(param[field]), `param ${param.school_id} missing ${field}`));
  assert(param.parameter_status, `param ${param.school_id} missing parameter_status`);
});

subjectCombinations.forEach((combo) => {
  assert(Array.isArray(combo.subjects) && combo.subjects.length === 3, `invalid subject combination ${combo.id}`);
});

admissionGroups.forEach((group, index) => {
  ['collegeName', 'groupCode', 'minScore', 'minRank', 'subjectRequirement'].forEach((field) => assert(group[field] !== undefined && group[field] !== '', `admission group ${index} missing ${field}`));
});

localPrograms.forEach((program, index) => {
  ['collegeName', 'minScore', 'minRank', 'subjectRequirement'].forEach((field) => assert(program[field] !== undefined && program[field] !== '', `local program ${index} missing ${field}`));
  assert((program.majorNames && program.majorNames.length) || (program.majors && program.majors.length), `local program ${index} has no major names`);
});

const subjectRequirementNames = new Set();
const subjectRequirementCodes = new Set();
subjectRequirementFirstlook.forEach((record, index) => {
  assert(record.collegeCode, `subject requirement record ${index} missing collegeCode`);
  assert(record.collegeName, `subject requirement record ${index} missing collegeName`);
  assert(record.buckets && typeof record.buckets === 'object', `subject requirement record ${record.collegeName} missing buckets`);
  assert(Array.isArray(record.topMajors) && record.topMajors.length > 0, `subject requirement record ${record.collegeName} missing topMajors`);
  assert(Object.keys(record.buckets).length > 0, `subject requirement record ${record.collegeName} has empty buckets`);
  subjectRequirementNames.add(record.collegeName);
  subjectRequirementCodes.add(String(record.collegeCode));
});

['北京大学', '清华大学', '北京工业大学', '北方工业大学', '北京工商大学'].forEach((name) => {
  assert(subjectRequirementNames.has(name), `subject requirement firstlook missing core college ${name}`);
});

const firstlookProbeGroups = admissionGroups.filter((group) => (
  ['北京大学', '清华大学', '北京工业大学', '北方工业大学', '北京工商大学'].includes(group.collegeName)
)).slice(0, 12);
assert(firstlookProbeGroups.length >= 5, `not enough firstlook probe groups: ${firstlookProbeGroups.length}`);
firstlookProbeGroups.forEach((group) => {
  const info = majorFirstlook.getFirstlookMajors(group, 5);
  assert(info && Array.isArray(info.majors) && info.majors.length >= 3, `firstlook majors too few for ${group.collegeName} ${group.groupCode}`);
  assert(
    info.sourceLabel && (
      info.sourceLabel.indexOf('北京教育考试院选考要求参考') >= 0
      || info.sourceLabel.indexOf('已核验招生专业') >= 0
    ),
    `firstlook did not use official/reference major source for ${group.collegeName} ${group.groupCode}: ${info.sourceLabel}`,
  );
});

const officialCollegeNames = uniq(admissionGroups.map((item) => item.collegeName));
const localCollegeNames = uniq(localPrograms.map((item) => item.collegeName));
const coverageNames = uniq(coverage.map((item) => item.name));
const allRecommendationNames = uniq(officialCollegeNames.concat(localCollegeNames));
const missingCoverage = coverageNames.filter((name) => !allRecommendationNames.includes(name));
const levels = uniq(coverage.map((item) => item.collegeLevel));
['985/211/双一流', '211/双一流', '普通一本', '普通二本'].forEach((level) => {
  assert(levels.some((item) => item.indexOf(level) >= 0), `coverage missing level ${level}`);
});
const coreOrdinaryLevels = ['985/211/双一流', '211/双一流', '双一流/普通一本', '普通一本', '普通二本'];
const missingCoreOrdinary = coverage.filter((item) => (
  !allRecommendationNames.includes(item.name)
  && item.admissionCategory === 'ordinary_batch'
  && coreOrdinaryLevels.includes(item.collegeLevel)
));
assert(missingCoreOrdinary.length === 0, `core ordinary recommendation missing: ${missingCoreOrdinary.map((item) => item.name).join('、')}`);

const summary = {
  schools: schoolLibrary.length,
  estimationParams: estimationParams.length,
  scoreRankPoints: Object.keys(rankMap).length,
  subjectCombinations: subjectCombinations.length,
  officialAdmissionGroups: admissionGroups.length,
  officialGroupColleges: officialCollegeNames.length,
  localPrograms: localPrograms.length,
  localProgramColleges: localCollegeNames.length,
  undergraduateCoverage: coverage.length,
  recommendationCollegeNames: allRecommendationNames.length,
  coverageWithoutRecommendationData: missingCoverage.length,
  coreOrdinaryMissingRecommendationData: missingCoreOrdinary.length,
  subjectRequirementReferenceColleges: subjectRequirementFirstlook.length,
  subjectRequirementCoreCollegeHits: ['北京大学', '清华大学', '北京工业大学', '北方工业大学', '北京工商大学'].filter((name) => subjectRequirementNames.has(name)).length,
  firstlookProbeGroups: firstlookProbeGroups.length,
  majorDirections: majorDirections.length,
  majorStrengthEvidenceColleges: strengthEvidence.evidenceCollegeCount,
  coverageLevels: levels,
};
console.log(JSON.stringify(summary, null, 2));
if (missingCoverage.length) {
  console.log('coverage_without_recommendation_data=' + missingCoverage.join('、'));
}
