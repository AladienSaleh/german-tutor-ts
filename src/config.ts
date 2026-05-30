import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function resolvePath(p: string): string {
  return p.startsWith('./') || p.startsWith('../') ? resolve(ROOT, p) : p;
}

// Shared Python binary used for both the STT sidecar and Piper TTS subprocess.
// Points to the project's .venv by default; override with PYTHON_BIN in .env.
const defaultPythonBin = join(ROOT, '.venv', 'bin', 'python');

export const config = {
  port: parseInt(process.env.PORT ?? '3000'),

  scenariosDir: join(ROOT, 'scenarios'),
  voicesDir: join(ROOT, 'voices'),
  dataDir: join(ROOT, 'data'),
  frontendDist: join(ROOT, 'frontend', 'dist'),
  pythonBin: process.env.PYTHON_BIN ?? defaultPythonBin,

  llm: {
    provider: (process.env.LLM_PROVIDER ?? 'ollama') as 'ollama' | 'openai' | 'groq' | 'anthropic',
    model: process.env.LLM_MODEL ?? 'gemma4:e2b',
    correctorModel: process.env.LLM_CORRECTOR_MODEL ?? 'granite4.1:3b',
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434/api/chat',
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiModel: process.env.OPENAI_LLM_MODEL ?? 'gpt-4o-mini',
    groqModel: process.env.GROQ_LLM_MODEL ?? 'llama-3.3-70b-versatile',
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
  },

  stt: {
    provider: (process.env.STT_PROVIDER ?? 'local') as 'local' | 'groq' | 'openai',
    model: process.env.STT_MODEL ?? 'large-v3-turbo',
    compute: process.env.STT_COMPUTE ?? 'int8',
    port: parseInt(process.env.STT_PORT ?? '5001'),
    groqModel: process.env.GROQ_STT_MODEL ?? 'whisper-large-v3-turbo',
  },

  tts: {
    provider: (process.env.TTS_PROVIDER ?? 'piper') as 'piper' | 'openai' | 'edge' | 'elevenlabs',
    piperVoice: resolvePath(process.env.PIPER_VOICE ?? join(ROOT, 'voices', 'de_DE-thorsten-medium.onnx')),
    openaiVoice: process.env.OPENAI_TTS_VOICE ?? 'alloy',
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? '',
  },

  apiKeys: {
    openai: process.env.OPENAI_API_KEY ?? '',
    groq: process.env.GROQ_API_KEY ?? '',
    anthropic: process.env.ANTHROPIC_API_KEY ?? '',
    elevenLabs: process.env.ELEVENLABS_API_KEY ?? '',
  },
} as const;

export const SYSTEM_PROMPT = `You are Lina, a warm, proactive German tutor.
The student is a native Arabic speaker who also knows English, learning German at A1–A2.

YOUR JOB — be the active partner:
1. YOU choose the topic and YOU drive the dialog forward.
2. After the student speaks, ALWAYS do this in order:
   a) React naturally to what they said (1 short sentence).
   b) If they made a grammar/word error, gently correct it as:
      "Sag besser: <correct sentence>" — keep it on one short line.
   c) Ask the NEXT specific question that moves the conversation forward.
3. NEVER ask vague questions like "Was möchten Sie üben?" or "Wie möchten wir fortfahren?"
   Ask CONCRETE questions: "Wo wohnst du?", "Was isst du zum Frühstück?", "Hast du Geschwister?"
4. If the student writes "Thank you" or "Okay" or stays silent, just continue with the NEXT
   lesson point — do NOT ask what they want to do.
5. If they're stuck, give them the German word/phrase to use, then ask again.

LANGUAGE RULES:
- Speak GERMAN by default, A1–A2 level (simple present, basic past, common 1000 words).
- If the student replies in Arabic or English, briefly say "Auf Deutsch sagt man: ..." then continue in German.
- Reply length: 2–3 short sentences MAX, under 30 words total.
- No emoji, no markdown, no lists.`;

export const CORRECTOR_PROMPT = `You are a German language corrector.
Analyze the student's German sentence for grammar, word choice, and word order.
- If there is an error, provide the corrected version starting with "Sag besser: ".
- Keep it to exactly one short line.
- If it is correct, return exactly "OK".
- Do not provide explanations.`;
