# StudiSpace — Project Context & Single Source of Truth

> **Target Audience**: Future AI Coding Agents, Software Engineers, and Product Contributors.  
> **Status**: Living Architectural & Product Specification.  
> **Rule**: Any AI agent modifying or extending this codebase must read this file first.

---

## 1. Project Overview

- **Project Name**: StudiSpace
- **Core Concept**: All-in-One Student Workspace & Learning Space
- **Long-term Vision**: Personal "Student Operating System" (Student OS)
- **Target Audience**: High school, undergraduate, graduate, and self-directed students seeking a unified, distraction-free academic workspace.
- **Core Problem Solved**: Students currently juggle fragmented, disconnected tools (separate to-do lists, timer apps, note-taking apps, disparate AI chatbots, flashcard websites, and grade calculators). Switching contexts breaks focus, causes task leakage, and separates planning from actual study execution.
- **Product Vision**: A centralized workspace uniting the full student learning lifecycle:
  $$\text{PLAN} \longrightarrow \text{STUDY} \longrightarrow \text{FOCUS} \longrightarrow \text{TRACK} \longrightarrow \text{IMPROVE}$$
- **Main Value Proposition**: Unlike generic AI chatbots, StudiSpace couples context-aware AI mentorship with active execution tools (Pomodoro focus timer with built-in Web Audio ambient soundscapes, flashcards with active recall ratings, high-yield practice quiz arenas, note synthesis, and assignment timeline management).

---

## 2. Product Philosophy & Core Principles

1. **Clear Orientation at All Times**:
   A student opening StudiSpace must instantly answer:
   - *Where am I?* (Current subject, streak count, level & XP).
   - *What am I working on?* (Active task in the Pomodoro timer or open study module).
   - *What should I do next?* (Highest-priority upcoming assignment or recommended review deck).

2. **AI as an Active Mentor, Not an Answer Engine**:
   Socratic AI does not simply dump homework answers. It guides students through foundational principles, asks probing questions, breaks down complex jargon (ELI5 mode), grills exam concepts, and generates memorable mnemonics.

3. **Connected Workflows, Not Isolated Silos**:
   - **Planner & Tasks** $\rightarrow$ determines what needs to be done.
   - **Dashboard** $\rightarrow$ aggregates urgent deadlines, streak milestones, and one-click actions.
   - **Pomodoro Desk** $\rightarrow$ launches focus sprints directly tied to specific Planner tasks.
   - **Socratic AI** $\rightarrow$ breaks down roadblocks and references uploaded study notes/documents.
   - **Flashcards & Quiz Arena** $\rightarrow$ turns notes and topics into active recall systems with Google Sheets/Calendar integrations.
   - **Document Summarizer & Notes** $\rightarrow$ synthesizes lecture notes into cheat sheets, key terms, and action checkpoints.
   - **GPA & Grade Manager** $\rightarrow$ tracks course weights, target grades, and academic performance.

4. **Useful Student UX Over Technical Exposure**:
   Technical model identifiers (e.g., API version numbers, cloud endpoints) are kept in the architecture layer. The student interacts with a clean, responsive, and energetic academic interface.

---

## 3. Current Product Architecture

### Application Structure & Navigation Shell
The application is wrapped in an authenticated shell with a global Neo-Brutalist navigation header (`Header.tsx`):
- **Sticky Header**: Brand logo, student XP/Level badge, daily streak counter, global audio mute toggle, gamified Badges modal trigger, user profile display, and tab selector.
- **Navigation Tabs (`AppTab`)**:
  1. `dashboard` — Central mission control and aggregated progress overview.
  2. `pomodoro` — Focus desk with customizable intervals, active task binding, and ambient audio generators.
  3. `socrates_ai` — Socratic AI study mentor with multi-mode tutoring, voice input/output, and document context.
  4. `flashcards` — Spaced repetition flashcard decks with flip animations and AI deck generation.
  5. `notes` — Markdown study notes editor with one-click AI transformation tools (summaries, cheat sheets, key terms).
  6. `quiz` — Gamified Quiz Arena with streak bonuses, instant explanations, and Google Sheets CSV exports.
  7. `assignments` — Kanban board & timeline for assignments, exam weights, and Google Calendar sync.
  8. `soundscapes` — Dedicated ambient sound generator desk (Rain, Binaural 40Hz, White Noise, Lofi Vinyl, Cafe, Forest Stream).

> *Note on Peer Study Lounge*: Currently classified as a secondary / future feature. It is not part of the core MVP.

---

## 4. Feature Documentation

### 4.1 Dashboard
- **Purpose**: Aggregates academic progress, active streaks, urgent deadlines, and one-click entry into study sessions.
- **Workflow**:
  1. Displays current Study Streak, Level, Total Focus Minutes, and Quizzes Completed.
  2. Surfaces urgent assignments sorted by due date with one-click "Focus Sprint" launch and Google Calendar sync.
  3. Provides shortcuts to continue reviewing flashcards, take practice quizzes, or open Socrates AI.
- **Current Status**: `IMPLEMENTED`.
- **Key Components**: `src/components/DashboardView.tsx`.
- **Connected Systems**: Reads assignments, decks, notes, quizzes, and user stats directly from app state and Firestore.

### 4.2 Socratic AI Tutor
- **Purpose**: Intelligent academic mentor guiding students using inquiry-based learning.
- **Modes**:
  - `socratic` — Guided inquiry and hints instead of raw answer dumping.
  - `eli5` — Real-world metaphors and jargon-free explanations.
  - `exam_grill` — Rapid professor-style comprehension grilling.
  - `mnemonic` — Absurd mental associations and acronym generation.
  - `roast_essay` — Thesis and essay argumentation critique with upgrade suggestions.
- **Features**:
  - Voice-to-Text via Web Speech API (`SpeechRecognition`).
  - Voice Tutor via Web Speech Synthesis (`speechSynthesis`).
  - Document context attachment (Firebase Storage upload + Google Drive Doc link parsing).
  - Save AI insight directly into Study Notes with one click.
- **Current Status**: `IMPLEMENTED`.
- **Key Components**: `src/components/SocratesChatView.tsx`, `/api/gemini/chat` in `server.ts`.

### 4.3 Planner & Assignments
- **Purpose**: Track assignments, problem sets, exams, course weights, and estimated Pomodoro focus sprints.
- **Features**:
  - Kanban board (`To-Do`, `In Progress`, `Submitted/Done`) and subject filtering.
  - Due date assignment, priority badge (`urgent`, `high`, `medium`, `chill`), course weight %, and target grade (`A`, `B`, etc.).
  - "Start Focus Sprint" button that deep-links into the Pomodoro Desk with task pre-filled.
  - "Sync to G-Cal" generating pre-formatted Google Calendar study events.
- **Current Status**: `IMPLEMENTED` (Core Task & Assignment System); `PARTIALLY IMPLEMENTED` (AI Auto-Study Plan Generation from Syllabi is planned for next iteration).
- **Key Components**: `src/components/AssignmentsView.tsx`, `src/utils/firestoreService.ts`.

### 4.4 GPA & Grade Manager
- **Purpose**: Academic performance tracking, semester GPA management, and course grade simulation.
- **Current Codebase State**: Assignment weight percentages and target letter grades are tracked on individual assignments in `AssignmentsView.tsx`. A dedicated standalone GPA dashboard view with cumulative semester calculation and predictive grade simulation is scheduled in the roadmap.
- **Current Status**: `PARTIALLY IMPLEMENTED` (Per-assignment weights & target grades implemented; dedicated cumulative GPA simulator planned).

### 4.5 Pomodoro Focus Desk
- **Purpose**: Distraction-free study execution environment.
- **Features**:
  - 25m Work, 5m Short Break, 15m Long Break customizable timer intervals.
  - Direct binding to Planner task titles.
  - Integrated Web Audio ambient background generators (Rain, Binaural Gamma 40Hz, White Noise, Lofi Vinyl Crackle, Cafe Murmur, Stream).
  - Fullscreen focus mode, completion bell chime, confetti celebrations, and automatic XP / focus minutes tallying.
- **Current Status**: `IMPLEMENTED`.
- **Key Components**: `src/components/PomodoroView.tsx`, `src/utils/audioSynthesizer.ts`.

### 4.6 AI Document Summarizer & Study Notes
- **Purpose**: Markdown-based knowledge base with one-click AI transformation capabilities.
- **Features**:
  - Markdown note creation, pinning, search filtering, and color-coded tags.
  - One-click AI transformations via Gemini:
    - *⚡ Bulleted TL;DR Summary*
    - *🔑 Core Key Terms & Definitions*
    - *📋 Actionable Study Checkpoints*
    - *📑 1-Page Exam Cheat Sheet*
    - *🍕 ELI5 Simplified Note*
  - Ability to append or replace AI results into the active note.
- **Current Status**: `IMPLEMENTED`.
- **Key Components**: `src/components/NotesView.tsx`, `/api/gemini/transform-note` in `server.ts`.

### 4.7 Flashcards & Active Recall Decks
- **Purpose**: Spaced repetition study deck system.
- **Features**:
  - 3D card flip with tactile audio feedback.
  - Active recall mastery rating (`Learning`, `Mastered`).
  - AI Deck Generation from raw notes or topic prompts.
  - Manual card addition and card shuffling.
- **Current Status**: `IMPLEMENTED`.
- **Key Components**: `src/components/FlashcardsView.tsx`, `/api/gemini/generate-flashcards` in `server.ts`.

### 4.8 Quiz Arena & Google Sheets Export
- **Purpose**: Practice testing under simulated exam conditions.
- **Features**:
  - Multiple choice questions with instantaneous feedback, explanations, and hints.
  - Consecutive correct answer streak multipliers for gamified XP.
  - AI Quiz Generator with difficulty selection (`Easy`, `Medium`, `Hard`, `Genius`).
  - One-click **"Export Report to Google Sheets"** producing downloadable CSV study reports.
- **Current Status**: `IMPLEMENTED`.
- **Key Components**: `src/components/QuizArenaView.tsx`, `/api/gemini/generate-quiz` in `server.ts`.

---

## 5. Design System: Neo-Brutalist Academic Workspace

StudiSpace embraces a **Neo-Brutalist + Editorial Academic Workspace** visual language.

### Anti-Slop Visual Rules
- ❌ **No generic SaaS templates**: No arbitrary purple-to-blue gradients, glowing neon drop shadows, or cyan text on dark backgrounds.
- ❌ **No soft blurred shadows**: Shadows are strictly solid hard black offsets (`shadow-[4px_4px_0px_#000]` or `shadow-[5px_5px_0px_#000]`).
- ❌ **No excessive glassmorphism**: Solid white and colored surfaces with high-contrast borders.
- ❌ **No nested card soup**: Use clean dividers, whitespace, and typographic contrast instead of embedding cards within cards.
- ❌ **No soft pill-shaped cards**: Standard cards maintain rectangular geometries with crisp corners (`border-2 border-black`).

### 5.1 Color Palette & Semantic Meaning
| Color Name | Hex Code | Semantic Role in StudiSpace |
| :--- | :--- | :--- |
| **Canvas Background** | `#F4F4F0` | Warm editorial off-white body background |
| **Pure Surface** | `#FFFFFF` | Primary card and modal background |
| **Electric Yellow** | `#FFE600` | Primary action, focus sprints, level milestones |
| **Mint Green** | `#73EC8E` / `#82FB9B` | Success, mastered status, completed items, XP awards |
| **Hot Pink** | `#FF66C4` | Urgent deadlines, streak badges, critical alerts |
| **Cyan Blue** | `#00F0FF` | AI insights, Socrates context, active audio indicators |
| **Tangerine Orange** | `#FFA94D` | Assignments, exam deadlines, in-progress tasks |
| **Lilac Purple** | `#C4B5FD` | Quizzes, conceptual synthesis, academic categories |
| **Ink Black** | `#000000` | High-contrast borders, display typography, solid hard shadows |

### 5.2 Borders & Shadows
- **Standard Card Borders**: `border-2 border-black` (2px solid black).
- **Primary CTAs / Modals**: `border-[3px] border-black` or `border-2 border-black`.
- **Standard Hard Shadow**: `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
- **Primary Hero / Modal Shadow**: `shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]` or `shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`
- **Active Button Press**: `active:translate-x-1 active:translate-y-1 active:shadow-none`

### 5.3 Typography & Hierarchy
- Primary Font: Clean sans-serif system stack (`font-sans`) paired with monospace accents (`font-mono`) for technical metadata, timestamps, and status chips.
- Hierarchy: Heavy black display headings (`font-black uppercase tracking-tight`), bold labels (`font-bold text-xs`), and high-legibility body text (`text-sm font-medium text-gray-800`).

---

## 6. Design Consistency Rules for Future Agents

Future agents modifying this codebase **MUST**:
1. **Preserve the Global Header**: Do not replace `Header.tsx` with a generic sidebar unless explicitly requested by the user.
2. **Preserve Color Semantics**: Use `#FFE600` for primary actions, `#73EC8E` for completions/success, `#FF66C4` for urgent items/streaks, and `#00F0FF` for AI interactions.
3. **Preserve the Hard Shadow System**: Never add `shadow-lg`, `shadow-xl`, `backdrop-blur`, or blurred rgba shadows. Use `shadow-[3px_3px_0px_#000]`, `shadow-[4px_4px_0px_#000]`, etc.
4. **Preserve Tactile Audio Feedback**: Call `soundEngine.playChime("click")`, `"success"`, `"wrong"`, `"bell"`, or `"levelup"` during appropriate user interactions.
5. **Preserve Unified Task Flow**: Never create a separate disconnected task list on a new page. All tasks must flow through the `Assignment` entity and `AssignmentsView`.
6. **Preserve HTML ID Attributes**: Meaningful buttons and interactive containers must have distinct `id` tags (e.g., `btn-add-assignment`, `btn-dash-start-focus`).

---

## 7. Shared Data / Domain Model

All TypeScript interfaces are centrally declared in `src/types.ts`:

### `Assignment`
```typescript
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
```
*Storage*: Firestore collection `assignments`, synchronized in real time.

### `FlashcardDeck` & `Flashcard`
```typescript
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
```
*Storage*: Firestore collection `decks`.

### `StudyNote`
```typescript
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
```
*Storage*: Firestore collection `notes`.

### `Quiz` & `QuizQuestion`
```typescript
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
```
*Storage*: Firestore collection `quizzes`.

### `ChatMessage`
```typescript
export interface ChatMessage {
  id: string;
  userId?: string;
  role: "user" | "model" | "system";
  text: string;
  timestamp: string;
  mode?: "socratic" | "eli5" | "exam_grill" | "mnemonic" | "roast_essay";
  createdAt?: number;
}
```
*Storage*: Firestore collection `chats`.

### `UploadedStudyDocument`
```typescript
export interface UploadedStudyDocument {
  id: string;
  name: string;
  downloadUrl: string;
  storagePath: string;
  size: number;
  type: string;
  userId: string;
  uploadedAt: string;
}
```
*Storage*: Firebase Storage `documents/{userId}/...` + Firestore collection `documents`.

### `UserStats` & `UserProfile`
```typescript
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
```
*Storage*: Firestore collection `users/{userId}` and local state.

---

## 8. Current Implementation Status

| Feature / Module | Status | Implementation Details |
| :--- | :--- | :--- |
| **Firebase Auth & Guest Mode** | `IMPLEMENTED` | Google Sign-in popup, email login/signup, instant Guest Scholar mode (`AuthContext.tsx`). |
| **Global Shell & Header** | `IMPLEMENTED` | Gamified stats bar, level counter, active sound toggle, responsive navigation (`Header.tsx`). |
| **Mission Control Dashboard** | `IMPLEMENTED` | Streak counter, 4-metric grid, continue study shortcuts, urgent assignments (`DashboardView.tsx`). |
| **Socratic AI Tutor** | `IMPLEMENTED` | 5 tutoring modes, Gemini 3.7 Flash server endpoint, voice input/output (`SocratesChatView.tsx`). |
| **Web Speech & Voice Tutor** | `IMPLEMENTED` | Web Speech API voice input, SpeechSynthesis voice output with clean markdown scrubbing. |
| **Pomodoro Focus Desk** | `IMPLEMENTED` | 25/5/15m intervals, Planner task binding, session counter, confetti, chime notifications. |
| **Pure Web Audio Soundscapes** | `IMPLEMENTED` | Zero-dependency Web Audio synthesizer with 6 ambient tracks and UI chimes (`audioSynthesizer.ts`). |
| **Flashcards & Active Recall** | `IMPLEMENTED` | Flip cards, mastery ratings, shuffle, and Gemini AI flashcard deck generator (`FlashcardsView.tsx`). |
| **Study Notes & AI Summarizer** | `IMPLEMENTED` | Markdown editor, tags, search, and 5 Gemini note transformation actions (`NotesView.tsx`). |
| **Quiz Arena & Sheets Export** | `IMPLEMENTED` | Multi-choice testing, streak XP multipliers, AI quiz generator, Google Sheets CSV export. |
| **Assignments & Timeline** | `IMPLEMENTED` | Kanban status columns, priority badges, course weights, and Google Calendar sync button. |
| **Firebase Cloud Storage** | `IMPLEMENTED` | File uploads to `documents/` path with Firestore metadata synchronization. |
| **Google Drive Context Picker** | `IMPLEMENTED` | Direct Google Docs URL import and context parsing for Socrates AI. |
| **Gamified Badges & XP System** | `IMPLEMENTED` | Level progression formula (`Math.floor(xp / 500) + 1`), achievements modal (`BadgesModal.tsx`). |
| **GPA & Grade Simulator** | `PARTIALLY IMPLEMENTED` | Assignment weights & target grades exist; dedicated cumulative GPA simulator planned. |
| **Peer Study Lounge** | `FUTURE` | Real-time multi-user study rooms scheduled for post-MVP. |

---

## 9. Technical Architecture

```
                                  +---------------------------------------+
                                  |         Browser Client (React 19)     |
                                  |   - Neo-Brutalist UI (Tailwind CSS v4)|
                                  |   - Web Audio Synth (Ambient Sound)   |
                                  |   - Web Speech API (Voice Input/Output|
                                  +---+-------------------------------+---+
                                      |                               |
                   Client SDK Direct  |                               | REST API Proxies
                                      v                               v
            +-------------------------+----+              +-----------+-------------+
            |      Firebase Backend        |              | Express Server (Node/TS)|
            |  - Firebase Authentication   |              |  - Port 3000 Ingress    |
            |  - Cloud Firestore Database  |              |  - Vite dev/prod server |
            |  - Firebase Cloud Storage    |              +-----------+-------------+
            +------------------------------+                          |
                                                                      v
                                                          +-----------+-------------+
                                                          | Google GenAI SDK        |
                                                          |  - Model: gemini-3.7-flash
                                                          |  - Server-side secrets  |
                                                          +-------------------------+
```

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`).
- **Animations & FX**: `motion` (layout/transitions), `canvas-confetti` (level ups, quiz & pomodoro completions).
- **Icons**: `lucide-react`.
- **Backend Service**: Express 4 running on Node.js via `server.ts`. Bound strictly to port `3000` and host `0.0.0.0`.
- **AI Integration**: `@google/genai` TypeScript SDK invoking `gemini-3.7-flash` exclusively on the backend (`server.ts`).
- **Database & Auth**: Firebase Auth + Cloud Firestore + Firebase Storage.
- **Audio Engine**: Pure Web Audio API (`AudioContext`, `BiquadFilterNode`, `OscillatorNode`, `ChannelMergerNode`).
- **Speech Engine**: Browser Native Web Speech API (`webkitSpeechRecognition` & `speechSynthesis`).

### Environment Variables
- `GEMINI_API_KEY`: Server-side secret injected by AI Studio for Gemini generation.
- `APP_URL`: Container service URL.
- `VITE_FIREBASE_*`: Client-side Firebase credentials declared in `.env.example` and `src/utils/firebase.ts`.

---

## 10. Repository Structure

```
├── .env.example                # Environment variable declarations
├── firestore.rules             # Firestore security rules
├── index.html                  # HTML entry point
├── metadata.json               # App metadata and major capabilities
├── package.json                # Project dependencies & build scripts
├── server.ts                   # Express server entry point & Gemini API routes
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration with Tailwind CSS plugin
├── docs/
│   └── PROJECT_CONTEXT.md      # Single source-of-truth project documentation (THIS FILE)
└── src/
    ├── App.tsx                 # Root application component & state synchronization
    ├── main.tsx                # React DOM entry point
    ├── index.css               # Global Tailwind CSS import (@import "tailwindcss";)
    ├── types.ts                # Central TypeScript domain models & interfaces
    ├── context/
    │   └── AuthContext.tsx     # Firebase Authentication and User Profile provider
    ├── utils/
    │   ├── audioSynthesizer.ts # Web Audio ambient soundscapes & UI sound effects
    │   ├── firebase.ts         # Firebase App, Auth, Firestore & Storage initialization
    │   ├── firestoreService.ts # Real-time Firestore sync & Storage upload helpers
    │   └── initialData.ts      # Default seed data for initial offline/guest session
    └── components/
        ├── Header.tsx          # Global navigation header & gamification bar
        ├── LoginView.tsx       # Auth login, signup & guest exploration screen
        ├── DashboardView.tsx   # Mission Control overview & quick study actions
        ├── PomodoroView.tsx    # Focus timer with task binding & soundscape presets
        ├── SocratesChatView.tsx# Socratic AI multi-mode study mentor with voice & docs
        ├── FlashcardsView.tsx  # Active recall flashcards & AI deck generator
        ├── NotesView.tsx       # Markdown notes & AI summarizer / cheat sheet engine
        ├── QuizArenaView.tsx   # Practice quizzes, streak bonuses & Sheets export
        ├── AssignmentsView.tsx # Kanban task tracker & Google Calendar sync
        ├── SoundscapesView.tsx # Dedicated ambient sound generator desk
        └── BadgesModal.tsx     # Gamified achievements & level unlocks modal
```

---

## 11. Important Product & Architectural Decisions

1. **Neo-Brutalist Visual Identity Is Permanent**:
   The tactile, high-contrast, black-bordered visual language is central to the StudiSpace brand. Do not alter this for generic pastel SaaS themes.
2. **Server-Side Gemini Proxying**:
   The Gemini API key is never exposed to the client. All generative capabilities (`/api/gemini/chat`, `/api/gemini/generate-flashcards`, `/api/gemini/generate-quiz`, `/api/gemini/transform-note`) reside in `server.ts`.
3. **Planner as the Ground Truth for Tasks**:
   `Assignment` items are the single source of truth for academic tasks. Dashboard's "Today's Focus" and Pomodoro's active session title derive from this list.
4. **Google Ecosystem Integrations**:
   - Google Calendar sync creates formatted study sprint blocks.
   - Google Sheets export formats quiz reports with score breakdowns and explanations.
   - Google Drive context allows scholars to link notes directly to Socrates AI.
5. **Zero-Dependency Audio Engine**:
   Ambient sounds (rain, binaural beats, vinyl crackle, etc.) are synthesized mathematically via the Web Audio API without requiring external MP3 bandwidth or CDNs.

---

## 12. AI Agent Guidelines

Before making any code changes, any future AI agent **MUST**:
1. Read this `docs/PROJECT_CONTEXT.md` file.
2. Maintain design system tokens (2px solid black borders, hard shadows, semantic colors).
3. Check `src/types.ts` before creating new interfaces to prevent duplicate data structures.
4. Never break or bypass Firebase Firestore real-time synchronization in `src/utils/firestoreService.ts`.
5. Keep all Gemini API calls server-side in `server.ts`.
6. Run `lint_applet` and `compile_applet` after edits to guarantee clean builds.
7. Update the **Change Log** in Section 16 whenever significant architecture changes occur.

---

## 13. Known Gaps & Technical Debt

1. **Standalone GPA Calculator**: Currently, course weights and grade targets exist in `AssignmentsView.tsx`, but a dedicated cumulative semester GPA visualizer and simulation tool has not yet been extracted into a separate view.
2. **PDF Text Extraction on Client**: Document uploads in `SocratesChatView.tsx` store files in Firebase Storage and reference names/links. Raw PDF client-side text parsing for large multi-page textbooks is currently simplified.
3. **OAuth Token Picker**: Google Drive integration currently parses pasted Google Drive shareable URLs; a full client-side Google Picker OAuth token flow can be added for 1-click Drive browsing.

---

## 14. Product Roadmap

### NOW (Current Milestone)
- ✅ Stable Neo-Brutalist student OS shell with real-time Firebase syncing.
- ✅ Socratic AI with 5 study modes, voice interaction, and document context.
- ✅ Pomodoro focus desk with task integration and Web Audio soundscapes.
- ✅ Flashcard spaced repetition with active recall ratings and AI deck generator.
- ✅ Study notes editor with AI summarizer, cheat sheet, and key terms generator.
- ✅ Quiz Arena with streak scoring and Google Sheets CSV report export.
- ✅ Assignment Kanban timeline with Google Calendar sync.

### NEXT (Immediate Priorities)
- [ ] Dedicated GPA & Semester Grade Simulator view.
- [ ] Automated AI Study Plan generator from uploaded course syllabi.
- [ ] In-browser PDF text parser for multi-chapter textbook summarization.
- [ ] Dark Mode Neo-Brutalist palette option (high-contrast dark canvas `#121212`).

### LATER (Post-MVP)
- [ ] Peer Study Lounge (real-time collaborative study rooms via WebRTC / WebSockets).
- [ ] Direct Google Classroom syllabus import integration.
- [ ] Spaced repetition notification reminders.

---

## 15. Important Terminology

- **StudiSpace**: The all-in-one student workspace and personal Learning OS.
- **Socrates AI**: The pedagogical study mentor powered by Gemini that prompts critical inquiry rather than answer dumping.
- **Focus Sprint**: A 25-minute Pomodoro study block tied to a specific academic assignment.
- **Active Recall**: The testing methodology used in Flashcards and Quiz Arena to reinforce memory retention.
- **Soundscape**: Synthesized ambient audio generated in real time using the browser Web Audio API.
- **Mastery Level**: Flashcard proficiency state (`new`, `learning`, `mastered`).
- **Today's Focus**: The prioritized set of tasks and study goals derived from the Planner.

---

## 16. Change Log

### 2026-08-25
- Initial single source-of-truth project context created in `docs/PROJECT_CONTEXT.md`.
- Documented full Neo-Brutalist design system, color semantics, borders, and hard-shadow rules.
- Documented technical stack (React 19, Vite 6, Tailwind CSS v4, Express, Firebase Firestore/Storage/Auth, Gemini 3.7 Flash).
- Documented Google Workspace integrations (Calendar Sync, Sheets Export, Drive Picker) and Web Audio synthesizer engine.
- Outlined MVP boundaries, domain entities, known gaps, and future roadmap.
