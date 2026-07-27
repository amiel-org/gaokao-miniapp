const fs = require('fs');
const path = require('path');
const { searchSchools } = require('../miniprogram/utils/school-search.js');
const { estimateCityRank } = require('../miniprogram/utils/school-rank-estimator.js');
const subjectCombinations = require('../miniprogram/data/subject-combinations.js');
const majorDirections = require('../miniprogram/subpackages/volunteer/data/major-directions.js');

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capturePage(relPageJs, storage) {
  const pagePath = path.join(process.cwd(), 'miniprogram', relPageJs);
  const previousPage = global.Page;
  const previousWx = global.wx;
  let config = null;
  global.Page = (definition) => { config = definition; };
  global.wx = {
    getStorageSync: (key) => storage[key] || null,
    setStorageSync: () => {},
    showShareMenu: () => {},
    showToast: () => {},
    navigateTo: () => {},
    redirectTo: () => {},
    navigateBack: () => {},
  };
  delete require.cache[require.resolve(pagePath)];
  require(pagePath);
  config.data = JSON.parse(JSON.stringify(config.data || {}));
  config.setData = function setData(patch) { Object.assign(this.data, patch || {}); };
  config.onLoad.call(config);
  global.Page = previousPage;
  global.wx = previousWx;
  return config.data;
}

const selectedSchool = searchSchools('汇文', '东城区')[0] || searchSchools('二中', '东城区')[0];
const subjectCombination = subjectCombinations.find((item) => (
  item.label.includes('物理') && item.label.includes('化学') && item.label.includes('生物')
)) || subjectCombinations[0];
const rankResult = estimateCityRank({
  school: selectedSchool,
  gradeRank: 120,
  gradeTotal: 680,
  rankingBasis: 'same_track',
  score: 620,
});
const payload = {
  baselineYear: 2026,
  input: {
    schoolShortName: selectedSchool.short_name,
    subjectCombination,
  },
  result: rankResult,
};
const preference = {
  version: 'beijing-major-preference-v1',
  mode: 'major_first',
  selectedDirectionIds: ['computer-ai', 'electronic-automation'],
  undecided: false,
};
const volunteer = capturePage('subpackages/volunteer/pages/volunteer-preview/index.js', {
  latestPositionResult: payload,
  latestMajorPreference: preference,
});

const directionHtml = majorDirections.map((direction) => {
  const selectedIndex = preference.selectedDirectionIds.indexOf(direction.id);
  return `<div class="direction ${selectedIndex >= 0 ? 'selected' : ''}">
    <div class="direction-head"><b>${escapeHtml(direction.label)}</b>${selectedIndex >= 0 ? `<span>${selectedIndex + 1}</span>` : ''}</div>
    <p>${escapeHtml(direction.description)}</p>
  </div>`;
}).join('');

const recommendationHtml = volunteer.recommendations.map((section) => {
  const rec = section.items[0];
  if (!rec) return `<section class="tier"><header><span>${section.level}</span><div><b>${section.title}</b><p>${section.summary}</p></div></header><div class="empty">${escapeHtml(section.emptyText)}</div></section>`;
  return `<section class="tier">
    <header><span>${section.level}</span><div><b>${section.title}</b><p>${section.summary}</p></div></header>
    <article class="college">
      <div class="college-head"><div><h3>${escapeHtml(rec.collegeName)}</h3><p>${escapeHtml(rec.groupName)} · ${escapeHtml(rec.collegeLevel)}</p></div><em>${section.level}</em></div>
      <div class="rank">历史投档：${escapeHtml(rec.minScore)}分 · 位次 ${escapeHtml(rec.minRankText)}</div>
      <div class="major-hit"><small>优先专业命中</small><b>${escapeHtml(rec.matchedMajorText)}</b><p>${escapeHtml(rec.majorCoverageText)}</p></div>
      <div class="reason"><strong>为什么推荐</strong>${rec.reasonLines.slice(0, 4).map((line) => `<p>• ${escapeHtml(line)}</p>`).join('')}</div>
      ${rec.hasStrengthEvidence ? `<div class="strength"><div><small>全国专业实力</small><span>${escapeHtml(rec.strengthLabel)}</span></div><b>${escapeHtml(rec.strengthDetail)}</b><p>${escapeHtml(rec.strengthSourceLabel)}</p></div>` : ''}
      <div class="risk">${escapeHtml(rec.riskText)}</div>
    </article>
  </section>`;
}).join('');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>专业优先推荐 V1 预览</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#dce7ee;color:#102033;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",Arial,sans-serif}.stage{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;gap:28px;padding:28px}.phone{width:390px;height:844px;overflow:hidden;border:9px solid #111827;border-radius:28px;background:#f4f9fd;box-shadow:0 22px 70px rgba(16,47,74,.22)}.screen{height:100%;overflow:auto}.nav{height:48px;padding-top:15px;text-align:center;background:#f7fbff;font-size:16px;font-weight:800}.pad{padding:0 14px 28px}.hero{position:relative;height:220px;margin:0 -14px 14px;overflow:hidden;background:#dbeef7}.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(244,250,253,.98),rgba(244,250,253,.82) 48%,rgba(244,250,253,.08) 82%)}.hero-content{position:relative;z-index:1;width:270px;padding:42px 20px}.eyebrow{display:inline-block;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.82);color:#176caa;font-size:11px;font-weight:800}.hero h1{margin:10px 0 0;font-size:29px;line-height:1.15;letter-spacing:0;color:#123b5a}.hero p{margin:9px 0 0;font-size:13px;line-height:1.55;color:#496278}.strip{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border-radius:8px;background:#123b5a;color:white;box-shadow:0 9px 20px rgba(18,59,90,.16)}.strip small{display:block;color:rgba(255,255,255,.68)}.strip b{display:block;margin-top:4px;font-size:17px}.strip span{max-width:145px;text-align:right;color:#bfe9e4;font-size:12px}.section{margin-top:13px;padding:15px 13px;border:1px solid rgba(49,105,145,.12);border-radius:8px;background:white;box-shadow:0 8px 19px rgba(38,87,128,.06)}.section h2{margin:0;font-size:18px}.section>.copy{margin:5px 0 0;color:#60758a;font-size:12px;line-height:1.5}.modes{display:flex;gap:6px;margin-top:12px}.mode{flex:1;min-height:68px;padding:10px 5px;border:1px solid rgba(78,124,164,.16);border-radius:7px;background:#f8fbfd;text-align:center}.mode.active{border-color:#1687d9;background:#eaf5fb}.mode b{font-size:13px}.mode p{margin:5px 0 0;color:#7890a4;font-size:10px;line-height:1.4}.directions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}.direction{min-height:68px;padding:9px;border:1px solid rgba(78,124,164,.14);border-radius:7px;background:#f8fbfd}.direction.selected{border-color:#17a9b5;background:#eaf8f6}.direction-head{display:flex;align-items:center;justify-content:space-between;gap:6px}.direction b{font-size:12px}.direction span{width:18px;height:18px;border-radius:50%;background:#178f86;color:white;text-align:center;font-size:11px;line-height:18px;font-weight:900}.direction p{margin:5px 0 0;color:#7890a4;font-size:10px;line-height:1.35}.source{margin-top:12px;padding:12px;border-left:4px solid #17a9b5;background:white;font-size:11px;line-height:1.55;color:#60758a}.button{margin-top:13px;height:46px;border-radius:8px;background:linear-gradient(135deg,#1687d9,#17a9b5);color:white;text-align:center;font-size:15px;line-height:46px;font-weight:900}.summary{margin-top:13px;padding:14px;border-radius:8px;background:white;border-left:4px solid #17a9b5}.summary small{color:#7890a4}.summary h2{margin:4px 0 0;font-size:19px}.summary p{margin:7px 0 0;color:#178177;font-size:13px;font-weight:800}.priority{margin-top:13px;padding:14px;border-radius:8px;background:white}.priority h2{margin:0;font-size:18px}.priority-row{display:flex;gap:9px;padding:11px 0;border-bottom:1px solid rgba(80,139,191,.12)}.priority-row:last-child{border-bottom:0}.priority-row>span{flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:#178f86;color:#fff;text-align:center;line-height:24px;font-weight:900}.priority-row b{font-size:13px}.priority-row p{margin:4px 0 0;color:#60758a;font-size:11px;line-height:1.4}.tier{margin-top:15px}.tier>header{display:flex;gap:8px;align-items:flex-start}.tier>header>span{width:30px;height:30px;border-radius:50%;background:#1687d9;color:white;text-align:center;line-height:30px;font-weight:900}.tier header b{font-size:16px}.tier header p{margin:3px 0 0;color:#7890a4;font-size:11px}.college{margin-top:8px;padding:14px;border-left:4px solid #17a9b5;border-radius:8px;background:white;box-shadow:0 8px 20px rgba(38,87,128,.07)}.college-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.college h3{margin:0;font-size:17px}.college-head p{margin:4px 0 0;color:#60758a;font-size:11px}.college em{padding:4px 9px;border-radius:999px;background:#eaf5fb;color:#176caa;font-style:normal;font-size:11px;font-weight:800}.rank{margin-top:8px;color:#496278;font-size:12px}.major-hit{margin-top:10px;padding-left:9px;border-left:3px solid #17a9b5}.major-hit small{display:block;color:#178177;font-weight:800}.major-hit b{display:block;margin-top:4px;font-size:13px;line-height:1.45}.major-hit p{margin:4px 0 0;color:#7890a4;font-size:10px;line-height:1.45}.reason{margin-top:10px;padding:10px;border-radius:7px;background:#edf8f8}.reason strong{color:#176caa;font-size:12px}.reason p{margin:5px 0 0;color:#263d52;font-size:10px;line-height:1.45}.strength{margin-top:10px;padding-top:10px;border-top:1px solid rgba(80,139,191,.12)}.strength>div{display:flex;justify-content:space-between;gap:8px}.strength small{color:#60758a}.strength span{padding:3px 7px;border-radius:999px;background:#eaf8f6;color:#177d75;font-size:10px;font-weight:800}.strength>b{display:block;margin-top:6px;font-size:12px}.strength p{margin:4px 0 0;color:#7890a4;font-size:10px}.risk{margin-top:10px;padding:8px;border-radius:7px;background:#fff6e5;color:#8a620d;font-size:10px;line-height:1.45}.empty{margin-top:8px;padding:12px;border-radius:8px;background:#fff;color:#60758a;font-size:12px}
</style></head><body><div class="stage">
<div class="phone"><div class="screen"><div class="nav">专业方向优先级</div><div class="pad">
  <section class="hero"><img src="../../miniprogram/assets/hero/hero-rank-coordinate.jpg"><div class="hero-content"><span class="eyebrow">专业与院校匹配</span><h1>专业方向优先级</h1><p>先明确更看重的专业方向，再比较北京高校的专业实力与录取梯度。</p></div></section>
  <div class="strip"><div><small>当前位次区间</small><b>${escapeHtml(rankResult.rankRange)}</b></div><span>${escapeHtml(subjectCombination.label)}</span></div>
  <section class="section"><h2>决策侧重</h2><p class="copy">不同侧重会改变同一冲稳保档位内的排序。</p><div class="modes"><div class="mode active"><b>专业优先</b><p>优先保专业方向和专业实力</p></div><div class="mode"><b>均衡推荐</b><p>兼顾专业、学校平台与录取梯度</p></div><div class="mode"><b>学校优先</b><p>优先学校平台，专业范围更宽</p></div></div></section>
  <section class="section"><h2>专业方向</h2><p class="copy">选择顺序即为推荐优先级。</p><div class="directions">${directionHtml}</div></section>
  <div class="source"><b>专业实力口径</b><br>全国优势证据采用教育部第二轮“双一流”建设学科名单；招生专业以北京教育考试院2026年官方目录为准。</div>
  <div class="button">生成专业与院校方案</div>
</div></div></div>
<div class="phone"><div class="screen"><div class="nav">专业与院校方案</div><div class="pad">
  <section class="hero"><img src="../../miniprogram/assets/hero/hero-crown-laurel.jpg"><div class="hero-content"><span class="eyebrow">一举夺魁</span><h1>专业与院校方案</h1><p>${escapeHtml(selectedSchool.short_name)}｜先按专业方向匹配北京高校，再结合位次形成冲稳保方案。</p></div></section>
  <div class="strip"><div><small>定位区间</small><b>${escapeHtml(rankResult.rankRange)}</b></div><span>${escapeHtml(subjectCombination.label)}</span></div>
  <div class="summary"><small>当前决策侧重</small><h2>${escapeHtml(volunteer.preferenceModeLabel)}</h2><p>${escapeHtml(volunteer.preferenceDirectionText)}</p></div>
  <div class="priority"><h2>专业优先级</h2>${volunteer.directionSummaries.map((item) => `<div class="priority-row"><span>${item.priority}</span><div><b>${escapeHtml(item.label)}</b><p>覆盖 ${item.collegeCount} 所北京高校 · 国家级优势证据 ${item.evidenceCollegeCount} 所</p></div></div>`).join('')}</div>
  ${recommendationHtml}
</div></div></div>
</div></body></html>`;

const outputDir = path.join(process.cwd(), 'output', 'page-preview');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'major-first-v1-preview.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(outputPath);
