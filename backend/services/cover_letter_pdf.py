# =============================================================================
# FILE: backend/services/cover_letter_pdf.py
# =============================================================================
# Delegates to cover_letter_latex.py for the properly styled PDF.
# CALLED BY: app.py → /api/download-cover-letter-pdf
# =============================================================================

from services.cover_letter_latex import generate_cover_letter_pdf  # noqa: F401
