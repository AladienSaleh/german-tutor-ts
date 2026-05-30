import type { LLMProvider, Message } from './interface.js';
import { config } from '../../config.js';

export class GroqLLM implements LLMProvider {
  private async client() {
    const { Groq } = await import('groq-sdk');
    return new Groq({ apiKey: config.apiKeys.groq });
  }

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const client = await this.client();
    const stream = await client.chat.completions.create({
      model: config.llm.groqModel,
      messages,
      stream: true,
      max_tokens: 150,
      temperature: 0.7,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  }

  async complete(messages: Message[]): Promise<string> {
    const client = await this.client();
    const res = await client.chat.completions.create({
      model: config.llm.groqModel,
      messages,
      stream: false,
      max_tokens: 80,
      temperature: 0.3,
    });
    return res.choices[0]?.message?.content?.trim() ?? '';
  }
}
