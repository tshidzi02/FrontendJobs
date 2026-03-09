
// =============================================================================
// FILE: frontend/src/pages/Profile.jsx  (UPDATED — Education + Projects optional)
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  background: "#0B1E2A",
  border: "1px solid rgba(0,245,212,0.2)",
  borderRadius: "8px",
  color: "#E0FFFF",
  fontSize: "14px",
  fontFamily: "system-ui, sans-serif",
  outline: "none",
};

const labelStyle = {
  color: "#E0FFFF",
  fontSize: "12px",
  opacity: 0.55,
  marginBottom: "6px",
  display: "block",
  fontFamily: "'Bodoni MT Black', serif",
  letterSpacing: "0.5px",
};

function SectionHeader({ title }) {
  return (
    <h2 style={{
      color: "#00F5D4",
      fontFamily: "'Bodoni MT Black', serif",
      fontSize: "13px",
      letterSpacing: "2px",
      textTransform: "uppercase",
      marginBottom: "20px",
      paddingBottom: "10px",
      borderBottom: "1px solid rgba(0,245,212,0.15)",
    }}>
      {title}
    </h2>
  );
}

const PROFICIENCY_LEVELS = [
  { label: "Beginner (A1)",                value: 1 },
  { label: "Elementary (A2)",              value: 2 },
  { label: "Intermediate (B1)",            value: 3 },
  { label: "Upper-Intermediate (B2)",      value: 4 },
  { label: "Advanced (C1)",                value: 5 },
  { label: "Bilingual or Proficient (C2)", value: 6 },
];

function ProficiencyBar({ level }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          width: "28px", height: "8px", borderRadius: "2px",
          background: i < level ? "#00F5D4" : "rgba(255,255,255,0.15)",
        }} />
      ))}
    </div>
  );
}

// Months for the date picker
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// Generate a range of years — from current year back 10, forward 10
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => currentYear - 5 + i);
// e.g. 2021 to 2040 — covers past and future graduation years


export default function Profile() {
  const navigate = useNavigate();

  const [personalInfo, setPersonalInfo] = useState({
    firstName: "", lastName: "", jobTitle: "",
    city: "", phone: "", email: "", github: "", website: "",
  });
  const [skills, setSkills]         = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [experience, setExperience] = useState([]);
  const [education, setEducation]   = useState([]);
  const [projects, setProjects]     = useState([]);
  const [languages, setLanguages]   = useState([]);
  const [references, setReferences] = useState("Available upon Request");

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");


  // ── LOAD PROFILE ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get("/profile");
        const data = response.data;
        if (data && Object.keys(data).length > 0) {
          if (data.personalInfo) setPersonalInfo(data.personalInfo);
          if (data.skills)       setSkills(data.skills);
          if (data.experience)   setExperience(data.experience);
          if (data.education)    setEducation(data.education);
          if (data.projects)     setProjects(data.projects);
          if (data.languages)    setLanguages(data.languages);
          if (data.references !== undefined) setReferences(data.references);
        }
      } catch (err) {
        if (err.response?.status === 401) navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [navigate]);


  // ── PERSONAL INFO ────────────────────────────────────────────────────────────
  const handlePersonalChange = (field, value) => {
    setPersonalInfo((prev) => ({ ...prev, [field]: value }));
  };


  // ── SKILLS ──────────────────────────────────────────────────────────────────
  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills([...skills, trimmed]);
    setSkillInput("");
  };
  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddSkill(); }
  };
  const handleRemoveSkill = (index) => setSkills(skills.filter((_, i) => i !== index));


  // ── EXPERIENCE ──────────────────────────────────────────────────────────────
  const handleAddExperience = () => {
    setExperience([...experience, {
      title: "", company: "", city: "", country: "",
      startYear: "", endYear: "", bullets: [""],
    }]);
  };
  const handleExperienceChange = (index, field, value) => {
    setExperience(experience.map((job, i) => i === index ? { ...job, [field]: value } : job));
  };
  const handleBulletChange = (jobIndex, bulletIndex, value) => {
    setExperience(experience.map((job, i) => {
      if (i !== jobIndex) return job;
      return { ...job, bullets: job.bullets.map((b, bi) => bi === bulletIndex ? value : b) };
    }));
  };
  const handleAddBullet = (jobIndex) => {
    setExperience(experience.map((job, i) =>
      i === jobIndex ? { ...job, bullets: [...job.bullets, ""] } : job
    ));
  };
  const handleRemoveBullet = (jobIndex, bulletIndex) => {
    setExperience(experience.map((job, i) =>
      i === jobIndex
        ? { ...job, bullets: job.bullets.filter((_, bi) => bi !== bulletIndex) }
        : job
    ));
  };
  const handleRemoveExperience = (index) => setExperience(experience.filter((_, i) => i !== index));


  // ── EDUCATION ───────────────────────────────────────────────────────────────
  const handleAddEducation = () => {
    setEducation([...education, {
      degree: "", institution: "", city: "", country: "",
      graduationStatus: "graduated",
      // "graduated" = already finished | "expected" = still studying
      graduationMonth: "",
      graduationYear: "",
      minimumAverage: "",
      coursework: [""],
    }]);
  };
  const handleEducationChange = (index, field, value) => {
    setEducation(education.map((edu, i) => i === index ? { ...edu, [field]: value } : edu));
  };
  const handleCourseworkChange = (eduIndex, cwIndex, value) => {
    setEducation(education.map((edu, i) => {
      if (i !== eduIndex) return edu;
      return { ...edu, coursework: edu.coursework.map((c, ci) => ci === cwIndex ? value : c) };
    }));
  };
  const handleAddCoursework = (eduIndex) => {
    setEducation(education.map((edu, i) =>
      i === eduIndex ? { ...edu, coursework: [...edu.coursework, ""] } : edu
    ));
  };
  const handleRemoveCoursework = (eduIndex, cwIndex) => {
    setEducation(education.map((edu, i) =>
      i === eduIndex
        ? { ...edu, coursework: edu.coursework.filter((_, ci) => ci !== cwIndex) }
        : edu
    ));
  };
  const handleRemoveEducation = (index) => setEducation(education.filter((_, i) => i !== index));


  // ── PROJECTS ────────────────────────────────────────────────────────────────
  const handleAddProject = () => {
    setProjects([...projects, {
      name: "", technologies: "", bullets: [""],
      includeInCV: true,
      // includeInCV: true = show on generated CV | false = saved but excluded
    }]);
  };
  const handleProjectChange = (index, field, value) => {
    setProjects(projects.map((proj, i) => i === index ? { ...proj, [field]: value } : proj));
  };
  const handleProjectBulletChange = (projIndex, bulletIndex, value) => {
    setProjects(projects.map((proj, i) => {
      if (i !== projIndex) return proj;
      return { ...proj, bullets: proj.bullets.map((b, bi) => bi === bulletIndex ? value : b) };
    }));
  };
  const handleAddProjectBullet = (projIndex) => {
    setProjects(projects.map((proj, i) =>
      i === projIndex ? { ...proj, bullets: [...proj.bullets, ""] } : proj
    ));
  };
  const handleRemoveProjectBullet = (projIndex, bulletIndex) => {
    setProjects(projects.map((proj, i) =>
      i === projIndex
        ? { ...proj, bullets: proj.bullets.filter((_, bi) => bi !== bulletIndex) }
        : proj
    ));
  };
  const handleRemoveProject = (index) => setProjects(projects.filter((_, i) => i !== index));


  // ── LANGUAGES ───────────────────────────────────────────────────────────────
  const handleAddLanguage = () => setLanguages([...languages, { name: "", level: 3 }]);
  const handleLanguageChange = (index, field, value) => {
    setLanguages(languages.map((lang, i) => i === index ? { ...lang, [field]: value } : lang));
  };
  const handleRemoveLanguage = (index) => setLanguages(languages.filter((_, i) => i !== index));


  // ── SAVE ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError(""); setSuccess(""); setSaving(true);
    try {
      await api.post("/profile", {
        personalInfo, skills, experience,
        education, projects, languages, references,
      });
      setSuccess("Profile saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };


  
  {/* ── LOADING SKELETON ─────────────────────────────────────────────────────
      Shown while the GET /api/profile request is in flight.
      Mirrors the section structure of the real profile page so there's
      no layout jump when content loads in.
  ────────────────────────────────────────────────────────────────────────── */}
  {loading && (
    <DashboardLayout>
      <div style={{ maxWidth: "min(800px, 100%)", margin: "0 auto", paddingBottom: "clamp(40px, 6vw, 80px)" }}>

        {/* Page title skeleton */}
        <div style={{
          width: "200px", height: "36px",
          background: "#003B44", borderRadius: "8px",
          marginBottom: "32px",
          opacity: 0.6,
        }} />

        {/* Section blocks — mimics Personal Info + Skills + Experience */}
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background:    "#003B44",
            borderRadius:  "12px",
            padding:       "28px",
            marginBottom:  "20px",
            border:        "1px solid rgba(0,245,212,0.08)",
          }}>
            {/* Section header */}
            <div style={{
              width: "140px", height: "14px",
              background: "rgba(0,245,212,0.15)",
              borderRadius: "4px",
              marginBottom: "20px",
            }} />
            {/* Field rows */}
            {[1, 2, 3].map(j => (
              <div key={j} style={{
                width: `${70 + j * 8}%`, height: "40px",
                background: "#0B1E2A",
                borderRadius: "8px",
                marginBottom: "12px",
                opacity: 0.5,
              }} />
            ))}
          </div>
        ))}

      </div>
    </DashboardLayout>
  )}

  {/* ── LOADED STATE — wrap your existing Profile JSX in this guard ────────── */}
  {!loading && (
    // ... existing Profile JSX goes here (the DashboardLayout wrapper + all sections)
    null
  )}

  // ── DASHED ADD BUTTON — reusable style ──────────────────────────────────────
  const addBtnStyle = {
    background: "transparent",
    border: "2px dashed rgba(0,245,212,0.3)",
    color: "#00F5D4",
    borderRadius: "10px",
    padding: "14px",
    cursor: "pointer",
    fontSize: "14px",
    fontFamily: "'Bodoni MT Black', serif",
    width: "100%",
    transition: "border-color 0.2s ease",
  };

  const removeBtnStyle = {
    position: "absolute", top: "14px", right: "14px",
    background: "transparent",
    border: "1px solid rgba(255,107,107,0.3)",
    color: "#FF6B6B", borderRadius: "6px",
    padding: "3px 8px", cursor: "pointer",
    fontSize: "12px", fontFamily: "'Bodoni MT Black', serif",
  };

  const cardInnerStyle = {
    background: "#0B1E2A", borderRadius: "10px", padding: "20px",
    marginBottom: "16px", border: "1px solid rgba(0,245,212,0.1)",
    position: "relative",
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(1000px, 100%)", margin: "0 auto" }}>

        {/* ── Page Header ─────────────────────────────── */}
        <h1 style={{
          fontFamily: "'Train One', cursive", fontSize: "clamp(20px, 4vw, 32px)",
          color: "#00F5D4", letterSpacing: "2px", marginBottom: "6px",
        }}>
          CV Profile
        </h1>
        <p style={{ color: "#E0FFFF", opacity: 0.5, fontSize: "14px", marginBottom: "32px" }}>
          Your base CV data. The AI uses this to generate tailored CVs for each job.
        </p>


        {/* ══ SECTION 1 — PERSONAL INFO ═══════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="👤 Personal Information" />

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>First Name</label>
              <input style={inputStyle} value={personalInfo.firstName}
                onChange={(e) => handlePersonalChange("firstName", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Last Name</label>
              <input style={inputStyle} value={personalInfo.lastName}
                onChange={(e) => handlePersonalChange("lastName", e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Job Title</label>
            <input style={inputStyle} value={personalInfo.jobTitle}
              onChange={(e) => handlePersonalChange("jobTitle", e.target.value)} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={personalInfo.city}
                onChange={(e) => handlePersonalChange("city", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={personalInfo.phone}
                onChange={(e) => handlePersonalChange("phone", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={personalInfo.email}
                onChange={(e) => handlePersonalChange("email", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>GitHub URL</label>
              <input style={inputStyle} value={personalInfo.github}
                onChange={(e) => handlePersonalChange("github", e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Portfolio / Website (optional)</label>
            <input style={inputStyle} value={personalInfo.website}
              onChange={(e) => handlePersonalChange("website", e.target.value)} />
          </div>
        </div>


        {/* ══ SECTION 2 — SKILLS ══════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="🛠 Skills" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            <input style={{ ...inputStyle, marginBottom: 0 }} value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown} />
            <button className="primary-btn" onClick={handleAddSkill}
              style={{ whiteSpace: "nowrap", padding: "11px 20px", fontSize: "14px" }}>
              + Add
            </button>
          </div>
          {skills.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {skills.map((skill, index) => (
                <span key={index} style={{
                  background: "rgba(0,245,212,0.1)", border: "1px solid rgba(0,245,212,0.3)",
                  color: "#00F5D4", padding: "6px 12px", borderRadius: "20px",
                  fontSize: "13px", fontFamily: "'Bodoni MT Black', serif",
                  display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
                }}>
                  {skill}
                  <button onClick={() => handleRemoveSkill(index)} style={{
                    background: "transparent", border: "none", color: "#00F5D4",
                    cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, opacity: 0.7,
                  }}>×</button>
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: "#E0FFFF", opacity: 0.3, fontSize: "13px" }}>
              No skills added yet. Type above and press Enter.
            </p>
          )}
        </div>


        {/* ══ SECTION 3 — EXPERIENCE ══════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="💼 Experience" />
          {experience.length === 0 && (
            <p style={{ color: "#E0FFFF", opacity: 0.3, fontSize: "13px", marginBottom: "16px" }}>
              No experience added yet.
            </p>
          )}
          {experience.map((job, index) => (
            <div key={index} style={cardInnerStyle}>
              <button onClick={() => handleRemoveExperience(index)} style={removeBtnStyle}>Remove</button>
              <p style={{ color: "#00F5D4", fontSize: "11px", letterSpacing: "1px",
                textTransform: "uppercase", marginBottom: "14px",
                fontFamily: "'Bodoni MT Black', serif", opacity: 0.6 }}>
                Position {index + 1}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>Job Title</label>
                  <input style={inputStyle} value={job.title}
                    onChange={(e) => handleExperienceChange(index, "title", e.target.value)} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>Company</label>
                  <input style={inputStyle} value={job.company}
                    onChange={(e) => handleExperienceChange(index, "company", e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} value={job.city}
                    onChange={(e) => handleExperienceChange(index, "city", e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Country</label>
                  <input style={inputStyle} value={job.country}
                    onChange={(e) => handleExperienceChange(index, "country", e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Start Year</label>
                  <input style={inputStyle} value={job.startYear}
                    onChange={(e) => handleExperienceChange(index, "startYear", e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>End Year</label>
                  <input style={inputStyle} value={job.endYear}
                    onChange={(e) => handleExperienceChange(index, "endYear", e.target.value)} />
                </div>
              </div>
              <label style={{ ...labelStyle, marginBottom: "10px" }}>Key Responsibilities / Achievements</label>
              {job.bullets.map((bullet, bIndex) => (
                <div key={bIndex} style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ color: "#00F5D4", fontSize: "12px", flexShrink: 0 }}>→</span>
                  <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={bullet}
                    onChange={(e) => handleBulletChange(index, bIndex, e.target.value)} />
                  {job.bullets.length > 1 && (
                    <button onClick={() => handleRemoveBullet(index, bIndex)} style={{
                      background: "transparent", border: "none", color: "#FF6B6B",
                      cursor: "pointer", fontSize: "18px", lineHeight: 1, flexShrink: 0, opacity: 0.7,
                    }}>×</button>
                  )}
                </div>
              ))}
              <button onClick={() => handleAddBullet(index)} style={{
                background: "transparent", border: "1px dashed rgba(0,245,212,0.3)",
                color: "#00F5D4", borderRadius: "6px", padding: "6px 14px",
                cursor: "pointer", fontSize: "12px", fontFamily: "'Bodoni MT Black', serif",
                marginTop: "4px", width: "100%",
              }}>+ Add bullet point</button>
            </div>
          ))}
          <button onClick={handleAddExperience} style={addBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#00F5D4"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(0,245,212,0.3)"}
          >+ Add Experience</button>
        </div>


        {/* ══ SECTION 4 — EDUCATION ═══════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="🎓 Education" />
          {education.length === 0 && (
            <p style={{ color: "#E0FFFF", opacity: 0.3, fontSize: "13px", marginBottom: "16px" }}>
              No education added yet.
            </p>
          )}
          {education.map((edu, index) => (
            <div key={index} style={cardInnerStyle}>
              <button onClick={() => handleRemoveEducation(index)} style={removeBtnStyle}>Remove</button>

              <p style={{ color: "#00F5D4", fontSize: "11px", letterSpacing: "1px",
                textTransform: "uppercase", marginBottom: "14px",
                fontFamily: "'Bodoni MT Black', serif", opacity: 0.6 }}>
                Qualification {index + 1}
              </p>

              {/* Degree */}
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Degree / Qualification</label>
                <input style={inputStyle} value={edu.degree}
                  onChange={(e) => handleEducationChange(index, "degree", e.target.value)} />
              </div>

              {/* Institution */}
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Institution</label>
                <input style={inputStyle} value={edu.institution}
                  onChange={(e) => handleEducationChange(index, "institution", e.target.value)} />
              </div>

              {/* City + Country */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} value={edu.city}
                    onChange={(e) => handleEducationChange(index, "city", e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Country</label>
                  <input style={inputStyle} value={edu.country}
                    onChange={(e) => handleEducationChange(index, "country", e.target.value)} />
                </div>
              </div>

              {/* ── Graduation Status Toggle ─────────────────────────
                  Two buttons: "Graduated" and "Expected to Graduate"
                  Selecting one sets edu.graduationStatus.
              ──────────────────────────────────────────────────── */}
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Graduation Status</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {["graduated", "expected"].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleEducationChange(index, "graduationStatus", status)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: edu.graduationStatus === status
                          ? "2px solid #00F5D4"
                          : "2px solid rgba(0,245,212,0.2)",
                        background: edu.graduationStatus === status
                          ? "rgba(0,245,212,0.15)"
                          : "transparent",
                        color: edu.graduationStatus === status ? "#00F5D4" : "#E0FFFF",
                        cursor: "pointer",
                        fontFamily: "'Bodoni MT Black', serif",
                        fontSize: "13px",
                        opacity: edu.graduationStatus === status ? 1 : 0.5,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {status === "graduated" ? "✓ Graduated" : "⏳ Expected to Graduate"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Month + Year Picker ──────────────────────────────
                  Two dropdowns: month and year.
                  Label changes based on graduation status.
              ──────────────────────────────────────────────────── */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>
                  {edu.graduationStatus === "expected"
                    ? "Expected Graduation Month & Year"
                    : "Graduation Month & Year"}
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  <select
                    value={edu.graduationMonth || ""}
                    onChange={(e) => handleEducationChange(index, "graduationMonth", e.target.value)}
                    style={{ ...inputStyle, flex: 2, cursor: "pointer" }}
                  >
                    <option value="">Month</option>
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  <select
                    value={edu.graduationYear || ""}
                    onChange={(e) => handleEducationChange(index, "graduationYear", e.target.value)}
                    style={{ ...inputStyle, flex: 1, cursor: "pointer" }}
                  >
                    <option value="">Year</option>
                    {YEARS.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Minimum Average ──────────────────────────────────
                  e.g. "70%" — appears as a coursework bullet on your CV.
              ──────────────────────────────────────────────────── */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Minimum Average (optional)</label>
                <input
                  style={inputStyle}
                  value={edu.minimumAverage || ""}
                  onChange={(e) => handleEducationChange(index, "minimumAverage", e.target.value)}
                />
                <p style={{ color: "#E0FFFF", fontSize: "11px", opacity: 0.3, marginTop: "5px" }}>
                  e.g. 70% — will appear as an achievement bullet on your CV
                </p>
              </div>

              {/* Coursework */}
              <label style={{ ...labelStyle, marginBottom: "10px" }}>
                Relevant Coursework / Achievements
              </label>
              {edu.coursework.map((item, cwIndex) => (
                <div key={cwIndex} style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ color: "#00F5D4", fontSize: "12px", flexShrink: 0 }}>•</span>
                  <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={item}
                    onChange={(e) => handleCourseworkChange(index, cwIndex, e.target.value)} />
                  {edu.coursework.length > 1 && (
                    <button onClick={() => handleRemoveCoursework(index, cwIndex)} style={{
                      background: "transparent", border: "none", color: "#FF6B6B",
                      cursor: "pointer", fontSize: "18px", lineHeight: 1, flexShrink: 0, opacity: 0.7,
                    }}>×</button>
                  )}
                </div>
              ))}
              <button onClick={() => handleAddCoursework(index)} style={{
                background: "transparent", border: "1px dashed rgba(0,245,212,0.3)",
                color: "#00F5D4", borderRadius: "6px", padding: "6px 14px",
                cursor: "pointer", fontSize: "12px", fontFamily: "'Bodoni MT Black', serif",
                marginTop: "4px", width: "100%",
              }}>+ Add coursework item</button>
            </div>
          ))}
          <button onClick={handleAddEducation} style={addBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#00F5D4"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(0,245,212,0.3)"}
          >+ Add Education</button>
        </div>


        {/* ══ SECTION 5 — PROJECTS ════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="🚀 Project Experience" />
          <p style={{ color: "#E0FFFF", opacity: 0.4, fontSize: "12px", marginBottom: "16px" }}>
            Each project can be toggled on/off — only projects marked "Include in CV" will appear on your generated CV.
          </p>
          {projects.length === 0 && (
            <p style={{ color: "#E0FFFF", opacity: 0.3, fontSize: "13px", marginBottom: "16px" }}>
              No projects added yet.
            </p>
          )}
          {projects.map((proj, index) => (
            <div key={index} style={{
              ...cardInnerStyle,
              // Dim the card slightly if the project is excluded
              opacity: proj.includeInCV === false ? 0.55 : 1,
              transition: "opacity 0.2s ease",
            }}>
              <button onClick={() => handleRemoveProject(index)} style={removeBtnStyle}>Remove</button>

              {/* ── Include in CV toggle ──────────────────────────── */}
              <div style={{
                display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px",
                marginBottom: "16px",
              }}>
                <div
                  onClick={() => handleProjectChange(index, "includeInCV", !proj.includeInCV)}
                  style={{
                    width: "42px", height: "24px", borderRadius: "12px",
                    background: proj.includeInCV !== false ? "#00F5D4" : "rgba(255,255,255,0.15)",
                    position: "relative", cursor: "pointer",
                    transition: "background 0.25s ease", flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: "absolute",
                    top: "3px",
                    left: proj.includeInCV !== false ? "21px" : "3px",
                    // Toggle knob slides right when on, left when off.
                    width: "18px", height: "18px", borderRadius: "50%",
                    background: "#0B1E2A",
                    transition: "left 0.25s ease",
                  }} />
                </div>
                <span style={{
                  color: proj.includeInCV !== false ? "#00F5D4" : "#E0FFFF",
                  fontSize: "13px", fontFamily: "'Bodoni MT Black', serif",
                  opacity: proj.includeInCV !== false ? 1 : 0.45,
                }}>
                  {proj.includeInCV !== false ? "Included in CV" : "Excluded from CV"}
                </span>
              </div>

              {/* Project Name */}
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Project Name</label>
                <input style={inputStyle} value={proj.name}
                  onChange={(e) => handleProjectChange(index, "name", e.target.value)} />
              </div>

              {/* Technologies */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Technologies Used</label>
                <input style={inputStyle} value={proj.technologies}
                  onChange={(e) => handleProjectChange(index, "technologies", e.target.value)} />
                <p style={{ color: "#E0FFFF", fontSize: "11px", opacity: 0.3, marginTop: "5px" }}>
                  Comma-separated — appears as italic text under the project name on your CV
                </p>
              </div>

              {/* Bullets */}
              <label style={{ ...labelStyle, marginBottom: "10px" }}>Project Descriptions</label>
              {proj.bullets.map((bullet, bIndex) => (
                <div key={bIndex} style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ color: "#00F5D4", fontSize: "12px", flexShrink: 0 }}>→</span>
                  <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={bullet}
                    onChange={(e) => handleProjectBulletChange(index, bIndex, e.target.value)} />
                  {proj.bullets.length > 1 && (
                    <button onClick={() => handleRemoveProjectBullet(index, bIndex)} style={{
                      background: "transparent", border: "none", color: "#FF6B6B",
                      cursor: "pointer", fontSize: "18px", lineHeight: 1, flexShrink: 0, opacity: 0.7,
                    }}>×</button>
                  )}
                </div>
              ))}
              <button onClick={() => handleAddProjectBullet(index)} style={{
                background: "transparent", border: "1px dashed rgba(0,245,212,0.3)",
                color: "#00F5D4", borderRadius: "6px", padding: "6px 14px",
                cursor: "pointer", fontSize: "12px", fontFamily: "'Bodoni MT Black', serif",
                marginTop: "4px", width: "100%",
              }}>+ Add bullet point</button>
            </div>
          ))}
          <button onClick={handleAddProject} style={addBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#00F5D4"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(0,245,212,0.3)"}
          >+ Add Project</button>
        </div>


        {/* ══ SECTION 6 — LANGUAGES ═══════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="🌐 Languages" />
          {languages.length === 0 && (
            <p style={{ color: "#E0FFFF", opacity: 0.3, fontSize: "13px", marginBottom: "16px" }}>
              No languages added yet.
            </p>
          )}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px", marginBottom: "16px",
          }}>
            {languages.map((lang, index) => (
              <div key={index} style={{ ...cardInnerStyle, marginBottom: 0 }}>
                <button onClick={() => handleRemoveLanguage(index)} style={{
                  position: "absolute", top: "10px", right: "10px",
                  background: "transparent", border: "none", color: "#FF6B6B",
                  cursor: "pointer", fontSize: "16px", lineHeight: 1, opacity: 0.7,
                }}>×</button>
                <div style={{ marginBottom: "10px" }}>
                  <label style={labelStyle}>Language</label>
                  <input style={{ ...inputStyle, marginBottom: 0 }} value={lang.name}
                    onChange={(e) => handleLanguageChange(index, "name", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Proficiency Level</label>
                  <select value={lang.level}
                    onChange={(e) => handleLanguageChange(index, "level", Number(e.target.value))}
                    style={{ ...inputStyle, marginBottom: "10px", cursor: "pointer" }}>
                    {PROFICIENCY_LEVELS.map((lvl) => (
                      <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                    ))}
                  </select>
                  <ProficiencyBar level={lang.level} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleAddLanguage} style={addBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#00F5D4"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(0,245,212,0.3)"}
          >+ Add Language</button>
        </div>


        {/* ══ SECTION 7 — REFERENCES ══════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="📋 References" />
          <p style={{ color: "#E0FFFF", fontSize: "13px", opacity: 0.55, marginBottom: "12px" }}>
            This appears at the bottom of your CV.
          </p>
          <textarea value={references} onChange={(e) => setReferences(e.target.value)} rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6", fontFamily: "system-ui, sans-serif" }} />
          {references !== "Available upon Request" && (
            <button onClick={() => setReferences("Available upon Request")} style={{
              background: "transparent", border: "none", color: "#00F5D4",
              cursor: "pointer", fontSize: "12px", fontFamily: "'Bodoni MT Black', serif",
              marginTop: "6px", opacity: 0.6, textDecoration: "underline",
            }}>
              Reset to "Available upon Request"
            </button>
          )}
        </div>


        {/* ── Feedback ──── */}
        {error && <p style={{ color: "#FF6B6B", fontSize: "14px", marginBottom: "12px" }}>⚠ {error}</p>}
        {success && <p style={{ color: "#00F5D4", fontSize: "14px", marginBottom: "12px" }}>✓ {success}</p>}

        {/* ── Save Button ── */}
        <div style={{ paddingBottom: "40px" }}>
          <button className="primary-btn" onClick={handleSave} disabled={saving}
            style={{ fontSize: "16px", padding: "14px 48px", opacity: saving ? 0.65 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "💾 Save Profile"}
          </button>
        </div>

      </div>
    </DashboardLayout>
  );
}

