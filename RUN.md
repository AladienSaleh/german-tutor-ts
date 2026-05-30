# How to Run German Tutor TS

Complete setup and run guide for the local development environment.

---

## Prerequisites

| Tool | Min version | Install |
|------|-------------|---------|
| **Node.js** | 22+ (26 recommended) | `brew install node` |
| **uv** | any | `brew install uv` |
| **ffmpeg** | any | `brew install ffmpeg` |
| **Ollama** | 0.4+ | https://ollama.ai |

---

## 1. First-Time Setup

### 1a. Node.js dependencies

```bash
cd /Volumes/exSSD1/Tests/german-tutor-ts

# Backend
npm install

# Frontend (uses cached packages — minimal download)
cd frontend && npm install --prefer-offline && cd ..
```

### 1b. Python environment (STT + TTS)

A project-local `.venv` is required for the STT sidecar (`faster-whisper`) and
the Piper TTS subprocess. Both packages are already in the uv wheel cache on
this machine, so this uses minimal internet:

```bash
uv venv .venv --python 3.12
uv pip install "faster-whisper==1.2.1" "piper-tts==1.4.2"
```

Verify:
```bash
.venv/bin/python -c "import faster_whisper; import piper; print('ok')"
```

### 1c. Ollama language models

```bash
ollama pull gemma4:e2b        # main tutor LLM  (~7GB)
ollama pull granite4.1:3b     # grammar corrector (~2GB)
```

Confirm both are loaded:
```bash
ollama list
```

### 1d. Download a voice for Lina (female German)

The default voice is `de_DE-kerstin-low` (~64 MB). Download it once:

```bash
cd voices
curl -L -o de_DE-kerstin-low.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx"
curl -L -o de_DE-kerstin-low.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx.json"
cd ..
```

For other voices see [docs/VOICES.md](docs/VOICES.md).

### 1e. Build the frontend (once)

```bash
cd frontend && npm run build && cd ..
```

---

## 2. Configuration (`.env`)

Copy the example and edit:

```bash
cp .env.example .env
```

### Key settings

| Setting | Default | Notes |
|---------|---------|-------|
| `PORT` | `3000` | Backend + frontend served here |
| `LLM_PROVIDER` | `ollama` | `ollama \| openai \| groq \| anthropic` |
| `LLM_MODEL` | `gemma4:e2b` | Main tutor model |
| `LLM_CORRECTOR_MODEL` | `granite4.1:3b` | Grammar correction model |
| `STT_PROVIDER` | `local` | `local \| groq \| openai` |
| `STT_MODEL` | `large-v3-turbo` | Use `tiny` for faster but lower accuracy |
| `TTS_PROVIDER` | `piper` | `piper \| openai \| edge \| elevenlabs` |
| `PIPER_VOICE` | `./voices/de_DE-kerstin-low.onnx` | Path to voice model |
| `PYTHON_BIN` | `.venv/bin/python` | Python with piper-tts + faster-whisper |

The full list of settings is in [docs/PROVIDERS.md](docs/PROVIDERS.md).

---

## 3. Run

### Production mode (recommended)

Serves the built frontend from the backend on a single port:

```bash
# Ensure Ollama is running
ollama serve   # (may already be running as a background service)

npm run dev    # starts backend + serves frontend at :3000
```

Open **http://localhost:3000**

On first start, the STT sidecar loads the Whisper model (~10–15 s). Subsequent
starts are fast because the model is cached in RAM.

### Development mode (hot reload)

Two terminals — backend restarts on file changes, frontend has HMR:

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend with HMR
cd frontend && npm run dev   # → http://localhost:5173
```

The Vite dev server proxies `/api/*` and `/ws/*` to the backend at `:3000`.

---

## 4. Using the Tutor

1. **Open** `http://localhost:3000`
2. **Choose a lesson** — click a scenario card (e.g. *Daily Life*)
3. **Listen** — Lina greets you and starts the first topic
4. **Speak** — hold **Space** (or tap-and-hold the mic button), speak, release
5. **Learn** — read the yellow "Sag besser" correction badges

Full usage guide: [docs/USER_MANUAL.md](docs/USER_MANUAL.md)

---

## 5. Speed: Switching to Cloud Providers

Edit `.env` and restart to unlock sub-second responses.

### Ultra-fast STT — Groq Whisper (~150ms vs ~1.5s local)
```env
STT_PROVIDER=groq
GROQ_API_KEY=your_key_here
```

### Ultra-fast LLM — Groq (~80ms TTFT vs ~400ms local)
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_LLM_MODEL=llama-3.3-70b-versatile
```

### High-quality cloud TTS — OpenAI
```env
TTS_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_TTS_VOICE=nova
```

### Free cloud TTS — Microsoft Edge (no key needed)
```bash
uv pip install edge-tts
```
```env
TTS_PROVIDER=edge
```

---

## 6. Architecture

```
Browser
  │  WebSocket /ws/chat/:scenario
  ▼
Fastify server (Node.js :3000)
  │
  ├─ STT ──► stt_server.py (:5001)
  │           └─ faster-whisper (model loaded once, cached in RAM)
  │
  ├─ LLM ──► Ollama (:11434)  ← gemma4:e2b  (reply, streaming)
  │       ──► Ollama (:11434)  ← granite4.1:3b  (correction, parallel)
  │
  └─ TTS ──► piper subprocess (.venv/bin/python -m piper)
              └─ voices/de_DE-kerstin-low.onnx
```

**Parallel correction** — the grammar corrector runs alongside the reply stream.
It never delays Lina from speaking.

**Per-sentence TTS** — each sentence is synthesised to a temp WAV file as it
arrives from the LLM, then immediately sent to the browser. Audio starts playing
before the full reply is generated.

---

## 7. Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common problems and fixes.

Quick checks:

```bash
# Is Ollama running?
curl http://localhost:11434/api/tags

# Is the STT sidecar port free?
lsof -i :5001

# Does piper work?
echo "Hallo!" | .venv/bin/python -m piper \
  --model voices/de_DE-kerstin-low.onnx \
  --output_file /tmp/test.wav && afplay /tmp/test.wav
```
