"""Import downloaded official BJEEA 2026 catalog files when usable.

The discovery script can download official PDF/Excel/CSV candidates into
data/raw/admissions/2026. This sync script tries those files in a safe staging
area first. It only promotes a parsed result to the main pipeline file when the
importer returns at least one Beijing ordinary-undergraduate target record.

It intentionally does not overwrite the current /plan/115 evidence with empty
or unparseable files.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "admissions" / "2026"
STAGING_DIR = ROOT / "data" / "staging" / "bjeea_admission_plan_2026"
DISCOVERY_PATH = STAGING_DIR / "bjeea_2026_catalog_source_discovery.json"
MAIN_STAGING_PATH = STAGING_DIR / "bjeea_2026_admission_plan.json"
ATTEMPT_DIR = STAGING_DIR / "import_attempts"
SUPPORTED_EXCEL = {".xlsx", ".xlsm", ".xltx", ".xltm"}
SUPPORTED_PDF = {".pdf"}


def run_importer(file_path: Path, output_path: Path) -> dict[str, object]:
    suffix = file_path.suffix.lower()
    if suffix in SUPPORTED_EXCEL:
        command = [
            sys.executable,
            str(ROOT / "scripts" / "import_bjeea_2026_admission_plan_excel.py"),
            str(file_path),
            "--output",
            str(output_path),
        ]
    elif suffix in SUPPORTED_PDF:
        command = [
            sys.executable,
            str(ROOT / "scripts" / "import_bjeea_2026_admission_plan_pdf.py"),
            str(file_path),
            "--output",
            str(output_path),
        ]
    else:
        return {"file": str(file_path), "status": "unsupported_extension", "recordCount": 0}

    completed = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    result: dict[str, object] = {
        "file": str(file_path),
        "output": str(output_path),
        "command": command,
        "returncode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }
    if output_path.exists():
        try:
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            result.update(
                {
                    "status": payload.get("status", "imported"),
                    "recordCount": int(payload.get("recordCount") or 0),
                    "schoolIndexCount": int(payload.get("schoolIndexCount") or 0),
                }
            )
        except Exception as error:
            result.update({"status": "output_parse_error", "recordCount": 0, "error": str(error)})
    else:
        result.update({"status": "no_output", "recordCount": 0})
    return result


def candidate_files() -> list[Path]:
    files: list[Path] = []
    if DISCOVERY_PATH.exists():
        try:
            discovery = json.loads(DISCOVERY_PATH.read_text(encoding="utf-8"))
            for item in discovery.get("downloadedOfficialFiles", []) or []:
                if item.get("ok") and item.get("localPath"):
                    path = ROOT / str(item["localPath"])
                    if path.exists():
                        files.append(path)
        except Exception:
            pass
    if RAW_DIR.exists():
        for path in RAW_DIR.iterdir():
            if path.is_file() and path.suffix.lower() in (SUPPORTED_EXCEL | SUPPORTED_PDF):
                files.append(path)
    seen: set[str] = set()
    unique: list[Path] = []
    for path in files:
        key = str(path.resolve()).lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    return unique


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-ready", action="store_true", help="Exit non-zero when no downloaded file can be promoted.")
    args = parser.parse_args()

    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    ATTEMPT_DIR.mkdir(parents=True, exist_ok=True)
    files = candidate_files()
    attempts: list[dict[str, object]] = []
    promoted: dict[str, object] | None = None
    for index, file_path in enumerate(files, 1):
        safe_name = file_path.stem.replace(" ", "_")
        output_path = ATTEMPT_DIR / f"{index:02d}_{safe_name}.json"
        attempt = run_importer(file_path, output_path)
        attempts.append(attempt)
        if int(attempt.get("recordCount") or 0) > 0 and output_path.exists():
            shutil.copyfile(output_path, MAIN_STAGING_PATH)
            promoted = attempt
            break

    report = {
        "candidateFileCount": len(files),
        "promoted": promoted is not None,
        "promotedFile": promoted.get("file") if promoted else None,
        "promotedRecordCount": int(promoted.get("recordCount") or 0) if promoted else 0,
        "mainStagingPath": str(MAIN_STAGING_PATH.relative_to(ROOT)),
        "attempts": attempts,
    }
    report_path = STAGING_DIR / "bjeea_2026_downloaded_catalog_import_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["candidateFileCount", "promoted", "promotedFile", "promotedRecordCount"]}, ensure_ascii=False, indent=2))
    print(f"saved {report_path}")
    if args.require_ready and not promoted:
        raise SystemExit("no downloaded official 2026 catalog file could be promoted to staging.")


if __name__ == "__main__":
    main()
