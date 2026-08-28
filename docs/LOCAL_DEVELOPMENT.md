# StudiSpace local development

This guide runs the React/Vite client and Express API locally. It applies to Linux, macOS, and Windows (PowerShell equivalents may be used for shell commands).

## Prerequisites

- Git
- Node.js 22 or newer (the repository CI/container uses Node 22)
- npm (included with Node)
- Optional: Docker Engine and Docker Compose v2
- A Firebase project with Authentication, Firestore, and Storage enabled
- Optional: a Google AI Studio Gemini API key, unless local work uses Ollama only

## Clone and install

```bash
git clone <repository-url>
cd studispace-ai
npm ci
cp .env.example .env
```

`npm install` also works for day-to-day dependency changes; `npm ci` is the reproducible clean-install command used by CI.

## Configure `.env`

Set local values in `.env`; it is ignored by Git.

- `GEMINI_API_KEY` — server-side secret for Gemini-backed generation. It is required when `NODE_ENV=production`; local Qwen3 chat can run without it. Never use a `VITE_` prefix.
- `GOOGLE_APPLICATION_CREDENTIALS` — absolute path to a Firebase service-account JSON file for server-side LangGraph conversation persistence. Store that JSON outside the repository and restrict it to your account (`chmod 600` on Linux/macOS).
- `PORT` — optional server port; `3000` is the default.
- `APP_URL` — optional public URL. Use `http://localhost:3000` locally. Cloud Run uses `https://studispace-661978143452.asia-east1.run.app` at deployment time.
- `NODE_ENV` — use `development` locally; the container sets `production`.
- `DISABLE_HMR` — optional Vite control; set `true` only when file watching/HMR must be disabled.
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` — required Firebase web-app configuration. These are browser-visible Firebase identifiers, not server secrets.

For production, supply the same runtime configuration through Cloud Run environment variables or Secret Manager. Do not commit production `.env` files or service-account JSON.

## Start locally

```bash
npm run dev
```

Open `http://localhost:3000`. Check server readiness with `http://localhost:3000/health`.

## Test and build

```bash
npm run lint            # TypeScript type check
npm test                # unit + mocked provider tests (hermetic, no network)
npm run test:e2e        # browser E2E, all backends stubbed (what CI runs)
npm run build           # production client + bundled server
```

### Browser end-to-end tests

Two deliberately separate suites:

| Command | Needs | Runs in CI |
| --- | --- | --- |
| `npm run test:e2e` | nothing beyond the repo | yes |
| `npm run test:e2e:local` | a real Firebase account **and** a running Ollama | no |

`npm run test:e2e` stubs `/api/ai/providers` and `/api/socrates/chat`, so it
needs no Gemini quota, no Ollama, no GPU and no Firebase service account.

`npm run test:e2e:local` drives the full journey — sign in, ask Qwen3, follow up
in context, reload and confirm the conversation survived, verify a failed turn
persists nothing, exercise all five tutoring modes, log out and back in. Set the
account in `.env` (never committed):

```env
E2E_EMAIL=your.test.account@example.com
E2E_PASSWORD=...
```

Then, with Ollama running and `qwen3:4b` pulled:

```bash
npm run test:e2e:local
```

Playwright's browser is installed once with `npx playwright install chromium`.

## Local model runtime (optional)

StudiSpace can answer with Gemini or with a local Qwen3 model served by Ollama.
The local runtime needs no API key. Qwen3 Local is a Developer Mode model, so
`DEVELOPER_MODE_PASSWORD` must be set for it to be reachable at all. See
`docs/LOCAL_LLM.md` for installation, model selection, and troubleshooting;
`.env` keys are `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `DEVELOPER_MODE_PASSWORD`.

```bash
ollama serve            # start the runtime
ollama pull qwen3:4b    # download the model
curl http://localhost:11434/api/tags
```

## Firestore security rules

`firestore.rules` is not applied by running the app; it must be deployed to the Firebase project.

```bash
npx firebase-tools deploy --only firestore:rules --project <your-project-id>
```

The rules keep `users`, `chats`, and `documents` readable only by the signed-in owner. Guest mode
does not create a Firebase account and its server-side conversation fallback is in memory, so it
should be treated as temporary. An unscoped private collection read is rejected with
`permission-denied` — rules restrict queries, they do not silently filter results.

## Docker

The image builds the Vite client and Express server, runs as the non-root `node` user, and receives all configuration at runtime. The public Firebase web configuration is served by `/runtime-config.js`; Gemini and service-account credentials are never sent there.

```bash
docker build --tag studispace:local .
docker run --rm --env-file .env \
  -v "$GOOGLE_APPLICATION_CREDENTIALS:/run/secrets/firebase-service-account.json:ro" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase-service-account.json \
  -p 3000:3000 studispace:local
```

On PowerShell, use `${env:GOOGLE_APPLICATION_CREDENTIALS}` in the volume argument. The volume is necessary for Firestore server credentials; do not copy the JSON into the image.

Compose uses the same safe read-only mount:

```bash
docker compose up --build
```

Stop it with `docker compose down`.

Compose expects `GOOGLE_APPLICATION_CREDENTIALS` to point to an existing
service-account JSON file because `compose.yaml` mounts that path into the
container. If you do not need server-side Firestore conversation persistence,
run the Node development server instead; it falls back to an in-memory
repository when Firebase Admin credentials are unavailable.

## Troubleshooting

- **`GEMINI_API_KEY is required`**: add the server-side key to `.env`; production intentionally fails fast without it.
- **Firestore or conversation persistence fails**: confirm the service-account path is absolute, exists, has restrictive permissions, and the service account can access the configured Firebase project.
- **Firebase permission denied**: sign in with the correct Firebase user and confirm deployed Firestore rules permit that user’s document access. If every client request fails, check whether the project is still on the default test-mode ruleset, which expires 30 days after project creation; deploy `firestore.rules` as shown above.
- **`The query requires an index`**: a Firestore query combines an equality filter with `orderBy` on another field. Either deploy the composite index the error links to, or scope the query and sort in the client as `subscribeToChats` does.
- **Socrates AI returns 403**: the thread belongs to a different account. The server takes the conversation owner from the Firebase ID token, never from the request body, so a stale `threadId` in `localStorage` from another sign-in will be refused.
- **Port 3000 already in use**: set another `PORT` in `.env`; update the Docker host mapping accordingly.
- **Docker permission denied**: add your account to the Docker group on Linux or start Docker Desktop, then retry. Do not use a privileged container as a workaround.
- **Gemini request fails**: verify the key and API/project access. Gemini errors are returned safely by the server.
- **Docker build fails**: use Docker with BuildKit enabled and Node-compatible dependencies; the project image uses Node 22.

## Security checklist

- Never commit `.env` or Firebase service-account JSON.
- Never expose `GEMINI_API_KEY` as a `VITE_*` variable.
- Use runtime environment variables/secrets in Cloud Run.
- Keep local `APP_URL` at `http://localhost:3000`; configure the Cloud Run URL only in production.
