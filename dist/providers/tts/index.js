import { config } from '../../config.js';
import { PiperTTS } from './piper.js';
import { OpenAITTS } from './openai.js';
import { EdgeTTS } from './edge.js';
export function createTTSProvider() {
    switch (config.tts.provider) {
        case 'openai': return new OpenAITTS();
        case 'edge': return new EdgeTTS();
        case 'piper':
        default: return new PiperTTS();
    }
}
//# sourceMappingURL=index.js.map