import { config } from './config.js';
import { decodeWebmToPcm, normalizeF32, padF32, durationSec, MIN_AUDIO_SEC } from './audio.js';
import type { STTProvider } from './providers/stt/interface.js';

export interface StudyMessage {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMime?: string;
}

export type StudyEvent =
  | { type: 'transcript'; text: string }
  | { type: 'token'; text: string }
  | { type: 'error'; text: string };

const STUDY_SYSTEM_PROMPT = `You are a smart multilingual study assistant helping an Arabic speaker learn German and understand academic content.

CAPABILITIES:
- Analyze images (textbook screenshots, course slides, notes, exercises, any content)
- Translate between Arabic (العربية), German (Deutsch), and English
- Explain German grammar rules clearly in Arabic
- Show pronunciation of German words using approximate Arabic phonetics
- Answer questions about any subject shown in images or asked in text

LANGUAGE RULES:
- User writes in Arabic → respond primarily in Arabic, include German terms where relevant
- User writes in German → respond in German with Arabic support if helpful
- User writes in English → respond in English
- For German vocabulary: show "German word = Arabic meaning (phonetic approximation)"
- For grammar rules: prefer Arabic explanations for maximum clarity
- Use **bold** for key terms, use bullet lists and examples for clarity
- Keep responses focused, structured, and educational`;

async function* streamWithAnthropic(messages: StudyMessage[]): AsyncGenerator<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: config.apiKeys.anthropic });

  // Build messages with optional image blocks
  const anthropicMsgs = messages.map(m => {
    if (m.role === 'user' && m.imageBase64) {
      return {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: (m.imageMime ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: m.imageBase64,
            },
          },
          {
            type: 'text' as const,
            text: m.content || 'ماذا يوجد في هذه الصورة؟ شرح المحتوى بالتفصيل.',
          },
        ],
      };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content };
  });

  const stream = await client.messages.create({
    model: config.llm.anthropicModel,
    max_tokens: 1024,
    system: STUDY_SYSTEM_PROMPT,
    messages: anthropicMsgs,
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

async function* streamWithOpenAI(messages: StudyMessage[]): AsyncGenerator<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: config.apiKeys.openai, baseURL: config.llm.openaiBaseUrl });

  const openaiMsgs = messages.map(m => {
    if (m.role === 'user' && m.imageBase64) {
      return {
        role: 'user' as const,
        content: [
          {
            type: 'image_url' as const,
            image_url: { url: `data:${m.imageMime ?? 'image/jpeg'};base64,${m.imageBase64}` },
          },
          { type: 'text' as const, text: m.content || 'What does this show? Explain it in detail.' },
        ],
      };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content };
  });

  const stream = await client.chat.completions.create({
    model: config.llm.openaiModel,
    max_tokens: 1024,
    messages: [{ role: 'system', content: STUDY_SYSTEM_PROMPT }, ...openaiMsgs],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

async function* streamWithFallback(messages: StudyMessage[]): AsyncGenerator<string> {
  const { createMainLLM } = await import('./providers/llm/index.js');
  const llm = createMainLLM();
  const llmMsgs = [
    { role: 'system' as const, content: STUDY_SYSTEM_PROMPT },
    ...messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.imageBase64
        ? `[Image was attached but vision is not supported with this LLM provider]\n${m.content}`
        : m.content,
    })),
  ];
  yield* llm.stream(llmMsgs);
}

export async function* streamStudyChat(
  history: StudyMessage[],
  userText: string,
  stt: STTProvider,
  imageBase64?: string,
  imageMime?: string,
  audioBase64?: string,
): AsyncGenerator<StudyEvent> {
  let finalText = userText.trim();

  // Transcribe audio if provided
  if (audioBase64) {
    try {
      const webm = Buffer.from(audioBase64, 'base64');
      let pcm = await decodeWebmToPcm(webm);
      if (pcm.byteLength > 0 && durationSec(pcm) >= MIN_AUDIO_SEC) {
        pcm = normalizeF32(pcm);
        pcm = padF32(pcm);
        const { text } = await stt.transcribe(pcm);
        if (text.trim()) {
          finalText = text.trim();
          yield { type: 'transcript', text: finalText };
        }
      }
    } catch (err) {
      console.error('[Study] STT error:', err);
    }
  }

  if (!finalText && !imageBase64) return;

  const messages: StudyMessage[] = [
    ...history,
    { role: 'user', content: finalText, imageBase64, imageMime },
  ];

  const generator = config.apiKeys.anthropic
    ? streamWithAnthropic(messages)
    : config.apiKeys.openai
    ? streamWithOpenAI(messages)
    : streamWithFallback(messages);

  for await (const token of generator) {
    yield { type: 'token', text: token };
  }
}
