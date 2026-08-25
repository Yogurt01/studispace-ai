import React, { useState } from "react";
import {
  Timer,
  Brain,
  Layers,
  CheckCircle,
  Clock,
  ArrowRight,
  Flame,
  Zap,
  BookOpen,
  Calendar,
  AlertTriangle,
  Play,
  Volume2,
  CalendarPlus,
  ExternalLink,
  Check,
} from "lucide-react";
import {
  AppTab,
  UserStats,
  Assignment,
  FlashcardDeck,
  StudyNote,
  Quiz,
} from "../types";

interface DashboardViewProps {
  stats: UserStats;
  assignments: Assignment[];
  decks: FlashcardDeck[];
  notes: StudyNote[];
  quizzes: Quiz[];
  onNavigate: (tab: AppTab) => void;
  onStartPomodoroWithTask?: (taskTitle: string) => void;
  onOpenDeck?: (deckId: string) => void;
  onOpenQuiz?: (quizId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  assignments,
  decks,
  notes,
  quizzes,
  onNavigate,
  onStartPomodoroWithTask,
  onOpenDeck,
  onOpenQuiz,
}) => {
  const [syncedEventId, setSyncedEventId] = useState<string | null>(null);

  // Helper for Google Calendar Sync
  const handleSyncToGoogleCalendar = (item: Assignment) => {
    let startDate = new Date();
    const parsed = Date.parse(item.dueDate);
    if (!isNaN(parsed)) {
      startDate = new Date(parsed);
    } else {
      startDate.setDate(startDate.getDate() + 1);
    }
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + (item.estimatedPomodoros || 2) * 25 * 60 * 1000 + 30 * 60 * 1000);

    const formatGCalDate = (d: Date) => {
      return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    };

    const datesParam = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;
    const title = `[StudiSpace Study Sprint] ${item.title} (${item.subject})`;
    const details = `📚 Subject: ${item.subject}\n⚡ Priority: ${item.priority.toUpperCase()}\n🎯 Target Grade: ${item.gradeTarget || "A"}\n⏱️ Estimated Focus: ${item.estimatedPomodoros} Pomodoro Sprints\n📝 Notes: ${item.notes || "Prepared in StudiSpace Study OS"}\n\n🔗 StudiSpace App: https://ais-dev-4iae4eyzvb3yjyetfu24q3-55980572059.asia-east1.run.app`;
    const location = "StudiSpace Study Hub / Virtual Desk";

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${datesParam}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;

    window.open(gcalUrl, "_blank", "noopener,noreferrer");
    setSyncedEventId(item.id);
    setTimeout(() => setSyncedEventId(null), 3000);
  };

  // Urgent assignments (sorted by dueDate)
  const pendingAssignments = assignments
    .filter((a) => a.status !== "done")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const totalCards = decks.reduce((acc, d) => acc + d.cards.length, 0);
  const masteredCards = decks.reduce(
    (acc, d) => acc + d.cards.filter((c) => c.masteryLevel === "mastered").length,
    0
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Welcome Banner */}
      <div className="bg-[#FFE600] border-2 border-black p-5 sm:p-7 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-black text-[#FFE600] font-black text-xs px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
              <Flame className="w-4 h-4 fill-[#FFE600]" />
              <span>STREAK DAY {stats.streakDays} • LOCK IN MODE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-black leading-none">
              Welcome back to your Study OS.
            </h1>
            <p className="text-sm sm:text-base font-bold text-gray-900 leading-relaxed">
              "Action is the foundational key to all success." Crush 2 focus sprints today, test your recall, and ask Socrates AI any roadblock!
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap sm:flex-col gap-2.5 min-w-[200px]">
            <button
              onClick={() => onNavigate("pomodoro")}
              id="btn-dash-start-focus"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-black text-white font-black text-sm px-4 py-3 border-2 border-black shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] hover:bg-neutral-800 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              START 25m SPRINT
            </button>
            <button
              onClick={() => onNavigate("socrates_ai")}
              id="btn-dash-ask-ai"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-black font-black text-sm px-4 py-2.5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              <Brain className="w-4 h-4 text-black" />
              ASK SOCRATES AI
            </button>
          </div>
        </div>
      </div>

      {/* 4-Metric Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-gray-600">Total Focus Time</span>
            <div className="p-1.5 bg-[#FF66C4] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Timer className="w-4 h-4 text-black" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-black">
              {Math.floor(stats.totalFocusMinutes / 60)}h {stats.totalFocusMinutes % 60}m
            </span>
            <p className="text-[11px] font-bold text-gray-700 mt-1">
              ⚡ {stats.pomodorosCompleted} completed pomodoros
            </p>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-gray-600">Active Recall</span>
            <div className="p-1.5 bg-[#73EC8E] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Layers className="w-4 h-4 text-black" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-black">
              {masteredCards}/{totalCards}
            </span>
            <p className="text-[11px] font-bold text-gray-700 mt-1">
              🃏 {stats.cardsReviewedCount} cards reviewed today
            </p>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-gray-600">Quiz Precision</span>
            <div className="p-1.5 bg-[#C4B5FD] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <CheckCircle className="w-4 h-4 text-black" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-black">
              {stats.quizzesTakenCount} Quizzes
            </span>
            <p className="text-[11px] font-bold text-gray-700 mt-1">
              🎯 Average 88% accuracy
            </p>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-gray-600">Level & Rank</span>
            <div className="p-1.5 bg-[#00F0FF] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Zap className="w-4 h-4 text-black" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-black">
              Level {stats.level}
            </span>
            <p className="text-[11px] font-bold text-gray-700 mt-1">
              🏆 {stats.unlockedBadgeIds.length} achievements unlocked
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section: Deadlines & Study Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Urgent Assignments & AI Socratic Prompts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Urgent Assignments Card */}
          <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* Terminal status top bar */}
            <div className="bg-black text-white p-2 px-3 font-mono text-[10px] flex justify-between items-center select-none border-b-2 border-black">
              <span>PRIORITY_TIMELINE: 0xDEADLINE_QUEUE</span>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-black/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-black/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-black/30" />
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-black" />
                  <h2 className="font-black text-lg uppercase tracking-tight text-black">
                    Priority Action Items & Deadlines
                  </h2>
                </div>
                <button
                  onClick={() => onNavigate("assignments")}
                  className="text-xs font-black uppercase hover:underline flex items-center gap-1"
                >
                  View All ({assignments.length}) <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {pendingAssignments.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 border-2 border-black bg-[#F4F4F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#eaeae4] transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 border border-black ${
                            item.priority === "urgent"
                              ? "bg-[#FF66C4] text-black"
                              : item.priority === "high"
                              ? "bg-[#FFA94D] text-black"
                              : "bg-[#FFE600] text-black"
                          }`}
                        >
                          {item.priority}
                        </span>
                        <span className="text-xs font-bold text-gray-700 bg-white px-1.5 py-0.5 border border-black">
                          {item.subject}
                        </span>
                      </div>
                      <h3 className="font-black text-sm text-black">{item.title}</h3>
                      {item.notes && (
                        <p className="text-xs text-gray-700 font-medium line-clamp-1">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <div className="text-right text-xs font-bold text-gray-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Due {item.dueDate}</span>
                        </div>
                        <span className="text-[10px] text-gray-600">
                          {item.completedPomodoros}/{item.estimatedPomodoros} sprints
                        </span>
                      </div>

                      {/* Google Calendar Sync Button */}
                      <button
                        onClick={() => handleSyncToGoogleCalendar(item)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-0.5 active:translate-y-0.5 ${
                          syncedEventId === item.id
                            ? "bg-[#73EC8E] text-black"
                            : "bg-white hover:bg-[#00F0FF] text-black"
                        }`}
                        title="Sync to Google Calendar"
                      >
                        {syncedEventId === item.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-black" />
                            <span className="hidden md:inline">Synced</span>
                          </>
                        ) : (
                          <>
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Sync to G-Cal</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          if (onStartPomodoroWithTask) {
                            onStartPomodoroWithTask(item.title);
                          } else {
                            onNavigate("pomodoro");
                          }
                        }}
                        className="bg-[#FFE600] p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-1 active:translate-y-1 active:shadow-none"
                        title="Focus on this task now"
                      >
                        <Play className="w-4 h-4 fill-black" />
                      </button>
                    </div>
                  </div>
                ))}

                {pendingAssignments.length === 0 && (
                  <div className="p-6 text-center text-gray-500 font-bold border-2 border-dashed border-gray-400">
                    🎉 No pending assignments! You're completely caught up.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Socratic AI Study Jump */}
          <div className="bg-[#00F0FF] border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-black" />
                <h2 className="font-black text-lg uppercase tracking-tight text-black">
                  Socrates AI: Instant Learning Prompts
                </h2>
              </div>
              <button
                onClick={() => onNavigate("socrates_ai")}
                className="text-xs font-black bg-white px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase hover:bg-gray-100 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                Open Mentor Chat
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  label: "🧬 Explain Mitosis vs Meiosis via ELI5",
                  mode: "eli5",
                },
                {
                  label: "🌳 AVL Tree Balance Factor Socratic Guide",
                  mode: "socratic",
                },
                {
                  label: "🔥 Drill me on Microeconomics MR=MC",
                  mode: "exam_grill",
                },
                {
                  label: "🧠 Create Mnemonic for Brain Anatomy",
                  mode: "mnemonic",
                },
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigate("socrates_ai")}
                  className="text-left p-2.5 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE600] active:translate-x-1 active:translate-y-1 active:shadow-none font-black text-xs text-black transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Decks, Quizzes & Soundscapes */}
        <div className="space-y-6">
          {/* Dark Mode Weekly Goal Card */}
          <div className="bg-black text-white p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,102,196,1)] space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#FFE600] font-black uppercase">WEEKLY FOCUS TARGET</span>
              <span className="text-gray-400">8 / 10 Sprints</span>
            </div>
            <div className="w-full bg-neutral-800 h-3.5 border border-white/40 overflow-hidden">
              <div className="bg-[#73EC8E] h-full w-[80%]" />
            </div>
            <div className="flex justify-between text-[11px] font-bold text-gray-300">
              <span>🎯 80% Complete</span>
              <span className="text-[#00F0FF]">2 Sprints left today!</span>
            </div>
          </div>

          {/* Flashcard Quick Decks */}
          <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-black" />
                <h2 className="font-black text-base uppercase text-black">Study Decks</h2>
              </div>
              <button
                onClick={() => onNavigate("flashcards")}
                className="text-xs font-black hover:underline"
              >
                All Decks
              </button>
            </div>

            <div className="space-y-2.5">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  onClick={() => {
                    if (onOpenDeck) onOpenDeck(deck.id);
                    onNavigate("flashcards");
                  }}
                  className="cursor-pointer p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-between"
                  style={{ backgroundColor: `${deck.color}25` }}
                >
                  <div>
                    <h3 className="font-black text-xs text-black">{deck.title}</h3>
                    <p className="text-[11px] font-bold text-gray-700">
                      {deck.cards.length} cards • {deck.subject}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-black" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Quiz Arena */}
          <div className="bg-[#C4B5FD] border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-black" />
                <h2 className="font-black text-base uppercase text-black">Speed Quizzes</h2>
              </div>
              <button
                onClick={() => onNavigate("quiz")}
                className="text-xs font-black bg-white px-2 py-0.5 border border-black active:translate-x-0.5 active:translate-y-0.5"
              >
                Arena
              </button>
            </div>

            <div className="space-y-2">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  onClick={() => {
                    if (onOpenQuiz) onOpenQuiz(quiz.id);
                    onNavigate("quiz");
                  }}
                  className="cursor-pointer p-2.5 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE600] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-between"
                >
                  <div>
                    <div className="font-black text-xs text-black">{quiz.title}</div>
                    <div className="text-[10px] font-bold text-gray-600">
                      {quiz.questions.length} Questions • {quiz.difficulty}
                    </div>
                  </div>
                  <Play className="w-3.5 h-3.5 fill-black" />
                </div>
              ))}
            </div>
          </div>

          {/* Ambient Soundscapes Shortcut */}
          <div
            onClick={() => onNavigate("soundscapes")}
            className="cursor-pointer bg-[#73EC8E] border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#62e07e] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Volume2 className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase text-black">Lofi & Ambient Mixer</h3>
                <p className="text-xs font-bold text-gray-800">
                  Rain, Vinyl, Cafe & 40Hz Alpha Wave
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-black" />
          </div>
        </div>
      </div>
    </div>
  );
};
