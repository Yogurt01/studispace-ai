import React, { useState } from "react";
import {
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  School,
  CheckCircle2,
  Brain,
  Zap,
  GraduationCap,
  Music,
  HelpCircle,
  Eye,
  EyeOff,
  Lightbulb,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { describeAuthError } from "../utils/authErrors";
import { soundEngine } from "../utils/audioSynthesizer";

const MAJORS = [
  "Computer Science",
  "Data Science",
  "Mathematics",
  "Biology / Pre-Med",
  "Engineering",
  "Psychology & CogSci",
];

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year (Senior)", "Grad"];

export const LoginView: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    guestSignIn,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [university, setUniversity] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("Computer Science");
  const [selectedYear, setSelectedYear] = useState("4th Year (Senior)");
  const [customMajor, setCustomMajor] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pop quiz demo interaction on left side
  const [quizAnswer, setQuizAnswer] = useState<string | null>("Energy Production");

  const handleGoogleAuth = async () => {
    try {
      soundEngine.playChime("click");
      setErrorMessage(null);
      setIsSubmitting(true);
      await signInWithGoogle();
      soundEngine.playChime("levelup");
    } catch (err: any) {
      console.error("Google Auth failed:", err);
      setErrorMessage(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    try {
      soundEngine.playChime("click");
      setIsSubmitting(true);

      const majorToSave =
        selectedMajor === "Other" ? customMajor || "Academic Scholar" : selectedMajor;

      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(
          email,
          password,
          displayName || "Scholar",
          majorToSave,
          selectedYear
        );
      }
      soundEngine.playChime("levelup");
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrorMessage(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestEntry = () => {
    soundEngine.playChime("click");
    guestSignIn();
  };

  return (
    <div className="min-h-screen w-full bg-[#FFF9E9] text-[#1E1C10] font-sans flex flex-col justify-between relative overflow-x-hidden selection:bg-[#FFE600] selection:text-black">
      {/* Decorative Neo-Brutalist Grid Background */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #000000 1px, transparent 1px), linear-gradient(to bottom, #000000 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full border-b-2 border-black bg-white/90 backdrop-blur-sm px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-[0_2px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3">
          <div className="text-xl sm:text-2xl font-black tracking-tighter uppercase flex items-center gap-2">
            <span>🚀</span>
            <span className="bg-[#FFE600] px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              StudiSpace
            </span>
          </div>
          <span className="hidden md:inline-block bg-black text-white font-mono text-xs px-2.5 py-1 font-bold uppercase tracking-wider">
            STUDY OS v2.5
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGuestEntry}
            id="btn-guest-quick-demo"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#82FB9B] hover:bg-[#65DE82] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title="Instant preview without login"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Instant Demo Mode</span>
          </button>
        </div>
      </header>

      {/* Main Content: Split Columns */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-grow flex flex-col lg:flex-row gap-8 lg:gap-12 items-center justify-between">
        {/* Left Column: Editorial & Floating Artifacts (Matching Reference Image 1) */}
        <div className="w-full lg:w-[52%] flex flex-col justify-between relative">
          <div className="space-y-4">
            {/* Badges Strip */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-[#FFE600] border-2 border-black font-black text-xs uppercase px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Sparkles className="w-3.5 h-3.5" />
                AI-Powered Study Workspace
              </span>
              <span className="inline-flex items-center gap-1 bg-[#FF66C4] text-white border-2 border-black font-black text-xs uppercase px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Brain className="w-3.5 h-3.5" />
                Socrates Tutor
              </span>
            </div>

            {/* Giant Brutalist Headline */}
            <h1 className="font-black text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight leading-[1.08] text-black">
              <span className="block transform -rotate-1 origin-bottom-left">
                Your Study Space.
              </span>
              <span className="inline-block bg-[#6A5F00] text-white px-3 py-1 my-1 transform rotate-1 border-2 border-black shadow-[5px_5px_0px_#000000]">
                Built around
              </span>
              <span className="block mt-1">how you learn.</span>
            </h1>

            <p className="text-gray-800 font-medium text-base sm:text-lg max-w-xl leading-relaxed border-l-4 border-black pl-3 bg-white/60 py-1">
              Structured like a textbook, wired like a supercomputer. Organize your chaotic notes, master active recall decks, and ace your exams with AI guidance.
            </p>

            {/* Feature Highlights Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-center">
                <Brain className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                <div className="font-black text-[11px] uppercase">Socrates AI</div>
              </div>
              <div className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-center">
                <Zap className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
                <div className="font-black text-[11px] uppercase">Smart Quizzes</div>
              </div>
              <div className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-center">
                <GraduationCap className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
                <div className="font-black text-[11px] uppercase">Grade Target</div>
              </div>
              <div className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-center">
                <Music className="w-5 h-5 mx-auto text-pink-500 mb-1" />
                <div className="font-black text-[11px] uppercase">Soundscapes</div>
              </div>
            </div>
          </div>

          {/* Interactive Floating Artifacts (Matching Reference Image 1) */}
          <div className="relative h-64 sm:h-72 w-full mt-6 hidden sm:block">
            {/* Artifact 1: BIO_101.md */}
            <div className="absolute top-2 left-4 w-60 p-3 bg-[#82FB9B] border-2 border-black shadow-[6px_6px_0px_#000000] transform -rotate-6 transition-all hover:-rotate-1 hover:-translate-y-1 z-10 cursor-pointer">
              <div className="flex items-center justify-between mb-2 border-b-2 border-black/20 pb-1.5 font-mono text-xs font-black uppercase tracking-wider">
                <span>📄 BIO_101.MD</span>
                <span className="text-[10px] bg-black text-white px-1">ACTIVE</span>
              </div>
              <div className="space-y-1.5 opacity-80 font-mono text-[11px] font-bold text-black">
                <div className="h-2 w-full bg-black/30"></div>
                <div className="h-2 w-4/5 bg-black/30"></div>
                <div className="text-[10px] text-emerald-950 font-bold mt-1">
                  ⚡ Synthesis of ATP via Oxidative Phosphorylation
                </div>
              </div>
            </div>

            {/* Artifact 2: POP QUIZ Card */}
            <div className="absolute top-10 right-4 sm:right-8 w-72 p-3.5 bg-[#FFDBEB] border-2 border-black shadow-[8px_8px_0px_#000000] transform rotate-3 transition-all hover:rotate-0 hover:-translate-y-1 z-20">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-black/20">
                <span className="font-black text-xs uppercase text-pink-700 tracking-wider">
                  🎯 POP QUIZ
                </span>
                <span className="bg-black text-white font-mono text-[10px] px-1.5 py-0.5 font-bold">
                  05:00
                </span>
              </div>
              <p className="font-bold text-xs text-black mb-2.5">
                What is the primary function of mitochondria?
              </p>
              <div className="space-y-1.5 text-xs font-bold">
                <button
                  onClick={() => setQuizAnswer("Energy Production")}
                  className={`w-full text-left p-1.5 border border-black flex items-center justify-between transition-all ${
                    quizAnswer === "Energy Production"
                      ? "bg-[#6A5F00] text-white shadow-[2px_2px_0px_#000]"
                      : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  <span>⚡ Energy Production (ATP)</span>
                  {quizAnswer === "Energy Production" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#82FB9B]" />
                  )}
                </button>
                <button
                  onClick={() => setQuizAnswer("Protein Synthesis")}
                  className={`w-full text-left p-1.5 border border-black transition-all ${
                    quizAnswer === "Protein Synthesis"
                      ? "bg-[#6A5F00] text-white shadow-[2px_2px_0px_#000]"
                      : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  <span>🧬 Protein Synthesis</span>
                </button>
              </div>
            </div>

            {/* Artifact 3: Sticky Note */}
            <div className="absolute bottom-2 left-16 p-3 bg-white border-2 border-black shadow-[5px_5px_0px_#000] transform -rotate-3 z-30 max-w-[220px]">
              <div className="flex gap-1 mb-1">
                <span className="text-[9px] bg-[#82FB9B] border border-black px-1 font-black">
                  #EXAM-PREP
                </span>
                <span className="text-[9px] bg-[#FFE600] border border-black px-1 font-black">
                  #URGENT
                </span>
              </div>
              <p className="text-[11px] font-bold text-black italic">
                "Review Chapter 4 calculus concepts before the Socrates AI quiz!"
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Neo-Brutalist Authentication Card (Matching Reference Image 1 & 2) */}
        <div className="w-full lg:w-[46%] max-w-lg">
          <div className="bg-white border-[3px] border-black p-6 sm:p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] relative">
            {/* Geometric Corner Accents */}
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-[#82FB9B] border-2 border-black shadow-[1px_1px_0px_#000]" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#FFE600] border-2 border-black shadow-[1px_1px_0px_#000]" />

            {/* Header / Tabs */}
            <div className="mb-5">
              <div className="flex border-2 border-black mb-4 p-1 bg-[#F4F4F0] gap-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playChime("click");
                    setMode("signin");
                    setErrorMessage(null);
                  }}
                  id="tab-auth-signin"
                  className={`flex-1 py-1.5 text-xs font-black uppercase transition-all border-2 ${
                    mode === "signin"
                      ? "bg-black text-white border-black shadow-[2px_2px_0px_#000]"
                      : "bg-transparent text-gray-700 border-transparent hover:bg-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playChime("click");
                    setMode("signup");
                    setErrorMessage(null);
                  }}
                  id="tab-auth-signup"
                  className={`flex-1 py-1.5 text-xs font-black uppercase transition-all border-2 ${
                    mode === "signup"
                      ? "bg-[#FFE600] text-black border-black shadow-[2px_2px_0px_#000]"
                      : "bg-transparent text-gray-700 border-transparent hover:bg-white"
                  }`}
                >
                  Create Account
                </button>
              </div>

              <h2 className="font-black text-2xl sm:text-3xl uppercase tracking-tight text-black">
                {mode === "signin" ? "WELCOME BACK" : "JOIN STUDISPACE"}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-600 mt-1">
                {mode === "signin"
                  ? "Enter your credentials to access your academic workspace."
                  : "Set up your student profile and begin your AI study journey."}
              </p>
            </div>

            {/* Primary Action: CONTINUE WITH GOOGLE */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isSubmitting}
                id="btn-google-auth"
                className="w-full flex items-center justify-center gap-3 p-3.5 bg-[#FFE600] hover:bg-[#FFF04D] border-2 border-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[4px_4px_0px_#000000] hover:shadow-[2px_2px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-grow h-0.5 bg-black" />
                <span className="font-mono text-[11px] font-bold text-gray-500 uppercase tracking-widest bg-white px-1">
                  OR WITH EMAIL
                </span>
                <div className="flex-grow h-0.5 bg-black" />
              </div>

              {/* Error Callout */}
              {errorMessage && (
                <div className="p-3 bg-[#FFDAD6] border-2 border-black shadow-[3px_3px_0px_#000] text-black font-bold text-xs flex items-start gap-2">
                  <span className="text-red-700 font-black">⚠️</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Email / Password Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === "signup" && (
                  <>
                    <div>
                      <label className="block font-black text-xs uppercase mb-1 text-black">
                        Student Full Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g. Alex Nguyen"
                          className="w-full bg-white border-2 border-black p-2.5 font-bold text-sm text-black focus:outline-none focus:bg-[#FFF9E9] focus:ring-0 shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-black text-xs uppercase mb-1 text-black flex items-center justify-between">
                        <span>University / College</span>
                        <span className="font-mono text-[10px] text-gray-500">OPTIONAL</span>
                      </label>
                      <div className="relative">
                        <School className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        <input
                          type="text"
                          value={university}
                          onChange={(e) => setUniversity(e.target.value)}
                          placeholder="e.g. University of Oxford / MIT"
                          className="w-full bg-white border-2 border-black p-2.5 pl-9 font-bold text-sm text-black focus:outline-none focus:bg-[#FFF9E9] focus:ring-0 shadow-[3px_3px_0px_#000] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-black text-xs uppercase mb-1.5 text-black">
                        Major Program
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {MAJORS.map((m) => {
                          const isSelected = selectedMajor === m;
                          return (
                            <button
                              type="button"
                              key={m}
                              onClick={() => {
                                soundEngine.playChime("click");
                                setSelectedMajor(m);
                              }}
                              className={`p-2 border-2 border-black text-left font-mono text-[11px] font-bold transition-all ${
                                isSelected
                                  ? "bg-[#6A5F00] text-white shadow-[2px_2px_0px_#000] translate-x-[1px] translate-y-[1px]"
                                  : "bg-white text-black hover:bg-[#F4F4F0] shadow-[2px_2px_0px_#000]"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="line-clamp-1">{m}</span>
                                {isSelected && <CheckCircle2 className="w-3 h-3 text-[#82FB9B]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block font-black text-xs uppercase mb-1.5 text-black">
                        Current Academic Year
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {YEARS.map((yr) => {
                          const isSelected = selectedYear === yr;
                          return (
                            <button
                              type="button"
                              key={yr}
                              onClick={() => {
                                soundEngine.playChime("click");
                                setSelectedYear(yr);
                              }}
                              className={`px-2.5 py-1 border-2 border-black font-mono text-[11px] font-bold transition-all ${
                                isSelected
                                  ? "bg-[#FF66C4] text-white shadow-[2px_2px_0px_#000]"
                                  : "bg-white text-black hover:bg-gray-100 shadow-[2px_2px_0px_#000]"
                              }`}
                            >
                              {yr}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block font-black text-xs uppercase mb-1 text-black">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      required
                      className="w-full bg-white border-2 border-black p-2.5 pl-9 font-bold text-sm text-black focus:outline-none focus:bg-[#FFF9E9] focus:ring-0 shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-black text-xs uppercase text-black">Password</label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() =>
                          alert("To reset password, sign in with Google or use standard email reset.")
                        }
                        className="font-mono text-[10px] font-bold text-[#6A5F00] hover:underline uppercase"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-white border-2 border-black p-2.5 pl-9 pr-10 font-bold text-sm text-black focus:outline-none focus:bg-[#FFF9E9] focus:ring-0 shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  id="btn-auth-submit"
                  className="w-full flex items-center justify-center gap-2 p-3.5 bg-[#6A5F00] hover:bg-[#504700] text-white border-2 border-black font-black text-sm uppercase tracking-wider shadow-[4px_4px_0px_#000000] hover:shadow-[2px_2px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer mt-2"
                >
                  <span>
                    {isSubmitting
                      ? "ACCESSING SYSTEM..."
                      : mode === "signin"
                      ? "ENTER STUDY SPACE"
                      : "LAUNCH MY WORKSPACE"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Bottom Quick Switch */}
              <div className="pt-2 text-center">
                <p className="text-xs font-bold text-gray-600">
                  {mode === "signin" ? "Don't have an account yet?" : "Already registered?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playChime("click");
                      setMode(mode === "signin" ? "signup" : "signin");
                      setErrorMessage(null);
                    }}
                    className="font-black text-black underline hover:text-[#FF66C4] ml-1 uppercase"
                  >
                    {mode === "signin" ? "Create Account" : "Sign In"}
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* Mini Pro-Tip Box below card (Matching Reference Image 2) */}
          <div className="mt-4 p-3 bg-[#82FB9B] border-2 border-black shadow-[4px_4px_0px_#000] flex items-start gap-2.5 transform rotate-1">
            <div className="p-1 bg-white border border-black shadow-[1px_1px_0px_#000]">
              <Lightbulb className="w-4 h-4 text-black" />
            </div>
            <div className="text-[11px] font-bold text-black leading-tight">
              <span className="uppercase font-black block text-emerald-950">PRO TIP:</span>
              Your decks, quizzes, and Socrates conversations sync automatically in real-time to your Firebase cloud profile.
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-black bg-white py-2.5 px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between text-xs font-black text-gray-700">
        <div className="flex items-center gap-2">
          <span>⚡ STUDISPACE LEARNING OPERATING SYSTEM</span>
        </div>
        <div className="flex items-center gap-4 mt-1 sm:mt-0 font-mono text-[11px]">
          <span>FIREBASE SECURE CLOUD</span>
          <span>•</span>
          <span>GEMINI + LOCAL QWEN3</span>
        </div>
      </footer>
    </div>
  );
};
