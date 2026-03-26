// =============================================================================
// FILE: frontend/src/pages/Profile.jsx
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  background: "#FFFFFF",
  border: "1px solid rgba(45,90,61,0.2)",
  borderRadius: "8px",
  color: "#1E2018",
  fontSize: "14px",
  fontFamily: "system-ui, sans-serif",
  outline: "none",
  marginBottom: "0",
};

const labelStyle = {
  color: "#1E2018",
  fontSize: "12px",
  opacity: 0.55,
  marginBottom: "6px",
  display: "block",
  fontFamily: "'Libre Baskerville', serif",
  letterSpacing: "0.5px",
};

const addBtnStyle = {
  background: "transparent",
  border: "2px dashed rgba(45,90,61,0.3)",
  color: "#2D5A3D",
  borderRadius: "10px",
  padding: "14px",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "'Libre Baskerville', serif",
  width: "100%",
  transition: "border-color 0.2s ease",
};

const removeBtnStyle = {
  position: "absolute", top: "14px", right: "14px",
  background: "transparent",
  border: "1px solid rgba(255,107,107,0.3)",
  color: "#8B2020", borderRadius: "6px",
  padding: "3px 8px", cursor: "pointer",
  fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
};

const cardInnerStyle = {
  background: "#FFFFFF", borderRadius: "10px", padding: "20px",
  marginBottom: "16px", border: "1px solid rgba(45,90,61,0.1)",
  position: "relative",
};

function SectionHeader({ title }) {
  return (
    <h2 style={{
      color: "#2D5A3D",
      fontFamily: "'Libre Baskerville', serif",
      fontSize: "13px",
      letterSpacing: "2px",
      textTransform: "uppercase",
      marginBottom: "20px",
      paddingBottom: "10px",
      borderBottom: "1px solid rgba(45,90,61,0.15)",
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
          background: i < level ? "#2D5A3D" : "rgba(255,255,255,0.15)",
        }} />
      ))}
    </div>
  );
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => currentYear - 5 + i);


export default function Profile() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(null);
  const [editingProject, setEditingProject] = useState(null);

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

  // ── CV IMPORT MODAL STATE ─────────────────────────────────────────────────
  const [showImport, setShowImport]         = useState(false);
  const [importTab, setImportTab]           = useState("text"); // "text" | "file" | "image" | "html"
  const [importText, setImportText]         = useState("");
  const [importFile, setImportFile]         = useState(null);
  const [importImage, setImportImage]       = useState(null);
  const [importImagePreview, setImportImagePreview] = useState(null);
  const [importHtmlFile, setImportHtmlFile] = useState(null);
  const [importHtmlName, setImportHtmlName] = useState("");
  const [importing, setImporting]           = useState(false);
  const [importError, setImportError]       = useState("");
  const [importPreview, setImportPreview]   = useState(null); // parsed result before applying
  const [importJsonFile, setImportJsonFile] = useState(null);
  const [importJsonName, setImportJsonName] = useState("");


  // ── LOAD PROFILE ──────────────────────────────────────────────────────────
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


  // ── PERSONAL INFO ─────────────────────────────────────────────────────────
  const handlePersonalChange = (field, value) => {
    setPersonalInfo((prev) => ({ ...prev, [field]: value }));
  };


  // ── SKILLS ────────────────────────────────────────────────────────────────
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


  // ── EXPERIENCE ────────────────────────────────────────────────────────────
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


  // ── EDUCATION ─────────────────────────────────────────────────────────────
  const handleAddEducation = () => {
    setEducation([...education, {
      degree: "", institution: "", city: "", country: "",
      graduationStatus: "graduated",
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


  // ── PROJECTS ──────────────────────────────────────────────────────────────
  const handleAddProject = () => {
    setProjects(prev => {
      const newIndex = prev.length;
      setEditingProject(newIndex);
      return [...prev, { name: "", technologies: "", bullets: [""], urls: [""], includeInCV: true }];
    });
  };

  // ── PROJECT URL HELPERS ───────────────────────────────────────────────────
  const handleProjectUrlChange = (projIndex, urlIndex, value) => {
    setProjects(projects.map((proj, i) => {
      if (i !== projIndex) return proj;
      const urls = [...(proj.urls || [])];
      urls[urlIndex] = value;
      return { ...proj, urls };
    }));
  };
  const handleAddProjectUrl = (projIndex) => {
    setProjects(projects.map((proj, i) =>
      i === projIndex ? { ...proj, urls: [...(proj.urls || []), ""] } : proj
    ));
  };
  const handleRemoveProjectUrl = (projIndex, urlIndex) => {
    setProjects(projects.map((proj, i) => {
      if (i !== projIndex) return proj;
      const urls = (proj.urls || []).filter((_, ui) => ui !== urlIndex);
      return { ...proj, urls: urls.length ? urls : [""] };
    }));
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
  const handleRemoveProject = (index) => {
    setProjects(projects.filter((_, i) => i !== index));
    setEditingProject(null);
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  const handleCopyAll = (proj) => {
    const all = proj.bullets.filter(b => b.trim()).map((b, i) => `${i + 1}. ${b}`).join("\n\n");
    const urlLines = (proj.urls || (proj.url ? [proj.url] : []))
      .filter(u => u && u.trim()).join("\n");
    const urlSection = urlLines ? `\n${urlLines}` : "";
    navigator.clipboard.writeText(`${proj.name}\n${proj.technologies}${urlSection}\n\n${all}`);
    setCopied(`${proj.name}-all`);
    setTimeout(() => setCopied(null), 1800);
  };
 


  // ── LANGUAGES ─────────────────────────────────────────────────────────────
  const handleAddLanguage = () => setLanguages([...languages, { name: "", level: 3 }]);
  const handleLanguageChange = (index, field, value) => {
    setLanguages(languages.map((lang, i) => i === index ? { ...lang, [field]: value } : lang));
  };
  const handleRemoveLanguage = (index) => setLanguages(languages.filter((_, i) => i !== index));


  // ── CV IMPORT HANDLER ─────────────────────────────────────────────────────
  const handleImport = async () => {
    setImportError("");
    setImporting(true);
    setImportPreview(null);

    try {
      // ── Build cvText directly — no intermediate messages object needed ──
      // Everything goes to our Flask /api/parse-cv endpoint as plain text.
      let cvText = "";

      if (importTab === "text") {
        if (!importText.trim()) {
          setImportError("Please paste your CV text first.");
          setImporting(false);
          return;
        }
        cvText = importText.trim();

      } else if (importTab === "file") {
        if (!importFile) {
          setImportError("Please select a file first.");
          setImporting(false);
          return;
        }
        // For PDF/Word: read as text (best effort — works well for text-based PDFs)
        cvText = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result || "");
          reader.onerror = () => rej(new Error("File read failed"));
          reader.readAsText(importFile);
        });
        cvText = cvText.replace(/\s{2,}/g, " ").trim().slice(0, 15000);

      } else if (importTab === "html") {
        if (!importHtmlFile) {
          setImportError("Please select an HTML file first.");
          setImporting(false);
          return;
        }
        const htmlRaw = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result || "");
          reader.onerror = () => rej(new Error("File read failed"));
          reader.readAsText(importHtmlFile);
        });

        // Strip all tags → plain readable text
        cvText = htmlRaw
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<svg[\s\S]*?<\/svg>/gi, "")
          .replace(/<head[\s\S]*?<\/head>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/\s{2,}/g, " ").trim()
          .slice(0, 10000);

        // Add a note to GPT that input/select values may be missing (saved React page)
        if (htmlRaw.includes("id=\"root\"") || htmlRaw.includes("type=\"module\"")) {
          cvText = `NOTE: This is a saved webpage from the FrontendJobs profile page. Input field values (name, company, job title, dates) may be missing from the HTML because they are held in React state. Extract what you can — skills, project names, bullet points, URLs are visible. Leave missing fields as empty strings.\n\n` + cvText;
        }

        if (!cvText || cvText.length < 200) {
          setImportError("This HTML file appears empty after parsing. Try using the Paste Text tab instead.");
          setImporting(false);
          return;
        }

      } else if (importTab === "image") {
        if (!importImage) {
          setImportError("Please select an image first.");
          setImporting(false);
          return;
        }
        // Images are sent as base64 — backend handles via GPT-4o vision
        const base64Data = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result); // keep full data URL
          reader.onerror = () => rej(new Error("Image read failed"));
          reader.readAsDataURL(importImage);
        });
        cvText = `__IMAGE__${base64Data}`;
      }

      const apiResponse = await api.post("/parse-cv", { cv_text: cvText });

      if (apiResponse.data.error) {
        setImportError("Parse error: " + apiResponse.data.error);
        return;
      }

      const parsed = apiResponse.data.profile;
      if (!parsed || typeof parsed !== "object") {
        setImportError("Unexpected response from server. Please try again.");
        return;
      }

      setImportPreview(parsed);

    } catch (err) {
      console.error("Import error:", err);
      setImportError("Error: " + (err.message || "Unknown error. Check browser console."));
    } finally {
      setImporting(false);
    }
  };

  const handleApplyImport = () => {
    if (!importPreview) return;
    if (importPreview.personalInfo) setPersonalInfo(importPreview.personalInfo);
    if (importPreview.skills?.length)     setSkills(importPreview.skills);
    if (importPreview.experience?.length) setExperience(importPreview.experience);
    if (importPreview.education?.length)  setEducation(importPreview.education);
    if (importPreview.projects?.length)   setProjects(importPreview.projects);
    if (importPreview.languages?.length)  setLanguages(importPreview.languages);
    if (importPreview.references)         setReferences(importPreview.references);
    setShowImport(false);
    setImportPreview(null);
    setImportText("");
    setImportFile(null);
    setImportImage(null);
    setImportImagePreview(null);
    setImportHtmlFile(null);
    setImportHtmlName("");
    setImportJsonFile(null);
    setImportJsonName("");
    setSuccess("CV imported! Review the fields below and hit Save Profile.");
    setTimeout(() => setSuccess(""), 5000);
  };



  // ── EXPORT PROFILE AS JSON ────────────────────────────────────────────────
  const handleExportProfile = () => {
    const profileData = {
      personalInfo, skills, experience,
      education, projects, languages, references,
    };
    const blob = new Blob([JSON.stringify(profileData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = [personalInfo.firstName, personalInfo.lastName].filter(Boolean).join("_") || "profile";
    a.download = `frontendjobs_${name}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── RESTORE FROM JSON BACKUP ──────────────────────────────────────────────
  const handleJsonRestore = async () => {
    if (!importJsonFile) {
      setImportError("Please select a JSON backup file first.");
      return;
    }
    setImportError("");
    try {
      const text = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result || "");
        reader.onerror = () => rej(new Error("File read failed"));
        reader.readAsText(importJsonFile);
      });
      const parsed = JSON.parse(text);
      // Validate it looks like a profile backup
      if (!parsed.personalInfo && !parsed.skills && !parsed.experience) {
        setImportError("This doesn't look like a FrontendJobs profile backup. Please use a file exported from this app.");
        return;
      }
      setImportPreview(parsed);
    } catch (e) {
      setImportError("Could not read this file — make sure it's a valid JSON backup from FrontendJobs.");
    }
  };

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


  // ── LOADING SKELETON ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ maxWidth: "min(800px, 100%)", margin: "0 auto", paddingBottom: "60px" }}>
          <div style={{ width: "200px", height: "36px", background: "#F0EAD8", borderRadius: "8px", marginBottom: "32px", opacity: 0.6 }} />
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: "#F0EAD8", borderRadius: "12px", padding: "28px", marginBottom: "20px", border: "1px solid rgba(45,90,61,0.08)" }}>
              <div style={{ width: "140px", height: "14px", background: "rgba(45,90,61,0.15)", borderRadius: "4px", marginBottom: "20px" }} />
              {[1, 2, 3].map(j => (
                <div key={j} style={{ width: `${70 + j * 8}%`, height: "40px", background: "#FFFFFF", borderRadius: "8px", marginBottom: "12px", opacity: 0.5 }} />
              ))}
            </div>
          ))}
        </div>
      </DashboardLayout>
    );
  }


  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div style={{ maxWidth: "min(1000px, 100%)", margin: "0 auto" }}>

        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "32px" }}>
          <div>
            <h1 style={{
              fontFamily: "'Libre Baskerville', serif", fontSize: "clamp(20px, 4vw, 32px)",
              color: "#2D5A3D", letterSpacing: "2px", marginBottom: "6px",
            }}>
              CV Profile
            </h1>
            <p style={{ color: "#1E2018", opacity: 0.5, fontSize: "14px" }}>
              Your base CV data. The AI uses this to generate tailored CVs for each job.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={handleExportProfile}
              style={{
                background: "transparent", border: "1px solid rgba(45,90,61,0.35)",
                color: "#2D5A3D", borderRadius: "10px", padding: "12px 18px",
                cursor: "pointer", fontSize: "14px", fontFamily: "'Libre Baskerville', serif",
                fontWeight: 900, display: "flex", alignItems: "center", gap: "8px",
                whiteSpace: "nowrap",
              }}
              title="Download your profile as a JSON backup — restore instantly without AI"
            >
              💾 Backup Profile
            </button>
            <button
              onClick={() => { setShowImport(true); setImportError(""); setImportPreview(null); }}
              style={{
                background: "rgba(45,90,61,0.1)", border: "1px solid rgba(45,90,61,0.35)",
                color: "#2D5A3D", borderRadius: "10px", padding: "12px 22px",
                cursor: "pointer", fontSize: "14px", fontFamily: "'Libre Baskerville', serif",
                fontWeight: 900, display: "flex", alignItems: "center", gap: "8px",
                whiteSpace: "nowrap",
              }}
            >
              ⚡ Import File to Complete Profile
            </button>
          </div>
        </div>


        {/* ══ CV IMPORT MODAL ══════════════════════════════════════════════════ */}
        {showImport && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(11,30,42,0.75)",
            zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowImport(false); }}
          >
            <div style={{
              background: "#F5F0E8", borderRadius: "16px", width: "100%", maxWidth: "640px",
              maxHeight: "90vh", overflowY: "auto", padding: "32px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}>

              {/* Modal header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h2 style={{ color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif", fontSize: "20px", margin: 0 }}>
                  ⚡ Import from CV
                </h2>
                <button onClick={() => setShowImport(false)} style={{
                  background: "transparent", border: "none", fontSize: "22px",
                  cursor: "pointer", color: "#1E2018", opacity: 0.4, lineHeight: 1,
                }}>×</button>
              </div>
              <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.5, marginBottom: "24px" }}>
                AI will parse your CV and populate all profile fields automatically. Review before applying.
              </p>

              {/* Tabs */}
              {!importPreview && (
                <>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                    {[
                      { id: "text",  label: "📋 Paste Text" },
                      { id: "file",  label: "📄 PDF / Word" },
                      { id: "image", label: "🖼 Screenshot" },
                      { id: "html",  label: "🌐 HTML File" },
                      { id: "json",  label: "💾 JSON Backup" },
                    ].map(tab => (
                      <button key={tab.id} onClick={() => { setImportTab(tab.id); setImportError(""); }}
                        style={{
                          flex: 1, padding: "10px 8px", borderRadius: "8px", cursor: "pointer",
                          fontFamily: "'Libre Baskerville', serif", fontSize: "12px",
                          border: importTab === tab.id ? "2px solid #2D5A3D" : "2px solid rgba(45,90,61,0.2)",
                          background: importTab === tab.id ? "rgba(45,90,61,0.12)" : "transparent",
                          color: importTab === tab.id ? "#2D5A3D" : "#1E2018",
                          opacity: importTab === tab.id ? 1 : 0.55,
                          transition: "all 0.15s ease",
                        }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* TAB: Paste text */}
                  {importTab === "text" && (
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Paste your full CV here — name, experience, education, skills, projects..."
                      rows={12}
                      style={{
                        width: "100%", background: "#FFFFFF",
                        border: "1px solid rgba(45,90,61,0.2)", borderRadius: "8px",
                        color: "#1E2018", padding: "14px", fontSize: "13px",
                        lineHeight: "1.6", resize: "vertical",
                        fontFamily: "system-ui, sans-serif", marginBottom: "16px",
                        outline: "none",
                      }}
                    />
                  )}

                  {/* TAB: PDF / Word file */}
                  {importTab === "file" && (
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", gap: "10px", padding: "32px",
                        border: "2px dashed rgba(45,90,61,0.3)", borderRadius: "10px",
                        cursor: "pointer", background: importFile ? "rgba(45,90,61,0.06)" : "#FFFFFF",
                        transition: "all 0.2s ease",
                      }}>
                        <span style={{ fontSize: "32px" }}>{importFile ? "📄" : "⬆"}</span>
                        <span style={{ color: "#1E2018", fontSize: "13px", opacity: 0.6, fontFamily: "'Libre Baskerville', serif" }}>
                          {importFile ? importFile.name : "Click to upload PDF or Word (.docx)"}
                        </span>
                        {importFile && (
                          <span style={{ color: "#2D5A3D", fontSize: "12px", opacity: 0.7 }}>
                            {(importFile.size / 1024).toFixed(0)} KB
                          </span>
                        )}
                        <input type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
                          onChange={(e) => { setImportFile(e.target.files[0] || null); setImportError(""); }} />
                      </label>
                      {importFile && (
                        <button onClick={() => setImportFile(null)} style={{
                          background: "transparent", border: "none", color: "#8B2020",
                          cursor: "pointer", fontSize: "12px", marginTop: "8px",
                          fontFamily: "'Libre Baskerville', serif", textDecoration: "underline",
                        }}>Remove file</button>
                      )}
                    </div>
                  )}

                  {/* TAB: HTML file */}
                  {importTab === "html" && (
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ color: "#1E2018", fontSize: "12px", opacity: 0.5, marginBottom: "12px", fontFamily: "'Libre Baskerville', serif" }}>
                        Upload any CV-style HTML file — a saved webpage, an exported CV, or a profile page. AI will read the content and extract your info.
                      </p>
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", gap: "10px", padding: "32px",
                        border: "2px dashed rgba(45,90,61,0.3)", borderRadius: "10px",
                        cursor: "pointer", background: importHtmlFile ? "rgba(45,90,61,0.06)" : "#FFFFFF",
                        transition: "all 0.2s ease",
                      }}>
                        <span style={{ fontSize: "32px" }}>{importHtmlFile ? "🌐" : "⬆"}</span>
                        <span style={{ color: "#1E2018", fontSize: "13px", opacity: 0.6, fontFamily: "'Libre Baskerville', serif", textAlign: "center" }}>
                          {importHtmlName || "Click to upload an HTML file"}
                        </span>
                        {importHtmlFile && (
                          <span style={{ color: "#2D5A3D", fontSize: "12px", opacity: 0.7 }}>
                            {(importHtmlFile.size / 1024).toFixed(0)} KB
                          </span>
                        )}
                        <input type="file" accept=".html,.htm" style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files[0];
                            if (!f) return;
                            setImportHtmlFile(f);
                            setImportHtmlName(f.name);
                            setImportError("");
                          }} />
                      </label>
                      {importHtmlFile && (
                        <button onClick={() => { setImportHtmlFile(null); setImportHtmlName(""); }} style={{
                          background: "transparent", border: "none", color: "#8B2020",
                          cursor: "pointer", fontSize: "12px", marginTop: "8px",
                          fontFamily: "'Libre Baskerville', serif", textDecoration: "underline",
                        }}>Remove file</button>
                      )}
                    </div>
                  )}

                  {/* TAB: JSON Backup restore */}
                  {importTab === "json" && (
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ color: "#1E2018", fontSize: "12px", opacity: 0.5, marginBottom: "12px", fontFamily: "'Libre Baskerville', serif" }}>
                        Restore from a <strong>frontendjobs_..._backup.json</strong> file you previously exported. This bypasses AI entirely — instant restore.
                      </p>
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", gap: "10px", padding: "32px",
                        border: "2px dashed rgba(45,90,61,0.3)", borderRadius: "10px",
                        cursor: "pointer", background: importJsonFile ? "rgba(45,90,61,0.06)" : "#FFFFFF",
                        transition: "all 0.2s ease",
                      }}>
                        <span style={{ fontSize: "32px" }}>{importJsonFile ? "💾" : "⬆"}</span>
                        <span style={{ color: "#1E2018", fontSize: "13px", opacity: 0.6, fontFamily: "'Libre Baskerville', serif", textAlign: "center" }}>
                          {importJsonName || "Click to upload your JSON backup file"}
                        </span>
                        {importJsonFile && (
                          <span style={{ color: "#2D5A3D", fontSize: "12px", opacity: 0.7 }}>
                            {(importJsonFile.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                        <input type="file" accept=".json" style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files[0];
                            if (!f) return;
                            setImportJsonFile(f);
                            setImportJsonName(f.name);
                            setImportError("");
                          }} />
                      </label>
                      {importJsonFile && (
                        <button onClick={() => { setImportJsonFile(null); setImportJsonName(""); }} style={{
                          background: "transparent", border: "none", color: "#8B2020",
                          cursor: "pointer", fontSize: "12px", marginTop: "8px",
                          fontFamily: "'Libre Baskerville', serif", textDecoration: "underline",
                        }}>Remove file</button>
                      )}
                    </div>
                  )}

                  {/* TAB: Screenshot / image */}
                  {importTab === "image" && (
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", gap: "10px", padding: "24px",
                        border: "2px dashed rgba(45,90,61,0.3)", borderRadius: "10px",
                        cursor: "pointer", background: "#FFFFFF",
                        transition: "all 0.2s ease",
                      }}>
                        {importImagePreview ? (
                          <img src={importImagePreview} alt="CV preview"
                            style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "6px", objectFit: "contain" }} />
                        ) : (
                          <>
                            <span style={{ fontSize: "32px" }}>🖼</span>
                            <span style={{ color: "#1E2018", fontSize: "13px", opacity: 0.6, fontFamily: "'Libre Baskerville', serif" }}>
                              Click to upload a screenshot of your CV
                            </span>
                            <span style={{ color: "#1E2018", fontSize: "11px", opacity: 0.35 }}>PNG, JPG, WEBP</span>
                          </>
                        )}
                        <input type="file" accept="image/*" style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files[0];
                            if (!f) return;
                            setImportImage(f);
                            setImportImagePreview(URL.createObjectURL(f));
                            setImportError("");
                          }} />
                      </label>
                      {importImage && (
                        <button onClick={() => { setImportImage(null); setImportImagePreview(null); }} style={{
                          background: "transparent", border: "none", color: "#8B2020",
                          cursor: "pointer", fontSize: "12px", marginTop: "8px",
                          fontFamily: "'Libre Baskerville', serif", textDecoration: "underline",
                        }}>Remove image</button>
                      )}
                    </div>
                  )}

                  {importError && (
                    <p style={{ color: "#8B2020", fontSize: "13px", marginBottom: "12px" }}>⚠ {importError}</p>
                  )}

                  <button
                    onClick={importTab === "json" ? handleJsonRestore : handleImport}
                    disabled={importing}
                    style={{
                      width: "100%", padding: "14px", borderRadius: "10px",
                      background: importing ? "rgba(45,90,61,0.5)" : "#2D5A3D",
                      color: "#EDE8DE", border: "none", cursor: importing ? "not-allowed" : "pointer",
                      fontFamily: "'Libre Baskerville', serif", fontSize: "15px", fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    }}
                  >
                    {importing ? (
                      <>
                        <span style={{
                          display: "inline-block", width: "14px", height: "14px",
                          border: "2px solid #EDE8DE", borderTopColor: "transparent",
                          borderRadius: "50%", animation: "spin 0.7s linear infinite",
                        }} />
                        Parsing CV...
                      </>
                    ) : importTab === "json" ? "💾 Restore from Backup" : "✦ Parse My CV"}
                  </button>
                </>
              )}

              {/* ── PREVIEW RESULT ── */}
              {importPreview && (
                <div>
                  <div style={{
                    background: "rgba(45,90,61,0.08)", border: "1px solid rgba(45,90,61,0.2)",
                    borderRadius: "10px", padding: "16px 20px", marginBottom: "20px",
                  }}>
                    <p style={{ color: "#2D5A3D", fontFamily: "'Libre Baskerville', serif", fontSize: "13px", marginBottom: "12px", fontWeight: 900 }}>
                      ✓ CV Parsed Successfully — Preview
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {[
                        { label: "Name",       value: `${importPreview.personalInfo?.firstName || ""} ${importPreview.personalInfo?.lastName || ""}`.trim() },
                        { label: "Job Title",  value: importPreview.personalInfo?.jobTitle },
                        { label: "Skills",     value: importPreview.skills?.length ? `${importPreview.skills.length} skills found` : null },
                        { label: "Experience", value: importPreview.experience?.length ? `${importPreview.experience.length} role(s)` : null },
                        { label: "Education",  value: importPreview.education?.length ? `${importPreview.education.length} qualification(s)` : null },
                        { label: "Projects",   value: importPreview.projects?.length ? `${importPreview.projects.length} project(s)` : null },
                        { label: "Languages",  value: importPreview.languages?.length ? `${importPreview.languages.length} language(s)` : null },
                      ].filter(r => r.value).map(({ label, value }) => (
                        <div key={label} style={{ display: "flex", gap: "10px", fontSize: "13px" }}>
                          <span style={{ color: "#1E2018", opacity: 0.45, fontFamily: "'Libre Baskerville', serif", minWidth: "90px" }}>{label}</span>
                          <span style={{ color: "#1E2018" }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p style={{ color: "#1E2018", fontSize: "12px", opacity: 0.5, marginBottom: "16px" }}>
                    This will replace your current profile fields. You can still edit anything after applying.
                  </p>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={handleApplyImport} style={{
                      flex: 2, padding: "13px", borderRadius: "10px",
                      background: "#2D5A3D", color: "#EDE8DE", border: "none",
                      cursor: "pointer", fontFamily: "'Libre Baskerville', serif",
                      fontSize: "14px", fontWeight: 900,
                    }}>
                      ✓ Apply to Profile
                    </button>
                    <button onClick={() => setImportPreview(null)} style={{
                      flex: 1, padding: "13px", borderRadius: "10px",
                      background: "transparent", color: "#1E2018",
                      border: "1px solid rgba(45,90,61,0.25)",
                      cursor: "pointer", fontFamily: "'Libre Baskerville', serif", fontSize: "14px",
                    }}>
                      ← Back
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}


        {/* ══ SECTION 1 — PERSONAL INFO ══════════════════════════════════════ */}
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


        {/* ══ SECTION 2 — SKILLS ═════════════════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="🛠 Skills" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              placeholder="Type a skill and press Enter" />
            <button className="primary-btn" onClick={handleAddSkill}
              style={{ whiteSpace: "nowrap", padding: "11px 20px", fontSize: "14px" }}>
              + Add
            </button>
          </div>
          {skills.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {skills.map((skill, index) => (
                <span key={index} style={{
                  background: "rgba(45,90,61,0.1)", border: "1px solid rgba(45,90,61,0.3)",
                  color: "#2D5A3D", padding: "6px 12px", borderRadius: "20px",
                  fontSize: "13px", fontFamily: "'Libre Baskerville', serif",
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  {skill}
                  <button onClick={() => handleRemoveSkill(index)} style={{
                    background: "transparent", border: "none", color: "#2D5A3D",
                    cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, opacity: 0.7,
                  }}>×</button>
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: "#1E2018", opacity: 0.3, fontSize: "13px" }}>
              No skills added yet. Type above and press Enter.
            </p>
          )}
        </div>


        {/* ══ SECTION 3 — EXPERIENCE ═════════════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="💼 Experience" />
          {experience.length === 0 && (
            <p style={{ color: "#1E2018", opacity: 0.3, fontSize: "13px", marginBottom: "16px" }}>
              No experience added yet.
            </p>
          )}
          {experience.map((job, index) => (
            <div key={index} style={cardInnerStyle}>
              <button onClick={() => handleRemoveExperience(index)} style={removeBtnStyle}>Remove</button>
              <p style={{ color: "#2D5A3D", fontSize: "11px", letterSpacing: "1px",
                textTransform: "uppercase", marginBottom: "14px",
                fontFamily: "'Libre Baskerville', serif", opacity: 0.6 }}>
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
                <div key={bIndex} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ color: "#2D5A3D", fontSize: "12px", flexShrink: 0 }}>→</span>
                  <input style={{ ...inputStyle, flex: 1 }} value={bullet}
                    onChange={(e) => handleBulletChange(index, bIndex, e.target.value)} />
                  {job.bullets.length > 1 && (
                    <button onClick={() => handleRemoveBullet(index, bIndex)} style={{
                      background: "transparent", border: "none", color: "#8B2020",
                      cursor: "pointer", fontSize: "18px", lineHeight: 1, flexShrink: 0, opacity: 0.7,
                    }}>×</button>
                  )}
                </div>
              ))}
              <button onClick={() => handleAddBullet(index)} style={{
                background: "transparent", border: "1px dashed rgba(45,90,61,0.3)",
                color: "#2D5A3D", borderRadius: "6px", padding: "6px 14px",
                cursor: "pointer", fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                marginTop: "4px", width: "100%",
              }}>+ Add bullet point</button>
            </div>
          ))}
          <button onClick={handleAddExperience} style={addBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#2D5A3D"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(45,90,61,0.3)"}
          >+ Add Experience</button>
        </div>


        {/* ══ SECTION 4 — EDUCATION ══════════════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="🎓 Education" />
          {education.length === 0 && (
            <p style={{ color: "#1E2018", opacity: 0.3, fontSize: "13px", marginBottom: "16px" }}>
              No education added yet.
            </p>
          )}
          {education.map((edu, index) => (
            <div key={index} style={cardInnerStyle}>
              <button onClick={() => handleRemoveEducation(index)} style={removeBtnStyle}>Remove</button>
              <p style={{ color: "#2D5A3D", fontSize: "11px", letterSpacing: "1px",
                textTransform: "uppercase", marginBottom: "14px",
                fontFamily: "'Libre Baskerville', serif", opacity: 0.6 }}>
                Qualification {index + 1}
              </p>
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Degree / Qualification</label>
                <input style={inputStyle} value={edu.degree}
                  onChange={(e) => handleEducationChange(index, "degree", e.target.value)} />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Institution</label>
                <input style={inputStyle} value={edu.institution}
                  onChange={(e) => handleEducationChange(index, "institution", e.target.value)} />
              </div>
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
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Graduation Status</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {["graduated", "expected"].map((status) => (
                    <button key={status}
                      onClick={() => handleEducationChange(index, "graduationStatus", status)}
                      style={{
                        flex: 1, padding: "10px", borderRadius: "8px",
                        border: edu.graduationStatus === status ? "2px solid #2D5A3D" : "2px solid rgba(45,90,61,0.2)",
                        background: edu.graduationStatus === status ? "rgba(45,90,61,0.15)" : "transparent",
                        color: edu.graduationStatus === status ? "#2D5A3D" : "#1E2018",
                        cursor: "pointer", fontFamily: "'Libre Baskerville', serif", fontSize: "13px",
                        opacity: edu.graduationStatus === status ? 1 : 0.5, transition: "all 0.2s ease",
                      }}>
                      {status === "graduated" ? "✓ Graduated" : "⏳ Expected to Graduate"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>
                  {edu.graduationStatus === "expected" ? "Expected Graduation Month & Year" : "Graduation Month & Year"}
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  <select value={edu.graduationMonth || ""}
                    onChange={(e) => handleEducationChange(index, "graduationMonth", e.target.value)}
                    style={{ ...inputStyle, flex: 2, cursor: "pointer" }}>
                    <option value="">Month</option>
                    {MONTHS.map((month) => (<option key={month} value={month}>{month}</option>))}
                  </select>
                  <select value={edu.graduationYear || ""}
                    onChange={(e) => handleEducationChange(index, "graduationYear", e.target.value)}
                    style={{ ...inputStyle, flex: 1, cursor: "pointer" }}>
                    <option value="">Year</option>
                    {YEARS.map((year) => (<option key={year} value={year}>{year}</option>))}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Minimum Average (optional)</label>
                <input style={inputStyle} value={edu.minimumAverage || ""}
                  onChange={(e) => handleEducationChange(index, "minimumAverage", e.target.value)} />
                <p style={{ color: "#1E2018", fontSize: "11px", opacity: 0.3, marginTop: "5px" }}>
                  e.g. 70% — will appear as an achievement bullet on your CV
                </p>
              </div>
              <label style={{ ...labelStyle, marginBottom: "10px" }}>Relevant Coursework / Achievements</label>
              {edu.coursework.map((item, cwIndex) => (
                <div key={cwIndex} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ color: "#2D5A3D", fontSize: "12px", flexShrink: 0 }}>•</span>
                  <input style={{ ...inputStyle, flex: 1 }} value={item}
                    onChange={(e) => handleCourseworkChange(index, cwIndex, e.target.value)} />
                  {edu.coursework.length > 1 && (
                    <button onClick={() => handleRemoveCoursework(index, cwIndex)} style={{
                      background: "transparent", border: "none", color: "#8B2020",
                      cursor: "pointer", fontSize: "18px", lineHeight: 1, flexShrink: 0, opacity: 0.7,
                    }}>×</button>
                  )}
                </div>
              ))}
              <button onClick={() => handleAddCoursework(index)} style={{
                background: "transparent", border: "1px dashed rgba(45,90,61,0.3)",
                color: "#2D5A3D", borderRadius: "6px", padding: "6px 14px",
                cursor: "pointer", fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                marginTop: "4px", width: "100%",
              }}>+ Add coursework item</button>
            </div>
          ))}
          <button onClick={handleAddEducation} style={addBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#2D5A3D"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(45,90,61,0.3)"}
          >+ Add Education</button>
        </div>


        {/* ══ SECTION 5 — PROJECTS ═══════════════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="🚀 Project Experience" />
          <p style={{ color: "#1E2018", opacity: 0.4, fontSize: "12px", marginBottom: "16px" }}>
            Each project can be toggled on/off — only projects marked "Include in CV" will appear on your generated CV.
          </p>

          {projects.length === 0 && (
            <p style={{ color: "#1E2018", opacity: 0.3, fontSize: "13px", marginBottom: "16px" }}>
              No projects added yet.
            </p>
          )}

          {projects.map((proj, index) => (
            <div key={index} style={{
              background: "#FDFAF5",
              border: "1px solid #D4C9B0",
              borderRadius: "16px",
              padding: "28px 32px",
              marginBottom: "20px",
              position: "relative",
              opacity: proj.includeInCV === false ? 0.55 : 1,
              transition: "opacity 0.2s ease",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}>

              {editingProject === index ? (
                /* ── EDIT MODE ── */
                <>
                  {/* Include in CV toggle */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <div onClick={() => handleProjectChange(index, "includeInCV", !proj.includeInCV)}
                      style={{
                        width: "42px", height: "24px", borderRadius: "12px",
                        background: proj.includeInCV !== false ? "#2D5A3D" : "rgba(255,255,255,0.15)",
                        position: "relative", cursor: "pointer", transition: "background 0.25s ease", flexShrink: 0,
                      }}>
                      <div style={{
                        position: "absolute", top: "3px",
                        left: proj.includeInCV !== false ? "21px" : "3px",
                        width: "18px", height: "18px", borderRadius: "50%",
                        background: "#FFFFFF", transition: "left 0.25s ease",
                      }} />
                    </div>
                    <span style={{
                      color: proj.includeInCV !== false ? "#2D5A3D" : "#1E2018",
                      fontSize: "13px", fontFamily: "'Libre Baskerville', serif",
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
                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Technologies Used</label>
                    {proj.technologies && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                        {(Array.isArray(proj.technologies)
                          ? proj.technologies
                          : proj.technologies.split(",").map(t => t.trim()).filter(Boolean)
                        ).map((t, ti) => (
                          <span key={ti} style={{
                            background: "rgba(45,90,61,0.08)", border: "1px solid rgba(45,90,61,0.35)",
                            color: "#2D5A3D", fontSize: "11px", padding: "4px 10px", borderRadius: "4px",
                            display: "flex", alignItems: "center", gap: "6px",
                            boxShadow: "0 0 8px rgba(45,90,61,0.25), inset 0 0 4px rgba(45,90,61,0.05)",
                          }}>
                            {t}
                            <span onClick={() => {
                              const arr = Array.isArray(proj.technologies)
                                ? proj.technologies
                                : proj.technologies.split(",").map(s => s.trim()).filter(Boolean);
                              handleProjectChange(index, "technologies", arr.filter((_, i) => i !== ti).join(", "));
                            }} style={{ cursor: "pointer", opacity: 0.5, fontSize: "13px", lineHeight: 1 }}>×</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <input style={inputStyle}
                      placeholder="Type a technology and press Enter (e.g. React)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.target.value.trim()) {
                          e.preventDefault();
                          const existing = Array.isArray(proj.technologies)
                            ? proj.technologies
                            : proj.technologies ? proj.technologies.split(",").map(s => s.trim()).filter(Boolean) : [];
                          if (!existing.includes(e.target.value.trim())) {
                            handleProjectChange(index, "technologies", [...existing, e.target.value.trim()].join(", "));
                          }
                          e.target.value = "";
                        }
                      }} />
                    <p style={{ color: "#1E2018", fontSize: "11px", opacity: 0.3, marginTop: "5px" }}>
                      Type and press Enter to add — click × on a tag to remove
                    </p>
                  </div>

                  {/* Project URLs (multi) */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>
                      Project URLs <span style={{ color: "#2D5A3D", fontSize: "11px", fontWeight: 400 }}>(GitHub, live site, demo, etc.)</span>
                    </label>
                    {(Array.isArray(proj.urls) ? proj.urls : (proj.url ? [proj.url] : [""])).map((urlVal, uIdx) => (
                      <div key={uIdx} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                        <input
                          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                          placeholder={uIdx === 0 ? "https://github.com/yourusername/project" : "https://yourlivesite.com"}
                          value={urlVal}
                          onChange={(e) => {
                            const arr = Array.isArray(proj.urls) ? [...proj.urls] : (proj.url ? [proj.url] : [""]);
                            arr[uIdx] = e.target.value;
                            handleProjectChange(index, "urls", arr);
                          }}
                        />
                        {(Array.isArray(proj.urls) ? proj.urls : [proj.url || ""]).length > 1 && (
                          <button
                            onClick={() => {
                              const arr = Array.isArray(proj.urls) ? [...proj.urls] : [proj.url || ""];
                              handleProjectChange(index, "urls", arr.filter((_, i) => i !== uIdx));
                            }}
                            style={{ background: "transparent", border: "none", color: "#8B2020", cursor: "pointer", fontSize: "18px", lineHeight: 1, flexShrink: 0, opacity: 0.7 }}
                          >×</button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const arr = Array.isArray(proj.urls) ? [...proj.urls] : (proj.url ? [proj.url] : [""]);
                        handleProjectChange(index, "urls", [...arr, ""]);
                      }}
                      style={{
                        background: "transparent", border: "1px dashed rgba(45,90,61,0.3)",
                        color: "#2D5A3D", borderRadius: "6px", padding: "6px 14px",
                        cursor: "pointer", fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                        marginTop: "4px", width: "100%",
                      }}
                    >+ Add another URL</button>
                  </div>

                  {/* Bullet inputs */}
                  <label style={{ ...labelStyle, marginBottom: "10px", display: "block" }}>Project Descriptions</label>
                  {proj.bullets.map((bullet, bIndex) => (
                    <div key={bIndex} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                      <div style={{
                        width: "6px", height: "6px", borderRadius: "50%",
                        background: "#2D5A3D", boxShadow: "0 0 4px #2D5A3D",
                        marginTop: "14px", flexShrink: 0,
                      }} />
                      <input style={{ ...inputStyle, flex: 1 , fontFamily: "system-ui, sans-serif"}} value={bullet}
                        onChange={(e) => handleProjectBulletChange(index, bIndex, e.target.value)} />
                      {proj.bullets.length > 1 && (
                        <button onClick={() => handleRemoveProjectBullet(index, bIndex)} style={{
                          background: "transparent", border: "none", color: "#8B2020",
                          cursor: "pointer", fontSize: "18px", lineHeight: 1, flexShrink: 0, opacity: 0.7,
                        }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => handleAddProjectBullet(index)} style={{
                    background: "transparent", border: "1px dashed rgba(45,90,61,0.3)",
                    color: "#2D5A3D", borderRadius: "6px", padding: "6px 14px",
                    cursor: "pointer", fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                    marginTop: "8px", width: "100%", marginBottom: "16px",
                  }}>+ Add bullet point</button>

                  {/* Save / Cancel */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { handleSave(); setEditingProject(null); }} style={{
                      background: "#2D5A3D", color: "#EDE8DE", border: "none", borderRadius: "8px",
                      padding: "10px 24px", cursor: "pointer", fontSize: "13px",
                      fontFamily: "'Libre Baskerville', serif", fontWeight: 900, flex: 1,
                    }}>Save Project</button>
                    <button onClick={() => setEditingProject(null)} style={{
                      background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                      color: "#1E2018", borderRadius: "8px", padding: "10px 20px",
                      cursor: "pointer", fontSize: "13px", fontFamily: "'Libre Baskerville', serif",
                    }}>Cancel</button>
                  </div>
                </>

              ) : (
                /* ── PREVIEW MODE ── */
                <>
                  {/* Top row: title + buttons */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <h2 style={{
                        color: "#1E2018", fontSize: "20px", fontWeight: 700,
                        margin: "0 0 4px 0", fontFamily: "'Libre Baskerville', serif",
                      }}>
                        {proj.name || <span style={{ opacity: 0.25, fontStyle: "italic", fontWeight: 400 }}>Project name...</span>}
                      </h2>
                      {/* URLs display — supports both legacy url and new urls array */}
                      {(() => {
                        const urlsArr = Array.isArray(proj.urls) && proj.urls.some(Boolean)
                          ? proj.urls.filter(Boolean)
                          : proj.url ? [proj.url] : [];
                        return urlsArr.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                            {urlsArr.map((u, ui) => (
                              <a key={ui} href={u} target="_blank" rel="noreferrer" style={{
                                color: "#2D5A3D", fontSize: "12px", opacity: 0.8, textDecoration: "none",
                              }}>↗ {u}</a>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button onClick={() => handleCopyAll(proj)} style={{
                        background: "rgba(45,90,61,0.1)", border: "1px solid rgba(45,90,61,0.3)",
                        color: "#2D5A3D", padding: "6px 14px", borderRadius: "6px",
                        cursor: "pointer", fontSize: "12px", letterSpacing: "1px",
                        fontFamily: "'Libre Baskerville', serif",
                      }}>
                        {copied === `${proj.name}-all` ? "✓ Copied!" : "Copy All"}
                      </button>
                      <button onClick={() => setEditingProject(index)} style={{
                        background: "rgba(45,90,61,0.08)", border: "1px solid rgba(45,90,61,0.2)",
                        color: "#2D5A3D", borderRadius: "6px", padding: "6px 12px",
                        cursor: "pointer", fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                      }}>Edit</button>
                      <button onClick={() => handleRemoveProject(index)} style={{
                        background: "transparent", border: "1px solid rgba(255,107,107,0.3)",
                        color: "#8B2020", borderRadius: "6px", padding: "6px 12px",
                        cursor: "pointer", fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
                      }}>Remove</button>
                    </div>
                  </div>

                  {/* Stack tags */}
                  {proj.technologies && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                      {(Array.isArray(proj.technologies)
                        ? proj.technologies
                        : proj.technologies.split(",").map(t => t.trim()).filter(Boolean)
                      ).map((t, ti) => (
                        <span key={ti} style={{
                          background: "rgba(45,90,61,0.08)", border: "1px solid rgba(45,90,61,0.35)",
                          color: "#2D5A3D", fontSize: "11px",
                          padding: "4px 10px", borderRadius: "4px", letterSpacing: "0.5px",
                          boxShadow: "0 0 8px rgba(45,90,61,0.25), inset 0 0 4px rgba(45,90,61,0.05)",
                        }}>{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  <div style={{
                    height: "1px",
                    background: "linear-gradient(90deg, rgba(45,90,61,0.2) 0%, transparent 100%)",
                    marginBottom: "16px",
                  }} />

                  {/* Bullets */}
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                    {proj.bullets.filter(b => b.trim()).map((bullet, bi) => (
                      <li key={bi} style={{
                        display: "flex", alignItems: "flex-start", gap: "14px",
                        padding: "12px 14px", background: "rgba(45,90,61,0.05)",
                        borderRadius: "8px", border: "1px solid rgba(45,90,61,0.1)",
                      }}>
                        <div style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: "#2D5A3D", boxShadow: "0 0 6px #2D5A3D",
                          marginTop: "7px", flexShrink: 0,
                        }} />
                        <p style={{ color: "rgba(30,32,24,0.85)", fontSize: "13px", lineHeight: "1.75", margin: 0, flex: 1 ,
                          fontFamily: "'Arial', sans-serif"}}>
                          {bullet}
                        </p>
                        <button onClick={() => handleCopy(bullet, `${index}-${bi}`)} title="Copy bullet"
                          style={{
                            background: "transparent", border: "none",
                            color: copied === `${index}-${bi}` ? "#2D5A3D" : "rgba(45,90,61,0.3)",
                            cursor: "pointer", fontSize: "16px", padding: "0 4px",
                            lineHeight: 1, marginTop: "2px", flexShrink: 0,
                          }}>
                          {copied === `${index}-${bi}` ? "✓" : "⧉"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  

                  {/* Include in CV indicator */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                    <div style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: proj.includeInCV !== false ? "#2D5A3D" : "rgba(255,255,255,0.2)",
                      boxShadow: proj.includeInCV !== false ? "0 0 6px #2D5A3D" : "none",
                    }} />
                    <span style={{
                      fontSize: "11px", fontFamily: "'Libre Baskerville', serif",
                      color: proj.includeInCV !== false ? "#2D5A3D" : "rgba(255,255,255,0.3)",
                    }}>
                      {proj.includeInCV !== false ? "Included in CV" : "Excluded from CV"}
                    </span>
                  </div>
                </>
              )}

            </div>
          ))}

          {/* + Add Project button — outside the map, inside the card */}
          <button onClick={handleAddProject} style={addBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#2D5A3D"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(45,90,61,0.3)"}
          >+ Add Project</button>
        </div>


        {/* ══ SECTION 6 — LANGUAGES ══════════════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="🌐 Languages" />
          {languages.length === 0 && (
            <p style={{ color: "#1E2018", opacity: 0.3, fontSize: "13px", marginBottom: "16px" }}>
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
                  background: "transparent", border: "none", color: "#8B2020",
                  cursor: "pointer", fontSize: "16px", lineHeight: 1, opacity: 0.7,
                }}>×</button>
                <div style={{ marginBottom: "10px" }}>
                  <label style={labelStyle}>Language</label>
                  <input style={inputStyle} value={lang.name}
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
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "#2D5A3D"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(45,90,61,0.3)"}
          >+ Add Language</button>
        </div>


        {/* ══ SECTION 7 — REFERENCES ═════════════════════════════════════════ */}
        <div className="card" style={{ maxWidth: "100%", marginBottom: "20px" }}>
          <SectionHeader title="📋 References" />
          <p style={{ color: "#1E2018", fontSize: "13px", opacity: 0.55, marginBottom: "12px" }}>
            This appears at the bottom of your CV.
          </p>
          <textarea value={references} onChange={(e) => setReferences(e.target.value)} rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6", fontFamily: "system-ui, sans-serif" }} />
          {references !== "Available upon Request" && (
            <button onClick={() => setReferences("Available upon Request")} style={{
              background: "transparent", border: "none", color: "#2D5A3D",
              cursor: "pointer", fontSize: "12px", fontFamily: "'Libre Baskerville', serif",
              marginTop: "6px", opacity: 0.6, textDecoration: "underline",
            }}>
              Reset to "Available upon Request"
            </button>
          )}
        </div>


        {/* Feedback */}
        {error && <p style={{ color: "#8B2020", fontSize: "14px", marginBottom: "12px" }}>⚠ {error}</p>}
        {success && <p style={{ color: "#2D5A3D", fontSize: "14px", marginBottom: "12px" }}>✓ {success}</p>}

        {/* Save Button */}
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