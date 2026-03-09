
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError("");
    setSuccess("");

    if (!email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", { email, password });
      setSuccess("Account created! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "80vh",
      padding: "0 16px",
    }}>

        {/* Background Video */}
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
          marginTop: "100px" /* push below fixed navbar */
        }}
      >
        <source src="/hero1-video.mp4" type="video/mp4" />
      </video>

      <div className="card">
        <div className="card-title">Create Account</div>

        {error && (
          <p style={{ color: "#FF6B6B", marginBottom: "16px", fontSize: "14px", textAlign: "center" }}>
            {error}
          </p>
        )}

        {success && (
          <p style={{ color: "#00F5D4", marginBottom: "16px", fontSize: "14px", textAlign: "center" }}>
            {success}
          </p>
        )}

        {/* Email */}
        <input
          className="input-field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Password with show/hide */}
        <div style={{ position: "relative" }}>
          <input
            className="input-field"
            type={showPassword ? "text" : "password"}
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: "20px", paddingRight: "44px" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: "absolute",
              right: "12px",
              top: "35%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              color: "#00F5D4",
              padding: "0",
              lineHeight: "1",
            }}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Confirm Password with show/hide */}
        <div style={{ position: "relative" }}>
          <input
            className="input-field"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ marginBottom: "20px", paddingRight: "44px" }}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            style={{
              position: "absolute",
              right: "12px",
              top: "35%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              color: "#00F5D4",
              padding: "0",
              lineHeight: "1",
            }}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Submit */}
        <button
          className="primary-btn"
          onClick={handleRegister}
          disabled={loading}
          style={{ width: "100%", marginBottom: "16px", fontSize: "16px", padding: "12px" }}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p style={{ textAlign: "center", color: "#E0FFFF", fontSize: "14px" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#00F5D4", textDecoration: "none" }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}

