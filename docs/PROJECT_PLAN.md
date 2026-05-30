# Project Plan: German Voice Tutor (TS Edition)

---

## 1. Vision

Provide a **free, high-quality German tutor ("Lina")** that:

- Runs **fully offline** on a developer's laptop with acceptable latency
- Scales to **sub-500ms** response when cloud providers are available
- Respects user **privacy** — no accounts, no tracking, all data stays local
- Is **easily extensible** — swap any component without touching business logic
- Works for **Arabic and English speakers** learning German at A1–A2 level

---

## 2. Why a TypeScript Rewrite

The original Python/FastAPI version proved the concept. This TypeScript rewrite
targets three specific improvements:

| Pain point (Python original) | Solution (TypeScript) |
|---|---|
| Correction blocks the reply (~400ms penalty per turn) | Parallel correction in `brain.ts` |
| No provider abstraction (hardcoded local) | Clean interface + factory pattern |
| `persistence.py` defined but never called | `node:sqlite` (built-in), actually wired |
| Monolith `App.tsx` (400 lines, no components) | Components + hooks split |
| Piper spawns new Python process per sentence | Warmed subprocess, temp file output |

---

## 3. Technical Stack

### Backend
- **Runtime:** Node.js 22+ (26 recommended) — built-in `node:sqlite`, no native module compilation
- **Framework:** Fastify 5 with `@fastify/websocket`, `@fastify/static`, `@fastify/cors`
- **Language:** TypeScript (ESM, strict mode), executed with `tsx watch` in development
- **Audio decoding:** ffmpeg (WebM → float32 PCM, spawned as subprocess)

### Frontend
- **Framework:** React 19 with hooks
- **UI library:** MUI v6 (Material Design)
- **Build tool:** Vite 8 with proxy config for development

### Inference (local defaults)
- **LLM:** Ollama with `gemma4:e2b` (tutor) + `granite4.1:3b` (corrector)
- **STT:** faster-whisper via Python sidecar (`stt_server.py`)
- **TTS:** Piper subprocess with `de_DE-kerstin-low.onnx` (female German)

### Inference (cloud options)
- **LLM:** Groq, OpenAI, Anthropic
- **STT:** Groq Whisper, OpenAI Whisper
- **TTS:** OpenAI TTS, Microsoft Edge TTS (free), ElevenLabs

---

## 4. Latency Model

### Local stack (default)

```
[STT ~1.2s] ──► [LLM first sentence ~350ms] ──► [TTS ~300ms] = ~1.85s first audio
                                                  ↑
                [Corrector ~350ms] ─────────────(parallel, 0ms on critical path)
```

### Cloud stack (Groq + Piper local)

```
[STT ~150ms] ──► [LLM TTFB ~80ms] ──► [TTS ~300ms] = ~530ms first audio
```

### Cloud stack (Groq + Edge TTS)

```
[STT ~150ms] ──► [LLM TTFB ~80ms] ──► [TTS ~150ms] = ~380ms first audio
```

---

## 5. Privacy Model

| Concern | Our approach |
|---------|-------------|
| No user accounts | Sessions are anonymous WebSocket connections |
| No IP logging | Fastify logger level set to `warn` |
| Local storage | `data/tutor.db` stays on the user's machine |
| 100% local option | `STT_PROVIDER=local`, `LLM_PROVIDER=ollama`, `TTS_PROVIDER=piper` → zero data leaves the machine |
| Session data | Only conversation text stored; no audio recordings |

---

## 6. Planned: `german-tutor-service-proxy`

A companion service (sibling directory at `/Volumes/exSSD1/Tests/german-tutor-service-proxy/`)
that acts as a local HTTP gateway to third-party APIs.

**Purpose:**
- Single place to manage API keys — the tutor only knows `http://localhost:4000`
- Response caching for repeated phrases (common greetings, corrections)
- Per-provider latency logging and fallback on timeout
- Hot-switch providers at runtime without restarting the tutor

**Interface:** OpenAI-compatible REST API — existing provider implementations
require zero changes; just point `OPENAI_BASE_URL=http://localhost:4000/v1`.

---

## 7. Deployment Options

### Local development (current)

```bash
npm run dev          # backend + built frontend on :3000
```

### Production (single-port)

```bash
cd frontend && npm run build && cd ..
npm start            # serves everything on PORT (default 3000)
```

### VPS with cloud providers (minimal RAM)

With `STT_PROVIDER=groq`, `LLM_PROVIDER=groq`, `TTS_PROVIDER=edge`:
- No Python sidecar needed (STT is remote)
- No Piper process (TTS is remote)
- No Ollama models in RAM
- **Memory footprint:** ~150 MB Node.js process only
- **Minimum VPS:** 512 MB RAM, 1 vCPU

### Docker Compose (planned)

Planned for Phase 5. Will bundle Node.js app + Ollama + optional STT sidecar
in a single `docker compose up` deployment.

---

## 8. Pedagogical Design

Lina is built on three pedagogical principles:

**1. Comprehensible input** — Lina speaks German at A1–A2 level using the
most common 1000 words. Learners understand ~95% which is optimal for acquisition.

**2. Forced production** — Push-to-talk requires the learner to generate German,
not just understand it. This activates different neural pathways than passive listening.

**3. Immediate corrective feedback** — The "Sag besser" system provides the
correct form immediately after an error, in context, without interrupting the
conversational flow. This is more effective than delayed correction.

**Target learner profile:**
- Native Arabic speaker with English as a second language
- Learning German at A1–A2 level
- Has access to a laptop or desktop computer with a microphone
