import { config } from '../../config.js';
export async function createSTTProvider() {
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
//# sourceMappingURL=index.js.map