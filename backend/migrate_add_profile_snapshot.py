# =============================================================================
# FILE: backend/migrate_add_profile_snapshot.py
# =============================================================================
# PURPOSE:
#   One-time migration script.
#   Adds the `profile_snapshot` column to the existing `saved_cv` table.
#
# WHY THIS IS NEEDED:
#   SQLAlchemy's db.create_all() only creates tables that don't exist yet.
#   It does NOT add new columns to tables that already exist.
#   So when we added `profile_snapshot` to the SavedCV model, the live
#   users.db still has the old schema — without that column.
#   SQLite then throws: "no such column: saved_cv.profile_snapshot"
#
# HOW TO RUN (once, from the backend/ directory):
#   python migrate_add_profile_snapshot.py
#
# SAFE TO RE-RUN:
#   The script checks if the column already exists before adding it.
#   Running it twice will not break anything.
# =============================================================================

import sqlite3
import os

# Path to the SQLite database file.
# adjust if your db is in a different location.
DB_PATH = os.path.join(os.path.dirname(__file__), "instance", "users.db")

def column_exists(cursor, table, column):
    """Check if a column already exists in a table."""
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    return column in columns

def run_migration():
    print(f"Connecting to database at: {DB_PATH}")

    if not os.path.exists(DB_PATH):
        print("ERROR: Database file not found. Make sure the path is correct.")
        print(f"Looked for: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # ── Add profile_snapshot column ───────────────────────────────────────────
    if column_exists(cursor, "saved_cv", "profile_snapshot"):
        print("✓ Column 'profile_snapshot' already exists — nothing to do.")
    else:
        print("Adding column 'profile_snapshot' to saved_cv table...")
        cursor.execute("""
            ALTER TABLE saved_cv
            ADD COLUMN profile_snapshot TEXT NOT NULL DEFAULT '{}'
        """)
        conn.commit()
        print("✓ Column 'profile_snapshot' added successfully.")

    conn.close()
    print("\nMigration complete. Restart your Flask server.")

if __name__ == "__main__":
    run_migration()