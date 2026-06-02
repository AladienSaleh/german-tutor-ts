import { config } from '../../config.js';
export class OpenAILLM {
    async client() {
        const OpenAI = (await import('openai')).default;
        return new OpenAI({ apiKey: config.apiKeys.openai, baseURL: config.llm.openaiBaseUrl });
    }
    async *stream(messages) {
        const client = await this.client();
        const stream = await client.chat.completions.create({
            model: config.llm.openaiModel,
            messages,
            stream: true,
            max_tokens: 150,
            temperature: 0.7,
        });
        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text)
                yield text;
        }
    }
    async complete(messages) {
        const client = await this.client();
        const res = await client.chat.completions.create({
            model: config.llm.openaiModel,
            messages,
            stream: false,
            max_tokens: 80,
            temperature: 0.3,
        });
        return res.choices[0]?.message?.content?.trim() ?? '';
    }
}
//# sourceMappingURL=openai.js.map