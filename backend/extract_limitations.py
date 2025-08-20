import json, re, time, random
from io import BytesIO
from pathlib import Path
from typing import Optional, Tuple, List, Dict
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from pdfminer.high_level import extract_text as pdf_extract_text
from pdfminer.pdfparser import PDFSyntaxError
import trafilatura
from openai import OpenAI

import os
from dotenv import load_dotenv

load_dotenv()  # loads values from .env into environment
API_KEY = os.getenv("OPENAI_API_KEY")   # ✅ load from .env
MODEL = "gpt-4o-mini"                                      # cheap + capable
USER_AGENT = "CiteNova/limitations (mailto:2018dgscmt@gmail.com)"
UNPAYWALL_EMAIL = "2018dgscmt@gmail.com"                        # required by Unpaywall

INPUT_FILE = "University_of_Guelph.json"
OUTPUT_FILE = "University_of_Guelph_limitations.json"

MIN_TEXT_LEN = 400
MAX_CHARS_TO_SEND = 20000
RETRY = 2                       # LLM retries
SLEEP_BETWEEN = 0.6             # polite throttling between papers

# HTTP fetch robustness
MAX_FETCH_RETRIES = 4
BASE_BACKOFF = 1.2
TIMEOUT = httpx.Timeout(connect=20.0, read=90.0, write=30.0, pool=90.0)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
}

# Optional debug: write raw responses for failed parses
DEBUG_SAVE = False
DEBUG_DIR = Path("debug_failed")

client_oai = OpenAI(api_key=API_KEY)

# =========================
# Heuristics
# =========================
LIMIT_HEADER_RX = re.compile(
    r"^\s*(limitations?|limitations and future work|threats to validity|discussion|conclusion[s]?)\s*$",
    re.I
)
LIMIT_CUES = [
    "limitation", "limitations", "future work", "beyond the scope",
    "threats to validity", "generalizability", "single center", "single-centre",
    "small sample", "underpowered", "bias", "confounding"
]

def looks_like_limitations(text: str) -> bool:
    t = text.lower()
    hits = sum(cue in t for cue in LIMIT_CUES)
    return hits >= 1

# =========================
# Helpers
# =========================
def normalize_doi(doi: Optional[str]) -> Optional[str]:
    if not doi: return None
    s = doi.strip().strip(")]}.;,")
    if s.startswith("http"): return s
    if s.lower().startswith("doi:"): s = s[4:]
    return f"https://doi.org/{s}"

def is_pdf_response(content: bytes, content_type: Optional[str], url: str) -> bool:
    if content_type and "application/pdf" in content_type.lower():
        return True
    if url.lower().endswith(".pdf"):
        return content[:5] == b"%PDF-"
    return content[:5] == b"%PDF-"

def _collect_until_next_header(h: BeautifulSoup) -> str:
    parts: List[str] = []
    for sib in h.next_siblings:
        if getattr(sib, "name", None) in ("h1","h2","h3","h4","h5","h6"):
            break
        if hasattr(sib, "get_text"):
            t = sib.get_text(separator=" ", strip=True)
            if t: parts.append(t)
    return "\n".join(parts).strip()

def html_pick_limitations(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    # (A) True headings + role=heading
    for tag in soup.select("h1,h2,h3,h4,h5,h6,[role='heading']"):
        head = (tag.get_text() or "").strip().lower()
        if any(k in head for k in ["limitation", "limitations", "threats to validity"]):
            sec = _collect_until_next_header(tag)
            if len(sec) >= 120: return sec

    # (B) Fake headings (bold/strong/div)
    for el in soup.find_all(["p","div","span"]):
        text = (el.get_text() or "").strip()
        lower = text.lower()
        if re.match(r"^\s*(limitations?|threats to validity)\s*[:\-–]?\s*$", lower) or \
           (el.find(["strong","b"]) and "limit" in lower[:60]):
            sec = _collect_until_next_header(el)
            if len(sec) >= 120: return sec

    # (C) Discussion/Conclusion fallbacks
    blocks = []
    for tag in soup.select("h1,h2,h3,h4,h5,h6,[role='heading']"):
        head = (tag.get_text() or "").strip().lower()
        if "discussion" in head or "conclusion" in head:
            sec = _collect_until_next_header(tag)
            if sec: blocks.append(sec)
    if blocks:
        return "\n\n".join(blocks)

    # (D) Keyword-window paragraph sweep
    paras = [p.get_text(" ", strip=True) for p in soup.find_all(["p","li","div"]) if p.get_text(strip=True)]
    hits = []
    for i, p in enumerate(paras):
        low = p.lower()
        if any(k in low for k in ["limitation", "limitations", "future work", "threats to validity"]):
            lo, hi = max(0, i-2), min(len(paras), i+3)
            hits.extend(paras[lo:hi])
    if hits:
        return "\n\n".join(hits)

    # (E) Last resort
    text = trafilatura.extract(html, include_tables=False, include_comments=False)
    return text or ""

def pdf_pick_limitations(text: str) -> str:
    lines = [l.strip() for l in text.splitlines()]
    chunks, cur, cur_head = [], [], ""
    for ln in lines:
        if LIMIT_HEADER_RX.match(ln):
            if cur:
                chunks.append((cur_head, "\n".join(cur).strip()))
            cur, cur_head = [], ln
        else:
            cur.append(ln)
    if cur:
        chunks.append((cur_head, "\n".join(cur).strip()))

    def rank(h: str) -> int:
        h = (h or "").lower()
        if "limit" in h or "threats to validity" in h: return 0
        if "discussion" in h: return 1
        if "conclusion" in h: return 2
        return 3

    if chunks:
        chunks.sort(key=lambda x: rank(x[0]))
        return chunks[0][1]
    return text

def save_debug(payload: bytes, suffix: str, key: str):
    if not DEBUG_SAVE: return
    DEBUG_DIR.mkdir(exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9]+", "_", key)[:80]
    (DEBUG_DIR / f"{safe}{suffix}").write_bytes(payload)

# =========================
# HTTP helpers (robust)
# =========================
def get_with_retries(client: httpx.Client, url: str, expect_bytes: bool = True):
    last_exc = None
    for attempt in range(1, MAX_FETCH_RETRIES + 1):
        try:
            r = client.get(url, timeout=TIMEOUT)
            if r.status_code in (429, 500, 502, 503, 504):
                raise httpx.HTTPStatusError(f"status {r.status_code}", request=r.request, response=r)
            # touch content to force download; servers sometimes hang on streaming
            _ = r.content if expect_bytes else r.text
            return r
        except (httpx.RemoteProtocolError,
                httpx.ReadTimeout,
                httpx.ConnectTimeout,
                httpx.ConnectError,
                httpx.HTTPStatusError) as e:
            last_exc = e
            # exponential backoff with jitter
            sleep = BASE_BACKOFF * (2 ** (attempt - 1)) + random.random() * 0.4
            time.sleep(sleep)
            continue
    # give up
    raise last_exc if last_exc else RuntimeError("Fetch failed with unknown error")

# =========================
# Unpaywall (OA fallback)
# =========================
def unpaywall_best_url(doi: str) -> Tuple[Optional[str], Optional[str]]:
    api = f"https://api.unpaywall.org/v2/{doi}?email={UNPAYWALL_EMAIL}"
    try:
        with httpx.Client(follow_redirects=True, headers=HEADERS, http2=False) as h:
            r = get_with_retries(h, api, expect_bytes=False)
            j = r.json()
            loc = j.get("best_oa_location") or {}
            pdf = loc.get("url_for_pdf")
            html = loc.get("url")
            if pdf: return pdf, "oa_pdf"
            if html: return html, "oa_html"
            return None, None
    except Exception:
        return None, None

# =========================
# Fetch candidate text
# =========================
def fetch_candidate_text_via_url(h: httpx.Client, url: str) -> Tuple[Optional[str], Optional[str], str, str]:
    """
    Returns (candidate_text, final_url, via, status_reason)
    via: 'doi_pdf' | 'doi_html' | 'oa_pdf' | 'oa_html'
    status_reason: 'ok' | 'short_text' | 'empty_pdf_text' | 'empty_html_text' | 'network_error'
    """
    try:
        r = get_with_retries(h, url, expect_bytes=True)
    except Exception as e:
        return None, url, "doi_html", f"network_error:{type(e).__name__}"

    final = str(r.url)
    ctype = (r.headers.get("content-type") or "")

    # PDF?
    if is_pdf_response(r.content, ctype, final):
        try:
            txt = pdf_extract_text(BytesIO(r.content))
            pick = pdf_pick_limitations(txt)
            if pick and len(pick) >= MIN_TEXT_LEN:
                return pick, final, "doi_pdf", "ok"
            if pick:
                save_debug(r.content, ".short.pdf", final)
                return pick, final, "doi_pdf", "short_text"
            save_debug(r.content, ".empty.pdf", final)
            return None, final, "doi_pdf", "empty_pdf_text"
        except (PDFSyntaxError, Exception):
            # fall through to HTML parse
            html = r.content.decode("utf-8", errors="ignore")
            pick = html_pick_limitations(html)
            if pick and len(pick) >= MIN_TEXT_LEN:
                return pick, final, "doi_html", "ok"
            if pick:
                save_debug(r.content, ".short_as_html.pdf", final)
                return pick, final, "doi_html", "short_text"
            save_debug(r.content, ".empty_as_html.pdf", final)
            return None, final, "doi_html", "empty_html_text"

    # HTML path
    html = r.text
    soup = BeautifulSoup(html, "html.parser")

    # try to find an explicit PDF link
    pdf_url = None
    m = soup.find("meta", {"name": "citation_pdf_url"})
    if m and m.get("content"): pdf_url = m["content"]
    if not pdf_url:
        link = soup.find("link", {"rel": "alternate", "type": "application/pdf"})
        if link and link.get("href"): pdf_url = link["href"]
    if not pdf_url:
        a = soup.find("a", href=lambda h: h and (h.lower().endswith(".pdf") or "/pdf" in h.lower()))
        if a and a.get("href"): pdf_url = a["href"]

    if pdf_url:
        pdf_url = urljoin(final, pdf_url)
        try:
            r2 = get_with_retries(h, pdf_url, expect_bytes=True)
            ctype2 = (r2.headers.get("content-type") or "")
            if is_pdf_response(r2.content, ctype2, str(r2.url)):
                try:
                    txt2 = pdf_extract_text(BytesIO(r2.content))
                    pick2 = pdf_pick_limitations(txt2)
                    if pick2 and len(pick2) >= MIN_TEXT_LEN:
                        return pick2, str(r2.url), "doi_pdf", "ok"
                    if pick2:
                        save_debug(r2.content, ".short.follow.pdf", str(r2.url))
                        return pick2, str(r2.url), "doi_pdf", "short_text"
                except (PDFSyntaxError, Exception):
                    pass  # fall back to HTML below
        except Exception as e:
            # continue with HTML below
            pass

    pick_html = html_pick_limitations(html)
    if pick_html and len(pick_html) >= MIN_TEXT_LEN:
        return pick_html, final, "doi_html", "ok"
    if pick_html:
        save_debug(r.content, ".short.html", final)
        return pick_html, final, "doi_html", "short_text"
    save_debug(r.content, ".empty.html", final)
    return None, final, "doi_html", "empty_html_text"

def fetch_candidate_text(doi: str) -> Tuple[Optional[str], Optional[str], str, str]:
    """
    Try DOI; if unusable, try Unpaywall OA.
    Returns: (candidate_text, source_url, via, status_reason)
    """
    doi_url = normalize_doi(doi)
    if not doi_url:
        return None, None, "no_doi", "missing_doi"

    with httpx.Client(follow_redirects=True, headers=HEADERS, http2=False) as h:
        # 1) DOI
        cand, src, via, reason = fetch_candidate_text_via_url(h, doi_url)
        if cand and len(cand) >= MIN_TEXT_LEN:
            return cand, src, via, reason

        # 2) Unpaywall OA fallback
        oa_url, _oa_via = unpaywall_best_url(doi)
        if oa_url:
            cand2, src2, via2, reason2 = fetch_candidate_text_via_url(h, oa_url)
            if cand2:
                if via2.endswith("pdf"): via2 = "oa_pdf"
                if via2.endswith("html"): via2 = "oa_html"
                return cand2, src2, via2, reason2

        return None, src, via, reason

# =========================
# LLM SUMMARIZATION
# =========================
def summarize_with_gpt(cand_text: str) -> dict:
    text = cand_text[:MAX_CHARS_TO_SEND]
    prompt = f"""You are analyzing a scientific article section (likely Limitations/Discussion/Conclusion).
Identify concrete study LIMITATIONS and RESEARCH GAPS only from the text provided.

Return strict JSON with:
- "bullets": 3–5 short, specific bullet points
- "quotes": short direct quotes from the text if present (0–3)
- "confidence": a number 0.0–1.0 for reliability

Text:
{text}
"""
    for attempt in range(RETRY + 1):
        try:
            resp = client_oai.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0,
            )
            return json.loads(resp.choices[0].message.content)
        except Exception as e:
            if attempt == RETRY:
                return {"bullets": [], "quotes": [], "confidence": 0.0, "error": str(e)}
            time.sleep(1.5)

# =========================
# MAIN (live writes)
# =========================
def main():
    papers: List[Dict] = json.loads(Path(INPUT_FILE).read_text(encoding="utf-8"))
    out_map: Dict[str, Dict] = {}
    total = len(papers)
    print(f"\n📚 {INPUT_FILE}: {total} papers")

    out_path = Path(OUTPUT_FILE)
    for i, rec in enumerate(papers, start=1):
        pid = rec.get("id") or f"row-{i}"
        title = rec.get("title") or ""
        doi = rec.get("doi")
        print(f"  [{i}/{total}] {title[:80]}")

        if not doi:
            out_map[pid] = {
                "status": "no_doi",
                "status_reason": "missing_doi",
                "bullets": [], "quotes": [], "confidence": 0.0
            }
            out_path.write_text(json.dumps(out_map, ensure_ascii=False, indent=2), encoding="utf-8")
            continue

        cand_text, src, via, reason = fetch_candidate_text(doi)

        if not cand_text:
            out_map[pid] = {
                "status": "parse_failed",
                "status_reason": reason,
                "source_url": src, "resolved_via": via,
                "bullets": [], "quotes": [], "confidence": 0.0
            }
            out_path.write_text(json.dumps(out_map, ensure_ascii=False, indent=2), encoding="utf-8")
            time.sleep(SLEEP_BETWEEN)
            continue

        # extra credit guard
        if not looks_like_limitations(cand_text) and len(cand_text) < 1200:
            out_map[pid] = {
                "status": "skipped_no_limits",
                "status_reason": "text_does_not_look_like_limitations",
                "source_url": src, "resolved_via": via,
                "bullets": [], "quotes": [], "confidence": 0.0
            }
            out_path.write_text(json.dumps(out_map, ensure_ascii=False, indent=2), encoding="utf-8")
            time.sleep(SLEEP_BETWEEN)
            continue

        summ = summarize_with_gpt(cand_text)
        out_map[pid] = {
            "status": "ok" if not summ.get("error") else "llm_error",
            "status_reason": "ok" if not summ.get("error") else str(summ.get("error")),
            "source_url": src, "resolved_via": via,
            "bullets": summ.get("bullets", []),
            "quotes": summ.get("quotes", []),
            "confidence": float(summ.get("confidence", 0.0))
        }

        # LIVE write after each paper so you can watch progress
        out_path.write_text(json.dumps(out_map, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(SLEEP_BETWEEN)

    print(f"✅ Wrote {len(out_map)} entries → {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
