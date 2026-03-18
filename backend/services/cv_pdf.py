# =============================================================================
# FILE: backend/services/cv_pdf.py
# =============================================================================
# PURPOSE:
#   Delegates to cv_latex.py which produces the beautiful LaTeX PDF.
#   The LaTeX output matches the Overleaf version exactly.
#
#   xhtml2pdf was tried but produces an ugly result — LaTeX is correct.
#   All Windows issues (path spaces, stale cache, package downloads) are
#   fixed in cv_latex.py. This file simply calls it.
#
# CALLED BY: app.py → /api/download-cv-pdf
# =============================================================================

from services.cv_latex import generate_cv_pdf  # noqa: F401 — re-export

# generate_cv_pdf is imported and re-exported here so app.py can import
# from services.cv_pdf without needing to know the implementation detail.
