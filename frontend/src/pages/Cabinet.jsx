
// =============================================================================
// FILE: frontend/src/pages/Cabinet.jsx  (UPDATED — Lesson 3.3: CV Cabinet)
// =============================================================================
// PURPOSE:
//   Displays all saved CV versions for the logged-in user.
//   Each CV card shows the job title, ATS score, date saved, a summary
//   preview, and buttons to re-download or delete the CV.
//
// DATA FLOW:
//   Page mounts → GET /api/cabinet → Flask returns [{id, job_title, ats_score,
//   created_at, ai_result}] → rendered as cards → user can delete or download
//
// FEATURES:
//   ✅ Loads all saved CVs on mount
//   ✅ ATS score badge with colour coding (green/amber/red)
//   ✅ Summary preview (first 200 chars of SUMMARY)
//   ✅ Skill count pill
//   ✅ Date formatted as "15 Mar 2024"
//   ✅ Delete button with confirmation step (prevents accidental deletes)
//   ✅ Re-download button — calls /api/download-cv with stored ai_result
//   ✅ Empty state with link to Generate page
//   ✅ Loading skeleton while fetching
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";


// ── HELPER: format ISO timestamp to "15 Mar 2024" ────────────────────────────
function formatDate(isoString) {
  // isoString = "2024-03-15T14:32:00" (UTC, returned by Flask)
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
  // en-GB gives "15 Mar 2024" — unambiguous, universally readable.
}


// ── HELPER: count total skills from structured or flat format ────────────────
function countSkills(skills) {
  if (!skills || skills.length === 0) return 0;

  // Structured format: [{category, skills_list: [{skill, description}]}]
  if (typeof skills[0] === "object" && skills[0].skills_list) {
    return skills.reduce((total, cat) => total + (cat.skills_list?.length || 0), 0);
  }

  // Flat format: ["Python", "React", ...]
  return skills.length;
}


// ── SCORE COLOUR HELPER ───────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 70) return "#2D5A3D";
  if (score >= 40) return "#FFB347";
  return "#8B2020";
}


export default function Cabinet() {

  // ── STATE ────────────────────────────────────────────────────────────────
  const [cvs, setCvs]         = useState([]);
  // The list of saved CVs returned by GET /api/cabinet.
  // Each item: { id, job_title, ats_score, created_at, ai_result }

  const [loading, setLoading] = useState(true);
  // true while fetching CVs on mount.

  const [error, setError]     = useState("");
  // Shown if the fetch fails.

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // The ID of the CV the user clicked "Delete" on.
  // null = no delete confirmation active.
  // When set: shows "Are you sure?" on that card.
  // Two-step delete prevents accidental deletion.

  const [deletingId, setDeletingId] = useState(null);
  // The ID of a CV currently being deleted (waiting for server response).
  // Used to show a loading state on the delete button.

  const [downloadingId, setDownloadingId] = useState(null);
  // The ID of a CV currently being downloaded.
  // Used to show a spinner on that card's download button.

  const [downloadError, setDownloadError] = useState("");

  const navigate = useNavigate();


  // ── LOAD CVs ON MOUNT ────────────────────────────────────────────────────
  useEffect(() => {
    // Runs once when the page loads.
    // Fetches all saved CVs for the logged-in user.

    const loadCabinet = async () => {
      try {
        const response = await api.get("/cabinet");
        setCvs(response.data);
        // response.data = array of CV objects, sorted newest first by Flask.

      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        } else {
          setError("Failed to load your saved CVs. Please refresh.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadCabinet();
  }, [navigate]);


  // ── DELETE HANDLER ────────────────────────────────────────────────────────
  const handleDelete = async (cvId) => {
    // ──────────────────────────────────────────────────────────────────────
    // TWO-STEP DELETE FLOW:
    //   Step 1: User clicks "Delete" → confirmDeleteId is set to this CV's ID.
    //           The button changes to "Are you sure? Click to confirm".
    //   Step 2: User clicks the confirm button → this function actually deletes.
    //           Any other click (different card, navigate away) cancels step 1.
    //
    // WHY TWO STEPS?
    //   Deleting a saved CV is destructive. A single accidental click would
    //   permanently lose the AI-generated content. The confirmation step
    //   prevents this without needing a modal/popup overlay.
    // ──────────────────────────────────────────────────────────────────────

    setDeletingId(cvId);
    setConfirmDeleteId(null);
    // Clear the confirm state so the button resets while deleting.

    try {
      await api.delete(`/cabinet/${cvId}`);
      // DELETE /api/cabinet/42
      // Flask verifies ownership + deletes the row.

      setCvs(prev => prev.filter(cv => cv.id !== cvId));
      // Optimistic update: remove the card from state immediately.
      // The user sees instant feedback — no need to re-fetch the whole list.

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setError("Delete failed. Please try again.");
      }
    } finally {
      setDeletingId(null);
    }
  };


  // ── DOWNLOAD HANDLER ──────────────────────────────────────────────────────
  const handleDownload = async (cv) => {
    // ──────────────────────────────────────────────────────────────────────
    // PURPOSE:
    //   Re-downloads a previously saved CV as a .docx file.
    //   Uses the ai_result stored in the cabinet entry.
    //   Calls the same /api/download-cv route as GenerateCV.jsx.
    //
    // NOTE: We don't have the profile stored in the cabinet entry.
    //   We send profile: {} and let the backend use whatever is in the template.
    //   In a future lesson we can store the profile snapshot alongside ai_result.
    // ──────────────────────────────────────────────────────────────────────

    setDownloadingId(cv.id);
    setDownloadError("");

    try {
      const response = await api.post(
        "/download-cv",
        {
          ai_result: cv.ai_result,
          // Use the profile snapshot saved at generation time — this ensures
          // personal info (name, email, phone etc) matches what was on the CV.
          profile:   cv.profile_snapshot || {},
        },
        { responseType: "blob" }
      );

      const blob = response.data;
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;

      // Use the saved job title as the filename.
      const safeName = cv.job_title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
      link.download  = `${safeName}_CV.docx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setDownloadError("Download failed. Make sure the backend is running.");
      }
    } finally {
      setDownloadingId(null);
    }
  };


  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>

      <div style={{ maxWidth: "min(1000px, 100%)", margin: "0 auto" }}>

        {/* ── PAGE HEADER ─────────────────────────────── */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{
            fontFamily: "'Libre Baskerville', serif",
            fontSize: "clamp(20px, 4vw, 32px)",
            color: "#2D5A3D",
            letterSpacing: "2px",
            marginBottom: "8px",
          }}>
            CV Cabinet
          </h1>
          <p style={{ color: "#1E2018", opacity: 0.5, fontSize: "13px" }}>
            {cvs.length > 0
              ? `${cvs.length} saved CV${cvs.length === 1 ? "" : "s"} — newest first`
              : "Your generated CVs are saved here automatically."}
          </p>
        </div>


        {/* ── ERROR STATE ─────────────────────────────── */}
        {error && (
          <p style={{ color: "#8B2020", fontSize: "14px", marginBottom: "20px" }}>
            ⚠ {error}
          </p>
        )}

        {downloadError && (
          <p style={{ color: "#8B2020", fontSize: "13px", marginBottom: "16px" }}>
            ⚠ {downloadError}
          </p>
        )}


        {/* ── LOADING SKELETON ────────────────────────── */}
        {loading && (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                background: "#F0EAD8",
                borderRadius: "12px",
                padding: "28px",
                marginBottom: "16px",
                border: "1px solid rgba(45,90,61,0.08)",
              }}>
                {[60, 90, 45].map((width, idx) => (
                  <div key={idx} style={{
                    height: "13px",
                    background: "rgba(45,90,61,0.07)",
                    borderRadius: "6px",
                    marginBottom: "12px",
                    width: `${width}%`,
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${idx * 0.15}s`,
                  }} />
                ))}
              </div>
            ))}
          </div>
        )}


        {/* ── EMPTY STATE ─────────────────────────────── */}
        {!loading && cvs.length === 0 && (
          <div style={{
            background: "#F0EAD8",
            borderRadius: "12px",
            padding: "60px 40px",
            textAlign: "center",
            border: "1px dashed rgba(45,90,61,0.3)",
            marginBottom: "24px",
          }}>
            <div style={{ fontSize: "clamp(24px, 5vw, 48px)", marginBottom: "20px" }}>🗂️</div>
            <h3 style={{
              color: "#2D5A3D",
              fontFamily: "'Libre Baskerville', serif",
              fontSize: "20px",
              marginBottom: "12px",
            }}>
              No CVs saved yet
            </h3>
            <p style={{
              color: "#1E2018", opacity: 0.6, fontSize: "14px",
              maxWidth: "380px", margin: "0 auto 28px auto", lineHeight: "1.7",
            }}>
              Generate a tailored CV for a job and it will be automatically saved here.
            </p>
            <button
              className="primary-btn"
              onClick={() => navigate("/generate")}
              style={{ fontSize: "15px", padding: "12px 28px" }}
            >
              Generate Your First CV
            </button>
          </div>
        )}


        {/* ── CV CARDS LIST ────────────────────────────── */}
        {!loading && cvs.length > 0 && (
          <div>
            {cvs.map((cv) => {

              const skillCount   = countSkills(cv.ai_result?.skills);
              const summaryPreview = (cv.ai_result?.SUMMARY || "").slice(0, 200);
              const isConfirming = confirmDeleteId === cv.id;
              const isDeleting   = deletingId === cv.id;
              const isDownloading = downloadingId === cv.id;

              return (
                <div
                  key={cv.id}
                  style={{
                    background: "#F0EAD8",
                    borderRadius: "12px",
                    padding: "28px",
                    marginBottom: "16px",
                    border: "1px solid rgba(45,90,61,0.1)",
                    transition: "border-color 0.2s ease",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(45,90,61,0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(45,90,61,0.1)"}
                >

                  {/* ── Card Header: title + ATS score ── */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "16px",
                  }}>

                    <div style={{ flex: 1 }}>
                      {/* Job title */}
                      <h3 style={{
                        color: "#1E2018",
                        fontFamily: "'Libre Baskerville', serif",
                        fontSize: "16px",
                        marginBottom: "6px",
                      }}>
                        {cv.job_title}
                      </h3>

                      {/* Date saved */}
                      <p style={{ color: "#1E2018", fontSize: "12px", opacity: 0.4 }}>
                        Saved {formatDate(cv.created_at)}
                      </p>
                    </div>

                    {/* ATS Score badge */}
                    <div style={{
                      background: "#FFFFFF",
                      borderRadius: "10px",
                      padding: "10px 16px",
                      textAlign: "center",
                      minWidth: "80px",
                      flexShrink: 0,
                    }}>
                      <p style={{
                        color: "#1E2018", fontSize: "10px", opacity: 0.4,
                        marginBottom: "4px", fontFamily: "'Libre Baskerville', serif",
                        letterSpacing: "1px", textTransform: "uppercase",
                      }}>
                        ATS
                      </p>
                      <p style={{
                        color: scoreColor(cv.ats_score),
                        fontFamily: "'Libre Baskerville', serif",
                        fontSize: "26px",
                        lineHeight: 1,
                      }}>
                        {cv.ats_score}%
                      </p>
                    </div>

                  </div>


                  {/* ── Summary Preview ──────────────────── */}
                  {summaryPreview && (
                    <p style={{
                      color: "#1E2018",
                      fontSize: "13px",
                      opacity: 0.6,
                      lineHeight: "1.65",
                      marginBottom: "16px",
                    }}>
                      {summaryPreview}{cv.ai_result?.SUMMARY?.length > 200 ? "..." : ""}
                    </p>
                  )}


                  {/* ── Meta pills: skill count ───────────── */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
                    {skillCount > 0 && (
                      <span style={{
                        background: "rgba(45,90,61,0.07)",
                        border: "1px solid rgba(45,90,61,0.2)",
                        color: "#2D5A3D",
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontFamily: "'Libre Baskerville', serif",
                      }}>
                        {skillCount} skills
                      </span>
                    )}
                    {cv.ai_result?.experience?.length > 0 && (
                      <span style={{
                        background: "rgba(45,90,61,0.07)",
                        border: "1px solid rgba(45,90,61,0.2)",
                        color: "#2D5A3D",
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontFamily: "'Libre Baskerville', serif",
                      }}>
                        {cv.ai_result.experience.length} roles
                      </span>
                    )}
                  </div>


                  {/* ── Action buttons ───────────────────── */}
                  <div style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}>

                    {/* Download button */}
                    <button
                      onClick={() => handleDownload(cv)}
                      disabled={isDownloading}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(45,90,61,0.4)",
                        color: "#2D5A3D",
                        padding: "8px 18px",
                        borderRadius: "6px",
                        cursor: isDownloading ? "not-allowed" : "pointer",
                        fontSize: "13px",
                        fontFamily: "'Libre Baskerville', serif",
                        opacity: isDownloading ? 0.6 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "background 0.15s ease, border-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isDownloading) e.currentTarget.style.background = "rgba(45,90,61,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {isDownloading ? (
                        <>
                          <span style={{
                            display: "inline-block", width: "11px", height: "11px",
                            border: "2px solid #2D5A3D", borderTopColor: "transparent",
                            borderRadius: "50%", animation: "spin 0.7s linear infinite",
                          }} />
                          Preparing...
                        </>
                      ) : "⬇ Download .docx"}
                    </button>


                    {/* Delete button — two-step confirmation */}
                    {!isConfirming && !isDeleting && (
                      <button
                        onClick={() => setConfirmDeleteId(cv.id)}
                        // Step 1: set confirm state — button will change on next render
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,107,107,0.3)",
                          color: "#8B2020",
                          padding: "8px 18px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontFamily: "'Libre Baskerville', serif",
                          opacity: 0.7,
                          transition: "opacity 0.15s ease, background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "1";
                          e.currentTarget.style.background = "rgba(255,107,107,0.07)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "0.7";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        Delete
                      </button>
                    )}

                    {isConfirming && (
                      // Step 2: confirm delete
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#1E2018", fontSize: "12px", opacity: 0.6 }}>
                          Are you sure?
                        </span>
                        <button
                          onClick={() => handleDelete(cv.id)}
                          style={{
                            background: "rgba(255,107,107,0.15)",
                            border: "1px solid rgba(255,107,107,0.5)",
                            color: "#8B2020",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontFamily: "'Libre Baskerville', serif",
                          }}
                        >
                          Yes, delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          // Cancel: just clear the confirm state
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#1E2018",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontFamily: "'Libre Baskerville', serif",
                            opacity: 0.5,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {isDeleting && (
                      <span style={{ color: "#1E2018", fontSize: "12px", opacity: 0.5 }}>
                        Deleting...
                      </span>
                    )}

                  </div>

                </div>
              );
            })}


            {/* ── Generate Another button ──────────────── */}
            <div style={{ textAlign: "center", paddingTop: "16px", paddingBottom: "40px" }}>
              <button
                className="primary-btn"
                onClick={() => navigate("/generate")}
                style={{ fontSize: "15px", padding: "12px 28px" }}
              >
                ✨ Generate Another CV
              </button>
            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}


