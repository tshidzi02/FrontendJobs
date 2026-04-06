"""
Debug script — run from the backend/services/ directory:
    python debug_generate.py

Or from the backend/ directory:
    python services/debug_generate.py
"""

import sys
import os
import json

# ── Make sure Python can find ai_engine.py regardless of where you run from ──
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)                        # adds services/
sys.path.insert(0, os.path.dirname(THIS_DIR))       # adds backend/

from ai_engine import generate_cv_content

# =============================================================================
# TEST DATA — edit these to match a real user's profile
# =============================================================================

JOB_DESCRIPTION = """
We are looking for a Frontend Developer with experience in React, TypeScript,
and REST APIs. You will build scalable UI components, collaborate with designers,
and integrate backend services. Experience with testing frameworks and CI/CD is a plus.
"""

BASE_SKILLS = [
    "React", "JavaScript", "TypeScript", "HTML", "CSS",
    "Git", "REST APIs", "Node.js"
]

BASE_EXPERIENCE = [
    {
        "role": "Junior Frontend Developer",
        "company": "Tech Startup",
        "city": "Cape Town",
        "country": "South Africa",
        "startYear": "2023",
        "endYear": "Present",
        "bullets": [
            "Built reusable React components for the dashboard",
            "Integrated REST APIs to fetch and display live data",
            "Improved page load speed by 30% through code splitting"
        ]
    }
]

PROJECT_EXPERIENCE = [
    {
        "name": "Portfolio Website",
        "title": "Portfolio Website",
        "tech_stack": "React, CSS, Netlify",
        "url": "https://example.com",
        "includeInCV": True,
        "bullets": [
            "Designed and deployed a personal portfolio site",
            "Implemented dark mode and responsive layout"
        ]
    }
]

EDUCATION = [
    {
        "degree": "BSc Applied Mathematics and Computer Science",
        "institution": "University of Cape Town",
        "city": "Cape Town",
        "country": "South Africa",
        "graduationStatus": "Expected",
        "graduationMonth": "December",
        "graduationYear": "2025",
        "minimumAverage": "65%",
        "coursework": [
            "Data Structures", "Algorithms", "Web Development",
            "Machine Learning", "Database Systems"
        ]
    }
]

LANGUAGES = [
    {"name": "English", "level": 5},
    {"name": "Tshivenda", "level": 5}
]

REFERENCES = "Available upon Request"

# =============================================================================
# RUN
# =============================================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  CALLING generate_cv_content ...")
    print("="*60 + "\n")

    result = generate_cv_content(
        job_description=JOB_DESCRIPTION,
        base_skills=BASE_SKILLS,
        base_experience=BASE_EXPERIENCE,
        project_experience=PROJECT_EXPERIENCE,
        education=EDUCATION,
        languages=LANGUAGES,
        references=REFERENCES,
    )

    print("\n" + "="*60)
    print("  FULL RESULT:")
    print("="*60)
    print(json.dumps(result, indent=2))

    # ── Per-section breakdown ──────────────────────────────────────────────
    print("\n" + "="*60)
    print("  SUMMARY:")
    print("="*60)
    print(result.get("SUMMARY", "NOT FOUND"))

    print("\n" + "="*60)
    print("  SKILLS:")
    print("="*60)
    for cat in result.get("skills", []):
        print(f"\n  [{cat.get('category')}]")
        for s in cat.get("skills_list", []):
            desc = s.get("description", "")
            missing = " ⚠️  NO DESCRIPTION" if not desc or desc == "A skill I have that is relevant to this job." else ""
            print(f"    • {s.get('skill')}: {desc[:80]}{missing}")

    print("\n" + "="*60)
    print("  EXPERIENCE:")
    print("="*60)
    for exp in result.get("experience", []):
        print(f"\n  {exp.get('role')} @ {exp.get('company')}")
        for b in exp.get("bullets", []):
            print(f"    - {b}")

    print("\n" + "="*60)
    print("  PROJECTS:")
    print("="*60)
    for proj in result.get("project_experience", []):
        print(f"\n  {proj.get('title')} [{proj.get('tech_stack')}]")
        for b in proj.get("bullets", []):
            print(f"    - {b}")

    print("\n" + "="*60)
    print("  Done.")
    print("="*60 + "\n")
    