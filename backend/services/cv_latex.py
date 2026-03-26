# =============================================================================
# FILE: backend/services/cv_latex.py
# =============================================================================
# Builds the CV .tex source entirely in Python — no Jinja2, no template file.
# Matches cv_template.tex exactly:
#   - Centered header
#   - Solid \rule squares for language bar (not $\blacksquare$)
#   - \bullet (not $\bullet$) for location separators
#   - \newpage between Experience / Education / Projects / Languages
#   - multicols with \raggedcolumns for skills
# Public API: generate_cv_pdf() and generate_cv_tex()
# =============================================================================

import os
import shutil
import subprocess

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "generated_files")
TMP_DIR    = os.path.join(OUTPUT_DIR, "tmp_cv")


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
# CEFR HELPERS
# =============================================================================

CEFR_LABELS = [
    "", "Beginner (A1)", "Elementary (A2)", "Intermediate (B1)",
    "Upper-Intermediate (B2)", "Advanced (C1)", "Bilingual or Proficient (C2)",
]
CEFR_CODES = ["", "A1", "A2", "B1", "B2", "C1", "C2"]


# =============================================================================
# TEX BUILDER — pure Python, mirrors the template exactly
# =============================================================================

def build_cv_tex(profile: dict, ai_result: dict) -> str:

    personal   = profile.get("personalInfo", {})
    education  = ai_result.get("education",         profile.get("education",  []))
    languages  = ai_result.get("languages",          profile.get("languages",  []))
    experience = ai_result.get("experience",         [])
    # "project_experience" = merged output from cv_generator.py (has url, tech_stack).
    # "projects"           = raw AI output from /api/generate (no url, uses "name" key).
    # profile projects     = source of truth for url — always fall back to them so
    #                        URLs are never lost when bulk-tex bypasses cv_generator.py.
    _ai_projects   = ai_result.get("project_experience") or ai_result.get("projects") or []
    _prof_projects = profile.get("projects", [])
    # Build a url + tech_stack lookup keyed by project title/name from profile
    _prof_by_name = {}
    for _p in _prof_projects:
        if isinstance(_p, dict):
            _key = (_p.get("name") or _p.get("title") or "").strip().lower()
            if _key:
                _prof_by_name[_key] = _p
    # Merge: use AI bullets/tech but pull urls from profile when AI entry lacks them
    _merged = []
    for _ap in _ai_projects:
        if not isinstance(_ap, dict):
            continue
        _title = (_ap.get("title") or _ap.get("name") or "").strip()
        _pp    = _prof_by_name.get(_title.lower(), {})

        # Resolve urls: new array format, then legacy single url, then profile fallback
        def _resolve_urls(src_dict, fallback_dict):
            raw = src_dict.get("urls")
            if raw and isinstance(raw, list) and any(raw):
                return [u for u in raw if isinstance(u, str) and u.strip()]
            if src_dict.get("url"):
                return [src_dict["url"]]
            raw2 = fallback_dict.get("urls")
            if raw2 and isinstance(raw2, list) and any(raw2):
                return [u for u in raw2 if isinstance(u, str) and u.strip()]
            if fallback_dict.get("url"):
                return [fallback_dict["url"]]
            return []

        _merged.append({
            "title":      _title,
            "urls":       _resolve_urls(_ap, _pp),
            "tech_stack": _ap.get("tech_stack") or _ap.get("technologies") or _pp.get("technologies") or _pp.get("tech_stack", ""),
            "bullets":    _ap.get("bullets", []),
        })
    # If AI returned nothing but profile has projects, use profile projects directly
    if not _merged and _prof_projects:
        def _prof_urls(p):
            raw = p.get("urls")
            if raw and isinstance(raw, list) and any(raw):
                return [u for u in raw if isinstance(u, str) and u.strip()]
            if p.get("url"):
                return [p["url"]]
            return []
        _merged = [
            {
                "title":      _p.get("name") or _p.get("title", ""),
                "urls":       _prof_urls(_p),
                "tech_stack": _p.get("technologies") or _p.get("tech_stack", ""),
                "bullets":    _p.get("bullets", []),
            }
            for _p in _prof_projects
            if isinstance(_p, dict) and _p.get("includeInCV", True)
        ]
    projects = _merged
    skills     = ai_result.get("skills",             [])
    references = ai_result.get("REFERENCE",          profile.get("references", "Available upon Request"))
    summary    = ai_result.get("SUMMARY", "")

    lines = []
    def out(s=""):
        lines.append(s)

    # ── PREAMBLE ──────────────────────────────────────────────────────────────
    out(r"\documentclass[11pt, a4paper]{article}")
    out()
    out(r"\usepackage[a4paper, top=8mm, left=14mm, right=14mm, bottom=10mm]{geometry}")
    out(r"\usepackage{xcolor}")
    out(r"\usepackage{fontspec}")
    out(r"\usepackage{enumitem}")
    out(r"\usepackage{tabularx}")
    out(r"\usepackage{parskip}")
    out(r"\usepackage{microtype}")
    out(r"\usepackage{hyperref}")
    out(r"\usepackage{mdframed}")
    out(r"\usepackage{multicol}")
    out(r"\usepackage{graphicx}")
    out()
    out(r"\definecolor{DKGreen}{HTML}{2D5016}")
    out(r"\definecolor{MDGreen}{HTML}{4A7C2F}")
    out(r"\definecolor{CardBG}{HTML}{F5F3EE}")
    out(r"\definecolor{HeaderBG}{HTML}{2D5016}")
    out(r"\definecolor{BorderClr}{HTML}{C8D8B0}")
    out(r"\definecolor{DarkTxt}{HTML}{1A1A1A}")
    out(r"\definecolor{MidTxt}{HTML}{3C3C3C}")
    out(r"\definecolor{LiteTxt}{HTML}{7A7A6E}")
    out(r"\definecolor{AccentGreen}{HTML}{5A8A35}")
    out(r"\definecolor{PageBG}{HTML}{FAF8F3}")
    out(r"\definecolor{HeaderLight}{HTML}{A8CC80}")
    out(r"\definecolor{HeaderContact}{HTML}{D0E8B0}")
    out(r"\definecolor{HeaderSep}{HTML}{6A9A50}")
    out()
    out(r"\setmainfont{Arial}[Ligatures=TeX]")
    out(r"\hypersetup{colorlinks=true, urlcolor=MDGreen, linkcolor=DKGreen}")
    out(r"\pagecolor{PageBG}")
    out(r"\pagestyle{empty}")
    out()
    out(r"\setlist[itemize]{")
    out(r"  label={\textcolor{DKGreen}{$\rightarrow$}},")
    out(r"  leftmargin=1.4em, itemsep=2pt, topsep=3pt, parsep=0pt")
    out(r"}")
    out()
    # cvsection
    out(r"\newcommand{\cvsection}[1]{%")
    out(r"  \vspace{6pt}%")
    out(r"  \noindent%")
    out(r"  \colorbox{DKGreen}{\hspace{4pt}\rule{0pt}{14pt}\hspace{4pt}}%")
    out(r"  \colorbox{CardBG}{%")
    out(r"    \parbox[c][14pt]{\dimexpr\linewidth-16pt\relax}{%")
    out(r"      \hspace{8pt}\textcolor{DKGreen}{\textbf{\large\MakeUppercase{#1}}}%")
    out(r"    }%")
    out(r"  }%")
    out(r"  \par")
    out(r"  \noindent{\color{BorderClr}\rule{\linewidth}{0.6pt}}%")
    out(r"  \vspace{4pt}\par\noindent%")
    out(r"}")
    out()
    # skillcard
    out(r"\newcommand{\skillcard}[2]{%")
    out(r"  \begin{mdframed}[")
    out(r"    linecolor=BorderClr, linewidth=0.6pt,")
    out(r"    leftline=true, rightline=true, topline=true, bottomline=true,")
    out(r"    innerleftmargin=7pt, innerrightmargin=6pt,")
    out(r"    innertopmargin=5pt,  innerbottommargin=5pt,")
    out(r"    backgroundcolor=white,")
    out(r"    leftmargin=0pt, rightmargin=0pt,")
    out(r"    skipabove=4pt,  skipbelow=4pt,")
    out(r"  ]%")
    out(r"  \textcolor{DKGreen}{\textbf{#1}}\\[2pt]%")
    out(r"  {\small\textcolor{LiteTxt}{#2}}%")
    out(r"  \end{mdframed}%")
    out(r"}")
    out()
    # language bar — solid \rule squares (matches updated template)
    out(r"\newcommand{\sqon}{\textcolor{DKGreen}{\rule{8pt}{8pt}}\,}")
    out(r"\newcommand{\sqoff}{\textcolor{BorderClr}{\rule{8pt}{8pt}}\,}")
    out(r"\newcommand{\langbar}[1]{%")
    out(r"  \ifnum#1>0\sqon\else\sqoff\fi%")
    out(r"  \ifnum#1>1\sqon\else\sqoff\fi%")
    out(r"  \ifnum#1>2\sqon\else\sqoff\fi%")
    out(r"  \ifnum#1>3\sqon\else\sqoff\fi%")
    out(r"  \ifnum#1>4\sqon\else\sqoff\fi%")
    out(r"  \ifnum#1>5\sqon\else\sqoff\fi%")
    out(r"}")
    out()
    # sectionrule
    out(r"\newcommand{\sectionrule}{%")
    out(r"  \vspace{2pt}{\color{BorderClr}\rule{\linewidth}{0.6pt}}\vspace{4pt}%")
    out(r"}")
    out()
    out(r"\begin{document}")
    out()



    # ── HEADER (centered) ─────────────────────────────────────────────────────
    name  = f"{e(personal.get('firstName',''))} {e(personal.get('lastName',''))}".strip()
    title = e(personal.get("jobTitle", ""))
    city  = e(personal.get("city",     ""))
    phone = e(personal.get("phone",    ""))
    email = e(personal.get("email",    ""))
    github  = e(personal.get("github",   ""))
    

    out(r"\noindent\hspace{-6mm}%")
    out(r"\colorbox{HeaderBG}{%")
    out(r"  \begin{minipage}{\dimexpr\linewidth+12mm\relax}%")
    out(r"  \begin{center}")
    out(r"    \vspace{5mm}%")
    out(r"    \hspace{5mm}{\fontsize{28}{32}\selectfont%")
    out(f"      \\textcolor{{white}}{{\\textbf{{{name}}}}}}}%")
    out(r"    \par\vspace{2mm}%")
    out(f"    \\hspace{{5mm}}{{\\large\\textcolor{{HeaderLight}}{{\\textit{{{title}}}}}}}%")
    out(r"    \par\vspace{3mm}%")
    out(r"    \hspace{5mm}%")
    out(f"    \\textcolor{{HeaderContact}}{{{city}}}\\;%")
    out(r"    \textcolor{HeaderSep}{\vert}\;%")
    out(f"    \\textcolor{{HeaderContact}}{{{phone}}}\\;%")
    out(r"    \textcolor{HeaderSep}{\vert}\;%")
    out(f"    \\textcolor{{HeaderContact}}{{{email}}}%")
    out(r"    \textcolor{HeaderSep}{\vert}\;%")
    out(f"    \\href{{{github}}}{{\\textcolor{{HeaderContact}}{{{github}}}}}%")
    out(r"    \par\vspace{5mm}%")
    out(r"    \end{center}")
    out(r"  \end{minipage}%")
    out(r"}")
    out()
    out(r"\vspace{4mm}")
    out()

    # ── PROFESSIONAL SUMMARY ──────────────────────────────────────────────────
    out(r"\cvsection{Professional Summary}")
    out(r"\vspace{4pt}")
    out(f"\\noindent\\textcolor{{MidTxt}}{{{e(summary)}}}")
    out()

    # ── SKILLS ────────────────────────────────────────────────────────────────
    if skills:
        out(r"\cvsection{Skills}")
        out()
        for cat in skills:
            if not isinstance(cat, dict):
                continue
            cat_name    = e(cat.get("category", ""))
            skills_list = cat.get("skills_list", [])
            out(r"\vspace{6pt}")
            out(f"\\noindent{{\\textcolor{{AccentGreen}}{{\\textbf{{\\MakeUppercase{{{cat_name}}}}}}}}}")
            out(r"\sectionrule")
            out(r"\begin{multicols}{2}")
            out(r"\raggedcolumns")
            for s in skills_list:
                if isinstance(s, dict):
                    sname = e(s.get("skill", ""))
                    sdesc = e(s.get("description", ""))
                elif isinstance(s, str):
                    sname = e(s)
                    sdesc = ""
                else:
                    continue
                out(f"\\skillcard{{{sname}}}{{{sdesc}}}")
            out()
            out(r"\end{multicols}")
            out(r"\vspace{4pt}")
            out(r"\vspace{6pt}")
            out()
        out(r"\newpage")
        out()

    # ── EXPERIENCE ────────────────────────────────────────────────────────────
    if experience:
        out(r"\cvsection{Experience}")
        out()
        for exp in experience:
            if not isinstance(exp, dict):
                continue
            role     = e(exp.get("role", ""))
            company  = e(exp.get("company", ""))
            location = e(exp.get("location") or ", ".join(filter(None, [exp.get("city",""), exp.get("country","")])))
            start    = e(str(exp.get("startYear", "")))
            end      = e(str(exp.get("endYear",   "")))
            bullets  = [e(b) for b in exp.get("bullets", []) if isinstance(b, str)]

            out(r"\vspace{6pt}")
            out(r"\noindent")
            out(r"\begin{tabularx}{\linewidth}{Xr}")
            out(f"  \\textcolor{{DarkTxt}}{{\\textbf{{\\large {role}}}}} &")
            out(f"  \\textcolor{{LiteTxt}}{{\\textit{{{start} -- {end}}}}} \\\\")
            out(r"\end{tabularx}%")
            out(r"{\color{DKGreen}\rule{\linewidth}{0.8pt}}%")
            out(r"\vspace{2pt}")
            out(f"\\noindent\\textcolor{{MDGreen}}{{\\textbf{{{company}}}}}\\;%")
            out(f"\\textcolor{{LiteTxt}}{{\\bullet\\; {location}}}")
            out(r"\vspace{3pt}")
            if bullets:
                out(r"\begin{itemize}")
                for b in bullets:
                    out(f"  \\item\\textcolor{{MidTxt}}{{{b}}}")
                out(r"\end{itemize}")
            out(r"\vspace{2pt}")
            out()
        out(r"\newpage")
        out()

    # ── EDUCATION ─────────────────────────────────────────────────────────────
    if education:
        out(r"\cvsection{Education}")
        out()
        for edu in education:
            if not isinstance(edu, dict):
                continue
            degree      = e(edu.get("degree", ""))
            institution = e(edu.get("institution", ""))
            edu_city    = e(edu.get("city", ""))
            edu_country = e(edu.get("country", ""))
            grad_month  = e(edu.get("graduationMonth", ""))
            grad_year   = e(str(edu.get("graduationYear", edu.get("expected", ""))))
            minimum     = e(str(edu.get("minimumAverage", "")))
            coursework  = [e(c) for c in edu.get("coursework", []) if isinstance(c, str) and c.strip()]

            out(r"\vspace{6pt}")
            out(f"\\noindent\\textcolor{{DarkTxt}}{{\\textbf{{\\large {degree}}}}}\\par")
            out(r"\vspace{2pt}")
            out(f"\\noindent\\textcolor{{MDGreen}}{{\\textbf{{{institution}}}}}\\;%")
            out(r"\newline")
            out(f"\\textcolor{{LiteTxt}}{{\\bullet\\; {edu_city}, {edu_country}}}\\par")
            out(r"\vspace{1pt}")
            out(f"\\noindent\\textcolor{{LiteTxt}}{{\\textit{{{grad_month} {grad_year}}}}}")
            out(r"\vspace{2pt}")
            if minimum:
                out(r"\newline")
                out(f"\\noindent\\textcolor{{MidTxt}}{{\\textbf{{Minimum Average:}}}}\\;%")
                out(f"\\textcolor{{DKGreen}}{{{minimum}}}")
                out(r"\vspace{3pt}")
            if coursework:
                out(r"\newline")
                out(r"\noindent\textcolor{DKGreen}{\textbf{Relevant Coursework:}}")
                out(r"\sectionrule")
                out(r"\begin{itemize}")
                for c in coursework:
                    out(f"  \\item \\textcolor{{MidTxt}}{{{c}}}")
                out(r"\end{itemize}")
            out(r"\vspace{2pt}")
            out()
        out(r"\newpage")
        out()

    # ── PROJECTS ──────────────────────────────────────────────────────────────
    if projects:
        out(r"\cvsection{Project Experience}")
        out()
        for proj in projects:
            if not isinstance(proj, dict):
                continue
            ptitle     = e(proj.get("title", proj.get("name", "")))
            # Support both new `urls` (array) and legacy `url` (string)
            raw_urls   = proj.get("urls") or ([proj["url"]] if proj.get("url") else [])
            urls_clean = [u.strip() for u in raw_urls if isinstance(u, str) and u.strip()]
            tech_stack = e(proj.get("tech_stack", proj.get("technologies", "")))
            bullets    = [e(b) for b in proj.get("bullets", []) if isinstance(b, str)]

            out(r"\vspace{8pt}")
            out(r"\noindent%")
            out(r"{\color{DKGreen}\rule{4pt}{14pt}}\hspace{6pt}%")
            out(f"\\textcolor{{DarkTxt}}{{\\textbf{{\\large {ptitle}}}}}\\par")
            out(r"\vspace{1pt}")
            for url_raw in urls_clean:
                url_display = e(url_raw)
                out(f"\\noindent\\hspace{{10pt}}\\href{{{url_raw}}}{{\\textcolor{{MDGreen}}{{\\small {url_display}}}}}\\par")
            if tech_stack:
                out(f"\\noindent\\hspace{{10pt}}\\textcolor{{DKGreen}}{{\\textbf{{\\small {tech_stack}}}}}")
            out(r"\vspace{2pt}")
            if bullets:
                out(r"\begin{itemize}")
                for b in bullets:
                    out(f"  \\item \\textcolor{{MidTxt}}{{{b}}}")
                out(r"\end{itemize}")
            out(r"\vspace{2pt}")
            out()
        out(r"\newpage")
        out()

    # ── LANGUAGES ─────────────────────────────────────────────────────────────
    if languages:
        out(r"\cvsection{Languages}")
        out()
        out(r"\vspace{4pt}")
        out(r"\noindent")
        for i, lang in enumerate(languages, start=1):
            if not isinstance(lang, dict):
                continue
            raw_level  = lang.get("level", 3)
            level      = max(1, min(6, int(raw_level) if str(raw_level).isdigit() else 3))
            lang_name  = e(lang.get("name", ""))
            level_code = CEFR_CODES[level]
            level_full = CEFR_LABELS[level]

            out(r"\begin{minipage}[t]{0.30\linewidth}")
            out(f"\\noindent\\textcolor{{DKGreen}}{{\\textbf{{{lang_name}}}}}%")
            out(f"\\hfill\\textcolor{{LiteTxt}}{{\\small {level_code}}}\\par")
            out(r"\vspace{2pt}%")
            out(f"\\langbar{{{level}}}\\par")
            out(r"\vspace{1pt}%")
            out(f"\\textcolor{{LiteTxt}}{{\\textit{{\\small {level_full}}}}}")
            out()
            out(r"\end{minipage}%")
            if i % 3 == 0:
                out(r"\par\vspace{6pt}\noindent")
            else:
                out(r"\hfill")
        out()

    # ── REFERENCE ─────────────────────────────────────────────────────────────
    out(r"\cvsection{Reference}")
    out()
    out(r"\vspace{4pt}")
    out(f"\\noindent\\textcolor{{LiteTxt}}{{\\textit{{{e(references)}}}}}")
    out()
    out(r"\end{document}")

    return "\n".join(lines)


# =============================================================================
# COMPILE
# =============================================================================

def compile_latex(tex_source: str, output_pdf_path: str) -> str:
    if shutil.which("xelatex") is None:
        raise RuntimeError(
            "xelatex not found. Install it with:\n"
            "  Windows: https://miktex.org/download\n"
            "  Linux:   sudo apt install texlive-xetex texlive-fonts-recommended texlive-latex-extra\n"
            "Then restart the Flask server."
        )

    os.makedirs(TMP_DIR, exist_ok=True)
    for stale in ["cv.tex", "cv.aux", "cv.log", "cv.out", "cv.pdf"]:
        try:
            stale_path = os.path.join(TMP_DIR, stale)
            if os.path.exists(stale_path):
                os.remove(stale_path)
        except OSError:
            pass

    tex_path = os.path.join(TMP_DIR, "cv.tex")
    pdf_path = os.path.join(TMP_DIR, "cv.pdf")

    with open(tex_path, "w", encoding="utf-8") as f:
        f.write(tex_source)

    # Debug copy — open this if compilation fails
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(os.path.join(OUTPUT_DIR, "debug_last_render.tex"), "w", encoding="utf-8") as f:
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
# PUBLIC ENTRY POINTS
# =============================================================================

def generate_cv_pdf(profile: dict, ai_result: dict) -> str:
    """Generate a PDF CV. Called by app.py → /api/download-cv-pdf"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    tex_src     = build_cv_tex(profile, ai_result)
    output_path = os.path.join(OUTPUT_DIR, "generated_cv.pdf")
    compile_latex(tex_src, output_path)
    return output_path


def generate_cv_tex(profile: dict, ai_result: dict) -> str:
    """Render .tex for Overleaf upload. Called by app.py → /api/download-cv-tex"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    tex_src    = build_cv_tex(profile, ai_result)
    tex_output = os.path.join(OUTPUT_DIR, "generated_cv.tex")
    with open(tex_output, "w", encoding="utf-8") as f:
        f.write(tex_src)
    return tex_output