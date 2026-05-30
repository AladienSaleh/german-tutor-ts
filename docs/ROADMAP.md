# Roadmap: German Voice Tutor (TS Edition)

---

## Phase 1: Local Foundation ✅ Complete

### Core infrastructure
- [x] TypeScript/Node.js rewrite of the original Python/FastAPI project
- [x] Fastify 5 server with WebSocket, static serving, health + config endpoints
- [x] `node:sqlite` persistence (built-in Node.js, no native module compilation)
- [x] Provider abstraction — STT, LLM, TTS each behind a clean TypeScript interface
- [x] Factory pattern — swap any provider via `.env` without code changes
- [x] Project-local Python `.venv` with faster-whisper + piper-tts

### Latency improvements over the original
- [x] Parallel correction pipeline — corrector runs alongside LLM reply (off the critical path)
- [x] Ollama `keep_alive: -1` — model stays warm between sessions
- [x] Per-sentence TTS with temp files — audio starts playing before the full reply arrives
- [x] STT Python sidecar (`stt_server.py`) — Whisper model loaded once, served via HTTP

### Frontend
- [x] React 19 + MUI v6 frontend refactored into components + hooks
- [x] `useWebSocket` — auto-reconnect with exponential backoff, ref-based callback storage
- [x] `useAudioRecorder` — MediaRecorder + AnalyserNode waveform + **Space** key shortcut
- [x] `useAudioPlayer` — sequential WAV queue with interrupt support
- [x] Scenario picker modal — cards with full title + description
- [x] Settings drawer — provider info + per-turn latency display
- [x] Live mic waveform bars (Web Audio API `AnalyserNode`)
- [x] Auto-interrupt audio when user starts recording
- [x] Arabic text auto RTL alignment
- [x] Vite dev proxy for local development (`/api` + `/ws` → backend)

### Voices
- [x] Female German voice support (de_DE-kerstin-low) — Lina sounds like herself
- [x] Download guide and voice switching documented

### Bug fixes resolved during development
- [x] `npm install` failing (esbuild 0.28.0 semver bug — overrides fix)
- [x] WebSocket upgrade intercepted by `@fastify/static` wildcard
- [x] React useEffect loop disconnecting WebSocket immediately after open
- [x] TTS audio garbled — Piper `/dev/stdout` WAV header not finalized on macOS
- [x] STT misidentifying German as Arabic — confidence threshold fix
- [x] Audio element playing 22050 Hz at wrong speed — reverted to `new Audio()` data URIs

### Documentation
- [x] README.md — overview, quick start, provider table, scenario list
- [x] RUN.md — full setup and run guide
- [x] docs/USER_MANUAL.md — how to use Lina
- [x] docs/DEVELOPER_MANUAL.md — architecture, modules, WS protocol
- [x] docs/PROVIDERS.md — STT / LLM / TTS configuration guide
- [x] docs/VOICES.md — voice download and management
- [x] docs/SCENARIOS.md — creating custom lesson scenarios
- [x] docs/TROUBLESHOOTING.md — common problems and fixes
- [x] docs/PROJECT_PLAN.md — vision, strategy, privacy
- [x] CHANGELOG.md — version history

---

## Phase 2: Cloud Providers & Service Proxy

- [ ] **`german-tutor-service-proxy`** — local HTTP gateway for third-party APIs
  - [ ] OpenAI-compatible REST API (tutor points to `localhost:4000` instead of upstream)
  - [ ] Response caching for repeated phrases (greetings, corrections)
  - [ ] Per-provider latency logging and automatic fallback on timeout
  - [ ] Hot-switch providers at runtime without restarting the tutor
- [ ] Edge TTS — install guide + package (`edge-tts`) in setup
- [ ] ElevenLabs TTS — voice cloning option for custom Lina voice
- [ ] Groq STT/LLM — end-to-end test with real keys
- [ ] OpenAI TTS — end-to-end test

---

## Phase 3: Learning Features

- [ ] **Lesson progress indicator** — show which point (e.g. 3/9) Lina is currently on
- [ ] **Correction history panel** — list all "Sag besser" corrections from the session
- [ ] **Vocabulary tracker** — highlight new German words introduced by Lina
- [ ] **Session replay** — read the full conversation transcript after a session ends
- [ ] **Difficulty levels** — A1 / A2 / B1 mode changes the system prompt and model temperature
- [ ] **Session summary** — at session end, show count of turns, corrections, new vocabulary

---

## Phase 4: Mobile & PWA

- [ ] **PWA manifest + service worker** — install on iOS/Android home screen
- [ ] **Screen wake lock** — `WakeLock` API keeps the screen on during active sessions
- [ ] **Browser-side STT** — `transformers.js` Whisper runs in the browser, removes the Python sidecar dependency on mobile
- [ ] **Haptic feedback** — vibrate on correction badge on mobile devices
- [ ] **Offline mode** — service worker caches the app shell for offline launch

---

## Phase 5: Scenario Builder & Deployment

- [ ] **In-app scenario editor** — create and edit YAML lesson plans from the UI without touching files
- [ ] **Scenario import/export** — share lesson plans as `.yaml` files
- [ ] **Multi-session support** — multiple simultaneous WebSocket connections with isolated conversation histories
- [ ] **Docker Compose** — one-command deployment with Ollama, app server, and optional STT sidecar
- [ ] **VPS deployment guide** — run on a 2 GB VPS using cloud STT/LLM/TTS (no Python sidecar needed)
- [ ] **Multi-language** — extend beyond German to other languages via scenario + voice + model selection
