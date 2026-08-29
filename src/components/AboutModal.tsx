import React, { useState } from "react";
import {
  X,
  Sparkles,
  Brain,
  Timer,
  Layers,
  CheckCircle,
  GraduationCap,
  Music,
  CheckSquare,
  BookOpen,
  Code2,
  Terminal,
  Zap,
  Globe,
  Award,
  Heart,
  Cpu,
  ShieldCheck,
  Flame,
} from "lucide-react";
import { soundEngine } from "../utils/audioSynthesizer";
import confetti from "canvas-confetti";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"overview" | "features" | "tech" | "creator">("overview");

  if (!isOpen) return null;

  const handleEasterEgg = () => {
    soundEngine.playChime("levelup");
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#FFF9E9] border-4 border-black w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[10px_10px_0px_0px_#000000] relative overflow-hidden">
        {/* Modal Top Bar */}
        <div className="bg-[#FFE600] border-b-4 border-black px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🚀</span>
            <div>
              <h2 className="font-black text-lg sm:text-xl uppercase tracking-tight text-black leading-none">
                About StudiSpace
              </h2>
              <p className="font-mono text-[11px] font-bold text-black uppercase tracking-wider mt-0.5">
                Academic Operating System v2.5
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playChime("click");
              onClose();
            }}
            className="p-1.5 bg-white hover:bg-black hover:text-white border-2 border-black font-black text-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b-2 border-black bg-white overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Overview", icon: <Sparkles className="w-4 h-4" />, bg: "#FFE600" },
            { id: "features", label: "Study Arsenal", icon: <Brain className="w-4 h-4" />, bg: "#73EC8E" },
            { id: "tech", label: "Architecture", icon: <Cpu className="w-4 h-4" />, bg: "#00F0FF" },
            { id: "creator", label: "Scholar Creed", icon: <Award className="w-4 h-4" />, bg: "#FF66C4" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundEngine.playChime("click");
                  setActiveTab(tab.id as any);
                }}
                className={`flex-1 min-w-[120px] py-2.5 px-3 font-black text-xs sm:text-sm uppercase flex items-center justify-center gap-1.5 border-r-2 last:border-r-0 border-black transition-all ${
                  isActive
                    ? "text-black shadow-inner"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
                style={{ backgroundColor: isActive ? tab.bg : undefined }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6 text-black selection:bg-[#FFE600]">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="p-4 bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                <div className="inline-block bg-black text-[#FFE600] font-mono text-[10px] font-bold px-2 py-0.5 uppercase mb-2">
                  ⚡ Mission & Philosophy
                </div>
                <h3 className="font-black text-xl sm:text-2xl uppercase tracking-tight leading-snug">
                  Built like a textbook, wired like a supercomputer.
                </h3>
                <p className="font-medium text-sm text-gray-800 mt-2 leading-relaxed">
                  StudiSpace is a unified Neo-Brutalist Academic Workspace designed to eliminate study friction, reinforce deep focus, and supercharge concept retention through AI-guided active recall.
                </p>
              </div>

              {/* Three Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#FFE600] border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="font-black text-sm uppercase flex items-center gap-1.5 mb-1 text-black">
                    <Brain className="w-4 h-4" />
                    <span>Active Recall</span>
                  </div>
                  <p className="text-xs font-semibold text-black/90">
                    No passive re-reading. Interactive quiz arenas, flashcard decks, and Socratic questioning force memory retrieval.
                  </p>
                </div>

                <div className="p-3.5 bg-[#FF66C4] border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="font-black text-sm uppercase flex items-center gap-1.5 mb-1 text-black">
                    <Timer className="w-4 h-4" />
                    <span>Deep Focus</span>
                  </div>
                  <p className="text-xs font-semibold text-black/90">
                    Customizable Pomodoro sprints backed by Web Audio ambient soundscapes to induce effortless flow state.
                  </p>
                </div>

                <div className="p-3.5 bg-[#73EC8E] border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="font-black text-sm uppercase flex items-center gap-1.5 mb-1 text-black">
                    <GraduationCap className="w-4 h-4" />
                    <span>GPA Velocity</span>
                  </div>
                  <p className="text-xs font-semibold text-black/90">
                    Real-time degree credit roadmap, cumulative GPA tracker, and what-if simulation to plan your academic horizon.
                  </p>
                </div>
              </div>

              {/* Quick Highlight Box */}
              <div className="p-3.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs uppercase">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>Interactive Audio & Gamification System Active</span>
                </div>
                <button
                  onClick={handleEasterEgg}
                  className="px-3 py-1 bg-[#FFE600] hover:bg-[#fff04d] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  Trigger Scholar Blast ✨
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === "features" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1 bg-[#00F0FF] border border-black font-black text-xs">AI</span>
                    <h4 className="font-black text-sm uppercase">Socrates AI Tutor</h4>
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    Multi-personality AI tutor featuring Socratic Dialogues (guided questions), ELI5 explanations, Exam Grill, Essay Roaster, and Mnemonic Forge.
                  </p>
                </div>

                <div className="p-3.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1 bg-[#FF66C4] border border-black font-black text-xs">⏱️</span>
                    <h4 className="font-black text-sm uppercase">Sprint Focus Timer</h4>
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    Customizable interval timer with quick, standard, and marathon presets linked directly to pending assignments and soundscapes.
                  </p>
                </div>

                <div className="p-3.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1 bg-[#73EC8E] border border-black font-black text-xs">🗂️</span>
                    <h4 className="font-black text-sm uppercase">Flashcard Decks</h4>
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    3-state mastery rating (New, Learning, Mastered), hints, progress metrics, and one-click AI generation for any subject.
                  </p>
                </div>

                <div className="p-3.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1 bg-[#C4B5FD] border border-black font-black text-xs">🎯</span>
                    <h4 className="font-black text-sm uppercase">Quiz Arena</h4>
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    High-stakes active testing with instant explanations, hint reveals, timer pressure, and persistent high-score tracking.
                  </p>
                </div>

                <div className="p-3.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1 bg-[#FF4B4B] text-white border border-black font-black text-xs">📊</span>
                    <h4 className="font-black text-sm uppercase">GPA Roadmap & Simulator</h4>
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    Total required credits roadmap, 4.0 & 10.0 scale GPA calculation, course categories, and forward-looking "What-If" grade targets.
                  </p>
                </div>

                <div className="p-3.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1 bg-[#48CAE4] border border-black font-black text-xs">🎧</span>
                    <h4 className="font-black text-sm uppercase">Synthesized Soundscapes</h4>
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    Zero-latency procedural sound synthesis: Rain, Coffee Shop, Lo-Fi Beat generator, White Noise, and Binaural Alpha Frequencies.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ARCHITECTURE & TECH */}
          {activeTab === "tech" && (
            <div className="space-y-4">
              <div className="p-4 bg-black text-[#73EC8E] font-mono text-xs border-2 border-black shadow-[4px_4px_0px_#000]">
                <div className="flex items-center gap-2 mb-2 pb-1 border-b border-[#73EC8E]/30 text-white font-bold">
                  <Terminal className="w-4 h-4" />
                  <span>STACK_SPECIFICATION.JSON</span>
                </div>
                <div className="space-y-1">
                  <div><span className="text-yellow-400 font-bold">"framework":</span> "React 19 + TypeScript + Vite",</div>
                  <div><span className="text-yellow-400 font-bold">"styling":</span> "Tailwind CSS (Neo-Brutalist System)",</div>
                  <div><span className="text-yellow-400 font-bold">"ai_core":</span> "Google Gemini 2.5 Flash + Local Qwen3 Fallback",</div>
                  <div><span className="text-yellow-400 font-bold">"database":</span> "Google Firebase Firestore Real-Time Sync",</div>
                  <div><span className="text-yellow-400 font-bold">"auth":</span> "Firebase Auth (Google OAuth & Email/Password)",</div>
                  <div><span className="text-yellow-400 font-bold">"audio":</span> "Web Audio API Procedural Synthesizer",</div>
                  <div><span className="text-yellow-400 font-bold">"runtime":</span> "Google Cloud Run / AI Studio Sandbox"</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="font-black text-xs uppercase flex items-center gap-1.5 mb-1 text-black">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Offline & Cloud Persistence</span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-700">
                    Real-time cloud synchronization with automatic local state caching ensures you never lose a note or session.
                  </p>
                </div>

                <div className="p-3 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <div className="font-black text-xs uppercase flex items-center gap-1.5 mb-1 text-black">
                    <Zap className="w-4 h-4 text-yellow-600" />
                    <span>Instant Response Time</span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-700">
                    Optimistic UI updates, procedural audio, and streaming AI responses guarantee zero lag during study sessions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCHOLAR CREED */}
          {activeTab === "creator" && (
            <div className="space-y-4">
              <div className="p-4 bg-[#FFDBEB] border-2 border-black shadow-[4px_4px_0px_#000]">
                <h4 className="font-black text-base uppercase text-pink-900 mb-1">
                  🎓 The StudiSpace Scholar Manifesto
                </h4>
                <p className="text-xs font-semibold text-pink-950 leading-relaxed">
                  "Excellence is not an accident. It is the result of continuous active recall, unbroken focus intervals, rigorous self-examination, and relentless curiosity."
                </p>
              </div>

              <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="font-bold text-gray-700">Application Name:</span>
                  <span className="font-black text-black">StudiSpace Academic OS</span>
                </div>
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="font-bold text-gray-700">Release Version:</span>
                  <span className="font-mono font-bold bg-[#FFE600] px-1.5 border border-black">v2.5.0 STABLE</span>
                </div>
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="font-bold text-gray-700">Design Paradigm:</span>
                  <span className="font-black text-black">Neo-Brutalist High-Contrast</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700">Status:</span>
                  <span className="inline-flex items-center gap-1 font-black text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Cloud Systems Operational
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t-4 border-black bg-white px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="text-[11px] font-bold text-gray-600 font-mono">
            STUDISPACE • EMPOWERING SCHOLARS WORLDWIDE
          </div>
          <button
            onClick={() => {
              soundEngine.playChime("click");
              onClose();
            }}
            className="px-4 py-1.5 bg-[#FFE600] hover:bg-[#fff04d] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
