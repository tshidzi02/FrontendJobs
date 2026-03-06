import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [hoveredBtn, setHoveredBtn] = useState(null);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >

      {/* ── Background Video ──────────────────────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: -2,
        }}
      >
        <source src="/hero2-video.mp4" type="video/mp4" />
      </video>

      {/* ── Dark Overlay ──────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.55)",
          zIndex: -1,
        }}
      />

      {/* ── ALL Content in ONE div ────────────────────── */}
      {/*
        BEFORE: you had TWO content divs nested inside each other.
        The outer div had the h1 "FRONTEND" floating outside the overlay.
        The inner div had the actual content.
        This caused the giant heading to sit outside/above everything.

        AFTER: ONE single content div containing everything.
        Clean, no conflicts.
      */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: "#E0FFFF",
          padding: "100px 20px 20px 20px",
          // top 100px = clears the fixed navbar (height: 100px)
          // left/right 20px = breathing room on small screens
          // bottom 20px = breathing room at the bottom
        }}
      >

        {/* ── Small label ───────────────────────────── */}
        <p style={{
          color: "#00F5D4",
          fontSize: "12px",
          letterSpacing: "5px",
          textTransform: "uppercase",
          fontFamily: "'Bodoni MT Black', serif",
          marginBottom: "12px",
          opacity: 0.8,
        }}>
          AI · Powered · CV Platform
        </p>

        {/* ── CVFORGE heading ───────────────────────── */}
        {/*
          BEFORE: "FRONTEND" — leftover test name, huge clamp(48px → 96px)
                  was rendering ABOVE the overlay because it sat outside
                  the inner content div, before the dark overlay div.

          AFTER:  "CVFORGE" — correct brand name
                  clamp(32px → 60px) — smaller, always fits on screen
        */}
        <h1 style={{
          fontFamily: "'Train One', cursive",
          fontSize: "clamp(32px, 5vw, 60px)",
          color: "#00F5D4",
          letterSpacing: "4px",
          marginBottom: "12px",
          lineHeight: 1.1,
          textShadow: "0 0 30px rgba(0,245,212,0.25)",
        }}>
          FRONTEND
        </h1>

        {/* ── Sub heading ───────────────────────────── */}
        {/*
          BEFORE: fontSize: "3rem" + marginTop: "170px"
                  3rem = 48px — very large
                  marginTop 170px pushed it DOWN off screen

          AFTER:  clamp scales with screen, no marginTop
        */}

        {/* ── Description ───────────────────────────── */}
        {/*
          BEFORE: fontSize: "1.8rem" = 28.8px — too large, pushed buttons off screen

          AFTER:  clamp scales between 13px and 16px — compact and readable
        */}
        <p style={{                
          color: "#E0FFFF",
          fontSize: "clamp(13px, 1.5vw, 16px)",
          maxWidth: "480px",
          lineHeight: "1.6",
          marginBottom: "28px",
          opacity: 0.8,
        }}>
          Generate ATS-Optimised Resumes in Seconds
        </p>

        {/* ── BUTTONS ───────────────────────────────── */}
        {!token ? (

          // Logged OUT
          <div style={{
            display: "flex",
            flexDirection: "column",
            // column = big button on top, small buttons row below
            alignItems: "center",
            gap: "14px",
          }}>

            {/* BIG — Get Started Free */}
            {/*
              BEFORE: same size as Register and Login, all in one row

              AFTER:  sits alone on its own row above Login/Register
                      larger padding = visually bigger and more important
            */}
            <button
              className="primary-btn"
              onClick={() => navigate("/register")}
              onMouseEnter={() => setHoveredBtn("getStarted")}
                onMouseLeave={() => setHoveredBtn(null)}
              style={{
                background: hoveredBtn === "getStarted" ? "#003B44" : "#00F5D4",
                color: hoveredBtn === "getStarted" ? "#00F5D4" : "#0B1E2A",
                border: "2px solid #00F5D4",
                fontSize: "18px",
                padding: "16px 56px",
                borderRadius: "8px",
              }}
            >
              Get Started Free
            </button>

            {/* SMALL row — Login and Register */}
            <div style={{ display: "flex", gap: "12px" }}>

              {/* Login */}
              {/*
                BEFORE: transparent background, teal outline only

                AFTER:  solid teal (#00F5D4) background by default — same colour
                        as Get Started Free so they match.
                        On hover → dark teal (#003B44) background, teal text.
                        Uses hoveredBtn state to track which button is hovered
                        because React inline styles can't use CSS :hover directly.
              */}
              <button
                onClick={() => navigate("/login")}
                onMouseEnter={() => setHoveredBtn("login")}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  background: hoveredBtn === "login" ? "#003B44" : "#00F5D4",
                  color: hoveredBtn === "login" ? "#00F5D4" : "#0B1E2A",
                  border: "2px solid #00F5D4",
                  padding: "10px 28px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontFamily: "'Bodoni MT Black', serif",
                  fontWeight: "900",
                  transition: "all 0.2s ease",
                }}
              >
                Login
              </button>

              {/* Register */}
              <button
                onClick={() => navigate("/register")}
                onMouseEnter={() => setHoveredBtn("register")}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  background: hoveredBtn === "register" ? "#003B44" : "#00F5D4",
                  color: hoveredBtn === "register" ? "#00F5D4" : "#0B1E2A",
                  border: "2px solid #00F5D4",
                  padding: "10px 28px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontFamily: "'Bodoni MT Black', serif",
                  fontWeight: "900",
                  transition: "all 0.2s ease",
                }}
              >
                Register
              </button>

            </div>
          </div>

        ) : (

          // Logged IN — Go to Dashboard
          <button
            onClick={() => navigate("/dashboard")}
            onMouseEnter={() => setHoveredBtn("dashboard")}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              background: hoveredBtn === "dashboard" ? "#003B44" : "#00F5D4",
              color: hoveredBtn === "dashboard" ? "#00F5D4" : "#0B1E2A",
              border: "2px solid #00F5D4",
              padding: "16px 56px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "18px",
              fontFamily: "'Bodoni MT Black', serif",
              fontWeight: "900",
              transition: "all 0.2s ease",
            }}
          >
            Go to Dashboard
          </button>
        )}

      </div>
    </div>
  );
}