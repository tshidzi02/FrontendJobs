# =============================================================================
# FILE: backend/services/job_search.py  (REBUILT — 50+ results target)
# =============================================================================
# SOURCES:
#   1. Adzuna   — queried across ZA + US + GB in parallel → up to 30 results each
#   2. TheMuse  — up to 20 results per query
#   3. RemoteOK — up to 20 results (remote jobs only)
#   4. JSearch  — up to 10 results per page (RapidAPI, may timeout)
#
# STRATEGY TO HIT 50+:
#   - Adzuna: query ZA, US and GB simultaneously → deduplicate by title+company
#   - TheMuse: increase page size to 20
#   - RemoteOK: broaden keyword matching, increase limit to 20
#   - JSearch: 2 pages × 10 results = up to 20 (when available)
#   - All sources run concurrently via ThreadPoolExecutor
#   - Final dedup by title+company across all sources
# =============================================================================

import os
import re
import time
import datetime
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed


# =============================================================================
# HELPERS
# =============================================================================

def _relative_date(timestamp_or_iso):
    """Convert Unix timestamp or ISO string to '3 days ago' style label."""
    try:
        if isinstance(timestamp_or_iso, (int, float)):
            dt = datetime.datetime.utcfromtimestamp(timestamp_or_iso)
        else:
            dt = datetime.datetime.fromisoformat(
                str(timestamp_or_iso).replace("Z", "+00:00").split("+")[0]
            )
        delta = datetime.datetime.utcnow() - dt
        days  = delta.days
        if days == 0:   return "Today"
        if days == 1:   return "1 day ago"
        if days < 7:    return f"{days} days ago"
        if days < 30:   return f"{days // 7} week{'s' if days//7 > 1 else ''} ago"
        return f"{days // 30} month{'s' if days//30 > 1 else ''} ago"
    except Exception:
        return str(timestamp_or_iso)


def _strip_html(text):
    """Remove HTML tags from a string."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", " ", text).strip()


def _dedup(jobs):
    """
    Remove duplicate jobs by (title.lower, company.lower).
    First occurrence wins (highest-priority source comes first).
    """
    seen = set()
    result = []
    for job in jobs:
        key = (job["title"].lower().strip(), job["company"].lower().strip())
        if key not in seen:
            seen.add(key)
            result.append(job)
    return result


# =============================================================================
# SOURCE 1 — ADZUNA
# Queries ZA, US and GB in parallel. Each country can return up to `results`
# per page. We fetch page 1 and page 2 for each country to maximise volume.
# =============================================================================

def _fetch_adzuna(query, location, employment_type, salary_min, salary_max,
                  date_posted, country_code, page=1, results_per_page=20):
    """Fetch one page of Adzuna results for a specific country."""
    app_id  = os.environ.get("ADZUNA_APP_ID",  "")
    app_key = os.environ.get("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        return []

    params = {
        "app_id":           app_id,
        "app_key":          app_key,
        "results_per_page": results_per_page,
        "what":             query or "software developer",
        "content-type":     "application/json",
    }

    if location:
        params["where"] = location

    if salary_min:
        try: params["salary_min"] = int(salary_min)
        except ValueError: pass

    if salary_max:
        try: params["salary_max"] = int(salary_max)
        except ValueError: pass

    if date_posted:
        days_map = {"today": 1, "3days": 3, "week": 7, "month": 30}
        days = days_map.get(date_posted)
        if days:
            params["max_days_old"] = days

    url = f"https://api.adzuna.com/v1/api/jobs/{country_code}/search/{page}"

    try:
        resp = requests.get(url, params=params, timeout=12)
        if resp.status_code != 200:
            return []
        data = resp.json()
        jobs = []
        for item in data.get("results", []):
            # Salary
            sal_min = item.get("salary_min")
            sal_max = item.get("salary_max")
            if sal_min and sal_max:
                salary_str = f"{int(sal_min):,} – {int(sal_max):,}"
            elif sal_min:
                salary_str = f"{int(sal_min):,}+"
            else:
                salary_str = ""

            # Location
            loc_parts = []
            loc_obj = item.get("location", {})
            area = loc_obj.get("area", [])
            if area:
                loc_parts = area[-2:] if len(area) >= 2 else area
            loc_str = ", ".join(loc_parts) if loc_parts else location or ""

            jobs.append({
                "id":          f"adzuna-{item.get('id', '')}",
                "title":       item.get("title", ""),
                "company":     item.get("company", {}).get("display_name", ""),
                "location":    loc_str,
                "type":        "On-site",
                "salary":      salary_str,
                "posted":      _relative_date(item.get("created", "")),
                "description": item.get("description", ""),
                "url":         item.get("redirect_url", ""),
                #"source":      "Adzuna",
            })
        return jobs
    except Exception as e:
        print(f"[Adzuna {country_code} p{page}] Error: {e}")
        return []


def search_adzuna(query, location, employment_type, salary_min, salary_max, date_posted):
    """
    Run Adzuna across ZA (p1+p2), US (p1), GB (p1) concurrently.
    Target: up to 80 raw results before dedup.
    """
    tasks = [
        ("za", 1, 20),
        ("za", 2, 20),
        ("us", 1, 20),
        ("gb", 1, 20),
    ]
    all_jobs = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {
            ex.submit(
                _fetch_adzuna, query, location, employment_type,
                salary_min, salary_max, date_posted, cc, page, rpp
            ): (cc, page)
            for cc, page, rpp in tasks
        }
        for future in as_completed(futures):
            jobs = future.result()
            all_jobs.extend(jobs)

    # ZA results first, then US, then GB
    za = [j for j in all_jobs if "za" in j["id"]]
    other = [j for j in all_jobs if "za" not in j["id"]]
    combined = za + other

    print(f"[JobSearch] Adzuna: {len(combined)} raw results")
    return combined


# =============================================================================
# SOURCE 2 — THE MUSE
# Free tier, no auth required (key optional). Returns up to 20 per page.
# =============================================================================

def search_the_muse(query, location):
    """Fetch up to 40 results from The Muse (2 pages × 20)."""
    api_key = os.environ.get("THE_MUSE_API_KEY", "")
    all_jobs = []

    for page in [1, 2]:
        params = {
            "page":     page,
            "per_page": 20,
            "category": "Engineering",
            "level":    "Mid Level",
        }
        if api_key:
            params["api_key"] = api_key

        try:
            resp = requests.get(
                "https://www.themuse.com/api/public/jobs",
                params=params, timeout=10
            )
            if resp.status_code != 200:
                break
            data = resp.json()
            for item in data.get("results", []):
                # Filter by query keywords if provided
                title = item.get("name", "")
                if query:
                    q_words = query.lower().split()
                    if not any(w in title.lower() for w in q_words):
                        continue

                # Location
                locations = item.get("locations", [])
                loc_str = locations[0].get("name", "") if locations else ""

                # Remote detection
                job_type = "Remote" if "remote" in loc_str.lower() else "On-site"

                # Description
                desc = _strip_html(item.get("contents", ""))

                all_jobs.append({
                    "id":          f"muse-{item.get('id', '')}",
                    "title":       title,
                    "company":     item.get("company", {}).get("name", ""),
                    "location":    loc_str,
                    "type":        job_type,
                    "salary":      "",
                    "posted":      _relative_date(item.get("publication_date", "")),
                    "description": desc,
                    "url":         item.get("refs", {}).get("landing_page", ""),
                    #"source":      "TheMuse",
                })
        except Exception as e:
            print(f"[TheMuse p{page}] Error: {e}")
            break

    print(f"[JobSearch] TheMuse: {len(all_jobs)} results")
    return all_jobs


# =============================================================================
# SOURCE 3 — REMOTEOK
# No auth. Returns all remote jobs; we filter by query keywords.
# =============================================================================

def search_remoteok(query):
    """Fetch up to 25 remote jobs from RemoteOK matching the query."""
    try:
        headers = {"User-Agent": "cv-platform/1.0"}
        resp = requests.get(
            "https://remoteok.com/api", headers=headers, timeout=12
        )
        if resp.status_code != 200:
            print(f"[RemoteOK] HTTP {resp.status_code}")
            return []

        data = resp.json()
        # First item is a notice object, skip it
        jobs_raw = [item for item in data if isinstance(item, dict) and item.get("id")]

        # Broaden keyword matching — check title AND tags AND description
        keywords = query.lower().split() if query else []
        matched = []
        for item in jobs_raw:
            title = (item.get("position") or "").lower()
            tags  = " ".join(item.get("tags") or []).lower()
            desc  = (item.get("description") or "").lower()
            combined_text = f"{title} {tags} {desc}"

            if not keywords or any(kw in combined_text for kw in keywords):
                matched.append(item)

            if len(matched) >= 25:
                break

        result = []
        for item in matched:
            result.append({
                "id":          f"remoteok-{item.get('id', '')}",
                "title":       item.get("position", ""),
                "company":     item.get("company", ""),
                "location":    "Remote",
                "type":        "Remote",
                "salary":      item.get("salary", "") or "",
                "posted":      _relative_date(item.get("epoch", time.time())),
                "description": _strip_html(item.get("description", "")),
                "url":         item.get("url", ""),
                #"source":      "RemoteOK",
            })

        print(f"[JobSearch] RemoteOK: {len(result)} results")
        return result

    except Exception as e:
        print(f"[RemoteOK] Error: {e}")
        return []


# =============================================================================
# SOURCE 4 — JSEARCH (RapidAPI)
# When available, fetches 2 pages × 10 = up to 20 results.
# =============================================================================

def search_jsearch(query, location, employment_type, date_posted):
    """Fetch up to 20 results from JSearch (2 pages)."""
    api_key = os.environ.get("JSEARCH_API_KEY", "")
    if not api_key:
        return []

    # Build query string
    q = query or "software developer"
    if location:
        q = f"{q} in {location}"

    # Map employment type
    type_map = {
        "fulltime":   "FULLTIME",
        "parttime":   "PARTTIME",
        "contract":   "CONTRACTOR",
        "internship": "INTERN",
    }
    emp_type = type_map.get((employment_type or "").lower())

    # Map date posted
    date_map = {
        "today": "today",
        "3days": "3days",
        "week":  "week",
        "month": "month",
    }
    date_filter = date_map.get(date_posted, "all")

    headers = {
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
        "x-rapidapi-key":  api_key,
    }

    all_jobs = []

    for page in [1, 2]:
        params = {
            "query":       q,
            "page":        page,
            "num_pages":   1,
            "date_posted": date_filter,
        }
        if emp_type:
            params["employment_types"] = emp_type

        try:
            resp = requests.get(
                "https://jsearch.p.rapidapi.com/search",
                headers=headers, params=params, timeout=10
            )
            if resp.status_code != 200:
                print(f"[JSearch p{page}] HTTP {resp.status_code}")
                break

            data = resp.json()
            for item in data.get("data", []):
                # Salary
                sal_min = item.get("job_min_salary")
                sal_max = item.get("job_max_salary")
                sal_cur = item.get("job_salary_currency", "")
                if sal_min and sal_max:
                    salary_str = f"{sal_cur} {int(sal_min):,} – {int(sal_max):,}"
                elif sal_min:
                    salary_str = f"{sal_cur} {int(sal_min):,}+"
                else:
                    salary_str = ""

                # Type
                emp = (item.get("job_employment_type") or "").upper()
                type_map_rev = {
                    "FULLTIME": "Full-time", "PARTTIME": "Part-time",
                    "CONTRACTOR": "Contract", "INTERN": "Internship",
                }
                job_type = "Remote" if item.get("job_is_remote") else type_map_rev.get(emp, "On-site")

                # Posted
                ts = item.get("job_posted_at_timestamp")
                posted = _relative_date(ts) if ts else item.get("job_posted_at_datetime_utc", "")

                all_jobs.append({
                    "id":          f"jsearch-{item.get('job_id', '')}",
                    "title":       item.get("job_title", ""),
                    "company":     item.get("employer_name", ""),
                    "location":    f"{item.get('job_city', '')}, {item.get('job_country', '')}".strip(", "),
                    "type":        job_type,
                    "salary":      salary_str,
                    "posted":      posted,
                    "description": (item.get("job_description") or ""),
                    "url":         item.get("job_apply_link") or item.get("job_google_link", ""),
                    #"source":      "JSearch",
                })

        except Exception as e:
            print(f"[JSearch p{page}] Error: {e}")
            break

    print(f"[JobSearch] JSearch: {len(all_jobs)} results")
    return all_jobs


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def search_jobs(
    query          = "",
    location       = "",
    employment_type = "",
    salary_min     = None,
    salary_max     = None,
    date_posted    = "",
    remote_only    = False,
):
    """
    Query all sources concurrently and return a deduplicated, merged list.
    Target: 50+ results when sources are available.

    Source priority for dedup (first-wins):
        JSearch → Adzuna → TheMuse → RemoteOK
    """

    # If remote_only is set, force query to include "remote"
    effective_query = query
    if remote_only and "remote" not in (query or "").lower():
        effective_query = f"remote {query}".strip()

    results = {}

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(
                search_jsearch, effective_query, location, employment_type, date_posted
            ): "jsearch",
            executor.submit(
                search_adzuna, effective_query, location, employment_type,
                salary_min, salary_max, date_posted
            ): "adzuna",
            executor.submit(
                search_the_muse, effective_query, location
            ): "muse",
            executor.submit(
                search_remoteok, effective_query
            ): "remoteok",
        }

        for future in as_completed(futures):
            source = futures[future]
            try:
                results[source] = future.result()
            except Exception as e:
                print(f"[JobSearch] {source} failed: {e}")
                results[source] = []

    # Merge in priority order: JSearch first (richest data), then Adzuna, TheMuse, RemoteOK
    merged = (
        results.get("jsearch",  []) +
        results.get("adzuna",   []) +
        results.get("muse",     []) +
        results.get("remoteok", [])
    )

    # If remote_only filter, remove non-remote results
    if remote_only:
        merged = [j for j in merged if j.get("type") == "Remote"]

    # Deduplicate by title + company
    final = _dedup(merged)

    print(f"[JobSearch] Total after dedup: {len(final)} results")
    return final


# =============================================================================
# FILE: backend/services/semantic_matcher.py
# =============================================================================
# PURPOSE: Measures how "semantically similar" a CV summary is to a job description.
#
#          KEYWORD MATCHING vs SEMANTIC MATCHING — what's the difference?
#
#          Keyword matching (in ats_analyzer.py) checks:
#            "Does the word 'python' appear in both the CV and the JD?"
#            Problem: "engineered scalable systems" and "built robust infrastructure"
#            mean the SAME thing but share ZERO keywords.
#
#          Semantic matching (this file) checks:
#            "Do these two texts MEAN similar things?"
#            It converts text into mathematical vectors (lists of numbers) that
#            capture MEANING. Similar meanings → vectors point in similar directions.
#            "engineered scalable systems" ≈ "built robust infrastructure"
#            → high similarity score, even without shared words.
#
#          This is much more powerful and accurate than keyword matching alone.
#          That's why it's weighted at 50% in the ATS score (the biggest weight).
#
# HOW IT FITS IN THE FLOW:
#   app.py (generate route):
#     1. Calls semantic_match_score(job_description, SUMMARY)
#        → THIS FILE sends BOTH texts to OpenAI Embeddings API
#        → Gets back two vectors (lists of ~1536 numbers each)
#        → Calculates cosine similarity between them
#        → Returns a score 0–100
#     2. That score is passed INTO analyze_ats() as semantic_score parameter
#        (semantic_matcher.py result feeds directly into ats_analyzer.py)
# =============================================================================


# =============================================================================
# SECTION 1: IMPORTS
# =============================================================================

from openai import OpenAI
# The official OpenAI Python client library.
# Used here to call the Embeddings API (not the Chat/Completions API).
# Embeddings API converts text → a list of numbers (a "vector").

import numpy as np
# NumPy = Numerical Python.
# The go-to library for mathematical operations on arrays and matrices.
# We use it here for:
#   - Converting Python lists to NumPy arrays (np.array())
#   - Dot product calculation (np.dot())
#   - Vector magnitude/norm calculation (np.linalg.norm())
# Install with: pip install numpy


# =============================================================================
# SECTION 2: CREATE OPENAI CLIENT
# =============================================================================

client = OpenAI()
# Creates the OpenAI client.
# Automatically reads OPENAI_API_KEY from environment variables.
# Same pattern as ai_engine.py — one client per module, reused for all requests.
# Note: This creates a SECOND OpenAI client (ai_engine.py also creates one).
# In a larger app, you'd share one client across modules, but this works fine here.


# =============================================================================
# SECTION 3: EMBEDDING FUNCTION
# =============================================================================

def get_embedding(text):
    """
    Convert text into embedding vector using OpenAI model.
    """
    # PURPOSE: Take any string of text and convert it to a vector (list of numbers)
    #          that represents its MEANING in mathematical space.
    #
    # What is an "embedding"?
    #   Imagine a 3D space where "cat", "dog", "pet" are close together
    #   and "car", "truck", "vehicle" are close together, but "cat" and "car" are far apart.
    #   Embeddings do this in ~1536 DIMENSIONS (not just 3).
    #   The more similar in meaning, the closer together the vectors.
    #
    # PARAMETER:
    #   text (str) - Any text: job description, CV summary, skill list, etc.
    #
    # RETURNS:
    #   A Python list of ~1536 floating point numbers.
    #   e.g. [0.0123, -0.0456, 0.0789, ..., -0.0321]  (1536 numbers total)

    response = client.embeddings.create(
        model="text-embedding-3-small",
        # OpenAI's embedding model.
        # "text-embedding-3-small" is:
        #   - Fast and cheap (much cheaper than GPT models per token)
        #   - High quality (1536 dimensions)
        #   - Good for semantic similarity tasks
        # Other option: "text-embedding-3-large" (3072 dimensions, more accurate, costs more)

        input=text
        # The text we want to embed.
        # OpenAI will process this text and return a vector representing its meaning.
    )
    # FLOW: HTTP request sent to OpenAI Embeddings API
    #       Server processes text → returns response object with the vector inside

    return response.data[0].embedding
    # Breaking this down:
    #   response         → the full API response object
    #   .data            → a list of embedding results (we only sent one text, so one result)
    #   [0]              → the first (and only) result
    #   .embedding       → the actual list of numbers (the vector)
    #
    # Returns: [0.0123, -0.0456, 0.0789, ..., -0.0321]
    # This list has exactly 1536 numbers for "text-embedding-3-small".


# =============================================================================
# SECTION 4: COSINE SIMILARITY FUNCTION
# =============================================================================

def cosine_similarity(vec1, vec2):
    """
    Compute cosine similarity between two vectors.
    """
    # PURPOSE: Given two vectors (lists of numbers), calculate HOW SIMILAR
    #          they are in terms of the ANGLE between them.
    #
    # Why COSINE similarity and not just comparing the numbers directly?
    #   Cosine similarity measures the ANGLE between two vectors, not their length.
    #   Two vectors can have very different magnitudes but point in the same
    #   direction → they're semantically similar.
    #   This makes it robust to text length differences.
    #
    # Formula: cos(θ) = (A · B) / (||A|| × ||B||)
    #   A · B    = dot product (sum of element-wise multiplications)
    #   ||A||    = magnitude (length) of vector A
    #   ||B||    = magnitude (length) of vector B
    #
    # Result range: -1.0 to 1.0
    #   1.0  = identical direction (same meaning)
    #   0.0  = perpendicular (completely unrelated meaning)
    #  -1.0  = opposite direction (opposite meaning)
    # For text, scores are typically 0.0 to 1.0.
    #
    # PARAMETERS:
    #   vec1 (list) - First embedding vector (e.g. from job description)
    #   vec2 (list) - Second embedding vector (e.g. from CV summary)
    #
    # RETURNS:
    #   A float between -1.0 and 1.0

    vec1 = np.array(vec1)
    # Convert the Python list [0.012, -0.045, ...] into a NumPy array.
    # NumPy arrays support mathematical operations that plain Python lists don't.
    # e.g. You can't do list1 * list2 in Python, but numpy_array1 * numpy_array2 works.

    vec2 = np.array(vec2)
    # Same conversion for the second vector.

    return np.dot(vec1, vec2) / (
        np.linalg.norm(vec1) * np.linalg.norm(vec2)
    )
    # This is the cosine similarity formula:
    #
    # np.dot(vec1, vec2):
    #   Computes the DOT PRODUCT of the two vectors.
    #   Dot product = sum of (vec1[i] * vec2[i]) for all i
    #   = vec1[0]*vec2[0] + vec1[1]*vec2[1] + ... + vec1[1535]*vec2[1535]
    #   This measures "how much do these vectors align element by element?"
    #
    # np.linalg.norm(vec1):
    #   Computes the MAGNITUDE (length) of vector 1.
    #   norm = sqrt(vec1[0]² + vec1[1]² + ... + vec1[1535]²)
    #   This normalizes for vector length so we only measure DIRECTION (meaning).
    #
    # np.linalg.norm(vec2):
    #   Same for vector 2.
    #
    # Dividing the dot product by the product of both magnitudes gives us
    # the cosine of the angle between the two vectors.
    # High value (close to 1.0) = vectors point in same direction = similar meaning.


# =============================================================================
# SECTION 5: MAIN SEMANTIC MATCH FUNCTION
# =============================================================================

def semantic_match_score(job_description, cv_text):
    """
    Compute semantic similarity score between job and CV.
    """
    # PURPOSE: The "public" function called from app.py.
    #          Orchestrates the embedding → similarity calculation pipeline
    #          and returns a clean percentage score.
    #
    # PARAMETERS:
    #   job_description (str) - The full job posting text
    #   cv_text         (str) - The AI-generated CV summary text
    #
    # RETURNS:
    #   A float from 0 to ~100 representing semantic similarity percentage.
    #   e.g. 78.42

    job_embedding = get_embedding(job_description)
    # ↑ JUMPS TO: get_embedding() function above (in this same file)
    # Calls OpenAI Embeddings API with the job description text.
    # Returns: [0.012, -0.045, 0.078, ...] — a list of 1536 numbers
    # FLOW: → OpenAI API call → vector returned here

    cv_embedding = get_embedding(cv_text)
    # ↑ JUMPS TO: get_embedding() function above again
    # Calls OpenAI Embeddings API with the CV summary text.
    # Returns: another list of 1536 numbers representing the CV's meaning.
    # FLOW: → second OpenAI API call → second vector returned here
    #
    # NOTE: This means semantic_match_score() makes TWO OpenAI API calls total.
    # Combined with the one call in ai_engine.py, the /api/generate route
    # makes THREE OpenAI API calls in total per CV generation.

    similarity = cosine_similarity(job_embedding, cv_embedding)
    # ↑ JUMPS TO: cosine_similarity() function above (in this same file)
    # Passes both vectors in, gets back a number between -1.0 and 1.0.
    # For real text comparisons, this will typically be 0.6 to 0.95.
    # e.g. similarity = 0.7842

    score = similarity * 100
    # Convert from decimal (0.0–1.0) to percentage (0–100).
    # e.g. 0.7842 * 100 = 78.42

    return round(score, 2)
    # Round to 2 decimal places for clean display.
    # e.g. 78.4200001 → 78.42
    # FLOW: Returns 78.42 → back to app.py
    #       app.py passes this score into analyze_ats() as the semantic_score parameter
