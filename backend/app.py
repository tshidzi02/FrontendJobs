
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

from config import Config
from services.ai_engine import generate_cv_content
from services.ats_analyzer import analyze_ats
from services.semantic_matcher import semantic_match_score
from services.cv_generator import generate_cv
from services.cover_letter_generator import generate_cover_letter
from services.cover_letter_docx import generate_cover_letter_docx
from services.cv_pdf             import generate_cv_pdf
from services.cover_letter_pdf   import generate_cover_letter_pdf
from services.cv_latex import build_cv_tex 
from services.cover_letter_latex import build_cover_letter_tex
from services.job_search import search_jobs
from services.tools_ai import (
    generate_interview_prep,
    optimise_linkedin_bio,
    estimate_salary,
    generate_skills_gap,
)
from services.smart_jobs_service import (
    fetch_all_jobs,
    rank_jobs,
    build_search_query,
    generate_batch_zip
)
 
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()


# =============================================================================
# APP SETUP
# =============================================================================

app = Flask(__name__)
app.config.from_object(Config)


app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "fallback-secret")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///users.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
    "connect_args": {"connect_timeout": 10}
}

CORS(app, origins=[
    "https://www.frontendjobs.co.za",
    "https://frontendjobs.co.za",
    "http://localhost:5173"
])

database_url = os.environ.get("DATABASE_URL", "")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url

@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        return response
    
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



class SavedBulkItem(db.Model):
    # Stores one bulk-generated set (CV tex + cover letter tex + combined) per row.
    # Saved from the Bulk Generator page via POST /api/bulk-save.
    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    job_title        = db.Column(db.String(200), nullable=False, default="Untitled Role")
    ats_score        = db.Column(db.Float,       nullable=False, default=0.0)
    tone             = db.Column(db.String(50),  nullable=False, default="professional")
    cv_tex           = db.Column(db.Text, nullable=False, default="")
    cl_tex           = db.Column(db.Text, nullable=False, default="")
    combined_tex     = db.Column(db.Text, nullable=False, default="")
    cover_letter     = db.Column(db.Text, nullable=False, default="")
    ai_result        = db.Column(db.Text, nullable=False, default="{}")
    profile_snapshot = db.Column(db.Text, nullable=False, default="{}")
    created_at       = db.Column(db.DateTime, default=db.func.now())


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

class SmartJobApplication(db.Model):
    """
    Persists a user's job search results and application pipeline.
    status flow: ranked → generated → verified → applied
    """
    id           = db.Column(db.Integer, primary_key=True)
    user_email   = db.Column(db.String(120), nullable=False, index=True)
    job_id       = db.Column(db.String(200), nullable=False)
    title        = db.Column(db.String(300))
    company      = db.Column(db.String(200))
    location     = db.Column(db.String(200))
    salary       = db.Column(db.String(200))
    work_type    = db.Column(db.String(100))
    apply_url    = db.Column(db.String(500))
    match_score  = db.Column(db.Float, default=0)
    status       = db.Column(db.String(50), default="ranked")
    description  = db.Column(db.Text)
    company_logo = db.Column(db.String(500))
    posted_at    = db.Column(db.String(100))
    created_at   = db.Column(db.DateTime, server_default=db.func.now())
 

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


# =============================================================================
# ADD THIS TO YOUR app.py  (replace any previous /api/parse-cv route)
# =============================================================================


@app.route("/api/parse-cv", methods=["POST"])
@jwt_required()
def parse_cv():
    """
    Parses CV content (text or image) into the profile JSON structure.
    Accepts:
      - Plain text CV  (cv_text is a regular string)
      - Image CV       (cv_text starts with "__IMAGE__data:image/...")
    """
    data = request.get_json()
    cv_text = (data.get("cv_text") or "").strip()

    if not cv_text:
        return jsonify({"error": "No CV content provided — the file may be empty or unreadable"}), 400

    system_prompt = """You are a CV parser. Extract all information from the provided CV and return ONLY a valid JSON object — no markdown, no explanation, nothing else.

The JSON must follow this EXACT structure:
{
  "personalInfo": {
    "firstName": "",
    "lastName": "",
    "jobTitle": "",
    "city": "",
    "phone": "",
    "email": "",
    "github": "",
    "website": ""
  },
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "title": "",
      "company": "",
      "city": "",
      "country": "",
      "startYear": "",
      "endYear": "",
      "bullets": ["bullet1", "bullet2"]
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "city": "",
      "country": "",
      "graduationStatus": "graduated",
      "graduationMonth": "",
      "graduationYear": "",
      "minimumAverage": "",
      "coursework": ["item1"]
    }
  ],
  "projects": [
    {
      "name": "",
      "technologies": "",
      "bullets": ["bullet1"],
      "url": "",
      "includeInCV": true
    }
  ],
  "languages": [
    { "name": "", "level": 3 }
  ],
  "references": "Available upon Request"
}

Language level is 1-6: 1=Beginner(A1), 2=Elementary(A2), 3=Intermediate(B1), 4=Upper-Intermediate(B2), 5=Advanced(C1), 6=Bilingual(C2).
For experience endYear use "Present" if current role. For technologies use comma-separated string.
Return ONLY the JSON object, nothing else."""

    raw = ""
    try:
        client = OpenAI()

        # ── IMAGE MODE ───────────────────────────────────────────────────────
        if cv_text.startswith("__IMAGE__"):
            data_url = cv_text[len("__IMAGE__"):]
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url}},
                            {"type": "text", "text": "Parse this CV image and return the JSON profile."},
                        ],
                    },
                ],
                temperature=0.1,
                max_tokens=4000,
            )

        # ── TEXT MODE ────────────────────────────────────────────────────────
        else:
            if len(cv_text) > 14000:
                cv_text = cv_text[:14000]
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": f"Parse this CV:\n\n{cv_text}"},
                ],
                temperature=0.1,
                max_tokens=4000,
            )

        raw   = response.choices[0].message.content or ""
        # Strip markdown fences if present
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
            clean = clean.strip()
        # Find the JSON object boundaries as fallback
        if not clean.startswith("{"):
            start = clean.find("{")
            end   = clean.rfind("}") + 1
            if start >= 0 and end > start:
                clean = clean[start:end]
        parsed = _json.loads(clean)
        return jsonify({"profile": parsed})

    except _json.JSONDecodeError as e:
        print(f"[parse-cv] JSON decode error: {e}")
        print(f"[parse-cv] Raw response was: {raw[:500]}")
        return jsonify({"error": f"AI returned invalid JSON: {str(e)}", "raw": raw[:300]}), 500
    except Exception as e:
        print(f"[parse-cv] Exception: {type(e).__name__}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"{type(e).__name__}: {str(e)}"}), 500




# ── DOWNLOAD CV as PDF (LaTeX) ─────────────────────────────────────────────────
@app.route("/api/download-cv-pdf", methods=["POST"])
@jwt_required()
def download_cv_pdf():
    """
    Renders cv_template.tex with the AI result and compiles it to PDF via xelatex.

    Request body — identical to /api/download-cv:
      {
        "ai_result": { ...same AI result object... },
        "profile":   { ...same profile object... }
      }

    Returns: PDF file download named <FirstName_LastName_JobTitle_CV.pdf>

    Errors:
      400 — no ai_result provided
      500 — xelatex not installed, or template missing, or compile error
    """
    data      = request.get_json()
    ai_result = data.get("ai_result", {})
    profile   = data.get("profile", {})

    if not ai_result:
        return jsonify({"message": "No AI result provided"}), 400

    try:
        output_path = generate_cv_pdf(profile, ai_result)

        personal   = profile.get("personalInfo", {})
        first_name = personal.get("firstName", "")
        last_name  = personal.get("lastName",  "")
        job_title  = data.get("jobTitle", "").strip().replace(" ", "_")[:50]
        full_name  = f"{first_name}{'_' + last_name if last_name else ''}".strip()
        filename   = "_".join(filter(None, [full_name, job_title, "CV"])) + ".pdf"

        return send_file(
            output_path,
            as_attachment=True,
            download_name=filename,
            mimetype="application/pdf",
        )
    except RuntimeError as e:
        # xelatex not installed or compile error — return a helpful message
        return jsonify({"message": str(e)}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"message": f"PDF generation failed: {str(e)}"}), 500


# ── DOWNLOAD COVER LETTER as PDF (LaTeX) ──────────────────────────────────────
@app.route("/api/download-cover-letter-pdf", methods=["POST"])
@jwt_required()
def download_cover_letter_pdf():
    """
    Renders cover_letter_template.tex and compiles it to PDF via xelatex.

    Request body — identical to /api/download-cover-letter:
      {
        "cover_letter": "Full plain text of the generated cover letter",
        "job_title":    "Senior Software Engineer"
      }

    Profile is loaded from DB (same as the .docx route — no need to resend it).

    Returns: PDF file download named Cover_Letter.pdf
    """
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    data         = request.get_json()
    cover_letter = data.get("cover_letter", "").strip()
    job_title    = data.get("job_title", "Application")

    if not cover_letter:
        return jsonify({"message": "No cover letter text provided"}), 400

    profile_row = Profile.query.filter_by(user_id=user.id).first()
    profile     = json.loads(profile_row.data) if profile_row else {}

    try:
        output_path = generate_cover_letter_pdf(profile, cover_letter, job_title)
        return send_file(
            output_path,
            as_attachment=True,
            download_name="Cover_Letter.pdf",
            mimetype="application/pdf",
        )
    except RuntimeError as e:
        return jsonify({"message": str(e)}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"message": f"PDF generation failed: {str(e)}"}), 500



# ── DOWNLOAD CV as .tex (Overleaf) ────────────────────────────────────────────
@app.route("/api/download-cv-tex", methods=["POST"])
@jwt_required()
def download_cv_tex():
    from services.cv_latex import generate_cv_tex
    data      = request.get_json()
    ai_result = data.get("ai_result", {})
    profile   = data.get("profile", {})
    if not ai_result:
        return jsonify({"message": "No AI result provided"}), 400
    try:
        tex_path   = generate_cv_tex(profile, ai_result)
        personal   = profile.get("personalInfo", {})
        first_name = personal.get("firstName", "")
        last_name  = personal.get("lastName",  "")
        full_name  = f"{first_name}{'_' + last_name if last_name else ''}".strip()
        filename   = "_".join(filter(None, [full_name, "CV"])) + ".tex"
        return send_file(tex_path, as_attachment=True,
                         download_name=filename, mimetype="text/plain")
    except Exception as e:
        traceback.print_exc()
        return jsonify({"message": f"TeX generation failed: {str(e)}"}), 500


# ── DOWNLOAD COVER LETTER as .tex (Overleaf) ──────────────────────────────────
@app.route("/api/download-cover-letter-tex", methods=["POST"])
@jwt_required()
def download_cover_letter_tex():
    from services.cover_letter_latex import generate_cover_letter_tex
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    data         = request.get_json()
    cover_letter = data.get("cover_letter", "").strip()
    job_title    = data.get("job_title", "Application")
    if not cover_letter:
        return jsonify({"message": "No cover letter text provided"}), 400
    profile_row = Profile.query.filter_by(user_id=user.id).first()
    profile     = json.loads(profile_row.data) if profile_row else {}
    try:
        tex_path = generate_cover_letter_tex(profile, cover_letter, job_title)
        return send_file(tex_path, as_attachment=True,
                         download_name="Cover_Letter.tex", mimetype="text/plain")
    except Exception as e:
        traceback.print_exc()
        return jsonify({"message": f"TeX generation failed: {str(e)}"}), 500


# =============================================================================
# BULK GENERATOR — LATEX BUILD + SAVE TO CABINET
# =============================================================================

@app.route("/api/bulk-tex", methods=["POST"])
@jwt_required()
def bulk_tex():
    """
    Accepts a pre-generated CV ai_result + cover letter text and returns
    the LaTeX source for both as plain strings.
    """
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    data         = request.get_json()
    ai_result    = data.get("ai_result", {})
    cover_letter = data.get("cover_letter", "")
    job_title    = data.get("job_title", "")

    profile_row = Profile.query.filter_by(user_id=user.id).first()
    profile     = json.loads(profile_row.data) if profile_row else {}

    try:
        cv_tex = build_cv_tex(profile, ai_result)
    except Exception as e:
        return jsonify({"message": f"CV LaTeX build failed: {str(e)}"}), 500

    try:
        cl_tex = build_cover_letter_tex(profile, cover_letter, job_title)
    except Exception as e:
        return jsonify({"message": f"Cover letter LaTeX build failed: {str(e)}"}), 500

    return jsonify({
        "cv_tex":           cv_tex,
        "cover_letter_tex": cl_tex,
    })


@app.route("/api/bulk-save", methods=["POST"])
@jwt_required()
def bulk_save():
    """Save one bulk-generated item (CV tex + cover letter tex) to the cabinet."""
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    data             = request.get_json() or {}
    job_title        = data.get("job_title",    "Untitled Role")[:200]
    tone             = data.get("tone",          "professional")
    cv_tex           = data.get("cv_tex",        "")
    cl_tex           = data.get("cl_tex",        "")
    combined_tex     = data.get("combined_tex",  "")
    cover_letter     = data.get("cover_letter",  "")
    ai_result        = data.get("ai_result",     {})
    profile_snapshot = data.get("profile_snapshot", {})
    ats_score        = ai_result.get("ats", {}).get("final_score", 0.0) \
                       if isinstance(ai_result, dict) else 0.0

    item = SavedBulkItem(
        user_id          = user.id,
        job_title        = job_title,
        ats_score        = ats_score,
        tone             = tone,
        cv_tex           = cv_tex,
        cl_tex           = cl_tex,
        combined_tex     = combined_tex,
        cover_letter     = cover_letter,
        ai_result        = json.dumps(ai_result),
        profile_snapshot = json.dumps(profile_snapshot),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify({"message": "Saved to cabinet", "id": item.id}), 201


@app.route("/api/bulk-saved", methods=["GET"])
@jwt_required()
def get_bulk_saved():
    """Return all bulk-saved items for the logged-in user, newest first."""
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    items = SavedBulkItem.query.filter_by(user_id=user.id) \
                               .order_by(SavedBulkItem.created_at.desc()).all()
    return jsonify([
        {
            "id":           item.id,
            "job_title":    item.job_title,
            "ats_score":    item.ats_score,
            "tone":         item.tone,
            "cv_tex":       item.cv_tex,
            "cl_tex":       item.cl_tex,
            "combined_tex": item.combined_tex,
            "cover_letter": item.cover_letter,
            "created_at":   item.created_at.isoformat() if item.created_at else "",
        }
        for item in items
    ])


@app.route("/api/bulk-saved/<int:item_id>", methods=["DELETE"])
@jwt_required()
def delete_bulk_saved(item_id):
    """Delete one bulk-saved item. Verifies ownership."""
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    item = SavedBulkItem.query.filter_by(id=item_id, user_id=user.id).first()
    if not item:
        return jsonify({"message": "Not found"}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# =========================
# ROUTES — SMART JOBS
# =========================
 
@app.route("/api/smart-jobs/search", methods=["POST"])
@jwt_required()
def smart_jobs_search():
    """
    Fetch jobs from JSearch, rank against user profile, persist to DB.
    Body: { profile: {...}, query: "optional", page: 1 }
    """
    current_user = get_jwt_identity()
    data = request.get_json()
 
    profile = data.get("profile", {})
    user_query = data.get("query", "")
    page = int(data.get("page", 1))
 
    if not profile:
        return jsonify({"message": "Profile data required"}), 400
 
    search_query = build_search_query(profile, user_query)
    jobs, total = fetch_all_jobs(search_query, page=page)

    if not jobs:
        return jsonify({
            "jobs": [],
            "total": 0,
            "query": search_query,
            "message": "No jobs found. Check your API keys or try a different query."
        })

    ranked_jobs = rank_jobs(jobs, profile)
 
    # Persist new jobs to DB (skip duplicates)
    for job in ranked_jobs:
        existing = SmartJobApplication.query.filter_by(
            user_email=current_user,
            job_id=job["job_id"]
        ).first()
 
        if not existing:
            db.session.add(SmartJobApplication(
                user_email=current_user,
                job_id=job["job_id"],
                title=job["title"],
                company=job["company"],
                location=job["location"],
                salary=job["salary"],
                work_type=job["work_type"],
                apply_url=job["apply_url"],
                match_score=job["match_score"],
                status="ranked",
                description=job["description"],
                company_logo=job["company_logo"],
                posted_at=job["posted_at"]
            ))
 
    db.session.commit()
 
    return jsonify({
        "jobs": ranked_jobs,
        "total": total,
        "query": search_query
    })
 
 
@app.route("/api/smart-jobs/generate-batch", methods=["POST"])
@jwt_required()
def smart_jobs_generate_batch():
    """
    Generate a ZIP of tailored LaTeX CV+CoverLetter files for selected jobs.
    Body: { profile: {...}, jobs: [...] }
    Returns: ZIP file download
    """
    current_user = get_jwt_identity()
    data = request.get_json()
 
    profile = data.get("profile", {})
    jobs = data.get("jobs", [])
 
    if not profile:
        return jsonify({"message": "Profile data required"}), 400
    if not jobs:
        return jsonify({"message": "No jobs provided"}), 400
 
    # Cap at 5 per batch — each job makes 2 AI calls (~15-30s each)
    jobs = jobs[:5]
 
    try:
        zip_bytes = generate_batch_zip(profile, jobs)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Generation error: {str(e)}"}), 500
 
    if not zip_bytes:
        return jsonify({"message": "ZIP generation produced no output"}), 500
 
    # Mark jobs as generated in DB
    for job in jobs:
        record = SmartJobApplication.query.filter_by(
            user_email=current_user,
            job_id=job.get("job_id", "")
        ).first()
        if record:
            record.status = "generated"
 
    db.session.commit()
 
    zip_io = io.BytesIO(zip_bytes)
    zip_io.seek(0)
 
    return send_file(
        zip_io,
        mimetype="application/zip",
        as_attachment=True,
        download_name="FrontendJobs_Applications.zip"
    )
 
 
@app.route("/api/smart-jobs/status", methods=["PATCH"])
@jwt_required()
def smart_jobs_update_status():
    """
    Update the status of a job application.
    Body: { job_id: "...", status: "verified" | "applied" | "ranked" | "generated" }
    """
    current_user = get_jwt_identity()
    data = request.get_json()
 
    job_id = data.get("job_id")
    new_status = data.get("status")
 
    valid_statuses = ["ranked", "generated", "verified", "applied"]
    if new_status not in valid_statuses:
        return jsonify({"message": f"Invalid status. Must be one of: {valid_statuses}"}), 400
 
    record = SmartJobApplication.query.filter_by(
        user_email=current_user,
        job_id=job_id
    ).first()
 
    if not record:
        return jsonify({"message": "Job not found"}), 404
 
    record.status = new_status
    db.session.commit()
 
    return jsonify({"message": "Status updated", "job_id": job_id, "status": new_status})
 
 
@app.route("/api/smart-jobs/queue", methods=["GET"])
@jwt_required()
def smart_jobs_queue():
    """
    Get all saved job applications for this user, bucketed by status.
    """
    current_user = get_jwt_identity()
 
    records = SmartJobApplication.query.filter_by(
        user_email=current_user
    ).order_by(
        SmartJobApplication.match_score.desc()
    ).all()
 
    def to_dict(r):
        return {
            "job_id": r.job_id,
            "title": r.title,
            "company": r.company,
            "location": r.location,
            "salary": r.salary,
            "work_type": r.work_type,
            "apply_url": r.apply_url,
            "match_score": r.match_score,
            "status": r.status,
            "description": r.description,
            "company_logo": r.company_logo,
            "posted_at": r.posted_at,
        }
 
    all_jobs = [to_dict(r) for r in records]
 
    return jsonify({
        "ranked":    [j for j in all_jobs if j["status"] == "ranked"],
        "generated": [j for j in all_jobs if j["status"] == "generated"],
        "verified":  [j for j in all_jobs if j["status"] == "verified"],
        "applied":   [j for j in all_jobs if j["status"] == "applied"],
        "total": len(all_jobs)
    })
 
@app.cli.command("init-db")
def init_db():
    db.create_all()
    print("Database initialized.")

with app.app_context():
    db.create_all()
 
if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)  # ← add use_reloader=False
    