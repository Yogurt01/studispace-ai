export type AppTab =
  | "dashboard"
  | "pomodoro"
  | "socrates_ai"
  | "flashcards"
  | "notes"
  | "quiz"
  | "assignments"
  | "soundscapes";

export type Priority = "urgent" | "high" | "medium" | "chill";

export type AssignmentStatus = "todo" | "in_progress" | "done";

export interface Assignment {
  id: string;
  userId?: string;
  title: string;
  subject: string;
  dueDate: string;
  priority: Priority;
  status: AssignmentStatus;
  estimatedPomodoros: number;
  completedPomodoros: number;
  weightPercent?: number;
  gradeTarget?: string;
  notes?: string;
}

export type MasteryLevel = "new" | "learning" | "mastered";

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  hint: string;
  category?: string;
  tags: string[];
  masteryLevel: MasteryLevel;
  reviewCount: number;
  lastReviewed?: string;
}

export interface FlashcardDeck {
  id: string;
  userId?: string;
  title: string;
  subject: string;
  description: string;
  color: string;
  cards: Flashcard[];
  createdAt: string;
}

export interface StudyNote {
  id: string;
  userId?: string;
  title: string;
  subject: string;
  content: string;
  tags: string[];
  color: string;
  updatedAt: string;
  isPinned?: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint?: string;
}

export interface Quiz {
  id: string;
  userId?: string;
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Genius";
  questions: QuizQuestion[];
  bestScore?: number;
  timesTaken?: number;
}

export interface ChatMessage {
  id: string;
  userId?: string;
  role: "user" | "model" | "system";
  text: string;
  timestamp: string;
  mode?: "socratic" | "eli5" | "exam_grill" | "mnemonic" | "roast_essay";
  createdAt?: number;
}

export interface UserStats {
  xp: number;
  level: number;
  streakDays: number;
  totalFocusMinutes: number;
  pomodorosCompleted: number;
  cardsReviewedCount: number;
  quizzesTakenCount: number;
  unlockedBadgeIds: string[];
}

export interface Badge {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  unlocked: boolean;
  req: string;
}
