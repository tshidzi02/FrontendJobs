// =============================================================================
// FILE: frontend/src/App.jsx  (UPDATED — Phase 7 tool routes added)
// =============================================================================

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import GenerateCV from "./pages/GenerateCV";
import Cabinet from "./pages/Cabinet";
import CoverLetter from "./pages/CoverLetter";
import Jobs from "./pages/Jobs";
import Tracker from "./pages/Tracker";
import InterviewPrep from "./pages/InterviewPrep";
import LinkedInOptimiser from "./pages/LinkedInOptimiser";
import SalaryEstimator from "./pages/SalaryEstimator";
import SkillsGap from "./pages/SkillsGap";
import ProtectedRoute from "./components/ProtectedRoute";
import { SidebarProvider } from "./context/SidebarContext";
import { AuthProvider } from "./context/AuthContext";
import Profile from "./pages/Profile";
import BulkGenerate from "./pages/BulkGenerate";
import SmartJobsPage from "./pages/SmartJobsPage";



function BackgroundWrapper({ children }) {
  return (
    <div className="app-wrapper">
      <video autoPlay muted loop playsInline style={{
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", objectFit: "cover", zIndex: -2,
      }}>
        <source src="/nature-video.mp4" type="video/mp4" />
      </video>
      <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.55)", zIndex: -1, pointerEvents: "none" }} />
      <Navbar />
      <div className="page-content">{children}</div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <SidebarProvider>
          <BackgroundWrapper>
            <Routes>
              <Route path="/"         element={<Home />} />
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard"       element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/generate"        element={<ProtectedRoute><GenerateCV /></ProtectedRoute>} />
              <Route path="/cabinet"         element={<ProtectedRoute><Cabinet /></ProtectedRoute>} />
              <Route path="/cover-letter"    element={<ProtectedRoute><CoverLetter /></ProtectedRoute>} />
              <Route path="/jobs"            element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
              <Route path="/tracker"         element={<ProtectedRoute><Tracker /></ProtectedRoute>} />
              <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/tools/interview" element={<ProtectedRoute><InterviewPrep /></ProtectedRoute>} />
              <Route path="/tools/linkedin"  element={<ProtectedRoute><LinkedInOptimiser /></ProtectedRoute>} />
              <Route path="/tools/salary"    element={<ProtectedRoute><SalaryEstimator /></ProtectedRoute>} />
              <Route path="/tools/skills-gap" element={<ProtectedRoute><SkillsGap /></ProtectedRoute>} />
              <Route path="/bulkgenerate" element={<ProtectedRoute><BulkGenerate /></ProtectedRoute>} />
              <Route path="/smart-jobs" element={<ProtectedRoute><SmartJobsPage /></ProtectedRoute>} />
            </Routes>
          </BackgroundWrapper>
        </SidebarProvider>
      </AuthProvider>
    </Router>
  );
}