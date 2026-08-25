# 🚀 StudiSpace

> **All-in-One AI-Powered Student Workspace & Learning Operating System**  
> Uniting planning, focused study execution, active recall testing, and academic tracking into a single distraction-free workspace.

---

## 📌 Project Status

> 🚧 **Active Development** — Core workspace modules (Dashboard, Socratic AI Mentor, Pomodoro Desk, Flashcards, Quiz Arena, Study Notes, and Task Planner) are implemented and functional. Additional features like the dedicated GPA Simulator and Syllabi Auto-Planner are in active iteration.

---

## 📖 Overview

Students currently juggle fragmented, disconnected tools: separate task lists, timer apps, note-taking software, standalone AI chatbots, flashcard sites, and grade spreadsheets. Constantly context-switching breaks deep focus and separates planning from actual study execution.

**StudiSpace** is designed as a personal **Student Operating System (Student OS)** that bridges this gap. Rather than acting as a simple AI chatbot, StudiSpace connects the entire academic learning cycle:

$$\textbf{PLAN} \longrightarrow \textbf{STUDY} \longrightarrow \textbf{FOCUS} \longrightarrow \textbf{TRACK} \longrightarrow \textbf{IMPROVE}$$

- **Plan**: Schedule assignments, set target grades, and structure study milestones.
- **Study**: Learn foundational concepts with Socratic inquiry and synthesize lecture notes.
- **Focus**: Launch 25-minute Pomodoro focus sprints with zero-dependency ambient soundscapes.
- **Track**: Monitor daily streaks, level progression, focus hours, and exam weights.
- **Improve**: Pinpoint weak concepts with adaptive practice quizzes and spaced repetition flashcards.

---

## ✨ Key Features

### 🧠 Socratic AI Tutor (`gemini-3.7-flash`)
- **Inquiry-Driven Guidance**: Guides problem solving through questioning rather than dumping raw answers.
- **5 Tutoring Modes**: Socratic Inquiry, ELI5 (Metaphors), Exam Grill, Mnemonics Generator, and Essay Argumentation Roast.
- **Voice Tutor & Microphone**: Native Web Speech API integration for hands-free voice questioning and speech synthesis reading.
- **Document Context & Drive Import**: Attach study PDFs/images via Firebase Storage or link Google Docs directly into the conversation.

### 🍅 Pomodoro Focus Desk
- **Interval Presets**: Classic 25/5/15 Pomodoro cycle with real-time progress indicators and fullscreen mode.
- **Planner Task Binding**: Launch focus sprints directly linked to specific assignments.
- **Built-in Web Audio Soundscapes**: Pure mathematical synthesis of Rain, 40Hz Binaural Gamma waves, White Noise, Lofi Vinyl Crackle, Cafe Murmur, and Forest Streams without external audio files.

### 📝 AI Document Summarizer & Study Notes
- **Markdown Knowledge Base**: Organize notes with color-coded tags, search filters, and pinned items.
- **One-Click AI Note Transformations**: Generate bulleted TL;DR summaries, key term glossaries, actionable checkpoints, and 1-page exam cheat sheets.

### 🗂️ Active Recall Flashcards
- **Interactive Spaced Repetition**: 3D card flips with tactile audio feedback and mastery ratings (`Learning` / `Mastered`).
- **AI Deck Generator**: Instantly generate structured flashcard decks from any topic or raw lecture notes.

### ⚡ Quiz Arena & Google Sheets Export
- **Exam Testing Simulation**: Multiple-choice quizzes with explanations, hints, and streak multiplier XP.
- **Google Sheets Export**: One-click generation of formatted `.csv` reports with question breakdowns and mastery percentages.
- **AI Quiz Generator**: Generate custom quizzes by topic and difficulty (`Easy`, `Medium`, `Hard`, `Genius`).

### 📅 Planner, Assignments & Google Calendar Sync
- **Academic Kanban Board**: Filter tasks by status (`To-Do`, `In Progress`, `Done`), subject, priority, and course weight.
- **Google Calendar Sync**: Formats target grades, Pomodoro estimates, and deadlines into 1-click Google Calendar study blocks.

### 📊 GPA & Academic Performance
- **Grade Targets & Weights**: Track percentage weights and target letter grades per assignment.
- *Status: Dedicated cumulative GPA & grade simulation dashboard is currently planned.*

---

## 🔄 Product Workflow

```text
    ┌─────────────────────────────────────────────────────────┐
    │                      1. PLAN                            │
    │  Set assignments, deadlines, weights, and target grades │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │                      2. STUDY                           │
    │  Break down concepts with Socrates AI & synthesize notes│
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │                      3. FOCUS                           │
    │  Execute 25m Pomodoro sprints with ambient soundscapes  │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │                      4. TEST & TRACK                    │
    │  Active recall flashcards, quiz arena, & streak tracker │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │                      5. IMPROVE                         │
    │  Export quiz analytics to Google Sheets & refine plan   │
    └─────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System: Neo-Brutalist Academic Workspace

StudiSpace is intentionally designed to feel like a **physical study desk translated into a high-energy digital workspace**:

- **Neo-Brutalist Aesthetic**: High-contrast 2px solid black borders, sharp rectangular geometries, and solid offset shadows (`shadow-[4px_4px_0px_#000]`).
- **Tactile Sound Engine**: Browser-synthesized UI chimes for clicks, success events, level-ups, and timer completions.
- **Semantic Palette**:
  - `#F4F4F0` — Warm canvas background
  - `#FFFFFF` — Card surfaces
  - `#FFE600` — Electric Yellow for primary actions & focus sprints
  - `#73EC8E` — Mint Green for completions & mastery
  - `#FF66C4` — Hot Pink for urgent deadlines & streak milestones
  - `#00F0FF` — Cyan for AI insights & active audio indicators
  - `#000000` — High-contrast ink borders and solid shadows

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript | Reactive, component-driven UI architecture |
| **Build & Tooling** | Vite 6, tsx, esbuild | Instant HMR development and CJS production bundling |
| **Styling** | Tailwind CSS v4 | High-performance utility-first styling |
| **Animations** | Motion (`motion/react`), canvas-confetti | Smooth state transitions and celebration FX |
| **Icons** | Lucide React | Consistent vector iconography |
| **Audio Engine** | Web Audio API | Zero-dependency mathematical synthesis for ambient noise & UI chimes |
| **Speech Engine** | Web Speech API | Native in-browser voice recognition and speech synthesis |
| **Backend** | Node.js, Express 4 | API proxying on port 3000 to keep secrets secure |
| **AI Integration** | Google GenAI SDK (`gemini-3.7-flash`) | Server-side LLM inference for chat, notes, quizzes, and decks |
| **Database & Auth** | Firebase Authentication, Cloud Firestore | Real-time user stats, notes, tasks, decks, and guest session sync |
| **Cloud Storage** | Firebase Storage | Document uploads for PDF/image study context |

---

## 📁 Repository Structure

```text
├── docs/
│   └── PROJECT_CONTEXT.md      # Single source-of-truth architectural specification
├── src/
│   ├── components/             # Core workspace views and modals
│   │   ├── AssignmentsView.tsx # Kanban planner & Google Calendar integration
│   │   ├── BadgesModal.tsx     # Gamified achievements & level unlocks
│   │   ├── DashboardView.tsx   # Mission control overview & quick actions
│   │   ├── FlashcardsView.tsx  # Spaced repetition decks & AI generator
│   │   ├── Header.tsx          # Navigation shell, streak counter, & audio controls
│   │   ├── LoginView.tsx       # Auth portal (Email, Google, Guest mode)
│   │   ├── NotesView.tsx       # Markdown notes & AI summarizer
│   │   ├── PomodoroView.tsx    # Focus timer & task binder
│   │   ├── QuizArenaView.tsx   # Quiz testing & Google Sheets export
│   │   ├── SocratesChatView.tsx# Socratic AI multi-mode voice mentor
│   │   └── SoundscapesView.tsx # Dedicated ambient sound generator desk
│   ├── context/
│   │   └── AuthContext.tsx     # Firebase Auth state & guest session handling
│   ├── utils/
│   │   ├── audioSynthesizer.ts # Web Audio ambient synth & chime generator
│   │   ├── firebase.ts         # Firebase client SDK initialization
│   │   ├── firestoreService.ts # Real-time Firestore sync & Storage helpers
│   │   └── initialData.ts      # Seed data for guest/offline exploration
│   ├── App.tsx                 # Root application component & state coordinator
│   ├── index.css               # Global CSS entrypoint (@import "tailwindcss";)
│   ├── main.tsx                # Client DOM mount
│   └── types.ts                # Shared TypeScript domain models & interfaces
├── firestore.rules             # Firestore security rules
├── metadata.json               # Platform capabilities & permissions
├── package.json                # Project dependencies and npm scripts
├── server.ts                   # Express server entry point & Gemini API endpoints
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **yarn**
- **Gemini API Key**: Required for AI features (get one from [Google AI Studio](https://aistudio.google.com))
- **Firebase Project**: Required for multi-device sync and authentication

### Installation

1. **Clone the repository**:
   ```bash
   git clone <YOUR_GITHUB_REPOSITORY>
   cd studispace
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```env
   # Server-side Secret (Never prefix with VITE_)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Client-side Firebase Configuration
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💻 Available Scripts

- `npm run dev`: Boots the full-stack app (Express server + Vite middleware) via `tsx` on port 3000.
- `npm run build`: Builds the client-side SPA into `dist/` and bundles `server.ts` into a CommonJS production bundle via `esbuild`.
- `npm run start`: Runs the compiled production server (`node dist/server.cjs`).
- `npm run lint`: Validates TypeScript type safety via `tsc --noEmit`.
- `npm run clean`: Cleans up local build outputs and distribution directories.

---

## 🗺️ Roadmap

### Current (Implemented)
- [x] Socratic AI Tutor with 5 inquiry modes, Web Speech voice I/O, and document context.
- [x] Pomodoro Focus Desk with task binding and Web Audio ambient soundscapes.
- [x] Spaced repetition Flashcards with active recall ratings and AI deck generation.
- [x] Markdown Study Notes with 5 one-click AI transformation tools.
- [x] Quiz Arena with streak bonuses and Google Sheets CSV export.
- [x] Assignment Kanban planner with priority badges and Google Calendar sync.
- [x] Firebase Authentication (Email, Google Auth, and Guest Mode) with real-time Firestore persistence.

### Next
- [ ] Dedicated cumulative GPA visualizer & grade simulator view.
- [ ] Automated AI study schedule generator from uploaded syllabus documents.
- [ ] In-browser client-side PDF text parser for multi-page textbook summarization.

### Future
- [ ] Peer Study Lounge (real-time collaborative study rooms).
- [ ] Direct Google Classroom syllabus and assignment synchronization.

---

## 📚 Developer Documentation

For in-depth architectural specifications, design system contracts, domain models, and guidelines for AI coding agents, refer to:
- [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md) — Single source-of-truth project manual.

---

## 📄 License

License has not been finalized yet.

---

## 👥 Project & Maintainers

- **Project**: StudiSpace
- **Maintainer**: `<repository owner>`
