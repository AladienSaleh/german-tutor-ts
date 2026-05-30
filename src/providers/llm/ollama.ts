import type { LLMProvider, Message } from './interface.js';
import { config } from '../../config.js';

async function* streamLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n');
      buf = parts.pop() ?? '';
      for (const line of parts) if (line.trim()) yield line;
    }
    if (buf.trim()) yield buf;
  } finally {
    reader.releaseLock();
  }
}

export class OllamaLLM implements LLMProvider {
  constructor(private readonly model: string) {}

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const res = await fetch(config.llm.ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        think: false,
        options: { num_predict: 150, temperature: 0.7, keep_alive: -1 },
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama HTTP ${res.status}`);

    for await (const line of streamLines(res.body)) {
      try {
        const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        if (chunk.message?.content) yield chunk.message.content;
        if (chunk.done) break;
      } catch { /* skip malformed */ }
    }
  }

  async complete(messages: Message[]): Promise<string> {
    const res = await fetch(config.llm.ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        think: false,
        options: { num_predict: 80, temperature: 0.3, keep_alive: -1 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as { message: { content: string } };
    return data.message.content.trim();
  }
}
