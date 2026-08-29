import React, { useState, useEffect } from "react";
import {
  X,
  User as UserIcon,
  School,
  BookOpen,
  Calendar,
  Target,
  Clock,
  Sparkles,
  Flame,
  Award,
  Check,
  Save,
  LogOut,
  Image as ImageIcon,
  Edit3,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { soundEngine } from "../utils/audioSynthesizer";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

const AVATAR_COLORS = [
  "#FFE600", // Yellow
  "#FF66C4", // Pink
  "#73EC8E", // Lime
  "#00F0FF", // Cyan
  "#FFA94D", // Orange
  "#C4B5FD", // Lilac
  "#FF4B4B", // Red
  "#FFFFFF", // White
];

const AVATAR_EMOJIS = ["🎓", "🚀", "🧠", "⚡", "🦉", "💻", "🔬", "📚", "🎯", "✨"];

const MAJORS = [
  "Computer Science",
  "Software Engineering",
  "Data Science & AI",
  "Mathematics & Stats",
  "Electrical Engineering",
  "Biology / Pre-Med",
  "Business & Economics",
  "Psychology & CogSci",
  "Other / Multidisciplinary",
];

const YEARS = [
  "1st Year (Freshman)",
  "2nd Year (Sophomore)",
  "3rd Year (Junior)",
  "4th Year (Senior)",
  "Master's Candidate",
  "Doctoral Scholar (PhD)",
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const { user, userProfile, updateUserProfile, logout } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [university, setUniversity] = useState("");
  const [major, setMajor] = useState("Computer Science");
  const [year, setYear] = useState("4th Year (Senior)");
  const [term, setTerm] = useState("Fall 2026");
  const [targetGpa, setTargetGpa] = useState("3.85");
  const [studyGoal, setStudyGoal] = useState("3 Hours / Day");
  const [bio, setBio] = useState("");
  const [avatarBg, setAvatarBg] = useState("#FFE600");
  const [avatarEmoji, setAvatarEmoji] = useState("🎓");
  const [photoURL, setPhotoURL] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || user?.displayName || "Scholar");
      setUniversity(userProfile.university || "StudiSpace University");
      setMajor(userProfile.major || "Computer Science");
      setYear(userProfile.year || "4th Year (Senior)");
      setTerm(userProfile.term || "Fall 2026");
      setTargetGpa(userProfile.targetGpa?.toString() || "3.85");
      setStudyGoal(userProfile.studyGoal || "3 Hours / Day");
      setBio(userProfile.bio || "Striving for deep understanding and academic mastery.");
      setAvatarBg(userProfile.avatarBg || "#FFE600");
      setPhotoURL(userProfile.photoURL || user?.photoURL || "");
    }
  }, [userProfile, user, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      soundEngine.playChime("click");
      await updateUserProfile({
        displayName: displayName.trim() || "Scholar",
        university: university.trim(),
        major,
        year,
        term: term.trim() || "Fall 2026",
        targetGpa: parseFloat(targetGpa) || 3.8,
        studyGoal: studyGoal.trim(),
        bio: bio.trim(),
        avatarBg,
        photoURL: photoURL.trim(),
      });
      soundEngine.playChime("levelup");
      onShowToast("✅ Profile updated successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to save profile:", err);
      onShowToast("⚠️ Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      soundEngine.playChime("click");
      await logout();
      onClose();
      onShowToast("Logged out successfully.");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const stats = userProfile?.stats;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#FFF9E9] border-4 border-black w-full max-w-2xl max-h-[92vh] flex flex-col shadow-[10px_10px_0px_0px_#000000] relative overflow-hidden">
        {/* Modal Top Bar */}
        <div className="bg-[#FF66C4] border-b-4 border-black px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
              <UserIcon className="w-5 h-5 text-black" />
            </span>
            <div>
              <h2 className="font-black text-lg sm:text-xl uppercase tracking-tight text-black leading-none">
                Scholar Profile
              </h2>
              <p className="font-mono text-[11px] font-bold text-black uppercase tracking-wider mt-0.5">
                Academic Identity & Settings
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto max-h-[calc(92vh-140px)] space-y-6 text-black selection:bg-[#FFE600]">
          {/* Top Profile Summary Header */}
          <div className="p-4 bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Avatar Preview */}
            <div className="relative">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-20 h-20 border-3 border-black object-cover shadow-[3px_3px_0px_#000]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-20 h-20 border-3 border-black flex items-center justify-center font-black text-3xl shadow-[3px_3px_0px_#000] select-none"
                  style={{ backgroundColor: avatarBg }}
                >
                  {avatarEmoji}
                </div>
              )}
            </div>

            {/* Quick Info & Stats Strip */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h3 className="font-black text-xl text-black leading-tight flex items-center justify-center sm:justify-start gap-2">
                <span>{displayName || "Scholar"}</span>
                <span className="font-mono text-[10px] bg-[#FFE600] px-2 py-0.5 border border-black uppercase font-bold">
                  LVL {stats?.level || 1}
                </span>
              </h3>
              <p className="text-xs font-bold text-gray-600">
                {major} • {university || "Academic Scholar"}
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1.5">
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-[#82FB9B] border border-black px-2 py-0.5">
                  <Flame className="w-3.5 h-3.5 fill-black text-black" />
                  {stats?.streakDays || 1}d Streak
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-[#C4B5FD] border border-black px-2 py-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  {stats?.xp || 0} XP
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-[#FFE600] border border-black px-2 py-0.5">
                  <Clock className="w-3.5 h-3.5 text-black" />
                  {stats?.totalFocusMinutes || 0} Focus Mins
                </span>
              </div>
            </div>
          </div>

          {/* Avatar & Styling Preferences */}
          <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
            <h4 className="font-black text-xs uppercase text-black tracking-wider flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>Avatar & Emblem Customization</span>
            </h4>

            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase text-gray-700">
                Avatar Background Color
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      soundEngine.playChime("click");
                      setAvatarBg(c);
                    }}
                    className={`w-8 h-8 border-2 border-black shadow-[2px_2px_0px_#000] transition-all flex items-center justify-center ${
                      avatarBg === c ? "scale-110 ring-2 ring-black" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {avatarBg === c && <Check className="w-4 h-4 text-black font-black" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase text-gray-700">
                Scholar Emblem Emoji
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      soundEngine.playChime("click");
                      setAvatarEmoji(emoji);
                      setPhotoURL(""); // prioritize chosen emoji
                    }}
                    className={`w-9 h-9 text-lg border-2 border-black bg-white shadow-[2px_2px_0px_#000] transition-all flex items-center justify-center ${
                      avatarEmoji === emoji && !photoURL ? "bg-[#FFE600] scale-110" : "hover:bg-gray-100"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase text-gray-700 mb-1 flex items-center justify-between">
                <span>Or Custom Photo URL</span>
                <span className="font-mono text-[9px] text-gray-500">OPTIONAL</span>
              </label>
              <input
                type="url"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://..."
                className="w-full bg-[#FFF9E9] border-2 border-black p-2 font-bold text-xs focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
              />
            </div>
          </div>

          {/* Core Academic Identity Form */}
          <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
            <h4 className="font-black text-xs uppercase text-black tracking-wider flex items-center gap-1.5">
              <School className="w-3.5 h-3.5" />
              <span>Academic Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-black text-xs uppercase mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="e.g. Alex Turing"
                  className="w-full bg-[#FFF9E9] border-2 border-black p-2.5 font-bold text-sm focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                />
              </div>

              <div>
                <label className="block font-black text-xs uppercase mb-1">
                  University / College
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="e.g. Stanford University"
                  className="w-full bg-[#FFF9E9] border-2 border-black p-2.5 font-bold text-sm focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                />
              </div>

              <div>
                <label className="block font-black text-xs uppercase mb-1">
                  Major / Field of Study
                </label>
                <select
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full bg-[#FFF9E9] border-2 border-black p-2.5 font-bold text-sm focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                >
                  {MAJORS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-black text-xs uppercase mb-1">
                  Current Year Level
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-[#FFF9E9] border-2 border-black p-2.5 font-bold text-sm focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-black text-xs uppercase mb-1">
                  Current Semester / Term
                </label>
                <input
                  type="text"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="e.g. Fall 2026"
                  className="w-full bg-[#FFF9E9] border-2 border-black p-2.5 font-bold text-sm focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                />
              </div>

              <div>
                <label className="block font-black text-xs uppercase mb-1">
                  Target GPA Goal (4.0 Scale)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.0"
                  max="4.0"
                  value={targetGpa}
                  onChange={(e) => setTargetGpa(e.target.value)}
                  placeholder="3.85"
                  className="w-full bg-[#FFF9E9] border-2 border-black p-2.5 font-bold text-sm focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                />
              </div>
            </div>

            <div>
              <label className="block font-black text-xs uppercase mb-1">
                Daily Focus / Study Target
              </label>
              <input
                type="text"
                value={studyGoal}
                onChange={(e) => setStudyGoal(e.target.value)}
                placeholder="e.g. 3 Hours / 4 Pomodoros daily"
                className="w-full bg-[#FFF9E9] border-2 border-black p-2.5 font-bold text-sm focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
              />
            </div>

            <div>
              <label className="block font-black text-xs uppercase mb-1">
                Scholar Bio & Academic Motto
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                placeholder="Share your academic interests, goals, or study philosophy..."
                className="w-full bg-[#FFF9E9] border-2 border-black p-2.5 font-bold text-xs focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000] resize-none"
              />
            </div>
          </div>
        </form>

        {/* Modal Bottom Actions */}
        <div className="border-t-4 border-black bg-white px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFDAD6] hover:bg-[#ffb4ab] border-2 border-black font-black text-xs uppercase text-red-900 shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playChime("click");
                onClose();
              }}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-[#FFE600] hover:bg-[#fff04d] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_#000] hover:shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Profile"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
