import type { TTSProvider } from './interface.js';
import { config } from '../../config.js';

export class OpenAITTS implements TTSProvider {
  async synthesize(text: string): Promise<Buffer | null> {
    if (!text.trim()) return null;

    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: config.apiKeys.openai });

    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice: config.tts.openaiVoice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
      input: text,
      response_format: 'wav',
    });

    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  }
}
