import type { STTProvider, TranscriptResult } from './interface.js';
import { config } from '../../config.js';

const LANG_NAMES: Record<string, string> = { de: 'German', en: 'English', ar: 'Arabic' };

export class OpenAISTT implements STTProvider {
  async transcribe(pcm: Buffer): Promise<TranscriptResult> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: config.apiKeys.openai, baseURL: config.llm.openaiBaseUrl });

    const blob = new Blob([pcm], { type: 'audio/wav' });
    const file = new File([blob], 'audio.wav', { type: 'audio/wav' });

    const result = await client.audio.transcriptions.create({
      file: file as unknown as Parameters<typeof client.audio.transcriptions.create>[0]['file'],
      model: 'whisper-1',
      response_format: 'verbose_json',
    });

    const lang = (result as unknown as { language?: string }).language ?? 'de';
    return { text: result.text, language: LANG_NAMES[lang] ?? lang };
  }
}
