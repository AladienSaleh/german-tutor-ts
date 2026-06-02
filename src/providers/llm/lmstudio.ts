import type { LLMProvider, Message } from './interface.js';

export class LMStudioLLM implements LLMProvider {
  private readonly chatUrl: string;

  constructor(
    private readonly model: string,
    baseUrl: string = 'http://localhost:1234',
    private readonly apiKey: string = '',
  ) {
    this.chatUrl = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  }

  private get authHeader(): string {
    return `Bearer ${this.apiKey || 'lm-studio'}`;
  }

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const res = await fetch(this.chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': this.authHeader },
      body: JSON.stringify({ model: this.model, messages, stream: true, max_tokens: 150, temperature: 0.7 }),
    });
    if (!res.ok || !res.body) throw new Error(`LM Studio HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          try {
            const chunk = JSON.parse(trimmed.replace(/^data: /, '')) as {
              choices?: [{ delta?: { content?: string } }];
            };
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) yield text;
          } catch { /* skip malformed */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async complete(messages: Message[]): Promise<string> {
    const res = await fetch(this.chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': this.authHeader },
      body: JSON.stringify({ model: this.model, messages, stream: false, max_tokens: 80, temperature: 0.3 }),
    });
    if (!res.ok) throw new Error(`LM Studio HTTP ${res.status}`);
    const data = await res.json() as { choices: [{ message: { content: string } }] };
    return data.choices[0]?.message?.content?.trim() ?? '';
  }
}
