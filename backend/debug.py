from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity
)
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
import re
import os
import json
import traceback
import json as _json
import io     
from openai import OpenAI

from config import Config

from app import app, db, Profile
from services.ai_engine import generate_cv_content, semantic_match_score, analyze_ats

JOB_DESCRIPTION = """💼 Full Stack Developer & IT Operations Specialist

Responsible for designing, developing, and maintaining scalable full-stack applications while 
supporting IT operations and business processes. Builds high-performance systems using Python,
 JavaScript, React, HTML, CSS, and SQL, ensuring reliability, scalability, and user-focused 
 design.

Develops and integrates RESTful APIs, automates workflows, and optimizes data pipelines to improve
 efficiency and reduce manual processes. Designs and manages databases, applying algorithms, 
 data structures, and object-oriented programming to deliver maintainable and efficient 
 solutions.

Implements test automation and QA practices, troubleshoots and resolves technical issues, and 
enhances system performance and reliability. Provides IT and application support, ensuring 
system uptime through monitoring, maintenance, and optimization.

Collaborates with cross-functional teams using Git-based version control to deliver and 
maintain systems. Develops automation scripts using Google Apps Script and command-line 
tools to streamline operations.

Supports project coordination, including planning, scheduling, reporting, and performance 
tracking. Contributes to administrative operations, documentation, and workflow management.

Handles customer queries, supports client relationships, and contributes to sales operations 
through technical support and product demonstrations. Delivers training, creates technical 
documentation, and supports knowledge transfer across teams.

Applies analytical thinking, problem-solving, and mathematical modelling to improve systems 
and support data-driven decision-making.

🧠 Key Skills & Competencies

Python, Java, JavaScript, React, HTML, CSS, SQL, RESTful APIs, API Integration, Full Stack 
Development, Software Development, Web Development, Database Management, Data Analysis, 
Mathematical Modelling, Algorithms and Data Structures, Object-Oriented Programming, 
Automation, Workflow Optimization, Scripting, Debugging, Test Automation, QA Testing, Git, 
GitHub, GitLab, Google Apps Script, Command Line Tools, Technical Documentation, IT Support, 
Help Desk Support, Application Support, Systems Support, Project Management, Operations 
Management, Administrative Coordination, Customer Service, Account Management, Technical Sales 
Support, Training and Development, Problem Solving, Analytical Thinking, Communication, 
Collaboration, Time Management, Adaptability"""
  

# ── GENERATE CV ───────────────────────────────────────────────────────────────
def generate():
    with app.app_context():
        data = Profile.query.first()
        data = json.loads(data.data)
        print("=" * 60)
        print("RAW PROFILE DATA:")
        print("=" * 60)
        #print(json.dumps(data, indent=2))
        #print(f"Job Description: {JOB_DESCRIPTION}")

        job_description   = JOB_DESCRIPTION
        base_skills       = data.get("skills", [])
        base_experience   = data.get("Experience", [])
        project_experience = data.get("projectExperience", [])
        personal_info      = data.get("personalInfo", {})
        education          = data.get("education", [])
        languages          = data.get("languages", [])
        references         = data.get("references", "Available upon Request")

        
        ai_content = generate_cv_content(
            job_description, base_skills, base_experience, project_experience,
            education=education, languages=languages, references=references
        )

        print("=== AI RESPONSE ===")
        print(json.dumps(ai_content, indent=2))

    # summary    = ai_content.get("SUMMARY", "")
    # skills     = ai_content.get("skills", [])
    # experience = ai_content.get("experience", [])

    # ai_projects_raw      = ai_content.get("project_experience") or ai_content.get("projects") or []
    # profile_projects_raw = data.get("projectExperience", [])
    # project_experience_out = []

    # for i, prof_proj in enumerate(profile_projects_raw):
    #     if not isinstance(prof_proj, dict): continue
    #     if prof_proj.get("includeInCV") is False: continue
    #     title      = prof_proj.get("name", prof_proj.get("title", ""))
    #     tech_stack = prof_proj.get("technologies", prof_proj.get("tech_stack", ""))
    #     profile_bullets = [b for b in prof_proj.get("bullets", []) if isinstance(b, str) and b.strip()]
    #     ai_bullets = []
    #     if i < len(ai_projects_raw) and isinstance(ai_projects_raw[i], dict):
    #         ai_bullets = [b for b in ai_projects_raw[i].get("bullets", []) if isinstance(b, str) and b.strip()]
    #     final_bullets = list(ai_bullets)
    #     for orig in profile_bullets:
    #         orig_lower = orig.lower().strip()
    #         already_present = any(
    #             orig_lower[:40] in ai_b.lower() or ai_b.lower()[:40] in orig_lower
    #             for ai_b in final_bullets
    #         )
    #         if not already_present:
    #             final_bullets.insert(0, orig)
    #     if not final_bullets:
    #         final_bullets = profile_bullets
    #     project_experience_out.append({"title": title, "tech_stack": tech_stack, "bullets": final_bullets})

    # if not profile_projects_raw and ai_projects_raw:
    #     project_experience_out = ai_projects_raw

    # ai_education  = ai_content.get("education", [])
    # education_out = []
    # for i, prof_edu in enumerate(education):
    #     merged = dict(prof_edu)
    #     if i < len(ai_education):
    #         ai_coursework = ai_education[i].get("coursework", [])
    #         if ai_coursework:
    #             merged["coursework"] = [c for c in ai_coursework if isinstance(c, str) and c.strip()]
    #     merged["minimumAverage"]   = prof_edu.get("minimumAverage", "")
    #     merged["degree"]           = prof_edu.get("degree", "")
    #     merged["institution"]      = prof_edu.get("institution", "")
    #     merged["city"]             = prof_edu.get("city", "")
    #     merged["country"]          = prof_edu.get("country", "")
    #     merged["graduationYear"]   = prof_edu.get("graduationYear", "")
    #     merged["graduationMonth"]  = prof_edu.get("graduationMonth", "")
    #     merged["graduationStatus"] = prof_edu.get("graduationStatus", "graduated")
    #     education_out.append(merged)

    # languages_out  = languages
    # references_out = ai_content.get("REFERENCE") or references

    # skills_text = " ".join(
    #     skill_obj.get("skill", "")
    #     for cat in skills if isinstance(cat, dict)
    #     for skill_obj in cat.get("skills_list", [])
    #     if isinstance(skill_obj, dict)
    # )
    # experience_text = " ".join(
    #     bullet
    #     for exp in experience if isinstance(exp, dict)
    #     for bullet in exp.get("bullets", [])
    # )
    # combined_cv_text = f"{summary} {skills_text} {experience_text}".strip()
    # semantic_score   = semantic_match_score(job_description, combined_cv_text)
    # ats_results      = analyze_ats({"skills": skills, "experience": experience}, job_description, semantic_score)

    # return jsonify({
    #     "SUMMARY": summary, "skills": skills, "experience": experience,
    #     "project_experience": project_experience_out, "education": education_out,
    #     "languages": languages_out, "references": references_out,
    #     "personalInfo": personal_info, "ats": ats_results
    # })

    generate();
