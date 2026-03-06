// =============================================================================
// FILE: frontend/src/layouts/DashboardLayout.jsx  (UPDATED — Phase 7 tools)
// =============================================================================

import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";

export default function DashboardLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const { logout } = useAuth();

  const handleLogout = () => { logout(); closeSidebar(); navigate("/"); };

  const navLinkStyle = (path) => ({
    display: "block", padding: "10px 16px", borderRadius: "8px", marginBottom: "4px",
    textDecoration: "none", fontFamily: "'Bodoni MT Black', serif", fontWeight: "900",
    fontSize: "14px", transition: "all 0.15s ease",
    background: location.pathname === path ? "#00F5D4" : "transparent",
    color:      location.pathname === path ? "#0B1E2A" : "#E0FFFF",
    borderLeft: location.pathname === path ? "4px solid #0B1E2A" : "4px solid transparent",
  });

  const sectionLabel = {
    color: "#E0FFFF", fontSize: "9px", opacity: 0.3, letterSpacing: "2px",
    textTransform: "uppercase", fontFamily: "'Bodoni MT Black', serif",
    padding: "14px 16px 6px", display: "block",
  };

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>

      {isSidebarOpen && (
        <div onClick={closeSidebar} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.6)", zIndex: 900 }} />
      )}

      <aside style={{
        position: "fixed", top: "100px", left: 0,
        width: "240px", height: "calc(100vh - 100px)",
        background: "#003B44", borderRight: "1px solid rgba(0,245,212,0.3)",
        padding: "20px 12px", display: "flex", flexDirection: "column",
        zIndex: 1000,
        transform: isSidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
        overflowY: "auto",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid rgba(0,245,212,0.2)", padding: "0 4px 14px" }}>
          <span style={{ color: "#00F5D4", fontFamily: "'Train One', cursive", fontSize: "18px", letterSpacing: "2px" }}>MENU</span>
          <button onClick={closeSidebar} style={{ background: "transparent", border: "none", color: "#E0FFFF", fontSize: "18px", cursor: "pointer", padding: "4px 8px", borderRadius: "4px" }} aria-label="Close menu">✕</button>
        </div>

        <nav style={{ flex: 1 }}>

          {/* Main */}
          <span style={sectionLabel}>Main</span>
          <Link to="/dashboard"    style={navLinkStyle("/dashboard")}    onClick={closeSidebar}>📊 Dashboard</Link>
          <Link to="/profile"      style={navLinkStyle("/profile")}      onClick={closeSidebar}>👤 My Profile</Link>

          {/* CV Tools */}
          <span style={sectionLabel}>CV</span>
          <Link to="/generate"     style={navLinkStyle("/generate")}     onClick={closeSidebar}>✨ Generate CV</Link>
          <Link to="/cabinet"      style={navLinkStyle("/cabinet")}      onClick={closeSidebar}>🗂️ CV Cabinet</Link>
          <Link to="/cover-letter" style={navLinkStyle("/cover-letter")} onClick={closeSidebar}>✉️ Cover Letter</Link>

          {/* Jobs */}
          <span style={sectionLabel}>Jobs</span>
          <Link to="/jobs"         style={navLinkStyle("/jobs")}         onClick={closeSidebar}>🔍 Job Search</Link>
          <Link to="/tracker"      style={navLinkStyle("/tracker")}      onClick={closeSidebar}>📋 App Tracker</Link>

          {/* AI Tools */}
          <span style={sectionLabel}>AI Tools</span>
          <Link to="/tools/interview"  style={navLinkStyle("/tools/interview")}  onClick={closeSidebar}>🎙️ Interview Prep</Link>
          <Link to="/tools/linkedin"   style={navLinkStyle("/tools/linkedin")}   onClick={closeSidebar}>💼 LinkedIn Bio</Link>
          <Link to="/tools/salary"     style={navLinkStyle("/tools/salary")}     onClick={closeSidebar}>💰 Salary Estimator</Link>
          <Link to="/tools/skills-gap" style={navLinkStyle("/tools/skills-gap")} onClick={closeSidebar}>📊 Skills Gap</Link>

        </nav>

        {/* Logout */}
        <div style={{ paddingTop: "16px", borderTop: "1px solid rgba(0,245,212,0.15)", marginTop: "8px" }}>
          <button onClick={handleLogout} style={{
            width: "100%", padding: "11px 16px", background: "transparent",
            border: "1px solid rgba(255,107,107,0.3)", borderRadius: "8px",
            color: "#FF6B6B", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900,
            fontSize: "13px", cursor: "pointer",
          }}>
            🚪 Logout
          </button>
        </div>
      </aside>

      <div>{children}</div>
    </div>
  );
}