
// =============================================================================
// FILE: frontend/src/pages/SkillsGap.jsx  (NEW — Phase 7)
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

const IMPORTANCE_COLORS = {
  "Critical":      "#FF6B6B",
  "Important":     "#FFB347",
  "Nice-to-have":  "#60A5FA",
};

const RELEVANCE_COLORS = {
  "High":   "#00F5D4",
  "Medium": "#FFB347",
  "Low":    "#E0FFFF",
};

function ScoreRing({ score }) {
  const color = score >= 70 ? "#00F5D4" : score >= 45 ? "#FFB347" : "#FF6B6B";
  const circumference = 2 * Math.PI * 54;
  const dashOffset    = circumference * (1 - score / 100);

  return (
    <div style={{ position: "relative", width: "140px", height: "140px", flexShrink: 0 }}>
      <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r="54" fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <p style={{ color, fontFamily: "'Train One', cursive", fontSize: "32px", lineHeight: 1 }}>{score}</p>
        <p style={{ color: "#E0FFFF", fontSize: "10px", opacity: 0.4, fontFamily: "'Bodoni MT Black', serif", letterSpacing: "1px" }}>MATCH</p>
      </div>
    </div>
  );
}

export default function SkillsGap() {
  const navigate = useNavigate();
  const [profile, setProfile]               = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult]                 = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [activeTab, setActiveTab]           = useState("missing");

  useEffect(() => {
    api.get("/profile").then(r => setProfile(r.data)).catch(() => {});
  }, []);

  const handleAnalyse = async () => {
    if (!jobDescription.trim()) { setError("Please paste a job description."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await api.post("/tools/skills-gap", { jobDescription, profile: profile || {} });
      setResult(res.data);
      setActiveTab("missing");
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      setError("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "missing",  label: "❌ Missing Skills",  count: result?.missing_skills?.length  },
    { id: "present",  label: "✅ Present Skills",   count: result?.present_skills?.length  },
    { id: "actions",  label: "🎯 Priority Actions", count: result?.priority_actions?.length },
    { id: "nicehave", label: "⭐ Nice to Have",     count: result?.nice_to_have?.length    },
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(900px, 100%)", paddingBottom: "clamp(40px, 6vw, 80px)" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Train One', cursive", fontSize: "clamp(20px, 4vw, 32px)", color: "#00F5D4", letterSpacing: "2px", marginBottom: "6px" }}>
            SKILLS GAP REPORT
          </h1>
          <p style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.5 }}>
            Detailed breakdown of your skills vs the job requirements
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
            placeholder="Paste the job description to analyse the skills gap..."
            style={{
              width: "100%", minHeight: "140px", padding: "14px",
              background: "#0B1E2A", border: "1px solid rgba(0,245,212,0.2)",
              borderRadius: "10px", color: "#E0FFFF", fontSize: "13px",
              fontFamily: "system-ui, sans-serif", lineHeight: 1.6,
              resize: "vertical", outline: "none", boxSizing: "border-box",
            }}
          />
          {profile && (
            <p style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.45, marginTop: "8px" }}>
              ✓ Using your profile — {profile.skills?.length || 0} skills on file
            </p>
          )}
          {error && <p style={{ color: "#FF6B6B", fontSize: "13px", margin: "8px 0 0" }}>{error}</p>}
          <button onClick={handleAnalyse} disabled={loading} className="primary-btn"
            style={{ marginTop: "16px", fontSize: "14px", padding: "12px 28px", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Analysing..." : "🔍 Analyse Skills Gap"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ height: "60px", background: "#003B44", borderRadius: "10px", opacity: 1 - i * 0.12 }} />)}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div>
            {/* Score + summary */}
            <div style={{ background: "#003B44", borderRadius: "16px", padding: "28px", marginBottom: "20px", border: "1px solid rgba(0,245,212,0.15)", display: "flex", gap: "28px", alignItems: "center", flexWrap: "wrap" }}>
              <ScoreRing score={result.match_score} />
              <div style={{ flex: 1, minWidth: "200px" }}>
                <p style={{ color: "#E0FFFF", fontSize: "11px", opacity: 0.4, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", marginBottom: "10px" }}>
                  Overall Assessment
                </p>
                <p style={{ color: "#E0FFFF", fontSize: "14px", lineHeight: 1.8, fontFamily: "system-ui", opacity: 0.85 }}>
                  {result.summary}
                </p>
                <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
                  <span style={{ background: "rgba(0,245,212,0.1)", border: "1px solid rgba(0,245,212,0.25)", borderRadius: "6px", padding: "4px 12px", color: "#00F5D4", fontSize: "11px", fontFamily: "'Bodoni MT Black', serif" }}>
                    ✅ {result.present_skills?.length || 0} matching skills
                  </span>
                  <span style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.25)", borderRadius: "6px", padding: "4px 12px", color: "#FF6B6B", fontSize: "11px", fontFamily: "'Bodoni MT Black', serif" }}>
                    ❌ {result.missing_skills?.length || 0} missing skills
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0", marginBottom: "20px", background: "#003B44", borderRadius: "10px", border: "1px solid rgba(0,245,212,0.1)", overflow: "hidden" }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: "12px 8px", cursor: "pointer", border: "none", fontSize: "12px",
                    fontFamily: "'Bodoni MT Black', serif", fontWeight: 900,
                    background: activeTab === tab.id ? "rgba(0,245,212,0.12)" : "transparent",
                    color:      activeTab === tab.id ? "#00F5D4" : "#E0FFFF",
                    borderBottom: activeTab === tab.id ? "2px solid #00F5D4" : "2px solid transparent",
                    transition:  "all 0.15s",
                  }}
                >
                  {tab.label}
                  {tab.count != null && (
                    <span style={{ marginLeft: "6px", background: "rgba(0,245,212,0.15)", borderRadius: "10px", padding: "1px 7px", fontSize: "10px" }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab: Missing skills */}
            {activeTab === "missing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(result.missing_skills || []).map((sk, i) => {
                  const color = IMPORTANCE_COLORS[sk.importance] || "#E0FFFF";
                  return (
                    <div key={i} style={{ background: "#003B44", borderRadius: "12px", padding: "18px 22px", border: `1px solid ${color}20`, borderLeft: `3px solid ${color}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                            <p style={{ color: "#E0FFFF", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, fontSize: "14px" }}>{sk.skill}</p>
                            <span style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: "4px", padding: "1px 8px", color, fontSize: "10px", fontFamily: "'Bodoni MT Black', serif", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                              {sk.importance}
                            </span>
                          </div>
                          <p style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.6, fontFamily: "system-ui", lineHeight: 1.5 }}>
                            📚 {sk.how_to_learn}
                          </p>
                        </div>
                        <span style={{ color, fontSize: "11px", fontFamily: "'Bodoni MT Black', serif", opacity: 0.8, whiteSpace: "nowrap" }}>
                          ⏱ {sk.time_to_learn}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {(!result.missing_skills || result.missing_skills.length === 0) && (
                  <p style={{ color: "#4ADE80", textAlign: "center", fontFamily: "'Bodoni MT Black', serif", padding: "40px" }}>
                    🎉 No critical skills gaps found!
                  </p>
                )}
              </div>
            )}

            {/* Tab: Present skills */}
            {activeTab === "present" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {(result.present_skills || []).map((sk, i) => {
                  const color = RELEVANCE_COLORS[sk.relevance] || "#E0FFFF";
                  return (
                    <div key={i} style={{ background: "#003B44", borderRadius: "10px", padding: "14px 18px", border: `1px solid ${color}25`, flex: "1 1 280px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <p style={{ color: "#E0FFFF", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, fontSize: "13px" }}>{sk.skill}</p>
                        <span style={{ color, fontSize: "10px", fontFamily: "'Bodoni MT Black', serif", textTransform: "uppercase" }}>{sk.relevance}</span>
                      </div>
                      <p style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.5, fontFamily: "system-ui", lineHeight: 1.5 }}>{sk.note}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab: Priority actions */}
            {activeTab === "actions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(result.priority_actions || []).map((action, i) => (
                  <div key={i} style={{ background: "#003B44", borderRadius: "12px", padding: "18px 22px", border: "1px solid rgba(0,245,212,0.12)", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
                    <span style={{ background: "rgba(0,245,212,0.12)", border: "1px solid rgba(0,245,212,0.3)", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", color: "#00F5D4", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, fontSize: "12px", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <p style={{ color: "#E0FFFF", fontSize: "14px", lineHeight: 1.6, fontFamily: "system-ui", paddingTop: "3px" }}>{action}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Nice to have */}
            {activeTab === "nicehave" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {(result.nice_to_have || []).map((sk, i) => (
                  <div key={i} style={{ background: "#003B44", borderRadius: "10px", padding: "14px 18px", border: "1px solid rgba(96,165,250,0.2)", flex: "1 1 280px" }}>
                    <p style={{ color: "#60A5FA", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, fontSize: "13px", marginBottom: "6px" }}>{sk.skill}</p>
                    <p style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.5, fontFamily: "system-ui", lineHeight: 1.5 }}>{sk.benefit}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

