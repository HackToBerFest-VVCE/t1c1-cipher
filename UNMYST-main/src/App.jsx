import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Heart,
  Home,
  Languages,
  MapPin,
  Menu,
  Mic,
  Pill,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Upload,
  Volume2,
  X,
  Eye,
  BookOpen,
  ClipboardList,
  LoaderCircle,
  Copy,
  Sparkles,
} from "lucide-react";
import { checkBackend, uploadMedicalDocument } from "./api";
import "./App.css";

const navigation = [
  { label: "Dashboard", icon: Home },
  { label: "Medical Reports", icon: FileText },
  { label: "Prescription Reader", icon: Pill },
  { label: "Voice Assistant", icon: Mic },
  { label: "Reminders", icon: Bell },
  { label: "Doctor Visit Notes", icon: ClipboardList },
  { label: "Nearby Medical Stores", icon: MapPin },
];

const features = [
  {
    title: "Medical Report Simplifier",
    description:
      "Turn complicated medical reports into explanations that are easier to understand.",
    icon: FileText,
    color: "mint",
    tag: "DOCUMENT TOOLS",
    action: "Simplify a report",
    page: "Medical Reports",
  },
  {
    title: "Prescription Reader",
    description:
      "Make prescription information easier to read and understand.",
    icon: Pill,
    color: "lavender",
    tag: "MEDICATION",
    action: "Open reader",
    page: "Prescription Reader",
  },
  {
    title: "Voice Assistant",
    description:
      "Explore voice-based assistance designed for accessible healthcare.",
    icon: Volume2,
    color: "peach",
    tag: "ACCESSIBILITY",
    action: "Explore voice tools",
    page: "Voice Assistant",
  },
  {
    title: "Medication Reminders",
    description:
      "Keep track of medicines and the times you need to take them.",
    icon: Bell,
    color: "blue",
    tag: "DAILY CARE",
    action: "View reminders",
    page: "Reminders",
  },
  {
    title: "Doctor Visit Notes",
    description:
      "Keep important appointment notes and instructions together.",
    icon: ClipboardList,
    color: "yellow",
    tag: "CARE HISTORY",
    action: "Open notes",
    page: "Doctor Visit Notes",
  },
  {
    title: "Nearby Medical Stores",
    description:
      "Find nearby pharmacies and explore medicine availability options.",
    icon: MapPin,
    color: "pink",
    tag: "LOCAL SUPPORT",
    action: "Find a pharmacy",
    page: "Nearby Medical Stores",
  },
];

const pageDescriptions = {
  "Medical Reports":
    "Upload a medical report and extract its text for easier reading.",
  "Prescription Reader":
    "A dedicated space for making prescription information more accessible.",
  "Voice Assistant":
    "Explore accessible, voice-first ways to interact with healthcare information.",
  Reminders:
    "A place to organize medicine schedules and healthcare follow-ups.",
  "Doctor Visit Notes":
    "Keep doctor instructions and appointment notes organized.",
  "Nearby Medical Stores":
    "A place to explore pharmacies near your location.",
};

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [documentResult, setDocumentResult] = useState(null);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function verifyBackend() {
      try {
        await checkBackend();
        if (active) setBackendStatus("connected");
      } catch {
        if (active) setBackendStatus("offline");
      }
    }

    verifyBackend();

    return () => {
      active = false;
    };
  }, []);

  function navigateTo(page) {
    setActivePage(page);
    setMobileMenuOpen(false);
    setNotice("");
    setError("");

    if (page === "Medical Reports") {
      setTimeout(() => {
        document.getElementById("document-workspace")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function chooseFile(file) {
    if (!file) return;

    const allowed = /\.(pdf|txt)$/i.test(file.name);

    if (!allowed) {
      setError("Please choose a PDF or TXT file.");
      setSelectedFile(null);
      setDocumentResult(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Your file is larger than 10 MB. Please choose a smaller file.");
      setSelectedFile(null);
      setDocumentResult(null);
      return;
    }

    setSelectedFile(file);
    setDocumentResult(null);
    setError("");
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("Please select a PDF or TXT document first.");
      return;
    }

    setUploading(true);
    setError("");
    setDocumentResult(null);

    try {
      const result = await uploadMedicalDocument(selectedFile);
      setDocumentResult(result);
    } catch (err) {
      setError(
        err.message ||
          "We could not process this document. Check that the backend is running."
      );
    } finally {
      setUploading(false);
    }
  }

  async function copyExtractedText() {
    const text = documentResult?.text;

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setNotice("Extracted text copied to clipboard.");
    } catch {
      setNotice("Copy is unavailable in this browser. Please select the text manually.");
    }
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      setNotice("Text-to-speech is not supported by this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function renderUploadWorkspace() {
    return (
      <section className="workspace-card" id="document-workspace">
        <div className="workspace-heading">
          <div className="workspace-icon">
            <FileText size={25} />
          </div>
          <div>
            <span className="eyebrow">DOCUMENT WORKSPACE</span>
            <h2>Medical Report Simplifier</h2>
            <p>Start by uploading a medical document.</p>
          </div>
        </div>

        <div
          className="upload-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files?.[0]);
          }}
        >
          <div className="upload-icon">
            <Upload size={27} />
          </div>
          <h3>Upload your medical document</h3>
          <p>Drag and drop your file here, or choose a file from your device.</p>
          <p className="file-hint">Supported formats: PDF and TXT · Maximum 10 MB</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="visually-hidden"
            aria-label="Choose medical document"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />

          <button
            className="button button-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={18} />
            Choose document
          </button>

          {selectedFile && (
            <div className="selected-file">
              <FileText size={19} />
              <div className="selected-file-details">
                <strong>{selectedFile.name}</strong>
                <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
              <button
                className="icon-button"
                aria-label="Remove selected file"
                onClick={() => {
                  setSelectedFile(null);
                  setDocumentResult(null);
                  setError("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X size={19} />
              </button>
            </div>
          )}
        </div>

        {backendStatus === "offline" && (
          <div className="inline-warning">
            The backend is not connected. Start your FastAPI server on port 8000
            before uploading.
          </div>
        )}

        {error && <div className="inline-error" role="alert">{error}</div>}

        <button
          className="button button-primary upload-submit"
          onClick={handleUpload}
          disabled={uploading || backendStatus !== "connected" || !selectedFile}
        >
          {uploading ? (
            <>
              <LoaderCircle size={19} className="spin" />
              Extracting text...
            </>
          ) : (
            <>
              <Sparkles size={19} />
              Upload and extract text
            </>
          )}
        </button>

        {documentResult && (
          <div className="extraction-result" aria-live="polite">
            <div className="result-heading">
              <div>
                <CheckCircle2 size={22} />
                <h3>Document processed</h3>
              </div>
              {documentResult.text && (
                <div className="result-actions">
                  <button className="small-action" onClick={copyExtractedText}>
                    <Copy size={16} /> Copy
                  </button>
                  <button
                    className="small-action"
                    onClick={() => speakText(documentResult.text)}
                  >
                    <Volume2 size={16} /> Read aloud
                  </button>
                </div>
              )}
            </div>

            {documentResult.needs_ocr ? (
              <p>
                This document does not contain selectable text. OCR support is
                needed to read scanned pages or image-only PDFs.
              </p>
            ) : (
              <>
                <p className="result-note">
                  This is extracted document text, not an AI-generated medical
                  explanation.
                </p>
                <pre className="extracted-text">{documentResult.text}</pre>
              </>
            )}
          </div>
        )}

        {notice && <p className="status-notice" role="status">{notice}</p>}
      </section>
    );
  }

  function renderDashboard() {
    return (
      <>
        <section className="welcome-banner">
          <div className="welcome-content">
            <div className="welcome-label">
              <Heart size={16} />
              HEALTHCARE, MADE EASIER
            </div>
            <h2>Your health journey, <span>made simpler.</span></h2>
            <p>
              Understand your medical information, stay organized, and take
              your next healthcare step with confidence.
            </p>
            <button
              className="button button-white"
              onClick={() => navigateTo("Medical Reports")}
            >
              Simplify a medical report <ArrowRight size={18} />
            </button>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="art-circle art-circle-one" />
            <div className="art-circle art-circle-two" />
            <div className="art-heart">
              <Heart size={62} strokeWidth={1.5} />
            </div>
            <div className="art-check"><CheckCircle2 size={28} /></div>
            <div className="art-plus">+</div>
          </div>
        </section>

        <section className="quick-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR HEALTH TOOLS</span>
              <h2>What would you like to do?</h2>
              <p>Choose a service to get started.</p>
            </div>
          </div>

          <div className="feature-grid">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article className="feature-card" key={feature.title}>
                  <div className={`feature-icon ${feature.color}`}>
                    <Icon size={24} strokeWidth={1.9} />
                  </div>
                  <span className="feature-tag">{feature.tag}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <button
                    className="feature-link"
                    onClick={() => navigateTo(feature.page)}
                  >
                    {feature.action}
                    <ChevronRight size={18} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bottom-grid">
          <div className="info-card accessibility-card">
            <div className="info-card-icon">
              <Eye size={24} />
            </div>
            <div>
              <span className="eyebrow">DESIGNED FOR EVERYONE</span>
              <h3>Your comfort comes first</h3>
              <p>
                Adjust text size and contrast to make the interface more
                comfortable to use.
              </p>
              <div className="accessibility-actions">
                <button
                  className={`setting-chip ${largeText ? "setting-active" : ""}`}
                  onClick={() => setLargeText((value) => !value)}
                  aria-pressed={largeText}
                >
                  <Plus size={16} /> {largeText ? "Normal text" : "Larger text"}
                </button>
                <button
                  className={`setting-chip ${highContrast ? "setting-active" : ""}`}
                  onClick={() => setHighContrast((value) => !value)}
                  aria-pressed={highContrast}
                >
                  <Eye size={16} /> {highContrast ? "Standard contrast" : "High contrast"}
                </button>
              </div>
            </div>
          </div>

          <div className="info-card privacy-card">
            <div className="privacy-icon">
              <ShieldCheck size={25} />
            </div>
            <span className="eyebrow">YOUR INFORMATION MATTERS</span>
            <h3>Care with confidence</h3>
            <p>
              This prototype processes uploaded documents through your local
              backend. Use fictional documents while testing.
            </p>
            <div className="privacy-note">
              <CheckCircle2 size={17} />
              Local prototype · No document history saved
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderFeaturePage() {
    const currentFeature = features.find(
      (feature) => feature.page === activePage
    );
    const Icon = currentFeature?.icon || BookOpen;

    if (activePage === "Medical Reports") {
      return (
        <>
          <div className="page-intro">
            <span className="eyebrow">YOUR HEALTH TOOLS</span>
            <h2>Medical Reports</h2>
            <p>{pageDescriptions[activePage]}</p>
          </div>
          {renderUploadWorkspace()}
        </>
      );
    }

    return (
      <section className="coming-page">
        <div className={`coming-icon ${currentFeature?.color || "mint"}`}>
          <Icon size={34} />
        </div>
        <span className="eyebrow">UNMYST HEALTH TOOLS</span>
        <h2>{activePage}</h2>
        <p className="coming-description">
          {pageDescriptions[activePage] ||
            "Explore accessible healthcare information and tools."}
        </p>
        <div className="coming-status">
          <Clock3 size={18} />
          Interface ready · Feature integration pending
        </div>

        {activePage === "Voice Assistant" && (
          <div className="feature-preview">
            <Volume2 size={22} />
            <div>
              <strong>Read information aloud</strong>
              <p>
                Text-to-speech is available for extracted document text in the
                Medical Reports section.
              </p>
            </div>
            <button
              className="button button-secondary"
              onClick={() => navigateTo("Medical Reports")}
            >
              Try it <ArrowRight size={17} />
            </button>
          </div>
        )}

        {activePage === "Nearby Medical Stores" && (
          <div className="feature-preview">
            <MapPin size={22} />
            <div>
              <strong>Location-based pharmacy search</strong>
              <p>
                Maps, pharmacy discovery, and medicine availability checks
                still need to be connected.
              </p>
            </div>
          </div>
        )}

        {activePage === "Reminders" && (
          <div className="feature-preview">
            <Bell size={22} />
            <div>
              <strong>Medicine and appointment reminders</strong>
              <p>
                Reminder creation, notifications, and saved schedules still
                need to be implemented.
              </p>
            </div>
          </div>
        )}

        {activePage === "Prescription Reader" && (
          <div className="feature-preview">
            <Pill size={22} />
            <div>
              <strong>Prescription understanding</strong>
              <p>
                Prescription image reading and medication explanations still
                need OCR and AI integration.
              </p>
            </div>
          </div>
        )}

        {activePage === "Doctor Visit Notes" && (
          <div className="feature-preview">
            <ClipboardList size={22} />
            <div>
              <strong>Appointment notes and care instructions</strong>
              <p>
                Saving visit notes and organizing care history still need to
                be implemented.
              </p>
            </div>
          </div>
        )}

        <button
          className="button button-primary"
          onClick={() => navigateTo("Dashboard")}
        >
          <Home size={18} /> Back to dashboard
        </button>
      </section>
    );
  }

  return (
    <div className={`app-shell ${largeText ? "large-text" : ""} ${highContrast ? "high-contrast" : ""}`}>
      {mobileMenuOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigateTo("Dashboard")}
          aria-label="UNMYST home"
        >
          <span className="brand-mark">
            <Heart size={25} strokeWidth={2.4} />
          </span>
          <span className="brand-name">
            UNMYST
            <small>Healthcare, understood.</small>
          </span>
        </button>

        <div className="nav-caption">MENU</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.label;

            return (
              <button
                key={item.label}
                className={`nav-item ${active ? "nav-active" : ""}`}
                onClick={() => navigateTo(item.label)}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
                {active && <span className="active-indicator" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="support-box">
            <div className="support-icon">
              <CircleHelp size={21} />
            </div>
            <strong>Need a little help?</strong>
            <p>We are here to make healthcare easier to understand.</p>
            <button
              onClick={() =>
                setNotice("Help centre integration is planned for a future update.")
              }
            >
              Get help <ArrowRight size={16} />
            </button>
          </div>

          <button
            className="nav-item settings-nav"
            onClick={() =>
              setNotice("Use the accessibility controls on the dashboard to adjust text and contrast.")
            }
          >
            <Settings size={20} />
            <span>Accessibility settings</span>
          </button>

          <div className="sidebar-footer">
            <span className="footer-dot" />
            Built with care for accessible healthcare
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={23} />
            </button>
            <div className="breadcrumb">
              <span>UNMYST</span>
              <ChevronRight size={15} />
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className={`connection-pill ${backendStatus}`}>
              <span className="connection-dot" />
              {backendStatus === "checking"
                ? "Connecting..."
                : backendStatus === "connected"
                  ? "System connected"
                  : "Backend offline"}
            </div>

            <button
              className="topbar-icon"
              aria-label="Notifications"
              onClick={() =>
                setNotice("Notifications will be available when reminders are integrated.")
              }
            >
              <Bell size={20} />
            </button>

            <div className="profile-avatar" aria-label="Guest profile">
              <Heart size={19} />
            </div>
          </div>
        </header>

        <div className="content-area">
          {activePage === "Dashboard" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    <CalendarDays size={15} /> YOUR PERSONAL HEALTH SPACE
                  </span>
                  <h1>Welcome to UNMYST <span className="wave">✳</span></h1>
                  <p>Clearer information. More confident healthcare decisions.</p>
                </div>
                <button
                  className="button button-secondary heading-help"
                  onClick={() =>
                    setNotice("Choose any tool from the dashboard or navigation menu to get started.")
                  }
                >
                  <CircleHelp size={18} /> How it works
                </button>
              </div>
              {renderDashboard()}
            </>
          ) : (
            <>
              <div className="page-heading inner-page-heading">
                <div>
                  <span className="eyebrow">
                    <Activity size={15} /> YOUR PERSONAL HEALTH SPACE
                  </span>
                  <h1>{activePage}</h1>
                  <p>{pageDescriptions[activePage] || "Your healthcare, made easier."}</p>
                </div>
                <button
                  className="button button-secondary heading-help"
                  onClick={() => navigateTo("Dashboard")}
                >
                  <Home size={17} /> Dashboard
                </button>
              </div>
              {renderFeaturePage()}
            </>
          )}

          {notice && (
            <div className="global-notice" role="status">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={17} />
              </button>
            </div>
          )}

          <footer className="main-footer">
            <div className="footer-brand">
              <Heart size={17} /> UNMYST
            </div>
            <span>Making healthcare information easier to understand.</span>
            <div className="footer-links">
              <span><ShieldCheck size={15} /> Accessibility first</span>
              <span><Languages size={15} /> Inclusive by design</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;