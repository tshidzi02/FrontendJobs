
// =============================================================================
// FILE: frontend/src/pages/CoverLetter.jsx  (UPDATED — Lesson 4.1 Signature)
// =============================================================================
// WHAT'S NEW:
//   ✅ Signature panel — upload PNG/JPG directly from this page
//   ✅ Signature is saved back to the user's profile via POST /api/profile
//   ✅ Shows preview of current signature, Replace and Remove buttons
//   ✅ Appears at the bottom of the page above the history section
//
// DESIGN DECISION — why save signature here and not just link to Profile?
//   The user might arrive at Cover Letter ready to download, then realise
//   they haven't uploaded a signature yet. Making them navigate away to Profile,
//   save, come back, and re-generate is a friction point. Embedding the upload
//   here means they can do it inline without losing their generated letter.
//   The signature is still stored in personalInfo.signature in the profile —
//   exactly the same field the docx generator reads. No duplication.
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";


// ── TONE OPTIONS ──────────────────────────────────────────────────────────────
// Each option has a value (sent to backend), label (shown in UI), and a short
// description so the user understands the difference.
const TONE_OPTIONS = [
  {
    value: "professional",
    label: "Professional",
    description: "Confident and formal. Demonstrates expertise without exclamation marks.",
  },
  {
    value: "enthusiastic",
    label: "Enthusiastic",
    description: "Warm and energetic. Shows genuine excitement about the role.",
  },
  {
    value: "concise",
    label: "Concise",
    description: "Short and punchy. 3 paragraphs max. Every sentence earns its place.",
  },
];


// ── HELPER: format ISO timestamp ──────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}


export default function CoverLetter() {

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone]                     = useState("professional");
  const [result, setResult]                 = useState("");
  // result: the generated cover letter plain text. Empty string = not generated yet.

  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");

  const [copied, setCopied]                 = useState(false);
  // copied: true for 2 seconds after clipboard copy — shows "✓ Copied!" flash.

  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [saveError, setSaveError]           = useState("");
  const [downloadError, setDownloadError]   = useState("");
  // downloadError: shown on screen when .docx download fails — surfaces the real error message.

  const [hasProfile, setHasProfile]         = useState(null);
  // null = not checked yet, true = profile exists, false = no profile saved.
  // Used to show a warning when no profile is saved.

  const [history, setHistory]               = useState([]);
  // history: array of saved cover letters from GET /api/cover-letter/saved
  // Each item: { id, job_title, tone, cover_letter, preview, created_at }

  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId]         = useState(null);
  // expandedId: the id of the history card currently showing full text.
  // null = all collapsed. Click a card to expand it.

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId]           = useState(null);

  // ── SIGNATURE STATE ───────────────────────────────────────────────────────
  const fileInputRef                        = useRef(null);
  const [signature, setSignature]           = useState("");
  // signature: base64 data URL from the user's profile, e.g. "data:image/png;base64,..."
  // Empty string = no signature saved yet.
  const [fullProfile, setFullProfile]       = useState(null);
  // fullProfile: the entire profile object — needed so we can POST the full
  // profile back when saving just the signature field.
  const [signatureError, setSigError]       = useState("");
  const [sigSaving, setSigSaving]           = useState(false);
  const [sigSaved, setSigSaved]             = useState(false);

  const navigate = useNavigate();


  // ── LOAD PROFILE + HISTORY ON MOUNT ──────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Load full profile so we can (a) check it exists, (b) read the signature,
      // and (c) POST it back with an updated signature without losing other fields.
      try {
        const res = await api.get("/profile");
        const data = res.data;
        const exists = data && Object.keys(data).length > 0;
        setHasProfile(exists);
        if (exists) {
          setFullProfile(data);
          setSignature(data.personalInfo?.signature || "");
        }
      } catch {
        setHasProfile(false);
      }

      // Load saved cover letter history
      try {
        const res = await api.get("/cover-letter/saved");
        setHistory(res.data);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        }
      } finally {
        setHistoryLoading(false);
      }
    };

    init();
  }, [navigate]);


  // ── GENERATE HANDLER ──────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      setError("Please paste a job description before generating.");
      return;
    }

    setError("");
    setLoading(true);
    setResult("");
    setSaved(false);
    setSaveError("");

    try {
      const response = await api.post("/cover-letter", {
        jobDescription,
        tone,
      });
      // The backend loads the profile from DB — we only send the JD and tone.

      setResult(response.data.cover_letter || "");

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setError("Generation failed. Make sure the backend server is running.");
      }
    } finally {
      setLoading(false);
    }
  };


  // ── COPY HANDLER ──────────────────────────────────────────────────────────
  const handleCopy = (text) => {
    // text param: allows copying from either the live result or a history card.
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  // ── DOWNLOAD .DOCX HANDLER ───────────────────────────────────────────────
  // =============================================================================
// PATCH for frontend/src/pages/CoverLetter.jsx
// =============================================================================
// REPLACE the existing handleDownload function with this one.
//
// CHANGE: Replaces raw fetch() with hardcoded URL with the api axios instance.
//   Before: fetch("http://127.0.0.1:5000/api/download-cover-letter", ...)
//           → breaks in production, duplicates auth token logic
//   After:  api.post("/download-cover-letter", ..., { responseType: "blob" })
//           → uses VITE_API_URL env variable, token attached automatically
//           → consistent with every other download in the app
// =============================================================================

  const handleDownload = async (text, jobTitleStr = "Cover_Letter") => {
    setDownloadError("");
    try {
      const response = await api.post(
        "/download-cover-letter",
        { cover_letter: text, job_title: jobTitleStr },
        { responseType: "blob" }
      );

      const blob = response.data;
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;

      const safeName = jobTitleStr.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
      link.download  = `${safeName}_Cover_Letter.docx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setDownloadError("Download failed. Make sure the backend is running.");
      }
    }
  };


  // ── SAVE HANDLER ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!result) return;

    setSaving(true);
    setSaveError("");

    // Extract job title from the first non-empty line of the job description.
    const jobTitle = jobDescription.trim().split("\n").find(l => l.trim()) || "Untitled Role";

    try {
      await api.post("/cover-letter/save", {
        cover_letter: result,
        job_title:    jobTitle.slice(0, 120),
        tone,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // Refresh history list so the new entry appears immediately.
      const res = await api.get("/cover-letter/saved");
      setHistory(res.data);

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setSaveError("Could not save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };


  // ── DELETE HISTORY ITEM ───────────────────────────────────────────────────
  const handleDelete = async (clId) => {
    setDeletingId(clId);
    setConfirmDeleteId(null);
    try {
      await api.delete(`/cover-letter/${clId}`);
      setHistory(prev => prev.filter(cl => cl.id !== clId));
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } finally {
      setDeletingId(null);
    }
  };


  // ── SIGNATURE HANDLERS ────────────────────────────────────────────────────
  const handleSignatureUpload = (e) => {
    setSigError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      setSigError("Only PNG or JPEG images are accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSigError("Image must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setSignature(event.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveSignature = () => {
    setSignature("");
    setSigError("");
    setSigSaved(false);
  };

  const handleSaveSignature = async () => {
    // Merge the new signature into the full profile and POST it back.
    // This updates only personalInfo.signature — all other fields are unchanged.
    if (!fullProfile) return;
    setSigSaving(true);
    setSigError("");
    try {
      const updated = {
        ...fullProfile,
        personalInfo: { ...fullProfile.personalInfo, signature },
      };
      await api.post("/profile", updated);
      setFullProfile(updated);
      setSigSaved(true);
      setTimeout(() => setSigSaved(false), 3000);
    } catch {
      setSigError("Could not save signature. Please try again.");
    } finally {
      setSigSaving(false);
    }
  };


  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(1000px, 100%)", margin: "0 auto" }}>

        {/* ── PAGE HEADER ──────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontFamily: "'Libre Baskerville', serif",
            fontSize: "clamp(20px, 4vw, 32px)", color: "#2D5A3D",
            letterSpacing: "2px", marginBottom: "6px",
          }}>
            Cover Letter
          </h1>
          <p style={{ color: "#1E2018", opacity: 0.5, fontSize: "13px" }}>
            Generate a tailored cover letter from your profile and a job description.
          </p>
        </div>


        {/* ── NO PROFILE WARNING ───────────────────────── */}
        {hasProfile === false && (
          <div style={{
            background: "rgba(255,179,71,0.08)",
            border: "1px solid rgba(255,179,71,0.35)",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px",
          }}>
            <span style={{ fontSize: "18px" }}>⚠</span>
            <p style={{ color: "#FFB347", fontSize: "13px", margin: 0 }}>
              No profile saved yet — the cover letter will be less personalised.{" "}
              <span
                onClick={() => navigate("/profile")}
                style={{ textDecoration: "underline", cursor: "pointer" }}
              >
                Set up your profile
              </span>{" "}
              to get better results.
            </p>
          </div>
        )}


        {/* ══ INPUT CARD ════════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "24px" }}>

          {/* Job Description */}
          <h3 style={{
            color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
            fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
            marginBottom: "14px", opacity: 0.8,
          }}>
            📋 Job Description
          </h3>

          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            rows={8}
            style={{
              width: "100%", background: "#FFFFFF",
              border: "1px solid rgba(45,90,61,0.2)", borderRadius: "8px",
              color: "#1E2018", padding: "14px", fontSize: "13px",
              lineHeight: "1.6", resize: "vertical",
              fontFamily: "system-ui, sans-serif", marginBottom: "20px",
            }}
          />

          {/* Tone Selector */}
          <h3 style={{
            color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
            fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
            marginBottom: "12px", opacity: 0.8,
          }}>
            🎨 Tone
          </h3>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
            {TONE_OPTIONS.map((option) => {
              const isSelected = tone === option.value;
              return (
                <div
                  key={option.value}
                  onClick={() => setTone(option.value)}
                  style={{
                    flex: 1, minWidth: "140px",
                    background: isSelected ? "rgba(45,90,61,0.12)" : "rgba(0,0,0,0.2)",
                    border: isSelected
                      ? "1px solid rgba(45,90,61,0.6)"
                      : "1px solid rgba(45,90,61,0.15)",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <p style={{
                    color: isSelected ? "#2D5A3D" : "#1E2018",
                    fontFamily: "'Libre Baskerville', serif",
                    fontSize: "13px", marginBottom: "5px",
                    fontWeight: "900",
                  }}>
                    {isSelected ? "● " : "○ "}{option.label}
                  </p>
                  <p style={{
                    color: "#1E2018", fontSize: "11px",
                    opacity: 0.45, lineHeight: "1.5", margin: 0,
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    {option.description}
                  </p>
                </div>
              );
            })}
          </div>

          {error && (
            <p style={{ color: "#8B2020", fontSize: "13px", marginBottom: "12px" }}>{error}</p>
          )}

          {/* Generate Button */}
          <button
            className="primary-btn"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              fontSize: "15px", padding: "13px 36px",
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display: "inline-block", width: "14px", height: "14px",
                  border: "2px solid #2D5A3D", borderTopColor: "transparent",
                  borderRadius: "50%", animation: "spin 0.7s linear infinite",
                }} />
                Writing...
              </>
            ) : "✦ Generate Cover Letter"}
          </button>

          <style>{`
            @keyframes spin  { to { transform: rotate(360deg); } }
            @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
          `}</style>
        </div>


        {/* ══ LOADING SKELETON ════════════════════════════ */}
        {loading && (
          <div style={{
            background: "#F0EAD8", borderRadius: "12px", padding: "32px",
            marginBottom: "24px", border: "1px solid rgba(45,90,61,0.08)",
          }}>
            {[100, 95, 88, 92, 75, 85, 60].map((w, i) => (
              <div key={i} style={{
                height: "13px", background: "rgba(45,90,61,0.07)",
                borderRadius: "6px", marginBottom: "14px", width: `${w}%`,
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        )}


        {/* ══ RESULT PANEL ════════════════════════════════ */}
        {result && !loading && (
          <div className="card" style={{ maxWidth: "100%", marginBottom: "24px" }}>

            {/* Header row: title + character count */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: "12px",
              marginBottom: "20px",
            }}>
              <h3 style={{
                color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                opacity: 0.8, margin: 0,
              }}>
                ✉ Generated Cover Letter
              </h3>
              <span style={{
                color: "#1E2018", fontSize: "11px", opacity: 0.35,
                fontFamily: "'Libre Baskerville', serif",
              }}>
                {result.length} characters · {result.split(/\n\n+/).filter(p => p.trim()).length} paragraphs
              </span>
            </div>

            {/* Cover letter text — shown in a readable panel */}
            <div style={{
              background: "#FFFFFF",
              border: "1px solid rgba(45,90,61,0.1)",
              borderRadius: "10px",
              padding: "28px 32px",
              marginBottom: "24px",
              whiteSpace: "pre-wrap",
              // pre-wrap: preserves newlines from the plain text response
              // while still wrapping long lines. Essential for cover letter prose.
              color: "#1E2018",
              fontSize: "14px",
              lineHeight: "1.85",
              fontFamily: "system-ui, sans-serif",
            }}>
              {result}
            </div>

            {/* Action buttons row */}
            <div style={{
              display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-start",
            }}>

              {/* Copy */}
              <button
                className="primary-btn"
                onClick={() => handleCopy(result)}
                style={{
                  fontSize: "14px", padding: "11px 24px",
                  background: copied ? "#3D7A55" : "#2D5A3D",
                }}
              >
                {copied ? "✓ Copied!" : "⎘ Copy"}
              </button>

              {/* Download .txt */}
              <button
                onClick={() => handleDownload(result, jobDescription.split("\n")[0] || "Cover_Letter")}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(45,90,61,0.4)",
                  color: "#2D5A3D", padding: "11px 24px",
                  borderRadius: "6px", cursor: "pointer",
                  fontSize: "14px", fontFamily: "'Libre Baskerville', serif",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                ⬇ Download .docx
              </button>

              {downloadError && (
                <p style={{ color: "#8B2020", fontSize: "12px", marginTop: "6px", fontFamily: "system-ui, sans-serif" }}>
                  ⚠ {downloadError}
                </p>
              )}

              {/* Save */}
              <div>
                <button
                  className="primary-btn"
                  onClick={handleSave}
                  disabled={saving || saved}
                  style={{
                    fontSize: "14px", padding: "11px 24px",
                    background: saved ? "#3D7A55" : saving ? "#2D5A3D" : "#2D5A3D",
                    opacity: saving ? 0.75 : 1,
                    cursor: (saving || saved) ? "not-allowed" : "pointer",
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
                  }}
                >
                  {saving ? (
                    <>
                      <span style={{
                        display: "inline-block", width: "12px", height: "12px",
                        border: "2px solid #2D5A3D", borderTopColor: "transparent",
                        borderRadius: "50%", animation: "spin 0.7s linear infinite",
                      }} />
                      Saving...
                    </>
                  ) : saved ? "✓ Saved!" : "💾 Save"}
                </button>
                {saveError && (
                  <p style={{ color: "#8B2020", fontSize: "12px", marginTop: "6px" }}>
                    {saveError}
                  </p>
                )}
              </div>

            </div>
          </div>
        )}


        {/* ══ SIGNATURE PANEL ═════════════════════════════
            Lets the user upload a signature image without leaving this page.
            Saved directly to their profile so it's picked up on .docx download.
        ════════════════════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "24px" }}>
          <h3 style={{
            color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
            fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
            marginBottom: "6px", opacity: 0.8,
          }}>
            ✍ Signature
          </h3>
          <p style={{
            color: "#1E2018", fontSize: "13px", opacity: 0.45,
            marginBottom: "20px", lineHeight: "1.6",
            fontFamily: "system-ui, sans-serif",
          }}>
            Your signature appears at the bottom of the downloaded .docx cover letter.
            Upload a photo or scan — PNG or JPEG, max 2MB.
          </p>

          {/* Hidden native file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleSignatureUpload}
            style={{ display: "none" }}
          />

          {/* No signature — dashed upload zone */}
          {!signature && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed rgba(45,90,61,0.3)",
                borderRadius: "12px", padding: "36px 20px",
                textAlign: "center", cursor: "pointer",
                transition: "border-color 0.2s ease, background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#2D5A3D";
                e.currentTarget.style.background = "rgba(45,90,61,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(45,90,61,0.3)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>✍</div>
              <p style={{
                color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                fontSize: "14px", marginBottom: "4px",
              }}>
                Click to upload signature
              </p>
              <p style={{ color: "#1E2018", fontSize: "12px", opacity: 0.35, fontFamily: "system-ui, sans-serif" }}>
                PNG or JPEG · Max 2MB
              </p>
            </div>
          )}

          {/* Signature uploaded — preview + actions */}
          {signature && (
            <div>
              {/* White background so the sig is visible on any paper colour */}
              <div style={{
                background: "#ffffff", borderRadius: "10px",
                padding: "20px", marginBottom: "16px",
                display: "inline-block",
                border: "1px solid rgba(45,90,61,0.2)",
              }}>
                <img
                  src={signature}
                  alt="Signature preview"
                  style={{ maxWidth: "220px", maxHeight: "90px", display: "block", objectFit: "contain" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                {/* Save to profile */}
                <button
                  className="primary-btn"
                  onClick={handleSaveSignature}
                  disabled={sigSaving || sigSaved}
                  style={{
                    fontSize: "13px", padding: "10px 22px",
                    background: sigSaved ? "#3D7A55" : "#2D5A3D",
                    opacity: sigSaving ? 0.7 : 1,
                    cursor: (sigSaving || sigSaved) ? "not-allowed" : "pointer",
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: "7px",
                  }}
                >
                  {sigSaving ? (
                    <>
                      <span style={{
                        display: "inline-block", width: "11px", height: "11px",
                        border: "2px solid #2D5A3D", borderTopColor: "transparent",
                        borderRadius: "50%", animation: "spin 0.7s linear infinite",
                      }} />
                      Saving...
                    </>
                  ) : sigSaved ? "✓ Saved to profile" : "💾 Save to profile"}
                </button>

                {/* Replace */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(45,90,61,0.35)",
                    color: "#2D5A3D", padding: "10px 20px",
                    borderRadius: "6px", cursor: "pointer",
                    fontSize: "13px", fontFamily: "'Libre Baskerville', serif",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Replace
                </button>

                {/* Remove */}
                <button
                  onClick={handleRemoveSignature}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,107,107,0.3)",
                    color: "#8B2020", padding: "10px 20px",
                    borderRadius: "6px", cursor: "pointer",
                    fontSize: "13px", fontFamily: "'Libre Baskerville', serif",
                    opacity: 0.7, transition: "opacity 0.15s ease, background 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(255,107,107,0.07)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.background = "transparent"; }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {signatureError && (
            <p style={{ color: "#8B2020", fontSize: "13px", marginTop: "12px" }}>
              ⚠ {signatureError}
            </p>
          )}
        </div>


        {/* ══ SAVED HISTORY ═══════════════════════════════ */}
        <div style={{ marginBottom: "40px" }}>

          <h3 style={{
            color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
            fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
            marginBottom: "16px", opacity: 0.8,
          }}>
            🗂 Saved Cover Letters
            {history.length > 0 && (
              <span style={{
                marginLeft: "10px",
                background: "rgba(45,90,61,0.15)",
                border: "1px solid rgba(45,90,61,0.3)",
                color: "#2D5A3D", fontSize: "11px",
                padding: "2px 8px", borderRadius: "10px",
                fontFamily: "'Libre Baskerville', serif",
              }}>
                {history.length}
              </span>
            )}
          </h3>

          {/* Loading skeletons */}
          {historyLoading && (
            <div>
              {[1, 2].map(i => (
                <div key={i} style={{
                  background: "#F0EAD8", borderRadius: "12px", padding: "24px",
                  marginBottom: "12px", border: "1px solid rgba(45,90,61,0.08)",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                  height: "80px",
                }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!historyLoading && history.length === 0 && (
            <div style={{
              background: "#F0EAD8",
              border: "1px dashed rgba(45,90,61,0.2)",
              borderRadius: "12px", padding: "40px",
              textAlign: "center",
            }}>
              <p style={{ color: "#1E2018", opacity: 0.4, fontSize: "14px" }}>
                No cover letters saved yet. Generate one above and click Save.
              </p>
            </div>
          )}

          {/* History cards */}
          {!historyLoading && history.map((cl) => {
            const isExpanded  = expandedId === cl.id;
            const isConfirming = confirmDeleteId === cl.id;
            const isDeleting  = deletingId === cl.id;

            // Tone badge colour
            const toneBadgeColor = {
              professional: "rgba(45,90,61,0.15)",
              enthusiastic: "rgba(255,179,71,0.12)",
              concise:      "rgba(180,180,255,0.12)",
            }[cl.tone] || "rgba(45,90,61,0.1)";

            const toneBorderColor = {
              professional: "rgba(45,90,61,0.35)",
              enthusiastic: "rgba(255,179,71,0.35)",
              concise:      "rgba(180,180,255,0.35)",
            }[cl.tone] || "rgba(45,90,61,0.2)";

            const toneTextColor = {
              professional: "#2D5A3D",
              enthusiastic: "#FFB347",
              concise:      "#B4B4FF",
            }[cl.tone] || "#2D5A3D";

            return (
              <div
                key={cl.id}
                style={{
                  background: "#F0EAD8",
                  borderRadius: "12px",
                  padding: "20px 24px",
                  marginBottom: "12px",
                  border: "1px solid rgba(45,90,61,0.1)",
                  transition: "border-color 0.2s ease",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(45,90,61,0.25)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(45,90,61,0.1)"}
              >

                {/* Card header row */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", flexWrap: "wrap", gap: "10px",
                  marginBottom: isExpanded ? "16px" : "0",
                }}>
                  <div>
                    <p style={{
                      color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                      fontSize: "14px", marginBottom: "5px",
                    }}>
                      {cl.job_title}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      {/* Date */}
                      <span style={{ color: "#1E2018", fontSize: "12px", opacity: 0.35 }}>
                        {formatDate(cl.created_at)}
                      </span>
                      {/* Tone badge */}
                      <span style={{
                        background: toneBadgeColor,
                        border: `1px solid ${toneBorderColor}`,
                        color: toneTextColor,
                        fontSize: "10px", padding: "2px 8px",
                        borderRadius: "10px",
                        fontFamily: "'Libre Baskerville', serif",
                        letterSpacing: "0.5px", textTransform: "capitalize",
                      }}>
                        {cl.tone}
                      </span>
                    </div>
                  </div>

                  {/* Card action buttons */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>

                    {/* Expand / Collapse */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : cl.id)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(45,90,61,0.3)",
                        color: "#2D5A3D", padding: "6px 14px",
                        borderRadius: "6px", cursor: "pointer",
                        fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {isExpanded ? "▲ Collapse" : "▼ View"}
                    </button>

                    {/* Copy */}
                    <button
                      onClick={() => handleCopy(cl.cover_letter)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(45,90,61,0.3)",
                        color: "#2D5A3D", padding: "6px 14px",
                        borderRadius: "6px", cursor: "pointer",
                        fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      ⎘ Copy
                    </button>

                    {/* Download */}
                    <button
                      onClick={() => handleDownload(cl.cover_letter, cl.job_title)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(45,90,61,0.3)",
                        color: "#2D5A3D", padding: "6px 14px",
                        borderRadius: "6px", cursor: "pointer",
                        fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      ⬇
                    </button>

                    {/* Delete — two-step */}
                    {!isConfirming && !isDeleting && (
                      <button
                        onClick={() => setConfirmDeleteId(cl.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,107,107,0.25)",
                          color: "#8B2020", padding: "6px 14px",
                          borderRadius: "6px", cursor: "pointer",
                          fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                          opacity: 0.6, transition: "opacity 0.15s ease, background 0.15s ease",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(255,107,107,0.07)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.background = "transparent"; }}
                      >
                        Delete
                      </button>
                    )}

                    {isConfirming && (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "#1E2018", fontSize: "11px", opacity: 0.5 }}>Sure?</span>
                        <button
                          onClick={() => handleDelete(cl.id)}
                          style={{
                            background: "rgba(255,107,107,0.15)",
                            border: "1px solid rgba(255,107,107,0.5)",
                            color: "#8B2020", padding: "5px 12px",
                            borderRadius: "6px", cursor: "pointer",
                            fontSize: "11px", fontFamily: "'Libre Baskerville', serif",
                          }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#1E2018", padding: "5px 12px",
                            borderRadius: "6px", cursor: "pointer",
                            fontSize: "11px", fontFamily: "'Libre Baskerville', serif",
                            opacity: 0.5,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {isDeleting && (
                      <span style={{ color: "#1E2018", fontSize: "12px", opacity: 0.4 }}>
                        Deleting...
                      </span>
                    )}

                  </div>
                </div>

                {/* Expanded full text */}
                {isExpanded && (
                  <div style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(45,90,61,0.08)",
                    borderRadius: "8px",
                    padding: "20px 24px",
                    whiteSpace: "pre-wrap",
                    color: "#1E2018",
                    fontSize: "13px",
                    lineHeight: "1.85",
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    {cl.cover_letter}
                  </div>
                )}

              </div>
            );
          })}

        </div>

      </div>
    </DashboardLayout>
  );
}

