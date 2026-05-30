import { config } from '../../config.js';
import type { TTSProvider } from './interface.js';
import { PiperTTS } from './piper.js';
import { OpenAITTS } from './openai.js';
import { EdgeTTS } from './edge.js';

export type { TTSProvider };

export function createTTSProvider(): TTSProvider {
  switch (config.tts.provider) {
    case 'openai':   return new OpenAITTS();
    case 'edge':     return new EdgeTTS();
    case 'piper':
    default:         return new PiperTTS();
  }
}
