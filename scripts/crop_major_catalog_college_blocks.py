
from pathlib import Path
import json
import os
import re
import subprocess

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OCR_ROOT = Path(os.environ.get("MAJOR_CATALOG_OCR_DIR", str(ROOT / "data/staging/major_catalog_ocr")))
HITS_PATH = Path(os.environ.get("MAJOR_CATALOG_HITS", str(OCR_ROOT / "target_page_hits.json")))
IMAGES_DIR = Path(os.environ.get("MAJOR_CATALOG_IMAGES_DIR", str(OCR_ROOT / "images")))
OUT_DIR = Path(os.environ.get("MAJOR_CATALOG_BLOCKS_DIR", str(OCR_ROOT / "college_blocks")))
DOC_DIR = Path(os.environ.get("MAJOR_CATALOG_REVIEW_DIR", str(ROOT / "output/major-catalog-review/college-blocks")))
MANIFEST_PATH = Path(os.environ.get("MAJOR_CATALOG_MANIFEST", str(OCR_ROOT / "college_block_manifest.json")))
SUMMARY_MD = Path(os.environ.get("MAJOR_CATALOG_SUMMARY_MD", str(ROOT / "docs/major_catalog_college_block_review.md")))
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
TESSDATA = ROOT / ".tools/tessdata"

# The rendered page images were created at 2.5x scale. Tesseract TSV boxes use
# image pixel coordinates, so no PDF coordinate transform is needed.

def run_tesseract_tsv(image_path):
    env = os.environ.copy()
    env["TESSDATA_PREFIX"] = str(TESSDATA)
    cmd = [str(TESSERACT), str(image_path), "stdout", "-l", "chi_sim+eng", "--psm", "6", "tsv"]
    completed = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=180)
    return completed.stdout


def parse_tsv(tsv):
    rows = []
    lines = [line for line in tsv.splitlines() if line.strip()]
    if not lines:
        return rows
    header = lines[0].split("\t")
    for line in lines[1:]:
        cols = line.split("\t")
        if len(cols) < len(header):
            continue
        item = dict(zip(header, cols))
        text = item.get("text", "").strip()
        if not text:
            continue
        try:
            item["left"] = int(float(item["left"]))
            item["top"] = int(float(item["top"]))
            item["width"] = int(float(item["width"]))
            item["height"] = int(float(item["height"]))
        except Exception:
            continue
        rows.append(item)
    return rows


def locate_code(rows, code):
    # Prefer exact token match. Fallback to token containing code.
    exact = [r for r in rows if r.get("text") == code]
    if exact:
        return sorted(exact, key=lambda r: (r["top"], r["left"]))[0]
    loose = [r for r in rows if code in r.get("text", "")]
    if loose:
        return sorted(loose, key=lambda r: (r["top"], r["left"]))[0]
    return None


def make_crop_box(image, row):
    w, h = image.size
    x = row["left"]
    y = row["top"]
    # Professional catalog pages are multi-column. Use the code position to infer
    # a local block. Keep width narrow enough to avoid neighboring columns, height
    # tall enough to include several groups.
    col_width = max(760, int(w * 0.28))
    x0 = max(0, x - 40)
    x1 = min(w, x0 + col_width)
    if x1 - x0 < 620:
        x0 = max(0, x1 - 760)
    y0 = max(0, y - 60)
    y1 = min(h, y0 + 980)
    return (x0, y0, x1, y1)


def ocr_crop(crop_path):
    env = os.environ.copy()
    env["TESSDATA_PREFIX"] = str(TESSDATA)
    cmd = [str(TESSERACT), str(crop_path), "stdout", "-l", "chi_sim+eng", "--psm", "6"]
    completed = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=180)
    return completed.stdout


def grid_boxes(image):
    w, h = image.size
    boxes = []
    # Most pages are 4 visual columns and multiple vertical bands. Overlap bands
    # to avoid cutting a college block in half.
    cols = 4
    col_w = w // cols
    bands = [
        (0, int(h * 0.42)),
        (int(h * 0.28), int(h * 0.70)),
        (int(h * 0.56), h),
    ]
    for ci in range(cols):
        x0 = max(0, ci * col_w - 20)
        x1 = min(w, (ci + 1) * col_w + 20)
        for bi, (y0, y1) in enumerate(bands):
            boxes.append((ci, bi, (x0, y0, x1, y1)))
    return boxes


def compact_text(text):
    return re.sub(r"\s+", "", text)


def target_matches(text, code, name):
    c = compact_text(text)
    # OCR may miss code but catch college name. Name matching is useful after
    # grid crop because neighboring colleges are less likely inside the crop.
    return code in c or name in c


def main():
    hits = json.loads(HITS_PATH.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    DOC_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    cache = {}
    for page in hits:
        page_no = page["page"]
        image_path = ROOT / page["image"]
        if not image_path.exists():
            image_path = IMAGES_DIR / f"page_{page_no:03d}.png"
        image = Image.open(image_path).convert("RGB")
        page_grid = []
        for ci, bi, box in grid_boxes(image):
            crop = image.crop(box)
            stem = f"p{page_no:03d}_c{ci}_b{bi}"
            crop_path = OUT_DIR / f"{stem}.png"
            if not crop_path.exists():
                crop.save(crop_path)
            text_path = OUT_DIR / f"{stem}.txt"
            if text_path.exists() and text_path.stat().st_size > 0:
                text = text_path.read_text(encoding="utf-8", errors="ignore")
            else:
                text = ocr_crop(crop_path)
                text_path.write_text(text, encoding="utf-8")
            page_grid.append({"ci": ci, "bi": bi, "box": box, "crop": crop_path, "textPath": text_path, "text": text})

        for hit in page["hits"]:
            code = hit["collegeCode"]
            name = hit["collegeName"]
            matches = [g for g in page_grid if target_matches(g["text"], code, name)]
            if not matches:
                manifest.append({
                    "page": page_no,
                    "collegeCode": code,
                    "collegeName": name,
                    "status": "grid_block_not_matched",
                    "targetGroups": hit.get("targetGroups", []),
                })
                continue
            # Keep up to 2 matches for manual review; the first is usually enough,
            # but overlap bands may produce duplicates.
            for mi, g in enumerate(matches[:2]):
                stem = f"p{page_no:03d}_{code}_m{mi+1}"
                review_path = DOC_DIR / f"{stem}.png"
                Image.open(g["crop"]).save(review_path)
                preview = image.copy()
                draw = ImageDraw.Draw(preview)
                draw.rectangle(g["box"], outline=(220, 30, 20), width=8)
                preview_path = DOC_DIR / f"{stem}_source_box.jpg"
                preview.save(preview_path, quality=88)
                manifest.append({
                    "page": page_no,
                    "collegeCode": code,
                    "collegeName": name,
                    "targetGroups": hit.get("targetGroups", []),
                    "status": "grid_crop_ocr_matched",
                    "crop": str(g["crop"].relative_to(ROOT)),
                    "reviewImage": str(review_path.relative_to(ROOT)),
                    "sourceBoxImage": str(preview_path.relative_to(ROOT)),
                    "ocrText": str(g["textPath"].relative_to(ROOT)),
                    "box": g["box"],
                    "matchIndex": mi + 1,
                    "ocrPreview": g["text"][:500],
                })
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# 专业目录院校块裁切审核清单",
        "",
        "日期：2026-04-28",
        "",
        "本清单由网格裁切 + OCR 匹配生成，用于人工核对专业组边界。图片和 OCR 文本属于过程文件，不提交 Git。",
        "",
        "| 页码 | 院校代码 | 院校名称 | 目标专业组 | 状态 | 审核图 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for item in manifest:
        groups = "、".join(sorted({g.get("groupCode", "") + "组" for g in item.get("targetGroups", []) if g.get("groupCode")}))
        review = item.get("reviewImage", "")
        lines.append(f"| {item['page']} | {item['collegeCode']} | {item['collegeName']} | {groups} | {item['status']} | {review} |")
    SUMMARY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"blocks={len(manifest)}")
    print(f"matched={sum(1 for x in manifest if x['status']=='grid_crop_ocr_matched')}")
    print(f"manifest={MANIFEST_PATH}")
    print(f"summary={SUMMARY_MD}")


if __name__ == "__main__":
    main()
