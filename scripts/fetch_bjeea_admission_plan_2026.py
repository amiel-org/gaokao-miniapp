"""Fetch / verify BJEEA 2026 high-admission plan data.

Official source:
  https://query.bjeea.cn/queryService/rest/plan/115

The script is intentionally strict: it only treats records as usable when the
public page exposes a 2026 year option and returns ordinary-batch rows. Current
shell-only pages are saved as evidence, but are not exported as fake data.
"""

from __future__ import annotations

import argparse
import json
import sys
import re
import time
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://query.bjeea.cn"
INDEX_URL = f"{BASE_URL}/queryService/rest/plan/115"
TARGET_YEAR = 2026
TARGET_BATCH = "本科普通批"
TARGET_PROVINCE = "北京市"
RUN_DATE = date.today().isoformat()
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36"
FIXED_DWR_EXAM_ID_CANDIDATES = [5264, 5415, 5420, 5422, 5446, 5457, 5460, 5461, 5497, 5604, 5668, 5727, 5785]


@dataclass
class SchoolPlanIndex:
    collegeCode: str
    collegeName: str
    province: str
    enrollBatch: str
    planCount: int | None
    sourceUrl: str


@dataclass
class AdmissionPlanRecord:
    year: int
    collegeCode: str
    collegeName: str
    majorCode: str
    majorName: str
    subjectRequirement: str
    enrollBatch: str
    planCount: int | None
    durationYears: str
    tuition: str
    foreignLanguage: str
    sourceUrl: str
    sourcePublisher: str = "北京教育考试院"
    sourceType: str = "official_2026_admission_plan"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def text_to_int(value: str) -> int | None:
    value = clean_text(value).replace(",", "")
    if not value or not re.search(r"\d", value):
        return None
    try:
        return int(re.search(r"\d+", value).group(0))
    except Exception:
        return None


def save_evidence(name: str, text: str) -> None:
    out = ROOT / "logs" / name
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")


def write_run_metadata() -> None:
    out = ROOT / "logs" / "bjeea_plan115_2026_latest_run.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "retrievedAt": RUN_DATE,
                "sourceUrl": INDEX_URL,
                "targetYear": TARGET_YEAR,
                "targetProvince": TARGET_PROVINCE,
                "targetBatch": TARGET_BATCH,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def parse_case_rows(html: str) -> list[list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[list[str]] = []
    for tr in soup.select("table.case tr"):
        cells = [clean_text(td.get_text(" ", strip=True)) for td in tr.find_all(["td", "th"])]
        if cells:
            rows.append(cells)
    return rows


def select_options(soup: BeautifulSoup, selector: str) -> list[dict[str, str]]:
    return [
        {"value": option.get("value", ""), "label": clean_text(option.get_text(" ", strip=True))}
        for option in soup.select(f"{selector} option")
    ]


def extract_2026_exam_ids(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    options = select_options(soup, "#examId") + select_options(soup, "#examId2")
    result: list[str] = []
    for option in options:
        if str(TARGET_YEAR) in option["label"] and option["value"] and option["value"] not in result:
            result.append(option["value"])
    return result


def parse_page_div(html: str) -> dict[str, str] | None:
    soup = BeautifulSoup(html, "html.parser")
    div = soup.find(id="pageHideDiv")
    if not div:
        return None
    return {
        "url": div.get("url", "/queryService/rest/plan/115"),
        "token": div.get("token", ""),
        "pageSize": div.get("pageSize", "50"),
        "pageNo": div.get("pageNo", "1"),
    }


def detect_total_pages(html: str) -> int:
    text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    match = re.search(r"第\s*\d+\s*页\s*/\s*共\s*(\d+)\s*页", text)
    return int(match.group(1)) if match else 1


def parse_school_index(html: str, source_url: str) -> list[SchoolPlanIndex]:
    items: list[SchoolPlanIndex] = []
    for row in parse_case_rows(html):
        if len(row) < 6 or row[0] == "序号" or not row[0].isdigit():
            continue
        _, code, name, province, batch, count = row[:6]
        if not code or not name:
            continue
        items.append(
            SchoolPlanIndex(
                collegeCode=code,
                collegeName=name,
                province=province,
                enrollBatch=batch,
                planCount=text_to_int(count),
                sourceUrl=source_url,
            )
        )
    return items


def parse_detail_records(html: str, college: SchoolPlanIndex, source_url: str) -> list[AdmissionPlanRecord]:
    records: list[AdmissionPlanRecord] = []
    for row in parse_case_rows(html):
        if len(row) < 8 or row[0].startswith("专业") or row[0] == "专业 代码":
            continue
        major_code, major_name, subject_requirement, batch, plan_count, duration, tuition, foreign_language = row[:8]
        if not major_code or not major_name or TARGET_BATCH not in batch:
            continue
        records.append(
            AdmissionPlanRecord(
                year=TARGET_YEAR,
                collegeCode=college.collegeCode,
                collegeName=college.collegeName,
                majorCode=major_code,
                majorName=major_name,
                subjectRequirement=subject_requirement,
                enrollBatch=batch,
                planCount=text_to_int(plan_count),
                durationYears=duration,
                tuition=tuition,
                foreignLanguage=foreign_language,
                sourceUrl=source_url,
            )
        )
    return records


def visible_year_options(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    return select_options(soup, "#examId") + select_options(soup, "#examId2")


def dwr_probe(session: requests.Session, start: int, end: int, delay: float) -> list[dict[str, object]]:
    endpoint = f"{BASE_URL}/dwr/call/plaincall/GetGaoZhaoPCDMByExamId.queryGaoZhaoJHPCByExamId.dwr"
    headers = {
        "User-Agent": UA,
        "Referer": INDEX_URL,
        "Origin": BASE_URL,
        "Content-Type": "text/plain",
    }
    candidates: list[dict[str, object]] = []
    for exam_id in range(start, end + 1):
        body = "\n".join(
            [
                "callCount=1",
                "page=/queryService/rest/plan/115",
                "httpSessionId=",
                "scriptSessionId=${scriptSessionId}187",
                "c0-scriptName=GetGaoZhaoPCDMByExamId",
                "c0-methodName=queryGaoZhaoJHPCByExamId",
                "c0-id=0",
                f"c0-param0=string:{exam_id}",
                "batchId=1",
                "",
            ]
        )
        try:
            response = session.post(endpoint, headers=headers, data=body, timeout=15)
            text = response.text
        except Exception as error:
            candidates.append({"examId": exam_id, "error": str(error)})
            continue
        if "本科普通批" in text or "pcmc" in text:
            batch_names = sorted(set(re.findall(r'pcmc="((?:\\.|[^"])*)"', text)))
            decoded = []
            for item in batch_names:
                try:
                    decoded.append(json.loads(f'"{item}"'))
                except Exception:
                    decoded.append(item)
            candidates.append({"examId": exam_id, "batchNames": decoded})
        if delay:
            time.sleep(delay)
    return candidates


def merge_dwr_candidates(*groups: list[dict[str, object]]) -> list[dict[str, object]]:
    by_id: dict[int, dict[str, object]] = {}
    passthrough: list[dict[str, object]] = []
    for group in groups:
        for item in group:
            try:
                exam_id = int(item.get("examId"))
            except Exception:
                passthrough.append(item)
                continue
            if exam_id not in by_id:
                by_id[exam_id] = item
            else:
                existing = by_id[exam_id]
                existing_batches = list(existing.get("batchNames") or [])
                item_batches = list(item.get("batchNames") or [])
                merged_batches = sorted(set(existing_batches + item_batches))
                existing["batchNames"] = merged_batches
    return [by_id[key] for key in sorted(by_id)] + passthrough


def verify_dwr_candidate_rows(
    session: requests.Session,
    candidates: list[dict[str, object]],
    delay: float,
    detail_sample_limit: int = 3,
) -> list[dict[str, object]]:
    """Re-submit DWR candidate examIds to the public plan endpoint.

    DWR only proves that an examId has batch metadata. It does not prove the
    candidate is the 2026 public catalog. This verifier records whether the
    normal public query actually returns Beijing 本科普通批 rows for each
    candidate. Results are evidence only unless the page also exposes a 2026
    year option.
    """

    verified: list[dict[str, object]] = []
    seen: set[int] = set()
    for candidate in candidates:
        raw_exam_id = candidate.get("examId")
        try:
            exam_id = int(raw_exam_id)
        except Exception:
            verified.append({"examId": raw_exam_id, "error": "invalid_exam_id"})
            continue
        if exam_id in seen:
            continue
        seen.add(exam_id)

        try:
            pages = fetch_index_pages(session, str(exam_id), delay)
        except Exception as error:
            verified.append({"examId": exam_id, "error": str(error)})
            continue

        school_index: list[SchoolPlanIndex] = []
        for page_index, html in enumerate(pages, 1):
            # Save only compact evidence names. These files are overwritten on
            # repeated refreshes and are useful when a hidden candidate starts
            # returning rows before the public selector is updated.
            if page_index == 1:
                save_evidence(f"bjeea_plan115_candidate_exam_{exam_id}_index.html", html)
            school_index.extend(parse_school_index(html, INDEX_URL))

        beijing_ordinary = [
            item
            for item in school_index
            if item.province == TARGET_PROVINCE and TARGET_BATCH in item.enrollBatch
        ]
        detail_record_count = 0
        detail_sample: list[dict[str, object]] = []
        for college in beijing_ordinary[:detail_sample_limit]:
            try:
                detail_records = fetch_detail(session, college, str(exam_id))
                detail_record_count += len(detail_records)
                detail_sample.append(
                    {
                        "collegeCode": college.collegeCode,
                        "collegeName": college.collegeName,
                        "detailRecordCount": len(detail_records),
                    }
                )
            except Exception as error:
                detail_sample.append(
                    {
                        "collegeCode": college.collegeCode,
                        "collegeName": college.collegeName,
                        "error": str(error),
                    }
                )
            if delay:
                time.sleep(delay)

        first_page = pages[0] if pages else ""
        verified.append(
            {
                "examId": exam_id,
                "batchNames": candidate.get("batchNames", []),
                "publicYearOptions": visible_year_options(first_page),
                "indexRowCount": len(school_index),
                "beijingOrdinaryBatchSchoolCount": len(beijing_ordinary),
                "sampleDetailRecordCount": detail_record_count,
                "sampleDetails": detail_sample,
                "usableAsOfficial2026": False,
                "reason": (
                    "候选 examId 来自 DWR 批次元数据；公开页面未暴露 2026 年度标签，"
                    "不能据此认定为 2026 官方招生专业目录。"
                ),
            }
        )
        if delay:
            time.sleep(delay)
    return verified


def fetch_index_pages(session: requests.Session, exam_id: str, delay: float) -> list[str]:
    headers = {"User-Agent": UA, "Referer": INDEX_URL, "Origin": BASE_URL}
    response = session.post(
        INDEX_URL,
        headers=headers,
        data={
            "optionType": "1",
            "queryType": "1",
            "examId": exam_id,
            "enrollBatch": TARGET_BATCH,
            "province": TARGET_PROVINCE,
            "schoolName": "",
        },
        timeout=30,
    )
    response.raise_for_status()
    pages = [response.text]
    page_div = parse_page_div(response.text)
    total_pages = detect_total_pages(response.text)
    if not page_div or total_pages <= 1:
        return pages
    url = BASE_URL + page_div["url"] if page_div["url"].startswith("/") else page_div["url"]
    for page_no in range(2, total_pages + 1):
        page_response = session.post(
            url,
            headers=headers,
            data={
                "pageFlag": "true",
                "token": page_div["token"],
                "pageSize": page_div["pageSize"],
                "pageNo": str(page_no),
            },
            timeout=30,
        )
        page_response.raise_for_status()
        pages.append(page_response.text)
        if delay:
            time.sleep(delay)
    return pages


def fetch_detail(session: requests.Session, college: SchoolPlanIndex, exam_id: str) -> list[AdmissionPlanRecord]:
    source_url = f"{INDEX_URL}/{college.collegeCode}?examId={exam_id}&schoolcode={college.collegeCode}&subjectName={college.collegeCode}"
    response = session.get(source_url, headers={"User-Agent": UA, "Referer": INDEX_URL}, timeout=30)
    response.raise_for_status()
    return parse_detail_records(response.text, college, source_url)


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    parser = argparse.ArgumentParser()
    parser.add_argument("--delay", type=float, default=0.15)
    parser.add_argument("--probe-dwr", action="store_true", help="Probe DWR batch ids for evidence only; not used as official 2026 data.")
    parser.add_argument("--probe-start", type=int, default=5700)
    parser.add_argument("--probe-end", type=int, default=5900)
    parser.add_argument("--full-probe", action="store_true", help="Probe examId 1..6999 and save all DWR batch candidates as evidence.")
    parser.add_argument("--include-fixed-candidates", action="store_true", default=True, help="Also verify known historical/hidden DWR examId candidates from prior probes.")
    parser.add_argument("--skip-candidate-verification", action="store_true", help="Skip public-query verification for DWR candidate examIds.")
    parser.add_argument("--fail-if-empty", action="store_true")
    args = parser.parse_args()

    session = requests.Session()
    headers = {"User-Agent": UA, "Referer": INDEX_URL}
    first = session.get(INDEX_URL, headers=headers, timeout=30)
    first.raise_for_status()
    save_evidence("bjeea_plan115_2026_latest_shell.html", first.text)
    write_run_metadata()

    exam_ids = extract_2026_exam_ids(first.text)
    dwr_start = 1 if args.full_probe else args.probe_start
    dwr_end = 6999 if args.full_probe else args.probe_end
    dwr_candidates = dwr_probe(session, dwr_start, dwr_end, args.delay) if (args.probe_dwr or args.full_probe) else []
    fixed_candidates = [{"examId": exam_id, "batchNames": [], "source": "fixed_prior_probe"} for exam_id in FIXED_DWR_EXAM_ID_CANDIDATES] if args.include_fixed_candidates else []
    dwr_candidates = merge_dwr_candidates(dwr_candidates, fixed_candidates)
    dwr_candidate_verification = (
        verify_dwr_candidate_rows(session, dwr_candidates, args.delay)
        if dwr_candidates and not args.skip_candidate_verification
        else []
    )

    index_items: list[SchoolPlanIndex] = []
    records: list[AdmissionPlanRecord] = []
    selected_exam_id = exam_ids[0] if exam_ids else None
    status = "official_year_option_missing"
    notes: list[str] = []

    if not exam_ids:
        notes.append("/plan/115 当前页面未暴露 2026 年度下拉选项，不能确认普通批招生专业计划已公开。")
    else:
        status = "official_year_option_available_no_rows"
        pages = fetch_index_pages(session, selected_exam_id, args.delay)
        for index, html in enumerate(pages, 1):
            save_evidence(f"bjeea_plan115_2026_index_page_{index}.html", html)
            index_items.extend(parse_school_index(html, INDEX_URL))
        index_items = [item for item in index_items if item.province == TARGET_PROVINCE and TARGET_BATCH in item.enrollBatch]
        if index_items:
            status = "official_index_rows_available"
        for idx, college in enumerate(index_items, 1):
            print(f"[{idx}/{len(index_items)}] {college.collegeCode} {college.collegeName}")
            detail_records = fetch_detail(session, college, selected_exam_id)
            records.extend(detail_records)
            if args.delay:
                time.sleep(args.delay)
        if records:
            status = "official_plan_connected"
        else:
            notes.append("官方页面已尝试查询，但未返回可结构化的本科普通批专业明细。")

    if dwr_candidates and not exam_ids:
        notes.append("DWR 批次探测发现历史/未绑定 examId，但页面未提供年度标签，不能作为 2026 正式数据使用。")
        latest = dwr_candidates[-1] if dwr_candidates else {}
        if latest:
            notes.append(f"DWR 非空 examId 最新候选为 {latest.get('examId')}；仅可作为候选证据，不能作为 2026 正式数据。")
    if dwr_candidate_verification and not exam_ids:
        candidate_rows = sum(int(item.get("beijingOrdinaryBatchSchoolCount") or 0) for item in dwr_candidate_verification)
        candidate_details = sum(int(item.get("sampleDetailRecordCount") or 0) for item in dwr_candidate_verification)
        if candidate_rows or candidate_details:
            notes.append(
                f"已回填验证 DWR 候选 examId，发现北京本科普通批候选学校 {candidate_rows} 所、抽样专业明细 {candidate_details} 条；"
                "但公开页面未暴露 2026 年度标签，仍暂不接入为正式 2026 数据。"
            )
            status = "hidden_candidate_rows_found_requires_year_confirmation"
        else:
            notes.append("已回填验证 DWR 候选 examId，公开查询仍未返回北京本科普通批学校/专业计划行。")

    payload = {
        "source": {
            "publisher": "北京教育考试院",
            "url": INDEX_URL,
            "title": "高招计划查询",
            "year": TARGET_YEAR,
            "retrievedAt": RUN_DATE,
        },
        "status": status,
        "examIdsFromPage": exam_ids,
        "selectedExamId": selected_exam_id,
        "target": {
            "year": TARGET_YEAR,
            "province": TARGET_PROVINCE,
            "enrollBatch": TARGET_BATCH,
        },
        "schoolIndexCount": len(index_items),
        "recordCount": len(records),
        "notes": notes,
        "dwrProbeCandidates": dwr_candidates,
        "dwrCandidateVerification": dwr_candidate_verification,
        "schoolIndex": [asdict(item) for item in index_items],
        "records": [asdict(item) for item in records],
    }

    out_dir = ROOT / "data" / "staging" / "bjeea_admission_plan_2026"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "bjeea_2026_admission_plan.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: payload[k] for k in ["status", "examIdsFromPage", "selectedExamId", "schoolIndexCount", "recordCount", "notes"]}, ensure_ascii=False, indent=2))
    print(f"saved {out_path}")
    if args.fail_if_empty and not records:
        raise SystemExit("BJEEA 2026 admission plan has no official records yet; refusing to export fake data.")


if __name__ == "__main__":
    main()
