# build_graph.py  — OpenAI-based cluster labeling (1–2 words)
import json, math, re, time, random
import os
from pathlib import Path
from collections import defaultdict

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from openai import OpenAI

# =========================
# INPUT FILES (unchanged)
# =========================
CLUSTERED_FILES = [
    "University_of_Toronto_papers_with_clusters.jsonl",
    "McMaster_University_papers_with_clusters.jsonl",
    "University_of_Waterloo_papers_with_clusters.jsonl",
    "Queens_University_papers_with_clusters.jsonl",
    "University_of_Guelph_papers_with_clusters.jsonl",
]

# =========================
# CLUSTERING / LABEL CONFIG
# =========================
WEAK_SIM_THRESHOLD   = 0.34
MAX_TFIDF_TERMS      = 6
TOP_TITLES_FOR_PROMPT = 10  # how many titles to send the LLM

# ---- OpenAI model to use for labels ----
API_KEY = os.getenv("OPENAI_API_KEY")  # Get from environment variable
MODEL         = "gpt-4o-mini"                # cheap + strong enough
OAI_TEMPERATURE = 0.2
OAI_RETRIES     = 2
OAI_MAX_TOKENS  = 16

client = OpenAI(api_key=API_KEY)

# =========================
# IO
# =========================
def read_jsonl(p):
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)

def uni_key_from_path(p: Path) -> str:
    return re.sub(r"_papers_with_clusters\.jsonl$", "", p.name)

# =========================
# Math helpers
# =========================
def cosine_centroid_and_sims(vecs: np.ndarray):
    centroid = vecs.mean(axis=0)
    norm = np.linalg.norm(centroid) + 1e-12
    centroid = centroid / norm
    sims = vecs @ centroid
    return centroid, sims

# =========================
# TF-IDF keywords
# =========================
def top_terms_for_cluster(titles):
    if not titles:
        return []
    vec = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        max_features=2000,
        stop_words="english"
    )
    X = vec.fit_transform(titles)
    vocab = np.array(vec.get_feature_names_out())
    scores = np.asarray(X.sum(axis=0)).ravel()
    idx = scores.argsort()[::-1][:MAX_TFIDF_TERMS]
    return [vocab[i] for i in idx]

# =========================
# OpenAI labeling
# =========================
def _fallback_label_from_terms(keywords):
    if not keywords:
        return "Research"
    # choose 1–2 best TF-IDF terms and Title-Case them
    words = [w for w in keywords[:2]]
    label = " ".join(w.title() for w in words)
    # enforce max 2 words
    parts = label.split()
    return " ".join(parts[:2])

def _clean_to_one_or_two_words(s: str) -> str:
    # strip punctuation, trim to 2 words, Title Case
    s = re.sub(r"[^A-Za-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    parts = s.split()[:2]
    if not parts:
        return "Research"
    return " ".join(p.capitalize() for p in parts)

def generate_cluster_label(titles, keywords):
    """
    Use OpenAI to produce a concise 1–2 word umbrella topic label.
    Falls back to TF-IDF if API fails.
    """
    if not titles and not keywords:
        return "Research"

    titles_text = "\n".join([f"- {t}" for t in titles if t])[:3000]  # keep prompt small
    kw_text = ", ".join(keywords[:10])

    prompt = f"""
You are a research librarian naming high-level topic clusters.

Given paper titles and keywords, return a SINGLE, broad, umbrella topic label of at most TWO WORDS.
Use established academic terms (e.g., "Deep Learning", "Quantum Materials", "Public Health").
Do NOT include punctuation, slashes, hyphens, or extra words.

Return strict JSON: {{"label": "<1-2 words>"}}

Titles:
{titles_text}

Keywords: {kw_text}
"""

    for attempt in range(OAI_RETRIES + 1):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                temperature=OAI_TEMPERATURE,
                max_tokens=OAI_MAX_TOKENS,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "You name topic clusters succinctly and professionally."},
                    {"role": "user", "content": prompt.strip()},
                ],
            )
            content = resp.choices[0].message.content
            data = json.loads(content)
            label = data.get("label", "").strip()
            if not label:
                raise ValueError("empty label")
            return _clean_to_one_or_two_words(label)
        except Exception:
            if attempt == OAI_RETRIES:
                return _fallback_label_from_terms(keywords)
            time.sleep(0.8 + 0.4 * attempt)

# =========================
# Main per-university pass
# =========================
def process_university(in_path: Path):
    uni_key = uni_key_from_path(in_path)
    recs = [r for r in read_jsonl(in_path) if isinstance(r.get("vector"), list)]
    if not recs:
        print(f"[warn] no records for {in_path}")
        return

    clusters = defaultdict(list)
    for r in recs:
        clusters[int(r["cluster_id"])].append(r)

    topics, papers = [], []

    for c_id, items in clusters.items():
        V = np.asarray([r["vector"] for r in items], dtype=np.float32)
        _, sims = cosine_centroid_and_sims(V)

        strong_items, weak_items = [], []
        for r, sim in zip(items, sims):
            simf = float(sim)
            (strong_items if simf >= WEAK_SIM_THRESHOLD else weak_items).append((r, simf))

        # Representative titles for LLM
        rep_titles = [r.get("title") or "" for r, _ in sorted(strong_items, key=lambda x: -x[1])[:TOP_TITLES_FOR_PROMPT]]
        if not rep_titles:  # fallback to weak if no strong
            rep_titles = [r.get("title") or "" for r, _ in sorted(weak_items, key=lambda x: -x[1])[:TOP_TITLES_FOR_PROMPT]]

        # TF-IDF keywords as guidance
        all_titles_for_tfidf = [r.get("title") or "" for r, _ in strong_items] or \
                               [r.get("title") or "" for r, _ in weak_items]
        top_terms = top_terms_for_cluster(all_titles_for_tfidf)

        # --- NEW: OpenAI label ---
        label = generate_cluster_label(rep_titles, top_terms)

        topics.append({
            "cluster_id": int(c_id),
            "label": label,
            "size": len(items),
            "weak_count": len(weak_items),
        })

        for bucket, quality in [(strong_items, "strong"), (weak_items, "weak")]:
            for r, simf in sorted(bucket, key=lambda x: -x[1]):
                papers.append({
                    "id": r["id"],
                    "title": r.get("title"),
                    "doi": r.get("doi"),
                    "cluster_id": int(c_id),
                    "sim_to_centroid": simf,
                    "quality": quality
                })

    topics.sort(key=lambda t: t["size"], reverse=True)
    papers.sort(key=lambda p: (p["cluster_id"], -p["sim_to_centroid"], (p["title"] or "")))

    out_topics = f"{uni_key}_topics.json"
    out_papers = f"{uni_key}_papers.json"
    with open(out_topics, "w", encoding="utf-8") as f:
        json.dump(topics, f, indent=2, ensure_ascii=False)
    with open(out_papers, "w", encoding="utf-8") as f:
        json.dump(papers, f, indent=2, ensure_ascii=False)

    print(f"[ok] → {out_topics} ({len(topics)} bubbles), {out_papers} ({len(papers)} papers)")

# =========================
# Entry
# =========================
if __name__ == "__main__":
    for p in CLUSTERED_FILES:
        path = Path(p)
        if path.exists():
            process_university(path)
        else:
            print(f"[skip] {p} not found")
