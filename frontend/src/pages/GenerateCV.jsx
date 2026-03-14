// =============================================================================
// FILE: frontend/src/pages/GenerateCV.jsx
// =============================================================================
// FIXES vs previous version:
//   ✅ Skills now show description tooltip/text under each skill badge
//   ✅ NEW skills added by AI (is_new: true) are highlighted in a different colour
//      so you can clearly see what the job description added beyond your own skills
//   ✅ Education card now shows minimumAverage (was missing — wrong field name in backend)
//   ✅ Language bar redesigned to match the bold block style in the screenshot
//   ✅ Education coursework items now show their descriptions (as formatted by AI)
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

export default function Generate() {

  // ── STATE ────────────────────────────────────────────────────────────────    
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle]             = useState("");
  const [profile, setProfile]               = useState(null);
  const [result, setResult]                 = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [copied, setCopied]                 = useState(false);
  const [downloading, setDownloading]       = useState(false);
  const [downloadError, setDownloadError]   = useState("");
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [saveError, setSaveError]           = useState("");
  const routerLocation = useLocation();

  const navigate = useNavigate();


  // ── LOAD PROFILE ON MOUNT ────────────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get("/profile");
        if (response.data && Object.keys(response.data).length > 0) {
          setProfile(response.data);
        }
      } catch {
        console.log("No profile found.");
      }
    };
    loadProfile();
  }, []);

  
useEffect(() => {
  // If the user arrived from the Job Search page via "Generate CV for This Job",
  // router state will contain the job description and title.
  // Pre-fill the job description textarea so they can generate immediately.
  const state = routerLocation.state;
  if (state?.jobDescription) {
    setJobDescription(state.jobDescription);
    if (state?.jobTitle) setJobTitle(state.jobTitle);
    window.history.replaceState({}, document.title);
  }
}, [routerLocation.state]);


  // ── SCORE COLOUR HELPER ──────────────────────────────────────────────────
  const scoreColor = (score) => {
    if (score >= 70) return "#2D5A3D";
    if (score >= 40) return "#FFB347";
    return "#8B2020";
  };


  // ── GENERATE HANDLER ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      setError("Please paste a job description before generating.");
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);
    setDownloadError("");

    try {
      const response = await api.post("/generate", {
        jobDescription,
        personalInfo:      profile?.personalInfo || {},
        baseSkills:        profile?.skills       || [],
        baseExperience:    profile?.experience   || [],
        projectExperience: profile?.projects     || [],
        education:         profile?.education    || [],
        languages:         profile?.languages    || [],
        references:        profile?.references   || "Available upon Request",
      });

      setResult(response.data);

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


  // ── DOWNLOAD HANDLER ─────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    setDownloadError("");

    try {
      const response = await api.post(
        "/download-cv",
        { ai_result: result, profile: profile || {} },
        { responseType: "blob" }
      );

      const blob = response.data;
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;

      const firstName = profile?.personalInfo?.firstName || "";
      const lastName  = profile?.personalInfo?.lastName  || "";
      const fullName  = `${firstName}${lastName ? "_" + lastName : ""}`.trim();
      const titleSlug = jobTitle.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 50);
      const filename  = [fullName, titleSlug, "CV"].filter(Boolean).join("_") + ".docx";
      link.download   = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setDownloadError("Download failed. Make sure the backend is running and the template exists.");
      }
    } finally {
      setDownloading(false);
    }
  };


  // ── COPY TO CLIPBOARD ────────────────────────────────────────────────────
  // ── SAVE TO CABINET HANDLER ─────────────────────────────────────────────
  const handleSaveToCabinet = async () => {
    if (!result) return;

    setSaving(true);
    setSaveError("");
    setSaved(false);

    // Extract a job title from the first non-empty line of the job description.
    // This labels the cabinet card so the user knows what role this CV was for.
    const firstLine = jobTitle.trim() || jobDescription.trim().split("\n").find(l => l.trim()) || "Untitled CV";
    const jobTitleLabel = firstLine.trim().slice(0, 120);

    try {
      await api.post("/cabinet", {
        ai_result:        result,
        profile_snapshot: profile || {},
        job_title:        jobTitleLabel,
      });

      setSaved(true);
      // Reset the "Saved!" label back to normal after 3 seconds
      setTimeout(() => setSaved(false), 3000);

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


  const handleCopy = () => {
    if (!result) return;
    const lines = [];

    // ── HEADER ──
    const p = result.personalInfo;
    if (p?.firstName || p?.lastName) {
      lines.push(`${p.firstName || ""} ${p.lastName || ""}`.trim());
      if (p.jobTitle) lines.push(p.jobTitle);
      if (p.city)     lines.push(p.city);
      if (p.phone)    lines.push(p.phone);
      if (p.email)    lines.push(p.email);
      if (p.github)   lines.push(p.github);
      lines.push("");
    }

    // ── SUMMARY ──
    lines.push("PROFESSIONAL SUMMARY");
    lines.push("─".repeat(40));
    lines.push(result.SUMMARY || "");
    lines.push("");

    // ── SKILLS ──
    if (result.skills?.length > 0) {
      lines.push("SKILLS");
      lines.push("─".repeat(40));
      result.skills.forEach(cat => {
        const tag = cat.skills_list?.some(s => s.is_new) ? " [from job description]" : " [your skills]";
        lines.push(`${cat.category}${tag}`);
        cat.skills_list?.forEach(s => {
          lines.push(`  • ${s.skill}${s.description ? " — " + s.description : ""}`);
        });
      });
      lines.push("");
    }

    // ── EXPERIENCE ──
    if (result.experience?.length > 0) {
      lines.push("EXPERIENCE");
      lines.push("─".repeat(40));
      result.experience.forEach((job) => {
        const loc = job.location || [job.city, job.country].filter(Boolean).join(", ");
        lines.push(`${job.role || ""} — ${job.company || ""}`);
        if (loc)       lines.push(`  ${loc}`);
        if (job.dates) lines.push(`  ${job.dates}`);
        job.bullets?.forEach((b) => lines.push(`  • ${b}`));
        lines.push("");
      });
    }

    // ── EDUCATION ──
    if (result.education?.length > 0) {
      lines.push("EDUCATION");
      lines.push("─".repeat(40));
      result.education.forEach(edu => {
        lines.push(`${edu.degree || ""}`);
        lines.push(`  ${edu.institution || ""}${edu.city ? " — " + edu.city : ""}${edu.country ? ", " + edu.country : ""}`);
        const gradDate = [edu.graduationMonth, edu.graduationYear].filter(Boolean).join(" ");
        if (gradDate) lines.push(`  ${edu.graduationStatus === "expected" ? "Expected: " : ""}${gradDate}`);
        if (edu.minimumAverage) lines.push(`  Minimum Average: ${edu.minimumAverage}`);
        if (edu.coursework?.length > 0) {
          lines.push("  Relevant Coursework:");
          edu.coursework.filter(c => c?.trim()).forEach(c => lines.push(`    • ${c}`));
        }
        lines.push("");
      });
    }

    // ── PROJECT EXPERIENCE ──
    if (result.project_experience?.length > 0) {
      lines.push("PROJECT EXPERIENCE");
      lines.push("─".repeat(40));
      result.project_experience.forEach(proj => {
        lines.push(`${proj.title || ""}`);
        if (proj.url)       lines.push(`  ${proj.url}`);
        if (proj.tech_stack) lines.push(`  Technologies: ${proj.tech_stack}`);
        proj.bullets?.forEach((b) => lines.push(`  • ${b}`));
        lines.push("");
      });
    }

    // ── LANGUAGES ──
    if (result.languages?.length > 0) {
      lines.push("LANGUAGES");
      lines.push("─".repeat(40));
      const cefrLabels = ["","Beginner (A1)","Elementary (A2)","Intermediate (B1)",
        "Upper-Intermediate (B2)","Advanced (C1)","Bilingual or Proficient (C2)"];
      result.languages.forEach(lang => {
        const level = typeof lang.level === "number" ? lang.level : 3;
        lines.push(`  ${lang.name} — ${cefrLabels[level] || ""}`);
      });
      lines.push("");
    }

    // ── REFERENCES ──
    if (result.references) {
      lines.push("REFERENCES");
      lines.push("─".repeat(40));
      lines.push(result.references);
      lines.push("");
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  // ── LANGUAGE LEVEL LABELS ────────────────────────────────────────────────
  const CEFR_LABELS = [
    "", "Beginner (A1)", "Elementary (A2)", "Intermediate (B1)",
    "Upper-Intermediate (B2)", "Advanced (C1)", "Bilingual or Proficient (C2)"
  ];


  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(1000px, 100%)", margin: "0 auto" }}>

        {/* ── Page Header ──────────────────────────────── */}
        <h1 style={{
          fontFamily: "'Libre Baskerville', serif", fontSize: "clamp(20px, 4vw, 32px)",
          color: "#2D5A3D", letterSpacing: "2px", marginBottom: "6px",
        }}>
          Generate CV
        </h1>

        <p style={{ color: "#1E2018", opacity: 0.5, fontSize: "13px", marginBottom: "24px" }}>
          {profile
            ? "✓ Profile loaded — AI will use your saved skills and experience."
            : "No profile saved yet. "}
          {!profile && (
            <span onClick={() => navigate("/profile")}
              style={{ color: "#2D5A3D", cursor: "pointer", textDecoration: "underline" }}>
              Set up your profile
            </span>
          )}
        </p>


        {/* ══ INPUT CARD ═══════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "24px" }}>

          {/* Job Title field */}
          <h3 style={{
            color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
            fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
            marginBottom: "10px", opacity: 0.8,
          }}>💼 Job Title</h3>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Frontend Developer, React Engineer..."
            style={{
              width: "100%", background: "#FFFFFF",
              border: "1px solid rgba(45,90,61,0.2)", borderRadius: "8px",
              color: "#1E2018", padding: "12px 14px", fontSize: "14px",
              fontFamily: "system-ui, sans-serif", marginBottom: "20px",
              outline: "none",
            }}
          />

          <h3 style={{
            color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
            fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
            marginBottom: "16px", opacity: 0.8,
          }}>📋 Job Description</h3>

          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            rows={10}
            style={{
              width: "100%", background: "#FFFFFF",
              border: "1px solid rgba(45,90,61,0.2)", borderRadius: "8px",
              color: "#1E2018", padding: "14px", fontSize: "13px",
              lineHeight: "1.6", resize: "vertical",
              fontFamily: "system-ui, sans-serif", marginBottom: "16px",
            }}
          />

          {error && (
            <p style={{ color: "#8B2020", fontSize: "13px", marginBottom: "12px" }}>{error}</p>
          )}

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
                Generating...
              </>
            ) : "✦ Generate CV"}
          </button>

          <style>{`
            @keyframes spin  { to { transform: rotate(360deg); } }
            @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.9; } }
          `}</style>
        </div>


        {/* ══ LOADING SKELETONS ════════════════════════════ */}
        {loading && (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                background: "#F0EAD8", borderRadius: "12px", padding: "28px",
                marginBottom: "16px", border: "1px solid rgba(45,90,61,0.08)",
              }}>
                {[90, 100, 70].map((w, idx) => (
                  <div key={idx} style={{
                    height: "13px", background: "rgba(45,90,61,0.07)",
                    borderRadius: "6px", marginBottom: "12px", width: `${w}%`,
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${idx * 0.15}s`,
                  }} />
                ))}
              </div>
            ))}
          </div>
        )}


        {/* ══ RESULTS ══════════════════════════════════════ */}
        {result && !loading && (
          <div>

            {/* ── ATS SCORE ─────────────────────────────── */}
            <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
              <h3 style={{
                color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                marginBottom: "20px", opacity: 0.8,
              }}>📊 ATS Score</h3>

              <div style={{
                fontSize: "clamp(28px, 5vw, 56px)", fontFamily: "'Libre Baskerville', serif",
                color: scoreColor(result.ats.final_score), lineHeight: 1, marginBottom: "16px",
              }}>
                {result.ats.final_score}%
              </div>

              <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.6, marginBottom: "16px" }}>
                {result.ats.final_score >= 70
                  ? "Strong match — this CV is well-aligned to the job."
                  : result.ats.final_score >= 40
                  ? "Average match — consider adding more keywords."
                  : "Weak match — the CV needs more alignment to this role."}
              </p>

              <div style={{
                background: "#FFFFFF", borderRadius: "20px",
                height: "10px", marginBottom: "24px", overflow: "hidden",
              }}>
                <div style={{
                  width: `${result.ats.final_score}%`, height: "100%",
                  background: scoreColor(result.ats.final_score),
                  borderRadius: "20px", transition: "width 1.2s ease",
                }} />
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
                {[
                  { label: "Semantic Match", value: result.ats.semantic_score },
                  { label: "Skills Match",   value: result.ats.skills_match },
                  { label: "Experience",     value: result.ats.experience_match },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: "#FFFFFF", padding: "12px 16px",
                    borderRadius: "10px", flex: 1, minWidth: "110px",
                  }}>
                    <p style={{
                      color: "#1E2018", fontSize: "11px", opacity: 0.45,
                      marginBottom: "6px", fontFamily: "'Libre Baskerville', serif",
                    }}>{label}</p>
                    <p style={{ color: scoreColor(value), fontFamily: "'Libre Baskerville', serif", fontSize: "22px" }}>
                      {value}%
                    </p>
                  </div>
                ))}
              </div>

              {result.ats.missing_keywords?.length > 0 && (
                <div>
                  <p style={{
                    color: "#1E2018", fontSize: "11px", opacity: 0.5, marginBottom: "10px",
                    fontFamily: "'Libre Baskerville', serif", letterSpacing: "1px", textTransform: "uppercase",
                  }}>
                    ⚠ Keywords to consider adding:
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {result.ats.missing_keywords.map((word, i) => (
                      <span key={i} style={{
                        background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.35)",
                        color: "#8B2020", padding: "4px 12px", borderRadius: "20px",
                        fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                      }}>{word}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>


            {/* ── PROFESSIONAL SUMMARY ──────────────────── */}
            <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
              <h3 style={{
                color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                marginBottom: "16px", opacity: 0.8,
              }}>📝 Professional Summary</h3>
              <p style={{ color: "#1E2018", lineHeight: "1.85", fontSize: "14px", opacity: 0.9 }}>
                {result.SUMMARY}
              </p>
            </div>


            {/* ══ SKILLS ════════════════════════════════════
                The skills section is split into two visually distinct zones:

                ZONE 1 — "Your Skills" (teal):
                  Every skill you saved in your profile appears here.
                  Built in Python — guaranteed, the AI cannot drop a single one.
                  is_new === false → teal background, teal text, no badge.

                ZONE 2 — "Added from Job Description" (amber/orange):
                  Skills the AI identified from the job description that you
                  do NOT already have. These are gap skills — things to consider
                  learning or at least mentioning if you already know them.
                  is_new === true → amber background, amber text, "NEW" badge.
            ════════════════════════════════════════════════ */}
            {result.skills?.length > 0 && (() => {
              // Split categories into "yours" (is_new=false) and "new" (is_new=true)
              // A category is "yours" if ALL its skills have is_new=false
              // A category is "new" if ANY skill has is_new=true
              const yourCategories = result.skills.filter(cat =>
                cat.skills_list?.every(s => s.is_new === false)
              );
              const newCategories = result.skills.filter(cat =>
                cat.skills_list?.some(s => s.is_new === true)
              );

              // Helper: renders one skill card
              const SkillCard = (skillObj, skillIndex) => {
                const isNew = skillObj.is_new === true;
                return (
                  <div key={skillIndex} style={{
                    background: isNew ? "rgba(255,179,71,0.12)" : "rgba(45,90,61,0.08)",
                    border: isNew
                      ? "1px solid rgba(255,179,71,0.4)"
                      : "1px solid rgba(45,90,61,0.25)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <span style={{
                        color: isNew ? "#FFB347" : "#2D5A3D",
                        fontFamily: "'Libre Baskerville', serif",
                        fontSize: "13px", fontWeight: "900",
                      }}>
                        {skillObj.skill}
                      </span>
                      {isNew && (
                        <span style={{
                          background: "rgba(255,179,71,0.2)",
                          border: "1px solid rgba(255,179,71,0.5)",
                          color: "#FFB347", fontSize: "9px",
                          padding: "2px 6px", borderRadius: "10px",
                          fontFamily: "'Libre Baskerville', serif",
                          letterSpacing: "0.5px",
                        }}>NEW</span>
                      )}
                    </div>
                    {skillObj.description && (
                      <p style={{
                        color: "#1E2018", fontSize: "11px", opacity: 0.55,
                        lineHeight: "1.5", margin: 0, fontFamily: "system-ui, sans-serif",
                      }}>
                        {skillObj.description}
                      </p>
                    )}
                  </div>
                );
              };

              return (
                <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
                  <h3 style={{
                    color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                    fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                    marginBottom: "20px", opacity: 0.8,
                  }}>🛠 Skills</h3>

                  {/* ── ZONE 1: YOUR OWN SKILLS (teal) ──────────────────── */}
                  {yourCategories.length > 0 && (
                    <div style={{
                      background: "rgba(45,90,61,0.05)",
                      border: "1px solid rgba(45,90,61,0.12)",
                      borderRadius: "12px",
                      padding: "16px 18px",
                      marginBottom: newCategories.length > 0 ? "20px" : "0",
                    }}>
                      {/* Zone header */}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                        <div style={{
                          width: "10px", height: "10px", borderRadius: "50%",
                          background: "#2D5A3D", flexShrink: 0,
                        }} />
                        <p style={{
                          color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                          fontSize: "12px", letterSpacing: "1.5px",
                          textTransform: "uppercase", margin: 0,
                        }}>
                          Your Skills — from your profile
                        </p>
                        {/* Count badge */}
                        <span style={{
                          background: "rgba(45,90,61,0.15)",
                          border: "1px solid rgba(45,90,61,0.3)",
                          color: "#2D5A3D", fontSize: "11px",
                          padding: "2px 8px", borderRadius: "10px",
                          fontFamily: "'Libre Baskerville', serif",
                        }}>
                          {yourCategories.reduce((total, cat) => total + (cat.skills_list?.length || 0), 0)} skills
                        </span>
                      </div>

                      {yourCategories.map((category, catIndex) => (
                        <div key={catIndex} style={{
                          marginBottom: catIndex < yourCategories.length - 1 ? "16px" : "0",
                        }}>
                          {/* Sub-category label (only show if more than one category) */}
                          {yourCategories.length > 1 && (
                            <p style={{
                              color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                              fontSize: "10px", opacity: 0.35, letterSpacing: "1.5px",
                              textTransform: "uppercase", marginBottom: "10px",
                            }}>
                              {category.category}
                            </p>
                          )}
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                            gap: "10px",
                          }}>
                            {category.skills_list?.map((skillObj, si) => SkillCard(skillObj, si))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── ZONE 2: NEW SKILLS FROM JOB DESCRIPTION (amber) ── */}
                  {newCategories.length > 0 && (
                    <div style={{
                      background: "rgba(255,179,71,0.06)",
                      border: "1px solid rgba(255,179,71,0.15)",
                      borderRadius: "12px",
                      padding: "16px 18px",
                    }}>
                      {/* Zone header */}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                        <div style={{
                          width: "10px", height: "10px", borderRadius: "50%",
                          background: "#FFB347", flexShrink: 0,
                        }} />
                        <p style={{
                          color: "#FFB347", fontFamily: "'Libre Baskerville', serif",
                          fontSize: "12px", letterSpacing: "1.5px",
                          textTransform: "uppercase", margin: 0,
                        }}>
                          Added from Job Description
                        </p>
                        <span style={{
                          background: "rgba(255,179,71,0.15)",
                          border: "1px solid rgba(255,179,71,0.3)",
                          color: "#FFB347", fontSize: "11px",
                          padding: "2px 8px", borderRadius: "10px",
                          fontFamily: "'Libre Baskerville', serif",
                        }}>
                          {newCategories.reduce((total, cat) => total + (cat.skills_list?.length || 0), 0)} new
                        </span>
                      </div>

                      {/* Explanatory note */}
                      <p style={{
                        color: "#1E2018", fontSize: "11px", opacity: 0.45,
                        marginBottom: "14px", lineHeight: "1.5",
                        fontFamily: "system-ui, sans-serif",
                      }}>
                        These skills appear in the job description but were not in your profile.
                        They are included on your CV — consider adding them to your profile if you have them.
                      </p>

                      {newCategories.map((category, catIndex) => (
                        <div key={catIndex} style={{
                          marginBottom: catIndex < newCategories.length - 1 ? "16px" : "0",
                        }}>
                          {newCategories.length > 1 && (
                            <p style={{
                              color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                              fontSize: "10px", opacity: 0.35, letterSpacing: "1.5px",
                              textTransform: "uppercase", marginBottom: "10px",
                            }}>
                              {category.category}
                            </p>
                          )}
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                            gap: "10px",
                          }}>
                            {category.skills_list?.map((skillObj, si) => SkillCard(skillObj, si))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })()}


            {/* ── EXPERIENCE ────────────────────────────── */}
            {result.experience?.length > 0 && (
              <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
                <h3 style={{
                  color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                  marginBottom: "20px", opacity: 0.8,
                }}>💼 Experience</h3>

                {result.experience.map((job, index) => (
                  <div key={index} style={{
                    marginBottom: index < result.experience.length - 1 ? "28px" : "0",
                    paddingBottom: index < result.experience.length - 1 ? "28px" : "0",
                    borderBottom: index < result.experience.length - 1
                      ? "1px solid rgba(45,90,61,0.08)" : "none",
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", flexWrap: "wrap", gap: "8px", marginBottom: "14px",
                    }}>
                      <div>
                        <p style={{
                          color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                          fontSize: "15px", marginBottom: "3px",
                        }}>{job.role}</p>
                        <p style={{ color: "#2D5A3D", fontSize: "13px", opacity: 0.75 }}>{job.company}</p>
                      </div>
                      {job.dates && (
                        <span style={{
                          background: "rgba(45,90,61,0.08)", border: "1px solid rgba(45,90,61,0.2)",
                          color: "#1E2018", padding: "4px 12px", borderRadius: "20px",
                          fontSize: "12px", opacity: 0.65, fontFamily: "'Libre Baskerville', serif",
                          whiteSpace: "nowrap",
                        }}>{job.dates}</span>
                      )}
                    </div>
                    {job.bullets?.map((bullet, bi) => (
                      <div key={bi} style={{
                        display: "flex",  gap: "10px", marginBottom: "8px", alignItems: "flex-start",
                      }}>
                        <span style={{ color: "#2D5A3D", fontSize: "12px", marginTop: "3px", flexShrink: 0 }}>→</span>
                        <p style={{ color: "#1E2018", fontSize: "13px", lineHeight: "1.65", opacity: 0.85, margin: 0 }}>
                          {bullet}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}


            {/* ══ EDUCATION ════════════════════════════════
                Shows ALL fields from your saved profile:
                  - Degree, institution, location, graduation date
                  - minimumAverage (now correctly shown — was missing before)
                  - Coursework items with their AI-generated descriptions
            ════════════════════════════════════════════════ */}
            {result.education?.length > 0 && (
              <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
                <h3 style={{
                  color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                  marginBottom: "20px", opacity: 0.8,
                }}>🎓 Education</h3>

                {result.education.map((edu, index) => (
                  <div key={index} style={{
                    marginBottom: index < result.education.length - 1 ? "28px" : 0,
                    paddingBottom: index < result.education.length - 1 ? "28px" : 0,
                    borderBottom: index < result.education.length - 1
                      ? "1px solid rgba(45,90,61,0.08)" : "none",
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      flexWrap: "wrap", gap: "8px", marginBottom: "12px",
                    }}>
                      <div>
                        <p style={{
                          color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                          fontSize: "15px", marginBottom: "3px",
                        }}>{edu.degree}</p>
                        <p style={{ color: "#2D5A3D", fontSize: "13px", opacity: 0.75 }}>
                          {edu.institution}
                          {edu.city ? ` — ${edu.city}` : ""}
                          {edu.country ? `, ${edu.country}` : ""}
                        </p>
                      </div>
                      {(edu.graduationMonth || edu.graduationYear) && (
                        <span style={{
                          background: "rgba(45,90,61,0.08)", border: "1px solid rgba(45,90,61,0.2)",
                          color: "#1E2018", padding: "4px 12px", borderRadius: "20px",
                          fontSize: "12px", opacity: 0.65, fontFamily: "'Libre Baskerville', serif",
                          whiteSpace: "nowrap",
                        }}>
                          {edu.graduationStatus === "expected" ? "Expected: " : ""}
                          {edu.graduationMonth} {edu.graduationYear}
                        </span>
                      )}
                    </div>

                    {/* ── Minimum Average — NOW SHOWING ── */}
                    {edu.minimumAverage && (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: "8px",
                        background: "rgba(45,90,61,0.08)", border: "1px solid rgba(45,90,61,0.2)",
                        borderRadius: "8px", padding: "6px 14px", marginBottom: "14px",
                      }}>
                        <span style={{ color: "#FFB347", fontSize: "14px" }}>★</span>
                        <span style={{
                          color: "#1E2018", fontSize: "13px",
                          fontFamily: "'Libre Baskerville', serif", opacity: 0.9,
                        }}>
                          Minimum Average: {edu.minimumAverage}
                        </span>
                      </div>
                    )}

                    {/* ── Coursework with descriptions ── */}
                    {edu.coursework?.filter(c => c?.trim()).length > 0 && (
                      <div>
                        <p style={{
                          color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                          fontSize: "11px", opacity: 0.4, letterSpacing: "1px",
                          textTransform: "uppercase", marginBottom: "10px",
                        }}>
                          Relevant Coursework
                        </p>
                        {edu.coursework.filter(c => c?.trim()).map((item, i) => {
                          // Each item may be "Course Name: Description" — split on first ":"
                          // If there's no colon, show the item as-is without a description panel.
                          const colonIndex = item.indexOf(":");
                          const courseName = colonIndex > -1 ? item.substring(0, colonIndex).trim() : item.trim();
                          const courseDesc = colonIndex > -1 ? item.substring(colonIndex + 1).trim() : "";

                          return (
                            <div key={i} style={{
                              background: "#FFFFFF",
                              border: "1px solid rgba(45,90,61,0.08)",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              marginBottom: "8px",
                            }}>
                              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                <span style={{
                                  color: "#2D5A3D", fontSize: "12px", marginTop: "2px", flexShrink: 0,
                                }}>•</span>
                                <div>
                                  <p style={{
                                    color: "#1E2018", fontSize: "13px",
                                    fontFamily: "'Libre Baskerville', serif",
                                    fontWeight: "900", marginBottom: courseDesc ? "4px" : 0,
                                  }}>
                                    {courseName}
                                  </p>
                                  {courseDesc && (
                                    <p style={{
                                      color: "#1E2018", fontSize: "12px",
                                      opacity: 0.55, lineHeight: "1.55",
                                      margin: 0, fontFamily: "system-ui, sans-serif",
                                    }}>
                                      {courseDesc}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}


            {/* ── PROJECT EXPERIENCE ────────────────────── */}
            {result.project_experience?.length > 0 && (
              <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
                <h3 style={{
                  color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                  marginBottom: "20px", opacity: 0.8,
                }}>🚀 Project Experience</h3>

                {result.project_experience.map((proj, index) => (
                  <div key={index} style={{
                    marginBottom: index < result.project_experience.length - 1 ? "28px" : "0",
                    paddingBottom: index < result.project_experience.length - 1 ? "28px" : "0",
                    borderBottom: index < result.project_experience.length - 1
                      ? "1px solid rgba(45,90,61,0.08)" : "none",
                  }}>
                    <div style={{ marginBottom: "4px", display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "10px" }}>
                      <p style={{
                        color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                        fontSize: "15px", margin: 0,
                      }}>{proj.title}</p>
                      {proj.url && (
                        <a href={proj.url} target="_blank" rel="noreferrer" style={{
                          color: "#2D5A3D", fontSize: "12px", opacity: 0.75,
                          textDecoration: "none",
                        }}>↗ {proj.url}</a>
                      )}
                    </div>
                    {proj.tech_stack && (
                      <p style={{ color: "#2D5A3D", fontSize: "12px", opacity: 0.65, marginBottom: "12px" }}>
                        {proj.tech_stack}
                      </p>
                    )}
                    {proj.bullets?.map((bullet, bi) => (
                      <div key={bi} style={{
                        display: "flex",  gap: "10px", marginBottom: "8px", alignItems: "flex-start",
                      }}>
                        <span style={{ color: "#2D5A3D", fontSize: "12px", marginTop: "3px", flexShrink: 0 }}>→</span>
                        <p style={{ color: "#1E2018", fontSize: "13px", lineHeight: "1.65", opacity: 0.85, margin: 0 }}>
                          {bullet}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}


            {/* ══ LANGUAGES ════════════════════════════════
                Redesigned to match the screenshot style:
                Bold dark rectangular blocks for filled levels,
                lighter blocks for empty levels — clean and professional.
                Shows the language name bold, level code, and full label below.
            ════════════════════════════════════════════════ */}
            {result.languages?.length > 0 && (
              <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
                <h3 style={{
                  color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                  marginBottom: "20px", opacity: 0.8,
                }}>🌐 Languages</h3>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "16px",
                }}>
                  {result.languages.map((lang, index) => {
                    const level = typeof lang.level === "number" ? lang.level : 3;
                    const fullLabel = CEFR_LABELS[level] || "";
                    // Extract just the CEFR code e.g. "C2" from "Bilingual or Proficient (C2)"
                    const cefrCode = fullLabel.match(/\(([^)]+)\)/)?.[1] || "";
                    // Text before the brackets e.g. "Bilingual or Proficient"
                    const cefrText = fullLabel.replace(/\s*\([^)]*\)/, "").trim();

                    return (
                      <div key={index} style={{
                        background: "#FFFFFF",
                        borderRadius: "10px",
                        padding: "18px 20px",
                        border: "1px solid rgba(45,90,61,0.12)",
                      }}>

                        {/* Row 1: Language name + CEFR code badge side by side */}
                        <div style={{
                          display: "flex", alignItems: "center",
                          justifyContent: "space-between", marginBottom: "12px",
                        }}>
                          <p style={{
                            color: "#1E2018",
                            fontFamily: "'Libre Baskerville', serif",
                            fontSize: "16px", fontWeight: "900",
                            margin: 0, letterSpacing: "0.3px",
                          }}>
                            {lang.name}
                          </p>
                          {/* CEFR code badge — e.g. "C2" — bold and prominent */}
                          {cefrCode && (
                            <span style={{
                              background: "rgba(45,90,61,0.15)",
                              border: "1px solid rgba(45,90,61,0.4)",
                              color: "#2D5A3D",
                              fontFamily: "'Libre Baskerville', serif",
                              fontSize: "13px", fontWeight: "900",
                              padding: "3px 10px", borderRadius: "6px",
                              letterSpacing: "1px",
                            }}>
                              {cefrCode}
                            </span>
                          )}
                        </div>

                        {/* Row 2: Block bars — dark filled, grey empty
                            Each block is a thick rounded rectangle.
                            Filled = solid dark teal (#2D5A3D), empty = faint */}
                        <div style={{
                          display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "10px",
                        }}>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{
                              flex: 1,
                              height: "12px",
                              borderRadius: "3px",
                              background: i < level
                                ? "#2D5A3D"                    // dark teal — filled
                                : "rgba(30,32,24,0.10)",    // very faint — empty
                              transition: "background 0.2s ease",
                            }} />
                          ))}
                        </div>

                        {/* Row 3: Full proficiency label text */}
                        <p style={{
                          color: "#1E2018",
                          fontSize: "11px",
                          opacity: 0.5,
                          fontFamily: "'Libre Baskerville', serif",
                          margin: 0, letterSpacing: "0.3px",
                        }}>
                          {cefrText}
                        </p>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            {/* ── REFERENCES ────────────────────────────── */}
            {result.references && (
              <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
                <h3 style={{
                  color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase",
                  marginBottom: "16px", opacity: 0.8,
                }}>📋 References</h3>
                <p style={{ color: "#1E2018", fontSize: "14px", opacity: 0.85, lineHeight: "1.7" }}>
                  {result.references}
                </p>
              </div>
            )}


            {/* ── ACTION BUTTONS ────────────────────────── */}
            <div style={{
              display: "flex", gap: "16px", flexWrap: "wrap",
              justifyContent: "center", alignItems: "flex-start", paddingBottom: "40px",
            }}>

              {/* ── Download CV ── */}
              <div style={{ textAlign: "center" }}>
                <button
                  className="primary-btn"
                  onClick={handleDownload}
                  disabled={downloading}
                  style={{
                    fontSize: "15px", padding: "13px 36px",
                    opacity: downloading ? 0.65 : 1,
                    cursor: downloading ? "not-allowed" : "pointer",
                    background: downloading ? "#3D7A55" : "#2D5A3D",
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
                  }}
                >
                  {downloading ? (
                    <>
                      <span style={{
                        display: "inline-block", width: "14px", height: "14px",
                        border: "2px solid #2D5A3D", borderTopColor: "transparent",
                        borderRadius: "50%", animation: "spin 0.7s linear infinite",
                      }} />
                      Preparing...
                    </>
                  ) : "⬇ Download CV"}
                </button>
                {downloadError && (
                  <p style={{ color: "#8B2020", fontSize: "12px", marginTop: "8px", maxWidth: "260px" }}>
                    {downloadError}
                  </p>
                )}
              </div>

              {/* ── Save to Cabinet ── */}
              <div style={{ textAlign: "center" }}>
                <button
                  className="primary-btn"
                  onClick={handleSaveToCabinet}
                  disabled={saving || saved}
                  style={{
                    fontSize: "15px", padding: "13px 36px",
                    display: "flex", alignItems: "center", gap: "8px",
                    // Teal when ready, green-teal when saved, faded when saving
                    background: saved   ? "#3D7A55"
                              : saving  ? "#2D5A3D"
                              : "#2D5A3D",
                    opacity: saving ? 0.75 : 1,
                    cursor: (saving || saved) ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? (
                    <>
                      <span style={{
                        display: "inline-block", width: "14px", height: "14px",
                        border: "2px solid #2D5A3D", borderTopColor: "transparent",
                        borderRadius: "50%", animation: "spin 0.7s linear infinite",
                      }} />
                      Saving...
                    </>
                  ) : saved ? (
                    "✓ Saved to Cabinet!"
                  ) : (
                    "🗂️ Save to Cabinet"
                  )}
                </button>
                {/* Error message if save failed */}
                {saveError && (
                  <p style={{ color: "#8B2020", fontSize: "12px", marginTop: "8px", maxWidth: "260px" }}>
                    {saveError}
                  </p>
                )}
                {/* Subtle hint shown after saving — directs user to the cabinet */}
                {saved && (
                  <p
                    onClick={() => navigate("/cabinet")}
                    style={{
                      color: "#2D5A3D", fontSize: "12px", marginTop: "8px",
                      cursor: "pointer", textDecoration: "underline", opacity: 0.8,
                    }}
                  >
                    View in Cabinet →
                  </p>
                )}
              </div>

              {/* ── Copy to Clipboard ── */}
              <button
                className="primary-btn"
                onClick={handleCopy}
                style={{
                  fontSize: "15px", padding: "13px 36px",
                  background: copied ? "#3D7A55" : "#2D5A3D",
                }}
              >
                {copied ? "✓ Copied!" : "⎘ Copy CV to Clipboard"}
              </button>

            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}