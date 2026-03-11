
// =============================================================================
// FILE: frontend/src/pages/LinkedInOptimiser.jsx  (NEW — Phase 7)
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

const TONE_COLORS = {
  "Professional":  "#2D5A3D",
  "Conversational":"#60A5FA",
  "Bold":          "#FFB347",
};

const TONE_ICONS = {
  "Professional":  "🎯",
  "Conversational":"💬",
  "Bold":          "⚡",
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "11px",
        fontFamily: "'Libre Baskerville', serif", fontWeight: 900,
        background: copied ? "rgba(45,90,61,0.15)" : "transparent",
        border: "1px solid rgba(45,90,61,0.25)", color: copied ? "#2D5A3D" : "#1E2018",
        transition: "all 0.2s",
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export default function LinkedInOptimiser() {
  const navigate = useNavigate();
  const [profile, setProfile]           = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [currentBio, setCurrentBio]     = useState("");
  const [variations, setVariations]     = useState([]);
  const [selected, setSelected]         = useState(0);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  useEffect(() => {
    api.get("/profile").then(r => setProfile(r.data)).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!jobDescription.trim()) { setError("Please paste a job description."); return; }
    setLoading(true); setError(""); setVariations([]);
    try {
      const res = await api.post("/tools/linkedin", {
        jobDescription, profile: profile || {}, currentBio,
      });
      setVariations(res.data.variations || []);
      setSelected(0);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      setError("Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const current = variations[selected];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(900px, 100%)", paddingBottom: "clamp(40px, 6vw, 80px)" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Libre Baskerville', serif", fontSize: "clamp(20px, 4vw, 32px)", color: "#2D5A3D", letterSpacing: "2px", marginBottom: "6px" }}>
            LINKEDIN OPTIMISER
          </h1>
          <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.5 }}>
            3 tailored LinkedIn summaries and headlines — pick your tone
          </p>
        </div>

        {/* Inputs */}
        <div style={{ background: "#F0EAD8", borderRadius: "16px", padding: "28px", marginBottom: "28px", border: "1px solid rgba(45,90,61,0.1)" }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: "280px" }}>
              <label style={{ color: "#1E2018", fontSize: "11px", opacity: 0.5, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Libre Baskerville', serif", display: "block", marginBottom: "10px" }}>
                Target Job Description *
              </label>
              <textarea
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste the job description you're targeting..."
                style={{
                  width: "100%", minHeight: "130px", padding: "14px",
                  background: "#FFFFFF", border: "1px solid rgba(45,90,61,0.2)",
                  borderRadius: "10px", color: "#1E2018", fontSize: "13px",
                  fontFamily: "system-ui, sans-serif", lineHeight: 1.6,
                  resize: "vertical", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <label style={{ color: "#1E2018", fontSize: "11px", opacity: 0.5, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Libre Baskerville', serif", display: "block", marginBottom: "10px" }}>
                Current LinkedIn Bio (optional)
              </label>
              <textarea
                value={currentBio}
                onChange={e => setCurrentBio(e.target.value)}
                placeholder="Paste your current bio to improve it..."
                style={{
                  width: "100%", minHeight: "130px", padding: "14px",
                  background: "#FFFFFF", border: "1px solid rgba(45,90,61,0.2)",
                  borderRadius: "10px", color: "#1E2018", fontSize: "13px",
                  fontFamily: "system-ui, sans-serif", lineHeight: 1.6,
                  resize: "vertical", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {error && <p style={{ color: "#8B2020", fontSize: "13px", margin: "10px 0 0" }}>{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="primary-btn"
            style={{ marginTop: "16px", fontSize: "14px", padding: "12px 28px", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Generating summaries..." : "✨ Generate LinkedIn Summaries"}
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: "340px", background: "#F0EAD8", borderRadius: "16px", opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}

        {/* Results */}
        {variations.length > 0 && !loading && (
          <div>
            {/* Tone selector tabs */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
              {variations.map((v, i) => {
                const col = TONE_COLORS[v.tone] || "#2D5A3D";
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(i)}
                    style={{
                      flex: 1, minWidth: "140px", padding: "14px 20px",
                      borderRadius: "12px", cursor: "pointer",
                      background: selected === i ? `${col}15` : "#F0EAD8",
                      border: `1px solid ${selected === i ? col : "rgba(45,90,61,0.1)"}`,
                      color: selected === i ? col : "#1E2018",
                      fontFamily: "'Libre Baskerville', serif", fontWeight: 900,
                      fontSize: "13px", transition: "all 0.2s",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "22px", marginBottom: "4px" }}>{TONE_ICONS[v.tone]}</div>
                    {v.tone}
                  </button>
                );
              })}
            </div>

            {/* Active variation */}
            {current && (
              <div style={{ background: "#F0EAD8", borderRadius: "16px", padding: "28px", border: `1px solid ${TONE_COLORS[current.tone] || "#2D5A3D"}40` }}>

                {/* Headline */}
                <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(45,90,61,0.1)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" }}>
                    <p style={{ color: "#1E2018", fontSize: "11px", opacity: 0.4, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Libre Baskerville', serif" }}>
                      LinkedIn Headline
                    </p>
                    <CopyButton text={current.headline} />
                  </div>
                  <p style={{ color: TONE_COLORS[current.tone] || "#2D5A3D", fontFamily: "'Libre Baskerville', serif", fontWeight: 900, fontSize: "16px", lineHeight: 1.5 }}>
                    {current.headline}
                  </p>
                  <p style={{ color: "#1E2018", fontSize: "11px", opacity: 0.35, marginTop: "8px" }}>
                    {current.headline?.length || 0} / 220 characters
                  </p>
                </div>

                {/* Summary */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <p style={{ color: "#1E2018", fontSize: "11px", opacity: 0.4, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Libre Baskerville', serif" }}>
                      Summary
                    </p>
                    <CopyButton text={current.summary} />
                  </div>
                  <p style={{ color: "#1E2018", fontSize: "14px", lineHeight: 1.9, fontFamily: "system-ui, sans-serif", whiteSpace: "pre-wrap" }}>
                    {current.summary}
                  </p>
                  <p style={{ color: "#1E2018", fontSize: "11px", opacity: 0.35, marginTop: "12px" }}>
                    {current.summary?.split(" ").length || 0} words
                  </p>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

