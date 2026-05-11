# 2025 北京招生专业目录结构化管线

日期：2026-04-28  
适用项目：北京高考志愿填报小程序 V1

## 1. 官方来源

已定位并下载北京教育考试院官方材料：

- 文件：`2025普通高等学校招生专业目录`
- 本地路径：`data/raw/admissions/2025/bjeea_2025_admission_major_catalog.pdf`
- 官方页面：北京教育考试院 2025 年普通高等学校招生专业目录相关通知页
- 附件地址：`https://www.bjeea.cn/uploads/20250613/202506131926-3.pdf`

说明：原始文件在 `.gitignore` 下，不进入 Git；后续脚本应支持按官方 URL 重新下载。

## 2. 当前解析结果

已用 PyMuPDF 做文本抽取探测：

- PDF 页数：115 页。
- 直接文本抽取结果基本为空。
- 判断：该 PDF 为扫描/图片型 PDF，不能像投档线 PDF 一样直接结构化抽表。

因此当前不能直接把专业明细、招生计划、体检限制写入正式数据，避免误抽和猜测。

## 3. 推荐处理路线

### 路线 A：OCR 批处理

1. 按页渲染图片。
2. 使用 OCR 提取文本。
3. 按院校代码、专业组代码、专业代码、专业名称、计划数、备注进行结构化。
4. 输出 staging 文件。
5. 人工抽样校验后进入 processed。

### 路线 B：局部优先 OCR

优先处理当前 `college-admission-groups.js` 中已经进入推荐卡片的院校专业组，而不是一次性 OCR 全量目录。

优点：

- 更快进入产品可用状态。
- 先覆盖用户看得到的推荐卡片。
- 降低 OCR 全量误差。

## 4. 数据状态约定

在专业目录结构化完成前，前端和数据层统一使用：

```json
{
  "majorDetailStatus": "pending_ocr",
  "majorDetailSource": "official_scanned_catalog",
  "restrictionStatus": "pending_review"
}
```

展示话术使用：

> 专业明细和限制条件已定位到官方专业目录，正在结构化核验中；填报前仍需逐项核对具体专业要求。

禁止展示：

- “正式版会接入”
- “这只是预览”
- “不是最终推荐”

这些属于开发话术，不出现在用户界面。

## 5. 下一步

建议下一步建立脚本：

- `scripts/build_major_catalog_ocr_seed.py`

第一版只做：

1. 渲染指定页到图片。
2. 支持手动指定院校代码页范围。
3. 输出 OCR 原文缓存。
4. 暂不直接进入正式数据。

## 6. 2026-04-28 局部核验准备产物

已基于当前冲稳保推荐逻辑，提取出可能命中的院校专业组：

- 推荐目标专业组：33 个。
- 涉及院校：21 所。
- 目标清单：`data/staging/major_catalog_target_review_queue.json`。
- 可读清单：`docs/major_catalog_target_review_queue.md`。

已为扫描版专业目录生成缩略索引图：

- `output/major-catalog-review/major_catalog_contact_sheet_01.jpg`
- `output/major-catalog-review/major_catalog_contact_sheet_02.jpg`
- `output/major-catalog-review/major_catalog_contact_sheet_03.jpg`
- `output/major-catalog-review/major_catalog_contact_sheet_04.jpg`
- `output/major-catalog-review/major_catalog_contact_sheet_05.jpg`
- `output/major-catalog-review/major_catalog_contact_sheet_06.jpg`

索引图和 staging JSON 默认不提交 Git；文档清单提交，方便后续接续。

当前本机未检测到可用 OCR 引擎：

- 未发现 `tesseract`。
- 未安装 `pytesseract` / `easyocr` / `paddleocr`。

下一步建议：安装 OCR 能力后，先处理 `major_catalog_target_review_queue.md` 里的 21 所院校，不做全量 115 页 OCR。

## 7. 2026-04-28 OCR 安装与首轮定位结果

已安装 OCR 能力：

- Tesseract：`C:\Program Files\Tesseract-OCR\tesseract.exe`
- Python 调用层：`pytesseract`
- 中文语言包：项目本地 `.tools/tessdata/chi_sim.traineddata`

首轮 OCR 范围：

- 第 14 页至第 45 页。
- 命中目标院校页：21 个页记录。
- 结果摘要：`docs/major_catalog_ocr_excerpts.md`

新增脚本：

- `scripts/ocr_major_catalog_targets.py`：渲染并 OCR 指定页范围，定位目标院校。
- `scripts/extract_major_catalog_excerpts.py`：从 OCR 文本中截取目标院校附近片段。
- `scripts/build_major_catalog_candidate_seed.py`：尝试抽取专业候选种子。

重要结论：

自动抽取专业明细暂不能直接使用。原因是官方专业目录为扫描版、多栏排版，OCR 文本会串列，不同院校和专业组内容可能混在一起。当前自动候选只作为调试过程文件，不进入正式数据、不接入前端。

下一步应改为院校块裁切：先定位目标院校所在页，再裁切单个院校区域，最后对裁切区域 OCR 并人工校验。

## 8. 2026-04-28 院校块裁切结果

已新增院校块裁切脚本：

- `scripts/crop_major_catalog_college_blocks.py`

处理方式：

1. 对命中页做网格裁切。
2. 对每个裁切块做 OCR。
3. 用院校代码 / 院校名称匹配目标院校。
4. 输出审核用院校块图片和源页框选图。

本轮结果：

- 生成审核记录：91 条。
- 成功匹配裁切块：89 条。
- 审核清单：`docs/major_catalog_college_block_review.md`。
- 过程图片：`output/major-catalog-review/college-blocks/`，不提交 Git。

质量判断：

- 裁切块明显比整页 OCR 更可控。
- 但仍存在裁到邻近院校、目标院校跨栏或跨页的风险。
- 当前结果仍只进入审核清单，不直接写入正式推荐数据。

下一步：针对审核图人工确认边界，优先挑选 3-5 个高频院校专业组，人工校验后生成第一批 `college_major_details` 正式种子。

## 9. 2026-05-11 第一批专业明细草稿

在用户确认裁切块整体可用后，已新增第一批专业明细草稿生成脚本：

- `scripts/build_verified_major_seed_draft.py`

处理方式：

1. 读取 `college_block_manifest.json` 中已匹配的院校裁切块。
2. 按院校代码、专业组代码截取对应 OCR 文本。
3. 用规则提取专业代码、专业名称和招生计划数。
4. 输出人工审核草稿，不进入正式前端数据。

本轮结果：

- 草稿专业组数：10 个。
- 已抽取到候选专业的专业组数：9 个。
- staging JSON：`data/staging/major_catalog_ocr/college_major_details_draft.json`。
- 审核文档：`docs/college_major_details_draft_review.md`。

质量判断：

- 裁切块路线已能形成可审核的专业组草稿。
- OCR 仍存在文字误识别、跨组选取、计划数错配风险。
- 当前数据状态统一标记为 `needs_human_confirm`，不得直接接入正式推荐。

下一步：

1. 人工对照审核图校正 10 个专业组的专业名称、计划数、体检限制和色弱限制。
2. 将确认后的记录写入正式 `college_major_details` seed。
3. 再由前端读取“已核验专业明细”，未核验项继续展示官方目录待核验提示。
