import { config } from '../../config.js';
export class OpenAITTS {
    async synthesize(text) {
        if (!text.trim())
            return null;
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: config.apiKeys.openai });
        const response = await client.audio.speech.create({
            model: 'tts-1',
            voice: config.tts.openaiVoice,
            input: text,
            response_format: 'wav',
        });
        const arrayBuf = await response.arrayBuffer();
        return Buffer.from(arrayBuf);
    }
}
//# sourceMappingURL=openai.js.map