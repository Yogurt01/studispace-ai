# 🚀 StudiSpace

> **All-in-One AI-Powered Student Workspace & Learning Operating System**  
> Uniting planning, focused study execution, active recall testing, and academic tracking into a single distraction-free workspace.

---

## 📌 Project Status

> 🚧 **Active Development** — Core workspace modules (Dashboard, Socratic AI Mentor, Pomodoro Desk, Flashcards, Quiz Arena, Study Notes, and Task Planner) are implemented and functional. Additional features like the dedicated GPA Simulator and Syllabi Auto-Planner are in active iteration.

---

- **Google Sheets Export**: One-click generation of formatted `.csv` reports with question breakdowns and mastery percentages.
- **AI Quiz Generator**: Generate custom quizzes by topic and difficulty (`Easy`, `Medium`, `Hard`, `Genius`).

### 📅 Planner, Assignments & Google Calendar Sync
- **Academic Kanban Board**: Filter tasks by status (`To-Do`, `In Progress`, `Done`), subject, priority, and course weight.
- **Google Calendar Sync**: Formats target grades, Pomodoro estimates, and deadlines into 1-click Google Calendar study blocks.

### 📊 GPA & Academic Performance
- **Grade Targets & Weights**: Track percentage weights and target letter grades per assignment.
- *Status: Dedicated cumulative GPA & grade simulation dashboard is currently planned.*

---

## 🧩 Local Development Setup

For the complete, standalone setup and troubleshooting guide, see [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

### Prerequisites
- Node.js 22 or newer
- npm
- A Google AI Studio API key for Gemini (optional if you only use the local Qwen3 provider)
- A Firebase project with Authentication, Firestore, and Storage enabled

> The project dependencies require Node 22+; the container and CI use Node 22. Using Node 18 cannot load the Tailwind native binding.

### Install dependencies
```bash
npm ci
```

### Environment variables
Create a local `.env` file in the project root using the template in `.env.example`:

```bash
cp .env.example .env
```

Then fill in the values:
```env
GEMINI_API_KEY=your_gemini_api_key_here
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

Important notes:
- `GEMINI_API_KEY` stays on the server side and is loaded by `server.ts` via `dotenv`.
- The `VITE_FIREBASE_*` values are browser-exposed and must match your Firebase web app configuration.
- Never commit `.env`; keep `.env.example` as the safe template in git.

### Run the app
```bash
npm run dev
```

The app runs on `http://localhost:3000`.

### Create a production build
```bash
npm run build
```

### Validate types
```bash
npm run lint
```

### Run tests
```bash
npm test
```

### Docker
Build and run the production image. Runtime values are injected, never copied into the image:

```bash
docker build -t studispace .
docker run --rm --env-file .env -p 3000:3000 studispace
```

Or use Compose for the same production-like local setup:

```bash
docker compose up --build
```

The container serves the app on port 3000 and exposes `GET /health` for health checks.

### Environment reference

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Server, secret | Yes in production | Google AI Studio API key. |
| `PORT` | Server | No | Defaults to `3000`. |
| `APP_URL` | Server | No | Public application URL for deployment configuration. |
| `NODE_ENV` | Server | No | Use `production` in containers. |
| `DISABLE_HMR` | Development tooling | No | Disables Vite HMR/file watching when `true`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Server, secret path | Required for server Firestore persistence | Absolute service-account JSON path; keep the JSON outside the repository. |
| `VITE_FIREBASE_*` | Browser-visible | Yes | Firebase web-app configuration, safe to expose but must match the Firebase project. |

### Deployment and CI/CD

Two workflows:

- **Quality Gate** (`.github/workflows/ci.yml`) — every push and pull request:
  `npm ci`, `npm run lint`, `npm test`, `npm run build`, hermetic browser E2E
  (`npm run test:e2e`), plus a Docker image build with a `/health` smoke test.
  It is fully deterministic: no Gemini quota, no Firebase service account, no
  local Ollama, no GPU. All provider calls are stubbed.
- **Deploy** (`.github/workflows/deploy.yml`) — pushes to `main` only: reuses the
   quality gate, builds and publishes the image to Artifact Registry, deploys to
   Cloud Run, health-checks the rollout and rolls back to the previous revision if
   the check fails. Production advertises Gemini only; it cannot use a developer
   machine's `localhost:11434` Ollama service.

Credentials come from GitHub Secrets and Google Secret Manager; none are written
in workflow YAML. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Firebase setup
1. Create or select a Firebase project.
2. Enable Firebase Authentication and choose the sign-in providers used by the app.
3. Enable Cloud Firestore and Firebase Storage.
4. Copy the Firebase web config values into your `.env` file.
5. Keep the project ID and storage bucket aligned with your Firebase project.

> Security note: only the public Firebase web config should go into `VITE_FIREBASE_*` variables. API keys, service account credentials, and Gemini secrets must never be bundled into client code or tracked in git.

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
| **AI Integration** | Provider abstraction over Gemini (`gemini-3.7-flash`) and Ollama/Qwen3 (`qwen3:4b`) | Server-side LLM inference; the runtime is chosen per turn |
| **Database & Auth** | Firebase Authentication, Cloud Firestore | Real-time user stats, notes, tasks, decks, and guest session sync |
| **Cloud Storage** | Firebase Storage | Document uploads for PDF/image study context |

### AI terminology

- **Tutoring modes** are the five pedagogical instructions in `server/socrates/prompts.ts`.
- **Model providers** are Gemini and Ollama/Qwen3, selected by `ProviderRouter` and configured with `AI_PROVIDERS` and `DEFAULT_AI_PROVIDER`.
- **LangGraph agents** are graph nodes. The current graph has one `tutor` agent, reached through `supervisor` and `context_node`; it is not five agents.

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
├── server.ts                   # Express entry point, Socratic chat & provider endpoints
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v22.0.0 or higher
- **npm**
- **Firebase project**: Required for registered-user authentication and Firestore/Storage sync
- **Gemini API key**: Optional for local development when using Ollama only; required by the production server and Gemini-backed generators

### Installation

1. **Clone the repository**:
   ```bash
   git clone <YOUR_GITHUB_REPOSITORY>
   cd studispace
   ```

2. **Install dependencies**:
   ```bash
   npm ci
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
- `npm test`: Runs unit and provider tests without live AI calls.
- `npm run test:e2e`: Runs hermetic CI browser tests with backend calls stubbed.
- `npm run test:e2e:local`: Runs the optional real Firebase + Ollama/Qwen3 browser suite.
- `npm run clean`: Cleans up local build outputs and distribution directories.

For Docker, Compose, Firebase rules deployment, Ollama setup, and Cloud Run deployment, see [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md), [docs/LOCAL_LLM.md](docs/LOCAL_LLM.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## 🗺️ Roadmap

### Current (Implemented)
- [x] Socratic AI Tutor with 5 inquiry modes, Web Speech voice I/O, and document context.
- [x] Pomodoro Focus Desk with task binding and Web Audio ambient soundscapes.
- [x] Spaced repetition Flashcards with active recall ratings and AI deck generation.
- [x] Markdown Study Notes with 5 one-click AI transformation tools.
- [x] Quiz Arena with streak bonuses and Google Sheets CSV export.
- [x] Assignment Kanban planner with priority badges and Google Calendar sync.
- [x] Firebase Authentication (Email and Google), Guest Scholar mode, and Firestore persistence for registered-user data.

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
