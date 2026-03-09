
// =============================================================================
// FILE: frontend/src/pages/Jobs.jsx
// =============================================================================
// Phase 5.2 — Job Search Page
//
// LAYOUT: Mixed — top featured card (first result) + list below
// FILTERS: Keywords, Location, Remote/On-site/Hybrid, Salary range, Date posted
//
// DATA FLOW:
//   User types query + filters → hits Search → GET /api/jobs/search?q=...
//   → Flask queries JSearch, Adzuna, TheMuse, RemoteOK in parallel
//   → Returns unified job list → rendered as featured card + list
//   → Click any job → detail modal opens with full description +
//     "Generate CV for This Job" button that navigates to /generate
//     with the job description pre-filled
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";


// =============================================================================
// CONSTANTS
// =============================================================================

const EMPLOYMENT_TYPES = [
  { value: "all",       label: "All Types" },
  { value: "fulltime",  label: "Full-time" },
  { value: "parttime",  label: "Part-time" },
  { value: "remote",    label: "Remote" },
  { value: "contractor",label: "Contract" },
  { value: "intern",    label: "Internship" },
];

const DATE_OPTIONS = [
  { value: "all",    label: "Any time" },
  { value: "today",  label: "Today" },
  { value: "3days",  label: "Last 3 days" },
  { value: "week",   label: "This week" },
  { value: "month",  label: "This month" },
];

const SOURCE_COLORS = {
  JSearch:   "#00F5D4",
  Adzuna:    "#FFB347",
  TheMuse:   "#A78BFA",
  RemoteOK:  "#4ADE80",
};

const TYPE_COLORS = {
  Remote:     "#4ADE80",
  Hybrid:     "#60A5FA",
  "On-site":  "#FFB347",
  Unknown:    "rgba(224,255,255,0.3)",
};


// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// ── SOURCE BADGE ──────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  return (
    <span style={{
      fontSize:        "10px",
      fontFamily:      "'Bodoni MT Black', serif",
      fontWeight:      900,
      letterSpacing:   "1px",
      textTransform:   "uppercase",
      color:           SOURCE_COLORS[source] || "#E0FFFF",
      background:      `${SOURCE_COLORS[source]}18` ?? "rgba(224,255,255,0.08)",
      border:          `1px solid ${SOURCE_COLORS[source]}40` ?? "1px solid rgba(224,255,255,0.15)",
      borderRadius:    "4px",
      padding:         "2px 7px",
    }}>
      {source}
    </span>
  );
}

// ── TYPE BADGE ────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  if (!type || type === "Unknown") return null;
  return (
    <span style={{
      fontSize:      "10px",
      fontFamily:    "'Bodoni MT Black', serif",
      fontWeight:    900,
      letterSpacing: "0.5px",
      color:         TYPE_COLORS[type] || "#E0FFFF",
      background:    `${TYPE_COLORS[type]}18`,
      border:        `1px solid ${TYPE_COLORS[type]}40`,
      borderRadius:  "4px",
      padding:       "2px 7px",
    }}>
      {type}
    </span>
  );
}

// ── FILTER SELECT ─────────────────────────────────────────────────────────────
function FilterSelect({ value, onChange, options, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "130px" }}>
      <label style={{
        color:       "#E0FFFF",
        fontSize:    "10px",
        opacity:     0.5,
        letterSpacing: "1px",
        textTransform: "uppercase",
        fontFamily:  "'Bodoni MT Black', serif",
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background:   "#0B1E2A",
          border:       "1px solid rgba(0,245,212,0.2)",
          borderRadius: "8px",
          color:        "#E0FFFF",
          padding:      "10px 12px",
          fontSize:     "13px",
          fontFamily:   "system-ui, sans-serif",
          cursor:       "pointer",
          outline:      "none",
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── FEATURED JOB CARD (first result) ─────────────────────────────────────────
function FeaturedCard({ job, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onClick(job)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    hovered ? "rgba(0,245,212,0.06)" : "rgba(0,59,68,0.8)",
        border:        hovered ? "1px solid rgba(0,245,212,0.5)" : "1px solid rgba(0,245,212,0.25)",
        borderRadius:  "16px",
        padding:       "32px",
        marginBottom:  "24px",
        cursor:        "pointer",
        transition:    "all 0.2s ease",
        position:      "relative",
        overflow:      "hidden",
      }}
    >
      {/* Featured label */}
      <div style={{
        position:      "absolute",
        top:           "20px",
        right:         "20px",
        background:    "rgba(0,245,212,0.12)",
        border:        "1px solid rgba(0,245,212,0.3)",
        borderRadius:  "6px",
        padding:       "4px 10px",
        fontSize:      "10px",
        fontFamily:    "'Bodoni MT Black', serif",
        fontWeight:    900,
        letterSpacing: "2px",
        color:         "#00F5D4",
      }}>
        TOP MATCH
      </div>

      {/* Header row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "16px", marginBottom: "16px" }}>
        {/* Company initial avatar */}
        <div style={{
          width:        "52px",
          height:       "52px",
          background:   "rgba(0,245,212,0.1)",
          border:       "1px solid rgba(0,245,212,0.2)",
          borderRadius: "12px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          fontSize:     "20px",
          fontFamily:   "'Train One', cursive",
          color:        "#00F5D4",
          flexShrink:   0,
        }}>
          {job.company?.[0]?.toUpperCase() || "?"}
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{
            color:       "#E0FFFF",
            fontFamily:  "'Bodoni MT Black', serif",
            fontWeight:  900,
            fontSize:    "20px",
            marginBottom: "4px",
            lineHeight:  1.2,
          }}>
            {job.title}
          </h2>
          <p style={{
            color:      "#00F5D4",
            fontSize:   "14px",
            fontFamily: "'Bodoni MT Black', serif",
            fontWeight: 900,
          }}>
            {job.company}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
        {job.location && (
          <span style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.6 }}>
            📍 {job.location}
          </span>
        )}
        {job.salary && (
          <span style={{ color: "#FFB347", fontSize: "13px", fontFamily: "'Bodoni MT Black', serif" }}>
            💰 {job.salary}
          </span>
        )}
        {job.posted && (
          <span style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.45 }}>
            🕐 {job.posted}
          </span>
        )}
        <TypeBadge type={job.type} />
        <SourceBadge source={job.source} />
      </div>

      {/* Description preview */}
      <p style={{
        color:      "#E0FFFF",
        fontSize:   "13px",
        opacity:    0.6,
        lineHeight: 1.6,
        fontFamily: "system-ui, sans-serif",
        display:    "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow:   "hidden",
      }}>
        {job.description || "Click to view full job description."}
      </p>

      {/* CTA */}
      <div style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <span style={{
          color:       "#00F5D4",
          fontSize:    "13px",
          fontFamily:  "'Bodoni MT Black', serif",
          fontWeight:  900,
          opacity:     hovered ? 1 : 0.6,
          transition:  "opacity 0.2s",
        }}>
          View details →
        </span>
      </div>
    </div>
  );
}

// ── JOB LIST ROW ──────────────────────────────────────────────────────────────
function JobRow({ job, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onClick(job)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    hovered ? "rgba(0,245,212,0.04)" : "rgba(0,59,68,0.5)",
        border:        hovered ? "1px solid rgba(0,245,212,0.3)" : "1px solid rgba(0,245,212,0.1)",
        borderRadius:  "12px",
        padding:       "20px 24px",
        marginBottom:  "10px",
        cursor:        "pointer",
        transition:    "all 0.15s ease",
        display:       "flex",
        alignItems:    "center",
        gap:           "16px",
      }}
    >
      {/* Company avatar */}
      <div style={{
        width:          "40px",
        height:         "40px",
        background:     "rgba(0,245,212,0.08)",
        border:         "1px solid rgba(0,245,212,0.15)",
        borderRadius:   "10px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontSize:       "16px",
        fontFamily:     "'Train One', cursive",
        color:          "#00F5D4",
        flexShrink:     0,
      }}>
        {job.company?.[0]?.toUpperCase() || "?"}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
          <span style={{
            color:      "#E0FFFF",
            fontFamily: "'Bodoni MT Black', serif",
            fontWeight: 900,
            fontSize:   "14px",
          }}>
            {job.title}
          </span>
          <TypeBadge type={job.type} />
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#00F5D4", fontSize: "13px", fontFamily: "'Bodoni MT Black', serif" }}>
            {job.company}
          </span>
          {job.location && (
            <span style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.5 }}>
              {job.location}
            </span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
        {job.salary && (
          <span style={{ color: "#FFB347", fontSize: "12px", fontFamily: "'Bodoni MT Black', serif" }}>
            {job.salary}
          </span>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {job.posted && (
            <span style={{ color: "#E0FFFF", fontSize: "11px", opacity: 0.4 }}>
              {job.posted}
            </span>
          )}
          <SourceBadge source={job.source} />
        </div>
      </div>
    </div>
  );
}

// ── JOB DETAIL MODAL ──────────────────────────────────────────────────────────
function JobModal({ job, onClose, onGenerateCV }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!job) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   "fixed",
          top: 0, left: 0,
          width:      "100vw",
          height:     "100vh",
          background: "rgba(0,0,0,0.75)",
          zIndex:     2000,
        }}
      />

      {/* Modal */}
      <div style={{
        position:     "fixed",
        top:          "50%",
        left:         "50%",
        transform:    "translate(-50%, -50%)",
        width:        "min(680px, 92vw)",
        maxHeight:    "85vh",
        background:   "#003B44",
        border:       "1px solid rgba(0,245,212,0.3)",
        borderRadius: "16px",
        zIndex:       2001,
        display:      "flex",
        flexDirection: "column",
        overflow:     "hidden",
      }}>

        {/* Modal header */}
        <div style={{
          padding:       "28px 32px 20px",
          borderBottom:  "1px solid rgba(0,245,212,0.1)",
          flexShrink:    0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: "16px" }}>
              <h2 style={{
                color:       "#E0FFFF",
                fontFamily:  "'Bodoni MT Black', serif",
                fontWeight:  900,
                fontSize:    "20px",
                marginBottom: "6px",
                lineHeight:  1.2,
              }}>
                {job.title}
              </h2>
              <p style={{
                color:      "#00F5D4",
                fontSize:   "14px",
                fontFamily: "'Bodoni MT Black', serif",
                fontWeight: 900,
                marginBottom: "10px",
              }}>
                {job.company}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                {job.location && (
                  <span style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.6 }}>
                    📍 {job.location}
                  </span>
                )}
                {job.salary && (
                  <span style={{ color: "#FFB347", fontSize: "12px", fontFamily: "'Bodoni MT Black', serif" }}>
                    💰 {job.salary}
                  </span>
                )}
                {job.posted && (
                  <span style={{ color: "#E0FFFF", fontSize: "12px", opacity: 0.4 }}>
                    🕐 {job.posted}
                  </span>
                )}
                <TypeBadge type={job.type} />
                <SourceBadge source={job.source} />
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background:   "transparent",
                border:       "none",
                color:        "#E0FFFF",
                fontSize:     "20px",
                cursor:       "pointer",
                padding:      "4px",
                opacity:      0.5,
                lineHeight:   1,
                flexShrink:   0,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal body — scrollable */}
        <div style={{
          flex:       1,
          overflowY:  "auto",
          padding:    "24px 32px",
        }}>
          <h3 style={{
            color:       "#00F5D4",
            fontFamily:  "'Bodoni MT Black', serif",
            fontSize:    "11px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: "14px",
            opacity:     0.7,
          }}>
            Job Description
          </h3>
          <p style={{
            color:      "#E0FFFF",
            fontSize:   "13px",
            lineHeight: 1.8,
            fontFamily: "system-ui, sans-serif",
            opacity:    0.8,
            whiteSpace: "pre-wrap",
          }}>
            {job.description || "No description available."}
          </p>
        </div>

        {/* Modal footer — action buttons */}
        <div style={{
          padding:      "20px 32px",
          borderTop:    "1px solid rgba(0,245,212,0.1)",
          display:      "flex",
          gap:          "12px",
          flexShrink:   0,
          flexWrap:     "wrap",
        }}>
          {/* Generate CV for this job — key feature */}
          <button
            className="primary-btn"
            onClick={() => onGenerateCV(job)}
            style={{ flex: 1, fontSize: "14px", padding: "12px 20px" }}
          >
            ✨ Generate CV for This Job
          </button>

          {/* Open original listing */}
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background:   "transparent",
                border:       "1px solid rgba(0,245,212,0.3)",
                borderRadius: "6px",
                color:        "#00F5D4",
                padding:      "12px 20px",
                fontSize:     "14px",
                fontFamily:   "'Bodoni MT Black', serif",
                fontWeight:   900,
                textDecoration: "none",
                cursor:       "pointer",
                whiteSpace:   "nowrap",
              }}
            >
              View Original →
            </a>
          )}
        </div>
      </div>
    </>
  );
}

// ── LOADING SKELETON ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div>
      {/* Featured card skeleton */}
      <div style={{
        background:   "#003B44",
        border:       "1px solid rgba(0,245,212,0.08)",
        borderRadius: "16px",
        padding:      "32px",
        marginBottom: "24px",
        height:       "200px",
        opacity:      0.5,
      }} />
      {/* List row skeletons */}
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          background:   "#003B44",
          border:       "1px solid rgba(0,245,212,0.08)",
          borderRadius: "12px",
          height:       "72px",
          marginBottom: "10px",
          opacity:      0.4 - i * 0.05,
        }} />
      ))}
    </div>
  );
}


// =============================================================================
// MAIN PAGE
// =============================================================================

export default function Jobs() {
  const navigate      = useNavigate();
  const routerLocation = useLocation();

  // ── SEARCH STATE ────────────────────────────────────────────────────────────
  const [query,          setQuery]          = useState("");
  const [location,       setLocation]       = useState("");
  const [employmentType, setEmploymentType] = useState("all");
  const [datePosted,     setDatePosted]     = useState("all");
  const [salaryMin,      setSalaryMin]      = useState("");
  const [salaryMax,      setSalaryMax]      = useState("");
  const [remoteOnly,     setRemoteOnly]     = useState(false);

  // ── RESULTS STATE ───────────────────────────────────────────────────────────
  const [jobs,           setJobs]           = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [searched,       setSearched]       = useState(false);
  const [resultQuery,    setResultQuery]    = useState("");

  // ── MODAL STATE ─────────────────────────────────────────────────────────────
  const [selectedJob,    setSelectedJob]    = useState(null);

  const queryInputRef = useRef(null);


  // ── SEARCH HANDLER ──────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a job title or keywords.");
      return;
    }

    setError("");
    setLoading(true);
    setJobs([]);
    setSearched(false);

    const params = new URLSearchParams();
    params.set("q", query.trim());
    if (location.trim())  params.set("location", location.trim());
    if (employmentType !== "all") params.set("employment_type", employmentType);
    if (datePosted !== "all")     params.set("date_posted", datePosted);
    if (salaryMin)                params.set("salary_min", salaryMin);
    if (salaryMax)                params.set("salary_max", salaryMax);
    if (remoteOnly)               params.set("remote_only", "true");

    try {
      const response = await api.get(`/jobs/search?${params.toString()}`);
      setJobs(response.data.jobs || []);
      setResultQuery(response.data.query || query);
      setSearched(true);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setError("Search failed. Make sure the backend is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // ── GENERATE CV FOR THIS JOB ─────────────────────────────────────────────
  // Navigate to /generate with the job description pre-filled via router state.
  // GenerateCV.jsx needs to read location.state?.jobDescription on mount.
  const handleGenerateCV = (job) => {
    navigate("/generate", {
      state: {
        jobDescription: job.description || "",
        jobTitle:       job.title || "",
        company:        job.company || "",
      }
    });
  };


  // ── RENDER ──────────────────────────────────────────────────────────────────
  const featuredJob  = jobs[0] || null;
  const listJobs     = jobs.slice(1);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(860px, 100%)", margin: "0 auto", paddingBottom: "clamp(40px, 6vw, 80px)" }}>

        {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{
            fontFamily:   "'Train One', cursive",
            fontSize: "clamp(20px, 4vw, 32px)",
            color:        "#00F5D4",
            letterSpacing: "2px",
            marginBottom: "6px",
          }}>
            JOB SEARCH
          </h1>
          <p style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.5 }}>
            Live results from Indeed, LinkedIn, Adzuna, The Muse & RemoteOK
          </p>
        </div>


        {/* ── SEARCH BAR ───────────────────────────────────────────────────── */}
        <div style={{
          background:   "rgba(0,59,68,0.8)",
          border:       "1px solid rgba(0,245,212,0.2)",
          borderRadius: "16px",
          padding:      "24px",
          marginBottom: "24px",
        }}>

          {/* Main search row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div style={{ flex: 2, position: "relative" }}>
              <input
                ref={queryInputRef}
                type="text"
                placeholder="Job title, keywords, or company..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width:        "100%",
                  padding:      "13px 16px",
                  background:   "#0B1E2A",
                  border:       "1px solid rgba(0,245,212,0.25)",
                  borderRadius: "10px",
                  color:        "#E0FFFF",
                  fontSize:     "14px",
                  fontFamily:   "system-ui, sans-serif",
                  outline:      "none",
                  boxSizing:    "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Location (city, country)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width:        "100%",
                  padding:      "13px 16px",
                  background:   "#0B1E2A",
                  border:       "1px solid rgba(0,245,212,0.25)",
                  borderRadius: "10px",
                  color:        "#E0FFFF",
                  fontSize:     "14px",
                  fontFamily:   "system-ui, sans-serif",
                  outline:      "none",
                  boxSizing:    "border-box",
                }}
              />
            </div>
            <button
              className="primary-btn"
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding:    "13px 28px",
                fontSize:   "14px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Filters row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>

            <FilterSelect
              label="Job Type"
              value={employmentType}
              onChange={setEmploymentType}
              options={EMPLOYMENT_TYPES}
            />

            <FilterSelect
              label="Date Posted"
              value={datePosted}
              onChange={setDatePosted}
              options={DATE_OPTIONS}
            />

            {/* Salary min */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "110px" }}>
              <label style={{
                color: "#E0FFFF", fontSize: "10px", opacity: 0.5,
                letterSpacing: "1px", textTransform: "uppercase",
                fontFamily: "'Bodoni MT Black', serif",
              }}>
                Salary Min
              </label>
              <input
                type="number"
                placeholder="e.g. 30000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                style={{
                  background: "#0B1E2A", border: "1px solid rgba(0,245,212,0.2)",
                  borderRadius: "8px", color: "#E0FFFF",
                  padding: "10px 12px", fontSize: "13px",
                  fontFamily: "system-ui, sans-serif", outline: "none",
                  width: "100%", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Salary max */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "110px" }}>
              <label style={{
                color: "#E0FFFF", fontSize: "10px", opacity: 0.5,
                letterSpacing: "1px", textTransform: "uppercase",
                fontFamily: "'Bodoni MT Black', serif",
              }}>
                Salary Max
              </label>
              <input
                type="number"
                placeholder="e.g. 80000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                style={{
                  background: "#0B1E2A", border: "1px solid rgba(0,245,212,0.2)",
                  borderRadius: "8px", color: "#E0FFFF",
                  padding: "10px 12px", fontSize: "13px",
                  fontFamily: "system-ui, sans-serif", outline: "none",
                  width: "100%", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Remote only toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
              <label style={{
                color: "#E0FFFF", fontSize: "10px", opacity: 0.5,
                letterSpacing: "1px", textTransform: "uppercase",
                fontFamily: "'Bodoni MT Black', serif",
              }}>
                Remote Only
              </label>
              <button
                onClick={() => setRemoteOnly(!remoteOnly)}
                style={{
                  padding:      "10px 16px",
                  background:   remoteOnly ? "rgba(74,222,128,0.15)" : "#0B1E2A",
                  border:       remoteOnly ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(0,245,212,0.2)",
                  borderRadius: "8px",
                  color:        remoteOnly ? "#4ADE80" : "#E0FFFF",
                  fontSize:     "13px",
                  fontFamily:   "'Bodoni MT Black', serif",
                  fontWeight:   900,
                  cursor:       "pointer",
                  transition:   "all 0.15s ease",
                }}
              >
                {remoteOnly ? "✓ Remote" : "Remote"}
              </button>
            </div>

          </div>
        </div>


        {/* ── ERROR ────────────────────────────────────────────────────────── */}
        {error && (
          <p style={{ color: "#FF6B6B", fontSize: "14px", marginBottom: "20px" }}>{error}</p>
        )}


        {/* ── LOADING ──────────────────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}


        {/* ── RESULTS ──────────────────────────────────────────────────────── */}
        {!loading && searched && (
          <>
            {/* Results count */}
            <div style={{ marginBottom: "20px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
              <p style={{
                color:      "#E0FFFF",
                fontSize:   "13px",
                opacity:    0.5,
                fontFamily: "system-ui, sans-serif",
              }}>
                {jobs.length === 0
                  ? `No results for "${resultQuery}"`
                  : `${jobs.length} result${jobs.length !== 1 ? "s" : ""} for "${resultQuery}"`
                }
              </p>

              {/* Source breakdown pills */}
              {jobs.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {Object.entries(
                    jobs.reduce((acc, j) => {
                      acc[j.source] = (acc[j.source] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([src, count]) => (
                    <span key={src} style={{
                      fontSize:    "10px",
                      fontFamily:  "'Bodoni MT Black', serif",
                      color:       SOURCE_COLORS[src] || "#E0FFFF",
                      background:  `${SOURCE_COLORS[src]}15`,
                      border:      `1px solid ${SOURCE_COLORS[src]}30`,
                      borderRadius: "4px",
                      padding:     "2px 7px",
                    }}>
                      {src} {count}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* No results empty state */}
            {jobs.length === 0 && (
              <div style={{
                textAlign:    "center",
                padding:      "60px 20px",
                background:   "rgba(0,59,68,0.4)",
                borderRadius: "16px",
                border:       "1px solid rgba(0,245,212,0.1)",
              }}>
                <p style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</p>
                <p style={{
                  color: "#E0FFFF", fontFamily: "'Bodoni MT Black', serif",
                  fontSize: "16px", marginBottom: "8px",
                }}>
                  No jobs found
                </p>
                <p style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.5 }}>
                  Try broader keywords or a different location
                </p>
              </div>
            )}

            {/* Featured card — first result */}
            {featuredJob && (
              <FeaturedCard job={featuredJob} onClick={setSelectedJob} />
            )}

            {/* List — remaining results */}
            {listJobs.length > 0 && (
              <div>
                <p style={{
                  color:       "#E0FFFF",
                  fontSize:    "11px",
                  opacity:     0.35,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  fontFamily:  "'Bodoni MT Black', serif",
                  marginBottom: "12px",
                }}>
                  More Results
                </p>
                {listJobs.map((job) => (
                  <JobRow key={job.id} job={job} onClick={setSelectedJob} />
                ))}
              </div>
            )}
          </>
        )}


        {/* ── EMPTY / INITIAL STATE ─────────────────────────────────────────── */}
        {!loading && !searched && (
          <div style={{
            textAlign:    "center",
            padding:      "60px 20px",
            background:   "rgba(0,59,68,0.3)",
            borderRadius: "16px",
            border:       "1px solid rgba(0,245,212,0.08)",
          }}>
            <p style={{ fontSize: "clamp(22px, 4vw, 40px)", marginBottom: "16px" }}>🌐</p>
            <p style={{
              color:      "#E0FFFF",
              fontFamily: "'Bodoni MT Black', serif",
              fontSize:   "16px",
              marginBottom: "8px",
            }}>
              Search across multiple job boards at once
            </p>
            <p style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.45, maxWidth: "400px", margin: "0 auto" }}>
              Enter a job title above to search Indeed, LinkedIn, Adzuna,
              The Muse and RemoteOK simultaneously
            </p>
          </div>
        )}

      </div>

      {/* ── JOB DETAIL MODAL ───────────────────────────────────────────────── */}
      {selectedJob && (
        <JobModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onGenerateCV={handleGenerateCV}
        />
      )}

    </DashboardLayout>
  );
}

