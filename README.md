# 🚀 StudiSpace

> **All-in-One AI-Powered Student Workspace & Learning Operating System**  
> Uniting planning, focused study execution, active recall testing, and academic tracking into a single distraction-free workspace.

---

## 📌 Project Status

> 🚧 **Active Development** — Core workspace modules (Dashboard, Socratic AI Mentor, Pomodoro Desk, Flashcards, Quiz Arena, Study Notes, and Task Planner) are implemented and functional. The **Document Vault** and the **Multimodal Transcript Parser & GPA Manager** have both shipped and are covered by tests against real transcripts and study documents. The Syllabi Auto-Planner remains in active iteration.

---

- **Google Sheets Export**: One-click generation of formatted `.csv` reports with question breakdowns and mastery percentages.
- **AI Quiz Generator**: Generate custom quizzes by topic and difficulty (`Easy`, `Medium`, `Hard`, `Genius`).

### 📅 Planner, Assignments & Google Calendar Sync
- **Academic Kanban Board**: Filter tasks by status (`To-Do`, `In Progress`, `Done`), subject, priority, and course weight.
- **Google Calendar Sync**: Formats target grades, Pomodoro estimates, and deadlines into 1-click Google Calendar study blocks.

### 📊 GPA Manager & Multimodal Transcript Parser
- **Cumulative GPA on both scales**: 4.0 and 10.0 scale CGPA, quality points, term GPA, degree completion, and a target-GPA what-if simulator.
- **Transcript import from a photo**: upload a scan or screenshot of an academic transcript and the courses are extracted into an editable review table before anything is imported.
- **Two parsing engines** (see [Transcript parsing engines](#-transcript-parsing-engines)): Google Gemini multimodal Vision as the primary, and a dependency-free local OCR + table parser as the fallback.
- **Grades are never invented**: a row whose grade cannot be read is skipped or flagged, never defaulted to a pass. Courses that earn credit without counting towards the average — physical education, national defence education — are flagged on import and excluded from the GPA, matching what the registrar prints.
- **Grade Targets & Weights**: Track percentage weights and target letter grades per assignment.

### 📂 Document Vault & In-App Reader
- **Upload and organise study material**: textbooks, lecture slides, syllabi, and exam papers, each with a course tag, a category, and a pin.
- **Supported formats**: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.txt`, `.md`, `.docx`, up to **25 MB** per file. The limit and the format list are enforced on drag-and-drop as well as on the file picker, before any upload begins.
- **In-app reader**: PDFs, images, and text render inside the workspace with zoom, rotation, and a distraction-free mode; anything a browser cannot embed offers open-in-tab and download instead.
- **Search, filter, and sort** by title, category, course tag, upload date, or file size.
- **Straight into study**: send any document to the Socratic tutor as context, or turn it into a flashcard deck.
- **Storage**: signed-in students get Firebase Storage with metadata in Firestore. Guest Scholars get a session-local vault — see [Document Vault storage](#-document-vault-storage) for what that does and does not keep.

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

Unit and provider tests, with no live AI calls. The transcript and GPA suites run against the
real documents in `material_for_test/`: the sample transcript states its own totals
(144 credits, GPA 8.59 / 3.69), so the parser and the grade arithmetic are checked against the
registrar's numbers rather than against numbers the tests made up.

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
| `TESSERACT_CACHE_PATH` | Server | No | Where the OCR fallback keeps its ~5 MB English language data. Defaults to a directory under the system temp path; point it at a pre-populated directory to skip the first-use download. |
| `OCR_TIMEOUT_MS` | Server | No | Cap on a single OCR pass. Defaults to `60000`. |
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

## 🔬 Transcript parsing engines

`POST /api/gemini/parse-transcript` accepts either `transcriptText` or a base64 image
(`base64Data` + `mimeType`) and runs two engines in order. The response always names the
engine that produced it in an `engine` field, because the two do not have the same accuracy.

### 1. Google Gemini multimodal Vision (primary)

Reads the scan directly. Far better at skewed photographs, merged cells, handwriting, and
transcripts whose columns do not line up. Requires `GEMINI_API_KEY`.

The prompt and response schema are deliberately permissive about what a transcript contains:
`term` and every grade field are optional, because *requiring* them is what pushes a model into
inventing a semester or a grade for a transcript that simply has no such column. Numbers are
transcribed as printed and never rescaled, so a 10-point 8.6 stays 8.6.

### 2. Local OCR + table parser (fallback)

Runs when Gemini is unconfigured, unreachable, out of quota, or returns no rows.

| Stage | Module | Dependency |
| --- | --- | --- |
| Image → text | [`server/transcript/ocr.ts`](server/transcript/ocr.ts) | `tesseract.js`, imported lazily |
| Text → course rows | [`server/transcript/tableParser.ts`](server/transcript/tableParser.ts) | none |

The table parser is pure TypeScript with no network calls, and it also serves the
"paste your transcript as text" path, which works with no engine at all. It:

- detects the column layout from the header (10-point / 4-point scales, or letter grades);
- **repairs lost decimal points** — OCR drops `.` far more often than it drops digits, so `900`
  becomes `9.00` and `20` becomes `2.0`, but only when the literal reading is already outside
  that column's plausible range;
- **calibrates the credit column against the document** — a bare `10` is a misread `1.0` on a
  transcript whose other rows print `2.0` and `4.0`, but a genuine ten-credit course on a
  transcript that uses integer credits is left alone;
- **cross-checks redundant grade columns** — when a transcript prints both a 10-point and a
  4-point grade it has stated the result twice, so a row where the two disagree is flagged as
  low confidence rather than trusted;
- **reports rather than guesses** — rows it cannot read come back in `skipped[]` with a reason,
  and the stated "Total Accumulated Credits" is compared against the sum actually parsed.

Nothing that fails to parse is imported as a pass. The student reviews and edits every row in
the parser modal before anything reaches the GPA manager.

**Accuracy, measured on the real transcript in `material_for_test/GPA/`:** the fallback reads
26 of 47 rows at high confidence from a phone photograph, flags 2 misreads, and skips the rest.
Gemini Vision handles the same scan considerably better. The fallback exists so the feature
degrades instead of disappearing — not to match the primary engine.

> **First use downloads ~5 MB** of Tesseract English language data. Set `TESSERACT_CACHE_PATH`
> to a pre-populated directory to avoid that, and `OCR_TIMEOUT_MS` to change the 60s cap.

### Grade arithmetic

[`src/utils/grading.ts`](src/utils/grading.ts) is the single place grades become grade points,
shared by the parser modal and the GPA manager so the two cannot drift. Its rules:

1. A **4-point grade printed by the registrar** beats any conversion table — it is the
   institution's own arithmetic.
2. Otherwise a **numeric grade**, with the scale detected (above 10 is a percentage, at or
   below 10 is a 10-point grade).
3. Otherwise the **letter grade**.
4. Otherwise the grade is **unresolved**: it scores nothing and is reported, never defaulted.

Courses matching the non-GPA patterns (physical education, national defence education) are
flagged `excludedFromGpa` on import. They keep their credits towards graduation but stay out
of the average, which is what makes the app agree with the transcript: averaging every row of
the sample transcript gives 8.53, while the registrar prints **8.59 / 3.69 over 136 of 144
credits**. Both figures are asserted in
[`src/utils/grading.test.ts`](src/utils/grading.test.ts).

---

## 🗄️ Document Vault storage

| | Signed in | Guest Scholar |
| --- | --- | --- |
| File bytes | Firebase Storage, `users/{uid}/documents/…` | Object URL, this browser session only |
| Metadata | Firestore `documents/{id}`, owner-scoped by `firestore.rules` | `localStorage` |
| Survives reload | Yes | Metadata yes, the file itself no |

A failed upload **fails loudly**. There is no fallback to a `blob:` URL for a signed-in
student: an object URL is valid only for the page that created it, so persisting one writes a
record that is broken on the next reload and syncs that broken link to every other device.
If the bytes reach Storage but the Firestore write fails, the Storage object is deleted before
the error is rethrown, rather than orphaning a file the student pays for and can never see.

Guest Scholars keep the object URL for the session that made it, but it is never written to
`localStorage`; the vault entry comes back after a reload with a "File Not Stored" notice
instead of an empty viewer.

Firestore is initialised with `ignoreUndefinedProperties`, so one absent optional field can no
longer reject an entire document write.

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
| **AI Integration** | Provider abstraction over Gemini (`gemini-2.5-flash`, `gemini-3.7-flash`) and Ollama/Qwen3 (`qwen3:4b`) | Server-side LLM inference; the model is chosen per turn |
| **Database & Auth** | Firebase Authentication, Cloud Firestore | Real-time user stats, notes, tasks, decks, and guest session sync |
| **Cloud Storage** | Firebase Storage | Document Vault uploads (PDF/image/text study material) |
| **OCR Fallback** | `tesseract.js` + a dependency-free table parser | Transcript parsing when the Gemini engine is unavailable |

### AI terminology

- **Tutoring modes** are the five pedagogical instructions in `server/socrates/prompts.ts`.
- **Models** are the three choices in the Socratic selector, resolved by `ProviderRouter`:
  | Model | Tier | Runtime |
  | --- | --- | --- |
  | Gemini 2.5 Flash | free — the default for every student | Gemini API |
  | Gemini 3.7 Flash | Developer Mode only | Gemini API |
  | Qwen3 Local | Developer Mode only | Ollama, on this machine |
- **Developer Mode** unlocks the two restricted models. The password lives only in
  `DEVELOPER_MODE_PASSWORD` on the server; the browser exchanges it for a
  short-lived signed token and the server re-checks that token on every request,
  so the padlock in the UI is a hint and the backend is the actual gate.
- **Model runtimes** are Gemini and Ollama/Qwen3, registered according to `AI_PROVIDERS`.
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
│   │   ├── DocumentVaultView.tsx    # Document library, upload, tagging & filters
│   │   ├── DocumentViewerModal.tsx  # In-app PDF / image / text reader
│   │   ├── FlashcardsView.tsx  # Spaced repetition decks & AI generator
│   │   ├── GpaManagementView.tsx    # Cumulative GPA engine & target simulator
│   │   ├── TranscriptParserModal.tsx# Transcript upload & editable review table
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
│   │   ├── documentValidation.ts # Vault size/format rules, applied to every upload
│   │   ├── firebase.ts         # Firebase client SDK initialization
│   │   ├── firestoreService.ts # Real-time Firestore sync & Storage helpers
│   │   ├── grading.ts          # Shared grade-point resolution & GPA arithmetic
│   │   └── initialData.ts      # Seed data for guest/offline exploration
│   ├── App.tsx                 # Root application component & state coordinator
│   ├── index.css               # Global CSS entrypoint (@import "tailwindcss";)
│   ├── main.tsx                # Client DOM mount
│   └── types.ts                # Shared TypeScript domain models & interfaces
├── server/
│   ├── socrates/               # Socratic tutor graph, providers & persistence
│   └── transcript/
│       ├── ocr.ts              # Lazy Tesseract wrapper (fallback engine, stage 1)
│       └── tableParser.ts      # Deterministic table parser (fallback engine, stage 2)
├── material_for_test/          # Sample transcripts & study documents used by tests
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
- [x] Document Vault with an in-app PDF/image reader, categories, course tags, and validated uploads.
- [x] Cumulative GPA manager on the 4.0 and 10.0 scales, with a target-GPA what-if simulator.
- [x] Multimodal transcript parser with a Gemini Vision primary engine and a local OCR fallback.

### Next
- [ ] Automated AI study schedule generator from uploaded syllabus documents.
- [ ] Full-text search across vault documents, not just their titles and tags.
- [ ] Per-institution grade-scale profiles, so the non-GPA course rules are configured rather than inferred.
- [ ] Multi-page transcript upload in one pass, instead of one image at a time.

### Future
- [ ] Peer Study Lounge (real-time collaborative study rooms).
- [ ] Direct Google Classroom syllabus and assignment synchronization.
- [ ] Ship the Tesseract language data in the image so the fallback needs no network at all.

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
