// =============================================================================
// FILE: frontend/src/context/AuthContext.jsx
// =============================================================================
// PURPOSE:
//   Single source of truth for authentication state across the entire app.
//
// THE PROBLEM WITH RAW localStorage READS:
//   Previously, every component (Navbar, ProtectedRoute) called
//   localStorage.getItem("token") directly. This means:
//     - No reactive updates: if you log out, components that already rendered
//       still think you're logged in until they re-render.
//     - Logic is duplicated: token expiry checks scattered across files.
//     - Hard to extend: adding a "user" object (email, plan, etc) means
//       touching every component that reads auth state.
//
// THE SOLUTION — AuthContext:
//   A single React Context that:
//     1. Holds the token + decoded user info in state
//     2. Exposes login() and logout() functions
//     3. Any component that calls useAuth() gets live reactive state
//     4. Logging out in one place updates EVERY component instantly
//
// FLOW:
//   main.jsx wraps app in <AuthProvider>
//   → AuthProvider reads token from localStorage on mount
//   → login(token) saves to localStorage + sets state
//   → logout() removes from localStorage + clears state
//   → useAuth() lets any component read { token, user, login, logout, isAuthenticated }
//
// =============================================================================

import { createContext, useContext, useState, useCallback } from "react";

// ── HELPERS ──────────────────────────────────────────────────────────────────

function decodeToken(token) {
  // Decode the JWT payload without verifying the signature.
  // Returns the payload object, or null if decoding fails.
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  // Returns true if the token is missing, malformed, or past its expiry time.
  if (!token) return true;
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
}

// ── CONTEXT SETUP ─────────────────────────────────────────────────────────────

const AuthContext = createContext();

// ── PROVIDER ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {

  // Initialise from localStorage on first render.
  // If a valid (non-expired) token exists, start as logged in.
  // If it's missing or expired, start as logged out.
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem("token");
    return stored && !isTokenExpired(stored) ? stored : null;
  });

  // Decode user info from the token payload.
  // Flask puts the user's email in the "sub" claim.
  // e.g. decoded = { sub: "user@example.com", exp: 1718000000, iat: ... }
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("token");
    if (stored && !isTokenExpired(stored)) {
      return decodeToken(stored);
    }
    return null;
  });

  // login: called after a successful /api/auth/login or /api/auth/google response.
  // Saves the token to localStorage and updates state — triggers re-render
  // in every component that calls useAuth(), including Navbar.
  const login = useCallback((newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(decodeToken(newToken));
  }, []);

  // logout: called from Navbar or anywhere else.
  // Clears localStorage and nulls state — Navbar reactively hides auth links.
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  // isAuthenticated: convenience boolean so components don't need to check
  // token !== null themselves.
  const isAuthenticated = token !== null;

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── HOOK ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  // Custom hook — cleaner than writing useContext(AuthContext) everywhere.
  // Also gives a helpful error if used outside <AuthProvider>.
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() must be used inside <AuthProvider>");
  }
  return context;
}