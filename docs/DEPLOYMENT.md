# Deployment

## Environments and AI providers

| Environment | Runs where | AI providers | Notes |
| --- | --- | --- | --- |
| **Local** | Developer machine, `npm run dev` | `gemini`, `ollama` | Qwen3 via a host Ollama on `localhost:11434`. |
| **CI** | GitHub Actions | none exercised live | Every provider call is stubbed. No Gemini quota, no Ollama, no GPU. |
| **Production** | Cloud Run | `gemini` only | Set explicitly with `AI_PROVIDERS=gemini`. |

### Why production is Gemini-only (Strategy A)

A Cloud Run container has no Ollama process of its own, and `localhost:11434`
inside that container is the container itself — not the laptop that built it.
Shipping the local configuration unchanged would advertise a "Qwen3 Local"
button that can never answer.

So production sets `AI_PROVIDERS=gemini`. The provider registry then never
constructs the Ollama provider, `GET /api/ai/providers` returns Gemini alone,
and the UI shows a single runtime. Qwen3 stays a local-development provider.

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
      └── docker build + /health smoke test
      │
      ▼  (push to main only)
Deploy  (.github/workflows/deploy.yml)
      ├── quality gate (reused)
      ├── build image
      ├── push to Artifact Registry
      ├── gcloud run deploy
      ├── health check  GET /health
      └── roll back to the previous revision if the check fails
```

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

`GEMINI_API_KEY` is **not** a GitHub secret: the deploy step wires it from Google
Secret Manager with `--set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest`, so the
value never passes through GitHub.

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
| `NODE_ENV` | `production` |
| `PORT` | `3000` (Cloud Run sets this) |
| `APP_URL` | The service URL |
| `AI_PROVIDERS` | `gemini` |
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

## Manual deploy (equivalent to the workflow)

```bash
IMAGE=asia-east1-docker.pkg.dev/<project>/studispace/studispace:$(git rev-parse --short HEAD)
gcloud builds submit --tag "$IMAGE" --project=<project>

gcloud run deploy studispace \
  --image="$IMAGE" --project=<project> --region=asia-east1 \
  --platform=managed --allow-unauthenticated --port=3000 \
  --set-env-vars="NODE_ENV=production,AI_PROVIDERS=gemini" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"

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
