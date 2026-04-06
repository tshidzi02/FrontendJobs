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

    # Store URL map keyed by project name so we can re-attach after AI call
    # (AI is not told about URLs — it only enhances bullets and titles)
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

    # =========================================================================
    # BUILD EXPERIENCE ROLE LIST — used in prompt to prevent AI from skipping
    # =========================================================================

    experience_count = len(base_experience) if base_experience else 0
    experience_role_list = "\n".join(
        f"  {i+1}. {exp.get('role', 'Unknown Role')} @ {exp.get('company', 'Unknown Company')} ({exp.get('startYear', '')} - {exp.get('endYear', '')})"
        for i, exp in enumerate(base_experience or [])
    )

    # =========================================================================
    # MAIN CALL — Summary, Experience, Projects, Education
    # =========================================================================

    main_prompt = f"""You are a professional CV writer. Return valid JSON only.

CANDIDATE BACKGROUND:
- Final-year BSc student in Applied Mathematics and Computer Science
- Strong Python and JavaScript developer
- Built academic and independent technical projects

RULES:
1. Do NOT invent new job roles or companies.
2. CRITICAL — EXPERIENCE COUNT: You MUST return EXACTLY {experience_count} experience entries.
   Do NOT merge, combine, skip, or drop any entry even if they share the same company or dates.
   Each entry is a SEPARATE role and must appear separately in the output in the EXACT same order.
   The candidate has these exact roles — every single one must appear:
{experience_role_list}
3. For each experience entry:
   - Copy role, company, city, country, startYear, endYear EXACTLY as provided.
   - Keep EVERY original bullet point the candidate wrote — do not delete any.
   - You may rewrite bullets to be stronger (better verbs, measurable impact).
   - You may ADD new bullets relevant to the job description after the originals.
   - The dates field must be formatted as "startYear - endYear" using the provided startYear and endYear values.
4. For each project_experience entry:
   - Copy title and tech_stack EXACTLY as provided.
   - Keep EVERY original bullet point the candidate wrote — do not delete any.
   - You may rewrite bullets to be stronger (better verbs, measurable impact).
   - You MUST ADD at least 2 new bullets per project that align it to the job description.
   - Every project bullet must connect the project work to what the job description requires.
   - If the candidate provided 0 bullets, you must still write at least 3 strong bullets.
5. Do NOT modify education. Copy every field exactly including minimumAverage.
6. Do NOT modify languages. Copy exactly.
7. Do NOT modify references. Copy exactly.
8. SUMMARY: 300-350 words, professional, first person, tailored to this job.
9. For each coursework item: format as "Course Name: One sentence on what it covers and why it is relevant to this specific job."
10. Return valid JSON only. No markdown. No backticks.

CANDIDATE EXPERIENCE:
{base_experience}

PROJECT EXPERIENCE:
{filtered_projects}

EDUCATION (copy every field exactly):
{education or []}

LANGUAGES (copy exactly):
{languages or []}

REFERENCES:
{references or "Available upon Request"}

JOB DESCRIPTION:
{job_description}

Return this exact JSON structure:
{{
  "SUMMARY": "300-350 word summary tailored to the job description, written in first person, professional tone.",
  "experience": [
    {{
      "role": "all exact job title from profile - make sure you do all of them do not combine the roles",
      "company": "exact company from profile",
      "city": "exact city from profile",
      "country": "exact country from profile",
      "startYear": "exact startYear from profile",
      "endYear": "exact endYear from profile",
      "dates": "startYear - endYear",
      "bullets": [
        "Original bullet 1 — enhanced or kept as-is",
        "Original bullet 2 — enhanced or kept as-is",
        "Original bullet 3 — enhanced or kept as-is",
        "Original bullet 4 — enhanced or kept as-is",
        "Original bullet 5 — enhanced or kept as-is",
        "AI-added bullet 1 relevant to this job description",
        "AI-added bullet 2 relevant to this job description",
        "AI-added bullet 3 relevant to this job description"
      ]
    }}
  ],
  "project_experience": [
    {{
      "title": "exact title from profile",
      "tech_stack": "exact tech_stack from profile",
      "urls": "list of URLs from profile, if any",
      "bullets": [
        "Original bullet 1 — enhanced with strong verbs and impact",
        "AI-added bullet directly aligned to the job description requirements"
      ]
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
      "minimumAverage": "exact value — mandatory",
      "coursework": [
        "all coursework items from profile, rewritten to be relevant to this job description, formatted as:
         Course Name 1: Why it is relevant to this job
         Course Name 2: Why it is relevant to this job
         Course Name 3: Why it is relevant to this job
         Course Name 4: Why it is relevant to this job
         Course Name 5: Why it is relevant to this job
         Course Name 6: Why it is relevant to this job
         Course Name 7: Why it is relevant to this job
         Course Name 8: Why it is relevant to this job
         Course Name 9: Why it is relevant to this job
         Course Name 10: Why it is relevant to this job
         Course Name 11: Why it is relevant to this job
         Course Name 12: Why it is relevant to this job
         Course Name 13: Why it is relevant to this job
         Course Name 14: Why it is relevant to this job
         Course Name 15: Why it is relevant to this job
         Course Name 16: Why it is relevant to this job
         Course Name 17: Why it is relevant to this job
         Course Name 18: Why it is relevant to this job
         Course Name 19: Why it is relevant to this job
         Course Name 20: Why it is relevant to this job"
      ]
    }}
  ],
  "languages": [
    {{
      "name": "exact name",
      "level": 3
    }}
  ],
  "REFERENCE": "exact reference text"
}}"""

    main_response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are a professional CV writer. Return valid JSON only. Never use markdown."
            },
            {"role": "user", "content": main_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.5,
        max_tokens=10000,
    )

    main_data = json.loads(main_response.choices[0].message.content)
    summary = main_data.get("SUMMARY", "")

    # =========================================================================
    # SAFETY CHECK — if AI dropped experience entries, log a warning
    # =========================================================================

    returned_experience = main_data.get("experience", [])
    if len(returned_experience) != experience_count:
        print(f"⚠️  WARNING: Expected {experience_count} experience entries, got {len(returned_experience)}")
        print(f"   Expected roles: {[exp.get('role') for exp in (base_experience or [])]}")
        print(f"   Returned roles: {[exp.get('role') for exp in returned_experience]}")

    # =========================================================================
    # SKILLS GAP CALL — extracts ALL skills from JD, excludes ones user has
    # =========================================================================

    own_skills_str = ", ".join(own_skill_names) if own_skill_names else "none listed"

    skills_prompt = f"""You are a skills extraction engine. Return valid JSON only.

CANDIDATE'S EXISTING SKILLS (exclude ALL of these from your output):
{own_skills_str}

JOB DESCRIPTION:
{job_description}

YOUR TASK — do these steps in order:

STEP 1 — EXTRACT: Read the entire job description and list EVERY distinct technical skill,
tool, framework, platform, methodology, or practice mentioned. Be exhaustive — do not skip
anything named in the JD. Common examples: languages (C#, Python, Go), frameworks
(.NET, React, Django), cloud platforms (AWS, Azure, GCP), databases (SQL Server, MongoDB),
DevOps tools (Docker, Kubernetes, Terraform), methodologies (Agile, TDD, SDLC), etc.

STEP 2 — FILTER: Remove any skill that already appears in the candidate's existing skills
list above. Do a case-insensitive comparison.

STEP 3 — AUGMENT: After the JD-extracted skills, add up to 10 additional skills that are
strongly implied by the role but not explicitly named in the JD. Only add skills a senior
hiring manager would expect a strong candidate to have for this specific role.

STEP 4 — GROUP: Organise all remaining skills into logical categories that match the JD's
structure (e.g. "Languages & Frameworks", "Backend & APIs", "Databases", "Cloud & DevOps",
"Tools & Practices", "Soft Skills"). Use as many categories as needed.

STEP 5 — DESCRIBE: For each skill write a SHORT description (max 25 words) explaining what
it is and why this specific job needs it.

RULES:
- Be exhaustive in Step 1 — if it's in the JD, it must appear unless the candidate already has it.
- Do NOT include any skill from the candidate's existing skills list.
- Return valid JSON only. No markdown. No backticks.

{{
  "new_skill_categories": [
    {{
      "category": "Category Name",
      "skills_list": [
        {{
          "skill": "Skill Name",
          "description": "Max 25 words: what it is and why this job needs it.",
          "is_new": true
        }}
      ]
    }}
  ]
}}"""

    skills_response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are a skills extraction engine. Return valid JSON only. Never use markdown."
            },
            {"role": "user", "content": skills_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.5,   # lower = more deterministic/complete extraction
        max_tokens=10000,   # was 1500 — the main reason skills were being cut off
    )

    skills_data = json.loads(skills_response.choices[0].message.content)
    new_skill_categories = skills_data.get("new_skill_categories", [])

    # =========================================================================
    # DESCRIPTIONS CALL — short descriptions for user's own skills (batched)
    # =========================================================================

    def chunk_list(lst, size):
        for i in range(0, len(lst), size):
            yield lst[i:i + size]

    own_skills_descriptions = {}

    if own_skill_names:
        for batch in chunk_list(own_skill_names, 20):
            batch_str = ", ".join(batch)
            desc_prompt = f"""You are a CV skills writer. Return valid JSON only.

For each skill below, write one short sentence (min 50 words) explaining
what it is and why it is relevant to this job.

Act as a professional career assistant helping me write strong, first-person skill statements for a CV or 
job application.

I will provide a list of skills.

For EACH skill, you MUST follow these rules strictly:

-Write in FIRST PERSON only (use "I", "my", "me").
-DO NOT give a generic definition of the skill.
-DO NOT explain the skill in a textbook or informational way.
-Instead, describe HOW I have USED this skill in real situations.
-Include SPECIFIC actions (what I did, how I applied the skill, what tools or environments I used).
-Explain WHY this skill makes me valuable and how I would use it in a job.
-Each skill must be ONE paragraph with a MINIMUM of 50 words.
-Keep it concise but impactful, avoiding repetition.
-Make it sound natural, confident, and professional (not robotic).

Structure each response like this:

-Start with how I have used the skill
-Then explain what I did with it
-End with why it is valuable and how I would apply it in a job

Example format (DO NOT COPY, just follow style):
"I have applied adaptability in fast-paced environments where I had to quickly learn new systems, 
adjust to changing requirements, and manage multiple responsibilities simultaneously. By doing this, 
I ensured efficiency and continuity in my work, and I would bring this same flexibility and 
problem-solving mindset to this role."

Now write for the following skills:
Skills: {batch_str}

Job (summary): {job_description[:400]}

Return ONLY this JSON:
{{
  "descriptions": {{
    "SkillName": "First person paragraph here.",
    "AnotherSkill": "First person paragraph here."
  }}
}}"""

            desc_response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Return valid JSON only. You MUST write a description for EVERY skill listed. Do not skip any."},
                    {"role": "user", "content": desc_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=10000,
            )

            batch_data = json.loads(desc_response.choices[0].message.content)
            own_skills_descriptions.update(batch_data.get("descriptions", {}))

            print("*****" * 50)
            print("*****" * 50)
            print("*****" * 50)
            print("TOTAL DESCRIPTIONS COLLECTED:", len(own_skills_descriptions))
            print("KEYS:", list(own_skills_descriptions.keys()))
            print("*****" * 50)
            print("*****" * 50)
            print("*****" * 50)

    # =========================================================================
    # BUILD SKILLS IN PYTHON — guaranteed, no AI involvement
    # =========================================================================

    # Build a lowercase lookup map
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

    # Add user's own skills FIRST
    if your_skills_category["skills_list"]:
        final_skills.append(your_skills_category)

    # Then add gap skills
    for cat in new_skill_categories:
        if isinstance(cat, dict) and cat.get("skills_list"):
            for skill_obj in cat["skills_list"]:
                if not skill_obj.get("description"):
                    skill_obj["description"] = f"{skill_obj.get('skill', 'This skill')} is relevant to this role."
            final_skills.append(cat)

    # Re-attach the project URLs (AI doesn't return them — source from profile)
    ai_projects = main_data.get("project_experience", [])
    for proj in ai_projects:
        if isinstance(proj, dict):
            name = proj.get("title", "")
            proj["urls"] = project_url_map.get(name, [])

    # =========================================================================
    # ASSEMBLE FINAL RESULT
    # =========================================================================

    return {
        "SUMMARY":            summary,
        "skills":             final_skills,
        "experience":         main_data.get("experience", []),
        "project_experience": ai_projects,
        "education":          main_data.get("education", education or []),
        "languages":          main_data.get("languages", languages or []),
        "REFERENCE":          main_data.get("REFERENCE", references or "Available upon Request"),
    }