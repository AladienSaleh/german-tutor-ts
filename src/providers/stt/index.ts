import { config } from '../../config.js';
import type { STTProvider } from './interface.js';

export type { STTProvider };
export type { TranscriptResult } from './interface.js';

export async function createSTTProvider(): Promise<STTProvider> {
  switch (config.stt.provider) {
    case 'groq': {
      const { GroqSTT } = await import('./groq.js');
      return new GroqSTT();
    }
    case 'openai': {
      const { OpenAISTT } = await import('./openai.js');
      return new OpenAISTT();
    }
    case 'local':
    default: {
      const { LocalSTT } = await import('./local.js');
      const stt = new LocalSTT();
      await stt.start();
      return stt;
    }
  }
}
