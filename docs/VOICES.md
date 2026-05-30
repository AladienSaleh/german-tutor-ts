# Voice Models Guide

Lina uses [Piper TTS](https://github.com/rhasspy/piper) for local, offline speech synthesis.
Voices are ONNX neural models downloaded separately and stored in the `voices/` directory.

---

## Bundled Voices

The following voices ship with the repository (copied from the original Python project):

| File | Language | Gender | Quality | Size |
|------|----------|--------|---------|------|
| `de_DE-thorsten-medium.onnx` | German | Male | Medium | ~63 MB |
| `ar_JO-kareem-medium.onnx` | Arabic (Jordan) | Male | Medium | ~63 MB |
| `en_US-amy-medium.onnx` | English (US) | Female | Medium | ~63 MB |

> **Default for Lina:** `de_DE-kerstin-low.onnx` (female German, must be downloaded — see below)

---

## Recommended Voice: Kerstin (Female German)

Lina is a female tutor, so a female German voice is the right fit.

```bash
cd voices

curl -L -o de_DE-kerstin-low.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx"

curl -L -o de_DE-kerstin-low.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/kerstin/low/de_DE-kerstin-low.onnx.json"
```

Then set in `.env`:
```env
PIPER_VOICE=./voices/de_DE-kerstin-low.onnx
```

---

## All Available German Voices

| ID | Gender | Quality | Size | Notes |
|----|--------|---------|------|-------|
| `de_DE-eva_k-x_low` | Female | x_low | ~26 MB | Smallest, most robotic |
| `de_DE-kerstin-low` | Female | low | ~64 MB | **Recommended** — good balance |
| `de_DE-ramona-low` | Female | low | ~67 MB | Alternative female voice |
| `de_DE-stefanie-medium` | Female | medium | ~63 MB | Higher quality female |
| `de_DE-thorsten-low` | Male | low | ~62 MB | Smaller male voice |
| `de_DE-thorsten-medium` | Male | medium | ~63 MB | Bundled, male |
| `de_DE-thorsten-high` | Male | high | ~130 MB | Best male quality |

**Quality levels:**
- `x_low` — Very fast, robotic-sounding, smallest file
- `low` — Fast, natural enough for conversation
- `medium` — Recommended for regular use
- `high` — Best quality, slower synthesis

---

## Download Any Voice

### Using the Hugging Face URL pattern

```
https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/{lang}/{lang_region}/{name}/{quality}/{lang_region}-{name}-{quality}.onnx
```

Always download both `.onnx` and `.onnx.json`:

```bash
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
VOICE="de/de_DE/stefanie/medium/de_DE-stefanie-medium"

curl -L -o voices/${VOICE##*/}.onnx "${BASE}/${VOICE}.onnx"
curl -L -o voices/${VOICE##*/}.onnx.json "${BASE}/${VOICE}.onnx.json"
```

### Using piper directly (auto-download)

```bash
echo "Test" | .venv/bin/python -m piper \
  --model de_DE-kerstin-low \   # piper downloads if not found in voices/
  --download-dir voices/ \
  --output_file /tmp/test.wav
```

---

## Switching Voices

Edit `.env` and restart:

```env
PIPER_VOICE=./voices/de_DE-stefanie-medium.onnx
```

The voice file must exist in `voices/` with its matching `.onnx.json` config file.

---

## Free Cloud Alternative: Edge TTS

If you don't want to download voice files, Microsoft Edge TTS provides high-quality
neural voices for free (requires internet per synthesis):

```bash
uv pip install edge-tts
```

```env
TTS_PROVIDER=edge
```

Available German Edge TTS voices:
- `de-DE-KatjaNeural` (female, warm) — used by default in `edge.ts`
- `de-DE-ConradNeural` (male, clear)
- `de-DE-AmalaNeural` (female, young)
- `de-DE-BerndNeural` (male, deep)
- `de-DE-ChristophNeural` (male, professional)
- `de-DE-ElkeNeural` (female, natural)
- `de-DE-GiselaNeural` (female, child)
- `de-DE-KlausNeural` (male, authoritative)
- `de-DE-LouisaNeural` (female, lively)

---

## Verifying a Voice

Always test after downloading:

```bash
echo "Hallo! Mein Name ist Lina. Wie heißen Sie?" | \
  .venv/bin/python -m piper \
    --model voices/de_DE-kerstin-low.onnx \
    --output_file /tmp/lina_test.wav && \
  afplay /tmp/lina_test.wav
```

You should hear a clear female German voice.
