# Local LLM: Ollama + Qwen3

StudiSpace can answer with a hosted model (Gemini) or a local open-source model
(Qwen3 running under Ollama). The local runtime needs no API key and no network
access once the model is downloaded, which makes it useful when the Gemini
free-tier quota is exhausted or when you want to work offline.

## Why Qwen3 4B on this hardware

Model choice is bounded by VRAM. Ollama reports the discrete GPU as:

```text
NVIDIA GeForce RTX 3050 Laptop GPU — CUDA compute 8.6, driver 13.0
total "3.7 GiB", available "3.6 GiB"
```

- `qwen3:4b` is 2.5 GB on disk (Q4_K_M, 4.0B parameters). With a 4096-token
  context it needs ~3.5 GB, so most layers sit on the GPU and the remainder
  falls back to CPU. Measured at roughly **38 tokens/second**, which is
  comfortable for tutoring replies.
- `qwen3:8b` would need well over 5 GB. It does not fit in 3.7 GiB, so it would
  offload heavily to system RAM — and this machine also runs close to its 15 GiB
  RAM limit. It would be far slower for no pedagogical gain.

`qwen3:4b` is therefore the right default here. Change it with `OLLAMA_MODEL` if
you move to a larger GPU.

## Install Ollama

The official installer needs root:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

That installs to `/usr/local/bin` and registers a systemd service. If you do not
have `sudo`, install the same official build into your home directory instead:

```bash
curl -fL -o /tmp/ollama.tar.zst https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst
mkdir -p ~/.local/lib/ollama-dist ~/.local/bin
tar --zstd -xf /tmp/ollama.tar.zst -C ~/.local/lib/ollama-dist
ln -sfn ~/.local/lib/ollama-dist/bin/ollama ~/.local/bin/ollama
```

`~/.local/bin` must be on your `PATH`. The archive bundles its own CUDA v12/v13
libraries, so GPU acceleration works without a system-wide install.

## Start Ollama

With the systemd service (root install):

```bash
sudo systemctl enable --now ollama
sudo systemctl status ollama
```

Without systemd (home-directory install), run it as your own user:

```bash
ollama serve
```

Leave it running in its own terminal, or start it detached:

```bash
setsid nohup ollama serve > ~/.ollama/serve.log 2>&1 < /dev/null &
```

To have it start automatically at login without root, use a **user** unit —
`systemctl --user` needs no `sudo`:

```bash
systemctl --user enable --now ollama
systemctl --user status ollama
systemctl --user restart ollama     # after upgrading Ollama
```

The unit lives at `~/.config/systemd/user/ollama.service`:

```ini
[Unit]
Description=Ollama local model runtime
After=network-online.target

[Service]
ExecStart=%h/.local/bin/ollama serve
Restart=on-failure
RestartSec=3
Environment="OLLAMA_HOST=127.0.0.1:11434"

[Install]
WantedBy=default.target
```

A user unit runs only while you are logged in. `loginctl enable-linger $USER`
makes it survive logout, but that command does need root.

## Download the model

```bash
ollama pull qwen3:4b
ollama list
```

Model weights live in `~/.ollama/models`. They are never stored in the Git
repository and never copied into the StudiSpace Docker image.

## Check Ollama status

```bash
ollama --version
curl http://localhost:11434/api/tags     # installed models
ollama ps                                # what is loaded, and the CPU/GPU split
```

`ollama ps` is the honest answer to "is the GPU being used": it prints a
`PROCESSOR` column such as `23%/77% CPU/GPU`.

## Environment variables

Add to `.env` (all optional — the defaults below are used when unset). None of
these are secrets; Ollama is local and has no API key.

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
DEFAULT_AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.7-flash
```

`AI_PROVIDERS` controls which runtimes are registered. Leave it empty locally to
offer both providers, or set `AI_PROVIDERS=ollama` for an Ollama-only server.
`DEFAULT_AI_PROVIDER` decides which runtime answers a chat request that names
none. Set it to `ollama` to make the local model the default. These variables
affect Socratic chat; the flashcard, quiz, and note-generation endpoints remain
Gemini-backed.

## Run StudiSpace and pick Qwen3

```bash
npm run dev
```

Open `http://localhost:3000`, sign in, open **Socrates AI**. Above the tutoring
mode tabs there is a **Model:** row with `☁️ Gemini` and `🖥️ Qwen3 Local`.
Select `Qwen3 Local` and chat normally. The five tutoring modes work with either
runtime.

Availability is polled every 20 seconds from `GET /api/ai/providers`. If Ollama
is not running, the button is disabled and reads **Qwen3 Local — Offline**, and
StudiSpace will not send a request that is certain to fail.

## Docker boundary

Ollama and the model weights stay on the host. The StudiSpace image contains
only the app. This avoids GPU passthrough complexity and keeps the image small:

```text
Host Machine
├── Ollama  →  Qwen3 model weights (~/.ollama)
└── StudiSpace (Node.js or Docker)  →  http://localhost:11434
```

When StudiSpace itself runs in Docker, `localhost` inside the container is not
the host. Point the app at the host gateway instead:

```yaml
environment:
  OLLAMA_BASE_URL: http://host.docker.internal:11434
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## Troubleshooting

- **`Qwen3 Local — Offline` in the UI**: Ollama is not reachable. Start it
  (`ollama serve`, or `sudo systemctl start ollama`) and confirm with
  `curl http://localhost:11434/api/tags`.
- **"Model qwen3:4b is not downloaded"**: run `ollama pull qwen3:4b`. The
  availability check requires both a reachable server *and* the configured model.
- **First reply is very slow, later ones are fast**: the model is being loaded
  into VRAM. Cold load measured ~27 s here; afterwards `load_duration` is
  effectively zero until the 5-minute idle unload (`OLLAMA_KEEP_ALIVE`).
- **Answers contain the model's private reasoning**: Qwen3 is a thinking model.
  StudiSpace requests `think: true` so Ollama returns the trace separately in
  `message.thinking` and leaves `message.content` clean, and it strips any
  `</think>` remnant as a safety net. If you change the request options, keep
  that normalization.
- **Replies time out**: generation is capped at 180 s. On this hardware a
  tutoring answer takes roughly 10–60 s; a much longer prompt or a bigger model
  can exceed the cap.
- **GPU not used**: check `nvidia-smi` shows the driver, and look for
  `inference compute ... library=CUDA` in the Ollama server log. An integrated
  GPU is deliberately skipped unless `OLLAMA_IGPU_ENABLE=1`.
