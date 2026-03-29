// =============================================================================
// FILE: frontend/src/pages/BulkGenerate.jsx
// =============================================================================
// Personal tool — access at /bulk (not in public nav).
//
// FLOW PER JOB:
//   1. POST /api/generate        → ai_result (CV JSON)
//   2. POST /api/cover-letter    → cover_letter text
//   3. POST /api/bulk-tex        → cv_tex + cover_letter_tex strings
//      (backend uses build_cv_tex + build_cover_letter_tex — same as download)
//
// OUTPUT TABS PER JOB:
//   📄 CV LaTeX            — cv_tex from backend
//   ✉  Cover Letter LaTeX  — cover_letter_tex from backend
//   📦 Combined LaTeX      — both joined with \newpage (preamble merged)
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";


// ─────────────────────────────────────────────────────────────────────────────
// COMBINE: merges two standalone .tex documents into one.
// ─────────────────────────────────────────────────────────────────────────────
function buildCombined(cvTex, clTex) {
  const extractBody = (tex) => {
    const start = tex.indexOf("\\begin{document}");
    const end   = tex.lastIndexOf("\\end{document}");
    if (start === -1 || end === -1) return tex;
    return tex.slice(start + "\\begin{document}".length, end).trim();
  };

  const preamble = cvTex.slice(0, cvTex.indexOf("\\begin{document}")).trim();
  const cvBody   = extractBody(cvTex);
  const clBody   = extractBody(clTex);

  return [
    preamble,
    "",
    "\\begin{document}",
    "",
    "% ═══════════════════════════════════════════════════════════════════════",
    "% COVER LETTER",
    "% ═══════════════════════════════════════════════════════════════════════",
    clBody,
    "",
    "\\newpage",
    "",
    "% ═══════════════════════════════════════════════════════════════════════",
    "% CURRICULUM VITAE",
    "% ═══════════════════════════════════════════════════════════════════════",
    cvBody,
    "",
    "\\end{document}",
  ].join("\n");
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const TONES = ["professional", "enthusiastic", "concise"];

const emptyJob = () => ({
  id:          Date.now() + Math.random(),
  title:       "",
  description: "",
  tone:        "professional",
  status:      "idle",
  activeTab:   "cv",
  cvTex:       "",
  clTex:       "",
  combinedTex: "",
  atsScore:    null,
  error:       "",
});


// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function BulkGenerate() {
  const navigate  = useNavigate();
  const [profile, setProfile] = useState(null);
  const [jobs,    setJobs]    = useState([emptyJob()]);
  const [running, setRunning] = useState(false);
  const [copied,  setCopied]  = useState(null);
  const [wishlistedIds, setWishlistedIds] = useState(new Set());
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get("/profile")
      .then(r => { if (r.data && Object.keys(r.data).length > 0) setProfile(r.data); })
      .catch(() => {});
  }, []);

  const addJob    = () => setJobs(prev => [...prev, emptyJob()]);
  const removeJob = (id) => setJobs(prev => prev.filter(j => j.id !== id));
  const patchJob  = (id, patch) =>
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadTex = (content, filename) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── Save one job to Cabinet ──────────────────────────────────────────────
  const handleSaveToCabinet = async (job) => {
    if (!job.cvTex || !job.clTex) return;
    patchJob(job.id, { saving: true, saveError: "" });
    try {
      await api.post("/bulk-save", {
        job_title:        job.title,
        tone:             job.tone,
        cv_tex:           job.cvTex,
        cl_tex:           job.clTex,
        combined_tex:     job.combinedTex,
        cover_letter:     job.coverLetterText || "",
        ai_result:        job.aiResult        || {},
        profile_snapshot: profile              || {},
      });
      patchJob(job.id, { saving: false, saved: true });
      setTimeout(() => patchJob(job.id, { saved: false }), 3000);
    } catch (err) {
      const msg = err.response?.data?.message || "Save failed. Please try again.";
      patchJob(job.id, { saving: false, saveError: msg });
    }
  };

  const handleSaveWishlist = async (job) => {
    if (wishlistedIds.has(job.id)) return;
    try {
      await api.post("/tracker", {
        company: "",
        role:    job.title || "",
        status:  "Wishlist",
        salary:  "",
        notes:   job.description ? job.description.slice(0, 200) : "",
        url:     "",
      });
      setWishlistedIds(prev => new Set([...prev, job.id]));
    } catch (err) {
      alert("Could not save to Wishlist. Please try again.");
    }
  };

  // ── Generate one job (3 sequential API calls) ─────────────────────────────
  const generateOne = async (job) => {
    if (!job.title.trim() || !job.description.trim()) return;
    patchJob(job.id, { status: "generating", error: "" });

    try {
      // 1 — Generate CV JSON
      const cvResp = await api.post("/generate", {
        jobDescription:    job.description,
        personalInfo:      profile?.personalInfo      || {},
        baseSkills:        profile?.skills            || [],
        baseExperience:    profile?.experience        || [],
        projectExperience: profile?.projects          || [],
        education:         profile?.education         || [],
        languages:         profile?.languages         || [],
        references:        profile?.references        || "Available upon Request",
      });
      const aiResult = cvResp.data;

      // 2 — Generate cover letter text
      const clResp = await api.post("/cover-letter", {
        jobDescription: job.description,
        tone:           job.tone,
      });
      const coverLetterText = clResp.data.cover_letter || "";

      // 3 — Build LaTeX server-side (uses real cv_latex.py + cover_letter_latex.py)
      const texResp = await api.post("/bulk-tex", {
        ai_result:    aiResult,
        cover_letter: coverLetterText,
        job_title:    job.title,
      });
      const cvTex = texResp.data.cv_tex           || "";
      const clTex = texResp.data.cover_letter_tex || "";

      patchJob(job.id, {
        status:          "done",
        activeTab:       "cv",
        cvTex,
        clTex,
        combinedTex:     buildCombined(cvTex, clTex),
        atsScore:        aiResult?.ats?.final_score ?? null,
        error:           "",
        aiResult,
        coverLetterText,
        saved:           false,
        saveError:       "",
      });

    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Generation failed";
      patchJob(job.id, { status: "error", error: msg });
    }
  };

  const handleGenerateAll = async () => {
    const pending = jobs.filter(
      j => j.title.trim() && j.description.trim() && j.status !== "done"
    );
    if (!pending.length) return;
    setRunning(true);
    for (const job of pending) await generateOne(job);
    setRunning(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cardBorderLeft = (status) =>
    status === "done"       ? "4px solid #2D5A3D"
    : status === "error"      ? "4px solid #8B2020"
    : status === "generating" ? "4px solid #FFB347"
    : "4px solid rgba(45,90,61,0.15)";

  const inputStyle = {
    width: "100%", background: "#FFFFFF",
    border: "1px solid rgba(45,90,61,0.2)", borderRadius: "8px",
    color: "#1E2018", padding: "11px 14px", fontSize: "13px",
    fontFamily: "system-ui, sans-serif", outline: "none",
  };

  const labelStyle = {
    color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
    fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase",
    marginBottom: "8px", opacity: 0.8, display: "block",
  };

  const codeStyle = {
    background: "#1A1E1A", color: "#A8D5B5",
    fontFamily: "'Courier New', monospace", fontSize: "11px",
    lineHeight: "1.6", padding: "16px", borderRadius: "8px",
    maxHeight: "340px", overflowY: "auto", overflowX: "auto",
    whiteSpace: "pre", marginBottom: "10px",
  };

  const btn = (bg = "#2D5A3D", color = "#EDE8DE") => ({
    background: bg, color, border: "none", borderRadius: "8px",
    padding: "8px 16px", cursor: "pointer", fontSize: "12px",
    fontFamily: "'Libre Baskerville', serif", fontWeight: 900,
  });

  const StatusBadge = ({ status }) => {
    const map = {
      idle:       { label: "Pending",       bg: "rgba(30,32,24,0.08)",   color: "#1E2018"  },
      generating: { label: "⏳ Generating…", bg: "rgba(255,179,71,0.15)", color: "#B8860B"  },
      done:       { label: "✓ Done",         bg: "rgba(45,90,61,0.12)",   color: "#2D5A3D"  },
      error:      { label: "✗ Error",        bg: "rgba(139,32,32,0.1)",   color: "#8B2020"  },
    };
    const s = map[status] || map.idle;
    return (
      <span style={{
        background: s.bg, color: s.color, padding: "3px 10px",
        borderRadius: "20px", fontSize: "11px",
        fontFamily: "'Libre Baskerville', serif",
      }}>{s.label}</span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(980px, 100%)", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontFamily: "'Libre Baskerville', serif",
            fontSize: "clamp(20px, 4vw, 30px)",
            color: "#2D5A3D", letterSpacing: "2px", marginBottom: "6px",
          }}>
            ⚡ Bulk Generator
          </h1>
          <p style={{ color: "#1E2018", opacity: 0.5, fontSize: "13px" }}>
            Add multiple jobs — generates a tailored CV + cover letter in LaTeX for each, using your exact templates.
            {!profile && (
              <> {" "}
                <span onClick={() => navigate("/profile")}
                  style={{ color: "#2D5A3D", cursor: "pointer", textDecoration: "underline" }}>
                  Set up your profile first.
                </span>
              </>
            )}
          </p>
        </div>

        {/* Job cards */}
        {jobs.map((job, index) => (
          <div key={job.id} style={{
            background: "#F5F0E8", border: "1px solid rgba(45,90,61,0.15)",
            borderLeft: cardBorderLeft(job.status),
            borderRadius: "14px", padding: "24px", marginBottom: "20px",
          }}>

            {/* Card header row */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{
                  width: "26px", height: "26px", borderRadius: "50%",
                  background: "rgba(45,90,61,0.12)", color: "#2D5A3D",
                  fontFamily: "'Libre Baskerville', serif", fontSize: "12px",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>{index + 1}</span>
                <StatusBadge status={job.status} />
              </div>
              {jobs.length > 1 && job.status === "idle" && (
                <button onClick={() => removeJob(job.id)} style={{
                  background: "transparent", border: "none",
                  color: "#8B2020", cursor: "pointer", fontSize: "20px", opacity: 0.5,
                }}>×</button>
              )}
            </div>

            {/* Input form */}
            {job.status !== "done" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Job Title</label>
                  <input style={inputStyle}
                    placeholder="e.g. Frontend Developer at Acme Corp"
                    value={job.title}
                    onChange={e => patchJob(job.id, { title: e.target.value })} />
                </div>

                <div>
                  <label style={labelStyle}>Job Description</label>
                  <textarea
                    style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }}
                    rows={6}
                    placeholder="Paste the full job description here..."
                    value={job.description}
                    onChange={e => patchJob(job.id, { description: e.target.value })} />
                </div>

                <div>
                  <label style={labelStyle}>Cover Letter Tone</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {TONES.map(t => (
                      <button key={t} onClick={() => patchJob(job.id, { tone: t })} style={{
                        padding: "8px 18px", borderRadius: "8px", cursor: "pointer",
                        fontFamily: "'Libre Baskerville', serif", fontSize: "12px",
                        border:     job.tone === t ? "2px solid #2D5A3D" : "2px solid rgba(45,90,61,0.2)",
                        background: job.tone === t ? "rgba(45,90,61,0.12)" : "transparent",
                        color:      job.tone === t ? "#2D5A3D" : "#1E2018",
                        opacity:    job.tone === t ? 1 : 0.55,
                      }}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {job.status === "generating" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0" }}>
                    <span style={{
                      width: "16px", height: "16px", display: "inline-block",
                      border: "2px solid #2D5A3D", borderTopColor: "transparent",
                      borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
                    }} />
                    <span style={{ color: "#2D5A3D", fontSize: "13px", fontFamily: "'Libre Baskerville', serif" }}>
                      Generating CV + cover letter + LaTeX…
                    </span>
                  </div>
                )}

                {job.status === "error" && (
                  <p style={{ color: "#8B2020", fontSize: "13px" }}>⚠ {job.error}</p>
                )}
              </div>
            )}

            {/* Results */}
            {job.status === "done" && (() => {
              const slug = job.title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
              const tabs = [
                { key: "cv",       label: "📄 CV LaTeX",          content: job.cvTex,       file: `CV_${slug}.tex` },
                { key: "cl",       label: "✉ Cover Letter LaTeX", content: job.clTex,       file: `CoverLetter_${slug}.tex` },
                { key: "combined", label: "📦 Combined LaTeX",     content: job.combinedTex, file: `Combined_${slug}.tex` },
              ];
              const activeTab  = job.activeTab || "cv";
              const activeData = tabs.find(t => t.key === activeTab) || tabs[0];
              const copyKey    = `${job.id}-${activeTab}`;

              return (
                <div>
                  <p style={{
                    color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                    fontSize: "15px", marginBottom: "16px",
                  }}>
                    {job.title}
                    {job.atsScore !== null && (
                      <span style={{ fontSize: "12px", opacity: 0.4, marginLeft: "10px" }}>
                        ATS {job.atsScore}%
                      </span>
                    )}
                  </p>

                  {/* Tabs */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                    {tabs.map(tab => (
                      <button key={tab.key}
                        onClick={() => patchJob(job.id, { activeTab: tab.key })}
                        style={{
                          padding: "8px 14px", borderRadius: "8px", cursor: "pointer",
                          fontFamily: "'Libre Baskerville', serif", fontSize: "12px",
                          border:     activeTab === tab.key ? "2px solid #2D5A3D" : "2px solid rgba(45,90,61,0.2)",
                          background: activeTab === tab.key ? "rgba(45,90,61,0.12)" : "transparent",
                          color:      "#1E2018",
                          opacity:    activeTab === tab.key ? 1 : 0.6,
                        }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Code */}
                  <pre style={codeStyle}>{activeData.content}</pre>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <button onClick={() => copyText(activeData.content, copyKey)} style={btn()}>
                      {copied === copyKey ? "✓ Copied!" : "⎘ Copy"}
                    </button>
                    <button onClick={() => downloadTex(activeData.content, activeData.file)}
                      style={btn("rgba(45,90,61,0.1)", "#2D5A3D")}>
                      ⬇ Download .tex
                    </button>
                    <button
                      onClick={() => handleSaveToCabinet(job)}
                      disabled={job.saving || job.saved}
                      style={{
                        ...btn(job.saved ? "rgba(45,90,61,0.15)" : "rgba(45,90,61,0.08)", "#2D5A3D"),
                        border: "1px solid rgba(45,90,61,0.35)",
                        opacity: job.saving ? 0.6 : 1,
                        display: "flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      {job.saving ? (
                        <>
                          <span style={{
                            display: "inline-block", width: "10px", height: "10px",
                            border: "2px solid #2D5A3D", borderTopColor: "transparent",
                            borderRadius: "50%", animation: "spin 0.7s linear infinite",
                          }} />
                          Saving…
                        </>
                      ) : job.saved ? "✓ Saved to Cabinet!" : "🗂 Save to Cabinet"}
                    </button>
                    <button
                      onClick={() => handleSaveWishlist(job)}
                      disabled={wishlistedIds.has(job.id)}
                      style={{
                        ...btn(
                          wishlistedIds.has(job.id) ? "rgba(45,90,61,0.12)" : "transparent",
                          "#2D5A3D"
                        ),
                        border: `1px solid ${wishlistedIds.has(job.id) ? "#2D5A3D" : "rgba(45,90,61,0.35)"}`,
                        cursor: wishlistedIds.has(job.id) ? "default" : "pointer",
                      }}
                    >
                      {wishlistedIds.has(job.id) ? "✓ Wishlisted!" : "⭐ Save to Wishlist"}
                    </button>
                    <button onClick={() => patchJob(job.id, { status: "idle", activeTab: "cv" })}
                      style={btn("rgba(139,32,32,0.08)", "#8B2020")}>
                      ✎ Re-generate
                    </button>
                  </div>
                  {job.saveError && (
                    <p style={{ color: "#8B2020", fontSize: "12px", marginTop: "8px" }}>
                      ⚠ {job.saveError}
                    </p>
                  )}
                </div>
              );
            })()}

          </div>
        ))}


        {/* Add job */}
        <button onClick={addJob} style={{
          background: "transparent",
          border: "2px dashed rgba(45,90,61,0.3)",
          color: "#2D5A3D", borderRadius: "12px", padding: "16px",
          cursor: "pointer", fontSize: "14px",
          fontFamily: "'Libre Baskerville', serif",
          width: "100%", marginBottom: "28px",
          transition: "border-color 0.2s ease",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#2D5A3D"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(45,90,61,0.3)"}
        >
          + Add Another Job
        </button>


        {/* Sticky generate button */}
        <div style={{
          position: "sticky", bottom: "20px", zIndex: 100,
          display: "flex", justifyContent: "center", paddingBottom: "40px",
        }}>
          <button
            onClick={handleGenerateAll}
            disabled={running || jobs.every(j => !j.title.trim() || !j.description.trim())}
            style={{
              ...btn(running ? "rgba(45,90,61,0.5)" : "#2D5A3D"),
              borderRadius: "12px", padding: "16px 48px", fontSize: "15px",
              boxShadow: "0 4px 20px rgba(45,90,61,0.3)",
              display: "flex", alignItems: "center", gap: "12px",
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            {running ? (
              <>
                <span style={{
                  width: "16px", height: "16px", display: "inline-block",
                  border: "2px solid #EDE8DE", borderTopColor: "transparent",
                  borderRadius: "50%", animation: "spin 0.7s linear infinite",
                }} />
                Generating…
              </>
            ) : (
              `⚡ Generate All (${jobs.filter(j => j.title.trim() && j.description.trim() && j.status !== "done").length} pending)`
            )}
          </button>
        </div>

        <div ref={bottomRef} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      </div>
    </DashboardLayout>
  );
}