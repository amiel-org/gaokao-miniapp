
from pathlib import Path
import json
import math

import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "data/raw/admissions/2025/bjeea_2025_admission_major_catalog.pdf"
TARGETS_PATH = ROOT / "data/staging/current_recommendation_targets.json"
OUT_DIR = ROOT / "output/major-catalog-review"
MANIFEST_PATH = ROOT / "data/staging/major_catalog_review_manifest.json"


def load_targets():
    if not TARGETS_PATH.exists():
        return []
    return json.loads(TARGETS_PATH.read_text(encoding="utf-8"))


def render_contact_sheets():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    thumbs = []
    for i in range(doc.page_count):
        page = doc[i]
        pix = page.get_pixmap(matrix=fitz.Matrix(0.18, 0.18), alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        canvas = Image.new("RGB", (img.width, img.height + 28), "white")
        canvas.paste(img, (0, 0))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((0, img.height, img.width, img.height + 28), fill=(255, 255, 255))
        draw.text((8, img.height + 6), f"Page {i + 1}", fill=(180, 40, 30))
        thumbs.append(canvas)

    per_sheet = 20
    cols = 4
    sheets = []
    for start in range(0, len(thumbs), per_sheet):
        batch = thumbs[start:start + per_sheet]
        w = max(im.width for im in batch)
        h = max(im.height for im in batch)
        rows = math.ceil(len(batch) / cols)
        sheet = Image.new("RGB", (cols * w, rows * h), (236, 232, 225))
        for idx, im in enumerate(batch):
            x = (idx % cols) * w
            y = (idx // cols) * h
            sheet.paste(im, (x, y))
        out = OUT_DIR / f"major_catalog_contact_sheet_{start // per_sheet + 1:02d}.jpg"
        sheet.save(out, quality=88)
        sheets.append(str(out.relative_to(ROOT)))
    return doc.page_count, sheets


def write_manifest(page_count, sheets, targets):
    manifest = {
        "sourcePdf": "data/raw/admissions/2025/bjeea_2025_admission_major_catalog.pdf",
        "sourceUrl": "https://www.bjeea.cn/uploads/20250613/202506131926-3.pdf",
        "pageCount": page_count,
        "ocrStatus": "not_available_locally",
        "reviewMode": "manual_page_location_or_external_ocr",
        "contactSheets": sheets,
        "targetCount": len(targets),
        "targets": targets,
        "nextStep": "Use contact sheets to locate target colleges, then run OCR or manual transcription only on those pages.",
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"pages={page_count}")
    print(f"contact_sheets={len(sheets)}")
    print(f"targets={len(targets)}")
    print(f"manifest={MANIFEST_PATH}")


if __name__ == "__main__":
    targets = load_targets()
    pages, sheets = render_contact_sheets()
    write_manifest(pages, sheets, targets)
