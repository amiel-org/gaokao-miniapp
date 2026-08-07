const assert = require('assert');

const { searchSchools } = require('../miniprogram/utils/school-search.js');
const estimator = require('../miniprogram/utils/school-rank-estimator.js');
const engine = require('../miniprogram/subpackages/volunteer/utils/volunteer-recommendation-engine.js');
const subjectCombinations = require('../miniprogram/data/subject-combinations.js');
const majorDirections = require('../miniprogram/subpackages/volunteer/data/major-directions.js');
const verifiedMajorDetails = require('../miniprogram/subpackages/volunteer/data/college-major-details.js');

function findDetail(collegeName, groupCode) {
  return verifiedMajorDetails.find((item) => (
    item.collegeName === collegeName && item.groupCode === groupCode
  ));
}

function testRankSourceRouting() {
  const school = searchSchools('人大附', '海淀区')[0];
  assert(school && school.school_id, 'rank routing fixture school missing');

  const direct = estimator.estimateCityRank({ knownCityRank: 7804 });
  assert.strictEqual(direct.positionSource, 'official_city_rank');
  assert.strictEqual(direct.minRank, 7804);
  assert.strictEqual(direct.maxRank, 7804);

  const finalTop = estimator.estimateCityRank({
    school,
    gradeRank: 1,
    gradeTotal: 500,
    rankingBasis: 'same_track',
    score: 620,
    referenceScoreSource: 'final_exam',
  });
  const finalBottom = estimator.estimateCityRank({
    school,
    gradeRank: 500,
    gradeTotal: 500,
    rankingBasis: 'same_track',
    score: 620,
    referenceScoreSource: 'final_exam',
  });
  assert.strictEqual(finalTop.positionSource, 'final_score_official_map');
  assert.strictEqual(finalTop.rankRange, finalBottom.rankRange, 'final score must not be changed by school rank');
  assert.strictEqual(finalTop.minRank, 7904);
  assert.strictEqual(finalTop.maxRank, 8112);

  const mockTop = estimator.estimateCityRank({
    school,
    gradeRank: 1,
    gradeTotal: 500,
    rankingBasis: 'same_track',
    score: 620,
    referenceScoreSource: 'second_mock',
  });
  const mockBottom = estimator.estimateCityRank({
    school,
    gradeRank: 500,
    gradeTotal: 500,
    rankingBasis: 'same_track',
    score: 620,
    referenceScoreSource: 'second_mock',
  });
  assert.strictEqual(mockTop.positionSource, 'mock_school_rank_prediction');
  assert.notStrictEqual(mockTop.rankRange, mockBottom.rankRange, 'mock route should continue to use school rank');
}

function testCrossYearMappingExamples() {
  const fixtures = [
    ['中国人民大学', '02', '03组'],
    ['北京林业大学', '06', '05组'],
    ['首都医科大学', '02', '03组'],
    ['北京联合大学', '14', '13组'],
  ];
  fixtures.forEach(([collegeName, targetGroupCode, expectedReferenceGroup]) => {
    const detail = findDetail(collegeName, targetGroupCode);
    assert(detail, `${collegeName} ${targetGroupCode} target detail missing`);
    const reference = engine.buildHistoricalReference(detail);
    assert(reference, `${collegeName} ${targetGroupCode} should have a semantic historical reference`);
    assert(reference.groupLabels.includes(expectedReferenceGroup), `${collegeName} ${targetGroupCode} mapped to ${reference.groupText}`);
    assert(!reference.groupLabels.includes(`${targetGroupCode}组`) || expectedReferenceGroup === `${targetGroupCode}组`, `${collegeName} reused the cross-year group code`);
  });

  const bjtuPolitics = findDetail('北京交通大学', '02');
  assert(bjtuPolitics, '北京交通大学 02 target detail missing');
  assert.strictEqual(engine.buildHistoricalReference(bjtuPolitics), null, 'unmapped changed-subject group must not receive a false reference');
}

function testCrossYearMappingInvariant() {
  let mapped = 0;
  let unmapped = 0;
  verifiedMajorDetails.forEach((detail) => {
    const reference = engine.buildHistoricalReference(detail);
    if (!reference) {
      unmapped += 1;
      return;
    }
    mapped += 1;
    const targetKey = engine.requirementKey(engine.parseCatalogSubjectRequirement(detail.subjectRequirementText));
    reference.groups.forEach((group) => {
      assert.strictEqual(engine.requirementKey(group.subjectRequirement), targetKey, `${detail.id} historical subject mismatch`);
    });
  });
  assert(mapped > 200, `mapped 2026 target groups unexpectedly low: ${mapped}`);
  assert(unmapped > 0, 'fixture should retain honest unmapped target groups');
  return { mapped, unmapped };
}

function testRecommendationMatrix() {
  const rankRanges = [
    [100, 500],
    [1000, 2000],
    [3000, 5000],
    [7000, 10000],
    [15000, 20000],
    [25000, 35000],
    [40000, 50000],
    [55000, 65000],
  ];
  const modes = ['major_first', 'balanced', 'school_first'];
  const selectedDirectionIds = majorDirections.slice(0, 2).map((item) => item.id);
  let scenarios = 0;
  let recommendationCount = 0;
  let emptySectionCount = 0;

  subjectCombinations.forEach((subjectCombination) => {
    rankRanges.forEach(([minRank, maxRank]) => {
      modes.forEach((mode) => {
        scenarios += 1;
        const preference = {
          mode,
          selectedDirectionIds,
          undecided: false,
        };
        const payload = {
          input: { subjectCombination },
          result: { minRank, maxRank },
        };
        const candidatePool = engine.buildCandidatePool(payload, preference);
        candidatePool.forEach((candidate) => {
          assert(engine.isSubjectMatched(candidate.subjectRequirement, subjectCombination), `${candidate.id} target subject mismatch`);
          candidate.historicalReference.groups.forEach((group) => {
            assert.strictEqual(
              engine.requirementKey(group.subjectRequirement),
              engine.requirementKey(candidate.subjectRequirement),
              `${candidate.id} historical reference mismatch`,
            );
          });
        });

        const sections = engine.buildRecommendations(payload, preference, candidatePool);
        assert.strictEqual(sections.length, 3);
        sections.forEach((section) => {
          if (!section.items.length) emptySectionCount += 1;
          section.items.forEach((recommendation) => {
            recommendationCount += 1;
            assert(
              engine.isRankWithinLevel(recommendation.minRank, section.level, minRank, maxRank),
              `${recommendation.collegeName} rank ${recommendation.minRank} escaped ${section.level}`,
            );
          });
        });
      });
    });
  });

  assert.strictEqual(scenarios, 480);
  assert(recommendationCount > 1000, `matrix recommendation count too low: ${recommendationCount}`);
  assert(emptySectionCount > 0, 'empty recommendation sections should be preserved instead of cross-level fallback');
  return { scenarios, recommendationCount, emptySectionCount };
}

function testProfessionalFidelity() {
  const majors = [
    { majorName: '计算机科学与技术', planCount: 6 },
    { majorName: '人工智能', planCount: 4 },
    { majorName: '工商管理', planCount: 10 },
  ];
  const fidelity = engine.buildProfessionalFidelity(majors, {
    hasMatch: true,
    matchedMajors: ['计算机科学与技术', '人工智能'],
  }, {
    undecided: false,
  });
  assert.strictEqual(fidelity.matchedPlanCount, 10);
  assert.strictEqual(fidelity.totalPlanCount, 20);
  assert.strictEqual(fidelity.planShareText, '50%');
  assert.strictEqual(fidelity.band, '较高');
}

function testRestrictionFilters() {
  const femaleOnly = findDetail('中华女子学院', '01');
  const colorLimited = findDetail('首都医科大学', '01');
  const englishOnly = findDetail('中国传媒大学', '02');
  const cooperative = verifiedMajorDetails.find((item) => item.subjectRequirementText.includes('中外合作办学'));
  assert(femaleOnly && colorLimited && englishOnly && cooperative, 'restriction fixtures missing');

  assert.strictEqual(engine.assessRestrictions(femaleOnly, {
    studentProfile: { gender: 'male' },
  }).hardExcluded, true, 'male student should be excluded from female-only group');
  assert.strictEqual(engine.assessRestrictions(femaleOnly, {
    studentProfile: { gender: 'female' },
  }).hardExcluded, false, 'female student should remain eligible for female-only group');
  assert.strictEqual(engine.assessRestrictions(colorLimited, {
    studentProfile: { colorVision: 'color_weak' },
  }).hardExcluded, true, 'color-weak student should be excluded from no-color-weak group');
  assert.strictEqual(engine.assessRestrictions(englishOnly, {
    studentProfile: { foreignLanguage: 'other' },
  }).hardExcluded, true, 'non-English examinee should be excluded from English-only group');
  assert.strictEqual(engine.assessRestrictions(cooperative, {
    studentProfile: { acceptCooperative: false },
  }).hardExcluded, true, 'rejected cooperative programs must be hard-filtered');
}

function main() {
  testRankSourceRouting();
  testCrossYearMappingExamples();
  const mapping = testCrossYearMappingInvariant();
  const matrix = testRecommendationMatrix();
  testProfessionalFidelity();
  testRestrictionFilters();
  console.log(JSON.stringify({
    ok: true,
    rankSourceRoutes: 4,
    mapping,
    matrix,
    professionalFidelity: 'passed',
    restrictionFilters: 'passed',
  }, null, 2));
}

main();
