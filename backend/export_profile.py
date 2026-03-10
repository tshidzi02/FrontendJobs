# =============================================================================
# FILE: backend/export_profile.py
# RUN: cd backend && python export_profile.py
# =============================================================================

import sqlite3
import json
import os
import glob

# ── Find ALL .db files in and around the backend folder ──────────────────────
search_dirs = [
    os.path.dirname(__file__),                          # backend/
    os.path.join(os.path.dirname(__file__), "instance"), # backend/instance/
    os.path.join(os.path.dirname(__file__), ".."),       # project root
]

db_files = []
for d in search_dirs:
    if os.path.exists(d):
        found = glob.glob(os.path.join(d, "*.db"))
        db_files.extend(found)

db_files = list(set(db_files))  # deduplicate

print("\n🔍 Found database files:")
for i, f in enumerate(db_files):
    size = os.path.getsize(f)
    print(f"   [{i}] {f}  ({size} bytes)")

if not db_files:
    print("❌ No .db files found. Is your local Flask server set up?")
    exit(1)

# ── Pick the right one ────────────────────────────────────────────────────────
if len(db_files) == 1:
    db_path = db_files[0]
    print(f"\n✅ Using: {db_path}")
else:
    choice = input("\nEnter the number of the database to use: ").strip()
    db_path = db_files[int(choice)]

# ── Try to connect and read ───────────────────────────────────────────────────
try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Run integrity check first
    cursor = conn.cursor()
    cursor.execute("PRAGMA integrity_check")
    integrity = cursor.fetchone()[0]

    if integrity != "ok":
        print(f"⚠️  Integrity check: {integrity}")
        print("   Trying to recover anyway...")

    # List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    print(f"\n📋 Tables found: {tables}")

    if "user" not in tables:
        print("❌ No 'user' table found. Wrong database file?")
        conn.close()
        exit(1)

    # List users
    cursor.execute("SELECT id, email FROM user")
    users = cursor.fetchall()

    print("\n👤 Users in database:")
    for u in users:
        print(f"   [{u['id']}] {u['email']}")

    if not users:
        print("❌ No users found. Have you registered on your local site?")
        conn.close()
        exit(1)

    # Pick email
    print()
    email = input("Enter your email to export: ").strip()

    cursor.execute("SELECT id FROM user WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user:
        print(f"❌ No user found with email: {email}")
        conn.close()
        exit(1)

    # Get profile
    cursor.execute("SELECT data FROM profile WHERE user_id = ?", (user["id"],))
    profile_row = cursor.fetchone()

    if not profile_row:
        print(f"❌ No profile data found for: {email}")
        print("   Go to your local site → Profile page → fill in and save your profile first.")
        conn.close()
        exit(1)

    profile_data = json.loads(profile_row["data"])
    conn.close()

except sqlite3.DatabaseError as e:
    print(f"\n❌ SQLite error: {e}")
    print("\nTrying alternative method — reading via Flask app context...")

    # Fallback: use Flask app to read via SQLAlchemy
    try:
        os.environ["FLASK_APP"] = "app.py"
        # Force local SQLite
        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
        from app import app, db, User, Profile

        with app.app_context():
            users = User.query.all()
            print("\n👤 Users found via Flask:")
            for u in users:
                print(f"   {u.email}")

            email = input("\nEnter your email to export: ").strip()
            user = User.query.filter_by(email=email).first()

            if not user:
                print(f"❌ No user found with email: {email}")
                exit(1)

            profile = Profile.query.filter_by(user_id=user.id).first()
            if not profile:
                print("❌ No profile found.")
                exit(1)

            profile_data = json.loads(profile.data)

    except Exception as e2:
        print(f"❌ Flask fallback also failed: {e2}")
        print("\nYour database may be corrupted.")
        print("Try: delete backend/instance/users.db, restart Flask, re-fill your profile, then run this again.")
        exit(1)

# ── Save to JSON ──────────────────────────────────────────────────────────────
output_path = os.path.join(os.path.dirname(__file__), "profile_export.json")

with open(output_path, "w", encoding="utf-8") as f:
    json.dump({"email": email, "profile": profile_data}, f, indent=2, ensure_ascii=False)

print(f"\n✅ Profile exported successfully!")
print(f"   Saved to: {output_path}")
print(f"   Fields: {list(profile_data.keys())}")
print(f"\n📋 Next step — copy to server:")
print(f'   scp backend/profile_export.json root@143.110.173.170:/var/www/cvapp/backend/')