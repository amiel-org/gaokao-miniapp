"""Discover official BJEEA 2026 admission-catalog sources.

This script crawls the Beijing Education Examination Authority high-school
admission notices and records whether a public 2026 ordinary undergraduate
admission major catalog PDF/Excel has appeared. It is evidence collection only:
records are not exported to the miniapp until an official file or query rows are
parsed by the importer/fetcher.
"""

from __future__ import annotations

import json
import re
import sys
import argparse
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://www.bjeea.cn"
KSB_BASE_URL = "https://bjksb.bjeea.cn"
NOTICE_INDEX = f"{BASE_URL}/html/gkgz/tzgg/index.html"
KSB_GAOZHAO_INDEX = f"{KSB_BASE_URL}/html/ksb/gaozhaozhuanban/index.html"
KSB_MONTHLY_CALENDAR_URL = f"{KSB_BASE_URL}/html/ksb/gaozhaozhuanban/2026/0127/87911.html"
QUERY_PLAN_URL = "https://query.bjeea.cn/queryService/rest/plan/115"
WORK_RULE_URL = f"{BASE_URL}/html/gkgz/tzgg/2026/0505/88114.html"
RUN_DATE = date.today().isoformat()
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36"

CATALOG_KEYWORDS = [
    "2026",
    "普通高等学校",
    "招生专业目录",
]
SOFT_KEYWORDS = ["招生专业目录", "专业目录", "高招计划", "招生计划", "计划查询"]


@dataclass
class CandidateLink:
    title: str
    url: str
    sourcePage: str
    matchedKeywords: list[str]
    isAttachment: bool = False
    sourceType: str = "notice"


def safe_filename_from_url(url: str, fallback: str) -> str:
    parsed = urlparse(url)
    name = unquote(Path(parsed.path).name)
    if not name or "." not in name:
        name = fallback
    name = re.sub(r'[\\/:*?"<>|]+', "_", name).strip(" ._") or fallback
    return name


def download_candidate_files(session: requests.Session, candidates: list[CandidateLink]) -> list[dict[str, object]]:
    raw_dir = ROOT / "data" / "raw" / "admissions" / "2026"
    raw_dir.mkdir(parents=True, exist_ok=True)
    downloads: list[dict[str, object]] = []
    for index, candidate in enumerate(candidates, 1):
        filename = safe_filename_from_url(candidate.url, f"bjeea_2026_admission_catalog_{index}")
        if not filename.lower().startswith("bjeea_2026_"):
            filename = f"bjeea_2026_{filename}"
        out_path = raw_dir / filename
        item: dict[str, object] = {
            "title": candidate.title,
            "url": candidate.url,
            "sourcePage": candidate.sourcePage,
            "localPath": str(out_path.relative_to(ROOT)),
        }
        try:
            response = session.get(candidate.url, headers={"User-Agent": UA, "Referer": candidate.sourcePage}, timeout=60)
            response.raise_for_status()
            content = response.content
            out_path.write_bytes(content)
            item.update(
                {
                    "ok": True,
                    "size": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                    "contentType": response.headers.get("Content-Type", ""),
                }
            )
        except Exception as error:
            item.update({"ok": False, "error": str(error)})
        downloads.append(item)
    return downloads


def get_text_response(session: requests.Session, url: str) -> str:
    response = session.get(url, headers={"User-Agent": UA}, timeout=15)
    response.raise_for_status()
    # BJEEA pages are UTF-8, but requests sometimes guesses ISO-8859-1.
    if not response.encoding or response.encoding.lower() in {"iso-8859-1", "gb2312", "gbk"}:
        response.encoding = response.apparent_encoding or "utf-8"
    return response.text


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def match_keywords(text: str, strict: bool = False) -> list[str]:
    keys = CATALOG_KEYWORDS if strict else SOFT_KEYWORDS
    return [key for key in keys if key in text]


def notice_list_urls(max_pages: int = 3) -> list[str]:
    # The first pages carry current-year notices. Deep archive pages are useful
    # for occasional audits, but too slow for the normal release monitor.
    max_pages = max(1, max_pages)
    return [NOTICE_INDEX] + [f"{BASE_URL}/html/gkgz/tzgg/list_347_{i}.html" for i in range(2, max_pages + 1)]


def known_seed_urls() -> list[str]:
    return [
        # Previous year's catalog notice is used only to discover the official
        # attachment URL pattern, so the 2026 monitor can catch a similar page
        # as soon as it appears.
        f"{BASE_URL}/html/gkgz/tzgg/2025/0620/87155.html",
        WORK_RULE_URL,
        KSB_GAOZHAO_INDEX,
        # 北京考试报高招专版 2026 年页面，搜索引擎可发现但不等同于招生专业目录。
        KSB_MONTHLY_CALENDAR_URL,
    ]


def known_2026_attachment_guesses() -> list[str]:
    # Prior years sometimes use /upload/soft/YYYYMM/*.pdf for catalog files.
    # These guessed URLs are only probes; a file is accepted only if it is
    # reachable and its URL/title still matches the official 2026 catalog terms.
    names = [
        "2026zsjh.pdf",
        "2026zszyml.pdf",
        "2026ptgxzszymL.pdf",
        "2026ptgxzszyml.pdf",
        "2026bjzszyml.pdf",
        "2026zyml.pdf",
        "2026zhuanyemulu.pdf",
        "2026zsjh.xlsx",
        "2026zszyml.xlsx",
        "2026ptgxzszyml.xlsx",
    ]
    urls = [f"{BASE_URL}/upload/soft/202606/{name}" for name in names]
    # Current BJEEA attachment pages more commonly use /uploads/soft/YYMMDD/.
    for day in range(15, 26):
        for name in names:
            urls.append(f"{BASE_URL}/uploads/soft/2606{day:02d}/{name}")
    return urls


def probe_attachment_guesses(
    urls: list[str],
    max_workers: int = 16,
    timeout: float = 4,
) -> tuple[list[CandidateLink], list[dict[str, object]]]:
    """Probe likely attachment URLs without letting slow 404 checks block runs.

    BJEEA attachment paths are predictable enough to probe, but probing them
    sequentially can make the normal monitor exceed two minutes when a CDN node
    is slow. The probes are only discovery evidence; a candidate is still
    accepted only when the URL is reachable and later matches official catalog
    terms.
    """

    def check(url: str) -> tuple[CandidateLink | None, dict[str, object]]:
        info: dict[str, object] = {"url": url, "sourceType": "attachment_guess"}
        try:
            response = requests.head(
                url,
                headers={"User-Agent": UA, "Referer": NOTICE_INDEX},
                timeout=timeout,
                allow_redirects=True,
            )
            ok = response.status_code == 200
            info.update({"ok": ok, "statusCode": response.status_code})
            if not ok and response.status_code in {403, 405}:
                # Some static servers disable HEAD. Fall back to a streamed GET
                # without downloading the whole file unless it really exists.
                get_response = requests.get(
                    url,
                    headers={"User-Agent": UA, "Referer": NOTICE_INDEX},
                    timeout=timeout,
                    stream=True,
                )
                ok = get_response.status_code == 200
                info.update({"ok": ok, "statusCode": get_response.status_code})
                get_response.close()
        except Exception as error:
            info.update({"ok": False, "error": str(error)})
            return None, info
        if not ok:
            return None, info
        return (
            CandidateLink(
                title="2026 招生专业目录附件候选",
                url=url,
                sourcePage=NOTICE_INDEX,
                matchedKeywords=["2026", "招生专业目录"],
                isAttachment=True,
                sourceType="attachment_guess",
            ),
            info,
        )

    candidates: list[CandidateLink] = []
    pages: list[dict[str, object]] = []
    workers = max(1, max_workers)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_map = {executor.submit(check, url): url for url in urls}
        for future in as_completed(future_map):
            candidate, info = future.result()
            pages.append(info)
            if candidate:
                candidates.append(candidate)
    pages.sort(key=lambda item: str(item.get("url", "")))
    candidates.sort(key=lambda item: item.url)
    return candidates, pages


def find_links_on_page(html: str, page_url: str, source_type: str = "notice") -> list[CandidateLink]:
    soup = BeautifulSoup(html, "html.parser")
    result: list[CandidateLink] = []
    for link in soup.find_all("a", href=True):
        title = clean_text(link.get_text(" ", strip=True))
        url = urljoin(page_url, link["href"])
        haystack = f"{title} {url}"
        matched = match_keywords(haystack, strict=False)
        if not matched and "2026" not in haystack:
            continue
        is_attachment = bool(re.search(r"\.(pdf|xlsx?|csv)(?:$|[?#])", url, re.I))
        if matched or is_attachment:
            result.append(
                CandidateLink(
                    title=title,
                    url=url,
                    sourcePage=page_url,
                    matchedKeywords=matched,
                    isAttachment=is_attachment,
                    sourceType=source_type,
                )
            )
    return result


def probable_2026_catalog_notice_urls() -> list[str]:
    # 2025 official catalog notice was /2025/0620/87155.html. Probe the 2026
    # June notice-number neighborhood directly because the file can appear
    # before search engines index it.
    urls: list[str] = []
    for day in range(10, 31):
        for number in range(88080, 88261):
            urls.append(f"{BASE_URL}/html/gkgz/tzgg/2026/06{day:02d}/{number}.html")
    return urls


def probe_probable_catalog_notices(
    session: requests.Session,
    limit: int = 0,
    max_workers: int = 16,
    timeout: float = 4,
) -> tuple[list[CandidateLink], list[dict[str, object]]]:
    candidates: list[CandidateLink] = []
    pages: list[dict[str, object]] = []
    urls = probable_2026_catalog_notice_urls()
    if limit > 0:
        urls = urls[:limit]

    def inspect_url(url: str) -> tuple[list[CandidateLink], dict[str, object] | None]:
        try:
            response = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
            if response.status_code != 200:
                return [], None
            if not response.encoding or response.encoding.lower() in {"iso-8859-1", "gb2312", "gbk"}:
                response.encoding = response.apparent_encoding or "utf-8"
            html = response.text
        except Exception:
            return [], None
        text = clean_text(BeautifulSoup(html, "html.parser").get_text(" ", strip=True))
        if not all(key in text for key in CATALOG_KEYWORDS):
            return [], None
        found = [CandidateLink("probable-2026-catalog-notice", url, url, CATALOG_KEYWORDS, False, "probable_notice_probe")]
        found.extend(find_links_on_page(html, url, "probable_notice_probe"))
        return found, {"url": url, "ok": True, "sourceType": "probable_notice_probe", "strictKeywords": CATALOG_KEYWORDS}

    workers = max(1, max_workers)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_map = {executor.submit(inspect_url, url): url for url in urls}
        for future in as_completed(future_map):
            found, page = future.result()
            if page:
                pages.append(page)
            candidates.extend(found)
    pages.sort(key=lambda item: str(item.get("url", "")))
    candidates.sort(key=lambda item: item.url)
    return candidates, pages


def inspect_notice(session: requests.Session, candidate: CandidateLink) -> list[CandidateLink]:
    if candidate.isAttachment or not (candidate.url.startswith(BASE_URL) or candidate.url.startswith(KSB_BASE_URL)):
        return []
    try:
        html = get_text_response(session, candidate.url)
    except Exception:
        return []
    soup = BeautifulSoup(html, "html.parser")
    body_text = clean_text(soup.get_text(" ", strip=True))
    found: list[CandidateLink] = []
    # Add the notice itself if its body strictly says 2026 admission catalog.
    strict = match_keywords(body_text, strict=True)
    if strict:
        found.append(CandidateLink(candidate.title, candidate.url, candidate.sourcePage, strict, False, candidate.sourceType))
    for link in soup.find_all("a", href=True):
        title = clean_text(link.get_text(" ", strip=True))
        url = urljoin(candidate.url, link["href"])
        haystack = f"{title} {url}"
        matched = match_keywords(haystack, strict=False)
        is_attachment = bool(re.search(r"\.(pdf|xlsx?|csv)(?:$|[?#])", url, re.I))
        if matched or (is_attachment and any(k in body_text for k in ["2026", "招生", "专业"])):
            found.append(CandidateLink(title, url, candidate.url, matched, is_attachment, candidate.sourceType))
    return found


def should_inspect_detail(candidate: CandidateLink) -> bool:
    if candidate.isAttachment:
        return False
    if not (candidate.url.startswith(BASE_URL) or candidate.url.startswith(KSB_BASE_URL)):
        return False
    haystack = f"{candidate.title} {candidate.url}"
    if all(key in haystack for key in CATALOG_KEYWORDS):
        return True
    # Inspect known official seed and index pages, but do not recursively open
    # every generic "2026" news link from list pages. That caused monitor runs
    # to become slow while adding little evidence.
    return candidate.sourceType in {"seed", "probable_notice_probe"} and bool(candidate.matchedKeywords)


def extract_work_rule_evidence(session: requests.Session) -> dict[str, str | bool]:
    try:
        html = get_text_response(session, WORK_RULE_URL)
    except Exception as error:
        return {"url": WORK_RULE_URL, "found": False, "error": str(error), "snippet": ""}
    soup = BeautifulSoup(html, "html.parser")
    text = clean_text(soup.get_text(" ", strip=True))
    target = "招生专业目录"
    index = text.find(target)
    if index < 0:
        return {"url": WORK_RULE_URL, "found": False, "snippet": ""}
    start = max(0, index - 120)
    end = min(len(text), index + 180)
    return {"url": WORK_RULE_URL, "found": True, "snippet": text[start:end]}


def extract_release_window_evidence(session: requests.Session) -> dict[str, object]:
    """Extract official-publication timing evidence from 北京考试报.

    The page is not the catalog itself. It is useful operational evidence that
    the catalog is expected around June, explaining why May refreshes may still
    have no rows.
    """

    try:
        html = get_text_response(session, KSB_MONTHLY_CALENDAR_URL)
    except Exception as error:
        return {"url": KSB_MONTHLY_CALENDAR_URL, "found": False, "error": str(error), "snippet": ""}
    soup = BeautifulSoup(html, "html.parser")
    text = clean_text(soup.get_text(" ", strip=True))
    target = "高校招生专业目录下发"
    index = text.find(target)
    if index < 0:
        return {"url": KSB_MONTHLY_CALENDAR_URL, "found": False, "snippet": ""}
    month_matches = list(re.finditer(r"([0-9０-９一二三四五六七八九十]+)\s*月", text[:index]))
    month_label = month_matches[-1].group(0).replace(" ", "") if month_matches else ""
    start = max(0, index - 160)
    end = min(len(text), index + 260)
    return {
        "url": KSB_MONTHLY_CALENDAR_URL,
        "found": True,
        "monthLabel": month_label,
        "snippet": text[start:end],
        "interpretation": (
            f"北京考试报高招月历将 2026 招生专业目录下发列在{month_label or '相关月份'}；"
            "该页面只能证明预计发布窗口，不能替代招生专业目录本体。"
        ),
    }


def inspect_seed_page(session: requests.Session, url: str) -> tuple[list[CandidateLink], dict[str, object]]:
    try:
        html = get_text_response(session, url)
    except Exception as error:
        return [CandidateLink(f"ERROR: {error}", url, url, [], False, "seed")], {"url": url, "ok": False, "error": str(error)}
    soup = BeautifulSoup(html, "html.parser")
    text = clean_text(soup.get_text(" ", strip=True))
    strict = match_keywords(text, strict=True)
    soft = match_keywords(text, strict=False)
    snippet = ""
    for keyword in ["招生专业目录", "专业目录", "招生计划", "高招计划"]:
        index = text.find(keyword)
        if index >= 0:
            snippet = text[max(0, index - 120): min(len(text), index + 180)]
            break
    candidates = find_links_on_page(html, url, "seed")
    if strict:
        candidates.append(CandidateLink(clean_text(soup.title.get_text(" ", strip=True)) if soup.title else url, url, url, strict, False, "seed"))
    return candidates, {
        "url": url,
        "ok": True,
        "strictKeywords": strict,
        "softKeywords": soft,
        "snippet": snippet,
    }


def dedupe(candidates: list[CandidateLink]) -> list[CandidateLink]:
    seen: set[tuple[str, str]] = set()
    result: list[CandidateLink] = []
    for item in candidates:
        key = (item.title, item.url)
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true", help="Download official PDF/Excel/CSV candidates into data/raw/admissions/2026.")
    parser.add_argument("--probe-probable-notices", action="store_true", help="Probe likely 2026 June catalog notice URL ranges before search indexing.")
    parser.add_argument("--probe-limit", type=int, default=0, help="Limit probable notice probe count; 0 means full range.")
    parser.add_argument("--max-workers", type=int, default=16, help="Parallel workers for guessed attachment and notice probes.")
    parser.add_argument("--attachment-timeout", type=float, default=4, help="Timeout in seconds for each guessed attachment probe.")
    parser.add_argument("--notice-probe-timeout", type=float, default=4, help="Timeout in seconds for each probable notice probe.")
    parser.add_argument("--notice-pages", type=int, default=3, help="High-school admission notice index pages to inspect; default checks the newest pages.")
    parser.add_argument("--probe-attachment-guesses", action="store_true", help="Probe guessed 2026 attachment URLs. Disabled by default to keep daily monitor fast.")
    args = parser.parse_args()

    session = requests.Session()
    all_candidates: list[CandidateLink] = []
    inspected_pages: list[dict[str, object]] = []
    for url in notice_list_urls(args.notice_pages):
        try:
            html = get_text_response(session, url)
        except Exception as error:
            all_candidates.append(CandidateLink(f"ERROR: {error}", url, url, [], False, "notice"))
            inspected_pages.append({"url": url, "ok": False, "error": str(error)})
            continue
        inspected_pages.append({"url": url, "ok": True, "sourceType": "notice"})
        all_candidates.extend(find_links_on_page(html, url, "notice"))

    for url in known_seed_urls():
        seed_candidates, page_info = inspect_seed_page(session, url)
        inspected_pages.append(page_info)
        all_candidates.extend(seed_candidates)

    if args.probe_attachment_guesses:
        attachment_candidates, attachment_pages = probe_attachment_guesses(
            known_2026_attachment_guesses(),
            max_workers=args.max_workers,
            timeout=args.attachment_timeout,
        )
        inspected_pages.extend(attachment_pages)
        all_candidates.extend(attachment_candidates)

    if args.probe_probable_notices:
        probable_candidates, probable_pages = probe_probable_catalog_notices(
            session,
            args.probe_limit,
            max_workers=args.max_workers,
            timeout=args.notice_probe_timeout,
        )
        inspected_pages.extend(probable_pages)
        all_candidates.extend(probable_candidates)

    detail_candidates: list[CandidateLink] = []
    detail_inspection_queue = dedupe([item for item in list(all_candidates) if should_inspect_detail(item)])
    for item in detail_inspection_queue:
        detail_candidates.extend(inspect_notice(session, item))

    candidates = dedupe(all_candidates + detail_candidates)
    work_rule_evidence = extract_work_rule_evidence(session)
    release_window_evidence = extract_release_window_evidence(session)
    strict_catalogs = [
        item for item in candidates
        if all(key in f"{item.title} {item.url}" for key in ["2026", "招生专业目录"])
        or all(key in item.matchedKeywords for key in CATALOG_KEYWORDS)
    ]
    official_file_candidates = [
        item for item in strict_catalogs
        if item.isAttachment and re.search(r"\.(pdf|xlsx?|csv)(?:$|[?#])", item.url, re.I)
    ]
    downloads = download_candidate_files(session, official_file_candidates) if args.download and official_file_candidates else []

    payload = {
        "source": {
            "publisher": "北京教育考试院",
            "noticeIndex": NOTICE_INDEX,
            "beijingExamNewsIndex": KSB_GAOZHAO_INDEX,
            "queryPlanUrl": QUERY_PLAN_URL,
            "workRuleUrl": WORK_RULE_URL,
            "retrievedAt": RUN_DATE,
        },
        "status": "official_catalog_file_found" if official_file_candidates else "official_catalog_file_not_found",
        "strictCatalogCandidateCount": len(strict_catalogs),
        "officialFileCandidateCount": len(official_file_candidates),
        "officialFileCandidates": [asdict(item) for item in official_file_candidates],
        "downloadedOfficialFiles": downloads,
        "workRuleEvidence": work_rule_evidence,
        "releaseWindowEvidence": release_window_evidence,
        "detailInspectionCount": len(detail_inspection_queue),
        "inspectedPages": inspected_pages,
        "strictCatalogCandidates": [asdict(item) for item in strict_catalogs],
        "allRelevantCandidates": [asdict(item) for item in candidates],
    }

    out_dir = ROOT / "data" / "staging" / "bjeea_admission_plan_2026"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "bjeea_2026_catalog_source_discovery.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    report_path = ROOT / "docs" / "bjeea_2026_catalog_source_discovery.md"
    lines = [
        "# 北京教育考试院 2026 招生专业目录来源发现记录",
        "",
        f"生成时间：{RUN_DATE}",
        "",
        f"- 通知索引：{NOTICE_INDEX}",
        f"- 北京考试报高招专版：{KSB_GAOZHAO_INDEX}",
        f"- 高招计划查询：{QUERY_PLAN_URL}",
        f"- 招生工作规定：{WORK_RULE_URL}",
        f"- 状态：{payload['status']}",
        f"- 已巡检页面：{len(inspected_pages)}",
        f"- 严格命中目录候选：{len(strict_catalogs)}",
        f"- 官方文件候选：{len(official_file_candidates)}",
        f"- 已下载官方文件：{sum(1 for item in downloads if item.get('ok'))}/{len(downloads)}" if args.download else "- 已下载官方文件：未启用下载",
        "",
        "## 官方文件候选",
        "",
    ]
    if official_file_candidates:
        for item in official_file_candidates:
            lines.append(f"- [{item.title or item.url}]({item.url})")
    else:
        lines.append("- 未发现可下载的 2026 普通高等学校招生专业目录 PDF/Excel/CSV。")
    if downloads:
        lines.extend(["", "## 已下载文件", ""])
        lines.extend([
            f"- {item.get('localPath')}｜ok={item.get('ok')}｜size={item.get('size', '-')}｜sha256={str(item.get('sha256', ''))[:16]}"
            for item in downloads
        ])
    lines.extend(["", "## 招生工作规定证据", ""])
    if work_rule_evidence.get("found"):
        lines.append(f"- 已在《北京市2026年普通高等学校招生工作规定》中确认：{work_rule_evidence.get('snippet')}")
    else:
        lines.append("- 未能在招生工作规定中定位 2026 招生专业目录表述。")
    lines.extend(["", "## 发布窗口证据", ""])
    if release_window_evidence.get("found"):
        lines.append(f"- 北京考试报高招月历：{release_window_evidence.get('interpretation')}")
        lines.append(f"- 原文片段：{release_window_evidence.get('snippet')}")
    else:
        lines.append("- 未能在北京考试报高招月历中定位招生专业目录下发表述。")
    lines.extend(["", "## 严格目录候选", ""])
    if strict_catalogs:
        lines.extend([f"- [{item.title or item.url}]({item.url})（来源页：{item.sourcePage}）" for item in strict_catalogs])
    else:
        lines.append("- 未发现标题或正文同时命中 2026 与招生专业目录的官方页面。")
    lines.extend(["", "## 巡检页面", ""])
    lines.extend([
        f"- {item.get('url')}：{'OK' if item.get('ok') else 'ERROR'}{('，' + str(item.get('error'))) if item.get('error') else ''}"
        for item in inspected_pages
    ])
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({k: payload[k] for k in ["status", "strictCatalogCandidateCount", "officialFileCandidateCount"]}, ensure_ascii=False, indent=2))
    print(f"saved {out_path}")
    print(f"saved {report_path}")


if __name__ == "__main__":
    main()

