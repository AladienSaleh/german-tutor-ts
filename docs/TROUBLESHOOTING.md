# Troubleshooting Guide

Solutions to the most common problems when running German Tutor TS.

---

## Server Won't Start

### `Error: Cannot find module`

The backend dependencies are not installed.

```bash
cd /Volumes/exSSD1/Tests/german-tutor-ts
npm install
```

### `Invalid Version` error during `npm install`

npm 11 has a bug with `esbuild@0.28.0`. The fix is already in `package.json`
via an `overrides` block. If you see this, delete the lock file and reinstall:

```bash
rm package-lock.json
npm install
```

### Port 3000 already in use

```bash
lsof -ti :3000 | xargs kill  # kill whatever is on port 3000
npm run dev
```

---

## STT (Speech Recognition) Issues

### `[STT] Sidecar startup timeout`

The Python STT sidecar failed to load. Possible causes:

**1. Wrong `PYTHON_BIN`**
```bash
# Verify the path is correct
cat .env | grep PYTHON_BIN

# Test it directly
$(.venv/bin/python -c "import faster_whisper; print('ok')" 2>&1)
```

**2. faster-whisper not installed in the venv**
```bash
uv pip install "faster-whisper==1.2.1"
```

**3. Port 5001 is in use**
```bash
lsof -ti :5001 | xargs kill
```

Then change `STT_PORT` in `.env` to a free port if it keeps happening.

**4. Model download in progress**

On first run, Whisper downloads the model (~1.5 GB for `large-v3-turbo`).
Watch the log — you should see download progress. Change the model:

```env
STT_MODEL=tiny    # much smaller, downloads fast, lower accuracy
```

---

### German speech detected as Arabic

Whisper's language detector can misidentify short German utterances as Arabic.
The sidecar uses a 60% confidence threshold and defaults to German when unsure.

If this still happens:
- Speak for at least **2 seconds** before releasing the button
- Speak more clearly and at a normal pace
- Try a smaller, faster Whisper model — it sometimes has better language detection for short clips:
  ```env
  STT_MODEL=medium
  ```

---

### Transcription is empty or garbled

- **Microphone not permitted** — check browser permissions (address bar → lock icon → microphone → Allow)
- **Recording too short** — hold the mic button for at least 1.5 seconds
- **Audio level too low** — move closer to your microphone
- **VAD cutting audio** — try speaking slightly louder

---

## TTS (Audio) Issues

### No sound at all

1. **Check browser volume** — the tab and system volume must both be above zero
2. **Check output device** — Chrome might be routing audio to a non-default device
3. **Check the console** — open F12 → Console and look for `[Audio]` errors

```
[Audio] enqueued 22108 bytes      ← audio data arrived
[Audio] playing 0.52s at 22050Hz  ← playback started
```

If you see `enqueued` but not `playing`, the audio element is being blocked.
Click anywhere on the page to register a user gesture, then try again.

---

### Sound is very fast / high-pitched ("kvit kvit")

This happens when 22050 Hz audio plays at 44100 Hz. The issue was in an earlier
AudioContext implementation and is now fixed. If it reappears, verify you're
running the latest frontend build:

```bash
cd frontend && npm run build && cd ..
npm run dev
```

---

### Sound is male (Thorsten) instead of female (Kerstin)

The female voice is not downloaded yet. Follow the instructions in [VOICES.md](VOICES.md):

```bash
cd voices
curl -L -o de_DE-kerstin-low.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx"
curl -L -o de_DE-kerstin-low.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx.json"
```

Then verify in `.env`:
```env
PIPER_VOICE=./voices/de_DE-kerstin-low.onnx
```

---

### Piper synthesis is very slow (> 3s per sentence)

- The ONNX model is loading fresh every time — this is normal on the first sentence of each session
- Subsequent sentences should be ~150–300ms as Python caches the model in RAM
- If ALL sentences are slow, check that piper is using the correct Python: `PYTHON_BIN=.venv/bin/python`

Test manually:
```bash
time echo "Hallo!" | .venv/bin/python -m piper \
  --model voices/de_DE-kerstin-low.onnx \
  --output_file /tmp/t.wav
```
Expected: ~600ms first time, ~150ms subsequent calls in the same process.

---

### `[TTS] Piper exited 1`

Piper failed. Common causes:

**Voice file not found:**
```bash
ls voices/de_DE-kerstin-low.onnx    # should exist
```

**JSON config file missing:**
```bash
ls voices/de_DE-kerstin-low.onnx.json    # both files required
```

**Wrong Python path:**
```bash
.venv/bin/python -m piper --help    # should print piper usage
```

---

## LLM / Conversation Issues

### Ollama not running

```bash
ollama serve       # start the Ollama server
# or check if it's already running:
curl http://localhost:11434/api/tags
```

### Model not found

```bash
ollama pull gemma4:e2b
ollama pull granite4.1:3b
ollama list    # verify they appear
```

### Lina responds in English instead of German

The system prompt instructs Lina to always use German. If she switches to English:
- The LLM might be ignoring instructions (try a different model)
- Check `src/config.ts` SYSTEM_PROMPT is unchanged
- Restart the server to apply any config changes

### Lina's responses are cut off

Increase the `num_predict` limit in `src/providers/llm/ollama.ts`:
```ts
options: { num_predict: 200, temperature: 0.7, keep_alive: -1 },
```

---

## WebSocket Issues

### "WebSocket is closed before the connection is established"

The WebSocket route is not being reached. Check:

```bash
# Server running?
curl http://localhost:3000/api/health

# WebSocket route accessible?
# Open http://localhost:3000 — if the page loads, the server is fine
```

If the page loads but WS fails, try a hard refresh (Cmd+Shift+R) to clear any
cached old frontend code.

---

### Connection drops repeatedly

The WebSocket auto-reconnects with exponential backoff. If it keeps dropping:

1. Check server logs for errors
2. Ensure Ollama is responding quickly (slow LLM can cause timeouts)
3. Check system memory — running out of RAM causes processes to be killed

---

## Frontend Issues

### Page loads but shows blank content

```bash
# Was the frontend built?
ls frontend/dist/index.html

# If not:
cd frontend && npm run build && cd ..
npm run dev
```

### Scenario cards don't appear

The `/api/scenarios` endpoint might be failing:

```bash
curl http://localhost:3000/api/scenarios
```

Expected: `{"scenarios":[{"id":"alltag","title":"Daily Life...`

If it fails, check the `scenarios/` directory:
```bash
ls scenarios/*.yaml    # should list 4 files
```

---

## Performance Issues

### High CPU usage

- Whisper model inference is CPU-intensive — this is normal during transcription
- `int8` compute type is already the fastest: `STT_COMPUTE=int8`
- Use a smaller Whisper model: `STT_MODEL=small`
- Switch STT to Groq: `STT_PROVIDER=groq` (offloads computation entirely)

### High memory usage

- faster-whisper `large-v3-turbo` uses ~1.5 GB RAM
- Ollama models use 4–8 GB RAM depending on model
- Minimum recommended: 8 GB RAM (16 GB for comfortable use)
- Use smaller models: `STT_MODEL=tiny`, `LLM_MODEL=llama3.2:3b`

---

## Getting More Help

1. **Check server logs** — most errors appear with `[Boot]`, `[WS]`, `[STT]`, `[Brain]` prefixes
2. **Check browser console** — F12 → Console for frontend errors
3. **Test each component** individually using the commands in [RUN.md](../RUN.md)
4. **Simplify** — switch to the smallest models to rule out resource issues
