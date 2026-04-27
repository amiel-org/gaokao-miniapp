from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF_DIR = ROOT / "data" / "reference"

PARAM_FILE = REF_DIR / "school_rank_estimation_parameter_backlog.v1.json"
LOG_FILE = REF_DIR / "school_rank_estimation_calibration_log.v1.json"
MANIFEST_FILE = REF_DIR / "school_rank_estimation_calibration_manifest.v1.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def next_version(version: str) -> str:
    major, minor = version.split(".v", 1)
    parts = minor.split(".")
    if len(parts) == 1:
        return f"{major}.v{parts[0]}.1"
    prefix = parts[:-1]
    patch = int(parts[-1]) + 1
    return f"{major}.v{'.'.join(prefix + [str(patch)])}"


def next_log_id(existing: list[dict]) -> str:
    if not existing:
        return "CAL-20260417-001"
    last = existing[-1]["log_id"]
    base, seq = last.rsplit("-", 1)
    return f"{base}-{int(seq)+1:03d}"


def main() -> None:
    raw = sys.stdin.read().strip()
    if not raw:
        print("Usage: echo '{...}' | python log_parameter_calibration.py", file=sys.stderr)
        sys.exit(1)

    payload = json.loads(raw)
    school_id = payload["school_id"]
    changes = payload["changes"]
    reason = payload["reason"]
    source = payload.get("source", "manual")
    operator = payload.get("operator", "Codex")
    logged_at = payload.get("logged_at", "2026-04-17T00:00:00+08:00")
    apply_changes = payload.get("apply_changes", False)

    params = load_json(PARAM_FILE)
    logs = load_json(LOG_FILE)
    manifest = load_json(MANIFEST_FILE)

    target = next((row for row in params if row["school_id"] == school_id), None)
    if not target:
        raise ValueError("school_id 未命中参数表")

    before = {key: target.get(key) for key in changes.keys()}
    after = deepcopy(before)
    after.update(changes)

    version_before = manifest["current_parameter_version"]
    version_after = next_version(version_before)

    log_entry = {
        "log_id": next_log_id(logs),
        "logged_at": logged_at,
        "school_id": target["school_id"],
        "official_name": target["official_name"],
        "district": target["district"],
        "parameter_version_before": version_before,
        "parameter_version_after": version_after,
        "change_type": payload.get("change_type", "manual_adjustment"),
        "changed_fields": list(changes.keys()),
        "before": before,
        "after": after,
        "reason": reason,
        "source": source,
        "operator": operator,
        "requires_backtest": payload.get("requires_backtest", True),
        "backtest_status": payload.get("backtest_status", "pending")
    }

    logs.append(log_entry)
    write_json(LOG_FILE, logs)

    manifest["last_log_id"] = log_entry["log_id"]
    manifest["last_updated_at"] = logged_at.split("T", 1)[0]
    if apply_changes:
        for key, value in changes.items():
            target[key] = value
        manifest["current_parameter_version"] = version_after
        write_json(PARAM_FILE, params)

    write_json(MANIFEST_FILE, manifest)
    print(json.dumps(log_entry, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
