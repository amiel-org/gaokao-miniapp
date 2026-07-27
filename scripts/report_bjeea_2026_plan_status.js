const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const planPath = path.join(root, 'miniprogram', 'data', 'beijing-2026-admission-plan-firstlook.js');
const discoveryPath = path.join(root, 'data', 'staging', 'bjeea_admission_plan_2026', 'bjeea_2026_catalog_source_discovery.json');
const planStagingPath = path.join(root, 'data', 'staging', 'bjeea_admission_plan_2026', 'bjeea_2026_admission_plan.json');
const reportPath = path.join(root, 'docs', 'bjeea_2026_release_monitor.md');
const localOfficialPdfPath = path.join(root, 'data', 'raw', 'admissions', '2026', 'bjeea_2026_北京市2026年普通高等学校招生专业目录.pdf');
const ocrDraftPath = path.join(root, 'data', 'staging', 'major_catalog_ocr', 'college_major_details_draft.json');
const majorDetailsPath = path.join(root, 'miniprogram', 'data', 'college-major-details.js');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadPlan() {
  if (!fs.existsSync(planPath)) {
    return {
      meta: {
        year: 2026,
        status: 'miniapp_plan_module_missing',
        recordCount: 0,
        coveredCollegeCount: 0,
        targetCollegeCount: 0,
        isOfficialPlanReady: false,
      },
      records: [],
    };
  }
  delete require.cache[require.resolve(planPath)];
  return require(planPath);
}

function yesNo(value) {
  return value ? '是' : '否';
}

const plan = loadPlan();
const discovery = readJson(discoveryPath, {});
const staging = readJson(planStagingPath, {});
const meta = plan.meta || {};
const records = Array.isArray(plan.records) ? plan.records : [];
const releaseWindow = discovery.releaseWindowEvidence || {};
const officialFileCandidates = Array.isArray(discovery.officialFileCandidates) ? discovery.officialFileCandidates : [];
const dwrVerification = Array.isArray(staging.dwrCandidateVerification) ? staging.dwrCandidateVerification : [];
const candidateSchoolCount = dwrVerification.reduce((sum, item) => sum + Number(item.beijingOrdinaryBatchSchoolCount || 0), 0);
const candidateDetailCount = dwrVerification.reduce((sum, item) => sum + Number(item.sampleDetailRecordCount || 0), 0);

const ready = !!meta.isOfficialPlanReady && records.length > 0;
const officialFilesFound = officialFileCandidates.length > 0;
const localOfficialPdfFound = fs.existsSync(localOfficialPdfPath);
const ocrDraftFound = fs.existsSync(ocrDraftPath);
let manualVerifiedMajorDetails = [];
if (fs.existsSync(majorDetailsPath)) {
  delete require.cache[require.resolve(majorDetailsPath)];
  const loaded = require(majorDetailsPath);
  manualVerifiedMajorDetails = Array.isArray(loaded)
    ? loaded.filter((item) => item.year === 2026 && item.dataStatus === 'official_catalog_manual_verified')
    : [];
}
const manualVerifiedGroupCount = manualVerifiedMajorDetails.length;
const manualVerifiedMajorCount = manualVerifiedMajorDetails.reduce((sum, item) => sum + ((item.majors || []).length), 0);
const manualVerifiedCollegeCount = new Set(manualVerifiedMajorDetails.map((item) => String(item.collegeCode || '')).filter(Boolean)).size;
const targetCollegeCount = Number(meta.targetCollegeCount || 46);
const manualVerifiedComplete = manualVerifiedCollegeCount >= targetCollegeCount && manualVerifiedGroupCount > 0;
const partialManualReleaseReady = !ready && manualVerifiedGroupCount > 0;
const actionable = officialFilesFound || ready;
const blocker = ready
  ? ''
  : partialManualReleaseReady
    ? manualVerifiedComplete
      ? `无；当前可按“官方 PDF 人工核验版”发布。已按二本及以上口径核验 ${manualVerifiedCollegeCount}/${targetCollegeCount} 所目标院校；/plan/115 结构化接口仍未开放，不能宣称已接入 /plan/115 全量结构化接口。`
      : `无；当前可按“官方 PDF 人工核验部分专业组”模式发布。全量 /plan/115 结构化计划仍未开放，不能宣称全量 2026 专业计划已接入。`
  : officialFilesFound
    ? localOfficialPdfFound
      ? ocrDraftFound
        ? '已发现并下载官方目录 PDF，已生成 OCR 草稿，但尚未人工核验并进入正式覆盖检查。'
        : '已发现并下载官方目录 PDF，但尚未完成 OCR/人工核验并通过覆盖检查。'
      : '已发现疑似官方目录文件，但尚未导入并通过覆盖检查。'
    : '北京教育考试院当前未开放可结构化的 2026 本科普通批招生专业计划记录。';

const nextAction = ready
  ? '执行 npm run check:release，通过后可进入微信开发者工具上传审核。'
  : partialManualReleaseReady
    ? manualVerifiedComplete
      ? '执行 npm run check:release 验证官方 PDF 人工核验版；上线文案保持“二本及以上已核验，二本以下不收录；/plan/115 接口未开放”的准确口径。'
      : '执行 npm run check:release 验证部分核验版；上线文案保持“已核验范围”口径，同时继续按官方 PDF 扩大人工核验范围。'
  : officialFilesFound
    ? localOfficialPdfFound
      ? ocrDraftFound
        ? '人工核验 docs/college_major_details_draft_review.md 中的 OCR 草稿；通过后写入 manual review queue，再导出 college-major-details.js。'
        : '对官方扫描版 PDF 执行 OCR 定位、院校块裁切和人工核验，再导出可用专业明细。'
      : '下载/核验官方 PDF 或 Excel 后运行 import_bjeea_2026_admission_plan_excel.py 或 import_bjeea_2026_admission_plan_pdf.py，再执行 npm run check:release。'
    : '继续执行 npm run monitor:plan2026；待 6 月官方目录下发或 /plan/115 开放 2026 年度后再导入。';

const summary = {
  generatedAt: new Date().toISOString(),
  officialPlanReady: ready,
  partialManualReleaseReady,
  manualVerifiedComplete,
  actionable,
  blocker,
  nextAction,
  plan: {
    status: meta.status,
    year: meta.year,
    sourcePublisher: meta.sourcePublisher,
    sourceUrl: meta.sourceUrl,
    recordCount: records.length,
    targetCollegeCount: meta.targetCollegeCount || 0,
    coveredCollegeCount: meta.coveredCollegeCount || 0,
    selectedExamId: meta.selectedExamId || null,
  },
  discovery: {
    status: discovery.status || 'missing',
    inspectedPageCount: Array.isArray(discovery.inspectedPages) ? discovery.inspectedPages.length : 0,
    strictCatalogCandidateCount: Number(discovery.strictCatalogCandidateCount || 0),
    officialFileCandidateCount: officialFileCandidates.length,
    releaseWindowMonth: releaseWindow.monthLabel || '',
    releaseWindowFound: !!releaseWindow.found,
    localOfficialPdfFound,
    ocrDraftFound,
    manualVerifiedGroupCount,
    manualVerifiedMajorCount,
    manualVerifiedCollegeCount,
  },
  dwrCandidateVerification: {
    candidateCount: dwrVerification.length,
    verifiedCandidateSchoolCount: candidateSchoolCount,
    verifiedCandidateDetailCount: candidateDetailCount,
  },
};

const lines = [
  '# 2026 北京高考招生专业目录接入状态监测',
  '',
  `生成时间：${summary.generatedAt}`,
  '',
  '## 当前上线判断',
  '',
  `- 是否已接入可上线的 2026 官方专业计划：${yesNo(ready)}`,
  `- 官方 PDF 人工核验版是否可发布：${yesNo(partialManualReleaseReady)}`,
  `- 二本及以上目标院校是否已人工核验完成：${yesNo(manualVerifiedComplete)}（${manualVerifiedCollegeCount}/${targetCollegeCount} 所）`,
  `- 是否发现需要人工导入的官方目录文件：${yesNo(officialFilesFound)}`,
  `- 当前阻断：${blocker || '无'}`,
  `- 下一步：${nextAction}`,
  '',
  '## 官方查询接入',
  '',
  `- 来源：${meta.sourcePublisher || '北京教育考试院'}`,
  `- URL：${meta.sourceUrl || 'https://query.bjeea.cn/queryService/rest/plan/115'}`,
  `- 状态：${meta.status || 'unknown'}`,
  `- 页面年度 examId：${meta.selectedExamId || '未暴露'}`,
  `- 记录数：${records.length}`,
  `- 目标覆盖：${meta.coveredCollegeCount || 0}/${meta.targetCollegeCount || 0}`,
  '',
  '## 官网目录发现',
  '',
  `- 发现状态：${discovery.status || 'missing'}`,
  `- 已巡检页面：${summary.discovery.inspectedPageCount}`,
  `- 严格目录候选：${summary.discovery.strictCatalogCandidateCount}`,
  `- 官方 PDF/Excel/CSV 候选：${officialFileCandidates.length}`,
  `- 本地官方 PDF：${yesNo(localOfficialPdfFound)}`,
  `- OCR 草稿：${yesNo(ocrDraftFound)}`,
  `- 已人工核验专业组：${manualVerifiedGroupCount} 组 / ${manualVerifiedMajorCount} 条专业 / ${manualVerifiedCollegeCount} 所院校`,
  `- 发布窗口证据：${releaseWindow.found ? `${releaseWindow.monthLabel || '已发现'}，${releaseWindow.interpretation || ''}` : '未发现'}`,
  '',
  '## DWR 候选验证',
  '',
  `- 候选 examId 数：${dwrVerification.length}`,
  `- 北京本科普通批候选学校行：${candidateSchoolCount}`,
  `- 抽样专业明细：${candidateDetailCount}`,
  '- 结论：隐藏候选未被公开年度标签确认前，不作为 2026 正式招生专业目录。',
  '',
  '## 允许上线的判定',
  '',
  '- 官方 PDF 人工核验版：`npm run check:release` 必须通过，且页面必须明确展示“二本及以上已核验、二本以下不收录、/plan/115 结构化接口未开放”的口径。',
  '- 全量结构化版：`npm run check:release:full` 必须通过；其中 `meta.isOfficialPlanReady` 必须为 `true`，`recordCount` 必须大于 0，且覆盖北京高校、本科普通批、二本及以上目标院校达到发布阈值；二本以下不收录。',
  '- 不允许用 2025 投档线、2024 选考要求或本地专业方向库冒充 2026 招生专业目录。',
  '',
];

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');

console.log(JSON.stringify(summary, null, 2));
console.log(`saved ${reportPath}`);

if (process.argv.includes('--require-ready') && !ready) {
  throw new Error(`2026 官方招生专业目录尚未可上线：${blocker}`);
}
