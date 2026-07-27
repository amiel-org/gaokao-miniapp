# 微信开发者工具导入项目指南

日期：2026-04-27

## 1. 当前项目路径

导入微信开发者工具时，项目目录请选择：

`D:\codex\school\gaokao-miniapp`

注意：不要选择 `D:\codex\school\gaokao-miniapp\miniprogram`。

原因是项目根目录下有：

- `project.config.json`
- `miniprogram/`
- `cloudfunctions/`

微信开发者工具会根据 `project.config.json` 识别小程序源码目录。

## 2. 当前项目配置

当前配置文件：

`project.config.json`

关键配置：

```json
{
  "appid": "wx21796206e965c6f2",
  "projectname": "gaokao-miniapp",
  "compileType": "miniprogram",
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/"
}
```

这说明：

- 项目类型是小程序。
- 小程序源码在 `miniprogram/`。
- 云函数目录预留在 `cloudfunctions/`。
- 当前配置已写入项目 AppID，导入时按 `project.config.json` 即可。

## 3. 导入步骤

1. 打开微信开发者工具。
2. 用微信扫码登录。
3. 选择“小程序”。
4. 点击“导入”。
5. 项目目录选择：

   `D:\codex\school\gaokao-miniapp`

6. AppID：
   - 如果已有正式小程序 AppID，就填写正式 AppID。
   - 如果还没有，就选择“测试号”或“无 AppID / 游客模式”（以工具界面显示为准）。
7. 项目名称可以写：

   `gaokao-miniapp`

8. 点击“导入”。

## 4. 导入后应该看到什么

左侧文件树应能看到：

- `miniprogram/app.json`
- `miniprogram/pages/cover/index`
- `miniprogram/pages/school-rank-entry/index`
- `miniprogram/pages/position-result/index`
- `miniprogram/pages/volunteer-preview/index`
- `miniprogram/data/`
- `miniprogram/utils/`

模拟器默认应先打开金红封面页，再进入校排填写页。

## 5. 首次导入后建议检查

### 5.1 看控制台

打开底部“调试器 / Console”，看有没有红色错误。

### 5.2 点一次完整流程

建议测试：

1. 先点金红封面页的“开始定位”。
2. 选择所在区。
3. 搜索高中。
4. 选中学校。
5. 输入校排名。
6. 输入年级总人数。
7. 选择排名口径。
8. 如已出分，补填最终成绩。
9. 点击查看北京定位结果。
10. 确认能跳转到结果页。

### 5.3 暂时不需要构建 npm

当前项目没有使用小程序 npm 包。

所以首次导入时，如果看到“构建 npm”，可以先不用点。

## 6. 常见问题

### 问题 1：导入后找不到页面

大概率是目录选错了。

请确认选择的是：

`D:\codex\school\gaokao-miniapp`

而不是：

`D:\codex\school\gaokao-miniapp\miniprogram`

### 问题 2：提示 AppID 不对

如果你现在只是本地开发，可以先选择测试号或无 AppID 模式。

正式上线前再换成真实 AppID。

### 问题 3：控制台有云开发相关提示

当前项目只是预留了 `cloudfunctions/` 目录，还没有正式使用云开发。

如果只是预览当前页面，可以先忽略云开发环境相关提示。

### 问题 4：中文显示乱码

当前项目文件实际是 UTF-8。优先不要手动另存为 GBK。

如果微信开发者工具里出现乱码或报错，把截图发给 Codex 继续修。

## 7. 验收结果记录

首次导入后，建议记录：

- 是否能正常编译。
- 是否能进入校排入口页。
- 是否能搜索学校。
- 是否能跳转北京定位结果页。
- Console 是否有红色报错。
