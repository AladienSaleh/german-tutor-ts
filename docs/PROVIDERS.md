# Provider Configuration Guide

All STT / LLM / TTS providers are configured via environment variables in `.env`.
The app reads `.env` at startup — restart after any change.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  .env                                                           │
│                                                                 │
│  STT_PROVIDER = local | groq | openai                          │
│  LLM_PROVIDER = ollama | openai | groq | anthropic             │
│  TTS_PROVIDER = piper | openai | edge | elevenlabs             │
└─────────────────────────────────────────────────────────────────┘
```

Each provider has its own factory in `src/providers/{stt,llm,tts}/index.ts`.
Adding a new provider requires only creating one file and registering it in the factory.

---

## STT (Speech-to-Text)

### `local` — faster-whisper (default)

Runs entirely offline using the Whisper model via a Python sidecar process.

```env
STT_PROVIDER=local
STT_MODEL=large-v3-turbo    # tiny | base | small | medium | large-v3-turbo
STT_COMPUTE=int8            # int8 | float16 | float32
STT_PORT=5001               # port for the local sidecar HTTP server
PYTHON_BIN=.venv/bin/python # python with faster-whisper installed
```

**Model size vs. speed tradeoff:**

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| `tiny` | ~39 MB | ~300ms | Low |
| `base` | ~74 MB | ~500ms | Moderate |
| `small` | ~244 MB | ~700ms | Good |
| `medium` | ~769 MB | ~1.0s | Very good |
| `large-v3-turbo` | ~1.5 GB | ~1.2s | **Best** |

The model is downloaded on first run to `~/.cache/huggingface/hub/` and cached.

**Language detection:** The sidecar detects German, English, and Arabic from
each audio clip and transcribes accordingly. If confidence is below 60%, it
defaults to German to avoid false Arabic detections.

---

### `groq` — Groq Whisper (~150ms)

Uses Groq's ultra-fast Whisper endpoint. Requires an API key (free tier available).

```env
STT_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_STT_MODEL=whisper-large-v3-turbo
```

Get a free key at: https://console.groq.com

---

### `openai` — OpenAI Whisper

```env
STT_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

Uses `whisper-1` model. Higher cost than Groq but reliable.

---

## LLM (Language Model)

### `ollama` — Local Ollama (default)

Runs models locally via Ollama. Fully offline, free, private.

```env
LLM_PROVIDER=ollama
LLM_MODEL=gemma4:e2b              # main tutor model
LLM_CORRECTOR_MODEL=granite4.1:3b # fast grammar corrector
OLLAMA_URL=http://localhost:11434/api/chat
```

**Recommended model pairs:**

| Main model | Corrector | Quality | Speed |
|------------|-----------|---------|-------|
| `gemma4:e2b` | `granite4.1:3b` | Excellent | Fast |
| `llama3.2:3b` | `granite4.1:3b` | Good | Very fast |
| `gemma4:latest` | `granite4.1:3b` | Best | Slower |

**Important:** Models must be pulled before use:
```bash
ollama pull gemma4:e2b
ollama pull granite4.1:3b
```

The `keep_alive: -1` option in requests keeps models in RAM between sessions,
eliminating the first-turn cold start.

---

### `groq` — Groq LLaMA (~80ms TTFT)

Groq's LPU hardware gives 10× faster inference than local Ollama for large models.

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_LLM_MODEL=llama-3.3-70b-versatile
```

The corrector also uses Groq when `LLM_PROVIDER=groq`.

**Available Groq models for German tutoring:**

| Model | Quality | Speed |
|-------|---------|-------|
| `llama-3.3-70b-versatile` | Excellent | ~80ms TTFT |
| `llama-3.1-8b-instant` | Good | ~50ms TTFT |
| `gemma2-9b-it` | Good | ~60ms TTFT |
| `mixtral-8x7b-32768` | Very good | ~70ms TTFT |

---

### `openai` — OpenAI GPT

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_LLM_MODEL=gpt-4o-mini    # gpt-4o | gpt-4o-mini | gpt-3.5-turbo
```

Can also point to any OpenAI-compatible endpoint:
```env
OPENAI_BASE_URL=http://localhost:4000/v1   # e.g. german-tutor-service-proxy
```

---

### `anthropic` — Claude

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

**Recommended Claude models:**

| Model | Quality | Speed | Cost |
|-------|---------|-------|------|
| `claude-haiku-4-5-20251001` | Good | Fast | Low |
| `claude-sonnet-4-6` | Excellent | Medium | Medium |
| `claude-opus-4-8` | Best | Slow | High |

---

## TTS (Text-to-Speech)

### `piper` — Local Piper (default)

Runs entirely offline. Synthesises speech to a temp WAV file then sends it to the browser.

```env
TTS_PROVIDER=piper
PIPER_VOICE=./voices/de_DE-kerstin-low.onnx
```

See [VOICES.md](VOICES.md) for available voices and download instructions.

**How it works:**
1. Piper writes a WAV file to a temp path
2. Node reads the file and base64-encodes it
3. The WAV is sent over WebSocket to the browser
4. The browser plays it via `HTMLAudioElement`

First synthesis per session is slow (~600ms) as Python loads the model.
Subsequent sentences are faster (~150ms) as the model stays warm in RAM.

---

### `openai` — OpenAI TTS

High-quality neural voices, ~200ms latency.

```env
TTS_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_TTS_VOICE=nova    # alloy | echo | fable | onyx | nova | shimmer
```

**Voice recommendations for a female German tutor:**
- `nova` — warm, natural (recommended)
- `shimmer` — expressive, clear
- `alloy` — neutral, professional

Note: OpenAI TTS speaks whichever language the text is in — no special German config needed.

---

### `edge` — Microsoft Edge TTS (free, no key required)

Uses Microsoft's neural TTS service. Requires internet per synthesis but no API key.

```bash
# First: install the edge-tts Python package
uv pip install edge-tts
```

```env
TTS_PROVIDER=edge
```

Default voice: `de-DE-KatjaNeural` (female, warm, natural).

Change the voice in `src/providers/tts/edge.ts`:
```ts
const VOICE = 'de-DE-KatjaNeural';  // change to any Edge TTS voice
```

**Available female German voices:**
- `de-DE-KatjaNeural` — warm, natural (default)
- `de-DE-AmalaNeural` — younger-sounding
- `de-DE-ElkeNeural` — natural
- `de-DE-LouisaNeural` — lively
- `de-DE-GiselaNeural` — child voice (for kids' content)
- `de-DE-SeraphinaMultilingualNeural` — multilingual capable

---

### `elevenlabs` — ElevenLabs

Premium quality, very natural voices. Highest cost.

```env
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=your_voice_id  # from ElevenLabs dashboard
```

---

## Latency by Provider Combination

| STT | LLM | TTS | Total first audio | Monthly cost (est.) |
|-----|-----|-----|-------------------|---------------------|
| local | ollama | piper | ~1.6s | Free |
| local | groq | piper | ~1.2s | Free (Groq free tier) |
| groq | groq | edge | ~500ms | Free |
| groq | groq | openai | ~600ms | ~$5–15 |
| openai | openai | openai | ~700ms | ~$10–20 |

"First audio" = time from releasing the mic button to hearing Lina's first word.

---

## Switching Providers at Runtime

The server must be restarted for provider changes to take effect:

```bash
# Edit .env then:
npm run dev
```

The logs at startup confirm which providers are active:
```
[Boot] STT=local  LLM=ollama  TTS=piper
[Boot] Providers ready
```
