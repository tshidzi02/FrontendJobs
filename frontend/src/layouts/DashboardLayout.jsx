// FILE: frontend/src/layouts/DashboardLayout.jsx  (UPDATED — Full responsive)

import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const { logout } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { closeSidebar(); }, [location.pathname]); // eslint-disable-line

  const handleLogout = () => { logout(); closeSidebar(); navigate("/"); };

  const navLinkStyle = (path) => ({
    display:        "flex",
    alignItems:     "center",
    padding:        "11px 14px",
    borderRadius:   "8px",
    marginBottom:   "3px",
    textDecoration: "none",
    fontFamily:     "'Libre Baskerville', serif",
    fontWeight:     900,
    fontSize:       "13px",
    transition:     "all 0.15s ease",
    background:     location.pathname === path ? "#2D5A3D" : "transparent",
    color:          location.pathname === path ? "#F4EFE6" : "#D4C9B0",
    borderLeft:     location.pathname === path ? "4px solid #EDE8DE" : "4px solid transparent",
    minHeight:      "44px",
  });

  const sectionLabel = {
    color:          "#D4C9B0",
    fontSize:       "9px",
    opacity:        0.3,
    letterSpacing:  "2px",
    textTransform:  "uppercase",
    fontFamily:     "'Libre Baskerville', serif",
    padding:        "14px 16px 4px",
    display:        "block",
  };

  const navbarH  = isMobile ? "60px" : "100px";
  const sidebarW = "260px";

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>

      {/* Overlay — tap to close sidebar */}
      {isSidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position:   "fixed", inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex:     998,
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside style={{
        position:      "fixed",
        top:           0, left: 0,
        width:         sidebarW,
        height:        "100vh",
        background:    "#1E2A1A",
        borderRight:   "1px solid rgba(255,255,255,0.1)",
        padding:       "0 10px 20px",
        display:       "flex",
        flexDirection: "column",
        zIndex:        999,
        transform:     isSidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition:    "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        overflowY:     "auto",
        boxShadow:     isSidebarOpen ? "6px 0 40px rgba(0,0,0,0.5)" : "none",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(45,90,61,0.2) transparent",
      }}>

        {/* Sidebar header */}
        <div style={{
          display:         "flex",
          justifyContent:  "space-between",
          alignItems:      "center",
          padding:         `calc(${navbarH} + 12px) 6px 14px`,
          borderBottom:    "1px solid rgba(255,255,255,0.1)",
          marginBottom:    "8px",
          position:        "sticky",
          top:             0,
          background:      "#1E2A1A",
          zIndex:          1,
        }}>
          <span style={{
            color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif",
            fontSize: "15px", letterSpacing: "2px",
          }}>MENU</span>
          <button
            onClick={closeSidebar}
            aria-label="Close menu"
            style={{
              background: "transparent", border: "none",
              color: "#D4C9B0", fontSize: "20px", cursor: "pointer",
              padding: "4px 8px", borderRadius: "4px", lineHeight: 1,
              minHeight: "36px",
            }}
          >✕</button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1 }}>
          <span style={sectionLabel}>Main</span>
          <Link to="/dashboard"    style={navLinkStyle("/dashboard")}    onClick={closeSidebar}>📊 Dashboard</Link>
          <Link to="/profile"      style={navLinkStyle("/profile")}      onClick={closeSidebar}>👤 My Profile</Link>

          <span style={sectionLabel}>CV</span>
          <Link to="/generate"     style={navLinkStyle("/generate")}     onClick={closeSidebar}>✨ Generate CV</Link>
           <Link to="/cover-letter" style={navLinkStyle("/cover-letter")} onClick={closeSidebar}>✉️ Cover Letter</Link>
         <Link to="/bulkgenerate"         style={navLinkStyle("/bulkgenerate")}         onClick={closeSidebar}>⚡ Bulk Generate</Link>
          <Link to="/cabinet"      style={navLinkStyle("/cabinet")}      onClick={closeSidebar}>🗂️ Cabinet</Link>
         

          <span style={sectionLabel}>Jobs</span>
          <Link to="/jobs"         style={navLinkStyle("/jobs")}         onClick={closeSidebar}>🔍 Job Search</Link>
          <Link to="/smart-jobs"  style={navLinkStyle("/smart-jobs")}  onClick={closeSidebar}>⚡ Smart Jobs</Link>
          <Link to="/tracker"      style={navLinkStyle("/tracker")}      onClick={closeSidebar}>📋 App Tracker</Link>

          <span style={sectionLabel}>AI Tools</span>
          <Link to="/tools/interview"  style={navLinkStyle("/tools/interview")}  onClick={closeSidebar}>🎙️ Interview Prep</Link>
          <Link to="/tools/linkedin"   style={navLinkStyle("/tools/linkedin")}   onClick={closeSidebar}>💼 LinkedIn Bio</Link>
          <Link to="/tools/salary"     style={navLinkStyle("/tools/salary")}     onClick={closeSidebar}>💰 Salary Estimator</Link>
          <Link to="/tools/skills-gap" style={navLinkStyle("/tools/skills-gap")} onClick={closeSidebar}>📊 Skills Gap</Link>

        </nav>

        {/* Logout */}
        <div style={{ paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%", padding: "12px 14px",
              background: "transparent",
              border: "1px solid rgba(255,107,107,0.3)",
              borderRadius: "8px", color: "#F08080",
              fontFamily: "'Libre Baskerville', serif", fontWeight: 900,
              fontSize: "13px", cursor: "pointer", minHeight: "44px",
            }}
          >🚪 Logout</button>
        </div>
      </aside>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}