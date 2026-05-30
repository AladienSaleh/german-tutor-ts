export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMProvider {
  stream(messages: Message[]): AsyncGenerator<string>;
  complete(messages: Message[]): Promise<string>;
}
