# 产品手册增量：北京定位结果页与校排入口衔接

## 1. 本次目标

本次把“校排入口页”从单页原型推进为两页产品链路：

1. 用户在校排入口页选择所在区、高中、校排名、年级总人数、排名口径，并可选输入分数。
2. 页面基于 2025 真实导出数据模块生成定位结果。
3. 点击后跳转到北京定位结果页。
4. 结果页集中展示市排名区间、定位段位、置信度、风险提示和下一步建议。

## 2. 当前页面

- `miniprogram/pages/school-rank-entry/index`：校排入口页。
- `miniprogram/pages/position-result/index`：北京定位结果页。

## 3. 当前数据衔接

入口页当前读取：

- `miniprogram/data/school-library.js`
- `miniprogram/data/school-estimation-params.js`
- `miniprogram/data/beijing-rank-map.js`

入口页生成统一 payload：

- `source`
- `baselineYear`
- `generatedAt`
- `input`
- `result`

并通过：

```js
wx.setStorageSync("latestPositionResult", payload)
```

传给结果页。

## 4. 结果页展示字段

结果页展示：

- 学校简称
- 北京市排名区间
- 所在区 / 实体类型 / 排名口径
- 校内百分位
- 置信度
- 参数梯队
- 风险提醒
- 本次输入回看
- 下一步建议

## 5. 重要边界

当前仍属于“前端同口径接口原型”，不是最终后端架构。

正式产品中建议替换为：

1. 入口页调用搜索 API。
2. 入口页调用估算 API。
3. 后端返回 `request_id/result_id` 与估算结果。
4. 结果页按 `result_id` 拉取结果。

这样可以保留计算日志、支持回测、支持后续客服追溯，也能避免用户端缓存造成结果丢失。

## 6. 下一步建议

优先做两件事：

1. 抽取 `searchSchools` 与 `estimateCityRank` 到 `miniprogram/utils/`，避免页面里堆业务逻辑。
2. 做院校专业组推荐页原型，让“继续看冲稳保”按钮有真实去向。
