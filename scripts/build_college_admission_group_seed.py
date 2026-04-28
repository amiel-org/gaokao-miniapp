from pathlib import Path
import json
import re
from urllib.request import urlretrieve

import fitz


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "data/raw/admissions/2025/bjeea_2025_undergraduate_regular_batch_cutoff.pdf"
PDF_URL = "https://www.bjeea.cn/uploads/soft/250720/178-250H0201058.pdf"
OUT_JSON = ROOT / "data/processed/college_admission_groups_2025_seed.json"
OUT_JS = ROOT / "miniprogram/data/college-admission-groups.js"
RANK_MAP_JS = ROOT / "miniprogram/data/beijing-rank-map.js"

PLUS = "\uFF0B"
UNLIMITED = "\u4E0D\u9650"
COOP = "\u4E2D\u5916\u5408\u529E"
FEMALE = "\u5973"
SUBJECTS = [
    "\u7269\u7406",
    "\u5316\u5B66",
    "\u751F\u7269",
    "\u601D\u60F3\u653F\u6CBB",
    "\u5386\u53F2",
    "\u5730\u7406",
]

# Hand-picked official cutoff seed groups for the prototype. These rows are
# parsed from the local official Beijing Education Examination Authority 2025
# undergraduate regular batch cutoff PDF, not guessed. Keep the whitelist small
# until the full admissions-data pipeline is built and reviewed.
SEED_COLLEGE_CODES = {
    "1021", "1022", "1023", "1025", "1026", "1027", "1028", "1029", "1030", "1031",
    "1032", "1033", "1035", "1036", "1037", "1038", "1040", "1041", "1042", "1043",
    "1044", "1045", "1051", "1052", "1053", "1055", "1056", "1057", "1058", "1060",
    "1061", "1062", "1063", "1065", "1066", "1067", "1068", "1069", "1070", "1071",
    "1072", "1073", "1074", "1075", "1076", "1077", "1078", "1079", "1080", "1081",
}


def load_rank_map():
    text = RANK_MAP_JS.read_text(encoding="utf-8-sig")
    text = text.replace("module.exports =", "").strip()
    if text.endswith(";"):
        text = text[:-1]
    return {int(k): int(v) for k, v in json.loads(text).items()}


def normalize_requirement(req):
    raw = req.strip().replace("+", PLUS)
    work = raw
    extra_flags = []

    for flag in (COOP, FEMALE):
        marker = f"({flag})"
        if marker in work:
            extra_flags.append(flag)
            work = work.replace(marker, "")

    if work == UNLIMITED:
        return {
            "raw": raw,
            "subjects": [],
            "mode": "unlimited",
            "extraFlags": extra_flags,
        }

    parts = [p for p in re.split(PLUS, work) if p]
    unknown = [p for p in parts if p not in SUBJECTS]
    if unknown:
        raise ValueError(f"Unknown subject requirement: {raw} -> {unknown}")
    return {
        "raw": raw,
        "subjects": parts,
        "mode": "all_required",
        "extraFlags": extra_flags,
    }


def ensure_pdf():
    if PDF_PATH.exists():
        return
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    urlretrieve(PDF_URL, PDF_PATH)


def extract_records():
    ensure_pdf()
    doc = fitz.open(PDF_PATH)
    records = []
    for page in doc:
        lines = [line.strip() for line in page.get_text("text").splitlines() if line.strip()]
        i = 0
        while i + 3 < len(lines):
            if not re.fullmatch(r"\d+", lines[i]):
                i += 1
                continue
            seq = int(lines[i])
            college_line = lines[i + 1]
            group_line = lines[i + 2]
            score_line = lines[i + 3]
            if not re.match(r"^\d{4}\s+", college_line):
                i += 1
                continue
            if not re.match(r"^\d{2}\s+", group_line):
                i += 1
                continue
            if not re.fullmatch(r"\d{3}", score_line):
                i += 1
                continue

            college_code, college_name = college_line.split(" ", 1)
            group_code, requirement = group_line.split(" ", 1)
            score = int(score_line)
            if college_code in SEED_COLLEGE_CODES:
                records.append({
                    "year": 2025,
                    "batch": "\u672C\u79D1\u666E\u901A\u6279",
                    "seq": seq,
                    "collegeCode": college_code,
                    "collegeName": college_name,
                    "groupCode": group_code,
                    "groupName": f"{college_name}{group_code}\u4E13\u4E1A\u7EC4",
                    "subjectRequirement": normalize_requirement(requirement),
                    "minScore": score,
                    "source": {
                        "publisher": "\u5317\u4EAC\u6559\u80B2\u8003\u8BD5\u9662",
                        "title": "2025\u5E74\u5317\u4EAC\u5E02\u9AD8\u62DB\u672C\u79D1\u666E\u901A\u6279\u5F55\u53D6\u6295\u6863\u7EBF",
                        "url": PDF_URL,
                        "file": "data/raw/admissions/2025/bjeea_2025_undergraduate_regular_batch_cutoff.pdf",
                    },
                    "dataStatus": "official_cutoff_seed",
                    "limitations": [
                        "\u4EC5\u542B\u5B98\u65B9PDF\u6295\u6863\u7EBF\u4E2D\u89E3\u6790\u51FA\u7684\u9662\u6821\u4E13\u4E1A\u7EC4\u6700\u4F4E\u5206\uFF0C\u4E0D\u542B\u4E13\u4E1A\u660E\u7EC6\u548C\u4F53\u68C0\u9650\u62A5\u5224\u5B9A"
                    ],
                })
            i += 4
    return records


def enrich(records):
    rank_map = load_rank_map()
    for r in records:
        r["minRank"] = rank_map.get(r["minScore"])
        req = r["subjectRequirement"]
        r["isSubjectUnlimited"] = req["mode"] == "unlimited"
        r["displayName"] = f"{r['collegeName']} {r['groupCode']}\u4E13\u4E1A\u7EC4"
        r["riskTags"] = []
        for flag in req.get("extraFlags", []):
            if flag == COOP:
                r["riskTags"].append(COOP)
            elif flag == FEMALE:
                r["riskTags"].append("\u9650\u5973\u751F")
        if r["minRank"] is None:
            r["riskTags"].append("\u4F4D\u6B21\u672A\u5339\u914D")
        r["majorNames"] = []
        r["hasMedicalRestriction"] = None
        r["colorWeaknessRisk"] = "unknown"
    return records


def write_outputs(records):
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_JS.write_text("module.exports = " + json.dumps(records, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"records={len(records)}")
    print(f"json={OUT_JSON}")
    print(f"js={OUT_JS}")


if __name__ == "__main__":
    write_outputs(enrich(extract_records()))
