# 2026-06-08 会话丢失后的项目上下文恢复

## 当前结论

旧会话在当前 Codex 界面里看不到，但项目上下文没有完全丢：仓库里已经有 3 份 handoff 文档、当前未提交改动、验证脚本和 2026 招生计划接入状态，可以继续接上。

## 项目位置

- 工作区：`D:\codex\school`
- 小程序项目：`D:\codex\school\gaokao-miniapp`
- 当前分支：`codex/baseline-v1`

## 已恢复到的关键上下文

### 1. UI 与文案方向

- 产品名/核心入口：`高考择校定位`
- 数据口径标签：`2026 数据基线`
- 关键模块命名：`定位参数`、`推荐学校池`、`为什么推荐`
- 视觉：蓝青系为主，红色只用于真正错误态
- 三页主题：
  1. 首页：鱼跃龙门 / 高考择校定位
  2. 第二页：金榜有位、步步登高 / 北京市位次参考
  3. 第三页：一举夺魁 / 推荐学校池

### 2. 上线前优化状态

已有交接文档：

- `docs/handoff_2026-05-18_ui_refresh.md`
- `docs/handoff_2026-05-19_final_optimization.md`
- `docs/handoff_2026-05-20_2026_plan_connection.md`

其中 5 月 19 日记录显示：UI、文案、三页主题图、数据检查、预览二维码都已做到过一轮上线前打磨。

### 3. 2026 招生专业目录接入状态

5 月 20 日接入了北京教育考试院 2026 招生计划/专业目录管线，但当时官方源还没有返回可确认的 2026 本科普通批专业计划记录。

因此当前原则是：

- 不能用 2025 投档线、2024 选考要求或本地专业方向库冒充 2026 招生专业目录。
- 只有 `npm run check:release` 通过，才允许认为可上传审核。
- 如果官方 2026 目录已经发布，优先跑：

```bash
npm run monitor:plan2026:download
npm run check:release
```

### 4. 当前仓库状态

当前仓库不是干净状态，有大量未提交改动，主要集中在：

- `miniprogram/app.json`
- `miniprogram/app.wxss`
- `miniprogram/pages/school-rank-entry/*`
- `miniprogram/pages/position-result/*`
- `miniprogram/pages/volunteer-preview/*`
- `miniprogram/data/*`
- `scripts/*`
- `docs/*`
- `package.json`

这些改动看起来正是 UI 上线化、推荐页、2026 招生计划管线和检查脚本相关内容，不建议直接回滚。

## 建议下一步

1. 先跑当前状态验证：

```bash
npm run check:syntax
npm run check:data
npm run check:plan2026
npm run status:plan2026
```

2. 如果只是要继续开发 UI/流程，先不要强制 `check:release`，因为它会被 2026 官方目录缺失阻断，这是设计好的上线闸门。

3. 如果今天要看 2026 官方目录是否已发布，跑：

```bash
npm run monitor:plan2026:download
```

4. 如果要继续让 Codex 接手，优先从这三个问题开始：

- 是否先刷新 2026 招生专业目录状态？
- 是否先把当前未提交改动做一次验证和提交？
- 是否先打开/生成三页 UI 预览，确认页面效果？
