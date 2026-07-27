process.stdout.setDefaultEncoding && process.stdout.setDefaultEncoding('utf8');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stagingPath = path.join(root, 'data', 'staging', 'bjeea_admission_plan_2026', 'bjeea_2026_admission_plan.json');
const outputPath = path.join(root, 'miniprogram', 'data', 'beijing-2026-admission-plan-firstlook.js');
const reportPath = path.join(root, 'docs', 'bjeea_2026_admission_plan_connection_report.md');

const coverage = require(path.join(root, 'miniprogram', 'data', 'beijing-undergraduate-school-coverage.js'));

const CORE_LEVELS = new Set(['985/211/双一流', '211/双一流', '双一流/普通一本', '普通一本', '普通二本']);
const targetSchools = coverage.filter((item) => item.admissionCategory === 'ordinary_batch' && CORE_LEVELS.has(item.collegeLevel));
const targetNames = new Set(targetSchools.map((item) => item.name));
const levelByName = Object.fromEntries(targetSchools.map((item) => [item.name, item.collegeLevel]));

function readJson(file) {
  if (!fs.existsSync(file)) {
    return {
      source: {
        publisher: '北京教育考试院',
        url: 'https://query.bjeea.cn/queryService/rest/plan/115',
        title: '高招计划查询',
        year: 2026,
        retrievedAt: '2026-05-20',
      },
      status: 'staging_missing',
      examIdsFromPage: [],
      selectedExamId: null,
      target: { year: 2026, province: '北京市', enrollBatch: '本科普通批' },
      schoolIndexCount: 0,
      recordCount: 0,
      notes: ['未找到抓取结果，请先运行 scripts/fetch_bjeea_admission_plan_2026.py。'],
      records: [],
    };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function sanitizeRecord(record) {
  return {
    year: Number(record.year || 2026),
    collegeCode: String(record.collegeCode || ''),
    collegeName: String(record.collegeName || ''),
    collegeLevel: levelByName[record.collegeName] || '',
    majorCode: String(record.majorCode || ''),
    majorName: String(record.majorName || ''),
    subjectRequirement: String(record.subjectRequirement || ''),
    enrollBatch: String(record.enrollBatch || ''),
    planCount: record.planCount === null || record.planCount === undefined ? null : Number(record.planCount),
    durationYears: String(record.durationYears || ''),
    tuition: String(record.tuition || ''),
    foreignLanguage: String(record.foreignLanguage || ''),
    sourcePublisher: record.sourcePublisher || '北京教育考试院',
    sourceType: record.sourceType || 'official_2026_admission_plan',
    sourceUrl: record.sourceUrl || 'https://query.bjeea.cn/queryService/rest/plan/115',
  };
}

const staging = readJson(stagingPath);
const allRecords = Array.isArray(staging.records) ? staging.records : [];
const targetRecords = allRecords
  .filter((record) => Number(record.year) === 2026)
  .filter((record) => targetNames.has(record.collegeName))
  .filter((record) => String(record.enrollBatch || '').includes('本科普通批'))
  .map(sanitizeRecord)
  .sort((a, b) => a.collegeName.localeCompare(b.collegeName, 'zh-CN') || a.majorCode.localeCompare(b.majorCode, 'zh-CN'));

const coveredNames = uniq(targetRecords.map((item) => item.collegeName));
const missingSchools = targetSchools
  .filter((school) => !coveredNames.includes(school.name))
  .map((school) => ({ name: school.name, collegeLevel: school.collegeLevel }));

const status = targetRecords.length > 0 ? 'official_2026_plan_connected' : (staging.status || 'official_2026_plan_unavailable');
const dwrCandidateVerification = Array.isArray(staging.dwrCandidateVerification) ? staging.dwrCandidateVerification : [];
const verifiedCandidateSchoolCount = dwrCandidateVerification.reduce((sum, item) => sum + Number(item.beijingOrdinaryBatchSchoolCount || 0), 0);
const verifiedCandidateDetailCount = dwrCandidateVerification.reduce((sum, item) => sum + Number(item.sampleDetailRecordCount || 0), 0);
const payload = {
  meta: {
    year: 2026,
    status,
    sourcePublisher: '北京教育考试院',
    sourceTitle: '2026 年高招计划查询 / 北京市普通高等学校招生专业目录',
    sourceUrl: 'https://query.bjeea.cn/queryService/rest/plan/115',
    retrievedAt: (staging.source && staging.source.retrievedAt) || '2026-05-20',
    targetScope: '北京高校，本科普通批，985/211/双一流、普通一本、普通二本等二本及以上层次；二本以下不收录',
    selectedExamId: staging.selectedExamId || null,
    recordCount: targetRecords.length,
    coveredCollegeCount: coveredNames.length,
    targetCollegeCount: targetSchools.length,
    coverageRate: targetSchools.length ? Math.round((coveredNames.length / targetSchools.length) * 10000) / 100 : 0,
    isOfficialPlanReady: targetRecords.length > 0,
    candidateVerification: {
      dwrCandidateCount: dwrCandidateVerification.length,
      verifiedCandidateSchoolCount,
      verifiedCandidateDetailCount,
      acceptedAsOfficial2026: false,
      reason: dwrCandidateVerification.length
        ? 'DWR 候选 examId 已回填验证；在公开页面未暴露 2026 年度标签前，不作为正式 2026 招生专业目录。'
        : '未发现可验证的 DWR 候选招生计划行。',
    },
    notes: staging.notes || [],
  },
  targetSchools: targetSchools.map((school) => ({ name: school.name, collegeLevel: school.collegeLevel })),
  missingSchools,
  records: targetRecords,
};

fs.writeFileSync(
  outputPath,
  'module.exports = ' + JSON.stringify(payload, null, 2) + ';\n',
  'utf8',
);

const report = [
  '# 北京教育考试院 2026 招生计划接入报告',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  '## 接入口径',
  '',
  '- 来源：北京教育考试院综合查询系统「高招计划查询」',
  '- URL：https://query.bjeea.cn/queryService/rest/plan/115',
  '- 年度：2026',
  '- 范围：北京高校、本科普通批、二本及以上层次（985/211/双一流、普通一本、普通二本）；二本以下不收录',
  '',
  '## 当前结果',
  '',
  `- 状态：${status}`,
  `- 目标院校数：${targetSchools.length}`,
  `- 已覆盖院校数：${coveredNames.length}`,
  `- 官方 2026 专业计划记录数：${targetRecords.length}`,
  `- 页面年度 examId：${staging.selectedExamId || '未暴露'}`,
  `- DWR 候选验证：候选 ${dwrCandidateVerification.length} 个，候选学校行 ${verifiedCandidateSchoolCount} 条，抽样专业明细 ${verifiedCandidateDetailCount} 条；未作正式 2026 数据接入`,
  '',
  '## 说明',
  '',
  ...(payload.meta.notes.length ? payload.meta.notes.map((note) => `- ${note}`) : ['- 暂无补充说明。']),
  '',
  '## 未覆盖院校',
  '',
  ...(missingSchools.length ? missingSchools.map((school) => `- ${school.name}（${school.collegeLevel}）`) : ['- 无']),
  '',
].join('\n');
fs.writeFileSync(reportPath, report, 'utf8');

console.log(JSON.stringify(payload.meta, null, 2));
console.log(`saved ${outputPath}`);
console.log(`saved ${reportPath}`);
