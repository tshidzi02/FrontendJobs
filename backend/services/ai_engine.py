# =============================================================================
# FILE: backend/services/ai_engine.py
# =============================================================================

from openai import OpenAI
import json
import math

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
        f"  {i+1}. {exp.get('role', 'Unknown Role')} @ {exp.get('company', 'Unknown Company')} ({exp.get('startYear', '')} - {exp.get('endYear', '')})"
        for i, exp in enumerate(base_experience or [])
    )

    # =========================================================================
    # MAIN CALL — Summary, Experience, Projects, Education
    # Uses gpt-4o-mini to reduce memory usage on Render
    # =========================================================================

    main_prompt = f"""You are a professional CV writer. Return valid JSON only.

RULES:
1. Do NOT invent new job roles or companies.
2. CRITICAL — EXPERIENCE COUNT: You MUST return EXACTLY {experience_count} experience entries.
   Do NOT merge, combine, skip, or drop any entry.
   The candidate has these exact roles:
{experience_role_list}
3. For each experience entry:
   - Copy role, company, city, country, startYear, endYear EXACTLY as provided.
   - Keep EVERY original bullet point — do not delete any.
   - You may rewrite bullets to be stronger (better verbs, measurable impact).
   - You may ADD new bullets relevant to the job description.
   - dates field must be formatted as "startYear - endYear".
4. For each project_experience entry:
   - Copy title and tech_stack EXACTLY as provided.
   - Keep EVERY original bullet. Add at least 2 new bullets aligned to the JD.
5. Do NOT modify education, languages, or references. Copy exactly.
6. SUMMARY: 300-350 words, professional, first person, tailored to this job.
7. Return valid JSON only. No markdown. No backticks.

CANDIDATE EXPERIENCE:
{base_experience}

PROJECT EXPERIENCE:
{filtered_projects}

EDUCATION:
{education or []}

LANGUAGES:
{languages or []}

REFERENCES:
{references or "Available upon Request"}

JOB DESCRIPTION:
{job_description[:2000]}

Return this exact JSON structure:
{{
  "SUMMARY": "300-350 word summary",
  "experience": [
    {{
      "role": "exact role",
      "company": "exact company",
      "city": "exact city",
      "country": "exact country",
      "startYear": "exact startYear",
      "endYear": "exact endYear",
      "dates": "startYear - endYear",
      "bullets": ["bullet 1", "bullet 2", "bullet 3"]
    }}
  ],
  "project_experience": [
    {{
      "title": "exact title",
      "tech_stack": "exact tech_stack",
      "urls": [],
      "bullets": ["bullet 1", "bullet 2"]
    }}
  ],
  "education": [
    {{
      "degree": "exact degree",
      "institution": "exact institution",
      "city": "exact city",
      "country": "exact country",
      "graduationStatus": "exact status",
      "graduationMonth": "exact month",
      "graduationYear": "exact year",
      "minimumAverage": "exact value",
      "coursework": ["course 1: relevance", "course 2: relevance"]
    }}
  ],
  "languages": [{{"name": "exact name", "level": 3}}],
  "REFERENCE": "exact reference text"
}}"""

    main_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional CV writer. Return valid JSON only. Never use markdown."},
            {"role": "user", "content": main_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.5,
        max_tokens=4000,
    )

    main_data = json.loads(main_response.choices[0].message.content)
    summary = main_data.get("SUMMARY", "")

    returned_experience = main_data.get("experience", [])
    if len(returned_experience) != experience_count:
        print(f"WARNING: Expected {experience_count} experience entries, got {len(returned_experience)}")

    # =========================================================================
    # SKILLS GAP CALL
    # =========================================================================

    own_skills_str = ", ".join(own_skill_names) if own_skill_names else "none listed"

    skills_prompt = f"""You are a skills extraction engine. Return valid JSON only.

CANDIDATE'S EXISTING SKILLS (exclude ALL of these from output):
{own_skills_str}

JOB DESCRIPTION:
{job_description[:1500]}

Extract every distinct technical skill, tool, framework, platform, or methodology from the JD.
Filter out any the candidate already has.
Add up to 10 implied skills a hiring manager would expect.
Group into logical categories.
For each skill write a SHORT description (max 25 words).

Return ONLY this JSON:
{{
  "new_skill_categories": [
    {{
      "category": "Category Name",
      "skills_list": [
        {{
          "skill": "Skill Name",
          "description": "Max 25 words description.",
          "is_new": true
        }}
      ]
    }}
  ]
}}"""

    skills_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a skills extraction engine. Return valid JSON only."},
            {"role": "user", "content": skills_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.5,
        max_tokens=3000,
    )

    skills_data = json.loads(skills_response.choices[0].message.content)
    new_skill_categories = skills_data.get("new_skill_categories", [])

    # =========================================================================
    # DESCRIPTIONS CALL — batched, gpt-4o-mini
    # =========================================================================

    def chunk_list(lst, size):
        for i in range(0, len(lst), size):
            yield lst[i:i + size]

    own_skills_descriptions = {}

    if own_skill_names:
        for batch in chunk_list(own_skill_names, 20):
            batch_str = ", ".join(batch)
            desc_prompt = f"""You are a CV skills writer. Return valid JSON only.

For each skill below, write one first-person paragraph (min 50 words) explaining
how I have used this skill, what I did with it, and why it is valuable for this job.

Skills: {batch_str}

Job summary: {job_description[:300]}

Return ONLY this JSON:
{{
  "descriptions": {{
    "SkillName": "First person paragraph here.",
    "AnotherSkill": "First person paragraph here."
  }}
}}"""

            desc_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Return valid JSON only. Write a description for EVERY skill listed."},
                    {"role": "user", "content": desc_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=3000,
            )

            batch_data = json.loads(desc_response.choices[0].message.content)
            own_skills_descriptions.update(batch_data.get("descriptions", {}))
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
                "description": desc_lookup.get(
                    skill_name.lower(), "A skill I have that is relevant to this job."
                ),
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
                    skill_obj["description"] = f"{skill_obj.get('skill', 'This skill')} is relevant to this role."
            final_skills.append(cat)

    # Re-attach project URLs
    ai_projects = main_data.get("project_experience", [])
    for proj in ai_projects:
        if isinstance(proj, dict):
            name = proj.get("title", "")
            proj["urls"] = project_url_map.get(name, [])

    return {
        "SUMMARY":            summary,
        "skills":             final_skills,
        "experience":         main_data.get("experience", []),
        "project_experience": ai_projects,
        "education":          main_data.get("education", education or []),
        "languages":          main_data.get("languages", languages or []),
        "REFERENCE":          main_data.get("REFERENCE", references or "Available upon Request"),
    }