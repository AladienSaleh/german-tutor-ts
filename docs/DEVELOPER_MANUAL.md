# Developer Manual: German Voice Tutor (TS Edition)

---

## 1. Architecture Overview

Lina is a **streaming voice pipeline** built on Node.js. Three external services
(STT, LLM, TTS) each have a clean interface and multiple pluggable implementations.

```
Browser (React 19)
  │
  │  WebSocket /ws/chat/:scenarioId
  │  Sends: base64 WebM audio
  │  Receives: JSON messages (text, audio, corrections, timing)
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Fastify server (Node.js :3000)                                │
│                                                                 │
│  ┌──────────┐   ┌──────────────────────────────────────────┐  │
│  │ session  │──▶│              TutorBrain                  │  │
│  │ .ts      │   │  brain.ts                                │  │
│  └──────────┘   │                                          │  │
│                 │  [user audio WebM]                        │  │
│                 │       │                                   │  │
│                 │  ffmpeg decode → PCM float32              │  │
│                 │       │                                   │  │
│                 │  STTProvider.transcribe(pcm)              │  │
│                 │       │ "Ich heiße Ahmad."                │  │
│                 │       │                                   │  │
│                 │  ┌────┴─────────────────────┐            │  │
│                 │  │                          │            │  │
│                 │  ▼ parallel                 ▼            │  │
│                 │  LLMProvider               LLMProvider   │  │
│                 │  .stream() (reply)         .complete()   │  │
│                 │  → sentences               (corrector)   │  │
│                 │  │                          │            │  │
│                 │  ▼ per sentence             │            │  │
│                 │  TTSProvider.synthesize()   │            │  │
│                 │  → WAV bytes                │            │  │
│                 │  │                          │            │  │
│                 │  └──────────── yield to WS ─┘            │  │
│                 └──────────────────────────────────────────┘  │
│                                                                 │
│  REST:  GET /api/scenarios  GET /api/config  GET /api/health   │
│  Static: frontend/dist/  (SPA fallback via setNotFoundHandler) │
└─────────────────────────────────────────────────────────────────┘
       │                    │                      │
  stt_server.py         Ollama                python -m piper
  :5001 (HTTP)          :11434 (HTTP)          (subprocess)
  faster-whisper        gemma4:e2b             de_DE-kerstin-low.onnx
```

---

## 2. Project Structure

```
german-tutor-ts/
├── src/                           Backend (TypeScript)
│   ├── server.ts                  Fastify app, routes, WebSocket, static
│   ├── session.ts                 Per-WS-connection lifecycle
│   ├── brain.ts                   TutorBrain: parallel correction + streaming
│   ├── audio.ts                   ffmpeg WebM→PCM decode, normalise, pad
│   ├── scenarios.ts               js-yaml loader
│   ├── persistence.ts             node:sqlite session + turn logging
│   ├── config.ts                  Typed env config (all settings here)
│   └── providers/
│       ├── stt/
│       │   ├── interface.ts       STTProvider + TranscriptResult types
│       │   ├── index.ts           Factory (reads config.stt.provider)
│       │   ├── local.ts           Spawns stt_server.py, calls via HTTP
│       │   ├── groq.ts            Groq Whisper API
│       │   └── openai.ts          OpenAI Whisper API
│       ├── llm/
│       │   ├── interface.ts       LLMProvider + Message types
│       │   ├── index.ts           Factory; createMainLLM / createCorrectorLLM
│       │   ├── ollama.ts          Ollama streaming (native fetch, no SDK)
│       │   ├── openai.ts          OpenAI streaming
│       │   ├── groq.ts            Groq streaming
│       │   └── anthropic.ts       Anthropic streaming
│       └── tts/
│           ├── interface.ts       TTSProvider type
│           ├── index.ts           Factory (reads config.tts.provider)
│           ├── piper.ts           Piper subprocess with temp file
│           ├── openai.ts          OpenAI TTS
│           └── edge.ts            Microsoft Edge TTS (free)
├── stt_server.py                  Python HTTP sidecar (faster-whisper)
├── frontend/                      React 19 + MUI 6 + Vite 8
│   └── src/
│       ├── App.tsx                Main component; state machine, wires hooks
│       ├── theme.ts               MUI theme (green palette)
│       ├── hooks/
│       │   ├── useWebSocket.ts    WS with exponential-backoff reconnect
│       │   ├── useAudioRecorder.ts  MediaRecorder + AnalyserNode + Space key
│       │   └── useAudioPlayer.ts  Sequential WAV queue with interrupt
│       └── components/
│           ├── ChatArea.tsx       Message bubbles; RTL detection for Arabic
│           ├── RecordButton.tsx   Mic FAB with live waveform bars
│           ├── ScenarioModal.tsx  Scenario picker cards
│           ├── SettingsDrawer.tsx Provider info + latency stats
│           └── StatusBar.tsx      AppBar: status dot, state label, settings
├── scenarios/                     YAML lesson plans (see SCENARIOS.md)
├── voices/                        Piper ONNX voice models (see VOICES.md)
├── data/                          SQLite database (auto-created at startup)
└── .venv/                         Python: faster-whisper + piper-tts
```

---

## 3. Provider Interfaces

All three services share the same pattern: a TypeScript interface, a factory
reading `config`, and per-provider files loaded at startup.

### STTProvider
```typescript
// src/providers/stt/interface.ts
interface TranscriptResult { text: string; language: string; }
interface STTProvider {
  transcribe(pcm: Buffer): Promise<TranscriptResult>;
  destroy?(): void;
}
```
Input: raw **float32 LE PCM at 16 kHz** (after ffmpeg decoding).

### LLMProvider
```typescript
// src/providers/llm/interface.ts
interface Message { role: 'system' | 'user' | 'assistant'; content: string; }
interface LLMProvider {
  stream(messages: Message[]): AsyncGenerator<string>;
  complete(messages: Message[]): Promise<string>;
}
```
`stream` is used for the main reply; `complete` for the corrector.

### TTSProvider
```typescript
// src/providers/tts/interface.ts
interface TTSProvider {
  synthesize(text: string): Promise<Buffer | null>;
  destroy?(): void;
}
```
Returns a **WAV buffer** (or `null` for empty input). The server base64-encodes
it and sends it as a WebSocket message.

---

## 4. TutorBrain: Parallel Correction

The grammar corrector runs in parallel with the reply stream. It never blocks
Lina from speaking.

```
[STT done] → user text
    │
    ├──── corrector.complete(userText) ──────────────────► correction badge
    │     (fast small model, ~300ms, parallel)            (appears when ready)
    │
    └──── llm.stream(history) ──► sentence 1 ──► TTS ──► audio ▶
                                  sentence 2 ──► TTS ──► audio ▶
                                  ...
```

Implementation (`src/brain.ts`):

```typescript
// Both start at the same time:
const correctionPromise = this.checkCorrection(transcript);
const replyStream = this.llm.stream(this.history);

// Reply streams out immediately:
for await (const sentence of splitSentences(replyStream)) {
  yield { type: 'reply_text', text: sentence };
  const audio = await this.tts.synthesize(sentence);
  if (audio) yield { type: 'audio', data: audio.toString('base64') };
}

// Correction appears whenever it's ready (often before reply finishes):
const correction = await correctionPromise;
if (correction) yield { type: 'correction', text: correction };
```

---

## 5. STT Sidecar (`stt_server.py`)

A minimal Python HTTP server that:
1. Loads `faster-whisper` once at startup
2. Logs `[STT] Ready on port 5001` — Node.js waits for this line
3. Accepts `POST /transcribe` with raw float32 PCM body
4. Returns `{ "text": "...", "language": "German" }`

**Language detection:** Among German, English, Arabic, selects the language with
the highest probability. If confidence < 60%, defaults to German to avoid
false Arabic detections on short utterances.

**Managed as a child process:** Node.js spawns `stt_server.py` on startup and
kills it on `SIGINT`/`SIGTERM`. All stderr output is forwarded to the server log.

---

## 6. TTS: Per-Sentence Temp File

Piper is called once per sentence with a real temp file path (not stdout):

```
python -m piper --model voices/de_DE-kerstin-low.onnx --output_file /tmp/piper_xxx.wav
```

**Why temp file instead of `/dev/stdout`?**
Piper writes a WAV header with placeholder sizes, then seeks back after synthesis
to write the correct `data_size` field. On a pipe (stdout), seeking is impossible,
which can produce a WAV with an incorrect header on macOS — Chrome's audio
decoder rejects this silently. A real file guarantees the WAV is fully finalised.

---

## 7. WebSocket Protocol

All messages are JSON. The server sends; the browser receives (except `audio` which
is bidirectional).

| Direction | `type` | Fields | Description |
|-----------|--------|--------|-------------|
| Browser → Server | `audio` | `data: string` (base64 WebM) | User's recorded speech |
| Server → Browser | `transcript` | `text, lang` | STT result |
| Server → Browser | `reply_text` | `text` | One sentence from LLM |
| Server → Browser | `audio` | `data: string` (base64 WAV) | TTS audio for a sentence |
| Server → Browser | `correction` | `text` | Grammar correction |
| Server → Browser | `turn_end` | — | End of Lina's turn |
| Server → Browser | `timing` | `sttMs, ttsMs` | Latency stats |
| Server → Browser | `error` | `text` | Recoverable error |

---

## 8. Frontend State Machine

```
IDLE → [user press] → RECORDING → [release] → PROCESSING → SPEAKING → IDLE
                          ↑                         │
                          └─────── interrupt() ─────┘
```

`App.tsx` manages this via the `appState` state variable.
State transitions drive the `RecordButton` visual and status bar label.

---

## 9. Database Schema

SQLite database at `data/tutor.db` (created automatically via `node:sqlite`).

```sql
sessions (id, scenario, started, ended)
turns    (id, session_id, role, content, correction, stt_ms, llm_ms, tts_ms, ts)
```

`role` is `'user'` or `'assistant'`. Timing columns record per-turn latency for analysis.

---

## 10. Adding a New Provider

### Example: Add a new TTS provider "mycorp"

**Step 1:** Create `src/providers/tts/mycorp.ts`:
```typescript
import type { TTSProvider } from './interface.js';
import { config } from '../../config.js';

export class MycorpTTS implements TTSProvider {
  async synthesize(text: string): Promise<Buffer | null> {
    if (!text.trim()) return null;
    // ... call mycorp API ...
    return Buffer.from(wavBytes);
  }
}
```

**Step 2:** Register in `src/providers/tts/index.ts`:
```typescript
import { MycorpTTS } from './mycorp.js';

export function createTTSProvider(): TTSProvider {
  switch (config.tts.provider) {
    case 'mycorp': return new MycorpTTS();
    // ... existing cases ...
  }
}
```

**Step 3:** Add to the union type in `src/config.ts`:
```typescript
provider: (process.env.TTS_PROVIDER ?? 'piper') as
  'piper' | 'openai' | 'edge' | 'elevenlabs' | 'mycorp',
```

**Step 4:** Document in `.env.example` and `docs/PROVIDERS.md`.

No other files need to change.

---

## 11. Running in Development

```bash
# Backend (auto-restarts on TypeScript changes):
npm run dev

# Frontend (HMR — changes appear instantly in browser):
cd frontend && npm run dev   # → http://localhost:5173
```

The Vite dev server proxies `/api/*` and `/ws/*` to the backend at `:3000`.

---

## 12. Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server port |
| `LLM_PROVIDER` | `ollama` | `ollama \| openai \| groq \| anthropic` |
| `LLM_MODEL` | `gemma4:e2b` | Main tutor model |
| `LLM_CORRECTOR_MODEL` | `granite4.1:3b` | Grammar corrector (Ollama only) |
| `OLLAMA_URL` | `http://localhost:11434/api/chat` | |
| `STT_PROVIDER` | `local` | `local \| groq \| openai` |
| `STT_MODEL` | `large-v3-turbo` | Whisper model size |
| `STT_COMPUTE` | `int8` | Whisper quantisation |
| `STT_PORT` | `5001` | Local STT sidecar HTTP port |
| `PYTHON_BIN` | `.venv/bin/python` | Python with piper-tts + faster-whisper |
| `TTS_PROVIDER` | `piper` | `piper \| openai \| edge \| elevenlabs` |
| `PIPER_VOICE` | `./voices/de_DE-kerstin-low.onnx` | Voice model path |
| `OPENAI_API_KEY` | — | Required for `openai` provider |
| `GROQ_API_KEY` | — | Required for `groq` provider |
| `ANTHROPIC_API_KEY` | — | Required for `anthropic` provider |
