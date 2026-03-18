# =============================================================================
# FILE: backend/services/cover_letter_latex.py
# =============================================================================
# Builds the cover letter .tex source entirely in Python — no Jinja2,
# no template file, no delimiter conflicts with LaTeX syntax.
# Public API unchanged: generate_cover_letter_pdf() and generate_cover_letter_tex()
# =============================================================================

import base64
import os
import shutil
import subprocess
from datetime import datetime

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "generated_files")
TMP_DIR    = os.path.join(OUTPUT_DIR, "tmp_cl")


# =============================================================================
# LATEX ESCAPING
# =============================================================================

_LATEX_ESCAPE = [
    ("\\", r"\textbackslash{}"),   # must be FIRST
    ("&",  r"\&"),
    ("%",  r"\%"),
    ("$",  r"\$"),
    ("#",  r"\#"),
    ("_",  r"\_"),
    ("{",  r"\{"),
    ("}",  r"\}"),
    ("~",  r"\textasciitilde{}"),
    ("^",  r"\textasciicircum{}"),
]

def e(text) -> str:
    """Escape a value for safe inclusion in LaTeX."""
    if not isinstance(text, str):
        text = str(text) if text is not None else ""
    for char, replacement in _LATEX_ESCAPE:
        text = text.replace(char, replacement)
    return text


# =============================================================================
# TEX BUILDER — pure Python, no template engine
# =============================================================================

def build_cover_letter_tex(profile: dict, cover_letter_text: str,
                            job_title: str = "", signature_path: str = "") -> str:
    """
    Construct the full cover letter LaTeX source as a Python string.
    All logic is plain Python — zero Jinja2.
    """
    personal = profile.get("personalInfo", {})

    name     = f"{e(personal.get('firstName',''))} {e(personal.get('lastName',''))}".strip()
    title    = e(personal.get("jobTitle", ""))
    city     = e(personal.get("city",     ""))
    phone    = e(personal.get("phone",    ""))
    email    = e(personal.get("email",    ""))
    date     = datetime.today().strftime("%d %B %Y")
    subject  = e(f"Application for {job_title}" if job_title else "Job Application")

    # Convert cover letter body — each double-newline-separated paragraph
    # becomes its own LaTeX paragraph
    paragraphs  = [p.strip() for p in cover_letter_text.split("\n\n") if p.strip()]
    latex_body  = "\n\n".join(e(para.replace("\n", " ")) for para in paragraphs)

    lines = []
    def out(s=""):
        lines.append(s)

    # ── Preamble ──────────────────────────────────────────────────────────────
    out(r"\documentclass[11pt, a4paper]{article}")
    out()
    out(r"\usepackage[a4paper, top=0mm, left=12mm, right=12mm, bottom=12mm]{geometry}")
    out(r"\usepackage{xcolor}")
    out(r"\usepackage{fontspec}")
    out(r"\usepackage{parskip}")
    out(r"\usepackage{hyperref}")
    out(r"\usepackage{tabularx}")
    if signature_path:
        out(r"\usepackage{graphicx}")
    out()
    out(r"\definecolor{DKGreen}{HTML}{2D5016}")
    out(r"\definecolor{MDGreen}{HTML}{4A7C2F}")
    out(r"\definecolor{BorderClr}{HTML}{C8D8B0}")
    out(r"\definecolor{MidTxt}{HTML}{3C3C3C}")
    out(r"\definecolor{LiteTxt}{HTML}{7A7A6E}")
    out(r"\definecolor{PageBG}{HTML}{FAF8F3}")
    out(r"\definecolor{HeaderBG}{HTML}{2D5016}")
    out(r"\definecolor{HeaderLight}{HTML}{A8CC80}")
    out(r"\definecolor{HeaderContact}{HTML}{D0E8B0}")
    out(r"\definecolor{HeaderSep}{HTML}{6A9A50}")
    out()
    out(r"\setmainfont{Arial}[Ligatures=TeX]")
    out(r"\hypersetup{colorlinks=true, urlcolor=MDGreen}")
    out(r"\pagecolor{PageBG}")
    out(r"\pagestyle{empty}")
    out()
    out(r"\newcommand{\clrule}{%")
    out(r"  \vspace{4pt}{\color{DKGreen}\hrule height 1pt}\vspace{6pt}%")
    out(r"}")
    out()
    out(r"\begin{document}")
    out()

    # ── HEADER BANNER ─────────────────────────────────────────────────────────
    out(r"\noindent\hspace{-2mm}%")
    out(r"\colorbox{HeaderBG}{%")
    out(r"  \begin{minipage}{\dimexpr\linewidth+4mm\relax}%")
    out(r"    \vspace{6mm}")
    out(f"    \\hspace{{4mm}}{{\\fontsize{{32}}{{36}}\\selectfont\\textcolor{{white}}{{\\textbf{{{name}}}}}}}\\par")
    out(r"    \vspace{2mm}")
    out(f"    \\hspace{{4mm}}{{\\large\\textcolor{{HeaderLight}}{{\\textit{{{title}}}}}}}\\par")
    out(r"    \vspace{4mm}")
    out(f"    \\hspace{{4mm}}{{\\textcolor{{HeaderContact}}{{{city}}}}}\\;")
    out(r"    {\textcolor{HeaderSep}{|}}\;")
    out(f"    {{\\textcolor{{HeaderContact}}{{{phone}}}}}\\;")
    out(r"    {\textcolor{HeaderSep}{|}}\;")
    out(f"    {{\\textcolor{{HeaderContact}}{{{email}}}}}")
    out(r"    \vspace{6mm}")
    out(r"  \end{minipage}%")
    out(r"}")
    out()
    out(r"\vspace{8mm}")
    out()

    # ── DATE ──────────────────────────────────────────────────────────────────
    out(f"\\noindent\\textcolor{{LiteTxt}}{{\\textit{{{date}}}}}")
    out()
    out(r"\vspace{6mm}")
    out()

    # ── SUBJECT ───────────────────────────────────────────────────────────────
    out(f"\\noindent\\textcolor{{MidTxt}}{{\\textbf{{Re: }}}}\\textcolor{{DKGreen}}{{\\textbf{{{subject}}}}}")
    out(r"\vspace{2pt}")
    out(r"{\color{BorderClr}\hrule height 0.8pt}")
    out()
    out(r"\vspace{8mm}")
    out()

    # ── BODY ──────────────────────────────────────────────────────────────────
    out(r"\setlength{\parskip}{8pt}")
    out(f"\\noindent\\textcolor{{MidTxt}}{{{latex_body}}}")
    out()
    out(r"\vspace{10mm}")
    out(r"\clrule")
    out()

    # ── CLOSING ───────────────────────────────────────────────────────────────
    out(r"\noindent\textcolor{LiteTxt}{\textit{Yours sincerely,}}")
    out()
    out(r"\vspace{12mm}")
    out()

    # ── SIGNATURE (optional) ──────────────────────────────────────────────────
    if signature_path:
        out(f"\\noindent\\includegraphics[height=18mm]{{{e(signature_path)}}}\\par")
        out(r"\vspace{4mm}")
        out()

    # ── NAME ──────────────────────────────────────────────────────────────────
    out(f"\\noindent{{\\large\\textcolor{{DKGreen}}{{\\textbf{{{name}}}}}}}\\par")
    out(r"\vspace{1pt}")
    out(f"\\noindent\\textcolor{{LiteTxt}}{{\\textit{{{title}}}}}")
    out()
    out(r"\end{document}")

    return "\n".join(lines)


# =============================================================================
# COMPILE
# =============================================================================

def compile_latex(tex_source: str, output_pdf_path: str, extra_files: dict = None) -> str:
    """
    Compile tex_source to PDF via xelatex.
    extra_files: dict of {filename: bytes} written to the temp dir before
    compilation (used to embed signature images via \\includegraphics).
    """
    if shutil.which("xelatex") is None:
        raise RuntimeError(
            "xelatex not found. Install it with:\n"
            "  Windows: https://miktex.org/download\n"
            "  Linux:   sudo apt install texlive-xetex texlive-fonts-recommended texlive-latex-extra\n"
            "Then restart the Flask server."
        )

    # Wipe and recreate temp dir
    if os.path.exists(TMP_DIR):
        shutil.rmtree(TMP_DIR)
    os.makedirs(TMP_DIR)

    # Write extra files (e.g. signature image) to temp dir
    if extra_files:
        for fname, fbytes in extra_files.items():
            with open(os.path.join(TMP_DIR, fname), "wb") as f:
                f.write(fbytes)

    tex_path = os.path.join(TMP_DIR, "cover_letter.tex")
    pdf_path = os.path.join(TMP_DIR, "cover_letter.pdf")

    with open(tex_path, "w", encoding="utf-8") as f:
        f.write(tex_source)

    # Save debug copy
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    debug_path = os.path.join(OUTPUT_DIR, "debug_last_cover_letter.tex")
    with open(debug_path, "w", encoding="utf-8") as f:
        f.write(tex_source)

    xelatex_cmd = [
        "xelatex",
        "-interaction=nonstopmode",
        "-output-directory", TMP_DIR,
        tex_path,
    ]

    for pass_num in range(1, 3):
        result = subprocess.run(
            xelatex_cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=TMP_DIR,
        )
        if result.returncode != 0 and pass_num == 2:
            log_lines   = result.stdout.splitlines()
            error_lines = [l for l in log_lines if l.startswith("!")]
            error_msg   = error_lines[0] if error_lines else result.stdout[-800:]
            raise RuntimeError(f"xelatex compilation failed: {error_msg}")

    if not os.path.exists(pdf_path):
        raise RuntimeError("xelatex ran but no PDF was produced.")

    shutil.copy(pdf_path, output_pdf_path)
    return output_pdf_path


# =============================================================================
# PUBLIC ENTRY POINTS  (same API as before — app.py needs no changes)
# =============================================================================

def generate_cover_letter_pdf(profile: dict, cover_letter_text: str, job_title: str = "") -> str:
    """
    Generate a PDF cover letter.
    Called by: app.py → /api/download-cover-letter-pdf
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    personal = profile.get("personalInfo", {})

    # ── Signature image ───────────────────────────────────────────────────────
    extra_files    = {}
    signature_path = ""
    raw_sig        = personal.get("signature", "")

    if raw_sig and "base64," in raw_sig:
        try:
            b64_data  = raw_sig.split("base64,")[1]
            img_bytes = base64.b64decode(b64_data)
            sig_fname = "signature.png"
            extra_files[sig_fname] = img_bytes
            signature_path = sig_fname
        except Exception:
            signature_path = ""

    tex_src     = build_cover_letter_tex(profile, cover_letter_text, job_title, signature_path)
    output_path = os.path.join(OUTPUT_DIR, "generated_cover_letter.pdf")
    compile_latex(tex_src, output_path, extra_files=extra_files or None)

    return output_path


def generate_cover_letter_tex(profile: dict, cover_letter_text: str, job_title: str = "") -> str:
    """
    Render cover letter .tex without compiling (for Overleaf upload).
    Called by: app.py → /api/download-cover-letter-tex
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    tex_src    = build_cover_letter_tex(profile, cover_letter_text, job_title, signature_path="")
    tex_output = os.path.join(OUTPUT_DIR, "generated_cover_letter.tex")
    with open(tex_output, "w", encoding="utf-8") as f:
        f.write(tex_src)

    return tex_output
