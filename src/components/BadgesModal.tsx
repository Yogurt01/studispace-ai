import React from "react";
import {
  Award,
  Flame,
  Zap,
  CheckCircle,
  Clock,
  Sparkles,
  Layers,
  BookOpen,
  Headphones,
} from "lucide-react";
import { UserStats, Badge } from "../types";

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
  badges: Badge[];
}

export const BadgesModal: React.FC<BadgesModalProps> = ({
  isOpen,
  onClose,
  stats,
  badges,
}) => {
  if (!isOpen) return null;

  const xpNeeded = stats.level * 500;
  const currentLevelXp = stats.xp % 500;
  const xpPercent = Math.min(100, Math.round((currentLevelXp / 500) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-black max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <div className="bg-[#FFE600] p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Award className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="font-black text-xl uppercase text-black">
                Scholar Level & Badges
              </h2>
              <p className="text-xs font-bold text-gray-700">
                Level {stats.level} Scholar • {stats.xp} Total Study XP
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="font-black text-base px-2.5 py-1 border-2 border-black bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            ✕
          </button>
        </div>

        {/* Level & XP Progress Card */}
        <div className="bg-[#00F0FF] border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-black text-sm uppercase text-black">
              Current Rank: Tier {stats.level} Focus Master
            </span>
            <span className="font-black text-xs text-black">
              {currentLevelXp} / 500 XP to Level {stats.level + 1}
            </span>
          </div>

          <div className="w-full bg-white h-5 border-2 border-black relative overflow-hidden">
            <div
              className="h-full bg-[#FFE600] border-r-2 border-black transition-all duration-300"
              style={{ width: `${xpPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="p-2 bg-white border border-black">
              <div className="font-black text-sm text-black">
                {stats.streakDays} Days
              </div>
              <div className="text-[10px] font-bold text-gray-600 uppercase">
                Active Streak
              </div>
            </div>
            <div className="p-2 bg-white border border-black">
              <div className="font-black text-sm text-black">
                {stats.pomodorosCompleted}
              </div>
              <div className="text-[10px] font-bold text-gray-600 uppercase">
                Focus Sprints
              </div>
            </div>
            <div className="p-2 bg-white border border-black">
              <div className="font-black text-sm text-black">
                {stats.cardsReviewedCount}
              </div>
              <div className="text-[10px] font-bold text-gray-600 uppercase">
                Cards Reviewed
              </div>
            </div>
          </div>
        </div>

        {/* Badges Grid */}
        <div className="space-y-3">
          <h3 className="font-black text-sm uppercase text-black flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Unlockable Achievements ({badges.filter((b) => b.unlocked).length}/{badges.length}):
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`p-3.5 border-2 border-black transition-all flex items-start gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                  badge.unlocked ? "bg-white" : "bg-gray-100 opacity-60"
                }`}
              >
                <div
                  className="p-2 border-2 border-black shrink-0"
                  style={{
                    backgroundColor: badge.unlocked ? badge.color : "#E5E7EB",
                  }}
                >
                  <Award className="w-5 h-5 text-black" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-black text-xs uppercase text-black">
                      {badge.title}
                    </h4>
                    {badge.unlocked ? (
                      <span className="text-[9px] font-black bg-[#73EC8E] px-1 border border-black">
                        UNLOCKED
                      </span>
                    ) : (
                      <span className="text-[9px] font-black bg-gray-300 px-1 border border-black">
                        LOCKED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-gray-700 mt-0.5">
                    {badge.desc}
                  </p>
                  <div className="text-[10px] font-bold text-gray-500 mt-1">
                    Req: {badge.req}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2 border-t-2 border-black">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d]"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
};
