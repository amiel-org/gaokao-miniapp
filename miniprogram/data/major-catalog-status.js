module.exports = {
  year: 2025,
  source: {
    publisher: "北京教育考试院",
    title: "2025普通高等学校招生专业目录",
    url: "https://www.bjeea.cn/uploads/20250613/202506131926-3.pdf",
    localPath: "data/raw/admissions/2025/bjeea_2025_admission_major_catalog.pdf",
  },
  extraction: {
    status: "pending_ocr",
    reason: "官方专业目录 PDF 为扫描/图片型文件，直接文本抽取为空，需要 OCR 或人工校验后结构化。",
    checkedAt: "2026-04-28",
  },
  latestCatalogStatus: {
    year: 2026,
    checkedAt: "2026-05-18",
    status: "not_confirmed_published",
    note: "截至 2026-05-18，未确认北京教育考试院已发布可下载的 2026 普通高等学校招生专业目录普通批 PDF。",
  },
  userFacingStatus: "当前先按 2025 官方投档线和本地专业方向库做首轮初筛；2026 官方专业目录发布后再同步更新，填报前仍需逐项核对具体专业要求。",
};
