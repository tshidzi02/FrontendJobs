# ============================================================
# services/smart_jobs_service.py
# Smart Job Search + LaTeX CV+CoverLetter Generator
#
# Job fetching now uses ALL 4 APIs via the existing search_jobs()
# from job_search.py (JSearch + Adzuna + TheMuse + RemoteOK)
# running in parallel — same engine as the regular Job Search page.
# ============================================================

import os
import zipfile
import tempfile
import numpy as np
from openai import OpenAI
from services.job_search import search_jobs

client = OpenAI()


# ============================================================
# 1. FETCH + NORMALISE JOBS FROM ALL 4 APIS
# ============================================================

def fetch_all_jobs(query, location="", page=1):
    """
    Calls search_jobs() which queries JSearch + Adzuna + TheMuse + RemoteOK
    in parallel (same as the regular Job Search page) and returns a
    deduplicated list of up to 100+ results.

    We paginate in batches of 20 using the `page` parameter.
    """
    raw_jobs = search_jobs(
        query=query,
        location=location,
        employment_type="",
        salary_min=None,
        salary_max=None,
        date_posted="",
        remote_only=False,
    )

    normalised = [normalise_job(job) for job in raw_jobs]

    # Return 20 per page
    start = (page - 1) * 20
    end   = start + 20
    return normalised[start:end], len(normalised)


def normalise_job(raw):
    """
    Convert a job from job_search.py's unified format into Smart Jobs format.
    job_search.py returns: id, title, company, location, type, salary,
                           posted, description, url, source
    """
    job_id  = raw.get("id", "") or raw.get("job_id", "")
    salary  = raw.get("salary", "") or "Not disclosed"
    if not salary.strip():
        salary = "Not disclosed"

    work_type = raw.get("type", "")
    if not work_type:
        work_type = "Remote" if raw.get("job_is_remote") else "Onsite"

    # Get description — Adzuna free tier often returns empty strings
    description = (
        raw.get("description", "")
        or raw.get("job_description", "")
        or ""
    ).strip()

    # If description is empty, build a minimal one from available fields
    # so AI ranking still has something to work with
    if not description:
        title   = raw.get("title", "") or raw.get("job_title", "")
        company = raw.get("company", "") or raw.get("employer_name", "")
        loc     = raw.get("location", "")
        description = f"{title} at {company} — {loc}. Full description available on the job listing page.".strip(" —.")

    return {
        "job_id":          job_id,
        "title":           raw.get("title", "") or raw.get("job_title", ""),
        "company":         raw.get("company", "") or raw.get("employer_name", ""),
        "location":        raw.get("location", ""),
        "salary":          salary,
        "work_type":       work_type,
        "employment_type": raw.get("employment_type", ""),
        "description":     description,
        "apply_url":       raw.get("url", "") or raw.get("apply_url", "") or raw.get("job_apply_link", ""),
        "posted_at":       raw.get("posted", "") or raw.get("posted_at", ""),
        "company_logo":    raw.get("employer_logo", ""),
        "source":          raw.get("source", ""),
        "match_score":     0,
        "status":          "ranked",
    }


# ============================================================
# 2. RANK JOBS AGAINST PROFILE
# ============================================================

def build_profile_text(profile):
    parts = []
    if profile.get("summary"):
        parts.append(profile["summary"])

    skills = profile.get("skills", [])
    if skills:
        if isinstance(skills[0], str):
            parts.append("Skills: " + ", ".join(skills))
        else:
            for cat in skills:
                skill_names = [s.get("skill", "") for s in cat.get("skills_list", [])]
                parts.append(", ".join(skill_names))

    for exp in profile.get("experience", []):
        parts.append(f"{exp.get('role', '')} at {exp.get('company', '')}")
        for b in exp.get("bullets", []):
            parts.append(b)

    for proj in profile.get("projects", []):
        parts.append(f"Project: {proj.get('name', '')} - {proj.get('description', '')}")

    return " ".join(parts)


def get_embedding(text):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000]
    )
    return response.data[0].embedding


def cosine_similarity(v1, v2):
    v1 = np.array(v1)
    v2 = np.array(v2)
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))


def rank_jobs(jobs, profile):
    """Score each job against the user profile. Returns sorted best → worst."""
    profile_text = build_profile_text(profile)
    if not profile_text.strip():
        return jobs

    try:
        profile_embedding = get_embedding(profile_text)
    except Exception as e:
        print(f"[Ranking Error] Could not embed profile: {e}")
        return jobs

    for job in jobs:
        try:
            jd_text = f"{job['title']} {job['company']} {job['description'][:3000]}"
            job_embedding = get_embedding(jd_text)
            job["match_score"] = round(cosine_similarity(profile_embedding, job_embedding) * 100, 1)
        except Exception as e:
            print(f"[Ranking Error] Job {job.get('job_id')}: {e}")
            job["match_score"] = 0

    return sorted(jobs, key=lambda j: j["match_score"], reverse=True)


# ============================================================
# 3. BUILD SEARCH QUERY FROM PROFILE
# ============================================================

def build_search_query(profile, user_query=None):
    if user_query:
        return user_query

    experience = profile.get("experience", [])
    if experience:
        role = experience[0].get("role", "")
        if role:
            return role

    skills = profile.get("skills", [])
    if skills and isinstance(skills[0], str):
        return skills[0]

    return "Software Developer"


# ============================================================
# 4. GENERATE COMBINED LATEX FOR ONE JOB
#    Uses the SAME builders as Bulk Generate:
#      build_cv_tex()           from cv_latex.py
#      build_cover_letter_tex() from cover_letter_latex.py
#    Then combines them identically to BulkGenerate's buildCombined()
# ============================================================

from services.cv_latex import build_cv_tex
from services.cover_letter_latex import build_cover_letter_tex
from services.cover_letter_generator import generate_cover_letter
from services.ai_engine import generate_cv_content


def _build_combined(cv_tex, cl_tex):
    """
    Merge two standalone .tex documents into one file.
    Identical logic to BulkGenerate.jsx buildCombined():
      - Uses CV preamble (has all packages, colours, fonts)
      - Cover letter body first, then \\newpage, then CV body
    """
    def extract_body(tex):
        start = tex.find("\\begin{document}")
        end   = tex.rfind("\\end{document}")
        if start == -1 or end == -1:
            return tex
        return tex[start + len("\\begin{document}"):end].strip()

    preamble = cv_tex[:cv_tex.find("\\begin{document}")].strip()
    cv_body  = extract_body(cv_tex)
    cl_body  = extract_body(cl_tex)

    return "\n".join([
        preamble,
        "",
        "\\begin{document}",
        "",
        "% ═══════════════════════════════════════════════════════════════════════",
        "% COVER LETTER",
        "% ═══════════════════════════════════════════════════════════════════════",
        cl_body,
        "",
        "\\newpage",
        "",
        "% ═══════════════════════════════════════════════════════════════════════",
        "% CURRICULUM VITAE",
        "% ═══════════════════════════════════════════════════════════════════════",
        cv_body,
        "",
        "\\end{document}",
    ])


def generate_latex_for_job(profile, job):
    """
    Generate the combined CV + Cover Letter .tex for one job.
    Uses EXACTLY the same pipeline as Bulk Generate:

    Step 1 — generate_cv_content()    → same AI engine as Generate CV page
             (300-350 word summary, gpt-4o, full structured output)
    Step 2 — generate_cover_letter()  → same as Cover Letter page
    Step 3 — build_cv_tex()           → same as Download CV (.tex)
    Step 4 — build_cover_letter_tex() → same as Download Cover Letter (.tex)
    Step 5 — _build_combined()        → same as Bulk Generate combined tab
    """
    personal  = profile.get("personalInfo", {})
    job_desc  = job.get("description", "")

    # Extract profile fields in the format generate_cv_content() expects
    # (same extraction the Generate CV page does before calling the API)
    base_skills = []
    for cat in profile.get("skills", []):
        if isinstance(cat, dict):
            for s in cat.get("skills_list", []):
                if isinstance(s, dict):
                    base_skills.append(s.get("skill", ""))
                elif isinstance(s, str):
                    base_skills.append(s)
        elif isinstance(cat, str):
            base_skills.append(cat)

    base_experience    = profile.get("experience", [])
    project_experience = [p for p in profile.get("projects", []) if p.get("includeInCV", True)]
    education          = profile.get("education", [])
    languages          = profile.get("languages", [])
    references         = profile.get("references", "Available upon Request")

    # ── Step 1: Same AI engine as Generate CV page ────────────────────────────
    try:
        ai_result = generate_cv_content(
            job_description    = job_desc,
            base_skills        = base_skills,
            base_experience    = base_experience,
            project_experience = project_experience,
            education          = education,
            languages          = languages,
            references         = references,
        )
    except Exception as ex:
        print(f"[SmartJobs LaTeX] CV AI error: {ex}")
        ai_result = {
            "SUMMARY":          profile.get("summary", ""),
            "skills":           profile.get("skills", []),
            "experience":       base_experience,
            "project_experience": project_experience,
            "education":        education,
            "languages":        languages,
            "REFERENCE":        references,
        }

    # ── Step 2: Same cover letter generator as Cover Letter page ─────────────
    try:
        cl_result         = generate_cover_letter(job_desc, profile, tone="professional")
        cover_letter_text = cl_result.get("cover_letter", "")
    except Exception as ex:
        print(f"[SmartJobs LaTeX] Cover letter AI error: {ex}")
        cover_letter_text = (
            f"I am writing to express my interest in the {job.get('title','')} position "
            f"at {job.get('company','')}. My background and skills make me a strong "
            "candidate for this role, and I would welcome the opportunity to contribute "
            "to your team."
        )

    # ── Step 3 + 4: Same LaTeX builders as Download CV/Cover Letter ───────────
    cv_tex = build_cv_tex(profile, ai_result)
    cl_tex = build_cover_letter_tex(profile, cover_letter_text, job_title=job.get("title", ""))

    # ── Step 5: Same combination as Bulk Generate combined tab ───────────────
    return _build_combined(cv_tex, cl_tex)


# ============================================================
# 5. GENERATE ZIP OF ALL LATEX FILES
# ============================================================

def generate_batch_zip(profile, jobs):
    """Generate a ZIP containing one .tex file per job. Returns bytes."""
    zip_buffer = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    zip_buffer.close()

    with zipfile.ZipFile(zip_buffer.name, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, job in enumerate(jobs):
            try:
                latex        = generate_latex_for_job(profile, job)
                company_safe = "".join(c if c.isalnum() else "_" for c in job.get("company", "Company"))
                title_safe   = "".join(c if c.isalnum() else "_" for c in job.get("title", "Role"))
                filename     = f"{i+1:02d}_{company_safe}_{title_safe}_CV_CoverLetter.tex"
                zf.writestr(filename, latex)
                print(f"[ZIP] Generated: {filename}")
            except Exception as e:
                print(f"[ZIP Error] Job {i+1}: {e}")

    with open(zip_buffer.name, "rb") as f:
        zip_bytes = f.read()

    os.unlink(zip_buffer.name)
    return zip_bytes

