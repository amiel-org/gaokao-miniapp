const fs = require('fs');
const path = require('path');

const root = process.cwd();
const miniRoot = path.join(root, 'miniprogram');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function fileExists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function load(rel) {
  return require(path.join(root, rel));
}

function extractImageSrcs(wxml) {
  const result = [];
  const re = /<image[^>]+src="([^"]+)"/g;
  let match;
  while ((match = re.exec(wxml))) result.push(match[1]);
  return result;
}

function requireFresh(filePath) {
  const resolved = require.resolve(filePath);
  delete require.cache[resolved];
  return require(filePath);
}

function capturePage(relPageJs, storagePayload, majorPreference) {
  const pagePath = path.join(root, 'miniprogram', relPageJs);
  const previousPage = global.Page;
  const previousWx = global.wx;
  let config = null;
  global.Page = (definition) => { config = definition; };
  global.wx = {
    getStorageSync: (key) => {
      if (key === 'latestPositionResult') return storagePayload;
      if (key === 'latestMajorPreference') return majorPreference || null;
      return null;
    },
    setStorageSync: () => {},
    navigateTo: () => {},
    navigateBack: () => {},
    redirectTo: () => {},
    showToast: () => {},
  };
  requireFresh(pagePath);
  assert(config, `Page config not captured: ${relPageJs}`);
  config.data = JSON.parse(JSON.stringify(config.data || {}));
  config.setData = function setData(patch) {
    Object.assign(this.data, patch || {});
  };
  config.__restoreGlobals = function restoreGlobals() {
    global.Page = previousPage;
    global.wx = previousWx;
  };
  return config;
}

function buildSamplePayload() {
  const { searchSchools } = load('miniprogram/utils/school-search.js');
  const { estimateCityRank } = load('miniprogram/utils/school-rank-estimator.js');
  const subjectCombinations = load('miniprogram/data/subject-combinations.js');
  const selectedSchool = searchSchools('汇文', '东城区')[0] || searchSchools('二中', '东城区')[0];
  assert(selectedSchool && selectedSchool.school_id, 'sample school not found');
  const subjectCombination = subjectCombinations.find((item) => item.label.includes('物理') && item.label.includes('化学') && item.label.includes('生物')) || subjectCombinations[0];
  const rank = 120;
  const total = 680;
  const result = estimateCityRank({
    school: selectedSchool,
    gradeRank: rank,
    gradeTotal: total,
    rankingBasis: 'same_track',
    score: 620,
    referenceScoreSource: 'second_mock',
  });
  return {
    source: 'release_readiness_check',
    schemaVersion: 2,
    dataYears: {
      rankMap: result.dataYear,
      admissionReference: 2025,
      targetMajorCatalog: 2026,
      majorStrengthEvidence: 2022,
    },
    generatedAt: new Date('2026-05-19T00:00:00+08:00').toISOString(),
    input: {
      district: selectedSchool.district,
      schoolId: selectedSchool.school_id,
      schoolName: selectedSchool.official_name,
      schoolShortName: selectedSchool.short_name,
      entityType: selectedSchool.entity_type,
      entityTypeLabel: selectedSchool.entityTypeLabel || selectedSchool.entity_type,
      gradeRank: rank,
      gradeTotal: total,
      schoolPercentile: Math.round((rank / total) * 10000) / 100,
      rankingBasis: 'same_track',
      rankingBasisLabel: '同类选科排名',
      subjectCombination,
      score: 620,
      referenceScoreSource: 'second_mock',
      positionSource: result.positionSource,
      positionSourceLabel: result.positionSourceLabel,
      studentProfile: {
        gender: 'unknown',
        colorVision: 'normal',
        foreignLanguage: 'english',
        acceptCooperative: false,
      },
      studentProfileLabel: '性别未填｜色觉正常｜英语｜不接受中外合作',
      firstMockScore: null,
      secondMockScore: 620,
    },
    result,
  };
}

const appJson = JSON.parse(read('miniprogram/app.json'));
const expectedPages = [
  'pages/school-rank-entry/index',
  'pages/position-result/index',
];
assert(JSON.stringify(appJson.pages) === JSON.stringify(expectedPages), `app.json pages mismatch: ${JSON.stringify(appJson.pages)}`);
assert(
  Array.isArray(appJson.subPackages)
  && appJson.subPackages.some((pkg) => (
    pkg.root === 'subpackages/volunteer'
    && Array.isArray(pkg.pages)
    && pkg.pages.includes('pages/major-preference/index')
    && pkg.pages.includes('pages/volunteer-preview/index')
  )),
  'app.json volunteer-preview subpackage missing',
);
assert(appJson.window && appJson.window.navigationBarTitleText === '高考择校定位', 'global nav title should be 高考择校定位');

const expectedPageSpecs = {
  'pages/school-rank-entry/index': {
    navTitle: '高考择校定位',
    phrases: ['鱼跃龙门', '高考择校定位', '北京市位次', '确认高中', '校排定位', '当前校排预测覆盖', '报考限制条件', '择校初筛', '生成择校定位', '为什么先做定位？'],
  },
  'pages/position-result/index': {
    navTitle: '位次参考',
    phrases: ['步步登高', '北京市位次参考', '金榜有位，步步登高', '位次参考区间', '定位解读', '选择专业方向'],
  },
  'subpackages/volunteer/pages/major-preference/index': {
    navTitle: '专业方向优先级',
    phrases: ['专业与院校匹配', '专业方向优先级', '决策侧重', '专业方向', '专业实力口径', '生成专业与院校方案'],
  },
  'subpackages/volunteer/pages/volunteer-preview/index': {
    navTitle: '专业与院校方案',
    phrases: ['一举夺魁', '专业与院校方案', '专业优先级', '全国专业实力', '北京教育考试院', '为什么推荐', '建议重点核对的招生专业', '数据口径'],
  },
};

Object.entries(expectedPageSpecs).forEach(([page, spec]) => {
  ['js', 'json', 'wxml'].forEach((ext) => assert(fileExists(`miniprogram/${page}.${ext}`), `${page}.${ext} missing`));
  const pageWxss = `miniprogram/${page}.wxss`;
  assert(fileExists(pageWxss) || page === 'pages/school-rank-entry/index', `${page}.wxss missing`);
  const pageJson = JSON.parse(read(`miniprogram/${page}.json`));
  assert(pageJson.navigationBarTitleText === spec.navTitle, `${page} nav title mismatch: ${pageJson.navigationBarTitleText}`);
  const wxml = read(`miniprogram/${page}.wxml`);
  spec.phrases.forEach((phrase) => assert(wxml.includes(phrase), `${page}.wxml missing phrase: ${phrase}`));
  extractImageSrcs(wxml).forEach((src) => {
    if (!src.startsWith('/')) return;
    const rel = 'miniprogram' + src.replace(/\//g, path.sep);
    assert(fs.existsSync(path.join(root, rel)), `${page}.wxml references missing asset ${src}`);
  });
});

const heroAssets = [
  'miniprogram/assets/hero/hero-dragon-gate.jpg',
  'miniprogram/assets/hero/hero-rank-coordinate.jpg',
  'miniprogram/assets/hero/hero-crown-laurel.jpg',
];
heroAssets.forEach((rel) => {
  const full = path.join(root, rel);
  assert(fs.existsSync(full), `hero asset missing: ${rel}`);
  const size = fs.statSync(full).size;
  assert(size > 10000 && size < 180000, `hero asset size abnormal: ${rel} ${size}`);
});

const majorStatus = load('miniprogram/subpackages/volunteer/data/major-catalog-status.js');
assert(majorStatus.year === 2026, 'major catalog should identify its 2026 data year');
assert(majorStatus.manualVerifiedSummary.verifiedGroupCount === 292, 'verified 2026 major group count mismatch');
assert(majorStatus.subjectRequirementReference && majorStatus.subjectRequirementReference.status === 'staging_reference_available', 'subject requirement reference status missing');

const majorDirections = load('miniprogram/subpackages/volunteer/data/major-directions.js');
const rankMap2026 = load('miniprogram/data/beijing-rank-map-2026.js');
const strengthEvidence = load('miniprogram/subpackages/volunteer/data/beijing-major-strength-evidence.js');
assert(Array.isArray(majorDirections) && majorDirections.length >= 15, 'major directions coverage too small');
assert(rankMap2026.meta.year === 2026 && rankMap2026.ranks['620'] === 8112, 'official 2026 score-rank map missing');
assert(strengthEvidence.source && strengthEvidence.source.publisher.includes('教育部'), 'major strength official source missing');
assert(strengthEvidence.targetCollegeCount === 46, `major strength target scope should be 46, got ${strengthEvidence.targetCollegeCount}`);
assert(strengthEvidence.evidenceCollegeCount >= 25, 'major strength evidence college coverage too small');

const admissionPlan2026 = load('miniprogram/subpackages/volunteer/data/beijing-2026-admission-plan-firstlook.js');
assert(admissionPlan2026.meta && admissionPlan2026.meta.year === 2026, '2026 admission plan meta missing');
assert(admissionPlan2026.meta.sourcePublisher === '北京教育考试院', '2026 admission plan source should be 北京教育考试院');
assert(admissionPlan2026.meta.targetCollegeCount >= 40, '2026 admission plan target scope too small');
if (admissionPlan2026.meta.isOfficialPlanReady) {
  assert(admissionPlan2026.meta.recordCount > 0, 'official 2026 plan ready but no records');
} else {
  assert(
    admissionPlan2026.meta.status && admissionPlan2026.meta.status !== 'official_2026_plan_connected',
    'unready 2026 admission plan should expose a non-connected status',
  );
  assert(
    admissionPlan2026.meta.candidateVerification && admissionPlan2026.meta.candidateVerification.acceptedAsOfficial2026 === false,
    'unready 2026 admission plan should include candidate verification gate',
  );
}

const samplePayload = buildSamplePayload();
const sampleMajorPreference = {
  version: 'beijing-major-preference-v1',
  mode: 'major_first',
  selectedDirectionIds: ['computer-ai', 'electronic-automation'],
  undecided: false,
};
const positionPage = capturePage('pages/position-result/index.js', samplePayload);
positionPage.onLoad.call(positionPage);
positionPage.__restoreGlobals();
assert(positionPage.data.hasResult === true, 'position-result onLoad did not set hasResult');
assert(positionPage.data.rangeDisplay && positionPage.data.rangeDisplay !== '-', 'position-result rangeDisplay missing');
assert(Array.isArray(positionPage.data.nextSteps) && positionPage.data.nextSteps.length >= 2, 'position-result nextSteps missing');

const preferencePage = capturePage('subpackages/volunteer/pages/major-preference/index.js', samplePayload, sampleMajorPreference);
preferencePage.onLoad.call(preferencePage);
preferencePage.__restoreGlobals();
assert(preferencePage.data.hasResult === true, 'major-preference onLoad did not set hasResult');
assert(preferencePage.data.mode === 'major_first', 'major-preference did not restore decision mode');
assert(preferencePage.data.selectedDirectionIds.length === 2, 'major-preference did not restore selected directions');

const volunteerPage = capturePage('subpackages/volunteer/pages/volunteer-preview/index.js', samplePayload, sampleMajorPreference);
volunteerPage.onLoad.call(volunteerPage);
volunteerPage.__restoreGlobals();
assert(volunteerPage.data.hasResult === true, 'volunteer-preview onLoad did not set hasResult');
assert(volunteerPage.data.subjectCombinationLabel.includes('物理'), 'volunteer subject label missing');
assert(Array.isArray(volunteerPage.data.recommendations) && volunteerPage.data.recommendations.length === 3, 'recommendations should have 3 levels');
assert(volunteerPage.data.preferenceModeLabel === '专业优先', 'volunteer preference mode missing');
assert(Array.isArray(volunteerPage.data.directionSummaries) && volunteerPage.data.directionSummaries.length === 2, 'volunteer direction summaries missing');
assert(volunteerPage.data.admissionPlanStatus && volunteerPage.data.admissionPlanStatus.title, 'admission plan status panel missing');
assert(
  volunteerPage.data.admissionPlanStatus.text.includes('北京教育考试院') && volunteerPage.data.admissionPlanStatus.text.includes('2026'),
  'admission plan status should name official 2026 source',
);
const recommendationEngine = load('miniprogram/subpackages/volunteer/utils/volunteer-recommendation-engine.js');
let recommendationItemCount = 0;
volunteerPage.data.recommendations.forEach((section) => {
  assert(['冲', '稳', '保'].includes(section.level), `invalid recommendation level ${section.level}`);
  section.items.forEach((rec) => {
    recommendationItemCount += 1;
    assert(rec.collegeName, `${section.level} rec missing collegeName`);
    assert(Array.isArray(rec.reasonLines) && rec.reasonLines.length >= 5, `${rec.collegeName} missing recommendation reasons`);
    assert(Array.isArray(rec.recommendedMajors) && rec.recommendedMajors.length >= 1, `${rec.collegeName} has no recommended majors`);
    assert(rec.hasMajorMatch === true, `${rec.collegeName} should match selected major directions in major-first mode`);
    assert(rec.matchedMajors.length > 0, `${rec.collegeName} missing matched majors`);
    assert(rec.sourceLabel, `${rec.collegeName} missing sourceLabel`);
    assert(rec.targetYear === 2026 && rec.referenceYear === 2025, `${rec.collegeName} data years should be explicit`);
    assert(rec.referenceGroupText && rec.targetGroupName, `${rec.collegeName} cross-year entities should be separate`);
    assert(rec.riskText && rec.riskText.includes('未按相同组号直接跨年拼接'), `${rec.collegeName} risk text should reject direct group-code joins`);
    assert(
      recommendationEngine.isRankWithinLevel(rec.minRank, section.level, samplePayload.result.minRank, samplePayload.result.maxRank),
      `${rec.collegeName} escaped ${section.level} rank window`,
    );
  });
});

Object.keys(expectedPageSpecs).forEach((page) => {
  const pageConfig = capturePage(`${page}.js`, null, null);
  try {
    assert(typeof pageConfig.onShareAppMessage === 'function', `${page} share handler missing`);
    assert(typeof pageConfig.onShareTimeline === 'function', `${page} timeline share handler missing`);
    const appMessage = pageConfig.onShareAppMessage.call(pageConfig);
    const timeline = pageConfig.onShareTimeline.call(pageConfig);
    assert(appMessage && appMessage.title, `${page} share title missing`);
    assert(appMessage.path === '/pages/school-rank-entry/index', `${page} must share the privacy-safe entry path`);
    assert(!/[?&](rank|score|school|profile|payload)=/i.test(appMessage.path), `${page} share path leaked result data`);
    assert(timeline && timeline.title && !timeline.query, `${page} timeline share must not carry result data`);
  } finally {
    pageConfig.__restoreGlobals();
  }
});
assert(recommendationItemCount > 0, 'sample recommendation should return at least one reliable item');

const sourceLabels = volunteerPage.data.recommendations.flatMap((section) => section.items.map((item) => item.sourceLabel));
assert(sourceLabels.some((label) => label.includes('北京教育考试院') || label.includes('本地院校专业方向库') || label.includes('已核验')), 'recommendation source labels are too weak');

const summary = {
  pages: expectedPages.length,
  subpackages: appJson.subPackages.length,
  heroAssets: heroAssets.length,
  sampleRankRange: samplePayload.result.rankRange,
  recommendationSections: volunteerPage.data.recommendations.map((section) => ({
    level: section.level,
    items: section.items.length,
    firstCollege: section.items[0] && section.items[0].collegeName,
    firstSource: section.items[0] && section.items[0].sourceLabel,
    firstMajorMatch: section.items[0] && section.items[0].matchedMajorText,
    firstStrength: section.items[0] && section.items[0].strengthDetail,
  })),
};
console.log(JSON.stringify(summary, null, 2));
