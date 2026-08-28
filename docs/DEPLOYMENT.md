# Deployment

## Environments and AI providers

| Environment | Runs where | AI providers | Notes |
| --- | --- | --- | --- |
| **Local** | Developer machine, `npm run dev` | `gemini`, `ollama` | Qwen3 via a host Ollama on `localhost:11434`. Developer Mode required to select it. |
| **CI** | GitHub Actions | none exercised live | Every provider call is stubbed. No Gemini quota, no Ollama, no GPU. |
| **Production** | Cloud Run | `gemini` only | Set explicitly with `AI_PROVIDERS=gemini`. |

### Why production is Gemini-only (Strategy A)

A Cloud Run container has no Ollama process of its own, and `localhost:11434`
inside that container is the container itself — not the laptop that built it.
Shipping the local configuration unchanged would advertise a "Qwen3 Local"
button that can never answer.

So production sets `AI_PROVIDERS=gemini`. The registry then substitutes a
disabled stand-in for the Ollama runtime: `GET /api/ai/models` still lists all
three models — the selector must not change shape between environments — but
Qwen3 Local reports `available: false` with the reason, is `locked` behind
Developer Mode, and refuses to generate. Nothing in the container ever dials
`localhost:11434`.

If you later want Qwen3 in production, that is **Strategy B**: run Ollama on a
reachable host (a GPU VM, or a separate inference service) and point the
deployment at it with `AI_PROVIDERS=gemini,ollama` and
`OLLAMA_BASE_URL=https://<your-ollama-host>`. Do not enable `ollama` in a cloud
deployment until that endpoint actually exists and is reachable from Cloud Run.

## Pipeline

```text
Pull request / push
      │
      ▼
Quality Gate  (.github/workflows/ci.yml)
      ├── npm ci
      ├── npm run lint          (tsc --noEmit)
      ├── npm test              (unit + mocked providers)
      ├── npm run build         (client + bundled server)
      ├── npm run test:e2e      (hermetic browser tests, all backends stubbed)
      └── docker build + container smoke test
            ├── GET /health
            ├── GET / with Host: studispace.ai.studio  → must be the built app,
            │     never Vite's "Blocked request"
            ├── the hashed /assets bundle is served
            ├── /runtime-config.js carries no server secret
            └── a developer-tier model is refused without a token (403)
      │
      ▼  (push to main only)
Deploy  (.github/workflows/deploy.yml)
      ├── quality gate (reused)
      ├── record the currently serving revision   (rollback target)
      ├── build image, tagged with the commit SHA
      ├── push to Artifact Registry
      ├── gcloud run deploy --no-traffic --tag=c-<sha>   ← takes no traffic yet
      ├── verify the candidate on its tag URL
      │     health, not-a-dev-server, model catalogue, no leaked secrets
      ├── promote that revision to 100% traffic
      ├── verify https://studispace.ai.studio
      └── roll back to the recorded revision if the public check fails
```

A build that fails verification never receives production traffic at all, so the
previous healthy revision keeps serving while the pipeline reports failure.

Nothing in the quality gate needs a secret. The deploy job needs the secrets
listed below and runs only on `main`.

## Required GitHub secrets

Set these in **Settings → Secrets and variables → Actions**. None of them belong
in workflow YAML.

| Secret | Purpose |
| --- | --- |
| `GCP_PROJECT_ID` | Target project, e.g. `n8n-hragent` |
| `GCP_REGION` | e.g. `asia-east1` |
| `GCP_SERVICE_NAME` | Cloud Run service, e.g. `studispace` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Keyless auth provider resource name |
| `GCP_SERVICE_ACCOUNT` | Deploy service account email |
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | Browser-safe Firebase config, injected at runtime |

`GEMINI_API_KEY` and `DEVELOPER_MODE_PASSWORD` are **not** GitHub secrets. The
deploy step wires both from Google Secret Manager with `--set-secrets`, so
neither value ever passes through GitHub, a workflow log, or an image layer:

```bash
gcloud secrets create DEVELOPER_MODE_PASSWORD --project=<project> --replication-policy=automatic
printf '%s' '<the password>' | gcloud secrets versions add DEVELOPER_MODE_PASSWORD --project=<project> --data-file=-
```

Grant the Cloud Run *runtime* service account `roles/secretmanager.secretAccessor`
on both secrets. Leave `DEVELOPER_MODE_PASSWORD` unset and the developer-only
models are simply unreachable in that environment, which is the safe default.

### Optional repository variables

Set under **Settings → Secrets and variables → Actions → Variables**. These are
model names, not secrets, and have working defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_FREE_MODEL` | `gemini-3.5-flash` | The free/default student model |
| `GEMINI_DEVELOPER_MODEL` | `gemini-3.7-flash` | The Developer Mode Gemini model |

### Workload Identity Federation (keyless)

Preferred over a downloaded service-account key, which should never be stored in
GitHub. Create the pool/provider once, then grant the deploy service account
`roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`
and `roles/secretmanager.secretAccessor`.

## Runtime configuration

The image contains **no** configuration. Everything is injected at container
start, which is why the same image can run locally, in staging and in production:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production`. Also baked into the image. The dev server is opt-in (`development` only), so a platform that forgets this still serves the built assets |
| `PORT` | Injected by Cloud Run (`8080`), which the image also defaults to. The deploy passes `--port=8080` explicitly because gcloud otherwise keeps whatever container port the service already had |
| `APP_URL` | `https://studispace.ai.studio` — the canonical domain, not the `*.run.app` URL |
| `AI_PROVIDERS` | `gemini` |
| `GEMINI_FREE_MODEL` | `gemini-3.5-flash` (see repository variables) |
| `GEMINI_DEVELOPER_MODEL` | `gemini-3.7-flash` |
| `GEMINI_API_KEY` | From Google Secret Manager (`GEMINI_API_KEY:latest`) |
| `DEVELOPER_MODE_PASSWORD` | From Google Secret Manager. Unset leaves the developer-only models unreachable, which is the safe default for a public deployment |
| `VITE_FIREBASE_*` | Browser-safe Firebase config, served by `/runtime-config.js` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Unset on Cloud Run — the runtime service account supplies Application Default Credentials for Firestore |

`server.ts` fails fast at boot if `NODE_ENV=production` and `GEMINI_API_KEY` is
missing, so a misconfigured rollout does not silently serve a broken production
AI configuration. Cloud Run's runtime service account supplies Firebase Admin
Application Default Credentials for Firestore; no service-account JSON file is
mounted in production.

### What must never be in the image

- `.env` (excluded by `.dockerignore`)
- Firebase service-account JSON — mount it or use the runtime service account
- `GEMINI_API_KEY` — injected at runtime, never `COPY`ed or baked as a build arg
- `DEVELOPER_MODE_PASSWORD` — injected at runtime; it is never sent to the
  browser, never bundled into the client, and never written to `/runtime-config.js`

The Firebase web config is browser-visible by design and is served from
`/runtime-config.js` at request time, so one image works for every environment
without rebuilding.

## How the frontend is served

This is the difference between a working deployment and an outage, so it is
worth stating plainly.

| `NODE_ENV` | What `server.ts` does |
| --- | --- |
| `development` | Starts the Vite dev server in middleware mode |
| anything else, **including unset** | Serves `dist/` through Express, and refuses to start if `dist/index.html` is missing |

The development server is deliberately opt-in. It used to be opt-*out*
(`NODE_ENV !== "production"`), which meant any host that did not set `NODE_ENV`
published a Vite dev server — and Vite answered every request with
`Blocked request. This host ("…") is not allowed.` because its host check was
doing the only thing standing between the internet and a dev server.

The fix is never to add the production hostname to `server.allowedHosts`. Vite's
dev server transforms sources on demand and can read files outside the project
through `/@fs`; allowlisting a public host there publishes the source tree. If a
production URL ever shows that message again, the deployment is running the dev
server and `NODE_ENV` is the thing to look at.

## Manual deploy (equivalent to the workflow)

```bash
IMAGE=asia-east1-docker.pkg.dev/<project>/studispace/studispace:$(git rev-parse --short HEAD)
gcloud builds submit --tag "$IMAGE" --project=<project>

gcloud run deploy studispace \
  --image="$IMAGE" --project=<project> --region=asia-east1 \
  --platform=managed --allow-unauthenticated --port=8080 \
  --set-env-vars="^@^NODE_ENV=production@AI_PROVIDERS=gemini@APP_URL=https://studispace.ai.studio@GEMINI_FREE_MODEL=gemini-3.5-flash@GEMINI_DEVELOPER_MODEL=gemini-3.7-flash" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,DEVELOPER_MODE_PASSWORD=DEVELOPER_MODE_PASSWORD:latest"

curl -fsS "$(gcloud run services describe studispace --project=<project> \
  --region=asia-east1 --format='value(status.url)')/health"
```

## Firebase

Firestore rules live in `firestore.rules` and are **not** applied by deploying
the app. Deploy them separately:

```bash
npx firebase-tools deploy --only firestore:rules --project <firebase-project>
```

`users`, `chats` and `documents` are owner-only; the shared study collections
require sign-in. See `docs/LOCAL_DEVELOPMENT.md`.

Add the Cloud Run hostname to **Firebase Console → Authentication → Settings →
Authorized domains**, otherwise Google sign-in fails in production with
`auth/unauthorized-domain`. Email/password sign-in is unaffected.
