"""OCR the ordinary-batch pages of the official 2026 BJEEA catalog by column.

Full-page Tesseract OCR interleaves the four visual columns and makes college
blocks hard to parse.  This script splits pages 29-44 into four columns and
stores OCR text per column, which is the safer input for the full backfill.
"""

from __future__ import annotations

import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "output/major-catalog-review/2026-official-pages-clean"
OUT_DIR = ROOT / "data/staging/major_catalog_ocr/ordinary_columns"
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
TESSDATA = ROOT / ".tools/tessdata"
PAGE_START = int(os.environ.get("BJEAA_2026_ORDINARY_PAGE_START", "29"))
PAGE_END = int(os.environ.get("BJEAA_2026_ORDINARY_PAGE_END", "44"))
WORKERS = int(os.environ.get("BJEAA_2026_ORDINARY_OCR_WORKERS", "4"))


def crop_columns(page_no: int) -> list[Path]:
    image_path = IMAGE_DIR / f"p{page_no:03d}.jpg"
    if not image_path.exists():
        raise FileNotFoundError(image_path)
    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    crop_paths = []
    for col in range(4):
        # Small overlaps protect headings near column boundaries.
        x0 = max(0, int(col * width / 4) - 10)
        x1 = min(width, int((col + 1) * width / 4) + 10)
        crop_dir = OUT_DIR / "images"
        crop_dir.mkdir(parents=True, exist_ok=True)
        crop_path = crop_dir / f"p{page_no:03d}_c{col + 1}.png"
        if not crop_path.exists():
            image.crop((x0, 0, x1, height)).save(crop_path)
        crop_paths.append(crop_path)
    return crop_paths


def ocr_column(crop_path: Path) -> Path:
    text_dir = OUT_DIR / "text"
    text_dir.mkdir(parents=True, exist_ok=True)
    text_path = text_dir / (crop_path.stem + ".txt")
    if text_path.exists() and text_path.stat().st_size > 0:
        return text_path
    env = os.environ.copy()
    env["TESSDATA_PREFIX"] = str(TESSDATA)
    cmd = [str(TESSERACT), str(crop_path), "stdout", "-l", "chi_sim+eng", "--psm", "6"]
    completed = subprocess.run(
        cmd,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        timeout=180,
    )
    text_path.write_text(completed.stdout, encoding="utf-8")
    return text_path


def main() -> None:
    crops = []
    for page_no in range(PAGE_START, PAGE_END + 1):
        crops.extend(crop_columns(page_no))

    done = []
    with ThreadPoolExecutor(max_workers=max(1, WORKERS)) as executor:
        futures = {executor.submit(ocr_column, crop): crop for crop in crops}
        for future in as_completed(futures):
            text_path = future.result()
            done.append(text_path)
            print(f"ocr_done={text_path.relative_to(ROOT)}")

    print(f"pages={PAGE_END - PAGE_START + 1}")
    print(f"columns={len(crops)}")
    print(f"text_files={len(done)}")
    print(f"out={OUT_DIR}")


if __name__ == "__main__":
    main()
