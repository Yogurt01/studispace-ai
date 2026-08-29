export type AppTab =
  | "dashboard"
  | "pomodoro"
  | "socrates_ai"
  | "flashcards"
  | "notes"
  | "quiz"
  | "assignments"
  | "gpa"
  | "documents"
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

export type CourseCategory = "Core" | "Major Elective" | "Gen Ed" | "Lab" | "Honors";

export interface ExtractedCourse {
  courseCode: string;
  courseName: string;
  term: string;
  credits: number;
  grade?: string;
  letterGrade?: string;
  numericGrade?: number;
  qualityPoints?: number;
  category?: CourseCategory;
}

export interface TranscriptParseResponse {
  institution?: string;
  courses: ExtractedCourse[];
  extractedCourses?: ExtractedCourse[];
  confidenceScore?: number;
  warning?: string;
  simulated?: boolean;
}

export interface CourseGrade {
  id: string;
  userId?: string;
  courseCode: string;
  courseName: string;
  term: string; // e.g. "Fall 2025", "Spring 2026"
  credits: number; // e.g. 3, 4
  letterGrade: string; // e.g. "A", "A-", "B+", etc.
  numericGrade?: number; // e.g. 92 out of 100 or 9.2 out of 10
  category: CourseCategory;
  qualityPoints4: number; // credits * gradePoint4
  qualityPoints10: number; // credits * gradePoint10
}

export type PomodoroPreset = "quick" | "standard" | "marathon" | "custom";

export interface PomodoroSessionConfig {
  preset: PomodoroPreset;
  totalSprints: number;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
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

export type DocumentCategory = "Textbook" | "Lecture Slide" | "Syllabus" | "Exam Paper" | "Other";

export interface StudyDocument {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileUrl: string; // Firebase Storage download URL or blob URL
  storagePath?: string; // Path in Firebase Storage for deletion
  fileType: string; // e.g., 'application/pdf', 'image/png'
  fileSize: number; // File size in bytes
  uploadedAt: string; // ISO timestamp
  courseTag?: string; // e.g., 'CS 201', 'Calculus II', 'General'
  category: DocumentCategory;
  pinned?: boolean;
}

