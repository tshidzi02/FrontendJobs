# =============================================================================
# FILE: backend/services/ai_engine.py
# Parallelized: main + skills calls run concurrently to beat 30s timeout
# =============================================================================

from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

client = OpenAI()


def generate_cv_content(
    job_description,
    base_skills,
    base_experience,
    project_experience,
    education=None,
    languages=None,
    references=None
):
    own_skill_names = [
        s.strip() for s in (base_skills or [])
        if isinstance(s, str) and s.strip()
    ]

    filtered_projects = [
        p for p in (project_experience or [])
        if p.get("includeInCV", True)
    ]

    def _extract_urls(p):
        raw = p.get("urls")
        if raw and isinstance(raw, list) and any(raw):
            return [u for u in raw if isinstance(u, str) and u.strip()]
        if p.get("url"):
            return [p["url"]]
        return []

    project_url_map = {
        p.get("name", p.get("title", "")): _extract_urls(p)
        for p in filtered_projects
    }

    experience_count = len(base_experience) if base_experience else 0
    experience_role_list = "\n".join(
        f"  {i+1}. {exp.get('role','Unknown')} @ {exp.get('company','Unknown')} ({exp.get('startYear','')} - {exp.get('endYear','')})"
        for i, exp in enumerate(base_experience or [])
    )

    jd_short = job_description[:2000]
    own_skills_str = ", ".join(own_skill_names) if own_skill_names else "none listed"

    # =========================================================================
    # CALL 1 — Main CV content
    # =========================================================================
    def call_main():
        prompt = f"""You are a professional CV writer. Return valid JSON only.

RULES:
1. Do NOT invent new job roles or companies.
2. Return EXACTLY {experience_count} experience entries in the same order:
{experience_role_list}
3. For each experience: copy role/company/city/country/startYear/endYear exactly.
   Keep every original bullet. Enhance and add new ones aligned to JD.
   dates = "startYear - endYear"
4. For each project: copy title/tech_stack exactly. Keep bullets, add 2+ new ones.
5. Do NOT modify education, languages, references. Copy exactly.
6. SUMMARY: 300-350 words, first person, tailored to JD.
7. Return valid JSON only. No markdown.

CANDIDATE EXPERIENCE: {base_experience}
PROJECT EXPERIENCE: {filtered_projects}
EDUCATION: {education or []}
LANGUAGES: {languages or []}
REFERENCES: {references or "Available upon Request"}
JOB DESCRIPTION: {jd_short}

Return JSON:
{{
  "SUMMARY": "...",
  "experience": [{{"role":"","company":"","city":"","country":"","startYear":"","endYear":"","dates":"","bullets":[]}}],
  "project_experience": [{{"title":"","tech_stack":"","urls":[],"bullets":[]}}],
  "education": [{{"degree":"","institution":"","city":"","country":"","graduationStatus":"","graduationMonth":"","graduationYear":"","minimumAverage":"","coursework":[]}}],
  "languages": [{{"name":"","level":3}}],
  "REFERENCE": ""
}}"""
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.5,
            max_tokens=4000,
        )
        return json.loads(resp.choices[0].message.content)

    # =========================================================================
    # CALL 2 — Skills gap
    # =========================================================================
    def call_skills():
        prompt = f"""You are a skills extraction engine. Return valid JSON only.

CANDIDATE'S EXISTING SKILLS (exclude from output): {own_skills_str}
JOB DESCRIPTION: {job_description[:1500]}

Extract every skill/tool/framework from the JD not already in candidate's skills.
Add up to 10 implied skills. Group into categories. Max 25-word descriptions.

Return JSON:
{{
  "new_skill_categories": [
    {{"category": "Name", "skills_list": [{{"skill": "","description": "","is_new": true}}]}}
  ]
}}"""
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.5,
            max_tokens=2000,
        )
        return json.loads(resp.choices[0].message.content)

    # =========================================================================
    # CALL 3 — Skill descriptions (batched)
    # =========================================================================
    def call_descriptions(batch):
        batch_str = ", ".join(batch)
        prompt = f"""Write first-person CV skill descriptions (min 50 words each).
For each skill: how I used it, what I did, why it's valuable for this job.

Skills: {batch_str}
Job summary: {job_description[:300]}

Return JSON:
{{"descriptions": {{"SkillName": "paragraph", "AnotherSkill": "paragraph"}}}}"""
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Return valid JSON only. Write a description for EVERY skill."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=3000,
        )
        return json.loads(resp.choices[0].message.content).get("descriptions", {})

    # =========================================================================
    # RUN CALL 1 + CALL 2 IN PARALLEL
    # =========================================================================
    main_data = {}
    new_skill_categories = []

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_main   = executor.submit(call_main)
        future_skills = executor.submit(call_skills)
        main_data         = future_main.result()
        skills_result     = future_skills.result()
        new_skill_categories = skills_result.get("new_skill_categories", [])

    summary = main_data.get("SUMMARY", "")

    returned_experience = main_data.get("experience", [])
    if len(returned_experience) != experience_count:
        print(f"WARNING: Expected {experience_count} experience entries, got {len(returned_experience)}")

    # =========================================================================
    # CALL 3 — Descriptions (after parallel calls complete)
    # =========================================================================
    def chunk_list(lst, size):
        for i in range(0, len(lst), size):
            yield lst[i:i + size]

    own_skills_descriptions = {}
    if own_skill_names:
        batches = list(chunk_list(own_skill_names, 20))
        with ThreadPoolExecutor(max_workers=len(batches)) as executor:
            futures = [executor.submit(call_descriptions, batch) for batch in batches]
            for future in as_completed(futures):
                own_skills_descriptions.update(future.result())
        print(f"[AI Engine] Descriptions collected: {len(own_skills_descriptions)}")

    # =========================================================================
    # BUILD FINAL SKILLS
    # =========================================================================
    desc_lookup = {k.lower(): v for k, v in own_skills_descriptions.items()}

    your_skills_category = {
        "category": "My Skills",
        "skills_list": [
            {
                "skill": skill_name,
                "description": desc_lookup.get(skill_name.lower(), "A skill I have that is relevant to this job."),
                "is_new": False
            }
            for skill_name in own_skill_names
        ]
    }

    final_skills = []
    if your_skills_category["skills_list"]:
        final_skills.append(your_skills_category)

    for cat in new_skill_categories:
        if isinstance(cat, dict) and cat.get("skills_list"):
            for skill_obj in cat["skills_list"]:
                if not skill_obj.get("description"):
                    skill_obj["description"] = f"{skill_obj.get('skill','This skill')} is relevant to this role."
            final_skills.append(cat)

    # Re-attach project URLs
    ai_projects = main_data.get("project_experience", [])
    for proj in ai_projects:
        if isinstance(proj, dict):
            proj["urls"] = project_url_map.get(proj.get("title", ""), [])

    return {
        "SUMMARY":            summary,
        "skills":             final_skills,
        "experience":         main_data.get("experience", []),
        "project_experience": ai_projects,
        "education":          main_data.get("education", education or []),
        "languages":          main_data.get("languages", languages or []),
        "REFERENCE":          main_data.get("REFERENCE", references or "Available upon Request"),
    }