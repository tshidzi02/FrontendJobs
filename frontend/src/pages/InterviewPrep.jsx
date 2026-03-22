// =============================================================================
// FILE: frontend/src/pages/InterviewPrep.jsx
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

const CATEGORY_COLORS = {
  "Behavioural":   { text: "#2D5A3D", bg: "#E8F0EB", border: "rgba(45,90,61,0.25)" },
  "Technical":     { text: "#2D4A6A", bg: "#EAF0F8", border: "rgba(45,74,106,0.25)" },
  "Situational":   { text: "#6B3D7A", bg: "#F2EAF8", border: "rgba(107,61,122,0.25)" },
  "Role-Specific": { text: "#7A5C1E", bg: "#F8F2E0", border: "rgba(122,92,30,0.25)" },
};

const DIFFICULTY_COLORS = {
  "Easy":   { text: "#2D5A3D", bg: "#E8F0EB" },
  "Medium": { text: "#7A5C1E", bg: "#F8F2E0" },
  "Hard":   { text: "#8B2020", bg: "#FBF0F0" },
};

// ── BADGE ─────────────────────────────────────────────────────────────────────
function Badge({ label, colorMap }) {
  const c = colorMap[label] || { text: "#6B6252", bg: "#EDE8DE", border: "#DDD5C4" };
  return (
    <span style={{
      fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 600,
      letterSpacing: "0.06em", textTransform: "uppercase",
      color: c.text, background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: "3px", padding: "2px 8px",
    }}>
      {label}
    </span>
  );
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────
async function exportToPDF(questions, jobDescription) {
  const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm");

  const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW     = 210;   // page width
  const PH     = 297;   // page height
  const ML     = 14;    // margin left
  const MR     = 14;    // margin right
  const CW     = PW - ML - MR;  // content width = 182

  // ── helpers ────────────────────────────────────────────────────────────────
  const h2r = (hex) => {
    const c = hex.replace("#","");
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  };

  // measure how tall wrapped text will be (lineH in mm)
  const wrapH = (text, maxW, size, lineH) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(String(text), maxW).length * lineH;
  };

  // draw text and return the Y after the last line
  const drawText = (text, x, y, maxW, size, lineH, bold=false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(text), maxW);
    doc.text(lines, x, y);
    return y + (lines.length - 1) * lineH;  // returns Y of last line baseline
  };

  // palette
  const C = {
    cream  : h2r("#F4EFE6"),
    surface: h2r("#FDFAF5"),
    surf2  : h2r("#EDE8DE"),
    green  : h2r("#2D5A3D"),
    gmute  : h2r("#E8F0EB"),
    ink    : h2r("#1E2018"),
    muted  : h2r("#6B6252"),
    border : h2r("#DDD5C4"),
  };

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  doc.setFillColor(...C.cream);
  doc.rect(0, 0, PW, PH, "F");

  // Green header band
  doc.setFillColor(...C.green);
  doc.rect(0, 0, PW, 50, "F");

  doc.setFont("helvetica","bold");
  doc.setFontSize(26);
  doc.setTextColor(...C.surface);
  doc.text("INTERVIEW PREP", ML, 26);

  doc.setFont("helvetica","normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.gmute);
  doc.text("FrontendJobs.online", ML, 38);

  // JD preview
  doc.setFillColor(...C.surface);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, 60, CW, 30, 3, 3, "FD");

  doc.setFont("helvetica","bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text("JOB DESCRIPTION", ML + 8, 69);

  // doc.setFont("helvetica","normal");
  // doc.setFontSize(8.5);
  // doc.setTextColor(...C.ink);
  // const jdText = jobDescription
  //   ? jobDescription.slice(0, 120).trim() + (jobDescription.length > 120 ? "…" : "")
  //   : "No job description provided.";
  // const jdLines = doc.splitTextToSize(jdText, CW - 16);
  // doc.text(jdLines, ML + 8, 76);

  // Stats
  const categories = [...new Set(questions.map(q => q.category))];
  const statW = (CW - 8) / 3;
  const statY = 102;
  [
    { v: String(questions.length),  l: "Questions"  },
    { v: String(categories.length), l: "Categories" },
    { v: new Date().toLocaleDateString("en-ZA",{ day:"numeric", month:"short" }), l: "Generated" },
  ].forEach(({ v, l }, i) => {
    const sx = ML + i * (statW + 4);
    doc.setFillColor(...C.surface);
    doc.setDrawColor(...C.border);
    doc.roundedRect(sx, statY, statW, 22, 3, 3, "FD");
    doc.setFont("helvetica","bold");
    doc.setFontSize(13);
    doc.setTextColor(...C.green);
    doc.text(v, sx + statW / 2, statY + 10, { align:"center" });
    doc.setFont("helvetica","normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(l.toUpperCase(), sx + statW / 2, statY + 17, { align:"center" });
  });

  // Category pills
  let px = ML;
  const py = 136;
  categories.forEach(cat => {
    const cc = CATEGORY_COLORS[cat] || { text:"#6B6252", bg:"#EDE8DE" };
    doc.setFont("helvetica","bold");
    doc.setFontSize(7);
    const w = doc.getTextWidth(cat) + 10;
    doc.setFillColor(...h2r(cc.bg));
    doc.setDrawColor(...h2r(cc.text));
    doc.setLineWidth(0.3);
    doc.roundedRect(px, py, w, 8, 2, 2, "FD");
    doc.setTextColor(...h2r(cc.text));
    doc.text(cat, px + w / 2, py + 5.2, { align:"center" });
    px += w + 4;
  });

  // Cover footer
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.line(ML, PH - 16, PW - MR, PH - 16);
  doc.setFont("helvetica","normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text(
    `Generated by FrontendJobs.online  ·  ${new Date().toLocaleDateString("en-ZA",{ day:"numeric", month:"long", year:"numeric" })}`,
    PW / 2, PH - 10, { align:"center" }
  );

  // ── QUESTION CARDS ──────────────────────────────────────────────────────────
  //
  // Layout constants (all in mm)
  const ACCENT_W  = 4;     // left accent bar width
  const ACCENT_GAP= 3;     // gap between accent bar right edge and text
  const TX        = ML + ACCENT_W + ACCENT_GAP;  // text left edge = 21
  const TW        = CW - ACCENT_W - ACCENT_GAP - 4;  // text width = 171
  const PAD_TOP   = 8;     // space from card top to first element
  const PAD_BOT   = 8;     // space from last element to card bottom
  const ROW_GAP   = 3;     // vertical gap between rows
  const LH_SMALL  = 4.2;   // line height for 7–8pt text
  const LH_Q      = 5.6;   // line height for 11.5pt question
  const LH_A      = 4.6;   // line height for 8.5pt answer
  const DIV_GAP   = 4;     // space above/below divider line

  // Pre-calculate each card height so we can fit 2 per page accurately
  const cards = questions.map((q, idx) => {
    const qH = wrapH(q.question, TW, 11.5, LH_Q);
    const aH = wrapH(q.answer,   TW, 8.5,  LH_A);

    // Row heights:
    // PAD_TOP
    // num row: 4mm
    // ROW_GAP
    // pill row: 5mm  (category pill height)
    // ROW_GAP
    // "QUESTION" label: 4mm
    // ROW_GAP * 0.5
    // question text block: qH
    // DIV_GAP
    // divider line: 0
    // DIV_GAP
    // "MODEL ANSWER" label: 4mm
    // ROW_GAP
    // answer text block: aH
    // PAD_BOT
    const h = PAD_TOP + 4 + ROW_GAP + 5 + ROW_GAP + 4 + ROW_GAP * 0.5 + qH + DIV_GAP + DIV_GAP + 4 + ROW_GAP + aH + PAD_BOT;
    return { q, num: idx + 1, qH, aH, cardH: Math.ceil(h) };
  });

  const PER_PAGE   = 2;
  const CARD_GAP   = 10;
  const PAGE_MT    = 12;
  const PAGE_MB    = 16;

  for (let p = 0; p < Math.ceil(cards.length / PER_PAGE); p++) {
    doc.addPage();

    doc.setFillColor(...C.cream);
    doc.rect(0, 0, PW, PH, "F");

    const slice  = cards.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
    const totalH = slice.reduce((s,c) => s + c.cardH, 0) + (slice.length - 1) * CARD_GAP;
    // centre cards vertically, leaving footer room
    const startY = Math.max(PAGE_MT, (PH - PAGE_MB - PAGE_MT - totalH) / 2 + PAGE_MT);

    slice.forEach(({ q, num, qH, aH, cardH }, ci) => {
      const cy0 = startY + ci * (cardH + CARD_GAP);  // card top Y

      const catC = CATEGORY_COLORS[q.category]   || { text:"#6B6252", bg:"#EDE8DE" };
      const difC = DIFFICULTY_COLORS[q.difficulty] || { text:"#6B6252", bg:"#EDE8DE" };

      // ── Card background ────────────────────────────────────────────────────
      doc.setFillColor(...C.surface);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.35);
      doc.roundedRect(ML, cy0, CW, cardH, 3, 3, "FD");

      // ── Left accent bar ────────────────────────────────────────────────────
      doc.setFillColor(...h2r(catC.text));
      doc.roundedRect(ML, cy0, ACCENT_W, cardH, 2, 2, "F");

      // ── Row 1: card number (left) + difficulty pill (right) ────────────────
      const r1y = cy0 + PAD_TOP;   // baseline of number text

      doc.setFont("helvetica","bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text(`#${String(num).padStart(2,"0")}`, TX, r1y);

      // Difficulty pill — right-aligned inside card
      const difLabel = q.difficulty || "";
      doc.setFont("helvetica","bold");
      doc.setFontSize(7);
      const difW  = doc.getTextWidth(difLabel) + 8;
      const difX  = ML + CW - 4 - difW;           // right edge of card minus small padding
      const pilH  = 5.5;
      const pilY  = r1y - 4;                       // top of pill (text baseline - 4)
      doc.setFillColor(...h2r(difC.bg));
      doc.setDrawColor(...h2r(difC.text));
      doc.setLineWidth(0.25);
      doc.roundedRect(difX, pilY, difW, pilH, 1.5, 1.5, "FD");
      doc.setTextColor(...h2r(difC.text));
      doc.text(difLabel, difX + difW / 2, pilY + 3.7, { align:"center" });

      // ── Row 2: category pill ───────────────────────────────────────────────
      const r2y = r1y + ROW_GAP + 5;   // top of row 2 area

      const catLabel = q.category || "";
      doc.setFont("helvetica","bold");
      doc.setFontSize(7);
      const catW = doc.getTextWidth(catLabel) + 10;
      const catPilY = r2y - 4.5;
      doc.setFillColor(...h2r(catC.bg));
      doc.setDrawColor(...h2r(catC.text));
      doc.setLineWidth(0.25);
      doc.roundedRect(TX, catPilY, catW, pilH, 1.5, 1.5, "FD");
      doc.setTextColor(...h2r(catC.text));
      doc.text(catLabel, TX + catW / 2, catPilY + 3.7, { align:"center" });

      // ── Row 3: "QUESTION" label ────────────────────────────────────────────
      const r3y = r2y + ROW_GAP + 4;

      doc.setFont("helvetica","bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text("QUESTION", TX, r3y);

      // ── Row 4: question text ───────────────────────────────────────────────
      const r4y = r3y + ROW_GAP * 0.5 + LH_Q;   // first line baseline

      doc.setFont("helvetica","bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...C.ink);
      const qLines = doc.splitTextToSize(q.question, TW);
      doc.text(qLines, TX, r4y);

      // ── Divider ────────────────────────────────────────────────────────────
      const divY = r4y + (qLines.length - 1) * LH_Q + DIV_GAP;

      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.25);
      doc.line(TX, divY, ML + CW - 4, divY);

      // ── Row 5: "MODEL ANSWER" label ───────────────────────────────────────
      const r5y = divY + DIV_GAP + 4;

      doc.setFont("helvetica","bold");
      doc.setFontSize(7);
      doc.setTextColor(...h2r(catC.text));
      doc.text("MODEL ANSWER", TX, r5y);

      // ── Row 6: answer text ─────────────────────────────────────────────────
      const r6y = r5y + ROW_GAP + LH_A;   // first line baseline

      doc.setFont("helvetica","normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...C.muted);
      const aLines = doc.splitTextToSize(q.answer, TW);
      doc.text(aLines, TX, r6y);
    });

    // ── Page footer ────────────────────────────────────────────────────────
    const footY = PH - 10;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(ML, footY - 4, PW - MR, footY - 4);
    doc.setFont("helvetica","normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(`FrontendJobs.online  ·  Page ${p + 2}`, PW / 2, footY, { align:"center" });
  }

  doc.save("Interview_Prep_Questions.pdf");
}

// ── FLASHCARD MODE ────────────────────────────────────────────────────────────
function Flashcard({ questions }) {
  const [idx, setIdx]         = useState(0);
  const [flipped, setFlipped] = useState(false);

  const current  = questions[idx];
  const progress = ((idx + 1) / questions.length) * 100;

  return (
    <div style={{ maxWidth: "min(680px, 100%)", margin: "0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"28px", flexWrap:"wrap" }}>
        <div style={{ flex:1, height:"3px", background:"var(--color-border)", borderRadius:"2px" }}>
          <div style={{ width:`${progress}%`, height:"100%", background:"var(--color-accent)", borderRadius:"2px", transition:"width 0.3s ease" }} />
        </div>
        <span style={{ color:"var(--color-text-muted)", fontSize:"12px", fontFamily:"var(--font-body)", whiteSpace:"nowrap" }}>
          {idx + 1} / {questions.length}
        </span>
      </div>

      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          minHeight:"260px", background: flipped ? "var(--color-accent-mute)" : "var(--color-surface)",
          border:`1.5px solid ${flipped ? "rgba(45,90,61,0.35)" : "var(--color-border)"}`,
          borderRadius:"var(--radius-lg)", padding:"36px 40px", cursor:"pointer",
          transition:"all 0.25s ease", display:"flex", flexDirection:"column",
          justifyContent:"space-between", userSelect:"none",
          boxShadow: flipped ? "var(--shadow-md)" : "var(--shadow-sm)",
        }}
      >
        <div style={{ display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap" }}>
          <Badge label={current.category}   colorMap={CATEGORY_COLORS} />
          <Badge label={current.difficulty} colorMap={DIFFICULTY_COLORS} />
        </div>
        {!flipped ? (
          <div>
            <p style={{ color:"var(--color-text-muted)", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"var(--font-body)", fontWeight:600, marginBottom:"14px" }}>Question</p>
            <p style={{ color:"var(--color-text)", fontFamily:"var(--font-display)", fontWeight:700, fontSize:"17px", lineHeight:1.6 }}>{current.question}</p>
          </div>
        ) : (
          <div>
            <p style={{ color:"var(--color-accent)", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"var(--font-body)", fontWeight:600, marginBottom:"14px" }}>Model Answer</p>
            <p style={{ color:"var(--color-text)", fontSize:"14px", lineHeight:1.8, fontFamily:"var(--font-body)" }}>{current.answer}</p>
          </div>
        )}
        <p style={{ color:"var(--color-text-muted)", fontSize:"11px", textAlign:"center", marginTop:"24px", fontFamily:"var(--font-body)", opacity:0.7 }}>
          {flipped ? "Click to see question" : "Click to reveal answer"}
        </p>
      </div>

      <div style={{ display:"flex", gap:"10px", marginTop:"18px", justifyContent:"center", flexWrap:"wrap" }}>
        {[
          { label:"← Prev", action:() => { setIdx(i => Math.max(0,i-1)); setFlipped(false); }, disabled: idx===0 },
          { label:"Flip",   action:() => setFlipped(f => !f), disabled: false },
          { label:"Next →", action:() => { setIdx(i => Math.min(questions.length-1,i+1)); setFlipped(false); }, disabled: idx===questions.length-1 },
        ].map(({ label, action, disabled }) => (
          <button key={label} onClick={action} disabled={disabled} className="secondary-btn"
            style={{ opacity: disabled ? 0.35 : 1, cursor: disabled ? "not-allowed" : "pointer", fontSize:"13px", padding:"9px 20px" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Q&A LIST MODE ─────────────────────────────────────────────────────────────
function QAList({ questions }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      {questions.map((q, i) => (
        <div key={i} style={{
          background: open===i ? "var(--color-accent-mute)" : "var(--color-surface)",
          border:`1px solid ${open===i ? "rgba(45,90,61,0.3)" : "var(--color-border)"}`,
          borderRadius:"var(--radius-lg)", overflow:"hidden", transition:"all 0.2s ease",
          boxShadow: open===i ? "var(--shadow-sm)" : "none",
        }}>
          <div onClick={() => setOpen(open===i ? null : i)}
            style={{ padding:"18px 22px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"16px" }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:"8px", marginBottom:"10px", flexWrap:"wrap" }}>
                <Badge label={q.category}   colorMap={CATEGORY_COLORS} />
                <Badge label={q.difficulty} colorMap={DIFFICULTY_COLORS} />
              </div>
              <p style={{ color:"var(--color-text)", fontFamily:"var(--font-display)", fontWeight:700, fontSize:"14px", lineHeight:1.5 }}>{q.question}</p>
            </div>
            <span style={{ color:"var(--color-accent)", fontSize:"16px", flexShrink:0, transform: open===i ? "rotate(180deg)" : "none", transition:"transform 0.2s ease" }}>↓</span>
          </div>
          {open===i && (
            <div style={{ padding:"0 22px 20px", borderTop:"1px solid var(--color-border)" }}>
              <p style={{ color:"var(--color-accent)", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"var(--font-body)", fontWeight:600, margin:"16px 0 10px" }}>Model Answer</p>
              <p style={{ color:"var(--color-text)", fontSize:"14px", lineHeight:1.8, fontFamily:"var(--font-body)" }}>{q.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── EXPORT BUTTON ─────────────────────────────────────────────────────────────
function ExportButton({ questions }) {
  const [exporting, setExporting] = useState(false);
  const handle = async () => {
    setExporting(true);
    try { await exportToPDF(questions); }
    catch(e) { console.error(e); alert("PDF export failed. Please try again."); }
    finally  { setExporting(false); }
  };
  return (
    <>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <button onClick={handle} disabled={exporting} className="primary-btn"
        style={{ opacity: exporting ? 0.7 : 1, cursor: exporting ? "not-allowed" : "pointer", fontSize:"13px", padding:"9px 18px" }}>
        {exporting
          ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⏳</span>&nbsp;Generating…</>
          : <>📄 Export PDF</>
        }
      </button>
    </>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function InterviewPrep() {
  const navigate = useNavigate();
  const [profile, setProfile]               = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [questions, setQuestions]           = useState([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [mode, setMode]                     = useState("list");
  const [filter, setFilter]                 = useState("All");

  useEffect(() => {
    api.get("/profile").then(r => setProfile(r.data)).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!jobDescription.trim()) { setError("Please paste a job description."); return; }
    setLoading(true); setError(""); setQuestions([]);
    try {
      const res = await api.post("/tools/interview-prep", { jobDescription, profile: profile || {} });
      setQuestions(res.data.questions || []);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      setError("Failed to generate questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const categories = ["All", "Behavioural", "Technical", "Situational", "Role-Specific"];
  const filtered   = filter === "All" ? questions : questions.filter(q => q.category === filter);

  return (
    <DashboardLayout>
      <div style={{ maxWidth:"min(900px, 100%)", paddingBottom:"clamp(40px, 6vw, 80px)" }}>

        {/* Header */}
        <div style={{ marginBottom:"32px" }}>
          <p className="section-label">Tools</p>
          <h1 style={{ fontFamily:"var(--font-display)", color:"var(--color-text)", marginBottom:"6px" }}>Interview Prep</h1>
          <p style={{ color:"var(--color-text-muted)", fontSize:"14px", fontFamily:"var(--font-body)" }}>
            AI-generated questions and model answers tailored to your target role.
          </p>
        </div>

        {/* Input card */}
        <div style={{ background:"var(--color-surface)", border:"1px solid var(--color-border)", borderRadius:"var(--radius-lg)", padding:"28px", marginBottom:"28px", boxShadow:"var(--shadow-sm)" }}>
          <label style={{ fontFamily:"var(--font-body)", fontSize:"0.8rem", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--color-text)", marginBottom:"8px", display:"block" }}>
            Job Description
          </label>
          <textarea
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the job description here…"
            className="input-field"
            style={{ minHeight:"140px", marginBottom:"4px" }}
          />
          {error && <p style={{ color:"var(--color-error)", fontSize:"13px", margin:"6px 0 0", fontFamily:"var(--font-body)" }}>{error}</p>}
          <button onClick={handleGenerate} disabled={loading} className="primary-btn"
            style={{ marginTop:"16px", opacity: loading ? 0.65 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Generating questions…" : "✨ Generate Interview Questions"}
          </button>
        </div>

        {/* Skeleton */}
        {loading && (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ height:"72px", background:"var(--color-surface-2)", borderRadius:"var(--radius-lg)", opacity: 1 - i * 0.14 }} />
            ))}
          </div>
        )}

        {/* Results */}
        {questions.length > 0 && !loading && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px", flexWrap:"wrap", gap:"12px" }}>

              {/* Category filter */}
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setFilter(cat)} style={{
                    padding:"5px 14px", borderRadius:"20px", cursor:"pointer", fontSize:"12px",
                    fontFamily:"var(--font-body)", fontWeight:600,
                    border: filter===cat ? "1.5px solid var(--color-accent)" : "1.5px solid var(--color-border)",
                    background: filter===cat ? "var(--color-accent)" : "transparent",
                    color: filter===cat ? "var(--color-surface)" : "var(--color-text-muted)",
                    transition:"all 0.15s ease",
                  }}>{cat}</button>
                ))}
              </div>

              {/* Mode toggle + export */}
              <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                <div style={{ display:"flex", background:"var(--color-surface-2)", borderRadius:"var(--radius-sm)", border:"1px solid var(--color-border)", overflow:"hidden" }}>
                  {["list","flashcard"].map(m => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      padding:"8px 14px", cursor:"pointer", fontSize:"12px",
                      fontFamily:"var(--font-body)", fontWeight:600, border:"none",
                      background: mode===m ? "var(--color-accent)" : "transparent",
                      color: mode===m ? "var(--color-surface)" : "var(--color-text-muted)",
                      transition:"all 0.15s ease",
                    }}>
                      {m==="list" ? "📋 Q&A List" : "🃏 Flashcards"}
                    </button>
                  ))}
                </div>
                <ExportButton questions={questions} jobDescription={jobDescription} />
              </div>
            </div>

            {mode==="list"
              ? <QAList questions={filtered} />
              : <Flashcard questions={filtered.length > 0 ? filtered : questions} />
            }
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}