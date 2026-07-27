# 2026-05-18 UI 与文案上线化打磨记录

## 1. 本次目标

把小程序从“工程原型感”打磨到更接近可上线版本：

- 首页不再叫“校排入口”，改为“高考择校定位”。
- 首页顶部只保留“2026 数据基线”，弱化冗余说明。
- 文案从家长口语改为更克制、专业、高级的择校产品表达。
- 主色调从暖棕/砖红改为蓝青系，红色只保留真正错误场景。
- 最后一页显性展示“为什么推荐”，让冲稳保学校推荐理由成为核心模块。

## 2. 视觉方向

采用蓝青主色：

- 主蓝：#1687d9
- 青色辅助：#17a9b5
- 深蓝强调：#102f4a
- 页面背景：#f7fbff / #eef6ff
- 提示色：琥珀色轻提示，不再使用红色警告块

理由：教育/升学产品需要可信、清爽、理性；蓝色负责信任和专业感，青色负责轻量和现代感。红色容易造成“报错/风险”感，不适合作为常规主色。

## 3. 页面改动

### 3.1 首页 `pages/school-rank-entry/index`

核心文案：

- 标题：高考择校定位
- 标签：2026 数据基线
- 主说明：以校排、年级规模与选科组合为起点，建立北京市位次锚点，再进入冲稳保择校路径。
- 表单区：定位参数
- CTA：生成择校定位

字段表述：

- “搜索高中”改为“就读高中”
- “校排名”改为“校排”
- “年级总人数”改为“年级规模”
- “排名口径”改为“校排口径”

### 3.2 定位结果页 `pages/position-result/index`

核心文案：

- 顶部标签：2026 数据基线
- 位次区块：北京市位次参考区间
- 说明：用于建立择校判断的参考坐标，不构成录取承诺。
- 模块：结果解读、校准提示、输入摘要、下一步

### 3.3 冲稳保页 `pages/volunteer-preview/index`

核心文案：

- 顶部：冲稳保择校
- 标题：某某学校的推荐学校池
- 说明：每所学校先说明推荐理由，再进入专业组精筛。

每张学校卡片新增/前置：

- 为什么推荐
  - 位次匹配理由
  - 选科匹配理由
  - 专业方向来源理由
- 建议重点查看的专业方向
- 风险/数据口径提示

## 4. 数据与验证

新增校验脚本：

- `scripts/check_syntax.js`
- `scripts/check_data.js`

更新 npm scripts：

- `npm run check:syntax`
- `npm run check:data`
- `npm run check:estimation`
- `npm run check:all`

当前 `npm run check:all` 已通过：

- JS/JSON 语法：23 个文件通过
- 数据完整性：
  - schools: 195
  - estimationParams: 195
  - scoreRankPoints: 318
  - subjectCombinations: 20
  - admissionGroups: 196
  - localPrograms: 96
  - undergraduateCoverage: 63
- 估算回测：cases=14

微信开发者工具 CLI preview 已通过，包体：832.5 KB / 852432 Byte。

## 5. 预览产物

- `output/page-preview/miniapp-ui-refresh-preview.html`
- `output/page-preview/miniapp-ui-refresh-preview.png`

## 6. 仍需注意

页面展示已按“2026 数据基线”处理；底层历史投档线/专业组仍保留数据来源说明，正式上线前需要在产品口径里说明“以 2026 可用数据为基线，历史投档线作为校准参考”。
