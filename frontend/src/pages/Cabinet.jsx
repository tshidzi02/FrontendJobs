// =============================================================================
// FILE: frontend/src/pages/Cabinet.jsx
// =============================================================================
// Three tabs:
//   🗂 CVs          — saved CVs from GenerateCV page  (GET /api/cabinet)
//   ✉ Cover Letters — saved cover letters             (GET /api/cover-letter/saved)
//   ⚡ Bulk          — saved bulk generator items      (GET /api/bulk-saved)
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";


// ── HELPERS ───────────────────────────────────────────────────────────────────

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function countSkills(skills) {
  if (!skills || skills.length === 0) return 0;
  if (typeof skills[0] === "object" && skills[0].skills_list)
    return skills.reduce((t, c) => t + (c.skills_list?.length || 0), 0);
  return skills.length;
}

function scoreColor(score) {
  if (score >= 70) return "#2D5A3D";
  if (score >= 40) return "#B8860B";
  return "#8B2020";
}

function scoreBg(score) {
  if (score >= 70) return "rgba(45,90,61,0.1)";
  if (score >= 40) return "rgba(184,134,11,0.1)";
  return "rgba(139,32,32,0.1)";
}

const TONE_COLOR = {
  professional: { bg: "rgba(45,90,61,0.08)",  border: "rgba(45,90,61,0.3)",  text: "#2D5A3D" },
  enthusiastic: { bg: "rgba(184,134,11,0.08)", border: "rgba(184,134,11,0.3)",text: "#B8860B" },
  concise:      { bg: "rgba(80,80,160,0.08)",  border: "rgba(80,80,160,0.3)", text: "#505090" },
};

// ── SHARED STYLES ─────────────────────────────────────────────────────────────

const cardStyle = {
  background: "#F0EAD8",
  borderRadius: "12px",
  padding: "24px 28px",
  marginBottom: "14px",
  border: "1px solid rgba(45,90,61,0.1)",
  transition: "border-color 0.2s ease",
};

const actionBtn = (bg = "transparent", color = "#2D5A3D", border = "rgba(45,90,61,0.35)") => ({
  background: bg,
  border: `1px solid ${border}`,
  color,
  padding: "7px 16px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
  fontFamily: "'Libre Baskerville', serif",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  transition: "background 0.15s ease",
});

const Spinner = () => (
  <span style={{
    display: "inline-block", width: "10px", height: "10px",
    border: "2px solid currentColor", borderTopColor: "transparent",
    borderRadius: "50%", animation: "spin 0.7s linear infinite",
  }} />
);


// =============================================================================
// COMPONENT
// =============================================================================

export default function Cabinet() {

  const navigate = useNavigate();

  // ── active tab ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("cvs");

  // ── CVs tab state ────────────────────────────────────────────────────────
  const [cvs, setCvs]                               = useState([]);
  const [cvsLoading, setCvsLoading]                 = useState(true);
  const [cvsError, setCvsError]                     = useState("");
  const [cvConfirmId, setCvConfirmId]               = useState(null);
  const [cvDeletingId, setCvDeletingId]             = useState(null);
  const [cvDownloadingId, setCvDownloadingId]       = useState(null);
  const [cvDownloadingTexId, setCvDownloadingTexId] = useState(null);
  const [cvDownloadError, setCvDownloadError]       = useState("");

  // ── Cover Letters tab state ───────────────────────────────────────────────
  const [cls, setCls]                                   = useState([]);
  const [clsLoading, setClsLoading]                     = useState(true);
  const [clsError, setClsError]                         = useState("");
  const [clExpandedId, setClExpandedId]                 = useState(null);
  const [clConfirmId, setClConfirmId]                   = useState(null);
  const [clDeletingId, setClDeletingId]                 = useState(null);
  const [clDownloadingId, setClDownloadingId]           = useState(null);
  const [clDownloadingTexId, setClDownloadingTexId]     = useState(null);
  const [clDownloadError, setClDownloadError]           = useState("");
  const [clCopied, setClCopied]                         = useState(null);

  // ── Bulk tab state ────────────────────────────────────────────────────────
  const [bulk, setBulk]                       = useState([]);
  const [bulkLoading, setBulkLoading]         = useState(true);
  const [bulkError, setBulkError]             = useState("");
  const [bulkConfirmId, setBulkConfirmId]     = useState(null);
  const [bulkDeletingId, setBulkDeletingId]   = useState(null);
  const [bulkActiveTab, setBulkActiveTab]     = useState({});
  const [bulkCopied, setBulkCopied]           = useState(null);


  // ── LOAD ALL ON MOUNT ────────────────────────────────────────────────────
  useEffect(() => {
    const handle401 = (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return true;
      }
      return false;
    };

    api.get("/cabinet")
      .then(r => setCvs(r.data))
      .catch(err => { if (!handle401(err)) setCvsError("Failed to load CVs."); })
      .finally(() => setCvsLoading(false));

    api.get("/cover-letter/saved")
      .then(r => setCls(r.data))
      .catch(err => { if (!handle401(err)) setClsError("Failed to load cover letters."); })
      .finally(() => setClsLoading(false));

    api.get("/bulk-saved")
      .then(r => setBulk(r.data))
      .catch(err => { if (!handle401(err)) setBulkError("Failed to load bulk items."); })
      .finally(() => setBulkLoading(false));
  }, [navigate]);


  // ==========================================================================
  // CV HANDLERS
  // ==========================================================================

  const handleCvDelete = async (id) => {
    setCvDeletingId(id); setCvConfirmId(null);
    try {
      await api.delete(`/cabinet/${id}`);
      setCvs(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem("token"); navigate("/login"); }
      else setCvsError("Delete failed.");
    } finally { setCvDeletingId(null); }
  };

  const handleCvDownload = async (cv) => {
    setCvDownloadingId(cv.id); setCvDownloadError("");
    try {
      const resp = await api.post("/download-cv",
        { ai_result: cv.ai_result, profile: cv.profile_snapshot || {} },
        { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a   = Object.assign(document.createElement("a"), {
        href: url,
        download: cv.job_title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") + "_CV.docx",
      });
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem("token"); navigate("/login"); }
      else setCvDownloadError("Download failed.");
    } finally { setCvDownloadingId(null); }
  };

  const handleCvDownloadTex = async (cv) => {
    setCvDownloadingTexId(cv.id);
    try {
      const resp = await api.post("/download-cv-tex",
        { ai_result: cv.ai_result, profile: cv.profile_snapshot || {} },
        { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a   = Object.assign(document.createElement("a"), {
        href: url,
        download: cv.job_title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") + "_CV.tex",
      });
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { setCvDownloadError("TeX download failed."); }
    finally { setCvDownloadingTexId(null); }
  };


  // ==========================================================================
  // COVER LETTER HANDLERS
  // ==========================================================================

  const handleClDelete = async (id) => {
    setClDeletingId(id); setClConfirmId(null);
    try {
      await api.delete(`/cover-letter/${id}`);
      setCls(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem("token"); navigate("/login"); }
      else setClsError("Delete failed.");
    } finally { setClDeletingId(null); }
  };

  const handleClDownload = async (cl) => {
    setClDownloadingId(cl.id); setClDownloadError("");
    try {
      const resp = await api.post("/download-cover-letter",
        { cover_letter: cl.cover_letter, job_title: cl.job_title },
        { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a   = Object.assign(document.createElement("a"), {
        href: url,
        download: cl.job_title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") + "_Cover_Letter.docx",
      });
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { setClDownloadError("Download failed."); }
    finally { setClDownloadingId(null); }
  };

  const handleClDownloadTex = async (cl) => {
    setClDownloadingTexId(cl.id);
    try {
      const resp = await api.post("/download-cover-letter-tex",
        { cover_letter: cl.cover_letter, job_title: cl.job_title },
        { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a   = Object.assign(document.createElement("a"), {
        href: url, download: "Cover_Letter.tex",
      });
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { setClDownloadError("TeX download failed."); }
    finally { setClDownloadingTexId(null); }
  };

  const handleClCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setClCopied(id);
    setTimeout(() => setClCopied(null), 2000);
  };


  // ==========================================================================
  // BULK HANDLERS
  // ==========================================================================

  const handleBulkDelete = async (id) => {
    setBulkDeletingId(id); setBulkConfirmId(null);
    try {
      await api.delete(`/bulk-saved/${id}`);
      setBulk(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem("token"); navigate("/login"); }
      else setBulkError("Delete failed.");
    } finally { setBulkDeletingId(null); }
  };

  const bulkDownloadTex = (texContent, filename) => {
    const blob = new Blob([texContent], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const getBulkTab  = (id)      => bulkActiveTab[id] || "cv";
  const setBulkTabF = (id, tab) => setBulkActiveTab(prev => ({ ...prev, [id]: tab }));

  const handleBulkCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setBulkCopied(key);
    setTimeout(() => setBulkCopied(null), 2000);
  };


  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const TabButton = ({ id, label, count }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "10px 22px", borderRadius: "8px", cursor: "pointer",
        fontFamily: "'Libre Baskerville', serif", fontSize: "13px",
        border:     activeTab === id ? "2px solid #2D5A3D" : "2px solid rgba(45,90,61,0.15)",
        background: activeTab === id ? "rgba(45,90,61,0.1)" : "transparent",
        color:      activeTab === id ? "#2D5A3D" : "#1E2018",
        opacity:    activeTab === id ? 1 : 0.6,
        display: "flex", alignItems: "center", gap: "8px",
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: activeTab === id ? "#2D5A3D" : "rgba(45,90,61,0.2)",
          color:      activeTab === id ? "#EDE8DE" : "#2D5A3D",
          borderRadius: "10px", padding: "1px 7px", fontSize: "11px",
        }}>{count}</span>
      )}
    </button>
  );


  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(1000px, 100%)", margin: "0 auto" }}>

        {/* ── PAGE HEADER ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontFamily: "'Libre Baskerville', serif",
            fontSize: "clamp(20px, 4vw, 32px)",
            color: "#2D5A3D", letterSpacing: "2px", marginBottom: "8px",
          }}>
            Cabinet
          </h1>
          <p style={{ color: "#1E2018", opacity: 0.5, fontSize: "13px" }}>
            All your saved CVs, cover letters, and bulk-generated applications in one place.
          </p>
        </div>

        {/* ── TABS ───────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
          <TabButton id="cvs"  label="🗂 CVs"           count={cvs.length}  />
          <TabButton id="cls"  label="✉ Cover Letters"  count={cls.length}  />
          <TabButton id="bulk" label="⚡ Bulk"           count={bulk.length} />
        </div>


        {/* ============================================================== */}
        {/* TAB: CVs                                                        */}
        {/* ============================================================== */}
        {activeTab === "cvs" && (
          <div>
            {cvsError      && <ErrMsg msg={cvsError} />}
            {cvDownloadError && <ErrMsg msg={cvDownloadError} />}
            {cvsLoading    && <LoadingSkeleton />}

            {!cvsLoading && cvs.length === 0 && (
              <EmptyState icon="🗂️" title="No CVs saved yet"
                body="Generate a tailored CV and click Save to Cabinet — it will appear here."
                btnLabel="Generate a CV" onBtn={() => navigate("/generate")} />
            )}

            {!cvsLoading && cvs.map(cv => {
              const skillCount     = countSkills(cv.ai_result?.skills);
              const summaryPreview = (cv.ai_result?.SUMMARY || "").slice(0, 180);
              const isConfirm      = cvConfirmId       === cv.id;
              const isDeleting     = cvDeletingId      === cv.id;
              const isDlDocx       = cvDownloadingId   === cv.id;
              const isDlTex        = cvDownloadingTexId === cv.id;

              return (
                <div key={cv.id} style={cardStyle}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(45,90,61,0.25)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(45,90,61,0.1)"}
                >
                  {/* Header */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"12px", marginBottom:"14px" }}>
                    <div style={{ flex:1 }}>
                      <h3 style={{ color:"#1E2018", fontFamily:"'Libre Baskerville',serif", fontSize:"15px", marginBottom:"4px" }}>{cv.job_title}</h3>
                      <p style={{ color:"#1E2018", fontSize:"11px", opacity:0.4 }}>Saved {formatDate(cv.created_at)}</p>
                    </div>
                    <div style={{ background:scoreBg(cv.ats_score), borderRadius:"8px", padding:"8px 14px", textAlign:"center", minWidth:"72px", flexShrink:0 }}>
                      <p style={{ color:"#1E2018", fontSize:"9px", opacity:0.5, marginBottom:"2px", letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'Libre Baskerville',serif" }}>ATS</p>
                      <p style={{ color:scoreColor(cv.ats_score), fontFamily:"'Libre Baskerville',serif", fontSize:"22px", lineHeight:1 }}>{cv.ats_score}%</p>
                    </div>
                  </div>

                  {summaryPreview && (
                    <p style={{ color:"#1E2018", fontSize:"13px", opacity:0.55, lineHeight:"1.65", marginBottom:"14px" }}>
                      {summaryPreview}{cv.ai_result?.SUMMARY?.length > 180 ? "…" : ""}
                    </p>
                  )}

                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"18px" }}>
                    {skillCount > 0 && <Pill>{skillCount} skills</Pill>}
                    {cv.ai_result?.experience?.length > 0 && <Pill>{cv.ai_result.experience.length} roles</Pill>}
                  </div>

                  <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
                    <button onClick={() => handleCvDownload(cv)} disabled={isDlDocx}
                      style={actionBtn()} title="Download Word document"
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {isDlDocx ? <><Spinner /> Preparing…</> : "⬇ .docx"}
                    </button>
                    <button onClick={() => handleCvDownloadTex(cv)} disabled={isDlTex}
                      style={actionBtn("#2D5A3D","#EDE8DE","#2D5A3D")}>
                      {isDlTex ? <><Spinner /> Preparing…</> : "⬇ .tex"}
                    </button>
                    <ConfirmDelete isConfirm={isConfirm} isDeleting={isDeleting}
                      onRequest={() => setCvConfirmId(cv.id)}
                      onConfirm={() => handleCvDelete(cv.id)}
                      onCancel={() => setCvConfirmId(null)} />
                  </div>
                </div>
              );
            })}

            {!cvsLoading && cvs.length > 0 && (
              <CentreBtn onClick={() => navigate("/generate")}>✨ Generate Another CV</CentreBtn>
            )}
          </div>
        )}


        {/* ============================================================== */}
        {/* TAB: COVER LETTERS                                              */}
        {/* ============================================================== */}
        {activeTab === "cls" && (
          <div>
            {clsError        && <ErrMsg msg={clsError} />}
            {clDownloadError && <ErrMsg msg={clDownloadError} />}
            {clsLoading      && <LoadingSkeleton />}

            {!clsLoading && cls.length === 0 && (
              <EmptyState icon="✉" title="No cover letters saved yet"
                body="Generate a cover letter and save it — it will appear here."
                btnLabel="Generate a Cover Letter" onBtn={() => navigate("/cover-letter")} />
            )}

            {!clsLoading && cls.map(cl => {
              const isExpanded = clExpandedId     === cl.id;
              const isConfirm  = clConfirmId      === cl.id;
              const isDeleting = clDeletingId     === cl.id;
              const isDlDocx   = clDownloadingId    === cl.id;
              const isDlTex    = clDownloadingTexId === cl.id;
              const tone       = TONE_COLOR[cl.tone] || TONE_COLOR.professional;
              const preview    = (cl.cover_letter || "").slice(0, 200);

              return (
                <div key={cl.id} style={cardStyle}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(45,90,61,0.25)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(45,90,61,0.1)"}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"10px", marginBottom:"12px" }}>
                    <div style={{ flex:1 }}>
                      <h3 style={{ color:"#1E2018", fontFamily:"'Libre Baskerville',serif", fontSize:"15px", marginBottom:"4px" }}>{cl.job_title}</h3>
                      <p style={{ color:"#1E2018", fontSize:"11px", opacity:0.4 }}>Saved {formatDate(cl.created_at)}</p>
                    </div>
                    <span style={{ background:tone.bg, border:`1px solid ${tone.border}`, color:tone.text, padding:"4px 12px", borderRadius:"20px", fontSize:"11px", fontFamily:"'Libre Baskerville',serif", flexShrink:0 }}>
                      {cl.tone}
                    </span>
                  </div>

                  <p style={{ color:"#1E2018", fontSize:"13px", opacity:0.6, lineHeight:"1.65", marginBottom:"10px", whiteSpace:"pre-wrap" }}>
                    {isExpanded ? cl.cover_letter : preview + (cl.cover_letter?.length > 200 ? "…" : "")}
                  </p>
                  {cl.cover_letter?.length > 200 && (
                    <button onClick={() => setClExpandedId(isExpanded ? null : cl.id)}
                      style={{ background:"none", border:"none", color:"#2D5A3D", fontSize:"12px", cursor:"pointer", padding:0, marginBottom:"14px", fontFamily:"'Libre Baskerville',serif" }}>
                      {isExpanded ? "▲ Show less" : "▼ Show full letter"}
                    </button>
                  )}

                  <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
                    <button onClick={() => handleClCopy(cl.cover_letter, cl.id)}
                      style={actionBtn()}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {clCopied === cl.id ? "✓ Copied!" : "⎘ Copy"}
                    </button>
                    <button onClick={() => handleClDownload(cl)} disabled={isDlDocx}
                      style={actionBtn()}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {isDlDocx ? <><Spinner /> Preparing…</> : "⬇ .docx"}
                    </button>
                    <button onClick={() => handleClDownloadTex(cl)} disabled={isDlTex}
                      style={actionBtn("#2D5A3D","#EDE8DE","#2D5A3D")}>
                      {isDlTex ? <><Spinner /> Preparing…</> : "⬇ .tex"}
                    </button>
                    <ConfirmDelete isConfirm={isConfirm} isDeleting={isDeleting}
                      onRequest={() => setClConfirmId(cl.id)}
                      onConfirm={() => handleClDelete(cl.id)}
                      onCancel={() => setClConfirmId(null)} />
                  </div>
                </div>
              );
            })}

            {!clsLoading && cls.length > 0 && (
              <CentreBtn onClick={() => navigate("/cover-letter")}>✨ Generate Another Cover Letter</CentreBtn>
            )}
          </div>
        )}


        {/* ============================================================== */}
        {/* TAB: BULK                                                       */}
        {/* ============================================================== */}
        {activeTab === "bulk" && (
          <div>
            {bulkError   && <ErrMsg msg={bulkError} />}
            {bulkLoading && <LoadingSkeleton />}

            {!bulkLoading && bulk.length === 0 && (
              <EmptyState icon="⚡" title="No bulk items saved yet"
                body="Use the Bulk Generator to create multiple tailored CVs + cover letters and save them here."
                btnLabel="Go to Bulk Generator" onBtn={() => navigate("/bulk")} />
            )}

            {!bulkLoading && bulk.map(item => {
              const tab      = getBulkTab(item.id);
              const slug     = item.job_title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
              const subTabs  = [
                { key:"cv",       label:"📄 CV LaTeX",          content:item.cv_tex,       file:`CV_${slug}.tex`          },
                { key:"cl",       label:"✉ Cover Letter LaTeX", content:item.cl_tex,       file:`CoverLetter_${slug}.tex` },
                { key:"combined", label:"📦 Combined LaTeX",     content:item.combined_tex, file:`Combined_${slug}.tex`    },
              ];
              const active    = subTabs.find(t => t.key === tab) || subTabs[0];
              const copyKey   = `bulk-${item.id}-${tab}`;
              const isConfirm = bulkConfirmId  === item.id;
              const isDeleting= bulkDeletingId === item.id;
              const tone      = TONE_COLOR[item.tone] || TONE_COLOR.professional;

              return (
                <div key={item.id} style={cardStyle}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(45,90,61,0.25)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(45,90,61,0.1)"}
                >
                  {/* Header */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"10px", marginBottom:"14px" }}>
                    <div style={{ flex:1 }}>
                      <h3 style={{ color:"#1E2018", fontFamily:"'Libre Baskerville',serif", fontSize:"15px", marginBottom:"4px" }}>{item.job_title}</h3>
                      <p style={{ color:"#1E2018", fontSize:"11px", opacity:0.4 }}>Saved {formatDate(item.created_at)}</p>
                    </div>
                    <div style={{ display:"flex", gap:"8px", alignItems:"center", flexShrink:0 }}>
                      <span style={{ background:tone.bg, border:`1px solid ${tone.border}`, color:tone.text, padding:"4px 10px", borderRadius:"20px", fontSize:"11px", fontFamily:"'Libre Baskerville',serif" }}>
                        {item.tone}
                      </span>
                      {item.ats_score > 0 && (
                        <div style={{ background:scoreBg(item.ats_score), borderRadius:"8px", padding:"6px 12px", textAlign:"center" }}>
                          <p style={{ color:"#1E2018", fontSize:"9px", opacity:0.5, marginBottom:"1px", letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'Libre Baskerville',serif" }}>ATS</p>
                          <p style={{ color:scoreColor(item.ats_score), fontFamily:"'Libre Baskerville',serif", fontSize:"18px", lineHeight:1 }}>{item.ats_score}%</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub-tabs */}
                  <div style={{ display:"flex", gap:"6px", marginBottom:"12px", flexWrap:"wrap" }}>
                    {subTabs.map(t => (
                      <button key={t.key} onClick={() => setBulkTabF(item.id, t.key)} style={{
                        padding:"6px 12px", borderRadius:"6px", cursor:"pointer",
                        fontFamily:"'Libre Baskerville',serif", fontSize:"11px",
                        border:     tab===t.key ? "2px solid #2D5A3D" : "1px solid rgba(45,90,61,0.2)",
                        background: tab===t.key ? "rgba(45,90,61,0.1)" : "transparent",
                        color:      tab===t.key ? "#2D5A3D" : "#1E2018",
                        opacity:    tab===t.key ? 1 : 0.55,
                      }}>{t.label}</button>
                    ))}
                  </div>

                  {/* Code preview */}
                  <pre style={{
                    background:"#1A1E1A", color:"#A8D5B5",
                    fontFamily:"'Courier New',monospace", fontSize:"11px",
                    lineHeight:"1.6", padding:"14px", borderRadius:"8px",
                    maxHeight:"220px", overflowY:"auto", overflowX:"auto",
                    whiteSpace:"pre", marginBottom:"12px",
                  }}>{active.content || "(empty)"}</pre>

                  {/* Actions */}
                  <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
                    <button onClick={() => handleBulkCopy(active.content, copyKey)}
                      style={actionBtn()}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(45,90,61,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {bulkCopied === copyKey ? "✓ Copied!" : "⎘ Copy"}
                    </button>
                    <button onClick={() => bulkDownloadTex(active.content, active.file)}
                      style={actionBtn("#2D5A3D","#EDE8DE","#2D5A3D")}>
                      ⬇ Download .tex
                    </button>
                    <ConfirmDelete isConfirm={isConfirm} isDeleting={isDeleting}
                      onRequest={() => setBulkConfirmId(item.id)}
                      onConfirm={() => handleBulkDelete(item.id)}
                      onCancel={() => setBulkConfirmId(null)} />
                  </div>
                </div>
              );
            })}

            {!bulkLoading && bulk.length > 0 && (
              <CentreBtn onClick={() => navigate("/bulk")}>⚡ Go to Bulk Generator</CentreBtn>
            )}
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </DashboardLayout>
  );
}


// =============================================================================
// SHARED SUB-COMPONENTS
// =============================================================================

function ErrMsg({ msg }) {
  return <p style={{ color:"#8B2020", fontSize:"13px", marginBottom:"16px" }}>⚠ {msg}</p>;
}

function Pill({ children }) {
  return (
    <span style={{
      background:"rgba(45,90,61,0.07)", border:"1px solid rgba(45,90,61,0.2)",
      color:"#2D5A3D", padding:"3px 10px", borderRadius:"20px",
      fontSize:"11px", fontFamily:"'Libre Baskerville',serif",
    }}>{children}</span>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      {[1,2,3].map(i => (
        <div key={i} style={{ background:"#F0EAD8", borderRadius:"12px", padding:"28px", marginBottom:"14px", border:"1px solid rgba(45,90,61,0.08)" }}>
          {[60,90,45].map((w,idx) => (
            <div key={idx} style={{ height:"12px", background:"rgba(45,90,61,0.07)", borderRadius:"6px", marginBottom:"12px", width:`${w}%`, animation:"pulse 1.5s ease-in-out infinite", animationDelay:`${idx*0.15}s` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, body, btnLabel, onBtn }) {
  return (
    <div style={{ background:"#F0EAD8", borderRadius:"12px", padding:"60px 40px", textAlign:"center", border:"1px dashed rgba(45,90,61,0.3)", marginBottom:"24px" }}>
      <div style={{ fontSize:"clamp(24px,5vw,44px)", marginBottom:"16px" }}>{icon}</div>
      <h3 style={{ color:"#2D5A3D", fontFamily:"'Libre Baskerville',serif", fontSize:"18px", marginBottom:"10px" }}>{title}</h3>
      <p style={{ color:"#1E2018", opacity:0.55, fontSize:"13px", maxWidth:"360px", margin:"0 auto 22px auto", lineHeight:"1.7" }}>{body}</p>
      <button className="primary-btn" onClick={onBtn} style={{ fontSize:"14px", padding:"11px 26px" }}>{btnLabel}</button>
    </div>
  );
}

function CentreBtn({ onClick, children }) {
  return (
    <div style={{ textAlign:"center", paddingTop:"16px", paddingBottom:"40px" }}>
      <button className="primary-btn" onClick={onClick} style={{ fontSize:"14px", padding:"11px 26px" }}>{children}</button>
    </div>
  );
}

function ConfirmDelete({ isConfirm, isDeleting, onRequest, onConfirm, onCancel }) {
  if (isDeleting) return <span style={{ color:"#1E2018", fontSize:"12px", opacity:0.5 }}>Deleting…</span>;
  if (isConfirm) return (
    <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
      <span style={{ color:"#1E2018", fontSize:"12px", opacity:0.6 }}>Are you sure?</span>
      <button onClick={onConfirm} style={{ background:"rgba(139,32,32,0.12)", border:"1px solid rgba(139,32,32,0.4)", color:"#8B2020", padding:"5px 12px", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontFamily:"'Libre Baskerville',serif" }}>Yes, delete</button>
      <button onClick={onCancel}  style={{ background:"transparent", border:"1px solid rgba(30,32,24,0.2)", color:"#1E2018", padding:"5px 12px", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontFamily:"'Libre Baskerville',serif", opacity:0.5 }}>Cancel</button>
    </div>
  );
  return (
    <button onClick={onRequest}
      style={{ background:"transparent", border:"1px solid rgba(139,32,32,0.3)", color:"#8B2020", padding:"7px 16px", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontFamily:"'Libre Baskerville',serif", opacity:0.7, transition:"opacity 0.15s, background 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.opacity="1"; e.currentTarget.style.background="rgba(139,32,32,0.07)"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity="0.7"; e.currentTarget.style.background="transparent"; }}>
      Delete
    </button>
  );
}