// =============================================================================
// FILE: frontend/src/pages/BulkGenerate.jsx
// =============================================================================
// Personal tool — not linked in the public nav.
// Access it directly at /bulk
//
// WHAT IT DOES:
//   - Add multiple jobs (title + description)
//   - Generate CV + cover letter for each job in sequence
//   - Output clean LaTeX code for each
//   - Option to combine CV + cover letter into one LaTeX document
//   - Copy or download each result
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

// ─────────────────────────────────────────────────────────────────────────────
// LATEX BUILDERS
// Converts the AI JSON result into LaTeX source code.
// ─────────────────────────────────────────────────────────────────────────────

function escapeLatex(str = "") {
  return String(str)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g,  "\\&")
    .replace(/%/g,  "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g,  "\\#")
    .replace(/_/g,  "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g,  "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/</g,  "\\textless{}")
    .replace(/>/g,  "\\textgreater{}");
}

function buildCVLatex(result, profile) {
  const p = result.personalInfo || profile?.personalInfo || {};
  const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Your Name";

  // ── HEADER ────────────────────────────────────────────────────────────────
  const contactParts = [
    p.city,
    p.phone,
    p.email,
    p.github  ? `\\href{${p.github}}{GitHub}` : null,
    p.website ? `\\href{${p.website}}{Portfolio}` : null,
  ].filter(Boolean).map(escapeLatex);

  // ── SKILLS ────────────────────────────────────────────────────────────────
  let skillsBlock = "";
  if (result.skills?.length > 0) {
    const allSkills = result.skills.flatMap(cat =>
      (cat.skills_list || []).map(s => escapeLatex(s.skill || s))
    );
    skillsBlock = `
\\section{Skills}
\\begin{itemize}[leftmargin=*, nosep]
  \\item ${allSkills.join(" \\quad\\textbullet\\quad ")}
\\end{itemize}`;
  }

  // ── EXPERIENCE ────────────────────────────────────────────────────────────
  let expBlock = "";
  if (result.experience?.length > 0) {
    expBlock = `\n\\section{Experience}`;
    result.experience.forEach(job => {
      expBlock += `
\\subsection*{${escapeLatex(job.role || job.title || "")} --- ${escapeLatex(job.company || "")}}
\\textit{${escapeLatex(job.dates || `${job.startYear || ""} -- ${job.endYear || "Present"}`)}}
\\begin{itemize}[leftmargin=*, nosep]`;
      (job.bullets || []).forEach(b => {
        expBlock += `\n  \\item ${escapeLatex(b)}`;
      });
      expBlock += `\n\\end{itemize}`;
    });
  }

  // ── EDUCATION ─────────────────────────────────────────────────────────────
  let eduBlock = "";
  if (result.education?.length > 0) {
    eduBlock = `\n\\section{Education}`;
    result.education.forEach(edu => {
      const gradDate = [edu.graduationMonth, edu.graduationYear].filter(Boolean).join(" ");
      eduBlock += `
\\subsection*{${escapeLatex(edu.degree || "")}}
${escapeLatex(edu.institution || "")}${edu.city ? ", " + escapeLatex(edu.city) : ""}${edu.country ? ", " + escapeLatex(edu.country) : ""}
\\hfill ${edu.graduationStatus === "expected" ? "Expected: " : ""}${escapeLatex(gradDate)}`;
      if (edu.minimumAverage) {
        eduBlock += `\n\\\\\\textit{Minimum Average: ${escapeLatex(edu.minimumAverage)}}`;
      }
      const cw = (edu.coursework || []).filter(c => c?.trim());
      if (cw.length > 0) {
        eduBlock += `\n\\begin{itemize}[leftmargin=*, nosep]`;
        cw.forEach(c => { eduBlock += `\n  \\item ${escapeLatex(c)}`; });
        eduBlock += `\n\\end{itemize}`;
      }
    });
  }

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  let projBlock = "";
  if (result.project_experience?.length > 0) {
    projBlock = `\n\\section{Project Experience}`;
    result.project_experience.forEach(proj => {
      projBlock += `
\\subsection*{${escapeLatex(proj.title || proj.name || "")}}`;
      if (proj.url) projBlock += `\n\\href{${proj.url}}{${escapeLatex(proj.url)}}`;
      if (proj.tech_stack) projBlock += `\n\\\\\\textit{${escapeLatex(proj.tech_stack)}}`;
      projBlock += `\n\\begin{itemize}[leftmargin=*, nosep]`;
      (proj.bullets || []).forEach(b => { projBlock += `\n  \\item ${escapeLatex(b)}`; });
      projBlock += `\n\\end{itemize}`;
    });
  }

  // ── LANGUAGES ─────────────────────────────────────────────────────────────
  const CEFR = ["","A1","A2","B1","B2","C1","C2"];
  let langBlock = "";
  if (result.languages?.length > 0) {
    const langs = result.languages.map(l =>
      `${escapeLatex(l.name)} (${CEFR[l.level] || "B1"})`
    ).join(", ");
    langBlock = `\n\\section{Languages}\n${langs}`;
  }

  // ── REFERENCES ────────────────────────────────────────────────────────────
  const refBlock = result.references
    ? `\n\\section{References}\n${escapeLatex(result.references)}`
    : "";

  return `\\documentclass[10pt,a4paper]{article}
\\usepackage[margin=2cm]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{parskip}
\\hypersetup{colorlinks=true, urlcolor=blue}

% Section formatting
\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing{\\section}{0pt}{8pt}{4pt}

\\begin{document}

% ── HEADER ───────────────────────────────────────────────────────────────────
\\begin{center}
  {\\LARGE\\bfseries ${escapeLatex(fullName)}} \\\\[4pt]
  ${escapeLatex(p.jobTitle || "")} \\\\[4pt]
  ${contactParts.join(" $|$ ")}
\\end{center}

% ── SUMMARY ──────────────────────────────────────────────────────────────────
\\section{Professional Summary}
${escapeLatex(result.SUMMARY || "")}
${skillsBlock}
${expBlock}
${eduBlock}
${projBlock}
${langBlock}
${refBlock}

\\end{document}`;
}


function buildCoverLetterLatex(coverLetterText, profile, jobTitle) {
  const p = profile?.personalInfo || {};
  const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Your Name";
  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

  // Split cover letter into paragraphs
  const paragraphs = coverLetterText
    .split(/\n\n+/)
    .map(para => para.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .map(escapeLatex);

  return `\\documentclass[10pt,a4paper]{article}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{parskip}
\\usepackage{hyperref}
\\hypersetup{colorlinks=true, urlcolor=blue}

\\begin{document}

% ── SENDER ───────────────────────────────────────────────────────────────────
{\\bfseries ${escapeLatex(fullName)}}\\\\
${p.city ? escapeLatex(p.city) + "\\\\" : ""}
${p.phone ? escapeLatex(p.phone) + "\\\\" : ""}
${p.email ? `\\href{mailto:${p.email}}{${escapeLatex(p.email)}}\\\\` : ""}
${p.github ? `\\href{${p.github}}{${escapeLatex(p.github)}}\\\\` : ""}

\\vspace{1em}
${escapeLatex(today)}

\\vspace{1em}
Re: Application for \\textbf{${escapeLatex(jobTitle || "the advertised position")}}

\\vspace{1em}

${paragraphs.join("\n\n")}

\\vspace{1em}
Yours sincerely,\\\\[2em]
${escapeLatex(fullName)}

\\end{document}`;
}


function buildCombinedLatex(cvLatex, coverLetterLatex) {
  // Strip \documentclass and preamble from CV — keep only \begin{document}...\end{document}
  const extractBody = (latex) => {
    const start = latex.indexOf("\\begin{document}");
    const end   = latex.indexOf("\\end{document}");
    if (start === -1 || end === -1) return latex;
    return latex.substring(start + "\\begin{document}".length, end).trim();
  };

  // Use the CV preamble as the base (it has more packages)
  const preamble = cvLatex.substring(0, cvLatex.indexOf("\\begin{document}")).trim();
  const clBody   = extractBody(coverLetterLatex);
  const cvBody   = extractBody(cvLatex);

  return `${preamble}

\\begin{document}

% ═══════════════════════════════════════════════════════════════════════════════
% COVER LETTER
% ═══════════════════════════════════════════════════════════════════════════════
${clBody}

\\newpage

% ═══════════════════════════════════════════════════════════════════════════════
% CURRICULUM VITAE
% ═══════════════════════════════════════════════════════════════════════════════
${cvBody}

\\end{document}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const TONES = ["professional", "enthusiastic", "concise"];

const emptyJob = () => ({
  id:          Date.now() + Math.random(),
  title:       "",
  description: "",
  tone:        "professional",
  status:      "idle",   // idle | generating | done | error
  cvResult:    null,
  coverLetter: null,
  cvLatex:     "",
  clLatex:     "",
  combinedLatex: "",
  error:       "",
  showCombined: false,
});

export default function BulkGenerate() {
  const navigate = useNavigate();
  const [profile,  setProfile]  = useState(null);
  const [jobs,     setJobs]     = useState([emptyJob()]);
  const [running,  setRunning]  = useState(false);
  const [copied,   setCopied]   = useState(null);
  const bottomRef = useRef(null);

  // Load profile on mount
  useEffect(() => {
    api.get("/profile")
      .then(r => { if (r.data && Object.keys(r.data).length > 0) setProfile(r.data); })
      .catch(() => {});
  }, []);

  // ── JOB LIST MANAGEMENT ───────────────────────────────────────────────────
  const addJob = () => setJobs(prev => [...prev, emptyJob()]);

  const removeJob = (id) => setJobs(prev => prev.filter(j => j.id !== id));

  const updateJob = (id, field, value) =>
    setJobs(prev => prev.map(j => j.id === id ? { ...j, [field]: value } : j));

  // ── COPY HELPER ───────────────────────────────────────────────────────────
  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── DOWNLOAD HELPER ───────────────────────────────────────────────────────
  const downloadTex = (content, filename) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── GENERATE ONE JOB ─────────────────────────────────────────────────────
  const generateOne = async (job) => {
    if (!job.title.trim() || !job.description.trim()) return;

    updateJob(job.id, "status", "generating");
    updateJob(job.id, "error", "");

    try {
      // 1 — Generate CV
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
      const cvResult = cvResp.data;

      // 2 — Generate Cover Letter
      const clResp = await api.post("/cover-letter", {
        jobDescription: job.description,
        tone:           job.tone,
      });
      const coverLetterText = clResp.data.cover_letter || "";

      // 3 — Build LaTeX
      const cvLatex       = buildCVLatex(cvResult, profile);
      const clLatex       = buildCoverLetterLatex(coverLetterText, profile, job.title);
      const combinedLatex = buildCombinedLatex(cvLatex, clLatex);

      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        status:         "done",
        cvResult,
        coverLetter:    coverLetterText,
        cvLatex,
        clLatex,
        combinedLatex,
        error:          "",
      } : j));

    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Generation failed";
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j, status: "error", error: msg,
      } : j));
    }
  };

  // ── GENERATE ALL ─────────────────────────────────────────────────────────
  const handleGenerateAll = async () => {
    const pending = jobs.filter(j => j.title.trim() && j.description.trim() && j.status !== "done");
    if (!pending.length) return;

    setRunning(true);
    // Run sequentially to avoid hammering the API
    for (const job of pending) {
      await generateOne(job);
    }
    setRunning(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ── STYLES ────────────────────────────────────────────────────────────────
  const cardStyle = {
    background: "#F5F0E8", border: "1px solid rgba(45,90,61,0.15)",
    borderRadius: "14px", padding: "24px", marginBottom: "20px",
  };

  const sectionLabelStyle = {
    color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
    fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase",
    marginBottom: "8px", opacity: 0.8,
  };

  const inputStyle = {
    width: "100%", background: "#FFFFFF",
    border: "1px solid rgba(45,90,61,0.2)", borderRadius: "8px",
    color: "#1E2018", padding: "11px 14px", fontSize: "13px",
    fontFamily: "system-ui, sans-serif", outline: "none",
  };

  const codeBoxStyle = {
    background: "#1E2018", color: "#A8D5B5",
    fontFamily: "'Courier New', monospace", fontSize: "11px",
    lineHeight: "1.6", padding: "16px", borderRadius: "8px",
    maxHeight: "320px", overflowY: "auto", whiteSpace: "pre",
    overflowX: "auto", marginBottom: "10px",
  };

  const actionBtnStyle = (bg = "#2D5A3D") => ({
    background: bg, color: bg === "#2D5A3D" ? "#EDE8DE" : "#1E2018",
    border: "none", borderRadius: "8px", padding: "8px 16px",
    cursor: "pointer", fontSize: "12px",
    fontFamily: "'Libre Baskerville', serif", fontWeight: 900,
  });

  // ── STATUS BADGE ─────────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const map = {
      idle:       { label: "Pending",    bg: "rgba(30,32,24,0.08)",     color: "#1E2018" },
      generating: { label: "⏳ Generating…", bg: "rgba(255,179,71,0.15)", color: "#B8860B" },
      done:       { label: "✓ Done",     bg: "rgba(45,90,61,0.12)",     color: "#2D5A3D" },
      error:      { label: "✗ Error",    bg: "rgba(139,32,32,0.1)",     color: "#8B2020" },
    };
    const s = map[status] || map.idle;
    return (
      <span style={{
        background: s.bg, color: s.color,
        padding: "3px 10px", borderRadius: "20px",
        fontSize: "11px", fontFamily: "'Libre Baskerville', serif",
        letterSpacing: "0.5px",
      }}>{s.label}</span>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    
    <DashboardLayout>
      <div style={{ maxWidth: "min(980px, 100%)", margin: "0 auto" }}>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontFamily: "'Libre Baskerville', serif",
            fontSize: "clamp(20px, 4vw, 30px)",
            color: "#2D5A3D", letterSpacing: "2px", marginBottom: "6px",
          }}>
            ⚡ Bulk Generator
          </h1>
          <p style={{ color: "#1E2018", opacity: 0.5, fontSize: "13px" }}>
            Add multiple jobs — generate a tailored CV + cover letter in LaTeX for each one in a single run.
            {!profile && (
              <span>
                {" "}
                <span onClick={() => navigate("/profile")}
                  style={{ color: "#2D5A3D", cursor: "pointer", textDecoration: "underline" }}>
                  Set up your profile first
                </span>
                {" "}for better results.
              </span>
            )}
          </p>
        </div>

        {/* ── JOB CARDS ───────────────────────────────────────────── */}
        {jobs.map((job, index) => (
          <div key={job.id} style={{
            ...cardStyle,
            borderLeft: job.status === "done"
              ? "4px solid #2D5A3D"
              : job.status === "error"
              ? "4px solid #8B2020"
              : job.status === "generating"
              ? "4px solid #FFB347"
              : "4px solid rgba(45,90,61,0.15)",
          }}>

            {/* Card header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
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
                  color: "#8B2020", cursor: "pointer", fontSize: "18px", opacity: 0.5,
                }}>×</button>
              )}
            </div>

            {/* Input fields */}
            {job.status !== "done" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <p style={sectionLabelStyle}>Job Title</p>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Frontend Developer at Acme Corp"
                    value={job.title}
                    onChange={e => updateJob(job.id, "title", e.target.value)}
                  />
                </div>

                <div>
                  <p style={sectionLabelStyle}>Job Description</p>
                  <textarea
                    style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }}
                    rows={6}
                    placeholder="Paste the full job description here..."
                    value={job.description}
                    onChange={e => updateJob(job.id, "description", e.target.value)}
                  />
                </div>

                <div>
                  <p style={sectionLabelStyle}>Cover Letter Tone</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {TONES.map(t => (
                      <button key={t} onClick={() => updateJob(job.id, "tone", t)} style={{
                        padding: "8px 18px", borderRadius: "8px", cursor: "pointer",
                        fontFamily: "'Libre Baskerville', serif", fontSize: "12px",
                        border: job.tone === t ? "2px solid #2D5A3D" : "2px solid rgba(45,90,61,0.2)",
                        background: job.tone === t ? "rgba(45,90,61,0.12)" : "transparent",
                        color: job.tone === t ? "#2D5A3D" : "#1E2018",
                        opacity: job.tone === t ? 1 : 0.55,
                      }}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {job.status === "generating" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0" }}>
                    <span style={{
                      display: "inline-block", width: "16px", height: "16px",
                      border: "2px solid #2D5A3D", borderTopColor: "transparent",
                      borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
                    }} />
                    <span style={{ color: "#2D5A3D", fontSize: "13px", fontFamily: "'Libre Baskerville', serif" }}>
                      Generating CV + cover letter…
                    </span>
                  </div>
                )}

                {job.status === "error" && (
                  <p style={{ color: "#8B2020", fontSize: "13px" }}>⚠ {job.error}</p>
                )}
              </div>
            )}

            {/* ── RESULTS ─────────────────────────────────────────── */}
            {job.status === "done" && (
              <div>
                {/* Job title summary */}
                <p style={{
                  color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "15px", marginBottom: "20px",
                }}>
                  {job.title}
                  <span style={{ fontSize: "12px", opacity: 0.4, marginLeft: "10px" }}>
                    ATS: {job.cvResult?.ats?.final_score || "—"}%
                  </span>
                </p>

                {/* Tab switcher */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                  {[
                    { key: "cv",       label: "📄 CV LaTeX" },
                    { key: "cl",       label: "✉ Cover Letter LaTeX" },
                    { key: "combined", label: "📦 Combined LaTeX" },
                  ].map(tab => (
                    <button key={tab.key}
                      onClick={() => updateJob(job.id, "activeTab", tab.key)}
                      style={{
                        padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                        fontFamily: "'Libre Baskerville', serif", fontSize: "12px",
                        border: job.activeTab === tab.key || (!job.activeTab && tab.key === "cv")
                          ? "2px solid #2D5A3D" : "2px solid rgba(45,90,61,0.2)",
                        background: job.activeTab === tab.key || (!job.activeTab && tab.key === "cv")
                          ? "rgba(45,90,61,0.12)" : "transparent",
                        color: "#1E2018",
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Code display */}
                {(() => {
                  const tab = job.activeTab || "cv";
                  const content = tab === "cv" ? job.cvLatex
                                : tab === "cl" ? job.clLatex
                                : job.combinedLatex;
                  const filename = tab === "cv"       ? `CV_${job.title.replace(/\s+/g,"_")}.tex`
                                 : tab === "cl"       ? `CoverLetter_${job.title.replace(/\s+/g,"_")}.tex`
                                 : `Combined_${job.title.replace(/\s+/g,"_")}.tex`;
                  const copyKey = `${job.id}-${tab}`;
                  return (
                    <>
                      <pre style={codeBoxStyle}>{content}</pre>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button onClick={() => copyText(content, copyKey)} style={actionBtnStyle()}>
                          {copied === copyKey ? "✓ Copied!" : "⎘ Copy"}
                        </button>
                        <button onClick={() => downloadTex(content, filename)} style={actionBtnStyle("rgba(45,90,61,0.12)")}>
                          ⬇ Download .tex
                        </button>
                        <button onClick={() => {
                          updateJob(job.id, "status", "idle");
                          updateJob(job.id, "activeTab", "cv");
                        }} style={actionBtnStyle("rgba(139,32,32,0.08)")}>
                          ✎ Re-generate
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

          </div>
        ))}


        {/* ── ADD JOB BUTTON ──────────────────────────────────────── */}
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


        {/* ── GENERATE ALL BUTTON ─────────────────────────────────── */}
        <div style={{
          position: "sticky", bottom: "20px", zIndex: 100,
          display: "flex", justifyContent: "center", paddingBottom: "40px",
        }}>
          <button
            onClick={handleGenerateAll}
            disabled={running || jobs.every(j => !j.title.trim() || !j.description.trim())}
            style={{
              background: running ? "rgba(45,90,61,0.5)" : "#2D5A3D",
              color: "#EDE8DE", border: "none", borderRadius: "12px",
              padding: "16px 48px", cursor: running ? "not-allowed" : "pointer",
              fontFamily: "'Libre Baskerville', serif", fontSize: "15px", fontWeight: 900,
              boxShadow: "0 4px 20px rgba(45,90,61,0.3)",
              display: "flex", alignItems: "center", gap: "12px",
              transition: "all 0.2s ease",
            }}
          >
            {running ? (
              <>
                <span style={{
                  display: "inline-block", width: "16px", height: "16px",
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

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

      </div>
    </DashboardLayout>
  );
}
