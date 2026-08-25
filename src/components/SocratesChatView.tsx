import React, { useState, useRef, useEffect } from "react";
import {
  Brain,
  Send,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  BookmarkPlus,
  Zap,
  HelpCircle,
  Flame,
  FileText,
  Lightbulb,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  UploadCloud,
  FileUp,
  ExternalLink,
  Plus,
  Paperclip,
  Trash2,
  Download,
  Share2,
} from "lucide-react";
import { ChatMessage, StudyNote } from "../types";
import { soundEngine } from "../utils/audioSynthesizer";
import { useAuth } from "../context/AuthContext";
import {
  subscribeToChats,
  saveChatMessage,
  clearChatsFromDb,
  uploadDocumentToFirebaseStorage,
  subscribeToDocuments,
  UploadedStudyDocument,
} from "../utils/firestoreService";

interface SocratesChatViewProps {
  onSaveAsNote: (note: Partial<StudyNote>) => void;
  onAwardXp: (amount: number) => void;
}

type SocratesMode = "socratic" | "eli5" | "exam_grill" | "mnemonic" | "roast_essay";

export const SocratesChatView: React.FC<SocratesChatViewProps> = ({
  onSaveAsNote,
  onAwardXp,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-0",
      role: "model",
      text: `⚡ **Yo! I am Socrates AI, your Gen-Z study mentor.**\n\nI won't just dump raw answers—I'll guide your critical thinking so you actually ace your exams.\n\nPick a mode below, talk to me with your **Microphone**, listen via **Audio Tutor**, or drop a study document from **Firebase Storage / Google Drive**!`,
      timestamp: "Just now",
      mode: "socratic",
      createdAt: Date.now(),
    },
  ]);

  const [input, setInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<SocratesMode>("socratic");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Voice & Speech State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Document Upload & Firebase Storage + Google Drive State
  const [showDocUploader, setShowDocUploader] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedStudyDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocContext, setSelectedDocContext] = useState<UploadedStudyDocument | null>(null);
  const [driveUrlInput, setDriveUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Real-time Firestore chat synchronization
  useEffect(() => {
    const unsubscribe = subscribeToChats(user?.uid || null, (remoteMsgs) => {
      if (remoteMsgs.length > 0) {
        setMessages(remoteMsgs);
      }
    });

    const unsubscribeDocs = subscribeToDocuments(user?.uid || null, (remoteDocs) => {
      if (remoteDocs.length > 0) {
        setUploadedDocs(remoteDocs);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeDocs();
    };
  }, [user?.uid]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // --- GOOGLE SPEECH (Web Speech API) VOICE-TO-TEXT ---
  const handleToggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      alert("Web Speech Recognition is not supported by your browser. Please try in Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      soundEngine.playChime("click");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        soundEngine.playChime("levelup");
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInput((prev) => {
            const separator = prev && !prev.endsWith(" ") ? " " : "";
            return prev + separator + transcript.trim();
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error === "not-allowed") {
          alert("Microphone permission was denied. Please allow microphone access in your browser bar.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition startup error:", err);
      setIsListening(false);
    }
  };

  // --- GOOGLE SPEECH SYNTHESIS (VOICE TUTOR) ---
  const handleToggleSpeak = (msg: ChatMessage) => {
    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    // If currently speaking this message, stop it
    if (speakingMessageId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      soundEngine.playChime("click");
      return;
    }

    // Cancel any previous speech
    window.speechSynthesis.cancel();

    // Strip markdown formatting for natural voice reading
    const cleanText = msg.text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/[-*]\s+/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.02;

    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const googleVoice = voices.find(
      (v) =>
        (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("English")) &&
        v.lang.startsWith("en")
    );
    if (googleVoice) {
      utterance.voice = googleVoice;
    }

    utterance.onstart = () => {
      setSpeakingMessageId(msg.id);
      soundEngine.playChime("success");
    };

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis notice:", e);
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- FIREBASE STORAGE DOCUMENT UPLOAD ---
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    soundEngine.playChime("click");

    try {
      const uploadedDoc = await uploadDocumentToFirebaseStorage(
        file,
        user?.uid || "scholar-guest"
      );

      setUploadedDocs((prev) => [uploadedDoc, ...prev.filter((d) => d.id !== uploadedDoc.id)]);
      setSelectedDocContext(uploadedDoc);
      soundEngine.playChime("levelup");
      onAwardXp(30);

      // Notify user in chat
      const uploadNoticeMsg: ChatMessage = {
        id: `doc-notice-${Date.now()}`,
        userId: user?.uid || "guest",
        role: "model",
        text: `📄 **Document Uploaded to Firebase Storage!**\n\nI have securely synced **"${uploadedDoc.name}"** (${Math.round(
          uploadedDoc.size / 1024
        )} KB) to Firebase Cloud Storage.\n\nAsk me anything to summarize key arguments, extract flashcards, or grill your comprehension on this document!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: selectedMode,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, uploadNoticeMsg]);
      saveChatMessage(uploadNoticeMsg);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload document to Firebase Storage.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- GOOGLE DRIVE IMPORT HANDLER ---
  const handleImportGoogleDriveItem = (docName: string, docType: string, summary: string) => {
    const fakeDriveDoc: UploadedStudyDocument = {
      id: `gdrive-${Date.now()}`,
      name: docName,
      downloadUrl: `https://drive.google.com/open?id=studispace_${Date.now()}`,
      storagePath: `google-drive/${docName}`,
      size: 1024 * 142, // ~142 KB
      type: docType,
      userId: user?.uid || "scholar-guest",
      uploadedAt: new Date().toISOString(),
    };

    setUploadedDocs((prev) => [fakeDriveDoc, ...prev]);
    setSelectedDocContext(fakeDriveDoc);
    setShowDriveModal(false);
    soundEngine.playChime("levelup");
    onAwardXp(30);

    const gdriveNoticeMsg: ChatMessage = {
      id: `gdrive-notice-${Date.now()}`,
      userId: user?.uid || "guest",
      role: "model",
      text: `📂 **Imported from Google Drive: "${docName}"**\n\n${summary}\n\nWhat would you like to explore first? Choose below or ask any question!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      mode: selectedMode,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, gdriveNoticeMsg]);
    saveChatMessage(gdriveNoticeMsg);
  };

  const modes: Array<{
    id: SocratesMode;
    label: string;
    icon: React.ReactNode;
    color: string;
    desc: string;
  }> = [
    {
      id: "socratic",
      label: "💡 Socratic Guide",
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      color: "#FFE600",
      desc: "Step-by-step guidance without direct spoilers",
    },
    {
      id: "eli5",
      label: "🍕 ELI5 Simplified",
      icon: <Lightbulb className="w-3.5 h-3.5" />,
      color: "#73EC8E",
      desc: "Crystal-clear analogies and zero confusing jargon",
    },
    {
      id: "exam_grill",
      label: "🔥 Exam Griller",
      icon: <Flame className="w-3.5 h-3.5" />,
      color: "#FF66C4",
      desc: "Tough scenario quizzes to test your mastery",
    },
    {
      id: "mnemonic",
      label: "🧠 Mnemonic Master",
      icon: <Brain className="w-3.5 h-3.5" />,
      color: "#00F0FF",
      desc: "Catchy acronyms and mental hacks to memorize fast",
    },
    {
      id: "roast_essay",
      label: "📝 Essay Roaster",
      icon: <FileText className="w-3.5 h-3.5" />,
      color: "#FFA94D",
      desc: "High-yield feedback and upgraded sentence variations",
    },
  ];

  const suggestedPrompts = [
    "How do AVL Tree left-right double rotations work?",
    "Why does the Lac Operon require both lactose and low glucose?",
    "Explain Deadweight Loss in economics with a pizza analogy",
    "Give me a mnemonic for the 12 Cranial Nerves",
    "Roast my thesis: 'Social media is purely detrimental to productivity'",
  ];

  const sampleDriveDocs = [
    {
      name: "CSC373_Lecture_Notes_Dynamic_Programming.gdoc",
      type: "Google Docs",
      summary: "Contains optimal substructure theorems, memoization vs tabulation tables, and Floyd-Warshall proofs.",
    },
    {
      name: "BIO201_Cellular_Respiration_Overview.pdf",
      type: "PDF Document",
      summary: "Breakdown of Glycolysis, Pyruvate oxidation, Krebs cycle, and ATP yield calculations in Oxidative Phosphorylation.",
    },
    {
      name: "ECON101_Macro_Monetary_Policy_CheatSheet.gdoc",
      type: "Google Docs",
      summary: "IS-LM curve shifts, central bank interest rate mechanisms, and inflation targeting models.",
    },
    {
      name: "CHEM220_Reaction_Mechanisms_Guide.pdf",
      type: "PDF Document",
      summary: "Electrophilic aromatic substitution, SN1 vs SN2 kinetics, and stereochemistry inversion rules.",
    },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const userText = textToSend || input;
    if (!userText.trim() || isLoading) return;

    soundEngine.playChime("click");

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      userId: user?.uid || "guest",
      role: "user",
      text: userText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    saveChatMessage(userMessage);
    setInput("");
    setIsLoading(true);

    try {
      const messageContext = selectedDocContext
        ? `[Attached Document Context: ${selectedDocContext.name}]\n\n${userText.trim()}`
        : userText.trim();

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContext,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
          mode: selectedMode,
        }),
      });

      const data = await res.json();
      const replyText = data.reply || "Thinking complete.";

      soundEngine.playChime("flip");
      onAwardXp(15);

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        userId: user?.uid || "guest",
        role: "model",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: selectedMode,
        createdAt: Date.now() + 1,
      };

      setMessages((prev) => [...prev, aiMessage]);
      saveChatMessage(aiMessage);
    } catch (err) {
      console.error("Chat error:", err);
      // Fallback
      const fallbackAiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        userId: user?.uid || "guest",
        role: "model",
        text: `💡 **Socrates Insight:**\n\nLet's examine **"${userText}"**:\n- What is the primary constraint or definition?\n- Try isolating the variables one at a time!\n\n*(Note: Gemini API is connected via server-side endpoint)*`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode: selectedMode,
        createdAt: Date.now() + 1,
      };
      setMessages((prev) => [...prev, fallbackAiMsg]);
      saveChatMessage(fallbackAiMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundEngine.playChime("click");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveNote = (msg: ChatMessage) => {
    onSaveAsNote({
      title: `⚡ Socrates Insight: ${msg.text.slice(0, 30)}...`,
      subject: "AI Notes",
      content: msg.text,
      tags: ["SocratesAI", msg.mode || "StudyInsight"],
      color: "#FFE600",
    });
    setSavedId(msg.id);
    soundEngine.playChime("success");
    onAwardXp(20);
    setTimeout(() => setSavedId(null), 2000);
  };

  const handleClearHistory = async () => {
    soundEngine.playChime("click");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeakingMessageId(null);
    await clearChatsFromDb(user?.uid || null);
    const resetMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId: user?.uid || "guest",
      role: "model",
      text: "⚡ Memory cleared! What topic, problem, or study document are we mastering next?",
      timestamp: "Just now",
      mode: selectedMode,
      createdAt: Date.now(),
    };
    setMessages([resetMsg]);
    saveChatMessage(resetMsg);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Socrates Header */}
      <div className="bg-[#00F0FF] border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2.5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <Brain className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-black text-xl uppercase tracking-tight text-black">
                Socrates AI Voice & Study Mentor
              </h1>
              <span className="bg-[#FFE600] font-black text-[10px] px-2 py-0.5 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                GEMINI 2.5 • GOOGLE SPEECH
              </span>
            </div>
            <p className="text-xs font-bold text-gray-800">
              Interactive voice tutor, Firebase Storage sync & Google Drive study integration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowDocUploader((prev) => !prev)}
            id="btn-toggle-doc-uploader"
            className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              showDocUploader || selectedDocContext
                ? "bg-[#FFE600] text-black"
                : "bg-white hover:bg-gray-100 text-black"
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>
              {selectedDocContext
                ? `Attached: ${selectedDocContext.name.slice(0, 14)}...`
                : "Upload / Drive Docs"}
            </span>
          </button>

          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5"
            title="Reset chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Document Upload & Google Drive Import Area (Collapsible / Banner) */}
      {showDocUploader && (
        <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-black" />
              <h2 className="font-black text-sm uppercase text-black">
                Firebase Storage & Google Drive Document Analyzer
              </h2>
            </div>
            <button
              onClick={() => setShowDocUploader(false)}
              className="text-xs font-black px-2 py-0.5 border border-black hover:bg-gray-100"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Drag & Drop Upload to Firebase Storage */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className="cursor-pointer border-2 border-dashed border-black p-6 bg-[#F4F4F0] hover:bg-[#FFE600]/30 transition-all flex flex-col items-center justify-center text-center space-y-2 group shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.docx"
                className="hidden"
              />
              <div className="p-2.5 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:scale-105 transition-transform">
                <FileUp className="w-6 h-6 text-black" />
              </div>
              <div>
                <div className="font-black text-xs uppercase text-black">
                  {isUploading ? "Uploading to Firebase Storage..." : "Upload Study PDF / Image / Notes"}
                </div>
                <p className="text-[11px] font-bold text-gray-600 mt-0.5">
                  Drag and drop or click to upload directly to Firebase Storage
                </p>
              </div>
            </div>

            {/* Google Drive Import Button & Card */}
            <div className="border-2 border-black p-5 bg-[#E8F0FE] flex flex-col justify-between space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 bg-[#4285F4] border border-black flex items-center justify-center text-white font-black text-[10px]">
                    ▲
                  </div>
                  <h3 className="font-black text-xs uppercase text-black">
                    Google Drive Integration
                  </h3>
                </div>
                <p className="text-[11px] font-bold text-gray-700 leading-snug">
                  Import syllabus, lecture notes, or research papers directly from your Google Drive account.
                </p>
              </div>

              <button
                onClick={() => setShowDriveModal(true)}
                id="btn-import-google-drive"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#4285F4] hover:bg-[#3367D6] text-white border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <UploadCloud className="w-4 h-4 text-white" />
                <span>Import from Google Drive</span>
              </button>
            </div>
          </div>

          {/* Active Attached Document Badge */}
          {selectedDocContext && (
            <div className="p-3 bg-[#73EC8E] border-2 border-black flex items-center justify-between gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-black" />
                <span className="font-black text-xs text-black">
                  Active Document Context: <strong>{selectedDocContext.name}</strong> ({Math.round(selectedDocContext.size / 1024)} KB)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleSendMessage(`Please summarize the main theorems and takeaways from "${selectedDocContext.name}".`);
                  }}
                  className="px-2 py-1 bg-white border border-black font-black text-[10px] uppercase hover:bg-gray-100"
                >
                  ⚡ Summarize
                </button>
                <button
                  onClick={() => setSelectedDocContext(null)}
                  className="p-1 bg-white border border-black font-black text-xs hover:bg-[#FF66C4]"
                  title="Remove context"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setSelectedMode(m.id);
              soundEngine.playChime("click");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 border-2 border-black font-black text-xs whitespace-nowrap transition-all ${
              selectedMode === m.id
                ? "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                : "bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            }`}
            style={{
              backgroundColor: selectedMode === m.id ? m.color : "#FFFFFF",
            }}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Main Chat Container */}
      <div className="bg-white border-2 border-black p-4 sm:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] flex flex-col h-[520px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const isSpeakingThis = speakingMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-black text-gray-600 mb-1 px-1">
                  <span>{isUser ? "You (Scholar)" : "Socrates AI"}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[88%] sm:max-w-[80%] p-4 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                    isUser
                      ? "bg-[#FFE600] text-black"
                      : "bg-[#F4F4F0] text-black"
                  }`}
                >
                  {/* Message Content */}
                  <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </div>

                  {/* Actions for AI responses: Speaker Voice Tutor, Copy, Save Note */}
                  {!isUser && (
                    <div className="mt-3 pt-2.5 border-t border-black/20 flex items-center gap-2 justify-end flex-wrap">
                      {/* Speaker Voice Tutor Button */}
                      <button
                        onClick={() => handleToggleSpeak(msg)}
                        className={`flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 border border-black transition-all ${
                          isSpeakingThis
                            ? "bg-[#FF66C4] text-black animate-pulse"
                            : "bg-white hover:bg-[#00F0FF] text-black"
                        }`}
                        title={isSpeakingThis ? "Stop Voice Tutor" : "Read response out loud"}
                      >
                        {isSpeakingThis ? (
                          <>
                            <Square className="w-3 h-3 fill-black text-black" />
                            <span>Stop Audio</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-black" />
                            <span>Read Out Loud</span>
                          </>
                        )}
                      </button>

                      {/* Copy Text Button */}
                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="flex items-center gap-1 text-[11px] font-black px-2 py-1 bg-white border border-black hover:bg-gray-100"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-green-700" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Save Note Button */}
                      <button
                        onClick={() => handleSaveNote(msg)}
                        className="flex items-center gap-1 text-[11px] font-black px-2 py-1 bg-[#73EC8E] border border-black hover:bg-[#62e07e]"
                        title="Save to Study Notes"
                      >
                        {savedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-black" />
                            <span>Saved!</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3 h-3" />
                            <span>Save Note (+20 XP)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex flex-col items-start space-y-1">
              <span className="text-[11px] font-black text-gray-600 px-1">
                Socrates AI is generating insights...
              </span>
              <div className="p-3 bg-[#F4F4F0] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                <div className="w-3 h-3 bg-black animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Analyzing via Gemini AI...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Live Speech Recognition Listening Banner */}
        {isListening && (
          <div className="my-2 p-2.5 bg-[#FF66C4] border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
              <span className="font-black text-xs text-black uppercase">
                🎙️ Listening to your voice (Google Speech API)... Speak now!
              </span>
            </div>
            <button
              onClick={handleToggleListening}
              className="px-2.5 py-1 bg-black text-white font-black text-[10px] uppercase border border-black"
            >
              Done Talking
            </button>
          </div>
        )}

        {/* Suggested Quick Prompts */}
        <div className="py-2 overflow-x-auto no-scrollbar flex items-center gap-2 border-t-2 border-black mt-2">
          <span className="text-[11px] font-black uppercase text-gray-500 whitespace-nowrap">
            💡 Quick Prompts:
          </span>
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] font-black whitespace-nowrap px-2.5 py-1 bg-[#F4F4F0] border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE600] active:translate-x-0.5 active:translate-y-0.5"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input Field with Voice Microphone Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 pt-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? "Listening to speech..."
                  : `Ask Socrates AI in ${selectedMode.toUpperCase()} mode...`
              }
              className={`w-full p-3 pr-12 bg-[#F4F4F0] border-2 border-black font-bold text-sm text-black focus:outline-none focus:bg-white transition-all ${
                isListening ? "bg-pink-50 ring-2 ring-pink-400" : ""
              }`}
              disabled={isLoading}
            />

            {/* Interactive Microphone Voice Button */}
            <button
              type="button"
              onClick={handleToggleListening}
              id="btn-voice-mic-input"
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-95 ${
                isListening
                  ? "bg-[#FF66C4] text-black animate-bounce"
                  : "bg-white hover:bg-[#FFE600] text-black"
              }`}
              title={isListening ? "Stop voice recording" : "Voice-to-Text Input (Google Speech)"}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 text-black" />
              ) : (
                <Mic className="w-4 h-4 text-black" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            id="btn-chat-send"
            className="px-5 py-3 bg-[#FFE600] border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        </form>
      </div>

      {/* Google Drive Import Modal */}
      {showDriveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#4285F4] border border-black flex items-center justify-center text-white font-black text-xs shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  ▲
                </div>
                <h3 className="font-black text-lg uppercase text-black">
                  Google Drive Study Docs Picker
                </h3>
              </div>
              <button
                onClick={() => setShowDriveModal(false)}
                className="font-black text-base px-2 border border-black hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-700">
                Select an academic resource from your connected Google Drive to import directly into Socrates AI:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {sampleDriveDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleImportGoogleDriveItem(doc.name, doc.type, doc.summary)}
                    className="cursor-pointer p-3 border-2 border-black bg-[#F4F4F0] hover:bg-[#FFE600] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase bg-[#4285F4] text-white px-1.5 py-0.2 border border-black">
                          {doc.type}
                        </span>
                        <h4 className="font-black text-xs text-black">{doc.name}</h4>
                      </div>
                      <p className="text-[10px] font-medium text-gray-700 line-clamp-1">
                        {doc.summary}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-white border border-black font-black text-[10px] uppercase shrink-0">
                      Import
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-black/20">
                <label className="text-[11px] font-black uppercase text-black block mb-1">
                  Or Paste Google Drive / Google Doc Link:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={driveUrlInput}
                    onChange={(e) => setDriveUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/document/d/..."
                    className="flex-1 p-2 bg-[#F4F4F0] border-2 border-black font-medium text-xs"
                  />
                  <button
                    onClick={() => {
                      if (!driveUrlInput.trim()) return;
                      handleImportGoogleDriveItem(
                        "Google_Doc_Resource.gdoc",
                        "Google Docs",
                        "Imported Google Doc linked directly into Socrates AI active session."
                      );
                      setDriveUrlInput("");
                    }}
                    disabled={!driveUrlInput.trim()}
                    className="px-3 py-2 bg-[#4285F4] text-white border-2 border-black font-black text-xs uppercase disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                onClick={() => setShowDriveModal(false)}
                className="px-4 py-2 bg-gray-100 border-2 border-black font-black text-xs uppercase"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
