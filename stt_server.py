#!/usr/bin/env python3
"""Persistent STT microservice — loads faster-whisper once, serves via HTTP."""
import os
import sys
import json
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler

MODEL_NAME = os.getenv("WHISPER_MODEL", "large-v3-turbo")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE", "int8")
PORT = int(os.getenv("STT_PORT", "5001"))
TARGET_LANGS = {"de", "en", "ar"}
LANG_NAMES = {"de": "German", "en": "English", "ar": "Arabic"}


def load_model():
    from faster_whisper import WhisperModel
    return WhisperModel(
        MODEL_NAME,
        device="cpu",
        compute_type=COMPUTE_TYPE,
        download_root=os.path.expanduser("~/.cache/huggingface/hub"),
        cpu_threads=8,
    )


print(f"[STT] Loading {MODEL_NAME} (compute={COMPUTE_TYPE})…", flush=True)
try:
    model = load_model()
except Exception as e:
    print(f"[STT] Failed to load model: {e}", file=sys.stderr, flush=True)
    sys.exit(1)

print(f"[STT] Ready on port {PORT}", flush=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):  # silence access logs
        pass

    def do_POST(self):
        if self.path != "/transcribe":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        audio = np.frombuffer(raw, dtype=np.float32)

        try:
            raw_lang, _, all_probs = model.detect_language(audio, vad_filter=True)
            filtered = {l: p for l, p in all_probs if l in TARGET_LANGS}
            if filtered:
                best = max(filtered, key=lambda k: filtered[k])
                best_prob = filtered[best]
                # Require ≥ 0.6 confidence to use a non-German language.
                # Whisper often misidentifies short German as Arabic at low confidence.
                if best_prob >= 0.6 or best == "de":
                    lang = best
                else:
                    lang = "de"
                print(f"[STT] {raw_lang} → filtered={best}({best_prob:.2f}) → using={lang}", flush=True)
            else:
                lang = "de"

            segments, _ = model.transcribe(
                audio,
                language=lang,
                task="transcribe",
                initial_prompt="German conversation",
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
                condition_on_previous_text=False,
            )
            text = " ".join(s.text for s in segments).strip()
            result = {"text": text, "language": LANG_NAMES.get(lang, lang)}
        except Exception as e:
            result = {"text": "", "language": "unknown", "error": str(e)}

        body = json.dumps(result).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
