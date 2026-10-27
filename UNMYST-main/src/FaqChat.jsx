import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, RotateCcw, Send, UserRound } from "lucide-react";

const FAQS = [
  {
    id: "reports",
    question: "How do I upload a medical report?",
    answer: "Open Medical Reports and choose a PDF or TXT file up to 10 MB. Scanned image-only documents need OCR, which is not currently included.",
    terms: ["report", "upload", "pdf", "txt", "document", "रिपोर्ट", "अपलोड", "दस्तावेज", "నివేదిక", "అప్‌లోడ్", "పత్రం"],
  },
  {
    id: "reminders",
    question: "How do I set a medicine reminder?",
    answer: "Open Reminders, select Add medicine, and enter the medicine name, schedule, and reminder times. Follow your clinician's instructions for the medicine and dosage.",
    terms: ["reminder", "reminders", "medicine reminder", "medication reminder", "medicine alarm", "रिमाइंडर", "दवा याद", "మందుల రిమైండర్", "రిమైండర్"],
  },
  {
    id: "recordings",
    question: "How do I record a doctor visit?",
    answer: "Open Doctor Visit Notes and select Start recording. Allow microphone access and get consent from everyone before recording. Audio is saved in this browser and is not uploaded.",
    terms: ["record", "recording", "audio", "doctor visit", "microphone", "रिकॉर्ड", "रिकॉर्डिंग", "माइक्रोफ़ोन", "రికార్డ్", "రికార్డింగ్", "మైక్రోఫోన్"],
  },
  {
    id: "storage",
    question: "Where are visit recordings stored?",
    answer: "Visit recordings are stored in this browser on this device. They are not uploaded to a server. You can play, download, or delete them from Doctor Visit Notes.",
    terms: ["stored", "storage", "saved", "private", "uploaded", "कहां सेव", "स्टोरेज", "లోకల్", "ఎక్కడ సేవ్", "నిల్వ"],
  },
  {
    id: "transcription",
    question: "Can recordings be transcribed?",
    answer: "Automatic transcription is not included in this API-free version. Recordings can be played or downloaded for now.",
    terms: ["transcribe", "transcription", "transcript", "speech to text", "text from audio", "ट्रांसक्रिप्शन", "लिखित रूप", "ట్రాన్స్‌క్రిప్షన్", "టెక్స్ట్‌గా"],
  },
  {
    id: "language",
    question: "How do I change the app language?",
    answer: "Use the language selector in the top bar. The app currently supports English, Hindi, and Telugu.",
    terms: ["language", "translate", "hindi", "telugu", "भाषा", "हिंदी", "तेलुगु", "భాష", "హిందీ", "తెలుగు"],
  },
  {
    id: "videos",
    question: "How do I find health videos?",
    answer: "Open Find health videos, enter a disease or health topic, then select Search YouTube. The results open on YouTube. Check health information with a qualified healthcare professional.",
    terms: ["youtube", "video", "videos", "health video", "यूट्यूब", "वीडियो", "ఆరోగ్య వీడియో", "యూట్యూబ్", "వీడియో"],
  },
  {
    id: "gemma",
    question: "How do I explain a medical report?",
    answer: "In Medical Reports, upload a supported file and choose Explain with Gemma. This is separate from the FAQ chat.",
    terms: ["gemma", "explain report", "explanation", "medical report explanation", "जेम्मा", "रिपोर्ट समझ", "జెమ్మా", "నివేదిక వివరణ"],
  },
  {
    id: "medical-advice",
    question: "Can you diagnose an illness or recommend medicine?",
    answer: "I can answer questions about using UNMYST, but I cannot diagnose conditions or recommend medicines or dosages. Please ask a qualified healthcare professional. For an emergency, contact your local emergency service.",
    terms: ["diagnose", "diagnosis", "symptom", "symptoms", "treatment", "disease", "illness", "which medicine", "what medicine", "dosage", "dose advice", "इलाज", "लक्षण", "दवा बताएं", "निदान", "खुराक", "వ్యాధి", "లక్షణాలు", "చికిత్స", "ఏ మందు", "మోతాదు", "నిర్ధారణ"],
  },
];

const SUGGESTED_IDS = ["reports", "reminders", "recordings", "language"];
const WELCOME_MESSAGE = "Hi. I can answer common questions about using UNMYST. Choose a suggestion or type a question.";
const FALLBACK_MESSAGE = "I don't have a prepared answer for that yet. I can help with reports, reminders, recordings, languages, and health videos. For medical advice, please contact a qualified healthcare professional.";

function normalize(text) {
  return text.toLocaleLowerCase().normalize("NFKC").replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
}

function getAnswer(question) {
  const normalizedQuestion = normalize(question);
  const medicalAdviceFaq = FAQS.find((faq) => faq.id === "medical-advice");
  if (medicalAdviceFaq.terms.some((term) => normalizedQuestion.includes(normalize(term)))) {
    return medicalAdviceFaq.answer;
  }

  const ranked = FAQS.map((faq) => ({
    faq,
    score: faq.terms.reduce((score, term) => score + (normalizedQuestion.includes(normalize(term)) ? 1 : 0), 0),
  })).sort((first, second) => second.score - first.score);

  return ranked[0]?.score > 0 ? ranked[0].faq.answer : FALLBACK_MESSAGE;
}

export default function FaqChat({ t }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    { id: "welcome", role: "assistant", text: WELCOME_MESSAGE },
  ]);
  const [announcement, setAnnouncement] = useState("");
  const conversationEndRef = useRef(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function askQuestion(value) {
    const userQuestion = value.trim();
    if (!userQuestion) return;

    const answer = getAnswer(userQuestion);
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-user`, role: "user", text: userQuestion },
      { id: `${Date.now()}-assistant`, role: "assistant", text: answer },
    ]);
    setAnnouncement(t("Answer added to chat."));
    setQuestion("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    askQuestion(question);
  }

  function resetChat() {
    setMessages([{ id: `${Date.now()}-welcome`, role: "assistant", text: WELCOME_MESSAGE }]);
    setAnnouncement(t("Chat cleared."));
  }

  return (
    <section className="workspace-card faq-chat-card">
      <div className="faq-chat-heading">
        <div className="workspace-icon"><MessageCircle size={25} /></div>
        <div>
          <span className="eyebrow">{t("QUICK SUPPORT")}</span>
          <h2>{t("Health FAQ Chat")}</h2>
          <p>{t("Ask about using UNMYST and its features.")}</p>
        </div>
        <button
          className="icon-button faq-reset-button"
          type="button"
          aria-label={t("Clear chat")}
          title={t("Clear chat")}
          onClick={resetChat}
        >
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="faq-safety-note">
        {t("This chat uses prepared answers and does not provide diagnosis or medication advice.")}
      </div>

      <div className="faq-conversation" role="log" aria-label={t("Chat messages")} aria-live="polite">
        {messages.map((message) => (
          <div className={`faq-message faq-message-${message.role}`} key={message.id}>
            <span className="faq-message-icon" aria-hidden="true">
              {message.role === "assistant" ? <Bot size={17} /> : <UserRound size={17} />}
            </span>
            <p>{t(message.text)}</p>
          </div>
        ))}
        <div ref={conversationEndRef} />
      </div>

      <span className="visually-hidden" role="status">{announcement}</span>

      <div className="faq-suggestions" aria-label={t("Suggested questions")}>
        {SUGGESTED_IDS.map((id) => {
          const faq = FAQS.find((item) => item.id === id);
          return (
            <button
              className="faq-suggestion"
              key={faq.id}
              type="button"
              onClick={() => askQuestion(t(faq.question))}
            >
              {t(faq.question)}
            </button>
          );
        })}
      </div>

      <form className="faq-input-form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="faq-question">{t("Your question")}</label>
        <input
          id="faq-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("Type a question about UNMYST...")}
          maxLength={300}
          autoComplete="off"
        />
        <button className="button button-primary" type="submit" disabled={!question.trim()}>
          <Send size={17} /> {t("Send")}
        </button>
      </form>
    </section>
  );
}
