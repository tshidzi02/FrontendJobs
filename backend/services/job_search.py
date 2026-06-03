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
