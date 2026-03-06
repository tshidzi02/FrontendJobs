// =============================================================================
// FILE: frontend/src/pages/SalaryEstimator.jsx  (NEW — Phase 7)
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

function RangeBar({ min, max, mid, symbol, color = "#00F5D4" }) {
  const total = max - min || 1;
  const midPercent = ((mid - min) / total) * 100;
  return (
    <div style={{ margin: "12px 0 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.5, fontFamily: "system-ui" }}>{symbol}{min?.toLocaleString()}</span>
        <span style={{ color, fontFamily: "'Train One', cursive", fontSize: "22px" }}>{symbol}{mid?.toLocaleString()}</span>
        <span style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.5, fontFamily: "system-ui" }}>{symbol}{max?.toLocaleString()}</span>
      </div>
      <div style={{ position: "relative", height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, background: `linear-gradient(90deg, ${color}30, ${color}80)`, borderRadius: "4px" }} />
        <div style={{
          position: "absolute", top: "50%", left: `${midPercent}%`,
          transform: "translate(-50%, -50%)",
          width: "16px", height: "16px", borderRadius: "50%",
          background: color, border: "2px solid #0B1E2A",
          boxShadow: `0 0 12px ${color}80`,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
        <span style={{ color: "#E0FFFF", fontSize: "10px", opacity: 0.3, letterSpacing: "1px", fontFamily: "'Bodoni MT Black', serif" }}>MIN</span>
        <span style={{ color, fontSize: "10px", letterSpacing: "1px", fontFamily: "'Bodoni MT Black', serif" }}>MEDIAN</span>
        <span style={{ color: "#E0FFFF", fontSize: "10px", opacity: 0.3, letterSpacing: "1px", fontFamily: "'Bodoni MT Black', serif" }}>MAX</span>
      </div>
    </div>
  );
}

export default function SalaryEstimator() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm]       = useState({ jobTitle: "", location: "", experienceYears: "", jobDescription: "" });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.get("/profile").then(r => {
      const p = r.data;
      setProfile(p);
      if (p?.currentRole) setForm(f => ({ ...f, jobTitle: p.currentRole }));
    }).catch(() => {});
  }, []);

  const handleEstimate = async () => {
    if (!form.jobTitle.trim()) { setError("Please enter a job title."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await api.post("/tools/salary", {
        jobTitle:        form.jobTitle,
        location:        form.location,
        skills:          profile?.skills || [],
        experienceYears: parseInt(form.experienceYears) || 0,
        jobDescription:  form.jobDescription,
      });
      setResult(res.data);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      setError("Estimation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "11px 14px",
    background: "#0B1E2A", border: "1px solid rgba(0,245,212,0.2)",
    borderRadius: "8px", color: "#E0FFFF", fontSize: "13px",
    fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box",
  };

  const labelStyle = {
    color: "#E0FFFF", fontSize: "11px", opacity: 0.5, letterSpacing: "2px",
    textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif",
    display: "block", marginBottom: "8px",
  };

  const s = result?.currency_symbol || "";

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "800px", paddingBottom: "60px" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Train One', cursive", fontSize: "32px", color: "#00F5D4", letterSpacing: "2px", marginBottom: "6px" }}>
            SALARY ESTIMATOR
          </h1>
          <p style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.5 }}>
            AI-powered salary estimates with market context and negotiation tips
          </p>
        </div>

        {/* Form */}
        <div style={{ background: "#003B44", borderRadius: "16px", padding: "28px", marginBottom: "28px", border: "1px solid rgba(0,245,212,0.1)" }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <label style={labelStyle}>Job Title *</label>
              <input style={inputStyle} placeholder="e.g. Senior Software Engineer" value={form.jobTitle}
                onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
            </div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} placeholder="e.g. Cape Town, South Africa" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div style={{ flex: "0 0 140px" }}>
              <label style={labelStyle}>Years of Exp.</label>
              <input style={inputStyle} type="number" min="0" max="30" placeholder="e.g. 4" value={form.experienceYears}
                onChange={e => setForm(f => ({ ...f, experienceYears: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Job Description (optional — improves accuracy)</label>
            <textarea
              value={form.jobDescription}
              onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))}
              placeholder="Paste the job description for a more accurate estimate..."
              style={{ ...inputStyle, minHeight: "100px", resize: "vertical", lineHeight: 1.6 }}
            />
          </div>
          {error && <p style={{ color: "#FF6B6B", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
          <button onClick={handleEstimate} disabled={loading} className="primary-btn"
            style={{ fontSize: "14px", padding: "12px 28px", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Estimating..." : "💰 Estimate Salary"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ background: "#003B44", borderRadius: "16px", height: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#E0FFFF", opacity: 0.4, fontFamily: "'Bodoni MT Black', serif" }}>Analysing market data...</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Main salary card */}
            <div style={{ background: "#003B44", borderRadius: "16px", padding: "32px", border: "1px solid rgba(0,245,212,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
                <div>
                  <p style={{ color: "#E0FFFF", fontSize: "11px", opacity: 0.4, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", marginBottom: "4px" }}>
                    {result.role} · {result.location}
                  </p>
                  <h2 style={{ color: "#00F5D4", fontFamily: "'Train One', cursive", fontSize: "42px", lineHeight: 1 }}>
                    {s}{result.range_mid?.toLocaleString()}
                    <span style={{ color: "#E0FFFF", fontSize: "14px", opacity: 0.5, fontFamily: "system-ui", marginLeft: "8px" }}>
                      / {result.period}
                    </span>
                  </h2>
                </div>
                <span style={{ background: "rgba(0,245,212,0.1)", border: "1px solid rgba(0,245,212,0.3)", borderRadius: "8px", padding: "6px 14px", color: "#00F5D4", fontFamily: "'Bodoni MT Black', serif", fontSize: "12px" }}>
                  {result.currency}
                </span>
              </div>

              <RangeBar min={result.range_min} max={result.range_max} mid={result.range_mid} symbol={s} />

              <p style={{ color: "#E0FFFF", fontSize: "13px", lineHeight: 1.7, fontFamily: "system-ui", opacity: 0.75 }}>
                {result.reasoning}
              </p>
            </div>

            {/* Experience tiers */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {[result.junior_range, result.mid_range, result.senior_range].filter(Boolean).map((tier, i) => {
                const colors = ["#60A5FA", "#00F5D4", "#FFB347"];
                return (
                  <div key={i} style={{ flex: 1, minWidth: "160px", background: "#003B44", borderRadius: "12px", padding: "20px", border: `1px solid ${colors[i]}20` }}>
                    <p style={{ color: colors[i], fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", marginBottom: "8px" }}>
                      {tier.label}
                    </p>
                    <p style={{ color: colors[i], fontFamily: "'Train One', cursive", fontSize: "22px", marginBottom: "4px" }}>
                      {s}{tier.min?.toLocaleString()}
                    </p>
                    <p style={{ color: "#E0FFFF", opacity: 0.4, fontSize: "11px", fontFamily: "system-ui" }}>
                      up to {s}{tier.max?.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Two columns: market factors + negotiation tips */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {/* Market factors */}
              <div style={{ flex: 1, minWidth: "240px", background: "#003B44", borderRadius: "12px", padding: "22px", border: "1px solid rgba(0,245,212,0.08)" }}>
                <p style={{ color: "#E0FFFF", fontSize: "11px", opacity: 0.4, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", marginBottom: "14px" }}>
                  📈 Market Factors
                </p>
                {(result.market_factors || []).map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-start" }}>
                    <span style={{ color: "#00F5D4", fontSize: "12px", marginTop: "1px", flexShrink: 0 }}>▸</span>
                    <p style={{ color: "#E0FFFF", fontSize: "13px", lineHeight: 1.5, fontFamily: "system-ui", opacity: 0.8 }}>{f}</p>
                  </div>
                ))}
                {(result.high_demand_skills || []).length > 0 && (
                  <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(0,245,212,0.1)" }}>
                    <p style={{ color: "#FFB347", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", marginBottom: "8px" }}>
                      🔥 High-Demand Skills
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {result.high_demand_skills.map((sk, i) => (
                        <span key={i} style={{ background: "rgba(255,179,71,0.12)", border: "1px solid rgba(255,179,71,0.3)", borderRadius: "4px", padding: "3px 10px", color: "#FFB347", fontSize: "11px", fontFamily: "'Bodoni MT Black', serif" }}>
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Negotiation tips */}
              <div style={{ flex: 1, minWidth: "240px", background: "#003B44", borderRadius: "12px", padding: "22px", border: "1px solid rgba(74,222,128,0.15)" }}>
                <p style={{ color: "#E0FFFF", fontSize: "11px", opacity: 0.4, letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif", marginBottom: "14px" }}>
                  💡 Negotiation Tips
                </p>
                {(result.negotiation_tips || []).map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "flex-start" }}>
                    <span style={{ background: "rgba(74,222,128,0.15)", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ADE80", fontSize: "10px", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, flexShrink: 0, marginTop: "1px" }}>
                      {i + 1}
                    </span>
                    <p style={{ color: "#E0FFFF", fontSize: "13px", lineHeight: 1.5, fontFamily: "system-ui", opacity: 0.8 }}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}