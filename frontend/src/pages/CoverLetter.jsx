import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

// ─────────────────────────────────────────────
// STYLES — matches app colour scheme
// ─────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#F4EFE6",
    color: "#1E2018",
    fontFamily: "'Libre Baskerville', Georgia, serif",
    paddingTop: "110px",
    paddingBottom: "60px",
  },
  inner: {
    maxWidth: "860px",
    margin: "0 auto",
    padding: "0 32px",
  },
  pageHeader: { marginBottom: "32px" },
  pageTitle: {
    fontSize: "clamp(20px, 4vw, 32px)",
    fontWeight: 900,
    color: "#2D5A3D",
    fontFamily: "'Libre Baskerville', Georgia, serif",
    letterSpacing: "2px",
    marginBottom: "6px",
  },
  pageSubtitle: { color: "#1E2018", fontSize: "13px", opacity: 0.5 },
  tabRow: {
    display: "flex", gap: "4px", marginBottom: "28px",
    borderBottom: "2px solid #DDD5C4", paddingBottom: "0",
  },
  tab: (active) => ({
    padding: "10px 24px",
    background: active ? "#2D5A3D" : "transparent",
    color: active ? "#FDFAF5" : "#6B6252",
    border: "none", borderRadius: "8px 8px 0 0",
    cursor: "pointer", fontWeight: 700, fontSize: "13px",
    fontFamily: "inherit", transition: "all 0.15s", marginBottom: "-2px",
    borderBottom: active ? "2px solid #2D5A3D" : "2px solid transparent",
  }),
  tabBadge: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "#E8F0EB", color: "#2D5A3D", borderRadius: "10px",
    fontSize: "11px", padding: "1px 7px", marginLeft: "6px", fontWeight: 700,
  },
  primaryBtn: (disabled) => ({
    padding: "13px 28px",
    background: disabled ? "#C8BCA8" : "#2D5A3D",
    color: "#FDFAF5", border: "none", borderRadius: "8px",
    cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700,
    fontSize: "14px", fontFamily: "inherit", transition: "all 0.15s",
    whiteSpace: "nowrap", flexShrink: 0, opacity: disabled ? 0.55 : 1,
  }),
  secondaryBtn: (disabled) => ({
    padding: "10px 20px", background: "transparent",
    color: disabled ? "#C8BCA8" : "#2D5A3D",
    border: `1px solid ${disabled ? "#C8BCA8" : "#2D5A3D"}`,
    borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700, fontSize: "13px", fontFamily: "inherit",
    transition: "all 0.15s", whiteSpace: "nowrap",
  }),
  dangerBtn: {
    padding: "8px 18px", background: "transparent", color: "#8B2020",
    border: "1px solid rgba(139,32,32,0.35)", borderRadius: "8px",
    cursor: "pointer", fontWeight: 700, fontSize: "13px", fontFamily: "inherit",
  },
  successBtn: {
    padding: "8px 18px", background: "rgba(45,90,61,0.12)", color: "#2D5A3D",
    border: "1px solid #2D5A3D", borderRadius: "8px", cursor: "pointer",
    fontWeight: 700, fontSize: "13px", fontFamily: "inherit",
  },
  jobGrid: { display: "flex", flexDirection: "column", gap: "10px" },
  jobCard: (selected) => ({
    background: "rgba(220,210,192,0.5)",
    border: selected ? "1px solid rgba(45,90,61,0.5)" : "1px solid rgba(45,90,61,0.15)",
    borderLeft: selected ? "4px solid #2D5A3D" : "4px solid rgba(45,90,61,0.2)",
    borderRadius: "12px", padding: "20px 24px", transition: "all 0.15s",
    cursor: "pointer", boxShadow: selected ? "0 0 0 3px #E8F0EB" : "none",
  }),
  jobCardTop: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", gap: "16px", flexWrap: "wrap",
  },
  jobLeft: { flex: 1, minWidth: "200px" },
  jobTitle: {
    fontSize: "14px", fontWeight: 700, color: "#1E2018", marginBottom: "3px",
    fontFamily: "'Libre Baskerville', serif",
  },
  jobCompany: {
    fontSize: "13px", color: "#2D5A3D", fontWeight: 700, marginBottom: "8px",
    fontFamily: "'Libre Baskerville', serif",
  },
  jobMeta: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" },
  metaTag: (color) => ({
    padding: "2px 9px", background: "#E8F0EB",
    border: `1px solid ${color || "#C8BCA8"}`,
    borderRadius: "20px", fontSize: "11px", color: color || "#6B6252",
    fontFamily: "'Libre Baskerville', serif",
  }),
  scoreRing: (score) => {
    const color = score >= 70 ? "#2D5A3D" : score >= 50 ? "#B8860B" : "#8B2020";
    return {
      width: "58px", height: "58px", borderRadius: "50%",
      border: `3px solid ${color}`, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
      background: "#FDFAF5",
    };
  },
  scoreNumber: (score) => ({
    fontSize: "13px", fontWeight: 900,
    color: score >= 70 ? "#2D5A3D" : score >= 50 ? "#B8860B" : "#8B2020",
    lineHeight: 1, fontFamily: "'Libre Baskerville', serif",
  }),
  scoreLabel: { fontSize: "7px", color: "#6B6252", marginTop: "2px", letterSpacing: "0.5px" },
  jobDesc: {
    marginTop: "14px", padding: "14px 16px", background: "#EDE8DE",
    borderRadius: "8px", fontSize: "12px", lineHeight: "1.7", color: "#6B6252",
    whiteSpace: "pre-wrap",
    border: "1px solid #DDD5C4", fontFamily: "'Libre Baskerville', serif",
  },
  jobCardActions: { display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" },
  statusBadge: (status) => {
    const map = {
      ranked:    { bg: "#E8F0EB",               color: "#6B6252"  },
      generated: { bg: "rgba(45,90,61,0.12)",   color: "#2D5A3D"  },
      verified:  { bg: "rgba(184,134,11,0.12)", color: "#B8860B"  },
      applied:   { bg: "rgba(45,90,61,0.08)",   color: "#3D7A55"  },
    };
    const s = map[status] || map.ranked;
    return {
      padding: "2px 10px", background: s.bg, color: s.color,
      borderRadius: "20px", fontSize: "9px", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.8px",
      fontFamily: "'Libre Baskerville', serif",
    };
  },
  checkbox: { width: "15px", height: "15px", accentColor: "#2D5A3D", cursor: "pointer", flexShrink: 0, marginTop: "3px" },
  batchBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px", background: "#E8F0EB",
    border: "1px solid rgba(45,90,61,0.25)", borderRadius: "10px",
    marginBottom: "16px", flexWrap: "wrap", gap: "10px",
  },
  batchBarText: { color: "#2D5A3D", fontWeight: 700, fontSize: "13px", fontFamily: "'Libre Baskerville', serif" },
  queueCard: {
    background: "#FDFAF5", border: "1px solid #DDD5C4",
    borderRadius: "12px", padding: "18px 22px", marginBottom: "10px",
  },
  queueCardTitle: { fontSize: "14px", fontWeight: 700, color: "#1E2018", marginBottom: "3px", fontFamily: "'Libre Baskerville', serif" },
  queueCardSub:   { fontSize: "12px", color: "#6B6252", marginBottom: "12px", fontFamily: "'Libre Baskerville', serif" },
  queueActions:   { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" },
  applyNowBtn: {
    padding: "10px 22px", background: "#2D5A3D", color: "#FDFAF5",
    border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700,
    fontSize: "13px", fontFamily: "inherit", textDecoration: "none",
    display: "inline-flex", alignItems: "center", gap: "6px",
  },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#6B6252" },
  emptyIcon:  { fontSize: "3rem", marginBottom: "12px" },
  loadingRow: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: "12px", padding: "40px", color: "#6B6252",
    fontFamily: "'Libre Baskerville', serif", fontSize: "13px",
  },
  spinner: {
    width: "20px", height: "20px",
    border: "2px solid #DDD5C4", borderTop: "2px solid #2D5A3D",
    borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
  },
  progressBar: (pct) => ({
    height: "3px", background: "#DDD5C4", borderRadius: "2px",
    overflow: "hidden", marginTop: "8px", display: pct > 0 ? "block" : "none",
  }),
  progressFill: (pct) => ({
    height: "100%", width: `${pct}%`, background: "#2D5A3D",
    borderRadius: "2px", transition: "width 0.4s ease",
  }),
};

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export default function SmartJobsPage() {
  const [activeTab, setActiveTab] = useState("search"); // search | queue
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState({});
  const [jobs, setJobs] = useState([]);
  const [queueData, setQueueData] = useState({ ranked: [], generated: [], verified: [], applied: [] });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Load queue + profile from API on mount ──
  useEffect(() => {
    loadQueue();
    api.get("/profile")
      .then(res => { if (res.data && Object.keys(res.data).length > 0) setProfile(res.data); })
      .catch(() => {});
    const style = document.createElement("style");
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }, []);

  const loadQueue = async () => {
    try {
      const res = await api.get("/smart-jobs/queue");
      setQueueData(res.data);
    } catch (e) {
      console.error("Queue load error:", e);
    }
  };

  // ── SEARCH ──
  const handleSearch = async () => {
    if (searching) return;
    setError("");
    setSuccessMsg("");
    setSearching(true);
    setJobs([]);
    setSelectedIds(new Set());

    const currentProfile = profile;

    try {
      const res = await api.post("/smart-jobs/search", {
        profile: currentProfile,
        query: query.trim(),
        page,
      });
      setJobs(res.data.jobs || []);
      if ((res.data.jobs || []).length === 0) {
        setError("No jobs found. Try a different search term, or make sure your JSEARCH_API_KEY is set.");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Search failed. Check your API key.");
    } finally {
      setSearching(false);
    }
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    setSearching(true);
    try {
      const res = await api.post("/smart-jobs/search", {
        profile: profile,
        query: query.trim(),
        page: nextPage,
      });
      const newJobs = res.data.jobs || [];
      // Merge + re-sort by score
      setJobs(prev => {
        const combined = [...prev, ...newJobs];
        return combined.sort((a, b) => b.match_score - a.match_score);
      });
    } catch (e) {
      setError("Failed to load more jobs.");
    } finally {
      setSearching(false);
    }
  };

  // ── SELECT JOBS ──
  const toggleSelect = (e, jobId) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(jobs.map(j => j.job_id)));
  };

  const selectNone = () => setSelectedIds(new Set());

  // ── GENERATE BATCH ZIP ──
  const handleGenerateBatch = async () => {
    if (generating || selectedIds.size === 0) return;
    setError("");
    setSuccessMsg("");
    setGenerating(true);
    setGenerateProgress(5);

    // Cap at 5 — each job = 2 AI calls (~15-30s), so 5 jobs ≈ 2 mins max
    const selectedJobs = jobs.filter(j => selectedIds.has(j.job_id)).slice(0, 5);
    const jobCount = selectedJobs.length;

    // Spread progress across expected duration so it doesn't hit 88% too fast
    const tickInterval = Math.max(1500, (jobCount * 20000) / 25);
    const ticker = setInterval(() => {
      setGenerateProgress(p => Math.min(p + 3, 88));
    }, tickInterval);

    try {
      const res = await api.post("/smart-jobs/generate-batch", {
        profile: profile,
        jobs: selectedJobs,
      }, {
        responseType: "blob",
        timeout: jobCount * 3 * 60 * 1000, // 3 mins per job
      });

      clearInterval(ticker);
      setGenerateProgress(100);

      // Trigger download
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "FrontendJobs_Applications.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMsg(`✓ ZIP downloaded — ${jobCount} tailored CV + Cover Letter files ready. Verify each on Overleaf, then mark as Verified in your Apply Queue.`);

      setJobs(prev => prev.map(j =>
        selectedIds.has(j.job_id) ? { ...j, status: "generated" } : j
      ));

      await loadQueue();
    } catch (e) {
      clearInterval(ticker);
      // axios blob responses wrap errors as blobs — read the real message
      let errMsg = "Generation failed. Check the server terminal for the exact error.";
      if (e.code === "ECONNABORTED" || e.message?.includes("timeout")) {
        errMsg = "Request timed out. Try selecting just 1–2 jobs and try again.";
      } else if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.message) errMsg = `Server error: ${parsed.message}`;
        } catch { /* use default */ }
      } else if (e.response?.data?.message) {
        errMsg = `Server error: ${e.response.data.message}`;
      }
      setError(errMsg);
    } finally {
      setGenerating(false);
      setTimeout(() => setGenerateProgress(0), 3000);
    }
  };

  // ── UPDATE STATUS ──
  const updateStatus = async (jobId, status) => {
    try {
      await api.patch("/smart-jobs/status", { job_id: jobId, status });
      await loadQueue();
      setSuccessMsg(`Status updated to "${status}"`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e) {
      setError("Failed to update status.");
    }
  };

  // ── COPY COVER LETTER HINT ──
  const handleApply = (job) => {
    // Mark as applied
    updateStatus(job.job_id, "applied");
    // Open apply URL
    window.open(job.apply_url, "_blank", "noopener,noreferrer");
  };

  // ─────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────

  const renderJobCard = (job, showCheckbox = true) => {
    const isSelected = selectedIds.has(job.job_id);
    const isExpanded = expandedId === job.job_id;

    return (
      <div
        key={job.job_id}
        style={S.jobCard(isSelected)}
        onClick={() => setExpandedId(isExpanded ? null : job.job_id)}
      >
        <div style={S.jobCardTop}>
          {/* Checkbox */}
          {showCheckbox && (
            <input
              type="checkbox"
              style={S.checkbox}
              checked={isSelected}
              onChange={(e) => toggleSelect(e, job.job_id)}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {/* Job Info */}
          <div style={S.jobLeft}>
            <div style={S.jobTitle}>{job.title}</div>
            <div style={S.jobCompany}>{job.company}</div>
            <div style={S.jobMeta}>
              {job.location && (
                <span style={S.metaTag("#6B6252")}>📍 {job.location}</span>
              )}
              {job.work_type && (
                <span style={S.metaTag(job.work_type === "Remote" ? "#2D5A3D" : "#6B6252")}>
                  {job.work_type === "Remote" ? "🏠" : "🏢"} {job.work_type}
                </span>
              )}
              {job.employment_type && (
                <span style={S.metaTag("#6B6252")}>{job.employment_type}</span>
              )}
              <span style={S.metaTag(job.salary !== "Not disclosed" ? "#B8860B" : "#6B6252")}>
                💰 {job.salary}
              </span>
            </div>
            <span style={S.statusBadge(job.status)}>{job.status}</span>
          </div>

          {/* Match Score */}
          <div style={S.scoreRing(job.match_score)}>
            <span style={S.scoreNumber(job.match_score)}>
              {Math.round(job.match_score)}
            </span>
            <span style={S.scoreLabel}>MATCH</span>
          </div>
        </div>

        {/* Expanded Description */}
        {isExpanded && (
          <>
            <div style={S.jobDesc}>
              {job.description || "No description available."}
            </div>
            <div style={S.jobCardActions}>
              {job.status === "verified" && (
                <button
                  style={S.applyNowBtn}
                  onClick={(e) => { e.stopPropagation(); handleApply(job); }}
                >
                  ✈ Apply Now
                </button>
              )}
              {job.status === "generated" && (
                <button
                  style={S.successBtn}
                  onClick={(e) => { e.stopPropagation(); updateStatus(job.job_id, "verified"); }}
                >
                  ✓ Mark Verified
                </button>
              )}
              {job.status === "applied" && (
                <span style={{ color: "#3D7A55", fontSize: "0.85rem", fontWeight: 700 }}>
                  ✈ Applied
                </span>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const totalQueue = queueData.verified?.length + queueData.generated?.length;

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <DashboardLayout>
    <div style={S.page}>
      <div style={S.inner}>

        {/* Header */}
        <div style={S.pageHeader}>
          <div style={S.pageTitle}>⚡ Smart Job Hunt</div>
          <div style={S.pageSubtitle}>
            AI matches jobs to your profile · Auto-generates tailored CV + Cover Letter · Guided apply queue
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabRow}>
          <button style={S.tab(activeTab === "search")} onClick={() => setActiveTab("search")}>
            🔍 Search & Rank
          </button>
          <button style={S.tab(activeTab === "queue")} onClick={() => { setActiveTab("queue"); loadQueue(); }}>
            ✈ Apply Queue
            {totalQueue > 0 && <span style={S.tabBadge}>{totalQueue}</span>}
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ padding: "12px 18px", background: "#FBF0F0", border: "1px solid rgba(139,32,32,0.25)", borderRadius: "8px", color: "#8B2020", marginBottom: "16px", fontSize: "0.88rem" }}>
            ⚠ {error}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: "12px 18px", background: "#E8F0EB", border: "1px solid rgba(45,90,61,0.3)", borderRadius: "8px", color: "#2D5A3D", marginBottom: "16px", fontSize: "0.88rem" }}>
            {successMsg}
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* TAB: SEARCH */}
        {/* ═══════════════════════════════════ */}
        {activeTab === "search" && (
          <>
            {/* Search panel — matches Jobs page */}
            <div style={{ background: "rgba(220,210,192,0.8)", border: "1px solid rgba(45,90,61,0.2)", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                <input
                  type="text"
                  placeholder='Job title, keywords, or company...'
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  style={{ flex: 1, minWidth: "220px", padding: "13px 16px", background: "#FFFFFF", border: "1px solid rgba(45,90,61,0.25)", borderRadius: "10px", color: "#1E2018", fontSize: "14px", fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
                />
                <button className="primary-btn" onClick={handleSearch} disabled={searching} style={{ padding: "13px 28px", fontSize: "14px", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {searching ? "Searching..." : "Search Jobs"}
                </button>
              </div>
              <p style={{ color: "#1E2018", fontSize: "12px", opacity: 0.5, fontFamily: "'Libre Baskerville', serif", lineHeight: 1.5 }}>
                Jobs ranked against your profile using AI · Select up to 5 per batch → <strong>Generate ZIP</strong> → compile on{" "}
                <a href="https://overleaf.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2D5A3D" }}>Overleaf</a>
                {" "}→ mark Verified → apply from the Apply Queue
              </p>
            </div>

            {/* Batch actions bar */}
            {jobs.length > 0 && (
              <div style={S.batchBar}>
                <div style={S.batchBarText}>
                  {selectedIds.size} of {jobs.length} jobs selected
                  {selectedIds.size > 0 && ` · ${Math.min(selectedIds.size, 5)} will be generated (5 per batch)`}
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <button style={S.secondaryBtn(false)} onClick={selectAll}>Select All</button>
                  <button style={S.secondaryBtn(selectedIds.size === 0)} onClick={selectNone} disabled={selectedIds.size === 0}>Clear</button>
                  <button
                    style={S.primaryBtn(generating || selectedIds.size === 0)}
                    onClick={handleGenerateBatch}
                    disabled={generating || selectedIds.size === 0}
                  >
                    {generating ? `Generating... ${generateProgress}%` : `⬇ Generate ZIP (${Math.min(selectedIds.size, 5)} jobs)`}
                  </button>
                </div>
              </div>
            )}

            {/* Progress bar */}
            {generating && (
              <div style={S.progressBar(generateProgress)}>
                <div style={S.progressFill(generateProgress)} />
              </div>
            )}

            {/* Loading */}
            {searching && (
              <div style={S.loadingRow}>
                <div style={S.spinner} />
                <span>Fetching and ranking jobs against your profile...</span>
              </div>
            )}

            {/* Job list */}
            {!searching && jobs.length > 0 && (
              <div style={S.jobGrid}>
                {jobs.map(job => renderJobCard(job, true))}
              </div>
            )}

            {/* Load more */}
            {!searching && jobs.length > 0 && (
              <div style={{ textAlign: "center", marginTop: "24px" }}>
                <button style={S.secondaryBtn(searching)} onClick={handleLoadMore} disabled={searching}>
                  Load 20 More Jobs
                </button>
              </div>
            )}

            {/* Empty */}
            {!searching && jobs.length === 0 && !error && (
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>🎯</div>
                <div style={{ fontWeight: 700, marginBottom: "8px" }}>Ready to find your next role</div>
                <div style={{ fontSize: "0.85rem" }}>Search above or leave blank to auto-build a query from your profile</div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════ */}
        {/* TAB: APPLY QUEUE */}
        {/* ═══════════════════════════════════ */}
        {activeTab === "queue" && (
          <>
            {/* ── VERIFIED → READY TO APPLY ── */}
            {queueData.verified?.length > 0 && (
              <>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#B8860B", marginBottom: "12px" }}>
                  ✅ Verified — Ready to Apply ({queueData.verified.length})
                </div>
                <div style={{ padding: "14px 18px", background: "#EDE8DE", border: "1px solid #DDD5C4", borderRadius: "8px", fontSize: "0.83rem", color: "#6B6252", lineHeight: "1.5", marginBottom: "20px" }}>
                  These CVs have been verified on Overleaf. Click <strong>Apply Now</strong> to open the application page.
                  Your cover letter will be in the .tex file you compiled.
                </div>
                {queueData.verified.map(job => (
                  <div key={job.job_id} style={S.queueCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div>
                        <div style={S.queueCardTitle}>{job.title}</div>
                        <div style={S.queueCardSub}>
                          {job.company} · {job.location} · {job.work_type} · 💰 {job.salary}
                        </div>
                        <div style={S.queueActions}>
                          <a
                            href={job.apply_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={S.applyNowBtn}
                            onClick={() => updateStatus(job.job_id, "applied")}
                          >
                            ✈ Apply Now
                          </a>
                          <button style={S.dangerBtn} onClick={() => updateStatus(job.job_id, "ranked")}>
                            Skip
                          </button>
                        </div>
                      </div>
                      <div style={S.scoreRing(job.match_score)}>
                        <span style={S.scoreNumber(job.match_score)}>{Math.round(job.match_score)}</span>
                        <span style={S.scoreLabel}>MATCH</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ── GENERATED → NEEDS OVERLEAF VERIFY ── */}
            {queueData.generated?.length > 0 && (
              <>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#2D5A3D", marginBottom: "12px", marginTop: "28px" }}>
                  📄 Generated — Awaiting Overleaf Verification ({queueData.generated.length})
                </div>
                <div style={{ padding: "14px 18px", background: "#EDE8DE", border: "1px solid #DDD5C4", borderRadius: "8px", fontSize: "0.83rem", color: "#6B6252", lineHeight: "1.5", marginBottom: "20px" }}>
                  Download already done. Open each .tex file in Overleaf, fix any compile errors, then come back and click <strong>Mark Verified</strong>.
                </div>
                {queueData.generated.map(job => (
                  <div key={job.job_id} style={S.queueCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div>
                        <div style={S.queueCardTitle}>{job.title}</div>
                        <div style={S.queueCardSub}>{job.company} · {job.location} · 💰 {job.salary}</div>
                        <div style={S.queueActions}>
                          <button style={S.successBtn} onClick={() => updateStatus(job.job_id, "verified")}>
                            ✓ Mark Verified
                          </button>
                          <a
                            href="https://overleaf.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...S.secondaryBtn(false), textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                          >
                            Open Overleaf ↗
                          </a>
                          <button style={S.dangerBtn} onClick={() => updateStatus(job.job_id, "ranked")}>
                            Reset
                          </button>
                        </div>
                      </div>
                      <div style={S.scoreRing(job.match_score)}>
                        <span style={S.scoreNumber(job.match_score)}>{Math.round(job.match_score)}</span>
                        <span style={S.scoreLabel}>MATCH</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ── APPLIED ── */}
            {queueData.applied?.length > 0 && (
              <>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#3D7A55", marginBottom: "12px", marginTop: "28px" }}>
                  ✈ Applied ({queueData.applied.length})
                </div>
                {queueData.applied.map(job => (
                  <div key={job.job_id} style={{ ...S.queueCard, opacity: 0.7 }}>
                    <div style={S.queueCardTitle}>{job.title}</div>
                    <div style={S.queueCardSub}>{job.company} · {job.location}</div>
                    <span style={S.statusBadge("applied")}>Applied ✓</span>
                  </div>
                ))}
              </>
            )}

            {/* Empty state */}
            {!queueData.verified?.length && !queueData.generated?.length && !queueData.applied?.length && (
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>📋</div>
                <div style={{ fontWeight: 700, marginBottom: "8px" }}>Your apply queue is empty</div>
                <div style={{ fontSize: "0.85rem" }}>
                  Search for jobs, select your top picks, generate the ZIP, then come back here after verifying on Overleaf.
                </div>
                <button
                  style={{ ...S.primaryBtn(false), marginTop: "20px" }}
                  onClick={() => setActiveTab("search")}
                >
                  Go to Search →
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
    </DashboardLayout>
  );
}