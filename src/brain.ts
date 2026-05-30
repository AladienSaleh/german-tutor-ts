import type { Message } from './providers/llm/interface.js';
import type { LLMProvider } from './providers/llm/index.js';
import type { TTSProvider } from './providers/tts/index.js';
import { CORRECTOR_PROMPT } from './config.js';

export interface WsMessage {
  type: 'transcript' | 'reply_text' | 'audio' | 'correction' | 'turn_end' | 'error' | 'timing';
  text?: string;
  lang?: string;
  data?: string;
  timing?: { sttMs: number; ttsMs: number };
}

const SENTENCE_RE = /([.!?\n]+)/;

async function* splitSentences(gen: AsyncGenerator<string>): AsyncGenerator<string> {
  let buf = '';
  for await (const chunk of gen) {
    buf += chunk;
    const parts = buf.split(SENTENCE_RE);
    // parts alternates: text, delimiter, text, delimiter, ...last is leftover
    while (parts.length >= 3) {
      const sentence = (parts.shift()! + (parts.shift() ?? '')).trim();
      if (sentence) yield sentence;
    }
    buf = parts[0] ?? '';
  }
  if (buf.trim()) yield buf.trim();
}

export class TutorBrain {
  private history: Message[];

  constructor(
    private readonly llm: LLMProvider,
    private readonly corrector: LLMProvider,
    private readonly tts: TTSProvider,
    systemPrompt: string,
    scenarioPlan: string,
  ) {
    this.history = [{ role: 'system', content: `${systemPrompt}\n\n${scenarioPlan}` }];
  }

  async *openingTurn(): AsyncGenerator<WsMessage> {
    yield* this.streamReply('[START: begin the lesson with point 1]', false);
  }

  async *userTurn(transcript: string, lang: string, sttMs: number): AsyncGenerator<WsMessage> {
    yield { type: 'transcript', text: transcript, lang };

    // Fire correction check in parallel — does NOT block the reply stream
    const correctionPromise = this.checkCorrection(transcript);

    // Push user message and start reply immediately
    this.history.push({ role: 'user', content: transcript });
    yield* this.streamReply(null, true, sttMs, correctionPromise);
  }

  private async checkCorrection(userText: string): Promise<string | null> {
    try {
      const result = await this.corrector.complete([
        { role: 'system', content: CORRECTOR_PROMPT },
        { role: 'user', content: `Student said: ${userText}` },
      ]);
      return result.toUpperCase().includes('OK') ? null : result;
    } catch {
      return null;
    }
  }

  private async *streamReply(
    seedMessage: string | null,
    fromUser: boolean,
    sttMs = 0,
    correctionPromise?: Promise<string | null>,
  ): AsyncGenerator<WsMessage> {
    if (seedMessage) {
      this.history.push({ role: 'user', content: seedMessage });
    }

    const ttsStart = Date.now();
    let ttsTotal = 0;
    let fullReply = '';

    const replyGen = splitSentences(this.llm.stream(this.history));

    for await (const sentence of replyGen) {
      fullReply += sentence + ' ';
      yield { type: 'reply_text', text: sentence };

      const t0 = Date.now();
      try {
        const audio = await this.tts.synthesize(sentence);
        ttsTotal += Date.now() - t0;
        if (audio) yield { type: 'audio', data: audio.toString('base64') };
      } catch (err) {
        console.error('[Brain] TTS error:', err);
      }
    }

    this.history.push({ role: 'assistant', content: fullReply.trim() });

    if (fromUser) {
      yield { type: 'timing', timing: { sttMs, ttsMs: ttsTotal } };

      // Emit correction now — parallel check is likely already done
      if (correctionPromise) {
        const correction = await correctionPromise;
        if (correction) yield { type: 'correction', text: correction };
      }
    }

    yield { type: 'turn_end' };
  }

  get conversationHistory(): Message[] {
    return this.history;
  }
}
