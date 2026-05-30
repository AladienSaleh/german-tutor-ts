import { config } from '../../config.js';
import type { LLMProvider } from './interface.js';
import { OllamaLLM } from './ollama.js';

export type { LLMProvider };
export type { Message } from './interface.js';

export function createMainLLM(): LLMProvider {
  return createLLMProvider(config.llm.model);
}

export function createCorrectorLLM(): LLMProvider {
  if (config.llm.provider === 'ollama') {
    return new OllamaLLM(config.llm.correctorModel);
  }
  return createLLMProvider(config.llm.model);
}

function createLLMProvider(model: string): LLMProvider {
  switch (config.llm.provider) {
    case 'ollama': return new OllamaLLM(model);
    default: return new OllamaLLM(model);
  }
}
