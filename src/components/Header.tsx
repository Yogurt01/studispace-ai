import React, { useState } from "react";
import {
  Flame,
  Zap,
  Volume2,
  VolumeX,
  Award,
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
} from "lucide-react";
import { AppTab, UserStats } from "../types";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  stats: UserStats;
  onOpenBadges: () => void;
  isAudioMuted: boolean;
  onToggleMute: () => void;
  activeSoundCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  stats,
  onOpenBadges,
  isAudioMuted,
  onToggleMute,
  activeSoundCount,
}) => {
  const { user, userProfile, signInWithGoogle, logout, loading: authLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

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
    { id: "pomodoro", label: "Focus Timer", icon: <Timer className="w-4 h-4" />, color: "#FF66C4" },
    { id: "socrates_ai", label: "Socrates AI", icon: <Brain className="w-4 h-4" />, color: "#00F0FF" },
    { id: "flashcards", label: "Flashcards", icon: <Layers className="w-4 h-4" />, color: "#73EC8E" },
    { id: "notes", label: "Study Notes", icon: <BookOpen className="w-4 h-4" />, color: "#FFE600" },
    { id: "quiz", label: "Quiz Arena", icon: <CheckCircle className="w-4 h-4" />, color: "#C4B5FD" },
    { id: "assignments", label: "Assignments", icon: <CheckSquare className="w-4 h-4" />, color: "#FFA94D" },
    { id: "soundscapes", label: "Soundscapes", icon: <Music className="w-4 h-4" />, color: "#00F0FF" },
  ];

  // User details
  const displayName = user?.displayName || userProfile?.displayName || "Guest Scholar";
  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const photoUrl = user?.photoURL || userProfile?.photoURL;
  const userMajor = userProfile?.major || "Computer Science";
  const currentTerm = userProfile?.term || "Fall 2026";

  return (
    <header className="sticky top-0 z-40 bg-white border-b-2 border-black px-4 sm:px-6 py-2.5 transition-all shadow-[0_2px_0px_0px_rgba(0,0,0,1)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand Logo & Tag */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              onClick={() => onSelectTab("dashboard")}
              className="bg-[#FFE600] border-2 border-black px-3.5 py-1 font-black text-lg sm:text-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transform -rotate-1 cursor-pointer hover:rotate-0 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all select-none"
              id="brand-logo"
            >
              🚀 StudiSpace
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 bg-black text-white font-mono text-[10px] px-2.5 py-1 border-2 border-black font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span>🟢 Powered by Gemini &amp; local Qwen3 • Firebase • Cloud Run • Workspace APIs</span>
            </div>
          </div>

          {/* Quick Controls for Mobile */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={onToggleMute}
              className={`p-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 ${
                isAudioMuted ? "bg-gray-200" : "bg-[#73EC8E]"
              }`}
              title="Toggle Audio"
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onOpenBadges}
              className="flex items-center gap-1 bg-[#FF66C4] px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs active:translate-x-0.5 active:translate-y-0.5"
            >
              <Flame className="w-3.5 h-3.5 fill-black" />
              {stats.streakDays}d
            </button>
            {!user ? (
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="px-2 py-1 bg-[#FFE600] border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Sign In
              </button>
            ) : (
              <button
                onClick={() => logout()}
                className="p-1.5 bg-[#FF66C4] border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status badges & User Profile widget */}
        <div className="hidden sm:flex items-center gap-2.5 flex-wrap">
          {/* Audio Quick Status */}
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1.5 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs transition-all active:translate-x-0.5 active:translate-y-0.5 ${
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
                ? `${activeSoundCount} Active`
                : "Soundscapes"}
            </span>
          </button>

          {/* 7-Day Streak Badge */}
          <div
            onClick={onOpenBadges}
            className="cursor-pointer flex items-center gap-1.5 border-2 border-black px-3 py-1 bg-white font-black text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFFDE6] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title="Current Streak"
            id="streak-badge"
          >
            <span className="text-orange-500">🔥</span>
            <span>{stats.streakDays}-Day Streak</span>
          </div>

          {/* XP & Level Badge */}
          <div
            onClick={onOpenBadges}
            className="cursor-pointer flex items-center gap-1.5 border-2 border-black px-3 py-1 bg-white font-black text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 active:translate-x-0.5 active:translate-y-0.5 transition-all"
            title="Click to view Achievements & Level progression"
            id="level-badge"
          >
            <span className="text-yellow-500">⭐</span>
            <span>{stats.xp} XP (LVL {stats.level})</span>
          </div>

          {/* Academic Semester Badge */}
          <div className="hidden lg:flex items-center gap-1.5 border-2 border-black px-3 py-1 bg-white font-black text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none">
            <span className="text-blue-500">🎓</span>
            <span>{currentTerm}</span>
          </div>

          {/* User Profile Box & Auth Action */}
          {user ? (
            <div className="flex items-center gap-2 border-2 border-black px-2.5 py-1 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="w-7 h-7 border-2 border-black object-cover shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 border-2 border-black bg-[#FF66C4] flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  {userInitials}
                </div>
              )}
              <div className="text-left leading-none hidden xl:block">
                <div className="font-black text-xs text-black line-clamp-1">{displayName}</div>
                <div className="text-[9px] text-gray-600 font-bold uppercase mt-0.5">
                  {user.email || userMajor}
                </div>
              </div>
              <button
                onClick={() => logout()}
                id="btn-header-logout"
                className="ml-1 p-1 bg-gray-100 hover:bg-[#FF66C4] border border-black text-black transition-all active:translate-x-0.5 active:translate-y-0.5"
                title="Sign Out of Firebase"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              id="btn-header-google-signin"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isSigningIn ? "Signing In..." : "Sign In with Google"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Pills Sub-Bar */}
      <nav className="max-w-7xl mx-auto mt-2 overflow-x-auto no-scrollbar flex items-center gap-2 pt-1 border-t border-black/10">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              id={`nav-tab-${item.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-black whitespace-nowrap border-2 border-black transition-all ${
                isActive
                  ? "translate-x-[-1px] translate-y-[-1px] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
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
