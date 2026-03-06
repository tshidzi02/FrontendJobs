// =============================================================================
// FILE: frontend/src/components/Navbar.jsx  (UPDATED — Phase 7 routes added)
// =============================================================================

import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleSidebar } = useSidebar();
  const { isAuthenticated, logout } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const handleLogout = () => { logout(); navigate("/"); };

  const dashboardRoutes = [
    "/dashboard", "/cabinet", "/generate", "/profile",
    "/cover-letter", "/jobs", "/tracker",
    "/tools/interview", "/tools/linkedin", "/tools/salary", "/tools/skills-gap",
  ];
  const isDashboardRoute = dashboardRoutes.includes(location.pathname);

  return (
    <div className="navbar">
      <div className="nav-left" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
        {isAuthenticated && (isDashboardRoute || isMobile) && (
          <button onClick={toggleSidebar} style={{
            background: "transparent", border: "2px solid #00F5D4", color: "#00F5D4",
            borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "18px", lineHeight: 1, fontFamily: "monospace",
          }} aria-label="Toggle menu">☰</button>
        )}
        <Link to="/" className="brand-name" style={{ fontSize: "28px", textDecoration: "none" }}>FRONTEND</Link>
      </div>
      {!isMobile && (
        <div className="nav-links">
          {!isAuthenticated && (<><Link to="/">Home</Link><Link to="/login">Login</Link><Link to="/register">Register</Link></>)}
          {isAuthenticated && (<button className="primary-btn" onClick={handleLogout}>Logout</button>)}
        </div>
      )}
      {isMobile && isAuthenticated && (<button className="primary-btn" onClick={handleLogout} style={{ fontSize: "13px", padding: "8px 14px" }}>Logout</button>)}
      {isMobile && !isAuthenticated && (<Link to="/login" style={{ color: "#00F5D4", textDecoration: "none", fontFamily: "'Bodoni MT Black', serif", fontWeight: 900, fontSize: "14px" }}>Login</Link>)}
    </div>
  );
}

export default Navbar;