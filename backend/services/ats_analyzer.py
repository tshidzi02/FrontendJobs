"""
ats_analyzer.py — Hybrid ATS scoring

ARCHITECTURE:
  - CV side:  NER model extracts skills (what it was trained for)
  - JD side:  keyword extraction (NER wasn't trained on JDs)
  - Score:    how many JD keywords appear in CV skills + experience

This is the correct approach given the NER model's training data
consisted entirely of CV documents, not job descriptions.
"""

import re
import os
import spacy

# ============================================================
# LOAD NER MODEL
# ============================================================

_NER_MODEL = None

def _get_nlp():
    global _NER_MODEL
    if _NER_MODEL is None:
        model_path = os.path.join(os.path.dirname(__file__), "ner_model")
        try:
            _NER_MODEL = spacy.load(model_path)
        except Exception as e:
            raise RuntimeError(
                f"Could not load NER model from '{model_path}'.\n"
                f"pip install 'spacy>=3.7.5,<3.8.0'\n"
                f"Error: {e}"
            )
    return _NER_MODEL


# ============================================================
# NER — CV SIDE
# ============================================================

def preprocess(text):
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_cv_entities(text):
    """Run NER on CV text. Returns list of [label, entity_text]."""
    nlp = _get_nlp()
    doc = nlp(preprocess(text))
    return [[ent.label_, ent.text.strip()] for ent in doc.ents]


def parse_skills_block(skills_text):
    """
    NER returns SKILLS as one big block:
      "Python, JavaScript, Manual Testing • Agile (1 year), Docker"
    Split into individual skill terms.
    """
    # Remove parenthetical notes like "(Less than 1 year)"
    text = re.sub(r'\([^)]*\)', '', skills_text)

    # Split on bullets, commas, pipes, semicolons, slashes
    parts = re.split(r'[•\|\n,;/]+', text)

    skills = set()
    for part in parts:
        part = part.strip(' .-–•')
        # Strip leading section labels like "Programming language:"
        part = re.sub(r'^[A-Za-z\s]{3,20}:\s*', '', part).strip()
        if 2 <= len(part) <= 60:
            skills.add(part.lower())

    return skills


def get_cv_skills_via_ner(cv_text):
    """
    Use NER model to extract skills from CV text.
    Returns set of individual skill strings.
    """
    entities = extract_cv_entities(cv_text)
    all_skills = set()
    for label, text in entities:
        if label == "SKILLS":
            all_skills.update(parse_skills_block(text))
    return all_skills


# ============================================================
# BUILD CV TEXT — structured to help NER recognise skills
# ============================================================

def build_cv_text(cv_data):
    """
    Build CV text that resembles the NER training data format.
    Training data was full CV documents — we include all sections.
    Crucially: skills are listed as a comma-separated block WITHOUT
    the word 'SKILLS' as a header (which confuses the NAME detector).
    """
    parts = []

    # Experience section first (like a real CV)
    for exp in cv_data.get("experience", []):
        if isinstance(exp, dict):
            role = exp.get("role", "")
            company = exp.get("company", "")
            if role and company:
                parts.append(f"{role} - {company}")
            for bullet in exp.get("bullets", []):
                parts.append(bullet)

    # Skills as a plain comma-separated list (no header)
    skill_names = []
    for category in cv_data.get("skills", []):
        if isinstance(category, dict):
            for skill_obj in category.get("skills_list", []):
                if isinstance(skill_obj, dict):
                    skill = skill_obj.get("skill", "")
                    if skill:
                        skill_names.append(skill)
        elif isinstance(category, str):
            skill_names.append(category)

    if skill_names:
        parts.append(", ".join(skill_names))

    return "\n".join(p for p in parts if p.strip())


# ============================================================
# FALLBACK: extract skills directly from CV data structure
# (used when NER extracts nothing)
# ============================================================

def get_cv_skills_from_structure(cv_data):
    """
    Direct extraction from the structured cv_data dict.
    This is the reliable fallback — guaranteed to get skills
    regardless of NER model behaviour.
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
    # Remove common JD boilerplate sections
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
    """
    Check if a CV skill matches the JD.
    Uses both substring match on full JD text and keyword set match.
    """
    skill_words = re.split(r'[\s/&,]+', skill_str.strip())
    norm_words = [normalize(w) for w in skill_words if len(w) > 1]

    if not norm_words:
        return False

    # OR logic: any meaningful word from the skill found in JD
    return any(w in jd_keywords or w in jd_normalized_text for w in norm_words)


# ============================================================
# MAIN ATS ANALYZER
# ============================================================

def analyze_ats(cv_data, job_description, semantic_score):
    """
    Hybrid ATS scoring:
      - NER model extracts skills from CV (what it was trained for)
      - Keyword extraction for JD (NER not trained on JDs)
      - Falls back to structured cv_data if NER finds nothing

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
    # 2. EXTRACT CV SKILLS
    # Try NER first, fall back to structured data
    # --------------------------------------------------
    cv_text = build_cv_text(cv_data)
    cv_skills_ner = get_cv_skills_via_ner(cv_text)
    cv_skills_struct = get_cv_skills_from_structure(cv_data)

    # Use NER results if it found something, otherwise use structured data
    cv_skills = cv_skills_ner if cv_skills_ner else cv_skills_struct

    print(f"[ATS DEBUG] NER skills: {cv_skills_ner}")
    print(f"[ATS DEBUG] Struct skills: {cv_skills_struct}")
    print(f"[ATS DEBUG] Using: {'NER' if cv_skills_ner else 'STRUCT'}")

    # --------------------------------------------------
    # 3. EXTRACT JD KEYWORDS
    # --------------------------------------------------
    jd_keywords = extract_jd_keywords(job_description)
    jd_normalized = re.sub(r"[^\w\+\# ]", " ", job_description.lower())

    # --------------------------------------------------
    # 4. SKILLS MATCH (50% weight)
    # How many CV skills appear in the JD?
    # (Same direction as internet ATS: cv count / jd count)
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
    # JD keywords not found in CV skills or experience
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