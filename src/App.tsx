import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { LoginView } from "./components/LoginView";
import { DashboardView } from "./components/DashboardView";
import { PomodoroView } from "./components/PomodoroView";
import { SocratesChatView } from "./components/SocratesChatView";
import { FlashcardsView } from "./components/FlashcardsView";
import { NotesView } from "./components/NotesView";
import { QuizArenaView } from "./components/QuizArenaView";
import { AssignmentsView } from "./components/AssignmentsView";
import { SoundscapesView } from "./components/SoundscapesView";
import { BadgesModal } from "./components/BadgesModal";
import {
  AppTab,
  UserStats,
  Assignment,
  FlashcardDeck,
  StudyNote,
  Quiz,
  Badge,
} from "./types";
import {
  INITIAL_STATS,
  INITIAL_BADGES,
  INITIAL_ASSIGNMENTS,
  INITIAL_DECKS,
  INITIAL_NOTES,
  INITIAL_QUIZZES,
} from "./utils/initialData";
import { soundEngine } from "./utils/audioSynthesizer";
import confetti from "canvas-confetti";
import { useAuth } from "./context/AuthContext";
import {
  subscribeToAssignments,
  saveAssignmentToDb,
  deleteAssignmentFromDb,
  subscribeToDecks,
  saveDeckToDb,
  subscribeToNotes,
  saveNoteToDb,
  deleteNoteFromDb,
  subscribeToQuizzes,
  saveQuizToDb,
  updateQuizScoreInDb,
} from "./utils/firestoreService";

export default function App() {
  const { user, userProfile, loading, updateUserStats } = useAuth();
  const [currentTab, setCurrentTab] = useState<AppTab>("dashboard");
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Initial navigation parameters
  const [pomodoroTask, setPomodoroTask] = useState<string | undefined>();
  const [activeDeckId, setActiveDeckId] = useState<string | undefined>();
  const [activeQuizId, setActiveQuizId] = useState<string | undefined>();

  // Persistent States
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem("studispace_stats");
    return saved ? JSON.parse(saved) : INITIAL_STATS;
  });

  const [badges, setBadges] = useState<Badge[]>(() => {
    const saved = localStorage.getItem("studispace_badges");
    return saved ? JSON.parse(saved) : INITIAL_BADGES;
  });

  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);
  const [decks, setDecks] = useState<FlashcardDeck[]>(INITIAL_DECKS);
  const [notes, setNotes] = useState<StudyNote[]>(INITIAL_NOTES);
  const [quizzes, setQuizzes] = useState<Quiz[]>(INITIAL_QUIZZES);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time Firestore synchronizations
  useEffect(() => {
    const unsubAssignments = subscribeToAssignments(user?.uid || null, (remoteList) => {
      if (remoteList.length > 0) setAssignments(remoteList);
    });
    const unsubDecks = subscribeToDecks(user?.uid || null, (remoteList) => {
      if (remoteList.length > 0) setDecks(remoteList);
    });
    const unsubNotes = subscribeToNotes(user?.uid || null, (remoteList) => {
      if (remoteList.length > 0) setNotes(remoteList);
    });
    const unsubQuizzes = subscribeToQuizzes(user?.uid || null, (remoteList) => {
      if (remoteList.length > 0) setQuizzes(remoteList);
    });

    return () => {
      unsubAssignments();
      unsubDecks();
      unsubNotes();
      unsubQuizzes();
    };
  }, [user?.uid]);

  // Sync user profile stats from Firestore if authenticated
  useEffect(() => {
    if (userProfile?.stats) {
      setStats(userProfile.stats);
    }
  }, [userProfile?.stats]);

  // Sync to LocalStorage fallback
  useEffect(() => {
    localStorage.setItem("studispace_stats", JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem("studispace_badges", JSON.stringify(badges));
  }, [badges]);

  // Award XP and check level ups
  const handleAwardXp = (amount: number) => {
    setStats((prev) => {
      const newXp = prev.xp + amount;
      const newLevel = Math.floor(newXp / 500) + 1;
      const leveledUp = newLevel > prev.level;

      if (leveledUp) {
        soundEngine.playChime("levelup");
        confetti({ particleCount: 100, spread: 80 });
        showToast(`🎉 LEVEL UP! You reached Level ${newLevel}!`);
      } else {
        showToast(`+${amount} Study XP`);
      }

      const updated = {
        ...prev,
        xp: newXp,
        level: newLevel,
      };

      if (user) {
        updateUserStats(updated);
      }

      return updated;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleCompletePomodoro = (durationMinutes: number) => {
    setStats((prev) => {
      const updated = {
        ...prev,
        totalFocusMinutes: prev.totalFocusMinutes + durationMinutes,
        pomodorosCompleted: prev.pomodorosCompleted + 1,
      };
      if (user) {
        updateUserStats(updated);
      }
      return updated;
    });
    handleAwardXp(durationMinutes * 2);
  };

  const handleToggleMute = () => {
    if (!isAudioMuted) {
      soundEngine.stopAllAmbient();
      setIsAudioMuted(true);
      showToast("Audio Soundscapes Muted");
    } else {
      setIsAudioMuted(false);
      showToast("Audio Soundscapes Active");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF9E9] flex flex-col items-center justify-center p-4">
        <div className="bg-white border-[3px] border-black p-8 shadow-[8px_8px_0px_#000] text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 bg-[#FFE600] border-2 border-black shadow-[4px_4px_0px_#000] mx-auto flex items-center justify-center animate-spin">
            <span className="font-black text-xl">⚡</span>
          </div>
          <h2 className="font-black text-xl uppercase tracking-tight text-black">
            STUDISPACE OS
          </h2>
          <p className="font-mono text-xs font-bold text-gray-600">
            CONNECTING TO FIREBASE CLUSTER...
          </p>
          <div className="w-full h-3 bg-gray-100 border-2 border-black overflow-hidden p-0.5">
            <div className="h-full bg-[#82FB9B] border-r-2 border-black animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-black font-sans selection:bg-[#FFE600] selection:text-black">
      {/* Neo-Brutalist Top Navigation Bar */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          soundEngine.playChime("click");
          setCurrentTab(tab);
        }}
        stats={stats}
        onOpenBadges={() => {
          soundEngine.playChime("click");
          setIsBadgesModalOpen(true);
        }}
        isAudioMuted={isAudioMuted}
        onToggleMute={handleToggleMute}
        activeSoundCount={0}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-5">
        {currentTab === "dashboard" && (
          <DashboardView
            stats={stats}
            assignments={assignments}
            decks={decks}
            notes={notes}
            quizzes={quizzes}
            onNavigate={(tab) => {
              soundEngine.playChime("click");
              setCurrentTab(tab);
            }}
            onStartPomodoroWithTask={(taskTitle) => {
              setPomodoroTask(taskTitle);
              setCurrentTab("pomodoro");
            }}
            onOpenDeck={(deckId) => {
              setActiveDeckId(deckId);
              setCurrentTab("flashcards");
            }}
            onOpenQuiz={(quizId) => {
              setActiveQuizId(quizId);
              setCurrentTab("quiz");
            }}
          />
        )}

        {currentTab === "pomodoro" && (
          <PomodoroView
            onCompleteSession={handleCompletePomodoro}
            assignments={assignments}
            initialTaskTitle={pomodoroTask}
          />
        )}

        {currentTab === "socrates_ai" && (
          <SocratesChatView
            onSaveAsNote={(note) => {
              const newNote: StudyNote = {
                id: `note-${Date.now()}`,
                userId: user?.uid || "guest",
                title: note.title || "AI Insight",
                subject: note.subject || "Socrates AI",
                content: note.content || "",
                tags: note.tags || ["AI-Saved"],
                color: note.color || "#00F0FF",
                updatedAt: "Just now",
                isPinned: false,
              };
              setNotes((prev) => [newNote, ...prev]);
              saveNoteToDb(newNote);
              showToast("Saved insight to Study Notes");
            }}
            onAwardXp={handleAwardXp}
          />
        )}

        {currentTab === "flashcards" && (
          <FlashcardsView
            decks={decks}
            onUpdateDeck={(updatedDeck) => {
              setDecks((prev) =>
                prev.map((d) => (d.id === updatedDeck.id ? updatedDeck : d))
              );
              saveDeckToDb(updatedDeck);
            }}
            onAddDeck={(newDeck) => {
              const withUser = { ...newDeck, userId: user?.uid || "guest" };
              setDecks((prev) => [withUser, ...prev]);
              saveDeckToDb(withUser);
            }}
            onAwardXp={handleAwardXp}
            initialDeckId={activeDeckId}
          />
        )}

        {currentTab === "notes" && (
          <NotesView
            notes={notes}
            onAddNote={(newNote) => {
              const withUser = { ...newNote, userId: user?.uid || "guest" };
              setNotes((prev) => [withUser, ...prev]);
              saveNoteToDb(withUser);
            }}
            onUpdateNote={(updated) => {
              setNotes((prev) =>
                prev.map((n) => (n.id === updated.id ? updated : n))
              );
              saveNoteToDb(updated);
            }}
            onDeleteNote={(id) => {
              setNotes((prev) => prev.filter((n) => n.id !== id));
              deleteNoteFromDb(id);
            }}
            onAwardXp={handleAwardXp}
          />
        )}

        {currentTab === "quiz" && (
          <QuizArenaView
            quizzes={quizzes}
            onAddQuiz={(newQuiz) => {
              const withUser = { ...newQuiz, userId: user?.uid || "guest" };
              setQuizzes((prev) => [withUser, ...prev]);
              saveQuizToDb(withUser);
            }}
            onUpdateQuizScore={(quizId, score) => {
              setQuizzes((prev) =>
                prev.map((q) =>
                  q.id === quizId
                    ? {
                        ...q,
                        bestScore: Math.max(q.bestScore || 0, score),
                        timesTaken: (q.timesTaken || 0) + 1,
                      }
                    : q
                )
              );
              updateQuizScoreInDb(quizId, score);
              setStats((prev) => {
                const updated = {
                  ...prev,
                  quizzesTakenCount: prev.quizzesTakenCount + 1,
                };
                if (user) updateUserStats(updated);
                return updated;
              });
            }}
            onAwardXp={handleAwardXp}
            initialQuizId={activeQuizId}
          />
        )}

        {currentTab === "assignments" && (
          <AssignmentsView
            assignments={assignments}
            onAddAssignment={(newA) => {
              const withUser = { ...newA, userId: user?.uid || "guest" };
              setAssignments((prev) => [withUser, ...prev]);
              saveAssignmentToDb(withUser);
            }}
            onUpdateAssignment={(updated) => {
              setAssignments((prev) =>
                prev.map((a) => (a.id === updated.id ? updated : a))
              );
              saveAssignmentToDb(updated);
            }}
            onDeleteAssignment={(id) => {
              setAssignments((prev) => prev.filter((a) => a.id !== id));
              deleteAssignmentFromDb(id);
            }}
            onStartPomodoroWithTask={(taskTitle) => {
              setPomodoroTask(taskTitle);
              setCurrentTab("pomodoro");
            }}
            onAwardXp={handleAwardXp}
          />
        )}

        {currentTab === "soundscapes" && (
          <SoundscapesView onAwardXp={handleAwardXp} />
        )}
      </main>

      {/* Badges & Achievements Modal */}
      <BadgesModal
        isOpen={isBadgesModalOpen}
        onClose={() => setIsBadgesModalOpen(false)}
        stats={stats}
        badges={badges}
      />

      {/* Ephemeral Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#FFE600] text-black font-black text-xs px-4 py-2.5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-bounce">
          ⚡ {toastMessage}
        </div>
      )}
    </div>
  );
}

