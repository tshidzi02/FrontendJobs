// =============================================================================
// FILE: frontend/src/pages/Jobs.jsx
// =============================================================================
// Phase 5.2 — Job Search Page
//
// LAYOUT: Mixed — top featured card (first result) + list below
// FILTERS: Keywords, Location, Remote/On-site/Hybrid, Salary range, Date posted
//
// DATA FLOW:
//   User types query + filters → hits Search → GET /api/jobs/search?q=...
//   → Flask queries JSearch, Adzuna, TheMuse, RemoteOK in parallel
//   → Returns unified job list → rendered as featured card + list
//   → Click any job → detail modal opens with full description +
//     "Generate CV for This Job" button that navigates to /generate
//     with the job description pre-filled
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";


// =============================================================================
// CONSTANTS
// =============================================================================

const EMPLOYMENT_TYPES = [
  { value: "all",       label: "All Types" },
  { value: "fulltime",  label: "Full-time" },
  { value: "parttime",  label: "Part-time" },
  { value: "remote",    label: "Remote" },
  { value: "contractor",label: "Contract" },
  { value: "intern",    label: "Internship" },
];

const DATE_OPTIONS = [
  { value: "all",    label: "Any time" },
  { value: "today",  label: "Today" },
  { value: "3days",  label: "Last 3 days" },
  { value: "week",   label: "This week" },
  { value: "month",  label: "This month" },
];

const SOURCE_COLORS = {
  JSearch:   "#2D5A3D",
  Adzuna:    "#FFB347",
  TheMuse:   "#A78BFA",
  RemoteOK:  "#4ADE80",
};

const TYPE_COLORS = {
  Remote:     "#4ADE80",
  Hybrid:     "#60A5FA",
  "On-site":  "#FFB347",
  Unknown:    "rgba(30,32,24,0.3)",
};


// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// ── SOURCE BADGE ──────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  return (
    <span style={{
      fontSize:        "10px",
      fontFamily:      "'Libre Baskerville', serif",
      fontWeight:      900,
      letterSpacing:   "1px",
      textTransform:   "uppercase",
      color:           SOURCE_COLORS[source] || "#1E2018",
      background:      `${SOURCE_COLORS[source]}18` ?? "rgba(30,32,24,0.08)",
      border:          `1px solid ${SOURCE_COLORS[source]}40` ?? "1px solid rgba(30,32,24,0.15)",
      borderRadius:    "4px",
      padding:         "2px 7px",
    }}>
      {source}
    </span>
  );
}

// ── TYPE BADGE ────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  if (!type || type === "Unknown") return null;
  return (
    <span style={{
      fontSize:      "10px",
      fontFamily:    "'Libre Baskerville', serif",
      fontWeight:    900,
      letterSpacing: "0.5px",
      color:         TYPE_COLORS[type] || "#1E2018",
      background:    `${TYPE_COLORS[type]}18`,
      border:        `1px solid ${TYPE_COLORS[type]}40`,
      borderRadius:  "4px",
      padding:       "2px 7px",
    }}>
      {type}
    </span>
  );
}

// ── FILTER SELECT ─────────────────────────────────────────────────────────────
function FilterSelect({ value, onChange, options, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "130px" }}>
      <label style={{
        color:       "#1E2018",
        fontSize:    "10px",
        opacity:     0.5,
        letterSpacing: "1px",
        textTransform: "uppercase",
        fontFamily:  "'Libre Baskerville', serif",
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background:   "#FFFFFF",
          border:       "1px solid rgba(45,90,61,0.2)",
          borderRadius: "8px",
          color:        "#1E2018",
          padding:      "10px 12px",
          fontSize:     "13px",
          fontFamily:   "system-ui, sans-serif",
          cursor:       "pointer",
          outline:      "none",
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── FEATURED JOB CARD (first result) ─────────────────────────────────────────
function FeaturedCard({ job, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onClick(job)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    hovered ? "rgba(45,90,61,0.06)" : "rgba(220,210,192,0.8)",
        border:        hovered ? "1px solid rgba(45,90,61,0.5)" : "1px solid rgba(45,90,61,0.25)",
        borderRadius:  "16px",
        padding:       "32px",
        marginBottom:  "24px",
        cursor:        "pointer",
        transition:    "all 0.2s ease",
        position:      "relative",
        overflow:      "hidden",
      }}
    >
      {/* Featured label */}
      <div style={{
        position:      "absolute",
        top:           "20px",
        right:         "20px",
        background:    "rgba(45,90,61,0.12)",
        border:        "1px solid rgba(45,90,61,0.3)",
        borderRadius:  "6px",
        padding:       "4px 10px",
        fontSize:      "10px",
        fontFamily:    "'Libre Baskerville', serif",
        fontWeight:    900,
        letterSpacing: "2px",
        color:         "#2D5A3D",
      }}>
        TOP MATCH
      </div>

      {/* Header row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "16px", marginBottom: "16px" }}>
        {/* Company initial avatar */}
        <div style={{
          width:        "52px",
          height:       "52px",
          background:   "rgba(45,90,61,0.1)",
          border:       "1px solid rgba(45,90,61,0.2)",
          borderRadius: "12px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          fontSize:     "20px",
          fontFamily:   "'Libre Baskerville', serif",
          color:        "#2D5A3D",
          flexShrink:   0,
        }}>
          {job.company?.[0]?.toUpperCase() || "?"}
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{
            color:       "#1E2018",
            fontFamily:  "'Libre Baskerville', serif",
            fontWeight:  900,
            fontSize:    "20px",
            marginBottom: "4px",
            lineHeight:  1.2,
          }}>
            {job.title}
          </h2>
          <p style={{
            color:      "#2D5A3D",
            fontSize:   "14px",
            fontFamily: "'Libre Baskerville', serif",
            fontWeight: 900,
          }}>
            {job.company}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
        {job.location && (
          <span style={{ color: "#1E2018", fontSize: "13px", opacity: 0.6 }}>
            📍 {job.location}
          </span>
        )}
        {job.salary && (
          <span style={{ color: "#FFB347", fontSize: "13px", fontFamily: "'Libre Baskerville', serif" }}>
            💰 {job.salary}
          </span>
        )}
        {job.posted && (
          <span style={{ color: "#1E2018", fontSize: "12px", opacity: 0.45 }}>
            🕐 {job.posted}
          </span>
        )}
        <TypeBadge type={job.type} />
        <SourceBadge source={job.source} />
      </div>

      {/* Full description */}
      <p style={{
        color:      "#1E2018",
        fontSize:   "13px",
        opacity:    0.6,
        lineHeight: 1.8,
        fontFamily: "system-ui, sans-serif",
        whiteSpace: "pre-wrap",
      }}>
        {job.description || "Click to view full job description."}
      </p>

      {/* CTA */}
      <div style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <span style={{
          color:       "#2D5A3D",
          fontSize:    "13px",
          fontFamily:  "'Libre Baskerville', serif",
          fontWeight:  900,
          opacity:     hovered ? 1 : 0.6,
          transition:  "opacity 0.2s",
        }}>
          View details →
        </span>
      </div>
    </div>
  );
}

// ── JOB LIST ROW ──────────────────────────────────────────────────────────────
function JobRow({ job, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onClick(job)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    hovered ? "rgba(45,90,61,0.04)" : "rgba(220,210,192,0.5)",
        border:        hovered ? "1px solid rgba(45,90,61,0.3)" : "1px solid rgba(45,90,61,0.1)",
        borderRadius:  "12px",
        padding:       "20px 24px",
        marginBottom:  "10px",
        cursor:        "pointer",
        transition:    "all 0.15s ease",
        display:       "flex",
        alignItems:    "center",
        gap:           "16px",
      }}
    >
      {/* Company avatar */}
      <div style={{
        width:          "40px",
        height:         "40px",
        background:     "rgba(45,90,61,0.08)",
        border:         "1px solid rgba(45,90,61,0.15)",
        borderRadius:   "10px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontSize:       "16px",
        fontFamily:     "'Libre Baskerville', serif",
        color:          "#2D5A3D",
        flexShrink:     0,
      }}>
        {job.company?.[0]?.toUpperCase() || "?"}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
          <span style={{
            color:      "#1E2018",
            fontFamily: "'Libre Baskerville', serif",
            fontWeight: 900,
            fontSize:   "14px",
          }}>
            {job.title}
          </span>
          <TypeBadge type={job.type} />
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#2D5A3D", fontSize: "13px", fontFamily: "'Libre Baskerville', serif" }}>
            {job.company}
          </span>
          {job.location && (
            <span style={{ color: "#1E2018", fontSize: "12px", opacity: 0.5 }}>
              {job.location}
            </span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
        {job.salary && (
          <span style={{ color: "#FFB347", fontSize: "12px", fontFamily: "'Libre Baskerville', serif" }}>
            {job.salary}
          </span>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {job.posted && (
            <span style={{ color: "#1E2018", fontSize: "11px", opacity: 0.4 }}>
              {job.posted}
            </span>
          )}
          <SourceBadge source={job.source} />
        </div>
      </div>
    </div>
  );
}

// ── JOB DETAIL MODAL ──────────────────────────────────────────────────────────
function JobModal({ job, onClose, onGenerateCV, profile }) {
  const [copied,   setCopied]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Combined LaTeX generation state
  const [texStatus, setTexStatus] = useState("idle"); // idle | generating | done | error
  const [texError,  setTexError]  = useState("");

  const handleGenerateCombinedTex = async () => {
    if (texStatus === "generating") return;
    if (!profile || !Object.keys(profile).length) {
      setTexError("Profile not loaded. Please save your profile first.");
      setTexStatus("error");
      return;
    }
    setTexStatus("generating");
    setTexError("");
    try {
      // Step 1 — Generate AI CV content (same as Generate CV page)
      const cvResp = await api.post("/generate", {
        jobDescription:    job.description || job.title,
        personalInfo:      profile.personalInfo      || {},
        baseSkills:        profile.skills            || [],
        baseExperience:    profile.experience        || [],
        projectExperience: profile.projects          || [],
        education:         profile.education         || [],
        languages:         profile.languages         || [],
        references:        profile.references        || "Available upon Request",
      });
      const aiResult = cvResp.data;

      // Step 2 — Generate cover letter text (same as Cover Letter page)
      const clResp = await api.post("/cover-letter", {
        jobDescription: job.description || job.title,
        tone:           "professional",
      });
      const coverLetterText = clResp.data.cover_letter || "";

      // Step 3 — Build LaTeX server-side (same as Bulk Generate)
      const texResp = await api.post("/bulk-tex", {
        ai_result:    aiResult,
        cover_letter: coverLetterText,
        job_title:    job.title,
      });
      const cvTex = texResp.data.cv_tex           || "";
      const clTex = texResp.data.cover_letter_tex || "";

      // Step 4 — Combine (same logic as BulkGenerate buildCombined)
      const extractBody = (tex) => {
        const start = tex.indexOf("\\begin{document}");
        const end   = tex.lastIndexOf("\\end{document}");
        if (start === -1 || end === -1) return tex;
        return tex.slice(start + "\\begin{document}".length, end).trim();
      };
      const preamble = cvTex.slice(0, cvTex.indexOf("\\begin{document}")).trim();
      const combined = [
        preamble, "",
        "\\begin{document}", "",
        "% ═══════════════════════════════════════════════════════════════════════",
        "% COVER LETTER",
        "% ═══════════════════════════════════════════════════════════════════════",
        extractBody(clTex), "",
        "\\newpage", "",
        "% ═══════════════════════════════════════════════════════════════════════",
        "% CURRICULUM VITAE",
        "% ═══════════════════════════════════════════════════════════════════════",
        extractBody(cvTex), "",
        "\\end{document}",
      ].join("\n");

      // Step 5 — Download the .tex file
      const slug     = job.title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      const filename = `${slug}_CV_CoverLetter.tex`;
      const blob     = new Blob([combined], { type: "text/plain" });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = url;
      a.download     = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setTexStatus("done");
      setTimeout(() => setTexStatus("idle"), 4000);
    } catch (e) {
      setTexError(e.response?.data?.message || "Generation failed. Check your profile and API keys.");
      setTexStatus("error");
    }
  };

  const handleSaveWishlist = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await api.post("/tracker", {
        company: job.company || "",
        role:    job.title   || "",
        status:  "Wishlist",
        salary:  job.salary  || "",
        notes:   "",
        url:     job.url     || "",
      });
      setSaved(true);
    } catch (e) {
      alert("Could not save to Wishlist. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!job) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   "fixed",
          top: 0, left: 0,
          width:      "100vw",
          height:     "100vh",
          background: "rgba(0,0,0,0.75)",
          zIndex:     2000,
        }}
      />

      {/* Modal */}
      <div style={{
        position:     "fixed",
        top:          "50%",
        left:         "50%",
        transform:    "translate(-50%, -50%)",
        width:        "min(680px, 92vw)",
        maxHeight:    "85vh",
        background:   "#F0EAD8",
        border:       "1px solid rgba(45,90,61,0.3)",
        borderRadius: "16px",
        zIndex:       2001,
        display:      "flex",
        flexDirection: "column",
        overflow:     "hidden",
      }}>

        {/* Modal header */}
        <div style={{
          padding:       "28px 32px 20px",
          borderBottom:  "1px solid rgba(45,90,61,0.1)",
          flexShrink:    0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: "16px" }}>
              <h2 style={{
                color:       "#1E2018",
                fontFamily:  "'Libre Baskerville', serif",
                fontWeight:  900,
                fontSize:    "20px",
                marginBottom: "6px",
                lineHeight:  1.2,
              }}>
                {job.title}
              </h2>
              <p style={{
                color:      "#2D5A3D",
                fontSize:   "14px",
                fontFamily: "'Libre Baskerville', serif",
                fontWeight: 900,
                marginBottom: "10px",
              }}>
                {job.company}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                {job.location && (
                  <span style={{ color: "#1E2018", fontSize: "12px", opacity: 0.6 }}>
                    📍 {job.location}
                  </span>
                )}
                {job.salary && (
                  <span style={{ color: "#FFB347", fontSize: "12px", fontFamily: "'Libre Baskerville', serif" }}>
                    💰 {job.salary}
                  </span>
                )}
                {job.posted && (
                  <span style={{ color: "#1E2018", fontSize: "12px", opacity: 0.4 }}>
                    🕐 {job.posted}
                  </span>
                )}
                <TypeBadge type={job.type} />
                <SourceBadge source={job.source} />
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background:   "transparent",
                border:       "none",
                color:        "#1E2018",
                fontSize:     "20px",
                cursor:       "pointer",
                padding:      "4px",
                opacity:      0.5,
                lineHeight:   1,
                flexShrink:   0,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal body — scrollable */}
        <div style={{
          flex:       1,
          overflowY:  "auto",
          padding:    "24px 32px",
        }}>
          <h3 style={{
            color:       "#2D5A3D",
            fontFamily:  "'Libre Baskerville', serif",
            fontSize:    "11px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: "14px",
            opacity:     0.7,
          }}>
            Job Description
          </h3>
          <p style={{
            color:      "#1E2018",
            fontSize:   "13px",
            lineHeight: 1.8,
            fontFamily: "system-ui, sans-serif",
            opacity:    0.8,
            whiteSpace: "pre-wrap",
          }}>
            {job.description || "No description available."}
          </p>
          {/* Warning when API truncated the description */}
          {job.description && (
            job.description.trimEnd().endsWith("...") ||
            job.description.trimEnd().endsWith("…") ||
            job.description.length < 300
          ) && job.url && (
            <div style={{
              marginTop: "16px", padding: "12px 16px",
              background: "rgba(184,134,11,0.08)",
              border: "1px solid rgba(184,134,11,0.3)",
              borderRadius: "8px", fontSize: "12px", color: "#7A5800",
              fontFamily: "'Libre Baskerville', serif",
            }}>
              ⚠ This description was shortened by the job board.{" "}
              <a href={job.url} target="_blank" rel="noopener noreferrer"
                style={{ color: "#2D5A3D", fontWeight: 700 }}>
                View the full listing →
              </a>
            </div>
          )}
        </div>

        {/* Modal footer — action buttons */}
        <div style={{
          padding:      "20px 32px",
          borderTop:    "1px solid rgba(45,90,61,0.1)",
          display:      "flex",
          gap:          "12px",
          flexShrink:   0,
          flexWrap:     "wrap",
        }}>
          {/* Generate CV for this job — navigates to /generate */}
          <button
            className="primary-btn"
            onClick={() => onGenerateCV(job)}
            style={{ flex: 1, fontSize: "14px", padding: "12px 20px" }}
          >
            ✨ Generate CV for This Job
          </button>

          {/* Generate combined CV + Cover Letter .tex and download it */}
          <button
            onClick={handleGenerateCombinedTex}
            disabled={texStatus === "generating"}
            style={{
              background:   texStatus === "done"       ? "rgba(45,90,61,0.15)"
                          : texStatus === "generating" ? "rgba(45,90,61,0.06)"
                          : "transparent",
              border:       `1px solid ${texStatus === "done" ? "#2D5A3D" : "rgba(45,90,61,0.3)"}`,
              borderRadius: "6px",
              color:        texStatus === "error" ? "#8B2020" : "#2D5A3D",
              padding:      "12px 20px",
              fontSize:     "14px",
              fontFamily:   "'Libre Baskerville', serif",
              fontWeight:   900,
              cursor:       texStatus === "generating" ? "not-allowed" : "pointer",
              whiteSpace:   "nowrap",
              transition:   "all 0.2s",
              display:      "flex",
              alignItems:   "center",
              gap:          "8px",
            }}
          >
            {texStatus === "generating" && (
              <span style={{
                display: "inline-block", width: "12px", height: "12px",
                border: "2px solid #2D5A3D", borderTopColor: "transparent",
                borderRadius: "50%", animation: "spin 0.7s linear infinite",
              }} />
            )}
            {texStatus === "done"       ? "✓ Downloaded!"
           : texStatus === "generating" ? "Generating…"
           : "📄 Download CV + Cover Letter (.tex)"}
          </button>

          {/* Save to Wishlist */}
          <button
            onClick={handleSaveWishlist}
            disabled={saving || saved}
            style={{
              background:   saved ? "rgba(45,90,61,0.12)" : "transparent",
              border:       `1px solid ${saved ? "#2D5A3D" : "rgba(45,90,61,0.3)"}`,
              borderRadius: "6px",
              color:        "#2D5A3D",
              padding:      "12px 20px",
              fontSize:     "14px",
              fontFamily:   "'Libre Baskerville', serif",
              fontWeight:   900,
              cursor:       saving || saved ? "default" : "pointer",
              whiteSpace:   "nowrap",
              transition:   "all 0.2s",
              opacity:      saving ? 0.6 : 1,
            }}
          >
            {saved ? "✓ Saved to Wishlist!" : saving ? "Saving…" : "⭐ Save to Wishlist"}
          </button>

          {/* Copy description */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(job.description || "").then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            style={{
              background:   copied ? "rgba(45,90,61,0.1)" : "transparent",
              border:       "1px solid rgba(45,90,61,0.3)",
              borderRadius: "6px",
              color:        "#2D5A3D",
              padding:      "12px 20px",
              fontSize:     "14px",
              fontFamily:   "'Libre Baskerville', serif",
              fontWeight:   900,
              cursor:       "pointer",
              whiteSpace:   "nowrap",
              transition:   "all 0.2s",
            }}
          >
            {copied ? "✓ Copied!" : "📋 Copy Description"}
          </button>

          {/* Open original listing */}
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background:   "transparent",
                border:       "1px solid rgba(45,90,61,0.3)",
                borderRadius: "6px",
                color:        "#2D5A3D",
                padding:      "12px 20px",
                fontSize:     "14px",
                fontFamily:   "'Libre Baskerville', serif",
                fontWeight:   900,
                textDecoration: "none",
                cursor:       "pointer",
                whiteSpace:   "nowrap",
              }}
            >
              View Original →
            </a>
          )}
        </div>

        {/* Tex generation error */}
        {texStatus === "error" && (
          <div style={{
            padding: "12px 32px", background: "rgba(139,32,32,0.06)",
            borderTop: "1px solid rgba(139,32,32,0.15)",
            fontSize: "12px", color: "#8B2020",
            fontFamily: "'Libre Baskerville', serif",
          }}>
            ⚠ {texError}
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}

// ── LOADING SKELETON ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div>
      {/* Featured card skeleton */}
      <div style={{
        background:   "#F0EAD8",
        border:       "1px solid rgba(45,90,61,0.08)",
        borderRadius: "16px",
        padding:      "32px",
        marginBottom: "24px",
        height:       "200px",
        opacity:      0.5,
      }} />
      {/* List row skeletons */}
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          background:   "#F0EAD8",
          border:       "1px solid rgba(45,90,61,0.08)",
          borderRadius: "12px",
          height:       "72px",
          marginBottom: "10px",
          opacity:      0.4 - i * 0.05,
        }} />
      ))}
    </div>
  );
}


// =============================================================================
// MAIN PAGE
// =============================================================================

export default function Jobs() {
  const navigate      = useNavigate();
  const routerLocation = useLocation();

  // ── SEARCH STATE ────────────────────────────────────────────────────────────
  const [query,          setQuery]          = useState("");
  const [location,       setLocation]       = useState("");
  const [employmentType, setEmploymentType] = useState("all");
  const [datePosted,     setDatePosted]     = useState("all");
  const [salaryMin,      setSalaryMin]      = useState("");
  const [salaryMax,      setSalaryMax]      = useState("");
  const [remoteOnly,     setRemoteOnly]     = useState(false);

  // ── RESULTS STATE ───────────────────────────────────────────────────────────
  const [jobs,           setJobs]           = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [searched,       setSearched]       = useState(false);
  const [resultQuery,    setResultQuery]    = useState("");

  // ── MODAL STATE ─────────────────────────────────────────────────────────────
  const [selectedJob,    setSelectedJob]    = useState(null);
  const [profile,        setProfile]        = useState({});

  // Load profile on mount so the combined LaTeX generation has access to it
  useEffect(() => {
    api.get("/profile").then(r => { if (r.data) setProfile(r.data); }).catch(() => {});
  }, []);

  const queryInputRef = useRef(null);


  // ── SEARCH HANDLER ──────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a job title or keywords.");
      return;
    }

    setError("");
    setLoading(true);
    setJobs([]);
    setSearched(false);

    const params = new URLSearchParams();
    params.set("q", query.trim());
    if (location.trim())  params.set("location", location.trim());
    if (employmentType !== "all") params.set("employment_type", employmentType);
    if (datePosted !== "all")     params.set("date_posted", datePosted);
    if (salaryMin)                params.set("salary_min", salaryMin);
    if (salaryMax)                params.set("salary_max", salaryMax);
    if (remoteOnly)               params.set("remote_only", "true");

    try {
      const response = await api.get(`/jobs/search?${params.toString()}`);
      setJobs(response.data.jobs || []);
      setResultQuery(response.data.query || query);
      setSearched(true);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setError("Search failed. Make sure the backend is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // ── GENERATE CV FOR THIS JOB ─────────────────────────────────────────────
  // Navigate to /generate with the job description pre-filled via router state.
  // GenerateCV.jsx needs to read location.state?.jobDescription on mount.
  const handleGenerateCV = (job) => {
    navigate("/generate", {
      state: {
        jobDescription: job.description || "",
        jobTitle:       job.title || "",
        company:        job.company || "",
      }
    });
  };


  // ── RENDER ──────────────────────────────────────────────────────────────────
  const featuredJob  = jobs[0] || null;
  const listJobs     = jobs.slice(1);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(860px, 100%)", margin: "0 auto", paddingBottom: "clamp(40px, 6vw, 80px)" }}>

        {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{
            fontFamily:   "'Libre Baskerville', serif",
            fontSize: "clamp(20px, 4vw, 32px)",
            color:        "#2D5A3D",
            letterSpacing: "2px",
            marginBottom: "6px",
          }}>
            JOB SEARCH
          </h1>
          <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.5 }}>
            Live results from Indeed, LinkedIn, Adzuna, The Muse & RemoteOK
          </p>
        </div>


        {/* ── SEARCH BAR ───────────────────────────────────────────────────── */}
        <div style={{
          background:   "rgba(220,210,192,0.8)",
          border:       "1px solid rgba(45,90,61,0.2)",
          borderRadius: "16px",
          padding:      "24px",
          marginBottom: "24px",
        }}>

          {/* Main search row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div style={{ flex: 2, position: "relative" }}>
              <input
                ref={queryInputRef}
                type="text"
                placeholder="Job title, keywords, or company..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width:        "100%",
                  padding:      "13px 16px",
                  background:   "#FFFFFF",
                  border:       "1px solid rgba(45,90,61,0.25)",
                  borderRadius: "10px",
                  color:        "#1E2018",
                  fontSize:     "14px",
                  fontFamily:   "system-ui, sans-serif",
                  outline:      "none",
                  boxSizing:    "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Location (city, country)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width:        "100%",
                  padding:      "13px 16px",
                  background:   "#FFFFFF",
                  border:       "1px solid rgba(45,90,61,0.25)",
                  borderRadius: "10px",
                  color:        "#1E2018",
                  fontSize:     "14px",
                  fontFamily:   "system-ui, sans-serif",
                  outline:      "none",
                  boxSizing:    "border-box",
                }}
              />
            </div>
            <button
              className="primary-btn"
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding:    "13px 28px",
                fontSize:   "14px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Filters row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>

            <FilterSelect
              label="Job Type"
              value={employmentType}
              onChange={setEmploymentType}
              options={EMPLOYMENT_TYPES}
            />

            <FilterSelect
              label="Date Posted"
              value={datePosted}
              onChange={setDatePosted}
              options={DATE_OPTIONS}
            />

            {/* Salary min */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "110px" }}>
              <label style={{
                color: "#1E2018", fontSize: "10px", opacity: 0.5,
                letterSpacing: "1px", textTransform: "uppercase",
                fontFamily: "'Libre Baskerville', serif",
              }}>
                Salary Min
              </label>
              <input
                type="number"
                placeholder="e.g. 30000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                style={{
                  background: "#FFFFFF", border: "1px solid rgba(45,90,61,0.2)",
                  borderRadius: "8px", color: "#1E2018",
                  padding: "10px 12px", fontSize: "13px",
                  fontFamily: "system-ui, sans-serif", outline: "none",
                  width: "100%", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Salary max */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "110px" }}>
              <label style={{
                color: "#1E2018", fontSize: "10px", opacity: 0.5,
                letterSpacing: "1px", textTransform: "uppercase",
                fontFamily: "'Libre Baskerville', serif",
              }}>
                Salary Max
              </label>
              <input
                type="number"
                placeholder="e.g. 80000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                style={{
                  background: "#FFFFFF", border: "1px solid rgba(45,90,61,0.2)",
                  borderRadius: "8px", color: "#1E2018",
                  padding: "10px 12px", fontSize: "13px",
                  fontFamily: "system-ui, sans-serif", outline: "none",
                  width: "100%", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Remote only toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
              <label style={{
                color: "#1E2018", fontSize: "10px", opacity: 0.5,
                letterSpacing: "1px", textTransform: "uppercase",
                fontFamily: "'Libre Baskerville', serif",
              }}>
                Remote Only
              </label>
              <button
                onClick={() => setRemoteOnly(!remoteOnly)}
                style={{
                  padding:      "10px 16px",
                  background:   remoteOnly ? "rgba(74,222,128,0.15)" : "#EDE8DE",
                  border:       remoteOnly ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(45,90,61,0.2)",
                  borderRadius: "8px",
                  color:        remoteOnly ? "#4ADE80" : "#1E2018",
                  fontSize:     "13px",
                  fontFamily:   "'Libre Baskerville', serif",
                  fontWeight:   900,
                  cursor:       "pointer",
                  transition:   "all 0.15s ease",
                }}
              >
                {remoteOnly ? "✓ Remote" : "Remote"}
              </button>
            </div>

          </div>
        </div>


        {/* ── ERROR ────────────────────────────────────────────────────────── */}
        {error && (
          <p style={{ color: "#8B2020", fontSize: "14px", marginBottom: "20px" }}>{error}</p>
        )}


        {/* ── LOADING ──────────────────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}


        {/* ── RESULTS ──────────────────────────────────────────────────────── */}
        {!loading && searched && (
          <>
            {/* Results count */}
            <div style={{ marginBottom: "20px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
              <p style={{
                color:      "#1E2018",
                fontSize:   "13px",
                opacity:    0.5,
                fontFamily: "system-ui, sans-serif",
              }}>
                {jobs.length === 0
                  ? `No results for "${resultQuery}"`
                  : `${jobs.length} result${jobs.length !== 1 ? "s" : ""} for "${resultQuery}"`
                }
              </p>

              {/* Source breakdown pills */}
              {jobs.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {Object.entries(
                    jobs.reduce((acc, j) => {
                      acc[j.source] = (acc[j.source] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([src, count]) => (
                    <span key={src} style={{
                      fontSize:    "10px",
                      fontFamily:  "'Libre Baskerville', serif",
                      color:       SOURCE_COLORS[src] || "#1E2018",
                      background:  `${SOURCE_COLORS[src]}15`,
                      border:      `1px solid ${SOURCE_COLORS[src]}30`,
                      borderRadius: "4px",
                      padding:     "2px 7px",
                    }}>
                      {src} {count}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* No results empty state */}
            {jobs.length === 0 && (
              <div style={{
                textAlign:    "center",
                padding:      "60px 20px",
                background:   "rgba(220,210,192,0.4)",
                borderRadius: "16px",
                border:       "1px solid rgba(45,90,61,0.1)",
              }}>
                <p style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</p>
                <p style={{
                  color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "16px", marginBottom: "8px",
                }}>
                  No jobs found
                </p>
                <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.5 }}>
                  Try broader keywords or a different location
                </p>
              </div>
            )}

            {/* Featured card — first result */}
            {featuredJob && (
              <FeaturedCard job={featuredJob} onClick={setSelectedJob} />
            )}

            {/* List — remaining results */}
            {listJobs.length > 0 && (
              <div>
                <p style={{
                  color:       "#1E2018",
                  fontSize:    "11px",
                  opacity:     0.35,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  fontFamily:  "'Libre Baskerville', serif",
                  marginBottom: "12px",
                }}>
                  More Results
                </p>
                {listJobs.map((job) => (
                  <JobRow key={job.id} job={job} onClick={setSelectedJob} />
                ))}
              </div>
            )}
          </>
        )}


        {/* ── EMPTY / INITIAL STATE ─────────────────────────────────────────── */}
        {!loading && !searched && (
          <div style={{
            textAlign:    "center",
            padding:      "60px 20px",
            background:   "rgba(220,210,192,0.3)",
            borderRadius: "16px",
            border:       "1px solid rgba(45,90,61,0.08)",
          }}>
            <p style={{ fontSize: "clamp(22px, 4vw, 40px)", marginBottom: "16px" }}>🌐</p>
            <p style={{
              color:      "#1E2018",
              fontFamily: "'Libre Baskerville', serif",
              fontSize:   "16px",
              marginBottom: "8px",
            }}>
              Search across multiple job boards at once
            </p>
            <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.45, maxWidth: "400px", margin: "0 auto" }}>
              Enter a job title above to search Indeed, LinkedIn, Adzuna,
              The Muse and RemoteOK simultaneously
            </p>
          </div>
        )}

      </div>

      {/* ── JOB DETAIL MODAL ───────────────────────────────────────────────── */}
      {selectedJob && (
        <JobModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onGenerateCV={handleGenerateCV}
          profile={profile}
        />
      )}

    </DashboardLayout>
  );
}