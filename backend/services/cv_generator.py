# =============================================================================
# FILE: backend/services/cv_generator.py
# =============================================================================
# FIXES vs previous version:
#   ✅ minimumAverage now correctly read from profile (was looking for "gpa" — wrong key)
#   ✅ coursework items are passed through as full strings (now include descriptions)
#   ✅ Education ALWAYS sourced from saved profile — AI output for education is ignored
#   ✅ Languages ALWAYS sourced from saved profile
#   ✅ is_new flag on skills is passed to the template context (for colour styling in docx)
# =============================================================================

from docxtpl import DocxTemplate, RichText
import os


def generate_cv(profile, ai_result):

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(BASE_DIR, "templates_cv", "cv_template.docx")
    output_dir = os.path.join(BASE_DIR, "generated_files")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "generated_cv.docx")

    doc = DocxTemplate(template_path)

    # ── 1. PERSONAL INFO ──────────────────────────────────────────────────────
    personal = profile.get("personalInfo", {})

    # ── 2. SUMMARY ────────────────────────────────────────────────────────────
    summary = ai_result.get("SUMMARY", "")

    # ── 3. SKILLS ─────────────────────────────────────────────────────────────
    # The AI now returns structured skills with descriptions and is_new flags.
    # Shape: [{category, skills_list: [{skill, description, is_new}]}]
    ai_skills = ai_result.get("skills", [])

    if ai_skills and isinstance(ai_skills[0], str):
        # Fallback: flat list from old format — wrap in structure
        skills_context = [{
            "category": "Technical Skills",
            "skills_list": [
                {"skill": s, "description": "", "is_new": False}
                for s in ai_skills if isinstance(s, str)
            ]
        }]
    else:
        # New structured format — pass through, clean empty categories
        skills_context = [
            cat for cat in ai_skills
            if isinstance(cat, dict) and cat.get("skills_list")
        ]

    # ── 4. EXPERIENCE ─────────────────────────────────────────────────────────
    # Now includes city, country, startYear, endYear, location, dates, and bullets.
    ai_experience = ai_result.get("experience", [])
    experience_context = []

    for job in ai_experience:
        if not isinstance(job, dict):
            continue

        city      = job.get("city", "")
        country   = job.get("country", "")
        startYear = str(job.get("startYear", ""))
        endYear   = str(job.get("endYear", ""))

        # Use AI-formatted dates if present, otherwise build from startYear/endYear
        dates = job.get("dates", "")
        if not dates and (startYear or endYear):
            dates = f"{startYear} - {endYear}".strip(" -")

        # Build "City, Country" for the template
        location = ", ".join(filter(None, [city, country]))

        experience_context.append({
            "role":      job.get("role", job.get("title", "")),
            "company":   job.get("company", ""),
            "city":      city,
            "country":   country,
            "location":  location,
            "startYear": startYear,
            "endYear":   endYear,
            "dates":     dates,
            "bullets":   job.get("bullets", []),
        })

    # ── 5. EDUCATION ──────────────────────────────────────────────────────────
    # ALWAYS use the saved profile education — never the AI's version.
    # The AI was instructed to copy it faithfully, but we use the ground truth
    # from the profile to guarantee nothing is lost or modified.
    #
    # Profile field names  →  template variable names:
    #   degree              →  degree
    #   institution         →  institution
    #   city + country      →  location (combined)
    #   graduationYear      →  expected
    #   graduationMonth     →  graduationMonth
    #   graduationStatus    →  graduationStatus
    #   minimumAverage      →  minimumAverage  ← THIS IS THE KEY FIX (was wrongly "gpa")
    #   coursework          →  coursework (list of strings, may now include descriptions)

    # ── EDUCATION STRATEGY ───────────────────────────────────────────────────
    # There are two sources of education data:
    #
    #   profile education  → ground truth for ALL structural fields:
    #                         degree, institution, city, country,
    #                         graduationYear, graduationMonth, graduationStatus,
    #                         minimumAverage
    #                         These are ALWAYS taken from the profile — never AI.
    #
    #   ai_result education → provides ENRICHED coursework only:
    #                          The AI rewrites each plain course name into
    #                          "Course Name: Description relevant to this job."
    #                          We use this enriched version for coursework so the
    #                          download matches what the Generate CV page shows.
    #
    # We zip them together: profile fields + AI coursework.
    # If the AI returned no education (empty list), we fall back to profile coursework.

    profile_education = profile.get("education", [])
    ai_education      = ai_result.get("education", [])

    # Build a lookup of AI coursework by degree name so we can match by position
    # (AI should return education in the same order as profile)
    education_context = []

    for i, edu in enumerate(profile_education):
        city    = edu.get("city", "")
        country = edu.get("country", "")
        location = f"{city}, {country}".strip(", ") if (city or country) else ""

        # Try to get AI-enriched coursework for this education entry.
        # AI coursework items look like: "Course Name: Description of relevance."
        # Profile coursework items look like: "Course Name" (plain, no description).
        # We prefer AI coursework because it has descriptions — this makes
        # the downloaded CV match what the Generate CV page shows.
        ai_edu_entry  = ai_education[i] if i < len(ai_education) else {}
        ai_coursework = ai_edu_entry.get("coursework", [])

        # Use AI coursework if it returned items; otherwise fall back to profile
        if ai_coursework:
            coursework = [c for c in ai_coursework if isinstance(c, str) and c.strip()]
        else:
            coursework = [c for c in edu.get("coursework", []) if isinstance(c, str) and c.strip()]

        # minimumAverage: always from profile — the AI might omit or alter it
        minimum_average = edu.get("minimumAverage", "")

        # Build graduation date string
        grad_month  = edu.get("graduationMonth", "")
        grad_year   = str(edu.get("graduationYear", ""))
        grad_status = edu.get("graduationStatus", "graduated")

        education_context.append({
            "degree":           edu.get("degree", ""),
            "institution":      edu.get("institution", ""),
            "city":             city,
            "country":          country,
            "location":         location,
            "expected":         grad_year,
            "graduationMonth":  grad_month,
            "graduationStatus": grad_status,
            "minimumAverage":   minimum_average,
            "coursework":       coursework,
        })

    # ── 6. PROJECT EXPERIENCE ─────────────────────────────────────────────────
    # ── PROJECT EXPERIENCE STRATEGY ──────────────────────────────────────────
    # Same merge approach as education:
    #   - title and tech_stack: always from profile (ground truth)
    #   - bullets: AI-enhanced version preferred (has original + new job-aligned bullets)
    #     but we guarantee original profile bullets are included if AI dropped any.
    #
    # How we guarantee no bullets are lost:
    #   1. Collect the original profile bullet texts (lowercased for comparison)
    #   2. Take all AI bullets
    #   3. Check if each profile bullet appears (roughly) in the AI bullets
    #   4. If any profile bullet was dropped, prepend it back
    #   This ensures the final list = all originals + AI additions

    ai_projects     = ai_result.get("project_experience") or ai_result.get("projects") or []
    profile_projects = profile.get("projects", [])

    # Build a lookup of profile projects by index for merging
    projects_context = []

    for i, prof_proj in enumerate(profile_projects):
        if not isinstance(prof_proj, dict):
            continue

        # Only include projects the user marked as "include in CV"
        if prof_proj.get("includeInCV") is False:
            continue

        title      = prof_proj.get("name", prof_proj.get("title", ""))
        tech_stack = prof_proj.get("technologies", prof_proj.get("tech_stack", ""))
        url        = prof_proj.get("url", "")

        # Get profile's original bullets (non-empty only)
        profile_bullets = [b for b in prof_proj.get("bullets", []) if isinstance(b, str) and b.strip()]

        # Get AI bullets for this project (matched by index)
        ai_bullets = []
        if i < len(ai_projects) and isinstance(ai_projects[i], dict):
            ai_bullets = [b for b in ai_projects[i].get("bullets", []) if isinstance(b, str) and b.strip()]

        # Guarantee every original profile bullet is present
        # Check each profile bullet against the AI bullets (case-insensitive partial match)
        final_bullets = list(ai_bullets)  # start with AI bullets (enhanced + new)

        for orig in profile_bullets:
            orig_lower = orig.lower().strip()
            # Check if this original bullet (or a sufficiently similar version) is in the AI list
            already_present = any(
                orig_lower[:40] in ai_b.lower() or ai_b.lower()[:40] in orig_lower
                for ai_b in final_bullets
            )
            if not already_present:
                # AI dropped this bullet — prepend it back
                final_bullets.insert(0, orig)

        # If AI returned nothing at all, use profile bullets only
        if not final_bullets:
            final_bullets = profile_bullets

        projects_context.append({
            "title":      title,
            "tech_stack": tech_stack,
            "url":        url,
            "bullets":    final_bullets,
        })

    # If profile has no projects but AI returned some, use AI output directly
    if not profile_projects and ai_projects:
        projects_context = [
            {
                "title":      proj.get("title", ""),
                "tech_stack": proj.get("tech_stack", ""),
                "url":        proj.get("url", ""),
                "bullets":    [b for b in proj.get("bullets", []) if b.strip()],
            }
            for proj in ai_projects
            if isinstance(proj, dict)
        ]

    # ── 7. LANGUAGES ──────────────────────────────────────────────────────────
    # ALWAYS use profile languages — never AI version.
    CEFR_LABELS = {1: "A1", 2: "A2", 3: "B1", 4: "B2", 5: "C1", 6: "C2"}
    CEFR_FULL = {
        1: "Beginner",
        2: "Elementary",
        3: "Intermediate",
        4: "Upper-Intermediate",
        5: "Advanced",
        6: "Bilingual or Proficient",
    }

    # Colours for filled vs empty bar blocks (hex WITHOUT #)
    BAR_FILLED = "1F3040"   # dark navy  — filled blocks
    BAR_EMPTY  = "D0D8E0"   # light grey — empty blocks
    BAR_SIZE   = 26         # font size in half-points for the block characters

    profile_languages = profile.get("languages", [])
    languages_context = []

    for lang in profile_languages:
        if not lang.get("name", "").strip():
            continue
        level_num = int(lang.get("level", 3))

        # Build the visual bar using Unicode Full Block characters (█)
        # RichText lets docxtpl colour individual characters in the .docx file.
        # Each of the 6 blocks is either dark (filled) or light grey (empty).
        # Use {{r lang.bar }} in the template — the 'r' prefix means RichText.
        bar = RichText()
        for i in range(6):
            if i > 0:
                bar.add("  ")   # small gap between blocks
            if i < level_num:
                bar.add("██", color=BAR_FILLED, size=BAR_SIZE)
            else:
                bar.add("██", color=BAR_EMPTY, size=BAR_SIZE)

        languages_context.append({
            "name":       lang.get("name", ""),
            "level":      level_num,
            "level_code": CEFR_LABELS.get(level_num, "B1"),
            "level_full": CEFR_FULL.get(level_num, "Intermediate"),
            "bar":        bar,
            # TEMPLATE USAGE:
            #   {{ lang.name }}          → language name
            #   {{ lang.level_code }}    → e.g. "C2"
            #   {{r lang.bar }}          → coloured block bar (MUST use {{r }} not {{ }})
            #   {{ lang.level_full }}    → e.g. "Bilingual or Proficient"
        })

    # ── 8. ASSEMBLE CONTEXT ───────────────────────────────────────────────────
    context = {
        "NAME":       personal.get("firstName", ""),
        "SURNAME":    personal.get("lastName", ""),
        "JOB_TITLE":  personal.get("jobTitle", ""),
        "CITY":       personal.get("city", ""),
        "PHONE":      personal.get("phone", ""),
        "EMAIL":      personal.get("email", ""),
        "GITHUB_URL": personal.get("github", ""),

        "SUMMARY":            summary,
        "skills":             skills_context,
        "experience":         experience_context,
        "education":          education_context,
        "project_experience": projects_context,
        "languages":          languages_context,
        "REFERENCE":          profile.get("references", "Available upon Request"),
    }

    doc.render(context)
    doc.save(output_path)

    return output_path