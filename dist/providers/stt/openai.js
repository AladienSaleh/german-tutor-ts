import { config } from '../../config.js';
const LANG_NAMES = { de: 'German', en: 'English', ar: 'Arabic' };
export class OpenAISTT {
    async transcribe(pcm) {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: config.apiKeys.openai, baseURL: config.llm.openaiBaseUrl });
        const blob = new Blob([pcm], { type: 'audio/wav' });
        const file = new File([blob], 'audio.wav', { type: 'audio/wav' });
        const result = await client.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            response_format: 'verbose_json',
        });
        const lang = result.language ?? 'de';
        return { text: result.text, language: LANG_NAMES[lang] ?? lang };
    }
}
//# sourceMappingURL=openai.js.map