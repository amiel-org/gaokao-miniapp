# 参数校准记录机制

## 1. 目标

这套机制用于记录“校排转市排”参数层的每一次重要调整。

它解决 4 个问题：

- 谁改了参数
- 改了哪所学校
- 改了哪些字段
- 为什么改

同时它也用于回答：

- 改完之后是否需要重跑回测
- 当前参数表版本是什么
- 后续 2026 更新时，哪些历史校准经验需要继承

## 2. 当前组成

当前机制由 3 部分组成：

- `school_rank_estimation_parameter_backlog.v1.json`
  说明：当前生效的参数表

- `school_rank_estimation_calibration_log.v1.json`
  说明：参数校准日志

- `school_rank_estimation_calibration_manifest.v1.json`
  说明：日志与参数表版本状态

## 3. 记录原则

### 必须记录的变更

- 修改学校 `tier_code`
- 修改 `range_factor_min / max`
- 修改 `confidence_adjustment`
- 修改 `ranking_basis_weight`
- 修改 `score_reference_weight`
- 修改 `school_percentile_weight`
- 修改 `min_sample_size`

### 推荐记录的原因

- 回测样例表现不理想
- 某类学校口径过宽或过窄
- 主校 / 分校 / 校区关系影响估算
- 引入了新年度数据
- 用户反馈显示结果偏差明显

## 4. 日志字段

每条日志建议包含：

- `log_id`
- `logged_at`
- `school_id`
- `official_name`
- `district`
- `parameter_version_before`
- `parameter_version_after`
- `change_type`
- `changed_fields`
- `before`
- `after`
- `reason`
- `source`
- `operator`
- `requires_backtest`
- `backtest_status`

## 5. 当前工作流

建议按这个顺序执行：

1. 确认需要修改的学校与字段
2. 查看当前参数表中的旧值
3. 写入日志
4. 如确认生效，再应用到参数表
5. 更新 manifest 版本
6. 重跑回测样例库
7. 记录回测状态

## 6. 当前版本策略

当前建议版本号采用：

- `2025.v1.0`：2025 基线版
- `2025.v1.1`：小幅参数校准
- `2025.v1.2`：继续校准

也就是说：

- 大版本跟年份走
- 小版本跟参数校准迭代走

## 7. 后续年度更新建议

到 2026 年时：

1. 先复制 2025 的参数表与日志机制
2. 建立 `2026.v1.0`
3. 再逐年追加校准日志

不要把 2025 和 2026 的调参记录混成一堆。

