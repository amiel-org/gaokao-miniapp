# 2026-05-19 上线前整体优化交接

## 1. 本轮目标

对 `D:\codex\school\gaokao-miniapp` 做上线前整体优化：让页面更清爽、有辨识度，补齐每页主题图示与吉祥话；核查学校/专业覆盖；排查红色警告与代码问题；同步文案、入口、逻辑、页面和验证结果。

## 2. UI 与文案方向

### 2.1 视觉基调

- 主色：蓝青系 `#1687d9 -> #17a9b5`，辅助用深蓝 `#102f4a`。
- 提示色：琥珀色只用于口径校准、数据提醒；红色只保留真正错误场景。
- 画风：清爽、留白、轻量玻璃感，不做满屏国潮，不堆卡片。

外部参考口径：
- 微信生态优先采用接近 WeUI 的轻量、清晰、原生感交互，减少重装饰和强刺激色。
- 北京教育考试院官方查询系统以蓝色为主，升学/考试产品用蓝色更符合可信、理性、专业的心理预期。

### 2.2 三页主题

| 页面 | 页面主题 | 吉祥话/意象 | 主要职责 |
| --- | --- | --- | --- |
| 首页 `school-rank-entry` | 高考择校定位 | 鱼跃龙门 | 先确认高中、校排、年级规模、选科，生成北京市位次锚点 |
| 第二页 `position-result` | 北京市位次参考 | 步步登高 / 金榜有位 | 展示市排区间、置信度、定位解读、口径校准和下一步 |
| 第三页 `volunteer-preview` | 推荐学校池 | 一举夺魁 | 展示冲、稳、保学校池，并解释每所学校“为什么推荐” |

### 2.3 IMAGEGEN 资产

已落地三张压缩 JPG，控制小程序包体：

- `miniprogram/assets/hero/hero-dragon-gate.jpg`
- `miniprogram/assets/hero/hero-rank-coordinate.jpg`
- `miniprogram/assets/hero/hero-crown-laurel.jpg`

第二页新增“金榜卷轴 + 登高台阶”图示为 WXSS 绘制，不额外增加包体；对应文案为“金榜有位，步步登高”，用于强化“位次参考”页的主题。

## 3. 学校覆盖核查

当前 `npm run check:data` 结果：

- 北京高中库：195 所
- 高中估算参数：195 条，与高中库一一对应
- 一分一段点位：318
- 选科组合：20，覆盖北京 3+3 所有组合
- 官方本科普通批专业组：196 条
- 官方专业组覆盖院校：36 所
- 本地普通批/专业方向数据：96 条
- 本地专业方向覆盖院校：53 所
- 北京非民办本科覆盖库：63 所
- 推荐可用院校名：53 所
- 覆盖但暂无推荐数据：11 所

### 3.1 985 / 211 / 一本 / 二本覆盖结论

已在 `scripts/check_data.js` 增加硬性检查：

- `985/211/双一流`
- `211/双一流`
- `双一流/普通一本`
- `普通一本`
- `普通二本`

上述普通批核心层次，不允许出现覆盖库里有院校、但推荐数据缺失的情况。当前检查结果为：`coreOrdinaryMissingRecommendationData = 0`。

### 3.2 仍在覆盖库但不进入普通批推荐的 11 所

这 11 所不是普通批核心推荐缺口，主要属于提前批、特殊类型、艺术类、职业本科或暂无稳定普通批数据：

1. 北京电子科技学院
2. 中国消防救援学院
3. 外交学院
4. 中国人民公安大学
5. 国际关系学院
6. 中央音乐学院
7. 中国青年政治学院
8. 首钢工学院
9. 北京警察学院
10. 民政职业大学
11. 北京科技职业大学

上线口径：不把这些院校硬塞进普通批冲稳保推荐，避免误导；保留在覆盖库，等待当年官方招生专业目录和招生计划确认后补齐。

## 4. 专业覆盖与数据口径

### 4.1 当前可上线口径

- 小程序页面统一使用“2026 数据基线”组织择校流程。
- 推荐卡片不再裸写“2025 参考”，改为“历史投档参考”，避免让用户误以为只看旧年份。
- 专业方向来自：
  - 官方投档线和院校专业组数据
  - 本地结构化专业方向库
  - 北京教育考试院公开选考要求首轮专业方向库
  - `college-major-firstlook.js` 的首轮专业方向兜底
- 最终填报仍必须以当年官方招生专业目录、院校专业组和高校要求为准。

### 4.2 2026 专业目录状态

截至 2026-05-19，已确认北京教育考试院综合查询系统存在 2026 招生计划查询入口；但尚未确认官网发布可下载的《2026 普通高等学校招生专业目录》普通批 PDF。

因此当前不能伪造完整 2026 专业明细。后续上线前若要把专业做到“全量可信”，建议按如下优先级继续：

1. 以北京教育考试院综合查询系统/官方目录为准，补齐当前推荐卡片命中的院校专业组；
2. 再补齐北京普通批 53 所推荐可用院校；
3. 最后处理提前批、艺术类、职业本科等特殊类型。

### 4.3 新增北京教育考试院选考要求核验管道

2026-05-19 已新增可复用脚本：

- `scripts/fetch_bjeea_subject_requirement_2024.py`
- `scripts/check_bjeea_subject_requirement_coverage.py`

已从北京教育考试院公开查询页 `https://query.bjeea.cn/queryService/rest/plan/134` 抓取 2024 年普通高校在京招生专业选考要求，生成过程数据：

- `data/staging/bjeea_subject_requirements/bjeea_2024_subject_requirements.sample.json`

并已导出小程序可用压缩库：

- `miniprogram/data/college-subject-requirement-firstlook.js`

当前核验结果：

- 北京院校选考要求覆盖：72 所
- 专业/专业类选考要求：1823 行
- 命中当前北京非民办本科覆盖库：59 / 63 所
- 未命中覆盖库院校：4 所，分别为中国青年政治学院、首钢工学院、民政职业大学、北京科技职业大学

该数据可用于校验推荐卡片中的“专业方向”和“选科要求”是否合理，但仍不能替代 2026 普通批招生专业目录，因为它缺少当年招生人数、学制、收费、外语语种等正式计划字段。

### 4.4 推荐页接入状态

2026-05-19 已完成接入：

- `miniprogram/data/college-major-firstlook.js` 已读取 `college-subject-requirement-firstlook.js`。
- 专业方向优先级为：已核验专业明细 → 官方目录草稿 → 北京教育考试院选考要求参考 → 按选科生成的兜底方向。
- 推荐理由中若使用北京教育考试院选考要求，会明确提示“用于首轮专业方向判断；正式填报前仍以当年招生专业目录逐项核对”。
- `scripts/check_data.js` 已新增硬检查：选考要求库不少于 50 所、核心院校北京大学/清华大学/北京工业大学/北方工业大学/北京工商大学必须命中，且核心样例专业方向实际使用“北京教育考试院选考要求参考”。

## 5. BUG 与红色警告排查

### 5.1 已做代码检查

`npm run check:all` 包含：

- `check:syntax`：检查 30 个小程序源文件，覆盖 JS / JSON / WXML / WXSS，并检查乱码与误写 `` `n``。
- `check:data`：检查学校库、估算参数、选科组合、院校专业组、覆盖库、985/211/一本/二本普通批推荐覆盖，以及北京教育考试院选考要求专业方向库接入。
- `check:estimation`：14 个估算回测 case。
- `check:release`：发布前页面链路审计，覆盖三页注册、导航标题、主题文案、hero 资产、页面直达兜底、样例定位结果、冲稳保推荐理由和专业方向来源。

最近一次验证结果：

- 北京高中库：195 所
- 官方本科普通批专业组：196 条
- 本地普通批/专业方向数据：96 条
- 北京非民办本科覆盖库：63 所
- 普通批核心层次推荐数据缺口：0
- 北京教育考试院选考要求参考院校：72 所
- 核心院校命中：5 / 5
- 首轮专业方向接入样例组：12 组

### 5.3 发布前预览

2026-05-19 最终预览已通过微信开发者工具 CLI：

- 预览二维码：`logs/preview-qr-final-release-2026-05-19.png`
- 预览信息：`logs/preview-info-final-release-2026-05-19.json`
- 包体大小：`1002.1 KB / 1026162 Byte`
- 开发者工具结果：`√ preview`

静态三页视觉预览：

- HTML：`output/page-preview/miniapp-ui-refresh-preview.html`
- 截图：`output/page-preview/miniapp-ui-refresh-preview.png`

### 5.2 红色警告处理原则

- 页面常规提示已改为蓝青/琥珀色，不再把普通数据口径提示做成红色警告。
- 代码层面未发现语法红错、乱码红错和数据覆盖红错。
- 若微信开发者工具 Console 仍有红色报错，优先判断是否为开发者工具自身、网络调试或 AppID/权限类问题；业务相关第一条错误需要继续定位。

## 6. 主要改动文件

- `miniprogram/app.wxss`
- `miniprogram/pages/school-rank-entry/index.wxml`
- `miniprogram/pages/position-result/index.wxml`
- `miniprogram/pages/position-result/index.wxss`
- `miniprogram/pages/volunteer-preview/index.wxml`
- `miniprogram/pages/volunteer-preview/index.js`
- `miniprogram/pages/volunteer-preview/index.wxss`
- `miniprogram/data/college-major-firstlook.js`
- `miniprogram/data/college-subject-requirement-firstlook.js`
- `miniprogram/data/major-catalog-status.js`
- `scripts/check_data.js`
- `scripts/build_ui_preview.js`

## 7. 可见预览产物

- HTML：`output/page-preview/miniapp-ui-refresh-preview.html`
- 截图：`output/page-preview/miniapp-ui-refresh-preview.png`

当前三页已经形成：

1. 鱼跃龙门：高考择校定位；
2. 步步登高 / 金榜有位：北京市位次参考；
3. 一举夺魁：推荐学校池。

## 8. 上线前剩余建议

1. 用真实微信开发者工具模拟器再手动走一遍：确认高中 -> 校排定位 -> 定位结果 -> 推荐学校池。
2. 如果准备正式上传，确认 AppID、合法域名、隐私协议和小程序类目。
3. 若要把“专业全面”做到可承诺，必须继续从 2026 官方招生计划/专业目录中结构化专业明细，不能用猜测数据补齐。
