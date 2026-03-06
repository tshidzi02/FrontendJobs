# =============================================================================
# FILE: backend/services/cover_letter_generator.py  (NEW — Lesson 4.1)
# =============================================================================
# PURPOSE:
#   Generates a tailored, professional cover letter using GPT-4o.
#   Called by the /api/cover-letter route in app.py.
#
# INPUTS (all passed from the frontend via app.py):
#   job_description  → the full job posting the user is applying for
#   profile          → the user's saved profile dict:
#                        personalInfo, experience, skills, education, projects
#   tone             → "professional" | "enthusiastic" | "concise"
#                      lets the user adjust how the letter reads
#
# OUTPUT:
#   A dict with one key:
#     "cover_letter" → the full text of the cover letter (3-4 paragraphs)
#
# DESIGN DECISIONS:
#   1. SINGLE API CALL — a cover letter is one coherent piece of writing.
#      Unlike CV generation (which needs 3 calls to guarantee all skills appear),
#      a cover letter benefits from being written in one pass so the tone
#      and narrative flow are consistent throughout.
#
#   2. PLAIN TEXT OUTPUT — not JSON. The cover letter is a continuous piece
#      of prose. Asking GPT to wrap it in JSON would add noise with no benefit.
#      We ask for plain text and return it directly.
#
#   3. PROFILE AS CONTEXT — we pass the full profile so the AI can weave in
#      specific achievements, company names, and project details naturally.
#      This avoids the generic "I am a motivated professional" filler that
#      plagues AI-generated cover letters.
#
#   4. NO HALLUCINATION GUARD NEEDED — unlike CV generation, we're not asking
#      the AI to preserve exact field values. We're asking it to write persuasive
#      prose based on real data the user provided. The content is inherently
#      narrative rather than structured data.
# =============================================================================

from openai import OpenAI

client = OpenAI()


def generate_cover_letter(job_description, profile, tone="professional"):
    # ──────────────────────────────────────────────────────────────────────────
    # BUILD PROFILE SUMMARY
    # Extract the most useful parts of the profile for the prompt.
    # We don't dump the entire profile JSON — that wastes tokens and confuses
    # the model with irrelevant structure. We pull just what a human writer
    # would use to write a strong opening paragraph.
    # ──────────────────────────────────────────────────────────────────────────

    personal   = profile.get("personalInfo", {})
    experience = profile.get("experience", [])
    skills     = profile.get("skills", [])
    education  = profile.get("education", [])
    projects   = profile.get("projects", [])

    # Applicant name — used in sign-off
    first_name = personal.get("firstName", "")
    last_name  = personal.get("lastName", "")
    full_name  = f"{first_name} {last_name}".strip() or "The Applicant"

    # Current/most recent role — used in the opening hook
    current_role = personal.get("jobTitle", "")

    # Most recent experience entry — strongest evidence of track record
    most_recent_exp = ""
    if experience and isinstance(experience[0], dict):
        exp = experience[0]
        role    = exp.get("role", "")
        company = exp.get("company", "")
        bullets = exp.get("bullets", [])
        bullet_text = " ".join(bullets[:2])  # first two bullets as context
        most_recent_exp = f"{role} at {company}. {bullet_text}"

    # Skills — flat list of skill names
    skill_names = []
    for s in (skills or []):
        if isinstance(s, str):
            skill_names.append(s)
        elif isinstance(s, dict):
            # Structured format: {category, skills_list: [{skill}]}
            for item in s.get("skills_list", []):
                if isinstance(item, dict):
                    skill_names.append(item.get("skill", ""))
                elif isinstance(item, str):
                    skill_names.append(item)
    skills_str = ", ".join(filter(None, skill_names[:12]))  # cap at 12 to avoid token bloat

    # Highest education
    edu_str = ""
    if education and isinstance(education[0], dict):
        edu = education[0]
        edu_str = f"{edu.get('degree', '')} from {edu.get('institution', '')}".strip(" from")

    # Most notable project
    project_str = ""
    if projects and isinstance(projects[0], dict):
        proj = projects[0]
        project_str = proj.get("name", proj.get("title", ""))

    # ──────────────────────────────────────────────────────────────────────────
    # TONE INSTRUCTIONS
    # Map the user's tone choice to a brief instruction for the model.
    # Concrete tone guidance produces more distinct results than vague adjectives.
    # ──────────────────────────────────────────────────────────────────────────
    tone_instructions = {
        "professional": (
            "Write in a confident, formal tone. "
            "Clear and direct. No exclamation marks. No filler phrases like "
            "'I am excited to apply'. Demonstrate expertise calmly."
        ),
        "enthusiastic": (
            "Write with genuine enthusiasm and energy. "
            "Show real excitement about the company and the role. "
            "Be warm but not unprofessional. One or two impactful exclamations are fine."
        ),
        "concise": (
            "Write as briefly as possible. "
            "Maximum 3 short paragraphs. No fluff. Every sentence must add value. "
            "Get to the point immediately."
        ),
    }
    tone_instruction = tone_instructions.get(tone, tone_instructions["professional"])

    # ──────────────────────────────────────────────────────────────────────────
    # PROMPT
    # ──────────────────────────────────────────────────────────────────────────
    prompt = f"""You are a professional cover letter writer.

Write a tailored cover letter for the following applicant and job.

APPLICANT:
- Name: {full_name}
- Current/target role: {current_role}
- Most recent experience: {most_recent_exp}
- Skills: {skills_str}
- Education: {edu_str}
- Notable project: {project_str}

JOB DESCRIPTION:
{job_description}

TONE INSTRUCTION:
{tone_instruction}

RULES:
1. Do NOT use a generic opening. Reference something specific from the job description.
2. Paragraph 1: Hook — why this specific role at this specific company excites them.
3. Paragraph 2: Evidence — 2-3 specific achievements or experiences that directly match the job.
4. Paragraph 3: Skills alignment — connect 2-3 of their skills to what the job explicitly needs.
5. Paragraph 4: Closing — confident, forward-looking. Request an interview naturally.
6. Sign off with: "Yours sincerely,\\n{full_name}"
7. Do NOT include a date, address block, or "Dear Hiring Manager" header —
   just start directly with the first paragraph.
8. Do NOT use placeholder brackets like [Company Name]. If you don't know the
   company name, write "your team" or "the company" instead.
9. Plain text only. No markdown. No bullet points. No bold or italic formatting.
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert cover letter writer. "
                    "Write compelling, specific, human-sounding cover letters. "
                    "Never use generic AI filler phrases."
                )
            },
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        # Higher temperature than CV generation (0.5) because cover letters
        # benefit from more natural, varied language. CV generation needs
        # precise structured output — cover letters need persuasive prose.
        max_tokens=800,
    )

    cover_letter_text = response.choices[0].message.content.strip()

    return {"cover_letter": cover_letter_text}