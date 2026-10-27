import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
  MessageCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Square,
  Upload,
  Volume2,
  X,
  Eye,
  BookOpen,
  ClipboardList,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import {
  checkBackend,
  explainMedicalDocument,
} from "./api";
import Reminders from "./Reminders.jsx";
import DoctorVisitNotes from "./DoctorVisitNotes.jsx";
import FaqChat from "./FaqChat.jsx";
import NearbyMedicalStores from "./NearbyMedicalStores.jsx";
import useMedicationReminders from "./useMedicationReminders.js";
import { LANGUAGES, translate } from "./translations.js";
import "./App.css";

const ExplanationMarkdown = lazy(async () => {
  const [markdownModule, gfmModule] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
  ]);
  const ReactMarkdown = markdownModule.default;
  const remarkGfm = gfmModule.default;

  return {
    default: function FormattedExplanation({ children }) {
      return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
    },
  };
});

const navigation = [
  { label: "Dashboard", icon: Home },
  { label: "Medical Reports", icon: FileText },
  { label: "Find health videos", icon: Stethoscope },
  { label: "Health FAQ Chat", icon: MessageCircle },
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
    title: "Find health videos",
    description:
      "Search YouTube for videos about a disease or health topic.",
    icon: Stethoscope,
    color: "mint",
    tag: "HEALTH EDUCATION",
    action: "Search YouTube",
    page: "Find health videos",
  },
  {
    title: "Health FAQ Chat",
    description: "Ask common questions about using UNMYST and its features.",
    icon: MessageCircle,
    color: "blue",
    tag: "QUICK SUPPORT",
    action: "Ask a question",
    page: "Health FAQ Chat",
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
  "Find health videos":
    "Search YouTube for videos about a disease or health topic.",
  "Health FAQ Chat":
    "Get prepared answers to common questions about using UNMYST.",
  Reminders:
    "Add your medicines, get reminded on time, and mark each dose as taken or skipped.",
  "Doctor Visit Notes":
    "Record a doctor visit conversation and keep track of hospital visits.",
  "Nearby Medical Stores":
    "Find nearby pharmacies using your location or a city/postal code.",
};

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [language, setLanguage] = useState(() => localStorage.getItem("unmyst-language") || "en");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [selectedFile, setSelectedFile] = useState(null);
  const [youtubeKeyword, setYoutubeKeyword] = useState("");

const [explaining, setExplaining] = useState(false);

const [explanationResult, setExplanationResult] = useState(null);

const [error, setError] = useState("");  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [notice, setNotice] = useState("");
  const [speakingExplanation, setSpeakingExplanation] = useState(false);
  const fileInputRef = useRef(null);
  const speechUtteranceRef = useRef(null);
  const medication = useMedicationReminders({
    backendStatus,
    onAlert: setNotice,
  });
  const t = (text) => translate(language, text);

  useEffect(() => {
    localStorage.setItem("unmyst-language", language);
    document.documentElement.lang = LANGUAGES.find((item) => item.code === language)?.htmlLang || "en";
  }, [language]);

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

  function searchHealthVideos(event) {
    event.preventDefault();
    const keyword = youtubeKeyword.trim();
    if (!keyword) return;

    const query = `${keyword} health education`;
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function chooseFile(file) {
    if (!file) return;

    const allowed = /\.(pdf|txt)$/i.test(file.name);

    if (!allowed) {
      setError("Please choose a PDF or TXT file.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Your file is larger than 10 MB. Please choose a smaller file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError("");
  }

async function handleExplainDocument() {
  if (!selectedFile) {
    setError("Please select a PDF or TXT document first.");
    return;
  }

  setExplaining(true);
  setError("");
  setExplanationResult(null);

  try {
    const result = await explainMedicalDocument(selectedFile);
    setExplanationResult(result);
  } catch (err) {
    setError(
      err.message ||
        "We could not generate the explanation. Please try again."
    );
  } finally {
    setExplaining(false);
  }
}

  function speakText(text, { lang = "en-US", markdown = false } = {}) {
    if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
      setNotice("Text-to-speech is not supported by this browser.");
      return;
    }

    const speechText = markdown
      ? text
        .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?|```/g, " "))
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/^\s{0,3}#{1,6}\s*/gm, "")
        .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
        .replace(/\*\*(.*?)\*\*|__(.*?)__/g, "$1$2")
        .replace(/\*(.*?)\*|_(.*?)_/g, "$1$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+[.)]\s+/gm, "")
        .replace(/\|/g, ", ")
      : text;
    const plainText = speechText.replace(/\s+/g, " ").trim();
    if (!plainText) return;

    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(plainText);
    utterance.lang = lang;
    utterance.rate = 0.9;
    const voice = synthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith("en-"));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeakingExplanation(markdown);
    utterance.onend = () => setSpeakingExplanation(false);
    utterance.onerror = () => {
      setSpeakingExplanation(false);
      setNotice("Audio playback could not start. Check that your device has an English speech voice enabled.");
    };
    speechUtteranceRef.current = utterance;
    synthesis.resume();
    synthesis.speak(utterance);
  }

  function toggleExplanationSpeech() {
    if (speakingExplanation) {
      window.speechSynthesis?.cancel();
      setSpeakingExplanation(false);
      return;
    }

    speakText(explanationResult.explanation, { lang: "en-US", markdown: true });
  }

  function renderUploadWorkspace() {
    return (
      <section className="workspace-card" id="document-workspace">
        <div className="workspace-heading">
          <div className="workspace-icon">
            <FileText size={25} />
          </div>
          <div>
            <span className="eyebrow">{t("DOCUMENT WORKSPACE")}</span>
            <h2>{t("Medical Report Simplifier")}</h2>
            <p>{t("Start by uploading a medical document.")}</p>
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
          <h3>{t("Upload your medical document")}</h3>
          <p>{t("Drag and drop your file here, or choose a file from your device.")}</p>
          <p className="file-hint">{t("Supported formats: PDF and TXT · Maximum 10 MB")}</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="visually-hidden"
            aria-label={t("Choose medical document")}
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />

          <button
            className="button button-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={18} />
            {t("Choose document")}
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
                aria-label={t("Remove selected file")}
                onClick={() => {
                  setSelectedFile(null);
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
            {t("The backend is not connected. Start your FastAPI server on port 8000 before uploading.")}
          </div>
        )}

        {error && <div className="inline-error" role="alert">{t(error)}</div>}

<button
  className="button button-secondary upload-submit"
  onClick={handleExplainDocument}
  disabled={
    explaining ||
    backendStatus !== "connected" ||
    !selectedFile
  }
>
  {explaining ? (
    <>
      <LoaderCircle size={19} className="spin" />
      {t("Explaining with Gemma...")}
    </>
  ) : (
    <>
      <Sparkles size={19} />
      {t("Explain with Gemma")}
    </>
  )}
</button>


{explanationResult && (
  <section className="extraction-result" aria-live="polite">
    <div className="result-heading">
      <div>
        <Sparkles size={22} />
        <h3>{t("Medical Report Explanation")}</h3>
      </div>

      <button
        className="small-action"
        type="button"
        aria-label={t(speakingExplanation ? "Stop reading" : "Read aloud in English")}
        onClick={toggleExplanationSpeech}
      >
        {speakingExplanation ? <Square size={15} /> : <Volume2 size={16} />}
        {t(speakingExplanation ? "Stop reading" : "Read aloud in English")}
      </button>
    </div>

    <p className="result-note">
      AI-generated explanation using {explanationResult.model}.
    </p>

    <div className="explanation-content">
      <Suspense fallback={null}>
        <ExplanationMarkdown>{explanationResult.explanation}</ExplanationMarkdown>
      </Suspense>
    </div>

    <div className="inline-warning">
      {explanationResult.disclaimer}
    </div>
  </section>
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
              {t("HEALTHCARE, MADE EASIER")}
            </div>
            <h2>{t("Your health journey, ")}<span>{t("made simpler.")}</span></h2>
            <p>
              {t("Understand your medical information, stay organized, and take your next healthcare step with confidence.")}
            </p>
            <button
              className="button button-white"
              onClick={() => navigateTo("Medical Reports")}
            >
              {t("Simplify a report")} <ArrowRight size={18} />
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
              <span className="eyebrow">{t("YOUR HEALTH TOOLS")}</span>
              <h2>{t("What would you like to do?")}</h2>
              <p>{t("Choose a service to get started.")}</p>
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
                  <span className="feature-tag">{t(feature.tag)}</span>
                  <h3>{t(feature.title)}</h3>
                  <p>{t(feature.description)}</p>
                  <button
                    className="feature-link"
                    onClick={() => navigateTo(feature.page)}
                  >
                    {t(feature.action)}
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
              <span className="eyebrow">{t("DESIGNED FOR EVERYONE")}</span>
              <h3>{t("Your comfort comes first")}</h3>
              <p>
                {t("Adjust text size and contrast to make the interface more comfortable to use.")}
              </p>
              <div className="accessibility-actions">
                <button
                  className={`setting-chip ${largeText ? "setting-active" : ""}`}
                  onClick={() => setLargeText((value) => !value)}
                  aria-pressed={largeText}
                >
                  <Plus size={16} /> {largeText ? t("Normal text") : t("Larger text")}
                </button>
                <button
                  className={`setting-chip ${highContrast ? "setting-active" : ""}`}
                  onClick={() => setHighContrast((value) => !value)}
                  aria-pressed={highContrast}
                >
                  <Eye size={16} /> {highContrast ? t("Standard contrast") : t("High contrast")}
                </button>
              </div>
            </div>
          </div>

          <div className="info-card privacy-card">
            <div className="privacy-icon">
              <ShieldCheck size={25} />
            </div>
            <span className="eyebrow">{t("YOUR INFORMATION MATTERS")}</span>
            <h3>{t("Care with confidence")}</h3>
            <p>
              {t("This prototype processes uploaded documents through your local backend. Use fictional documents while testing.")}
            </p>
            <div className="privacy-note">
              <CheckCircle2 size={17} />
              {t("Local prototype · No document history saved")}
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
            <span className="eyebrow">{t("YOUR HEALTH TOOLS")}</span>
            <h2>{t("Medical Reports")}</h2>
            <p>{t(pageDescriptions[activePage])}</p>
          </div>
          {renderUploadWorkspace()}
        </>
      );
    }

    if (activePage === "Find health videos") {
      return (
        <section className="workspace-card video-search-card">
          <div className="workspace-heading">
            <div className="workspace-icon">
              <Stethoscope size={25} />
            </div>
            <div>
              <span className="eyebrow">{t("HEALTH EDUCATION")}</span>
              <h2>{t("Find health videos")}</h2>
              <p>{t("Search YouTube for videos about a disease or health topic.")}</p>
            </div>
          </div>
          <form className="video-search-form" onSubmit={searchHealthVideos}>
            <label className="visually-hidden" htmlFor="health-video-search">
              {t("Disease or health topic")}
            </label>
            <input
              id="health-video-search"
              className="video-search-input"
              type="search"
              value={youtubeKeyword}
              onChange={(event) => setYoutubeKeyword(event.target.value)}
              placeholder={t("For example, diabetes")}
              maxLength={120}
              required
            />
            <button className="button button-primary" type="submit">
              <Search size={18} /> {t("Search YouTube")}
            </button>
          </form>
          <p className="video-search-note">
            {t("Videos open on YouTube. Discuss medical information with a qualified healthcare professional.")}
          </p>
        </section>
      );
    }

    if (activePage === "Reminders") {
      return <Reminders medication={medication} backendStatus={backendStatus} t={t} language={language} />;
    }

    if (activePage === "Doctor Visit Notes") {
      return <DoctorVisitNotes t={t} language={language} />;
    }

    if (activePage === "Health FAQ Chat") {
      return <FaqChat t={t} />;
    }

    if (activePage === "Nearby Medical Stores") {
      return <NearbyMedicalStores t={t} />;
    }

    return (
      <section className="coming-page">
        <div className={`coming-icon ${currentFeature?.color || "mint"}`}>
          <Icon size={34} />
        </div>
        <span className="eyebrow">{t("UNMYST HEALTH TOOLS")}</span>
        <h2>{t(activePage)}</h2>
        <p className="coming-description">
          {t(pageDescriptions[activePage] || "Explore accessible healthcare information and tools.")}
        </p>
        <div className="coming-status">
          <Clock3 size={18} />
          {t("Interface ready · Feature integration pending")}
        </div>

        <button
          className="button button-primary"
          onClick={() => navigateTo("Dashboard")}
        >
          <Home size={18} /> {t("Back to dashboard")}
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
            <small>{t("Healthcare, understood.")}</small>
          </span>
        </button>

        <div className="nav-caption">{t("MENU")}</div>
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
                <span>{t(item.label)}</span>
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
            <strong>{t("Need a little help?")}</strong>
            <p>{t("We are here to make healthcare easier to understand.")}</p>
            <button
              onClick={() =>
                setNotice("Help centre integration is planned for a future update.")
              }
            >
              {t("Get help")} <ArrowRight size={16} />
            </button>
          </div>

          <button
            className="nav-item settings-nav"
            onClick={() =>
              setNotice("Use the accessibility controls on the dashboard to adjust text and contrast.")
            }
          >
            <Settings size={20} />
            <span>{t("Accessibility settings")}</span>
          </button>

          <div className="sidebar-footer">
            <span className="footer-dot" />
            {t("Built with care for accessible healthcare")}
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
              <strong>{t(activePage)}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <label className="language-picker">
              <Languages size={17} aria-hidden="true" />
              <span className="visually-hidden">{t("Language")}</span>
              <select
                aria-label={t("Language")}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </select>
            </label>
            <div className={`connection-pill ${backendStatus}`}>
              <span className="connection-dot" />
              {backendStatus === "checking"
                ? t("Connecting...")
                : backendStatus === "connected"
                  ? t("System connected")
                  : t("Backend offline")}
            </div>

            <button
              className="topbar-icon"
              aria-label={t("Notifications")}
              onClick={() => navigateTo("Reminders")}
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
                    <CalendarDays size={15} /> {t("YOUR PERSONAL HEALTH SPACE")}
                  </span>
                  <h1>{t("Welcome to UNMYST")} <span className="wave">✳</span></h1>
                  <p>{t("Clearer information. More confident healthcare decisions.")}</p>
                </div>
                <button
                  className="button button-secondary heading-help"
                  onClick={() =>
                    setNotice("Choose any tool from the dashboard or navigation menu to get started.")
                  }
                >
                  <CircleHelp size={18} /> {t("How it works")}
                </button>
              </div>
              {renderDashboard()}
            </>
          ) : (
            <>
              <div className="page-heading inner-page-heading">
                <div>
                  <span className="eyebrow">
                    <Activity size={15} /> {t("YOUR PERSONAL HEALTH SPACE")}
                  </span>
                  <h1>{t(activePage)}</h1>
                  <p>{t(pageDescriptions[activePage] || "Your healthcare, made easier.")}</p>
                </div>
                <button
                  className="button button-secondary heading-help"
                  onClick={() => navigateTo("Dashboard")}
                >
                  <Home size={17} /> {t("Dashboard")}
                </button>
              </div>
              {renderFeaturePage()}
            </>
          )}

          {notice && (
            <div className="global-notice" role="status">
              <CheckCircle2 size={18} />
              <span>{t(notice)}</span>
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
            <span>{t("Making healthcare information easier to understand.")}</span>
            <div className="footer-links">
              <span><ShieldCheck size={15} /> {t("Accessibility first")}</span>
              <span><Languages size={15} /> {t("Inclusive by design")}</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;