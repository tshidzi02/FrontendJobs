

// =============================================================================
// FILE: frontend/src/pages/Dashboard.jsx  (UPDATED — Phase 5.6: Tracker Stats)
// =============================================================================
// WHAT'S NEW:
//   ✅ Tracker stats row: Total Applied, Interviews, Offers, Response Rate
//   ✅ Quick action cards updated — Job Board & App Tracker now live links
//   ✅ Build Progress updated — Phases 1-5 marked done
//   ✅ Cold-start banner when profile is empty
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import api from "../services/api";


function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}


// ── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, subtext, color = "#2D5A3D", isEmpty = false, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   "#F0EAD8",
        border:       "1px solid rgba(45,90,61,0.15)",
        borderRadius: "12px",
        padding:      "24px 28px",
        flex:         1,
        minWidth:     "140px",
        cursor:       onClick ? "pointer" : "default",
        transition:   "border-color 0.2s ease",
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = "rgba(45,90,61,0.15)"; }}
    >
      <p style={{
        color: "#1E2018", fontSize: "11px", opacity: 0.4,
        letterSpacing: "1.5px", textTransform: "uppercase",
        fontFamily: "'Libre Baskerville', serif", marginBottom: "10px",
      }}>
        {label}
      </p>
      <p style={{
        color:      isEmpty ? "rgba(30,32,24,0.2)" : color,
        fontFamily: "'Libre Baskerville', serif",
        fontSize: "clamp(20px, 3.5vw, 36px)", lineHeight: 1,
        marginBottom: subtext ? "8px" : "0",
        transition: "color 0.3s ease",
      }}>
        {isEmpty ? "—" : value}
      </p>
      {subtext && !isEmpty && (
        <p style={{
          color: "#1E2018", fontSize: "12px", opacity: 0.45,
          fontFamily: "'Libre Baskerville', serif", marginTop: "4px",
          whiteSpace: "nowrap", overflow: "hidden",
          textOverflow: "ellipsis", maxWidth: "180px",
        }}>
          {subtext}
        </p>
      )}
    </div>
  );
}


// ── SECTION DIVIDER ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      color:         "#1E2018",
      fontSize:      "10px",
      opacity:       0.35,
      letterSpacing: "2px",
      textTransform: "uppercase",
      fontFamily:    "'Libre Baskerville', serif",
      marginBottom:  "12px",
    }}>
      {children}
    </p>
  );
}


// ── QUICK ACTION CARD ─────────────────────────────────────────────────────────
function ActionCard({ emoji, title, description, badge, onClick, muted }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:   "#F0EAD8",
        border:       muted ? "1px dashed rgba(45,90,61,0.1)" : "1px solid rgba(45,90,61,0.15)",
        borderRadius: "12px",
        padding:      "24px",
        cursor:       onClick ? "pointer" : "default",
        opacity:      muted ? 0.45 : 1,
        transition:   "border-color 0.2s ease, transform 0.2s ease",
      }}
      onMouseEnter={e => {
        if (!muted && onClick) {
          e.currentTarget.style.borderColor = "#2D5A3D";
          e.currentTarget.style.transform   = "translateY(-2px)";
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = muted ? "rgba(45,90,61,0.1)" : "rgba(45,90,61,0.15)";
        e.currentTarget.style.transform   = "translateY(0)";
      }}
    >
      <div style={{ fontSize: "28px", marginBottom: "12px" }}>{emoji}</div>
      <h3 style={{
        color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
        fontSize: "15px", marginBottom: "8px",
      }}>
        {title}
        {badge != null && badge > 0 && (
          <span style={{
            marginLeft: "8px", background: "rgba(45,90,61,0.15)",
            border: "1px solid rgba(45,90,61,0.3)", color: "#2D5A3D",
            fontSize: "11px", padding: "2px 8px", borderRadius: "10px",
            fontFamily: "'Libre Baskerville', serif", verticalAlign: "middle",
          }}>
            {badge}
          </span>
        )}
      </h3>
      <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.6 }}>{description}</p>
    </div>
  );
}


// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function Dashboard() {
  const [userData, setUserData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get("/dashboard");
        setUserData(response.data);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        } else {
          setError("Failed to load dashboard. Please refresh.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [navigate]);

  const scoreColor = (score) => {
    if (score === null || score === undefined) return "#2D5A3D";
    if (score >= 70) return "#2D5A3D";
    if (score >= 40) return "#FFB347";
    return "#8B2020";
  };

  return (
    <DashboardLayout>

      {/* ── LOADING ───────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ paddingTop: "60px" }}>
          <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{
                flex: 1, minWidth: "140px", height: "110px",
                background: "#F0EAD8", borderRadius: "12px",
                border: "1px solid rgba(45,90,61,0.08)",
              }} />
            ))}
          </div>
          <div style={{ height: "200px", background: "#F0EAD8", borderRadius: "12px" }} />
          <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.85} }`}</style>
        </div>
      )}

      {/* ── ERROR ─────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ textAlign: "center", paddingTop: "60px" }}>
          <p style={{ color: "#8B2020", fontSize: "16px" }}>{error}</p>
        </div>
      )}

      {/* ── LOADED ────────────────────────────────────────────────────────── */}
      {userData && !loading && (
        <div>

          {/* Welcome header */}
          <div style={{ marginBottom: "32px" }}>
            <h1 style={{
              fontFamily: "'Libre Baskerville', serif", fontSize: "clamp(20px, 4vw, 32px)",
              color: "#2D5A3D", letterSpacing: "2px", marginBottom: "6px",
            }}>
              Welcome Back
            </h1>
            <p style={{ color: "#1E2018", fontSize: "14px", opacity: 0.5 }}>
              {userData.email}
            </p>
          </div>


          {/* ── CV STATS ROW ──────────────────────────────────────────────── */}
          <SectionLabel>CV Performance</SectionLabel>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "28px" }}>
            <StatCard
              label="CVs Generated"
              value={userData.cv_count}
              subtext={userData.cv_count === 1 ? "CV saved" : "CVs saved"}
              color="#2D5A3D"
              isEmpty={userData.cv_count === 0}
              onClick={() => navigate("/cabinet")}
            />
            <StatCard
              label="Best ATS Score"
              value={`${userData.best_score}%`}
              subtext="highest score achieved"
              color={scoreColor(userData.best_score)}
              isEmpty={userData.best_score === null}
            />
            <StatCard
              label="Avg ATS Score"
              value={`${userData.average_score}%`}
              subtext="across all CVs"
              color={scoreColor(userData.average_score)}
              isEmpty={userData.average_score === null}
            />
            <StatCard
              label="Cover Letters"
              value={userData.cover_letter_count}
              subtext="saved"
              color="#A78BFA"
              isEmpty={userData.cover_letter_count === 0}
              onClick={() => navigate("/cover-letter")}
            />
          </div>


          {/* ── TRACKER STATS ROW ─────────────────────────────────────────── */}
          <SectionLabel>Application Tracker</SectionLabel>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "28px" }}>
            <StatCard
              label="Total Applied"
              value={userData.tracker_applied}
              subtext="applications sent"
              color="#2D5A3D"
              isEmpty={userData.tracker_total === 0}
              onClick={() => navigate("/tracker")}
            />
            <StatCard
              label="Interviews"
              value={userData.tracker_interviews}
              subtext="in pipeline"
              color="#A78BFA"
              isEmpty={userData.tracker_total === 0}
              onClick={() => navigate("/tracker")}
            />
            <StatCard
              label="Offers"
              value={userData.tracker_offers}
              subtext="received"
              color="#4ADE80"
              isEmpty={userData.tracker_total === 0}
              onClick={() => navigate("/tracker")}
            />
            <StatCard
              label="Response Rate"
              value={`${userData.tracker_response_rate ?? 0}%`}
              subtext="interviews + offers / applied"
              color="#FFB347"
              isEmpty={userData.tracker_applied === 0}
              onClick={() => navigate("/tracker")}
            />
          </div>


          {/* ── COLD START BANNER ─────────────────────────────────────────── */}
          {userData.cv_count === 0 && (
            <div style={{
              background:    "rgba(45,90,61,0.04)",
              border:        "1px solid rgba(45,90,61,0.2)",
              borderRadius:  "12px",
              padding:       "28px 32px",
              marginBottom:  "28px",
              display:       "flex",
              alignItems:    "center",
              justifyContent: "space-between",
              gap:           "20px",
              flexWrap:      "wrap",
            }}>
              <div>
                <p style={{
                  color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "15px", fontWeight: 900, marginBottom: "6px",
                }}>
                  👋 Welcome! Let's get your profile set up.
                </p>
                <p style={{
                  color: "#1E2018", fontSize: "13px", opacity: 0.6,
                  fontFamily: "system-ui, sans-serif", lineHeight: 1.5,
                }}>
                  Add your skills, experience and education — then paste a job
                  description to generate your first tailored CV.
                </p>
              </div>
              <button
                onClick={() => navigate("/profile")}
                className="primary-btn"
                style={{ whiteSpace: "nowrap", fontSize: "14px", padding: "12px 24px" }}
              >
                Complete My Profile →
              </button>
            </div>
          )}


          {/* ── LAST GENERATED BANNER ─────────────────────────────────────── */}
          {userData.last_job_title && (
            <div
              onClick={() => navigate("/cabinet")}
              style={{
                background:    "rgba(45,90,61,0.04)",
                border:        "1px solid rgba(45,90,61,0.2)",
                borderRadius:  "12px",
                padding:       "18px 24px",
                marginBottom:  "28px",
                cursor:        "pointer",
                display:       "flex",
                alignItems:    "center",
                justifyContent: "space-between",
                flexWrap:      "wrap",
                gap:           "12px",
                transition:    "background 0.2s ease, border-color 0.2s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background   = "rgba(45,90,61,0.08)";
                e.currentTarget.style.borderColor  = "rgba(45,90,61,0.4)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background   = "rgba(45,90,61,0.04)";
                e.currentTarget.style.borderColor  = "rgba(45,90,61,0.2)";
              }}
            >
              <div>
                <p style={{
                  color: "#1E2018", fontSize: "11px", opacity: 0.4,
                  letterSpacing: "1.5px", textTransform: "uppercase",
                  fontFamily: "'Libre Baskerville', serif", marginBottom: "6px",
                }}>
                  Last Generated
                </p>
                <p style={{
                  color: "#1E2018", fontFamily: "'Libre Baskerville', serif",
                  fontSize: "15px", marginBottom: "3px",
                }}>
                  {userData.last_job_title}
                </p>
                {userData.last_saved_at && (
                  <p style={{ color: "#1E2018", fontSize: "12px", opacity: 0.35 }}>
                    {formatDate(userData.last_saved_at)}
                  </p>
                )}
              </div>
              <span style={{ color: "#2D5A3D", fontSize: "20px", opacity: 0.5, flexShrink: 0 }}>→</span>
            </div>
          )}


          {/* ── QUICK ACTION CARDS ────────────────────────────────────────── */}
          <SectionLabel>Quick Actions</SectionLabel>
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap:                 "16px",
            marginBottom:        "28px",
          }}>
            <ActionCard
              emoji="✨"
              title="Generate CV"
              description="Paste a job description and get a tailored, ATS-optimised CV instantly."
              onClick={() => navigate("/generate")}
            />
            <ActionCard
              emoji="🗂️"
              title="CV Cabinet"
              description="View and re-download all your saved CV versions."
              badge={userData.cv_count}
              onClick={() => navigate("/cabinet")}
            />
            <ActionCard
              emoji="🔍"
              title="Job Search"
              description="Search live jobs across Adzuna, TheMuse, RemoteOK and more."
              onClick={() => navigate("/jobs")}
            />
            <ActionCard
              emoji="📋"
              title="App Tracker"
              description="Track applications from Wishlist to Offer on your Kanban board."
              badge={userData.tracker_total > 0 ? userData.tracker_total : null}
              onClick={() => navigate("/tracker")}
            />
          </div>


        </div>
      )}

    </DashboardLayout>
  );
}




