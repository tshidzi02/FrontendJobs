from openai import OpenAI
import json
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
import traceback
import json as _json
import io     

from config import Config

# =============================================================================
# APP SETUP
# =============================================================================

app = Flask(__name__)
app.config.from_object(Config)

# Force SQLite - ignore any environment DATABASE_URL
app.config["JWT_SECRET_KEY"] = "change-this-to-long-random-secret"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024
CORS(app, origins=["https://frontendjobs.online", "http://localhost:5173", "http://127.0.0.1:5173"])

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

client = OpenAI()

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
    return jsonify(ai_content)


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

    print("Received data for CV generation:")
    print(f"Job Description: {job_description}")
    print(f"Base Skills: {base_skills}")
    print(f"Base Experience: {base_experience}")
    print(f"Project Experience: {project_experience}")
    print(f"Education: {education}")
    print(f"Languages: {languages}")
    print(f"References: {references}")