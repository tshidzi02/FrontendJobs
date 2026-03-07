// =============================================================================
// FILE: frontend/src/pages/InterviewPrep.jsx  (NEW — Phase 7)
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

const CATEGORY_COLORS = {
  "Behavioural":  "#00F5D4",
  "Technical":    "#60A5FA",
  "Situational":  "#A78BFA",
  "Role-Specific":"#FFB347",
};

const DIFFICULTY_COLORS = {
  "Easy":   "#4ADE80",
  "Medium": "#FFB347",
  "Hard":   "#FF6B6B",
};

function Badge({ label, colorMap }) {
  const color = colorMap[label] || "#E0FFFF";
  return (
    <span style={{
      fontSize: "10px", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900,
      letterSpacing: "0.5px", textTransform: "uppercase",
      color, background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: "4px", padding: "2px 8px",
    }}>
      {label}
    </span>
  );
}

// ── FLASHCARD MODE ────────────────────────────────────────────────────────────
function Flashcard({ questions }) {
  const [idx, setIdx]         = useState(0);
  const [flipped, setFlipped] = useState(false);

  const current = questions[idx];
  const progress = ((idx + 1) / questions.length) * 100;

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto" }}>

      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{ flex: 1, height: "4px", background: "rgba(0,245,212,0.1)", borderRadius: "2px" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#00F5D4", borderRadius: "2px", transition: "width 0.3s ease" }} />
        </div>
        <span style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.5, fontFamily: "'Bodoni MT Black', serif", whiteSpace: "nowrap" }}>
          {idx + 1} / {questions.length}
        </span>
      </div>

      {/* Card */}
      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          minHeight:    "280px",
          background:   flipped ? "rgba(0,245,212,0.06)" : "#003B44",
          border:       `1px solid ${flipped ? "rgba(0,245,212,0.4)" : "rgba(0,245,212,0.15)"}`,
          borderRadius: "20px",
          padding:      "40px",
          cursor:       "pointer",
          transition:   "all 0.3s ease",
          display:      "flex",
          flexDirection:"column",
          justifyContent: "space-between",
          userSelect:   "none",
        }}
      >
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          <Badge label={current.category}  colorMap={CATEGORY_COLORS} />
          <Badge label={current.difficulty} colorMap={DIFFICULTY_COLORS} />
        </div>

        {!flipped ? (
          <div>
            <p style={{ color: "#E0FFFF", opacity: 0.35, fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", marginBottom: "16px" }}>
              Question
            </p>
            <p style={{ color: "#E0FFFF", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, fontSize: "18px", lineHeight: 1.6 }}>
              {current.question}
            </p>
          </div>
        ) : (
          <div>
            <p style={{ color: "#00F5D4", opacity: 0.7, fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", marginBottom: "16px" }}>
              Model Answer
            </p>
            <p style={{ color: "#E0FFFF", fontSize: "14px", lineHeight: 1.8, fontFamily: "system-ui, sans-serif" }}>
              {current.answer}
            </p>
          </div>
        )}

        <p style={{ color: "#E0FFFF", opacity: 0.25, fontSize: "11px", textAlign: "center", marginTop: "24px", fontFamily: "system-ui" }}>
          {flipped ? "Click to see question" : "Click to reveal answer"}
        </p>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "center" }}>
        <button
          onClick={() => { setIdx(i => Math.max(0, i - 1)); setFlipped(false); }}
          disabled={idx === 0}
          style={{
            padding: "10px 24px", borderRadius: "8px", cursor: idx === 0 ? "not-allowed" : "pointer",
            background: "transparent", border: "1px solid rgba(0,245,212,0.2)",
            color: "#E0FFFF", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900,
            opacity: idx === 0 ? 0.3 : 1, fontSize: "13px",
          }}
        >
          ← Prev
        </button>
        <button
          onClick={() => { setFlipped(f => !f); }}
          style={{
            padding: "10px 20px", borderRadius: "8px", cursor: "pointer",
            background: "rgba(0,245,212,0.08)", border: "1px solid rgba(0,245,212,0.2)",
            color: "#00F5D4", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, fontSize: "13px",
          }}
        >
          Flip
        </button>
        <button
          onClick={() => { setIdx(i => Math.min(questions.length - 1, i + 1)); setFlipped(false); }}
          disabled={idx === questions.length - 1}
          style={{
            padding: "10px 24px", borderRadius: "8px", cursor: idx === questions.length - 1 ? "not-allowed" : "pointer",
            background: "transparent", border: "1px solid rgba(0,245,212,0.2)",
            color: "#E0FFFF", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900,
            opacity: idx === questions.length - 1 ? 0.3 : 1, fontSize: "13px",
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Q&A LIST MODE ─────────────────────────────────────────────────────────────
function QAList({ questions }) {
  const [open, setOpen] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {questions.map((q, i) => (
        <div
          key={i}
          style={{
            background:   open === i ? "rgba(0,245,212,0.05)" : "#003B44",
            border:       `1px solid ${open === i ? "rgba(0,245,212,0.35)" : "rgba(0,245,212,0.1)"}`,
            borderRadius: "12px",
            overflow:     "hidden",
            transition:   "all 0.2s ease",
          }}
        >
          <div
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              padding:  "18px 22px",
              cursor:   "pointer",
              display:  "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap:      "16px",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <Badge label={q.category}   colorMap={CATEGORY_COLORS} />
                <Badge label={q.difficulty} colorMap={DIFFICULTY_COLORS} />
              </div>
              <p style={{ color: "#E0FFFF", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, fontSize: "14px", lineHeight: 1.5 }}>
                {q.question}
              </p>
            </div>
            <span style={{ color: "#00F5D4", fontSize: "18px", flexShrink: 0, transform: open === i ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
              ↓
            </span>
          </div>

          {open === i && (
            <div style={{ padding: "0 22px 20px", borderTop: "1px solid rgba(0,245,212,0.1)" }}>
              <p style={{ color: "#00F5D4", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", margin: "16px 0 10px" }}>
                Model Answer
              </p>
              <p style={{ color: "#E0FFFF", fontSize: "14px", lineHeight: 1.8, fontFamily: "system-ui, sans-serif", opacity: 0.85 }}>
                {q.answer}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function InterviewPrep() {
  const navigate = useNavigate();
  const [profile, setProfile]           = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [questions, setQuestions]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [mode, setMode]                 = useState("list"); // "list" | "flashcard"
  const [filter, setFilter]             = useState("All");

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
      <div style={{ maxWidth: "900px", paddingBottom: "60px" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Train One', cursive", fontSize: "32px", color: "#00F5D4", letterSpacing: "2px", marginBottom: "6px" }}>
            INTERVIEW PREP
          </h1>
          <p style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.5 }}>
            AI-generated questions and model answers tailored to your target role
          </p>
        </div>

        {/* Input */}
        <div style={{ background: "#003B44", borderRadius: "16px", padding: "28px", marginBottom: "28px", border: "1px solid rgba(0,245,212,0.1)" }}>
          <label style={{ color: "#E0FFFF", fontSize: "11px", opacity: 0.5, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", display: "block", marginBottom: "10px" }}>
            Job Description
          </label>
          <textarea
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            style={{
              width: "100%", minHeight: "140px", padding: "14px",
              background: "#0B1E2A", border: "1px solid rgba(0,245,212,0.2)",
              borderRadius: "10px", color: "#E0FFFF", fontSize: "13px",
              fontFamily: "system-ui, sans-serif", lineHeight: 1.6,
              resize: "vertical", outline: "none", boxSizing: "border-box",
            }}
          />
          {error && <p style={{ color: "#FF6B6B", fontSize: "13px", margin: "10px 0 0" }}>{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="primary-btn"
            style={{ marginTop: "16px", fontSize: "14px", padding: "12px 28px", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Generating questions..." : "✨ Generate Interview Questions"}
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ height: "72px", background: "#003B44", borderRadius: "12px", opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        )}

        {/* Results */}
        {questions.length > 0 && !loading && (
          <div>
            {/* Controls row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              {/* Category filter */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    style={{
                      padding: "6px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "12px",
                      fontFamily: "'Bodoni MT Black', serif", fontWeight: 900,
                      background: filter === cat ? "#00F5D4" : "transparent",
                      color:      filter === cat ? "#0B1E2A" : "#E0FFFF",
                      border:     filter === cat ? "1px solid #00F5D4" : "1px solid rgba(0,245,212,0.2)",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Mode toggle */}
              <div style={{ display: "flex", background: "#003B44", borderRadius: "8px", border: "1px solid rgba(0,245,212,0.15)", overflow: "hidden" }}>
                {["list", "flashcard"].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      padding: "8px 16px", cursor: "pointer", fontSize: "12px",
                      fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, border: "none",
                      background: mode === m ? "#00F5D4" : "transparent",
                      color:      mode === m ? "#0B1E2A" : "#E0FFFF",
                    }}
                  >
                    {m === "list" ? "📋 Q&A List" : "🃏 Flashcards"}
                  </button>
                ))}
              </div>
            </div>

            {mode === "list"
              ? <QAList questions={filtered} />
              : <Flashcard questions={filtered.length > 0 ? filtered : questions} />
            }
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}