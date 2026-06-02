"""
ats_analyzer.py — Hybrid ATS scoring

ARCHITECTURE:
  - CV side:  structured data extraction (NER removed — not available on server)
  - JD side:  keyword extraction
  - Score:    how many JD keywords appear in CV skills + experience
"""

import re
import os


# ============================================================
# CV SIDE — extract skills directly from CV data structure
# ============================================================

def preprocess(text):
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def get_cv_skills_from_structure(cv_data):
    """
    Direct extraction from the structured cv_data dict.
    Guaranteed to get skills regardless of any model availability.
    """
    skills = set()
    for category in cv_data.get("skills", []):
        if isinstance(category, dict):
            for skill_obj in category.get("skills_list", []):
                if isinstance(skill_obj, dict):
                    raw = skill_obj.get("skill", "")
                    if raw:
                        skills.add(raw.lower().strip())
        elif isinstance(category, str):
            skills.add(category.lower().strip())
    return skills


# ============================================================
# JD SIDE — keyword extraction (no NER)
# ============================================================

STOPWORDS = {
    "the", "and", "for", "with", "you", "are", "that", "this",
    "have", "will", "from", "your", "our", "not", "but", "can",
    "all", "they", "what", "more", "been", "also", "its", "their",
    "who", "has", "one", "any", "would", "such", "well", "when",
    "into", "about", "than", "some", "like", "other", "over",
    "using", "years", "work", "team", "role", "based", "use",
    "including", "required", "experience", "skills", "ability",
    "strong", "good", "new", "key", "both", "each", "must",
    "preferred", "plus", "bonus", "high", "quality", "familiarity",
    "apply", "ensure", "help", "working", "across", "within",
    "seeking", "looking", "join", "make", "take", "used", "given",
    "need", "needs", "want", "should", "tasks", "task", "tools",
    "level", "time", "write", "here", "type", "detail", "details",
    "growing", "similar", "various", "develop", "provide",
    "support", "maintain", "Cape", "Western", "Town", "Africa",
    "South", "Location", "Remote", "Hybrid", "salary", "negotiable",
    "responsibilities", "requirements", "qualifications",
    "environment", "company", "passionate", "fulltime", "parttime",
    "position", "vacancy", "opportunity", "candidate", "applicant",
}

ALIASES = {
    "javascript": ["js", "javascript", "ecmascript", "es6"],
    "typescript": ["ts", "typescript"],
    "nodejs":     ["node", "nodejs", "node.js"],
    "reactjs":    ["react", "reactjs", "react.js"],
    "nextjs":     ["next", "nextjs", "next.js"],
    "vuejs":      ["vue", "vuejs"],
    "python":     ["python", "python3"],
    "postgresql": ["postgres", "postgresql", "psql"],
    "mongodb":    ["mongo", "mongodb"],
    "mysql":      ["mysql", "sql"],
    "restapi":    ["rest", "restful"],
    "git":        ["git", "github", "gitlab"],
    "selenium":   ["selenium"],
    "jira":       ["jira"],
    "cypress":    ["cypress"],
    "docker":     ["docker"],
    "kubernetes": ["kubernetes", "k8s"],
    "aws":        ["aws"],
    "postman":    ["postman"],
    "pytest":     ["pytest"],
    "jenkins":    ["jenkins"],
    "java":       ["java"],
    "php":        ["php"],
}

ALIAS_LOOKUP = {}
for canonical, variants in ALIASES.items():
    for v in variants:
        ALIAS_LOOKUP[v.lower()] = canonical


def normalize(term):
    t = re.sub(r"[^\w\+\#\s]", " ", term.lower().strip())
    t = re.sub(r"\s+", " ", t).strip()
    return ALIAS_LOOKUP.get(t, t)


def extract_jd_keywords(job_description):
    """
    Extract meaningful tech keywords from JD using regex + stopword filter.
    Returns set of normalized keyword strings.
    """
    jd_lower = job_description.lower()
    jd_lower = re.sub(r'(location|salary|job type|employment type)\s*:.*', '', jd_lower)

    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9\+\#\.]*", jd_lower)
    keywords = set()
    for t in tokens:
        t = t.strip('.')
        if len(t) < 3:
            continue
        if t.lower() in STOPWORDS:
            continue
        if re.fullmatch(r'[0-9]+', t):
            continue
        keywords.add(normalize(t))
    return keywords


# ============================================================
# MATCHING
# ============================================================

def skill_in_jd(skill_str, jd_normalized_text, jd_keywords):
    """Check if a CV skill matches the JD."""
    skill_words = re.split(r'[\s/&,]+', skill_str.strip())
    norm_words = [normalize(w) for w in skill_words if len(w) > 1]
    if not norm_words:
        return False
    return any(w in jd_keywords or w in jd_normalized_text for w in norm_words)


# ============================================================
# MAIN ATS ANALYZER
# ============================================================

def analyze_ats(cv_data, job_description, semantic_score):
    """
    Hybrid ATS scoring:
      - Structured cv_data extraction for CV skills
      - Keyword extraction for JD

    Weights:
        - Semantic similarity : 30%
        - Skills match        : 50%
        - Experience match    : 20%
    """

    # --------------------------------------------------
    # 1. SAFETY CHECK
    # --------------------------------------------------
    if not job_description or not job_description.strip():
        return {
            "final_score": 0,
            "semantic_score": 0,
            "skills_match": 0,
            "experience_match": 0,
            "missing_keywords": []
        }

    # --------------------------------------------------
    # 2. EXTRACT CV SKILLS from structured data
    # --------------------------------------------------
    cv_skills = get_cv_skills_from_structure(cv_data)
    print(f"[ATS DEBUG] Struct skills count: {len(cv_skills)}")

    # --------------------------------------------------
    # 3. EXTRACT JD KEYWORDS
    # --------------------------------------------------
    jd_keywords = extract_jd_keywords(job_description)
    jd_normalized = re.sub(r"[^\w\+\# ]", " ", job_description.lower())

    # --------------------------------------------------
    # 4. SKILLS MATCH (50% weight)
    # --------------------------------------------------
    skill_hits = sum(
        1 for skill in cv_skills
        if skill_in_jd(skill, jd_normalized, jd_keywords)
    )
    skills_match = min((skill_hits / max(len(cv_skills), 1)) * 100, 100)

    # --------------------------------------------------
    # 5. EXPERIENCE MATCH (20% weight)
    # --------------------------------------------------
    experience_text = ""
    for exp in cv_data.get("experience", []):
        if isinstance(exp, dict):
            for bullet in exp.get("bullets", []):
                experience_text += bullet.lower() + " "

    exp_words = set(re.findall(r"[a-z0-9\+\#]+", experience_text))
    exp_hits = sum(1 for kw in jd_keywords if kw in exp_words)
    raw_exp = (exp_hits / max(len(jd_keywords), 1)) * 100

    if raw_exp < 15:
        experience_match = 40
    elif raw_exp < 35:
        experience_match = 60
    elif raw_exp < 60:
        experience_match = 75
    else:
        experience_match = 90

    # --------------------------------------------------
    # 6. FINAL WEIGHTED SCORE
    # --------------------------------------------------
    final_score = (
        (semantic_score   * 0.30) +
        (skills_match     * 0.50) +
        (experience_match * 0.20)
    )
    final_score = round(min(final_score, 100), 2)

    # --------------------------------------------------
    # 7. MISSING KEYWORDS
    # --------------------------------------------------
    all_cv_words = set()
    for skill in cv_skills:
        for w in re.split(r'[\s/&,]+', skill):
            all_cv_words.add(normalize(w))
    all_cv_words.update(exp_words)

    missing = sorted(
        kw for kw in jd_keywords
        if kw not in all_cv_words
        and len(kw) > 3
        and not re.fullmatch(r'[0-9]+', kw)
    )

    return {
        "final_score": final_score,
        "semantic_score": round(semantic_score, 2),
        "skills_match": round(skills_match, 2),
        "experience_match": round(experience_match, 2),
        "missing_keywords": missing[:10]
    }