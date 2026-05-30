# Changelog

All notable changes to German Tutor TS are documented here.

---

## [Unreleased] — Active Development

### Added
- `docs/VOICES.md` — guide to downloading and managing Piper voice models
- `docs/SCENARIOS.md` — how to create and customise lesson scenarios
- `docs/PROVIDERS.md` — comprehensive STT / LLM / TTS provider configuration guide
- `docs/TROUBLESHOOTING.md` — common problems and solutions

### Changed
- Default TTS voice changed from `de_DE-thorsten-medium` (male) to `de_DE-kerstin-low` (female) to match Lina's character

---

## [1.1.0] — 2026-05-30 · Stability & Audio Fixes

### Fixed

**Audio playback ("kvit" chirp sound)**
- Root cause: `AudioContext.decodeAudioData` was called before the context
  resumed from its `suspended` state. `resume()` was fired-and-forgotten without
  `await`, so audio was decoded and scheduled while the context was still paused.
- Fix: Reverted to `HTMLAudioElement` with `data:audio/wav;base64,...` data URIs,
  matching the approach used in the original Python project (which worked reliably
  on localhost).

**Piper TTS output (silent or malformed WAV)**
- Root cause: Using `--output_file /dev/stdout` (a pipe) prevented Piper from
  seeking back to finalise WAV header size fields. On some macOS configurations
  this produced a WAV with incorrect `data_size`, which Chrome's audio decoder
  rejected silently.
- Fix: Switched to `--output_file <tmpfile>`, reading and deleting the temp file
  after synthesis. Matches the original Python implementation exactly.

**WebSocket "closed before connection established"**
- Root cause: `@fastify/static` registered a `GET /*` wildcard route (default in
  v9) that intercepted WebSocket upgrade requests before the explicit
  `/ws/chat/:scenarioId` route was matched.
- Fix: Added `wildcard: false` to `@fastify/static` registration. WS route
  registered directly on `app` (not in a scoped plugin) and before the static plugin.

**React audio cleanup loop**
- Root cause: `onStatusChange` was an inline arrow function in `App.tsx`, creating
  a new reference on every render. This caused `disconnect` (which depended on
  `updateStatus` → `onStatusChange`) to change on every render, and the cleanup
  `useEffect` fired and closed the WebSocket immediately after it opened.
- Fix: `useWebSocket` stores callbacks in refs ("latest ref" pattern), making
  `updateStatus`, `disconnect`, and `connect` all have stable references.

**STT language detection — German misidentified as Arabic**
- Root cause: Whisper's language detector sometimes assigns higher confidence to
  Arabic than German for short utterances.
- Fix: Added 60% confidence threshold in `stt_server.py`. Below threshold,
  defaults to German.

**`npm install` failing with `Invalid Version` (esbuild@0.28.0)**
- Root cause: npm 11's semver parser rejects empty-string version in
  `@esbuild/win32-x64@0.28.0` platform package metadata.
- Fix: Added `"overrides": { "esbuild": "0.25.5" }` to `package.json`.

### Changed
- `@fastify/static` bumped to v9.1.3 (via `npm audit fix`)
- STT provider removed `PYTHON_BIN` from `config.stt` sub-object — now lives at
  top-level `config.pythonBin`, shared by both STT sidecar and Piper TTS subprocess
- Audio constraints in `useAudioRecorder` changed from
  `{ echoCancellation: true, noiseSuppression: true }` to `{ audio: true }` to
  match original project and avoid Whisper language detection interference

---

## [1.0.0] — 2026-05-30 · Initial TypeScript Release

Complete rewrite of the original Python/FastAPI German Voice Tutor.

### Architecture

- **Backend**: Node.js 26 + Fastify 5 + TypeScript (replaces Python + FastAPI)
- **Frontend**: React 19 + MUI v6 + Vite 8 (refactored from monolith App.tsx into components + hooks)
- **Database**: `node:sqlite` (built-in, no native module compilation required)

### New features vs. original Python project

| Feature | Python original | TypeScript v1.0 |
|---------|----------------|-----------------|
| Grammar correction | Sequential (blocks reply) | **Parallel** (off critical path) |
| TTS | New Python process per sentence | Per-sentence temp file (same model) |
| Ollama keep-alive | Not configured | `keep_alive: -1` (model stays warm) |
| Provider selection | Hardcoded local only | `.env` switchable per service |
| SQLite persistence | Defined, never called | Actually wired (`node:sqlite`) |
| Frontend structure | 400-line App.tsx | Components + hooks |
| Mic waveform | None | Live bars via Web Audio API |
| WebSocket reconnect | Manual page reload | Auto with exponential backoff |
| Keyboard shortcut | None | **Space** for push-to-talk |
| Scenario selector | Raw ID dropdown | Cards with title + description |
| Settings panel | None | Drawer: provider info + latency |
| Arabic text | Not handled | Auto RTL alignment |

### STT sidecar

Python `stt_server.py` — loads faster-whisper once at startup, serves
`POST /transcribe` on `localhost:5001`. Node.js spawns it as a child process
and communicates via HTTP. This eliminates the ~1s model reload cost on every request.

### Provider abstraction

Clean TypeScript interfaces for all three services:
- `STTProvider` — `transcribe(pcm: Buffer): Promise<TranscriptResult>`
- `LLMProvider` — `stream(messages): AsyncGenerator<string>`, `complete(messages): Promise<string>`
- `TTSProvider` — `synthesize(text: string): Promise<Buffer | null>`

Implementations: local, Groq, OpenAI, Anthropic (LLM); local piper, OpenAI, Edge, ElevenLabs (TTS).
