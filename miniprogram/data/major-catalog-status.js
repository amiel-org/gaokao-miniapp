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
  userFacingStatus: "专业明细和限制条件已定位到官方专业目录，正在结构化核验中；填报前仍需逐项核对具体专业要求。",
};
