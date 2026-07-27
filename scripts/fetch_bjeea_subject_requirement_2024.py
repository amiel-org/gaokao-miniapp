"""Fetch Beijing Education Examination Authority subject-requirement data.

This script intentionally targets the public BJEEA query page:
https://query.bjeea.cn/queryService/rest/plan/134

As of 2026-05-19, the 2026 high-enrollment-plan page at `/plan/115`
renders the query shell but does not expose ordinary-batch result rows without
server-side state. The 2024 subject-requirement page (`/plan/134`) is public,
paginated, and contains college/major/category subject requirements that are
useful as a non-admission-plan cross-check for current recommendation cards.

Output is a staging JSON; it is not directly exported to miniprogram data
unless manually reviewed.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://query.bjeea.cn"
INDEX_URL = f"{BASE_URL}/queryService/rest/plan/134"
EXAM_ID = "5550"  # 2024 year option exposed by the BJEEA page.


@dataclass
class College:
    code: str
    name: str
    province: str


@dataclass
class SubjectRequirement:
    collegeCode: str
    collegeName: str
    majorCategory: str
    includedMajors: str
    subjectRequirement: str
    sourceUrl: str
    sourceTitle: str
    sourceYear: int = 2024
    sourcePublisher: str = "北京教育考试院"
    sourceType: str = "subject_requirement_reference"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def parse_case_rows(html: str) -> list[list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[list[str]] = []
    for tr in soup.select("table.case tr"):
      cells = [clean_text(td.get_text(" ", strip=True)) for td in tr.find_all(["td", "th"])]
      if cells:
          rows.append(cells)
    return rows


def fetch_college_index(session: requests.Session, max_pages: int = 20, delay: float = 0.2) -> list[College]:
    first = session.get(INDEX_URL, timeout=30)
    first.raise_for_status()
    soup = BeautifulSoup(first.text, "html.parser")
    page_div = soup.find(id="pageHideDiv")
    token = page_div.get("token", "") if page_div else ""
    page_size = page_div.get("pageSize", "50") if page_div else "50"

    colleges: list[College] = []
    seen: set[str] = set()

    def add_from_html(html: str) -> None:
        for row in parse_case_rows(html):
            if len(row) < 4 or row[0] == "序号":
                continue
            serial, code, name, province = row[:4]
            if not serial.isdigit() or not code or code in seen:
                continue
            seen.add(code)
            colleges.append(College(code=code, name=name, province=province))

    add_from_html(first.text)
    for page_no in range(2, max_pages + 1):
        response = session.post(
            INDEX_URL,
            data={
                "pageFlag": "true",
                "token": token,
                "pageSize": page_size,
                "pageNo": str(page_no),
            },
            timeout=30,
        )
        response.raise_for_status()
        before = len(colleges)
        add_from_html(response.text)
        if len(colleges) == before and page_no > 15:
            break
        time.sleep(delay)
    return colleges


def parse_subject_requirements(html: str, college: College, source_url: str) -> list[SubjectRequirement]:
    soup = BeautifulSoup(html, "html.parser")
    title_match = re.search(r"([^|]+?招生专业（类）选考要求)", soup.get_text("|", strip=True))
    source_title = title_match.group(1) if title_match else f"{college.name}（{college.code}）招生专业（类）选考要求"
    items: list[SubjectRequirement] = []
    for row in parse_case_rows(html):
        if len(row) < 3 or row[0] == "专业（类）":
            continue
        major_category, included_majors, subject_requirement = row[:3]
        if not major_category:
            continue
        items.append(
            SubjectRequirement(
                collegeCode=college.code,
                collegeName=college.name,
                majorCategory=major_category,
                includedMajors=included_majors,
                subjectRequirement=subject_requirement,
                sourceUrl=source_url,
                sourceTitle=source_title,
            )
        )
    return items


def fetch_college_requirements(session: requests.Session, college: College) -> list[SubjectRequirement]:
    url = f"{INDEX_URL}/{college.code}?examId={EXAM_ID}&schoolcode={college.code}"
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return parse_subject_requirements(response.text, college, url)


def selected_colleges(colleges: Iterable[College], limit: int | None, only_beijing: bool) -> list[College]:
    result = [college for college in colleges if not only_beijing or college.province == "北京市"]
    return result[:limit] if limit else result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20, help="Limit college detail fetches. Use 0 for all selected colleges.")
    parser.add_argument("--all-beijing", action="store_true", help="Fetch all Beijing colleges from the 2024 subject-requirement index.")
    parser.add_argument("--delay", type=float, default=0.2)
    args = parser.parse_args()

    session = requests.Session()
    colleges = fetch_college_index(session, delay=args.delay)
    detail_limit = None if args.all_beijing or args.limit == 0 else args.limit
    targets = selected_colleges(colleges, detail_limit, only_beijing=True)

    requirements: list[SubjectRequirement] = []
    for index, college in enumerate(targets, 1):
        print(f"[{index}/{len(targets)}] {college.code} {college.name}")
        requirements.extend(fetch_college_requirements(session, college))
        time.sleep(args.delay)

    out_dir = ROOT / "data" / "staging" / "bjeea_subject_requirements"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "bjeea_2024_subject_requirements.sample.json"
    payload = {
        "source": {
            "publisher": "北京教育考试院",
            "url": INDEX_URL,
            "examId": EXAM_ID,
            "year": 2024,
            "retrievedAt": "2026-05-19",
            "note": "高校选考查询数据，不等同于当年招生专业目录或招生计划；用于专业方向与选科要求交叉核验。",
        },
        "collegeIndexCount": len(colleges),
        "targetCollegeCount": len(targets),
        "requirementCount": len(requirements),
        "colleges": [asdict(item) for item in targets],
        "requirements": [asdict(item) for item in requirements],
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"saved {out_path}")
    print(json.dumps({k: payload[k] for k in ["collegeIndexCount", "targetCollegeCount", "requirementCount"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
