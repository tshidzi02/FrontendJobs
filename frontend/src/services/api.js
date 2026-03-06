// =============================================================================
// FILE: frontend/src/services/api.js  (UPDATED — Lesson 1.1)
// =============================================================================
// CHANGE: baseURL now reads from environment variable instead of being hardcoded.
// This means in development it uses http://127.0.0.1:5000/api
// In production it uses whatever VITE_API_URL is set to on the server.
// =============================================================================

import axios from "axios";

const api = axios.create({

  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api",
  // import.meta.env.VITE_API_URL reads the environment variable from frontend/.env
  // The || "http://127.0.0.1:5000/api" part is a FALLBACK.
  // If the env variable is missing for any reason, we fall back to localhost.
  // This prevents the app from breaking during initial setup.

  headers: {
    "Content-Type": "application/json",
  },
});

// REQUEST interceptor — attaches JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// RESPONSE interceptor — catches 401s across the ENTIRE app
// Without this, expired tokens silently show "Failed to save" with no explanation.
// With this, the user is automatically logged out and sent to /login immediately.
api.interceptors.response.use(
  (response) => response,
  // Pass successful responses straight through — no changes.

  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clean up and redirect to login.
      localStorage.removeItem("token");
      window.location.href = "/login";
      // window.location.href works outside React components where
      // useNavigate() is not available (like this interceptor).
    }
    return Promise.reject(error);
    // Still reject the promise so individual catch blocks can handle it if needed.
  }
);

export default api;
