
// =============================================================================
// FILE: frontend/src/pages/Tracker.jsx
// =============================================================================
// Phase 5.4 — Job Application Kanban Tracker
//
// COLUMNS: Wishlist → Applied → Interview → Offer → Rejected
// FEATURES:
//   ✅ Drag and drop cards between columns (HTML5 drag API — no library needed)
//   ✅ Add new application via modal form
//   ✅ Edit existing application inline
//   ✅ Delete with confirmation
//   ✅ "Add to Tracker" button on Job Search page pre-fills company + role
//   ✅ Column counts + summary stats at top
//   ✅ Cards show: company, role, salary, date, notes, source URL link
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";


// =============================================================================
// CONSTANTS
// =============================================================================

const COLUMNS = [
  { id: "Wishlist",  label: "Wishlist",  emoji: "⭐", color: "#60A5FA" },
  { id: "Applied",   label: "Applied",   emoji: "📤", color: "#2D5A3D" },
  { id: "Interview", label: "Interview", emoji: "🎙️", color: "#A78BFA" },
  { id: "Offer",     label: "Offer",     emoji: "🎉", color: "#4ADE80" },
  { id: "Rejected",  label: "Rejected",  emoji: "❌", color: "#8B2020" },
];

const EMPTY_FORM = {
  company: "", role: "", status: "Wishlist",
  salary: "", notes: "", url: "",
};


// =============================================================================
// HELPERS
// =============================================================================

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function getColumnColor(status) {
  return COLUMNS.find(c => c.id === status)?.color || "#1E2018";
}


// =============================================================================
// APPLICATION CARD
// =============================================================================

function AppCard({ app, onDragStart, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const col = COLUMNS.find(c => c.id === app.status);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, app.id)}
      style={{
        background:   "#FFFFFF",
        border:       `1px solid ${col?.color || "#2D5A3D"}30`,
        borderLeft:   `3px solid ${col?.color || "#2D5A3D"}`,
        borderRadius: "10px",
        padding:      "14px 16px",
        marginBottom: "10px",
        cursor:       "grab",
        userSelect:   "none",
        transition:   "box-shadow 0.15s ease",
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 20px ${col?.color || "#2D5A3D"}20`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      {/* Company + Role */}
      <p style={{
        color:      "#1E2018",
        fontFamily: "'Libre Baskerville', serif",
        fontWeight: 900,
        fontSize:   "14px",
        marginBottom: "2px",
        lineHeight: 1.3,
      }}>
        {app.role || "Untitled Role"}
      </p>
      <p style={{
        color:      col?.color || "#2D5A3D",
        fontSize:   "12px",
        fontFamily: "'Libre Baskerville', serif",
        fontWeight: 900,
        marginBottom: "8px",
      }}>
        {app.company || "Unknown Company"}
      </p>

      {/* Salary */}
      {app.salary && (
        <p style={{
          color:        "#FFB347",
          fontSize:     "12px",
          marginBottom: "6px",
          fontFamily:   "system-ui, sans-serif",
        }}>
          💰 {app.salary}
        </p>
      )}

      {/* Notes preview */}
      {app.notes && (
        <p style={{
          color:        "#1E2018",
          fontSize:     "11px",
          opacity:      0.5,
          fontFamily:   "system-ui, sans-serif",
          lineHeight:   1.5,
          marginBottom: "8px",
          display:      "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow:     "hidden",
        }}>
          {app.notes}
        </p>
      )}

      {/* Footer row */}
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        marginTop:      "8px",
        paddingTop:     "8px",
        borderTop:      "1px solid rgba(0,0,0,0.06)",
      }}>
        <span style={{ color: "#1E2018", fontSize: "10px", opacity: 0.35 }}>
          {formatDate(app.created_at)}
        </span>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {/* External URL */}
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                color:      col?.color || "#2D5A3D",
                fontSize:   "11px",
                textDecoration: "none",
                opacity:    0.7,
              }}
            >
              🔗
            </a>
          )}

          {/* Edit */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(app); }}
            style={{
              background: "transparent", border: "none",
              color: "#1E2018", cursor: "pointer",
              fontSize: "12px", opacity: 0.5, padding: "0 2px",
            }}
            title="Edit"
          >
            ✏️
          </button>

          {/* Delete */}
          {confirmDelete ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(app.id); }}
              style={{
                background:   "rgba(255,107,107,0.2)",
                border:       "1px solid #8B2020",
                borderRadius: "4px",
                color:        "#8B2020",
                cursor:       "pointer",
                fontSize:     "10px",
                padding:      "2px 6px",
                fontFamily:   "'Libre Baskerville', serif",
              }}
            >
              Confirm
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }}
              style={{
                background: "transparent", border: "none",
                color: "#8B2020", cursor: "pointer",
                fontSize: "12px", opacity: 0.5, padding: "0 2px",
              }}
              title="Delete"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// KANBAN COLUMN
// =============================================================================

function KanbanColumn({ column, apps, onDragStart, onDrop, onDragOver, onEdit, onDelete, onAddCard }) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver(e); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { setIsDragOver(false); onDrop(e, column.id); }}
      style={{
        flex:         "0 0 clamp(220px, 75vw, 260px)",
        scrollSnapAlign: "start",
        minHeight:    "500px",
        background:   isDragOver ? `${column.color}08` : "rgba(220,210,192,0.4)",
        border:       isDragOver ? `1px solid ${column.color}60` : "1px solid rgba(45,90,61,0.08)",
        borderRadius: "14px",
        padding:      "16px",
        transition:   "all 0.15s ease",
        display:      "flex",
        flexDirection: "column",
      }}
    >
      {/* Column header */}
      <div style={{
        display:       "flex",
        justifyContent: "space-between",
        alignItems:    "center",
        marginBottom:  "16px",
        paddingBottom: "12px",
        borderBottom:  `1px solid ${column.color}25`,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>{column.emoji}</span>
          <span style={{
            color:       column.color,
            fontFamily:  "'Libre Baskerville', serif",
            fontWeight:  900,
            fontSize:    "13px",
            letterSpacing: "0.5px",
          }}>
            {column.label}
          </span>
        </div>
        <span style={{
          background:   `${column.color}18`,
          border:       `1px solid ${column.color}35`,
          borderRadius: "20px",
          padding:      "2px 8px",
          fontSize:     "11px",
          color:        column.color,
          fontFamily:   "'Libre Baskerville', serif",
          fontWeight:   900,
        }}>
          {apps.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ flex: 1 }}>
        {apps.length === 0 && (
          <div style={{
            textAlign:    "center",
            padding:      "30px 10px",
            color:        "#1E2018",
            opacity:      0.2,
            fontSize:     "12px",
            fontFamily:   "system-ui, sans-serif",
          }}>
            Drop cards here
          </div>
        )}
        {apps.map(app => (
          <AppCard
            key={app.id}
            app={app}
            onDragStart={onDragStart}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Add card button */}
      <button
        onClick={() => onAddCard(column.id)}
        style={{
          width:        "100%",
          padding:      "10px",
          background:   "transparent",
          border:       `1px dashed ${column.color}35`,
          borderRadius: "8px",
          color:        column.color,
          fontSize:     "12px",
          fontFamily:   "'Libre Baskerville', serif",
          fontWeight:   900,
          cursor:       "pointer",
          marginTop:    "8px",
          opacity:      0.6,
          transition:   "opacity 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
        onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
      >
        + Add
      </button>
    </div>
  );
}


// =============================================================================
// ADD / EDIT MODAL
// =============================================================================

function AppModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!form.company.trim() && !form.role.trim()) {
      setError("Please enter at least a company or role.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  const inputStyle = {
    width:        "100%",
    padding:      "11px 14px",
    background:   "#FFFFFF",
    border:       "1px solid rgba(45,90,61,0.2)",
    borderRadius: "8px",
    color:        "#1E2018",
    fontSize:     "13px",
    fontFamily:   "system-ui, sans-serif",
    outline:      "none",
    boxSizing:    "border-box",
  };

  const labelStyle = {
    color:         "#1E2018",
    fontSize:      "11px",
    opacity:       0.5,
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontFamily:    "'Libre Baskerville', serif",
    marginBottom:  "6px",
    display:       "block",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", top: 0, left: 0,
          width: "100vw", height: "100vh",
          background: "rgba(0,0,0,0.75)", zIndex: 2000,
        }}
      />

      {/* Modal */}
      <div style={{
        position:     "fixed",
        top:          "50%", left: "50%",
        transform:    "translate(-50%, -50%)",
        width:        "min(520px, 92vw)",
        maxHeight:    "90vh",
        background:   "#F0EAD8",
        border:       "1px solid rgba(45,90,61,0.3)",
        borderRadius: "16px",
        zIndex:       2001,
        display:      "flex",
        flexDirection: "column",
        overflow:     "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding:      "24px 28px 18px",
          borderBottom: "1px solid rgba(45,90,61,0.1)",
          display:      "flex",
          justifyContent: "space-between",
          alignItems:   "center",
          flexShrink:   0,
        }}>
          <h2 style={{
            color:      "#2D5A3D",
            fontFamily: "'Libre Baskerville', serif",
            fontWeight: 900,
            fontSize:   "16px",
          }}>
            {initial?.id ? "Edit Application" : "Add Application"}
          </h2>
          <button onClick={onClose} style={{
            background: "transparent", border: "none",
            color: "#1E2018", fontSize: "18px",
            cursor: "pointer", opacity: 0.5,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>

          {error && (
            <p style={{ color: "#8B2020", fontSize: "13px", marginBottom: "16px" }}>{error}</p>
          )}

          {/* Row: Company + Role */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Company</label>
              <input
                style={inputStyle}
                placeholder="e.g. Google"
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Role</label>
              <input
                style={inputStyle}
                placeholder="e.g. Software Engineer"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              />
            </div>
          </div>

          {/* Row: Status + Salary */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {COLUMNS.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Salary</label>
              <input
                style={inputStyle}
                placeholder="e.g. R45,000/month"
                value={form.salary}
                onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
              />
            </div>
          </div>

          {/* URL */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Job URL</label>
            <input
              style={inputStyle}
              placeholder="https://..."
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "8px" }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight:  "100px",
                resize:     "vertical",
                lineHeight: 1.6,
              }}
              placeholder="Interview date, recruiter name, anything relevant..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding:    "18px 28px",
          borderTop:  "1px solid rgba(45,90,61,0.1)",
          display:    "flex",
          gap:        "12px",
          flexShrink: 0,
        }}>
          <button
            className="primary-btn"
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1, fontSize: "14px", padding: "12px" }}
          >
            {saving ? "Saving..." : (initial?.id ? "Save Changes" : "Add Application")}
          </button>
          <button
            onClick={onClose}
            style={{
              padding:      "12px 20px",
              background:   "transparent",
              border:       "1px solid rgba(45,90,61,0.2)",
              borderRadius: "6px",
              color:        "#1E2018",
              cursor:       "pointer",
              fontFamily:   "'Libre Baskerville', serif",
              fontWeight:   900,
              fontSize:     "14px",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}


// =============================================================================
// MAIN PAGE
// =============================================================================

export default function Tracker() {
  const navigate       = useNavigate();
  const routerLocation = useLocation();

  const [apps,    setApps]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingApp,   setEditingApp]   = useState(null);
  const [defaultStatus, setDefaultStatus] = useState("Wishlist");

  // Drag state
  const dragId = useRef(null);


  // ── LOAD APPLICATIONS ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/tracker");
        setApps(res.data);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        } else {
          setError("Failed to load applications.");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);


  // ── PRE-FILL FROM JOB SEARCH ──────────────────────────────────────────────
  // If the user clicked "Add to Tracker" from the Jobs page,
  // router state contains { company, role, url } — open the modal pre-filled.
  useEffect(() => {
    const state = routerLocation.state;
    if (state?.openTracker) {
      setEditingApp({
        company: state.company || "",
        role:    state.role    || "",
        url:     state.url     || "",
        status:  "Wishlist",
        salary:  "",
        notes:   "",
      });
      setModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [routerLocation.state]);


  // ── DRAG HANDLERS ─────────────────────────────────────────────────────────
  const handleDragStart = (e, id) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const id = dragId.current;
    if (!id) return;

    const app = apps.find(a => a.id === id);
    if (!app || app.status === newStatus) return;

    // Optimistic update
    setApps(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));

    try {
      await api.patch(`/tracker/${id}`, { status: newStatus });
    } catch {
      // Revert on failure
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: app.status } : a));
      setError("Failed to update status. Please try again.");
    }

    dragId.current = null;
  };


  // ── ADD HANDLER ────────────────────────────────────────────────────────────
  const handleAdd = (status = "Wishlist") => {
    setEditingApp({ ...EMPTY_FORM, status });
    setDefaultStatus(status);
    setModalOpen(true);
  };


  // ── SAVE HANDLER (create or update) ──────────────────────────────────────
  const handleSave = async (form) => {
    if (form.id) {
      // Update existing
      const res = await api.patch(`/tracker/${form.id}`, form);
      setApps(prev => prev.map(a => a.id === form.id ? res.data : a));
    } else {
      // Create new
      const res = await api.post("/tracker", form);
      setApps(prev => [res.data, ...prev]);
    }
  };


  // ── DELETE HANDLER ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setApps(prev => prev.filter(a => a.id !== id));
    try {
      await api.delete(`/tracker/${id}`);
    } catch {
      setError("Delete failed.");
    }
  };


  // ── STATS ─────────────────────────────────────────────────────────────────
  const totalApps    = apps.filter(a => a.status !== "Wishlist").length;
  const interviews   = apps.filter(a => a.status === "Interview").length;
  const offers       = apps.filter(a => a.status === "Offer").length;
  const responseRate = totalApps > 0
    ? Math.round(((interviews + offers) / totalApps) * 100)
    : 0;


  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div style={{ paddingBottom: "clamp(40px, 6vw, 80px)" }}>

        {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "flex-start",
          marginBottom:   "28px",
          flexWrap:       "wrap",
          gap:            "16px",
        }}>
          <div>
            <h1 style={{
              fontFamily:    "'Libre Baskerville', serif",
              fontSize: "clamp(20px, 4vw, 32px)",
              color:         "#2D5A3D",
              letterSpacing: "2px",
              marginBottom:  "6px",
            }}>
              APPLICATION TRACKER
            </h1>
            <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.5 }}>
              Drag cards between columns to update status
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={() => handleAdd("Wishlist")}
            style={{ fontSize: "14px", padding: "12px 24px", whiteSpace: "nowrap" }}
          >
            + Add Application
          </button>
        </div>


        {/* ── STATS ROW ────────────────────────────────────────────────────── */}
        {apps.length > 0 && (
          <div style={{
            display:      "flex",
            gap:          "12px",
            marginBottom: "28px",
            flexWrap:     "wrap",
          }}>
            {[
              { label: "Total Applied",   value: totalApps,    color: "#2D5A3D" },
              { label: "Interviews",      value: interviews,   color: "#A78BFA" },
              { label: "Offers",          value: offers,       color: "#4ADE80" },
              { label: "Response Rate",   value: `${responseRate}%`, color: "#FFB347" },
            ].map(stat => (
              <div key={stat.label} style={{
                background:   "rgba(220,210,192,0.6)",
                border:       "1px solid rgba(45,90,61,0.1)",
                borderRadius: "10px",
                padding:      "14px 20px",
                flex:         1,
                minWidth:     "120px",
              }}>
                <p style={{
                  color:         "#1E2018",
                  fontSize:      "10px",
                  opacity:       0.4,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  fontFamily:    "'Libre Baskerville', serif",
                  marginBottom:  "6px",
                }}>
                  {stat.label}
                </p>
                <p style={{
                  color:      stat.color,
                  fontFamily: "'Libre Baskerville', serif",
                  fontSize: "clamp(18px, 3vw, 28px)",
                  lineHeight: 1,
                }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}


        {/* ── ERROR ────────────────────────────────────────────────────────── */}
        {error && (
          <p style={{ color: "#8B2020", fontSize: "13px", marginBottom: "16px" }}>{error}</p>
        )}


        {/* ── LOADING ──────────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            {COLUMNS.map(col => (
              <div key={col.id} style={{
                flex:         "0 0 clamp(220px, 75vw, 260px)",
                height:       "400px",
                background:   "#F0EAD8",
                borderRadius: "14px",
                opacity:      0.4,
              }} />
            ))}
          </div>
        )}


        {/* ── KANBAN BOARD ─────────────────────────────────────────────────── */}
        {!loading && (
          <div style={{
            display:    "flex",
            gap:        "16px",
            overflowX:  "auto",
            paddingBottom: "16px",
            // Allow horizontal scroll on smaller screens
          }}>
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                apps={apps.filter(a => a.status === col.id)}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onEdit={(app) => { setEditingApp(app); setModalOpen(true); }}
                onDelete={handleDelete}
                onAddCard={handleAdd}
              />
            ))}
          </div>
        )}


        {/* ── EMPTY STATE ──────────────────────────────────────────────────── */}
        {!loading && apps.length === 0 && (
          <div style={{
            position:   "absolute",
            top:        "50%",
            left:       "50%",
            transform:  "translate(-50%, -50%)",
            textAlign:  "center",
            pointerEvents: "none",
          }}>
            <p style={{ fontSize: "clamp(22px, 4vw, 40px)", marginBottom: "12px" }}>📋</p>
            <p style={{
              color:      "#1E2018",
              fontFamily: "'Libre Baskerville', serif",
              fontSize:   "16px",
              marginBottom: "8px",
            }}>
              No applications yet
            </p>
            <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.45 }}>
              Add your first application or find jobs in Job Search
            </p>
          </div>
        )}

      </div>


      {/* ── MODAL ────────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <AppModal
          initial={editingApp}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingApp(null); }}
        />
      )}

    </DashboardLayout>
  );
}

