import React, { useState, useEffect } from "react";
import {
  Flame,
  Volume2,
  VolumeX,
  Sparkles,
  Timer,
  BookOpen,
  Brain,
  Layers,
  CheckSquare,
  Music,
  CheckCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  GraduationCap,
  Info,
  RefreshCw,
  Edit2,
  FolderLock,
} from "lucide-react";
import { AppTab, UserStats } from "../types";
import { useAuth } from "../context/AuthContext";
import { soundEngine } from "../utils/audioSynthesizer";

interface HeaderProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  stats: UserStats;
  onOpenBadges: () => void;
  onOpenAbout: () => void;
  onOpenProfile: () => void;
  isAudioMuted: boolean;
  onToggleMute: () => void;
  activeSoundCount: number;
}

const STUDY_QUOTES = [
  "⚡ Focus is a muscle — sprint daily & protect your deep work flow",
  "🧠 Socratic inquiry: Question assumptions to master concepts deeply",
  "🔥 Consistency beats intensity: Keep your study streak alive!",
  "📚 Active recall + spaced repetition = exponential memory retention",
  "🎯 Plan the sprint, execute without tabs, review with Socrates AI",
  "💡 Understanding > Memorizing: Build clear mental models first",
  "☕ Deep work state: Single-tasking is the ultimate academic superpower",
  "📈 Every focused interval moves your GPA roadmap forward",
];

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  stats,
  onOpenBadges,
  onOpenAbout,
  onOpenProfile,
  isAudioMuted,
  onToggleMute,
  activeSoundCount,
}) => {
  const { user, userProfile, signInWithGoogle, logout } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Rotate quotes periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % STUDY_QUOTES.length);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleNextQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playChime("click");
    setQuoteIndex((prev) => (prev + 1) % STUDY_QUOTES.length);
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (err) {
      console.error("Sign in failed:", err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const navItems: Array<{ id: AppTab; label: string; icon: React.ReactNode; color: string }> = [
    { id: "dashboard", label: "Dashboard", icon: <Sparkles className="w-4 h-4" />, color: "#FFE600" },
    { id: "documents", label: "Vault", icon: <FolderLock className="w-4 h-4" />, color: "#00F0FF" },
    { id: "pomodoro", label: "Focus Timer", icon: <Timer className="w-4 h-4" />, color: "#FF66C4" },
    { id: "socrates_ai", label: "Socrates AI", icon: <Brain className="w-4 h-4" />, color: "#00F0FF" },
    { id: "flashcards", label: "Flashcards", icon: <Layers className="w-4 h-4" />, color: "#73EC8E" },
    { id: "notes", label: "Study Notes", icon: <BookOpen className="w-4 h-4" />, color: "#FFD166" },
    { id: "quiz", label: "Quiz Arena", icon: <CheckCircle className="w-4 h-4" />, color: "#C4B5FD" },
    { id: "assignments", label: "Assignments", icon: <CheckSquare className="w-4 h-4" />, color: "#FFA94D" },
    { id: "gpa", label: "GPA Manager", icon: <GraduationCap className="w-4 h-4" />, color: "#FF4B4B" },
    { id: "soundscapes", label: "Soundscapes", icon: <Music className="w-4 h-4" />, color: "#48CAE4" },
  ];

  // User details
  const displayName = userProfile?.displayName || user?.displayName || "Guest Scholar";
  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const photoUrl = userProfile?.photoURL || user?.photoURL;
  const userMajor = userProfile?.major || "Computer Science";
  const currentTerm = userProfile?.term || "Fall 2026";
  const avatarBg = userProfile?.avatarBg || "#FFE600";

  return (
    <header className="sticky top-0 z-40 bg-white border-b-2 border-black px-3 sm:px-6 py-2.5 transition-all shadow-[0_2px_0px_0px_rgba(0,0,0,1)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        {/* Brand Logo & Rotating Motivational Study Slogan */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Enlarged StudiSpace Logo */}
            <button
              onClick={() => {
                soundEngine.playChime("click");
                onSelectTab("dashboard");
              }}
              className="bg-[#FFE600] border-2 border-black px-4 py-2 sm:px-5 sm:py-2.5 font-black text-xl sm:text-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 hover:rotate-0 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all select-none flex items-center gap-2.5 cursor-pointer"
              id="brand-logo"
              title="StudiSpace Dashboard"
            >
              <span className="text-2xl sm:text-3xl leading-none">🚀</span>
              <span className="tracking-tight text-black">StudiSpace</span>
            </button>

            {/* Motivational Slogan & Rotating Study Quote Box (2-Line Support) */}
            <div
              onClick={handleNextQuote}
              title="Click to cycle motivational study quote"
              className="hidden md:flex items-center justify-between gap-2.5 bg-white text-black border-2 border-black px-3.5 py-1.5 sm:px-4 sm:py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFFDE6] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all max-w-[320px] lg:max-w-[420px] xl:max-w-[480px] group select-none cursor-pointer"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-base sm:text-lg leading-tight flex-shrink-0 mt-0.5">
                  {STUDY_QUOTES[quoteIndex].slice(0, 2)}
                </span>
                <p className="text-xs sm:text-[13px] font-bold text-black leading-snug tracking-tight line-clamp-2">
                  {STUDY_QUOTES[quoteIndex].slice(2).trim()}
                </p>
              </div>
              <button
                type="button"
                onClick={handleNextQuote}
                aria-label="Cycle next quote"
                className="p-1 rounded bg-[#F4F4F0] border border-black/30 group-hover:bg-[#FFE600] group-hover:border-black transition-colors flex-shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 text-black group-hover:rotate-180 transition-transform" />
              </button>
            </div>
          </div>

          {/* Quick Controls for Mobile */}
          <div className="flex items-center gap-1.5 sm:hidden">
            <button
              onClick={() => {
                soundEngine.playChime("click");
                onOpenAbout();
              }}
              className="p-1.5 bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5"
              title="About StudiSpace"
            >
              <Info className="w-3.5 h-3.5 text-black" />
            </button>
            <button
              onClick={onToggleMute}
              className={`p-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 ${
                isAudioMuted ? "bg-gray-200" : "bg-[#73EC8E]"
              }`}
              title="Toggle Audio"
            >
              {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onOpenBadges}
              className="flex items-center gap-1 bg-[#FF66C4] px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs active:translate-x-0.5 active:translate-y-0.5"
            >
              <Flame className="w-3 h-3 fill-black" />
              {stats.streakDays}d
            </button>
            <button
              onClick={() => {
                soundEngine.playChime("click");
                onOpenProfile();
              }}
              className="p-1.5 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="My Profile"
            >
              <UserIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status badges & User Profile widget (Desktop / Tablet) */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap justify-end">
          {/* About Project Button */}
          <button
            onClick={() => {
              soundEngine.playChime("click");
              onOpenAbout();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#FFF9E9] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs transition-all active:translate-x-0.5 active:translate-y-0.5"
            title="About StudiSpace & Features"
            id="btn-header-about"
          >
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>About</span>
          </button>

          {/* Audio Quick Status */}
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1.5 px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              isAudioMuted
                ? "bg-gray-100 text-gray-700"
                : activeSoundCount > 0
                ? "bg-[#73EC8E] text-black animate-pulse"
                : "bg-white text-black hover:bg-gray-50"
            }`}
            title="Audio Soundscapes Control"
            id="btn-header-audio"
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>
              {isAudioMuted
                ? "Muted"
                : activeSoundCount > 0
                ? `${activeSoundCount} Sounds`
                : "Soundscapes"}
            </span>
          </button>

          {/* 7-Day Streak Badge */}
          <div
            onClick={onOpenBadges}
            className="cursor-pointer flex items-center gap-1 border-2 border-black px-2.5 py-1 bg-white font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFFDE6] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title="Current Study Streak"
            id="streak-badge"
          >
            <span className="text-orange-500">🔥</span>
            <span>{stats.streakDays}d Streak</span>
          </div>

          {/* XP & Level Badge */}
          <div
            onClick={onOpenBadges}
            className="cursor-pointer flex items-center gap-1 border-2 border-black px-2.5 py-1 bg-white font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title="Click to view Achievements & XP"
            id="level-badge"
          >
            <span className="text-yellow-500">⭐</span>
            <span>{stats.xp} XP (LVL {stats.level})</span>
          </div>

          {/* Academic Semester Badge */}
          <div className="hidden xl:flex items-center gap-1 border-2 border-black px-2.5 py-1 bg-white font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none">
            <span className="text-blue-500">🎓</span>
            <span>{currentTerm}</span>
          </div>

          {/* User Profile Card & Action */}
          <div className="flex items-center gap-1.5 border-2 border-black px-2 py-0.5 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <button
              onClick={() => {
                soundEngine.playChime("click");
                onOpenProfile();
              }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
              title="Click to view and edit Scholar Profile"
              id="btn-header-profile"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="w-7 h-7 border-2 border-black object-cover shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-7 h-7 border-2 border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  style={{ backgroundColor: avatarBg }}
                >
                  {userInitials || "SC"}
                </div>
              )}
              <div className="leading-tight hidden lg:block pr-1">
                <div className="font-black text-xs text-black line-clamp-1 flex items-center gap-1">
                  <span>{displayName}</span>
                  <Edit2 className="w-2.5 h-2.5 text-gray-400" />
                </div>
                <div className="text-[9px] text-gray-600 font-bold uppercase truncate max-w-[120px]">
                  {userMajor}
                </div>
              </div>
            </button>

            {user ? (
              <button
                onClick={() => logout()}
                id="btn-header-logout"
                className="p-1 bg-gray-100 hover:bg-[#FF66C4] border border-black text-black transition-all active:translate-x-0.5 active:translate-y-0.5"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                id="btn-header-google-signin"
                className="px-2 py-0.5 bg-[#FFE600] hover:bg-[#fff04d] border border-black font-black text-[10px] uppercase shadow-[1px_1px_0px_#000]"
              >
                {isSigningIn ? "..." : "Sign In"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Pills Sub-Bar with Distinct Neo-Brutalist Semantic Colors */}
      <nav className="max-w-7xl mx-auto mt-2 overflow-x-auto no-scrollbar flex items-center gap-2 pt-1 border-t border-black/10">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                soundEngine.playChime("click");
                onSelectTab(item.id);
              }}
              id={`nav-tab-${item.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-black whitespace-nowrap border-2 border-black transition-all ${
                isActive
                  ? "translate-x-[-1px] translate-y-[-1px] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ring-1 ring-black"
                  : "bg-white text-black hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
              }`}
              style={{
                backgroundColor: isActive ? item.color : "#FFFFFF",
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
