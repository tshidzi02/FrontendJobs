# =============================================================================
# FILE: backend/config.py
# =============================================================================
# PURPOSE: This is the SINGLE SOURCE OF TRUTH for all app configuration.
#          Instead of scattering settings across multiple files, everything
#          lives here. app.py imports from here instead of using raw strings.
#
# PATTERN USED: "Configuration Class" pattern — standard in Flask production apps
#
# HOW IT WORKS:
#   1. python-dotenv loads the .env file into os.environ
#   2. This file reads from os.environ using os.environ.get()
#   3. app.py does: from config import Config
#                   app.config.from_object(Config)
#   4. Flask sets all Config class variables as app settings
# =============================================================================

import os
# os = operating system module.
# os.environ is a dictionary of all environment variables set on the system.
# After python-dotenv loads .env, those variables appear in os.environ too.

from dotenv import load_dotenv
# load_dotenv() reads the .env file and injects each line into os.environ.
# This must be called BEFORE any os.environ.get() calls.
# Without this, os.environ.get("JWT_SECRET_KEY") would return None.

from datetime import timedelta

# ─────────────────────────────────────────────
# Load the .env file into environment variables
# ─────────────────────────────────────────────
load_dotenv()
# Reads backend/.env and populates os.environ with the key-value pairs.
# Example: After this runs, os.environ["JWT_SECRET_KEY"] = "abc123..."


# ─────────────────────────────────────────────
# Configuration Class
# ─────────────────────────────────────────────
class Config:
    # A Python class used as a configuration container.
    # Flask's app.config.from_object(Config) reads every UPPERCASE
    # class variable and sets it as an app config value.
    # Only UPPERCASE variables are picked up — this is Flask's convention.

    # ── JWT ──────────────────────────────────────────────────────────────
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    # Reads the JWT_SECRET_KEY from environment variables.
    # If .env is loaded correctly, this will be your long random string.
    # If .env is missing or the key doesn't exist, this returns None
    # which will cause Flask-JWT to fail loudly (good — you want to know).

    # ── DATABASE ─────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///users.db")
    # os.environ.get(key, default) — the second argument is a fallback value.
    # If DATABASE_URL is not set in .env, it defaults to SQLite.
    # In production, DATABASE_URL will be a PostgreSQL connection string.

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Disables SQLAlchemy's event notification system.
    # We don't use it, and it wastes memory. Always set to False.

    # ── GOOGLE OAUTH ─────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
    # The Google OAuth client ID from Google Cloud Console.
    # Used in the /api/auth/google route to verify Google tokens.

    # ── OPENAI ───────────────────────────────────────────────────────────
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    # The OpenAI API key. The OpenAI Python library automatically reads
    # the OPENAI_API_KEY environment variable, so you don't always need
    # to pass it explicitly — but storing it here makes it explicit and
    # allows you to validate it on startup.

    # ── FLASK ENVIRONMENT ─────────────────────────────────────────────────
    DEBUG = os.environ.get("FLASK_ENV") == "development"
    # DEBUG = True only when FLASK_ENV is "development".
    # DEBUG mode enables:
    #   - Auto-reload when you change code
    #   - Detailed error pages in the browser
    #   - Never enable in production — it exposes your source code

    # ── JWT TOKEN EXPIRY ──────────────────────────────────────────────────
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    # Default is 15 minutes — way too short for filling in a profile form.
    # 8 hours = stays logged in for a full working session.
    # Flask-JWT-Extended reads this config key automatically.

    # Job search API keys
    JSEARCH_API_KEY  = os.environ.get("JSEARCH_API_KEY", "")
    ADZUNA_APP_ID    = os.environ.get("ADZUNA_APP_ID", "")
    ADZUNA_APP_KEY   = os.environ.get("ADZUNA_APP_KEY", "")
    THE_MUSE_API_KEY = os.environ.get("THE_MUSE_API_KEY", "")

# NOTE: job_search.py reads these directly from os.environ via os.environ.get()
# so no extra wiring in app.py is needed — as long as python-dotenv loads .env
# at startup (which it already does via config.py), the keys are available.


