const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const plan = require(path.join(root, 'miniprogram', 'subpackages', 'volunteer', 'data', 'beijing-2026-admission-plan-firstlook.js'));
const coverage = require(path.join(root, 'miniprogram', 'subpackages', 'volunteer', 'data', 'beijing-undergraduate-school-coverage.js'));
const majorDetailsPath = path.join(root, 'miniprogram', 'subpackages', 'volunteer', 'data', 'college-major-details.js');

const CORE_LEVELS = new Set(['985/211/双一流', '211/双一流', '双一流/普通一本', '普通一本', '普通二本']);
const targets = coverage.filter((item) => item.admissionCategory === 'ordinary_batch' && CORE_LEVELS.has(item.collegeLevel));
const planTargetSchools = Array.isArray(plan.targetSchools)
  ? plan.targetSchools.filter((item) => CORE_LEVELS.has(item.collegeLevel))
  : [];
const records = Array.isArray(plan.records) ? plan.records : [];
const covered = [...new Set(records.map((item) => item.collegeName).filter(Boolean))];
const missing = targets.filter((item) => !covered.includes(item.name));
const allowManualVerified = process.argv.includes('--allow-manual-verified');
const requireFullReady = process.argv.includes('--require-ready');
let majorDetails = [];
if (fs.existsSync(majorDetailsPath)) {
  majorDetails = require(majorDetailsPath);
}
const manualVerifiedDetails = Array.isArray(majorDetails)
  ? majorDetails.filter((item) => item.year === 2026 && item.dataStatus === 'official_catalog_manual_verified')
  : [];
const manualVerifiedGroupCount = manualVerifiedDetails.length;
const manualVerifiedMajorCount = manualVerifiedDetails.reduce((sum, item) => sum + ((item.majors || []).length), 0);
const manualVerifiedCollegeCount = new Set(manualVerifiedDetails.map((item) => String(item.collegeCode || '')).filter(Boolean)).size;
const manualVerifiedComplete = manualVerifiedCollegeCount >= targets.length && manualVerifiedGroupCount > 0;
const exceptionsPath = path.join(root, 'data', 'staging', 'bjeea_admission_plan_2026', 'bjeea_2026_admission_plan_exceptions.json');
let exceptionsWriteWarning = null;
try {
  fs.mkdirSync(path.dirname(exceptionsPath), { recursive: true });
  fs.writeFileSync(exceptionsPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    targetScope: '北京高校、本科普通批、二本及以上层次',
    status: plan.meta && plan.meta.status,
    isOfficialPlanReady: !!(plan.meta && plan.meta.isOfficialPlanReady),
    allowManualVerified,
    manualVerifiedGroupCount,
    manualVerifiedMajorCount,
    manualVerifiedCollegeCount,
    manualVerifiedComplete,
    targetCollegeCount: targets.length,
    coveredCollegeCount: covered.length,
    missingCollegeCount: missing.length,
    missingSchools: missing.map((item) => ({
      name: item.name,
      collegeLevel: item.collegeLevel,
      reason: allowManualVerified && manualVerifiedComplete
        ? '当前按官方 PDF 人工核验专业明细发布；该校已在二本及以上目标院校人工核验范围内。'
        : allowManualVerified && manualVerifiedGroupCount > 0
          ? '当前按官方 PDF 人工核验专业明细做部分核验版发布；该校尚未进入本批人工核验范围，正式填报前仍需逐项核对官方目录。'
        : '北京教育考试院 /plan/115 当前未返回可结构化的 2026 本科普通批专业计划记录，等待官方页面开放或用户提供官方目录文件。',
    })),
  }, null, 2), 'utf8');
} catch (error) {
  exceptionsWriteWarning = `${error.code || 'ERROR'}: ${error.message}`;
}

const summary = {
  status: plan.meta && plan.meta.status,
  isOfficialPlanReady: !!(plan.meta && plan.meta.isOfficialPlanReady),
  year: plan.meta && plan.meta.year,
  recordCount: records.length,
  targetCollegeCount: targets.length,
  coveredCollegeCount: covered.length,
  missingCollegeCount: missing.length,
  manualVerifiedGroupCount,
  manualVerifiedMajorCount,
  manualVerifiedCollegeCount,
  manualVerifiedComplete,
  candidateVerification: plan.meta && plan.meta.candidateVerification,
  exceptionsPath: path.relative(root, exceptionsPath),
  exceptionsWriteWarning,
};

if (!plan.meta || plan.meta.year !== 2026) throw new Error('2026 plan meta missing');
if (!plan.meta.sourcePublisher || !plan.meta.sourcePublisher.includes('北京教育考试院')) throw new Error('2026 plan source publisher should be 北京教育考试院');
if (planTargetSchools.length !== targets.length) throw new Error(`target school count mismatch: ${planTargetSchools.length} != ${targets.length}`);

if (records.length) {
  records.forEach((record, index) => {
    if (record.year !== 2026) throw new Error(`record ${index} year is not 2026`);
    if (!record.collegeName || !record.majorName || !record.majorCode) throw new Error(`record ${index} missing required fields`);
    if (!String(record.enrollBatch || '').includes('本科普通批')) throw new Error(`record ${index} is not ordinary batch`);
    if (!record.sourcePublisher || !record.sourcePublisher.includes('北京教育考试院')) throw new Error(`record ${index} missing official source`);
  });
  if (covered.length < Math.ceil(targets.length * 0.9)) throw new Error(`official 2026 plan coverage too low: ${covered.length}/${targets.length}`);
  console.log(JSON.stringify(Object.assign(summary, { readyForRelease: true }), null, 2));
} else {
  if (allowManualVerified && manualVerifiedGroupCount > 0) {
    console.log(JSON.stringify(Object.assign(summary, {
      readyForRelease: true,
      releaseMode: manualVerifiedComplete ? 'official_pdf_manual_verified' : 'partial_pdf_manual_verified',
      blocker: null,
      warning: manualVerifiedComplete
        ? `当前为 2026 官方 PDF 人工核验发布：已按二本及以上口径核验 ${manualVerifiedCollegeCount}/${targets.length} 所目标院校、${manualVerifiedGroupCount} 组、${manualVerifiedMajorCount} 条专业；/plan/115 结构化接口仍未开放。`
        : `当前为 2026 官方 PDF 人工核验部分专业组发布：已核验 ${manualVerifiedGroupCount} 组、${manualVerifiedMajorCount} 条专业；/plan/115 全量结构化计划仍未开放。`,
    }), null, 2));
  } else if (requireFullReady) {
    throw new Error(`北京教育考试院 2026 招生专业目录尚未接入可用记录：${JSON.stringify(summary)}`);
  } else {
    console.log(JSON.stringify(Object.assign(summary, { readyForRelease: false, blocker: 'official_2026_plan_records_empty' }), null, 2));
  }
}
