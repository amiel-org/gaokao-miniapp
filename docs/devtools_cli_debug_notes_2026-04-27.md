# 微信开发者工具 CLI 调试记录

日期：2026-04-27

## 1. 背景

用户在微信开发者工具中看到调试器存在红色错误和黄色警告，希望 Codex 通过 CLI 模式直接连接开发者工具协助定位。

## 2. 本机 CLI 情况

已确认本机存在微信开发者工具 CLI：

`C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`

CLI 支持：

- `open`
- `preview`
- `upload`
- `build-npm`
- `auto`
- `quit`
- `cache`

## 3. 本次尝试

执行过：

```powershell
cli.bat auto --project D:\codex\school\gaokao-miniapp --port 9420 --trust-project
```

结果：

- 命令超时。
- 推测原因：微信开发者工具自动化服务端口未启用，或当前 IDE 会话未响应该 CLI 请求。

也尝试过：

```powershell
cli.bat preview --project D:\codex\school\gaokao-miniapp --qr-format terminal --port 3799
```

结果：

- 命令超时。
- 未生成 preview info 输出文件。

## 4. 当前可读取到的日志

已查看：

- `WeappLog/stdout.log`
- `WeappLog/stderr.log`

其中出现的红色日志大多是开发者工具自身 DevTools 面板的：

- `console.assert`
- `No document`
- USB descriptor
- cache / GPU cache

这些不一定是小程序业务代码错误。

## 5. 已做代码侧修复

发现小程序代码中存在 `??` 空值合并运算符。

为了兼容微信开发者工具基础库或编译器环境，已改成传统条件表达式：

文件：

`miniprogram/utils/school-rank-estimator.js`

原逻辑：

```js
const rankingWeight = rankingWeights[rankingBasis] ?? rankingWeights.unknown ?? 0.75;
```

已改为：

```js
const rankingWeight = rankingWeights[rankingBasis] !== undefined
  ? rankingWeights[rankingBasis]
  : (rankingWeights.unknown !== undefined ? rankingWeights.unknown : 0.75);
```

## 5.1 AppID 与安全信息错误

用户截图中的首个红色错误：

```text
SystemError (appServiceSDKScriptError)
{"errMsg":"webapi_getwxaasyncsecinfo:fail "}
```

CLI 连接服务端口 `38470` 后，执行 preview 得到更明确错误：

```text
AppID 不合法, invalid appid
Using AppID: touristappid
```

判断：

- 当前项目使用 `touristappid`，适合本地模拟器预览，但不适合 preview / upload 等需要合法 AppID 的能力。
- `webapi_getwxaasyncsecinfo:fail` 与游客 AppID / 测试环境取安全信息失败有关，不是当前业务代码直接抛错。

已在 `project.config.json` 中加入：

```json
"compileOptions": {
  "ignoreGetWXAsyncSecInfoError": true
}
```

同时将基础库版本从 `trial` 调整为当前私有配置一致的：

```json
"libVersion": "2.31.0"
```

注意：

- 如果要使用 `preview`、`upload` 或后续正式发布，需要换成合法的小程序 AppID。
- 仅在模拟器本地调试阶段，可以继续使用游客 / 测试号。

## 6. 仍需用户配合

如果要让 Codex 更准确定位微信开发者工具里的红色错误，需要用户在开发者工具中打开：

`设置 -> 安全 -> 服务端口`

或把 Console 红色报错内容复制 / 截图发给 Codex。

## 7. 后续建议

1. 在微信开发者工具里重新编译。
2. 清空 Console。
3. 重新走一遍操作流程。
4. 如果仍有红色错误，优先复制 Console 中第一条业务相关错误。

## 2026-04-28 表单与代码质量修复验证

本次根据微信开发者工具内反馈继续修复：

1. 校排入口页“一模 / 二模分数”改为两个独立选填输入框。
   - 去掉原来的“一模 / 二模 / 不确定”菜单。
   - 一模、二模后面均可直接填写成绩。
   - 两项都不填时仍可只按校排名估算。
   - 两项都填时当前前端优先采用二模，其次采用一模，作为 2025 位次参考。

2. 代码质量项“启动组件按需注入”修复。
   - 在 `miniprogram/app.json` 增加：
     - `lazyCodeLoading: "requiredComponents"`

3. 本地校验结果：
   - `node --check miniprogram/pages/school-rank-entry/index.js` 通过。
   - `python scripts/run_estimation_test_cases.py` 输出 `cases=14`。
   - `miniprogram/app.json` JSON 解析通过。
   - 关键文件编码检查通过，无连续问号乱码。

4. 微信开发者工具 CLI 预览结果：
   - 端口：`38470`
   - AppID：`wx21796206e965c6f2`
   - `preview` 成功。
   - 包体大小：`233.1 KB` / `238685 Byte`。
   - 输出文件：
     - `logs/preview-info-score-fields-2026-04-28.json`
     - `logs/preview-qr-score-fields-2026-04-28.png`
