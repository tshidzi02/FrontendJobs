# =============================================================================
# FILE: backend/services/cover_letter_docx.py
# =============================================================================

from docxtpl import DocxTemplate, RichText, InlineImage
from docx.shared import Cm
from datetime import datetime
import os
import base64
import tempfile


def generate_cover_letter_docx(profile, cover_letter_text, job_title=""):

    BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(BASE_DIR, "templates_cv", "cover_letter_template.docx")
    output_dir    = os.path.join(BASE_DIR, "generated_files")
    output_path   = os.path.join(output_dir, "generated_cover_letter.docx")

    # ── Ensure output directory exists ───────────────────────────────────────
    # cv_generator.py creates this same folder — but if it doesn't exist yet,
    # doc.save() will crash with FileNotFoundError.
    os.makedirs(output_dir, exist_ok=True)

    # ── Verify template exists ────────────────────────────────────────────────
    if not os.path.exists(template_path):
        raise FileNotFoundError(
            f"Cover letter template not found at: {template_path}\n"
            f"Make sure cover_letter_template.docx is in backend/services/templates_cv/"
        )

    doc = DocxTemplate(template_path)

    # ── Personal info ─────────────────────────────────────────────────────────
    personal        = profile.get("personalInfo", {})
    first_name      = personal.get("firstName", "")
    last_name       = personal.get("lastName", "")
    applicant_title = personal.get("jobTitle", "")
    city            = personal.get("city", "")
    phone           = personal.get("phone", "")
    email           = personal.get("email", "")

    # ── Date ──────────────────────────────────────────────────────────────────
    today = datetime.today().strftime("%d %B %Y")

    # ── Cover letter body ─────────────────────────────────────────────────────
    # Split on double newlines → separate paragraphs.
    # \a inside RichText = paragraph break in the rendered docx.
    paragraphs = [p.strip() for p in cover_letter_text.split("\n\n") if p.strip()]
    body_rt = RichText()
    for i, para in enumerate(paragraphs):
        if i > 0:
            body_rt.add("\a")
        lines = para.split("\n")
        for j, line in enumerate(lines):
            if j > 0:
                body_rt.add("\a")
            body_rt.add(line)

    # ── Signature image ───────────────────────────────────────────────────────
    # IMPORTANT: When no signature is present, we must pass an EMPTY RichText
    # object — NOT an empty string "".
    #
    # WHY: The {{ PICTURE_OF_SIGNATURE }} placeholder sits inside a <w:r> run
    # in the XML. docxtpl substitutes the value as-is. If we pass "" (a Python
    # str), docxtpl tries to render it as a text run and may crash or output
    # the literal string. An empty RichText() renders as nothing — safe.
    #
    # If a signature IS present, InlineImage embeds it as a <w:drawing> element.

    signature_image    = RichText()   # empty = renders as blank, no crash
    signature_tmp_path = None
    raw_signature      = personal.get("signature", "")

    if raw_signature and "base64," in raw_signature:
        try:
            b64_data  = raw_signature.split("base64,")[1]
            img_bytes = base64.b64decode(b64_data)

            suffix = ".png"
            if "image/jpeg" in raw_signature or "image/jpg" in raw_signature:
                suffix = ".jpg"

            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            tmp.write(img_bytes)
            tmp.close()
            signature_tmp_path = tmp.name

            signature_image = InlineImage(doc, signature_tmp_path, width=Cm(4))

        except Exception as e:
            print(f"[cover_letter_docx] Signature embedding failed: {e}")
            signature_image = RichText()   # fall back to blank on any error

    # ── Build context ─────────────────────────────────────────────────────────
    context = {
        "NAME":                 first_name,
        "SURNAME":              last_name,
        "JOB_TITLE":            applicant_title,
        "CITY":                 city,
        "PHONE":                phone,
        "EMAIL":                email,
        "DATE":                 today,
        "SUBJECT":              "Application",
        "CV_COVER_LETTER":      body_rt,
        "PICTURE_OF_SIGNATURE": signature_image,
    }

    doc.render(context)
    doc.save(output_path)

    # ── Clean up temp signature file ──────────────────────────────────────────
    if signature_tmp_path and os.path.exists(signature_tmp_path):
        os.unlink(signature_tmp_path)

    return output_path