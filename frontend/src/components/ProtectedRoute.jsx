// =============================================================================
// FILE: frontend/src/components/ProtectedRoute.jsx  (UPDATED — AuthContext)
// =============================================================================
// CHANGE vs previous version:
//   ✅ Now reads auth state from AuthContext instead of localStorage directly
//   ✅ isAuthenticated is a live reactive value — updates instantly on logout
//   ✅ Token expiry logic lives in AuthContext — no duplication here
// =============================================================================

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  // isAuthenticated is false if:
  //   - No token in localStorage
  //   - Token exists but is expired (checked at AuthProvider init)
  // In either case, redirect to /login immediately.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Token exists and is valid — render the protected page.
  return children;
}