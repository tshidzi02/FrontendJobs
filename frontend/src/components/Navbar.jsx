// FILE: frontend/src/components/Navbar.jsx  (UPDATED — Full responsive all screens)

import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
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
  const showHamburger    = isAuthenticated && (isDashboardRoute || isMobile);

  const navbarHeight = isMobile ? "60px" : "100px";

  return (
    <div style={{
      position:        "fixed",
      top: 0, left: 0,
      width:           "100%",
      height:          navbarHeight,
      background:      "#0B1E2A",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "space-between",
      padding:         isMobile ? "0 12px" : "0 clamp(28px, 4vw, 60px)",
      zIndex:          1000,
      boxShadow:       "0 2px 20px rgba(0,0,0,0.4)",
    }}>

      {/* LEFT */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "10px" : "16px" }}>
        {showHamburger && (
          <button
            onClick={toggleSidebar}
            aria-label="Toggle menu"
            style={{
              background:   "transparent",
              border:       "2px solid #00F5D4",
              color:        "#00F5D4",
              borderRadius: "6px",
              padding:      isMobile ? "4px 8px" : "6px 10px",
              cursor:       "pointer",
              fontSize:     isMobile ? "16px" : "18px",
              lineHeight:   1,
              fontFamily:   "monospace",
              flexShrink:   0,
              minHeight:    "36px",
            }}
          >☰</button>
        )}
        <Link
          to="/"
          style={{
            color:          "#E0FFFF",
            fontFamily:     "'Train One', cursive",
            letterSpacing:  isMobile ? "0px" : "3px",
            fontSize:       isMobile ? "14px" : "clamp(18px, 2.2vw, 32px)",
            fontWeight:     900,
            textDecoration: "none",
            whiteSpace:     "nowrap",
          }}
        >
          FRONTENDJOBS
        </Link>
      </div>

      {/* RIGHT */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Desktop: full nav */}
        {!isAuthenticated && !isMobile && (
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </div>
        )}
        {/* Mobile: Login link only */}
        {!isAuthenticated && isMobile && (
          <Link
            to="/login"
            style={{
              color: "#00F5D4", textDecoration: "none",
              fontFamily: "'Bodoni MT Black', serif", fontWeight: 900,
              fontSize: "13px", minHeight: "44px", display: "flex", alignItems: "center",
            }}
          >Login</Link>
        )}
        {/* Logout */}
        {isAuthenticated && (
          <button
            onClick={handleLogout}
            style={{
              background:   "#00F5D4",
              color:        "#0B1E2A",
              border:       "none",
              padding:      isMobile ? "7px 11px" : "10px 20px",
              borderRadius: "6px",
              cursor:       "pointer",
              fontFamily:   "'Bodoni MT Black', serif",
              fontWeight:   900,
              fontSize:     isMobile ? "11px" : "clamp(12px, 1vw, 14px)",
              whiteSpace:   "nowrap",
              minHeight:    "36px",
            }}
          >Logout</button>
        )}
      </div>
    </div>
  );
}

export default Navbar;
