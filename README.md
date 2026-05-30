# German Voice Tutor — Lina (TypeScript Edition)

A high-performance, voice-first German language tutor for Arabic and English speakers.  
Lina leads you through real-life scenarios, corrects your grammar in real time, and falls back to Arabic or English when you're stuck.

> **This is the TypeScript/Node.js rewrite** of the original Python/FastAPI version.  
> It delivers lower latency, a richer UI, and fully pluggable STT / LLM / TTS providers.

---

## Features

- **Trilingual** — German instruction with Arabic/English fallback ("Auf Deutsch sagt man…")
- **Real-time grammar corrections** — yellow "Sag besser" badges after every mistake
- **Parallel correction pipeline** — grammar check runs alongside Lina's reply; zero latency penalty
- **Pluggable providers** — swap STT / LLM / TTS between local and cloud via a single `.env` file
- **Push-to-talk** — hold **Space** or tap-and-hold the mic button; works on desktop and mobile
- **Live mic waveform** — animated bars respond to your voice while recording
- **Auto-reconnect** — WebSocket drops reconnect automatically with exponential backoff
- **Scenario picker** — full-screen cards showing each lesson's title and description
- **Session logging** — every turn saved to a local SQLite database (`data/tutor.db`)
- **Privacy-first** — fully local operation with no accounts, no tracking

---

## Quick Start

```bash
# 1. Node.js dependencies
npm install
cd frontend && npm install --prefer-offline && cd ..

# 2. Python environment (STT sidecar + TTS)
uv venv .venv --python 3.12
uv pip install "faster-whisper==1.2.1" "piper-tts==1.4.2"

# 3. Download a female German voice for Lina
cd voices
curl -L -o de_DE-kerstin-low.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx"
curl -L -o de_DE-kerstin-low.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx.json"
cd ..

# 4. Pull Ollama models
ollama pull gemma4:e2b
ollama pull granite4.1:3b

# 5. Build frontend and start
cd frontend && npm run build && cd ..
npm run dev          # → http://localhost:3000
```

See **[RUN.md](RUN.md)** for the complete setup guide including all configuration options.

---

## Documentation

| Document | Description |
|----------|-------------|
| [RUN.md](RUN.md) | Step-by-step setup, configuration, and running the app |
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | How to learn German with Lina |
| [docs/DEVELOPER_MANUAL.md](docs/DEVELOPER_MANUAL.md) | Architecture, modules, and how to extend the app |
| [docs/PROVIDERS.md](docs/PROVIDERS.md) | Full guide to STT / LLM / TTS provider configuration |
| [docs/VOICES.md](docs/VOICES.md) | How to download and manage Piper voice models |
| [docs/SCENARIOS.md](docs/SCENARIOS.md) | How to create and customise lesson scenarios |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems and how to fix them |
| [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | Vision, technical strategy, and privacy model |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What is done, what is next |
| [CHANGELOG.md](CHANGELOG.md) | Version history and notable changes |

---

## Provider Overview

| | Local (default, free) | Cloud (fast) |
|---|---|---|
| **STT** | faster-whisper `large-v3-turbo` | Groq Whisper (~150ms) |
| **LLM** | Ollama `gemma4:e2b` | Groq LLaMA 3.3 70B (~80ms TTFT) |
| **TTS** | Piper `de_DE-kerstin-low` | OpenAI TTS / Edge TTS |
| **First audio** | ~1.6s | ~450ms |
| **Cost** | Free, fully offline | Pay-per-use |
| **Privacy** | 100% local | Text sent to APIs |

Switch any provider by editing `.env` and restarting. See [docs/PROVIDERS.md](docs/PROVIDERS.md).

---

## Scenarios

| ID | Title | Level |
|----|-------|-------|
| `alltag` | Daily Life (Alltag) | A1 |
| `restaurant` | At the Restaurant (Im Restaurant) | A1–A2 |
| `arzt` | At the Doctor (Beim Arzt) | A2 |
| `reisen` | Traveling (Reisen) | A2 |

Add your own in `scenarios/`. See [docs/SCENARIOS.md](docs/SCENARIOS.md).

---

## Project Structure

```
german-tutor-ts/
├── src/                  Backend (Node.js + TypeScript)
│   ├── server.ts         Fastify app, routes, WebSocket
│   ├── brain.ts          Parallel correction + streaming reply
│   ├── session.ts        Per-connection lifecycle
│   ├── providers/        STT / LLM / TTS provider implementations
│   └── ...
├── frontend/src/         React 19 + MUI frontend
│   ├── App.tsx           Main component
│   ├── components/       UI components
│   └── hooks/            useWebSocket, useAudioRecorder, useAudioPlayer
├── scenarios/            YAML lesson plans
├── voices/               Piper ONNX voice models
├── stt_server.py         Python STT sidecar (faster-whisper)
├── data/                 SQLite database (auto-created)
└── .venv/                Python environment (faster-whisper + piper-tts)
```
