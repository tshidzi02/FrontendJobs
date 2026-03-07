# =============================================================================
# FILE: backend/app.py  (UPDATED — Lesson 4.1: Cover Letter Generator)
# =============================================================================
# WHAT'S NEW vs Lesson 3.4:
#   ✅ POST /api/cover-letter  — generates a tailored cover letter via GPT-4o
#   ✅ POST /api/cover-letter/save — saves cover letter to SavedCoverLetter table
#   ✅ GET  /api/cover-letter       — returns all saved cover letters, newest first
#   ✅ DELETE /api/cover-letter/<id> — deletes one saved cover letter
#   ✅ New DB model: SavedCoverLetter
# =============================================================================

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

from config import Config
from services.ai_engine import generate_cv_content
from services.ats_analyzer import analyze_ats
from services.semantic_matcher import semantic_match_score
from services.cv_generator import generate_cv
from services.cover_letter_generator import generate_cover_letter
from services.cover_letter_docx import generate_cover_letter_docx
from services.job_search import search_jobs
from services.tools_ai import (
    generate_interview_prep,
    optimise_linkedin_bio,
    estimate_salary,
    generate_skills_gap,
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests


# =============================================================================
# APP SETUP
# =============================================================================

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"])

bcrypt = Bcrypt(app)
jwt = JWTManager(app)
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# =============================================================================
# DATABASE MODELS
# =============================================================================

class User(db.Model):
    id       = db.Column(db.Integer, primary_key=True)
    email    = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)


class Profile(db.Model):
    id      = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
    data    = db.Column(db.Text, nullable=False, default="{}")


class SavedCV(db.Model):
    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    job_title        = db.Column(db.String(200), nullable=False, default="Untitled CV")
    ats_score        = db.Column(db.Float, nullable=False, default=0.0)
    ai_result        = db.Column(db.Text, nullable=False, default="{}")
    profile_snapshot = db.Column(db.Text, nullable=False, default="{}")
    created_at       = db.Column(db.DateTime, default=db.func.now())


class SavedCoverLetter(db.Model):
    # ──────────────────────────────────────────────────────────────────────────
    # Stores one saved cover letter per row.
    #
    # Fields:
    #   id            → auto-incremented primary key
    #   user_id       → foreign key to User — who owns this cover letter
    #   job_title     → label extracted from the job description (first line)
    #                   shown on the cover letter card so user knows what role
    #   tone          → "professional" | "enthusiastic" | "concise"
    #                   stored so the user can see what tone was used
    #   cover_letter  → the full plain text of the generated cover letter
    #   created_at    → UTC timestamp
    # ──────────────────────────────────────────────────────────────────────────
    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    job_title    = db.Column(db.String(200), nullable=False, default="Untitled Role")
    tone         = db.Column(db.String(50), nullable=False, default="professional")
    cover_letter = db.Column(db.Text, nullable=False, default="")
    created_at   = db.Column(db.DateTime, default=db.func.now())


class JobApplication(db.Model):
    # ──────────────────────────────────────────────────────────────────────────
    # Stores one job application per row.
    #
    # status: one of "Wishlist" | "Applied" | "Interview" | "Offer" | "Rejected"
    # The frontend Kanban board reads status to place cards in the right column.
    # Dragging a card to a new column sends PATCH /api/tracker/<id> with new status.
    # ──────────────────────────────────────────────────────────────────────────
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    company    = db.Column(db.String(200), nullable=False, default="")
    role       = db.Column(db.String(200), nullable=False, default="")
    status     = db.Column(db.String(50),  nullable=False, default="Wishlist")
    salary     = db.Column(db.String(100), nullable=False, default="")
    notes      = db.Column(db.Text,        nullable=False, default="")
    url        = db.Column(db.String(500), nullable=False, default="")
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())



with app.app_context():
    db.create_all()
    # db.create_all() creates SavedCoverLetter automatically on first run.
    # Existing tables (User, Profile, SavedCV) are left untouched.


# =============================================================================
# HELPERS
# =============================================================================

def valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

def valid_password(password):
    return len(password) >= 6


# =============================================================================
# ROUTES
# =============================================================================

@app.route("/api/health")
def health():
    return jsonify({"status": "API running", "version": "4.1"})


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"message": "All fields required"}), 400
    if not valid_email(email):
        return jsonify({"message": "Invalid email format"}), 400
    if not valid_password(password):
        return jsonify({"message": "Password must be 6+ characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 400
    hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")
    db.session.add(User(email=email, password=hashed_pw))
    db.session.commit()
    return jsonify({"message": "User registered successfully"})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User does not exist"}), 401
    if not bcrypt.check_password_hash(user.password, password):
        return jsonify({"message": "Incorrect password"}), 401
    return jsonify({"token": create_access_token(identity=email)})


@app.route("/api/auth/google", methods=["POST"])
def google_login():
    data = request.get_json()
    token = data.get("token")
    try:
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), Config.GOOGLE_CLIENT_ID
        )
        email = idinfo["email"]
        if not User.query.filter_by(email=email).first():
            hashed_pw = bcrypt.generate_password_hash(os.urandom(32).hex()).decode("utf-8")
            db.session.add(User(email=email, password=hashed_pw))
            db.session.commit()
        return jsonify({"token": create_access_token(identity=email)})
    except ValueError:
        return jsonify({"message": "Invalid Google token"}), 401


# ── DASHBOARD ─────────────────────────────────────────────────────────────────
@app.route("/api/dashboard")
@jwt_required()
def dashboard():
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    # ── CV stats ──────────────────────────────────────────────────────────────
    cv_count = db.session.query(
        func.count(SavedCV.id)
    ).filter(SavedCV.user_id == user.id).scalar() or 0

    best_score = db.session.query(
        func.max(SavedCV.ats_score)
    ).filter(SavedCV.user_id == user.id).scalar()

    avg_score = db.session.query(
        func.avg(SavedCV.ats_score)
    ).filter(SavedCV.user_id == user.id).scalar()

    latest_cv = (
        SavedCV.query
        .filter_by(user_id=user.id)
        .order_by(SavedCV.created_at.desc())
        .first()
    )

    cl_count = db.session.query(
        func.count(SavedCoverLetter.id)
    ).filter(SavedCoverLetter.user_id == user.id).scalar() or 0

    # ── Tracker stats ─────────────────────────────────────────────────────────
    tracker_total = db.session.query(
        func.count(JobApplication.id)
    ).filter(JobApplication.user_id == user.id).scalar() or 0

    tracker_applied = db.session.query(
        func.count(JobApplication.id)
    ).filter(
        JobApplication.user_id == user.id,
        JobApplication.status == "Applied"
    ).scalar() or 0

    tracker_interviews = db.session.query(
        func.count(JobApplication.id)
    ).filter(
        JobApplication.user_id == user.id,
        JobApplication.status == "Interview"
    ).scalar() or 0

    tracker_offers = db.session.query(
        func.count(JobApplication.id)
    ).filter(
        JobApplication.user_id == user.id,
        JobApplication.status == "Offer"
    ).scalar() or 0

    # Response rate = (interviews + offers) / applied * 100
    # Only count "Applied" as the denominator — Wishlist doesn't count as sent
    tracker_response_rate = None
    if tracker_applied > 0:
        tracker_response_rate = round(
            ((tracker_interviews + tracker_offers) / tracker_applied) * 100, 1
        )

    return jsonify({
        "email":                 email,
        "cv_count":              cv_count,
        "best_score":            round(best_score, 1) if best_score is not None else None,
        "average_score":         round(float(avg_score), 1) if avg_score is not None else None,
        "last_job_title":        latest_cv.job_title if latest_cv else None,
        "last_saved_at":         latest_cv.created_at.isoformat() if latest_cv and latest_cv.created_at else None,
        "cover_letter_count":    cl_count,
        "tracker_total":         tracker_total,
        "tracker_applied":       tracker_applied,
        "tracker_interviews":    tracker_interviews,
        "tracker_offers":        tracker_offers,
        "tracker_response_rate": tracker_response_rate,
    })





# ── PROFILE ───────────────────────────────────────────────────────────────────
@app.route("/api/profile", methods=["GET"])
@jwt_required()
def get_profile():
    email = get_jwt_identity()
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    profile = Profile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({})
    return jsonify(json.loads(profile.data))


@app.route("/api/profile", methods=["POST"])
@jwt_required()
def save_profile():
    email = get_jwt_identity()
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    profile_data = request.get_json()
    if not profile_data:
        return jsonify({"message": "No data provided"}), 400
    profile = Profile.query.filter_by(user_id=user.id).first()
    if profile:
        profile.data = json.dumps(profile_data)
    else:
        db.session.add(Profile(user_id=user.id, data=json.dumps(profile_data)))
    db.session.commit()
    return jsonify({"message": "Profile saved successfully"})


# ── GENERATE CV ───────────────────────────────────────────────────────────────
@app.route("/api/generate", methods=["POST"])
@jwt_required()
def generate():
    data = request.get_json()
    job_description    = data.get("jobDescription", "")
    base_skills        = data.get("baseSkills", [])
    base_experience    = data.get("baseExperience", [])
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

    summary    = ai_content.get("SUMMARY", "")
    skills     = ai_content.get("skills", [])
    experience = ai_content.get("experience", [])

    ai_projects_raw      = ai_content.get("project_experience") or ai_content.get("projects") or []
    profile_projects_raw = data.get("projectExperience", [])
    project_experience_out = []

    for i, prof_proj in enumerate(profile_projects_raw):
        if not isinstance(prof_proj, dict): continue
        if prof_proj.get("includeInCV") is False: continue
        title      = prof_proj.get("name", prof_proj.get("title", ""))
        tech_stack = prof_proj.get("technologies", prof_proj.get("tech_stack", ""))
        profile_bullets = [b for b in prof_proj.get("bullets", []) if isinstance(b, str) and b.strip()]
        ai_bullets = []
        if i < len(ai_projects_raw) and isinstance(ai_projects_raw[i], dict):
            ai_bullets = [b for b in ai_projects_raw[i].get("bullets", []) if isinstance(b, str) and b.strip()]
        final_bullets = list(ai_bullets)
        for orig in profile_bullets:
            orig_lower = orig.lower().strip()
            already_present = any(
                orig_lower[:40] in ai_b.lower() or ai_b.lower()[:40] in orig_lower
                for ai_b in final_bullets
            )
            if not already_present:
                final_bullets.insert(0, orig)
        if not final_bullets:
            final_bullets = profile_bullets
        project_experience_out.append({"title": title, "tech_stack": tech_stack, "bullets": final_bullets})

    if not profile_projects_raw and ai_projects_raw:
        project_experience_out = ai_projects_raw

    ai_education  = ai_content.get("education", [])
    education_out = []
    for i, prof_edu in enumerate(education):
        merged = dict(prof_edu)
        if i < len(ai_education):
            ai_coursework = ai_education[i].get("coursework", [])
            if ai_coursework:
                merged["coursework"] = [c for c in ai_coursework if isinstance(c, str) and c.strip()]
        merged["minimumAverage"]   = prof_edu.get("minimumAverage", "")
        merged["degree"]           = prof_edu.get("degree", "")
        merged["institution"]      = prof_edu.get("institution", "")
        merged["city"]             = prof_edu.get("city", "")
        merged["country"]          = prof_edu.get("country", "")
        merged["graduationYear"]   = prof_edu.get("graduationYear", "")
        merged["graduationMonth"]  = prof_edu.get("graduationMonth", "")
        merged["graduationStatus"] = prof_edu.get("graduationStatus", "graduated")
        education_out.append(merged)

    languages_out  = languages
    references_out = ai_content.get("REFERENCE") or references

    skills_text = " ".join(
        skill_obj.get("skill", "")
        for cat in skills if isinstance(cat, dict)
        for skill_obj in cat.get("skills_list", [])
        if isinstance(skill_obj, dict)
    )
    experience_text = " ".join(
        bullet
        for exp in experience if isinstance(exp, dict)
        for bullet in exp.get("bullets", [])
    )
    combined_cv_text = f"{summary} {skills_text} {experience_text}".strip()
    semantic_score   = semantic_match_score(job_description, combined_cv_text)
    ats_results      = analyze_ats({"skills": skills, "experience": experience}, job_description, semantic_score)

    return jsonify({
        "SUMMARY": summary, "skills": skills, "experience": experience,
        "project_experience": project_experience_out, "education": education_out,
        "languages": languages_out, "references": references_out,
        "personalInfo": personal_info, "ats": ats_results
    })


# ── DOWNLOAD CV ───────────────────────────────────────────────────────────────
@app.route("/api/download-cv", methods=["POST"])
@jwt_required()
def download_cv():
    data      = request.get_json()
    ai_result = data.get("ai_result", {})
    profile   = data.get("profile", {})
    if not ai_result:
        return jsonify({"message": "No AI result provided"}), 400
    try:
        output_path = generate_cv(profile, ai_result)
        return send_file(
            output_path, as_attachment=True, download_name="CV.docx",
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        return jsonify({"message": f"CV generation failed: {str(e)}"}), 500


# =============================================================================
# CABINET ROUTES
# =============================================================================

@app.route("/api/cabinet", methods=["POST"])
@jwt_required()
def save_to_cabinet():
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user: return jsonify({"message": "User not found"}), 404
    data = request.get_json()
    if not data: return jsonify({"message": "No data provided"}), 400
    ai_result        = data.get("ai_result", {})
    profile_snapshot = data.get("profile_snapshot", {})
    job_title        = data.get("job_title", "Untitled CV")[:200]
    ats_score        = ai_result.get("ats", {}).get("final_score", 0.0)
    new_cv = SavedCV(
        user_id=user.id, job_title=job_title, ats_score=ats_score,
        ai_result=json.dumps(ai_result), profile_snapshot=json.dumps(profile_snapshot),
    )
    db.session.add(new_cv)
    db.session.commit()
    return jsonify({"message": "CV saved to cabinet", "id": new_cv.id})


@app.route("/api/cabinet", methods=["GET"])
@jwt_required()
def get_cabinet():
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user: return jsonify({"message": "User not found"}), 404
    saved_cvs = SavedCV.query.filter_by(user_id=user.id).order_by(SavedCV.created_at.desc()).all()
    return jsonify([{
        "id": cv.id, "job_title": cv.job_title, "ats_score": cv.ats_score,
        "created_at": cv.created_at.isoformat() if cv.created_at else "",
        "ai_result": json.loads(cv.ai_result),
        "profile_snapshot": json.loads(cv.profile_snapshot),
    } for cv in saved_cvs])


@app.route("/api/cabinet/<int:cv_id>", methods=["DELETE"])
@jwt_required()
def delete_cabinet_cv(cv_id):
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user: return jsonify({"message": "User not found"}), 404
    cv = SavedCV.query.filter_by(id=cv_id, user_id=user.id).first()
    if not cv: return jsonify({"message": "CV not found or not yours"}), 404
    db.session.delete(cv)
    db.session.commit()
    return jsonify({"message": "CV deleted"})


# =============================================================================
# COVER LETTER ROUTES  (NEW — Lesson 4.1)
# =============================================================================

# ── GENERATE COVER LETTER ─────────────────────────────────────────────────────
@app.route("/api/cover-letter", methods=["POST"])
@jwt_required()
def generate_cover_letter_route():
    # ──────────────────────────────────────────────────────────────────────────
    # Generates a tailored cover letter using GPT-4o.
    #
    # Request body:
    #   {
    #     "jobDescription": "Full job posting text...",
    #     "tone":           "professional" | "enthusiastic" | "concise"
    #   }
    #
    # The profile is loaded from the database — not sent by the frontend.
    # WHY: The profile can be large (many bullets, projects, coursework).
    #   Sending it from the frontend on every request duplicates data the
    #   server already has. Loading from DB is more efficient and ensures
    #   we always use the user's latest saved profile.
    # ──────────────────────────────────────────────────────────────────────────
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    data            = request.get_json()
    job_description = data.get("jobDescription", "").strip()
    tone            = data.get("tone", "professional")

    if not job_description:
        return jsonify({"message": "Job description is required"}), 400

    # Validate tone — only accept known values
    valid_tones = {"professional", "enthusiastic", "concise"}
    if tone not in valid_tones:
        tone = "professional"

    # Load user's profile from DB
    profile_row = Profile.query.filter_by(user_id=user.id).first()
    profile     = json.loads(profile_row.data) if profile_row else {}

    try:
        result = generate_cover_letter(job_description, profile, tone)
        return jsonify(result)
        # result = { "cover_letter": "Dear..." }

    except Exception as e:
        return jsonify({"message": f"Cover letter generation failed: {str(e)}"}), 500


# ── SAVE COVER LETTER ─────────────────────────────────────────────────────────
@app.route("/api/cover-letter/save", methods=["POST"])
@jwt_required()
def save_cover_letter():
    # ──────────────────────────────────────────────────────────────────────────
    # Saves a generated cover letter to the SavedCoverLetter table.
    # Called by the frontend "Save" button after generation.
    #
    # Request body:
    #   {
    #     "cover_letter":  "Full plain text of the cover letter",
    #     "job_title":     "Senior Software Engineer",
    #     "tone":          "professional"
    #   }
    # ──────────────────────────────────────────────────────────────────────────
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    data         = request.get_json()
    cover_letter = data.get("cover_letter", "").strip()
    job_title    = data.get("job_title", "Untitled Role")[:200]
    tone         = data.get("tone", "professional")

    if not cover_letter:
        return jsonify({"message": "No cover letter text provided"}), 400

    new_cl = SavedCoverLetter(
        user_id      = user.id,
        job_title    = job_title,
        tone         = tone,
        cover_letter = cover_letter,
    )
    db.session.add(new_cl)
    db.session.commit()

    return jsonify({"message": "Cover letter saved", "id": new_cl.id})


# ── GET ALL SAVED COVER LETTERS ───────────────────────────────────────────────
@app.route("/api/cover-letter/saved", methods=["GET"])
@jwt_required()
def get_saved_cover_letters():
    # Returns all saved cover letters for the logged-in user, newest first.
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    letters = (
        SavedCoverLetter.query
        .filter_by(user_id=user.id)
        .order_by(SavedCoverLetter.created_at.desc())
        .all()
    )

    return jsonify([{
        "id":           cl.id,
        "job_title":    cl.job_title,
        "tone":         cl.tone,
        "cover_letter": cl.cover_letter,
        "created_at":   cl.created_at.isoformat() if cl.created_at else "",
        "preview":      cl.cover_letter[:200],
        # Preview = first 200 chars — shown on the card without loading full text
    } for cl in letters])


# ── DELETE A SAVED COVER LETTER ───────────────────────────────────────────────
@app.route("/api/cover-letter/<int:cl_id>", methods=["DELETE"])
@jwt_required()
def delete_cover_letter(cl_id):
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    cl = SavedCoverLetter.query.filter_by(id=cl_id, user_id=user.id).first()
    if not cl:
        return jsonify({"message": "Cover letter not found or not yours"}), 404

    db.session.delete(cl)
    db.session.commit()
    return jsonify({"message": "Cover letter deleted"})



# ── DOWNLOAD COVER LETTER ─────────────────────────────────────────────────────
@app.route("/api/download-cover-letter", methods=["POST"])
@jwt_required()
def download_cover_letter_docx_route():
    # ──────────────────────────────────────────────────────────────────────────
    # Renders the cover letter Word template and returns it as a file download.
    #
    # Request body:
    #   {
    #     "cover_letter": "Full plain text of the generated cover letter",
    #     "job_title":    "Senior Software Engineer"  ← used in Subject line
    #   }
    #
    # The profile is loaded from DB (same reason as /api/cover-letter —
    # it's already on the server, no need to re-send it from the frontend).
    # ──────────────────────────────────────────────────────────────────────────
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    data         = request.get_json()
    cover_letter = data.get("cover_letter", "").strip()
    job_title    = data.get("job_title", "Application")

    if not cover_letter:
        return jsonify({"message": "No cover letter text provided"}), 400

    # Load profile from DB
    profile_row = Profile.query.filter_by(user_id=user.id).first()
    profile     = json.loads(profile_row.data) if profile_row else {}

    try:
        output_path = generate_cover_letter_docx(profile, cover_letter, job_title)
        return send_file(
            output_path,
            as_attachment=True,
            download_name="Cover_Letter.docx",
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        traceback.print_exc()   # prints full Python traceback to Flask terminal
        return jsonify({"message": f"Cover letter download failed: {str(e)}"}), 500

# =============================================================================
# JOBS SEARCH
# =============================================================================

@app.route("/api/jobs/search", methods=["GET"])
@jwt_required()
def jobs_search():
    """
    Search jobs across all configured sources (JSearch, Adzuna, TheMuse, RemoteOK).

    Query params:
        q               (str, required) — keywords e.g. "React Developer"
        location        (str)           — city/country e.g. "Cape Town"
        employment_type (str)           — all | fulltime | parttime | remote
        salary_min      (int)           — minimum salary
        salary_max      (int)           — maximum salary
        date_posted     (str)           — all | today | 3days | week | month
        remote_only     (bool)          — "true" to filter remote jobs only

    Returns:
        {
            "jobs":  [...],   # list of normalised job objects
            "total": int,     # total count
            "query": str      # echoed back for UI display
        }
    """

    query           = request.args.get("q", "").strip()
    location        = request.args.get("location", "").strip()
    employment_type = request.args.get("employment_type", "all")
    date_posted     = request.args.get("date_posted", "all")
    remote_only     = request.args.get("remote_only", "false").lower() == "true"

    # Parse optional salary params
    try:
        salary_min = int(request.args.get("salary_min")) if request.args.get("salary_min") else None
    except ValueError:
        salary_min = None

    try:
        salary_max = int(request.args.get("salary_max")) if request.args.get("salary_max") else None
    except ValueError:
        salary_max = None

    if not query:
        return jsonify({"message": "Search query is required"}), 400

    jobs = search_jobs(
        query           = query,
        location        = location,
        employment_type = employment_type,
        salary_min      = salary_min,
        salary_max      = salary_max,
        date_posted     = date_posted,
        remote_only     = remote_only,
    )

    return jsonify({
        "jobs":  jobs,
        "total": len(jobs),
        "query": query,
    })


# =============================================================================
# JOB DETAIL
# =============================================================================

@app.route("/api/jobs/<job_id>", methods=["GET"])
@jwt_required()
def job_detail(job_id):
    """
    Returns a single job by its ID.

    Because we don't store jobs in our DB (they come from external APIs),
    this endpoint re-fetches the job from the relevant source based on
    the ID prefix (jsearch_, adzuna_, muse_, remoteok_).

    For now returns a 404 — full implementation can be added once
    the search page is working and we know which sources are most used.
    The frontend will pass the full job object through state/localStorage
    to the detail view, so this endpoint is optional for the initial build.
    """
    return jsonify({"message": "Use job data passed from search results"}), 200

VALID_STATUSES = {"Wishlist", "Applied", "Interview", "Offer", "Rejected"}


@app.route("/api/tracker", methods=["GET"])
@jwt_required()
def get_applications():
    """
    GET /api/tracker
    Returns all job applications for the logged-in user, sorted by created_at desc.
    Response: [ { id, company, role, status, salary, notes, url, created_at }, ... ]
    """
    email   = get_jwt_identity()
    user    = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    apps = JobApplication.query.filter_by(user_id=user.id)\
               .order_by(JobApplication.created_at.desc()).all()

    return jsonify([{
        "id":         a.id,
        "company":    a.company,
        "role":       a.role,
        "status":     a.status,
        "salary":     a.salary,
        "notes":      a.notes,
        "url":        a.url,
        "created_at": a.created_at.isoformat() if a.created_at else "",
    } for a in apps])


@app.route("/api/tracker", methods=["POST"])
@jwt_required()
def create_application():
    """
    POST /api/tracker
    Creates a new job application.
    Body: { company, role, status, salary, notes, url }
    Returns the created application object.
    """
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    data   = request.get_json()
    status = data.get("status", "Wishlist")

    if status not in VALID_STATUSES:
        return jsonify({"message": f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"}), 400

    app_entry = JobApplication(
        user_id = user.id,
        company = data.get("company", "").strip(),
        role    = data.get("role", "").strip(),
        status  = status,
        salary  = data.get("salary", "").strip(),
        notes   = data.get("notes", "").strip(),
        url     = data.get("url", "").strip(),
    )

    db.session.add(app_entry)
    db.session.commit()

    return jsonify({
        "id":         app_entry.id,
        "company":    app_entry.company,
        "role":       app_entry.role,
        "status":     app_entry.status,
        "salary":     app_entry.salary,
        "notes":      app_entry.notes,
        "url":        app_entry.url,
        "created_at": app_entry.created_at.isoformat() if app_entry.created_at else "",
    }), 201


@app.route("/api/tracker/<int:app_id>", methods=["PATCH"])
@jwt_required()
def update_application(app_id):
    """
    PATCH /api/tracker/<id>
    Updates any field on a job application — most commonly `status` when
    the user drags a card to a new Kanban column.
    Body: { status?, company?, role?, salary?, notes?, url? }
    """
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    app_entry = JobApplication.query.filter_by(id=app_id, user_id=user.id).first()
    if not app_entry:
        return jsonify({"message": "Application not found"}), 404

    data = request.get_json()

    if "status" in data:
        if data["status"] not in VALID_STATUSES:
            return jsonify({"message": "Invalid status"}), 400
        app_entry.status = data["status"]

    if "company" in data: app_entry.company = data["company"].strip()
    if "role"    in data: app_entry.role    = data["role"].strip()
    if "salary"  in data: app_entry.salary  = data["salary"].strip()
    if "notes"   in data: app_entry.notes   = data["notes"].strip()
    if "url"     in data: app_entry.url     = data["url"].strip()

    db.session.commit()

    return jsonify({
        "id":         app_entry.id,
        "company":    app_entry.company,
        "role":       app_entry.role,
        "status":     app_entry.status,
        "salary":     app_entry.salary,
        "notes":      app_entry.notes,
        "url":        app_entry.url,
        "created_at": app_entry.created_at.isoformat() if app_entry.created_at else "",
    })


@app.route("/api/tracker/<int:app_id>", methods=["DELETE"])
@jwt_required()
def delete_application(app_id):
    """
    DELETE /api/tracker/<id>
    Permanently deletes a job application.
    Only the owning user can delete their own applications.
    """
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    app_entry = JobApplication.query.filter_by(id=app_id, user_id=user.id).first()
    if not app_entry:
        return jsonify({"message": "Application not found"}), 404

    db.session.delete(app_entry)
    db.session.commit()

    return jsonify({"message": "Application deleted", "id": app_id})

# ── INTERVIEW PREP ────────────────────────────────────────────────────────────

@app.route("/api/tools/interview-prep", methods=["POST"])
@jwt_required()
def interview_prep():
    """
    POST /api/tools/interview-prep
    Body: { jobDescription, profile }
    Returns: { questions: [ { question, answer, category, difficulty } ] }
    """
    data            = request.get_json()
    job_description = data.get("jobDescription", "")
    profile         = data.get("profile", {})

    if not job_description:
        return jsonify({"message": "jobDescription is required"}), 400

    result = generate_interview_prep(job_description, profile)
    return jsonify(result)


# ── LINKEDIN OPTIMISER ────────────────────────────────────────────────────────

@app.route("/api/tools/linkedin", methods=["POST"])
@jwt_required()
def linkedin_optimiser():
    """
    POST /api/tools/linkedin
    Body: { jobDescription, profile, currentBio? }
    Returns: { variations: [ { tone, headline, summary } ] }
    """
    data            = request.get_json()
    job_description = data.get("jobDescription", "")
    profile         = data.get("profile", {})
    current_bio     = data.get("currentBio", "")

    if not job_description:
        return jsonify({"message": "jobDescription is required"}), 400

    result = optimise_linkedin_bio(job_description, profile, current_bio)
    return jsonify(result)


# ── SALARY ESTIMATOR ─────────────────────────────────────────────────────────

@app.route("/api/tools/salary", methods=["POST"])
@jwt_required()
def salary_estimator():
    """
    POST /api/tools/salary
    Body: { jobTitle, location, skills, experienceYears, jobDescription? }
    Returns: { role, currency, range_min, range_max, ... }
    """
    data             = request.get_json()
    job_title        = data.get("jobTitle", "")
    location         = data.get("location", "")
    skills           = data.get("skills", [])
    experience_years = data.get("experienceYears", 0)
    job_description  = data.get("jobDescription", "")

    if not job_title:
        return jsonify({"message": "jobTitle is required"}), 400

    result = estimate_salary(job_title, location, skills, experience_years, job_description)
    return jsonify(result)


# ── SKILLS GAP REPORT ────────────────────────────────────────────────────────

@app.route("/api/tools/skills-gap", methods=["POST"])
@jwt_required()
def skills_gap():
    """
    POST /api/tools/skills-gap
    Body: { jobDescription, profile }
    Returns: { match_score, present_skills, missing_skills, nice_to_have, priority_actions, summary }
    """
    data            = request.get_json()
    job_description = data.get("jobDescription", "")
    profile         = data.get("profile", {})

    if not job_description:
        return jsonify({"message": "jobDescription is required"}), 400

    result = generate_skills_gap(job_description, profile)
    return jsonify(result)






if __name__ == "__main__":
    app.run(debug=True)