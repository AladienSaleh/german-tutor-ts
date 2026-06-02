import { config } from '../../config.js';
export class AnthropicLLM {
    async client() {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        return new Anthropic({ apiKey: config.apiKeys.anthropic });
    }
    toAnthropicMessages(messages) {
        const system = messages.find(m => m.role === 'system')?.content ?? '';
        const rest = messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content }));
        return { system, messages: rest };
    }
    async *stream(messages) {
        const client = await this.client();
        const { system, messages: msgs } = this.toAnthropicMessages(messages);
        const stream = await client.messages.create({
            model: config.llm.anthropicModel,
            max_tokens: 150,
            system,
            messages: msgs,
            stream: true,
        });
        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                yield event.delta.text;
            }
        }
    }
    async complete(messages) {
        const client = await this.client();
        const { system, messages: msgs } = this.toAnthropicMessages(messages);
        const res = await client.messages.create({
            model: config.llm.anthropicModel,
            max_tokens: 80,
            system,
            messages: msgs,
        });
        return res.content[0].text.trim();
    }
}
//# sourceMappingURL=anthropic.js.map