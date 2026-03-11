// =============================================================================
// FILE: frontend/src/pages/Login.jsx  (UPDATED — AuthContext)
// =============================================================================
// CHANGE vs previous version:
//   ✅ useAuth().login(token) replaces localStorage.setItem("token", ...)
//      login() saves to localStorage AND updates AuthContext state in one call,
//      so Navbar reactively switches to logged-in view without a page reload.
// =============================================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  const navigate    = useNavigate();
  const { login }   = useAuth();

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      login(response.data.token);   // ← AuthContext: saves + updates state
      navigate("/dashboard");
    } catch (err) {
      const message = err.response?.data?.message || "Login failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await api.post("/auth/google", {
        token: credentialResponse.credential,
      });
      login(response.data.token);   // ← AuthContext: saves + updates state
      navigate("/dashboard");
    } catch {
      setError("Google sign-in failed. Please try again.");
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "0 16px",
      overflow: "auto",
    }}>

      {/* Background Video */}
      <video
        autoPlay muted loop playsInline
        style={{
          position:  "fixed", top: 0, left: 0,
          width: "100%", height: "100%",
          objectFit: "cover", zIndex: -2,
        }}
      >
        <source src="/nature-video.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay so card is readable */}
      <div style={{
        position: "fixed", top: 0, left: 0,
        width: "100%", height: "100%",
        background: "rgba(0,0,0,0.45)", zIndex: -1,
      }} />

      <div className="card">
        <div className="card-title">Welcome Back</div>

        {error && (
          <p style={{ color: "#8B2020", marginBottom: "16px", fontSize: "14px", textAlign: "center" }}>
            {error}
          </p>
        )}

        {/* Email */}
        <input
          className="input-field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Password with show/hide toggle */}
        <div style={{ position: "relative", marginBottom: "0px" }}>
          <input
            className="input-field"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ marginBottom: "20px", paddingRight: "44px" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: "absolute", right: "12px", top: "35%",
              transform: "translateY(-50%)",
              background: "none", border: "none",
              cursor: "pointer", fontSize: "18px",
              color: "#2D5A3D", padding: "0", lineHeight: "1",
            }}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Login Button */}
        <button
          className="primary-btn"
          onClick={handleLogin}
          disabled={loading}
          style={{ width: "100%", marginBottom: "16px", fontSize: "16px", padding: "12px" }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* Google Login */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google Login Failed")}
          />
        </div>

        <p style={{ textAlign: "center", color: "#1E2018", fontSize: "14px" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: "#2D5A3D", textDecoration: "none" }}>
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}