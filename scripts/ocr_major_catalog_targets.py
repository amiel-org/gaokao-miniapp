
from pathlib import Path
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = Path(os.environ.get("MAJOR_CATALOG_PDF", str(ROOT / "data/raw/admissions/2025/bjeea_2025_admission_major_catalog.pdf")))
QUEUE_PATH = Path(os.environ.get("MAJOR_CATALOG_QUEUE", str(ROOT / "data/staging/major_catalog_target_review_queue.json")))
OUT_DIR = Path(os.environ.get("MAJOR_CATALOG_OCR_DIR", str(ROOT / "data/staging/major_catalog_ocr")))
IMAGES_DIR = OUT_DIR / "images"
TEXT_DIR = OUT_DIR / "text"
RESULT_PATH = OUT_DIR / "target_page_hits.json"
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
TESSDATA = ROOT / ".tools/tessdata"

# Page 14 starts the ordinary undergraduate catalog according to the contact sheet.
# OCR a bounded range first; this keeps the pipeline fast and auditable.
DEFAULT_PAGE_START = int(os.environ.get("MAJOR_OCR_START", "14"))
DEFAULT_PAGE_END = int(os.environ.get("MAJOR_OCR_END", "80"))


def load_targets():
    items = json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
    names = []
    for item in items:
        names.append({
            "collegeCode": item["collegeCode"],
            "collegeName": item["collegeName"],
            "targetGroups": item["targetGroups"],
        })
    return names


def render_page(doc, page_number):
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    out = IMAGES_DIR / f"page_{page_number:03d}.png"
    if out.exists():
        return out
    page = doc[page_number - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False)
    pix.save(out)
    return out


def ocr_image(image_path, page_number):
    TEXT_DIR.mkdir(parents=True, exist_ok=True)
    out = TEXT_DIR / f"page_{page_number:03d}.txt"
    if out.exists() and out.stat().st_size > 0:
        return out.read_text(encoding="utf-8", errors="ignore")
    env = os.environ.copy()
    env["TESSDATA_PREFIX"] = str(TESSDATA)
    cmd = [str(TESSERACT), str(image_path), "stdout", "-l", "chi_sim+eng", "--psm", "6"]
    completed = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=180)
    text = completed.stdout
    out.write_text(text, encoding="utf-8")
    return text


def compact(text):
    return re.sub(r"\s+", "", text)


def find_hits(page_text, targets):
    c = compact(page_text)
    hits = []
    for target in targets:
        name = target["collegeName"]
        code = target["collegeCode"]
        # OCR sometimes reads full-width quotes or drops spaces; code is more stable than name.
        if code in c or name in c:
            hits.append(target)
    return hits


def main():
    targets = load_targets()
    doc = fitz.open(PDF_PATH)
    page_start = max(1, int(os.environ.get("MAJOR_OCR_START", str(DEFAULT_PAGE_START))))
    page_end = min(int(os.environ.get("MAJOR_OCR_END", str(DEFAULT_PAGE_END))), doc.page_count)
    results = []
    pages = list(range(page_start, page_end + 1))

    def work(page_number: int):
        print(f"OCR page {page_number}/{page_end}")
        image = render_page(doc, page_number)
        text = ocr_image(image, page_number)
        hits = find_hits(text, targets)
        return page_number, image, text, hits

    with ThreadPoolExecutor(max_workers=int(os.environ.get("MAJOR_OCR_WORKERS", "4"))) as executor:
        futures = {executor.submit(work, page_number): page_number for page_number in pages}
        for future in as_completed(futures):
            page_number, image, text, hits = future.result()
            if hits:
                results.append({
                    "page": page_number,
                    "image": str(image.relative_to(ROOT)),
                    "text": str((TEXT_DIR / f"page_{page_number:03d}.txt").relative_to(ROOT)),
                    "hits": hits,
                })
                print("  hits:", ", ".join(f"{h['collegeCode']} {h['collegeName']}" for h in hits))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results.sort(key=lambda item: item["page"])
    RESULT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"pages_scanned={page_end - page_start + 1}")
    print(f"hit_pages={len(results)}")
    print(f"result={RESULT_PATH}")


if __name__ == "__main__":
    main()
