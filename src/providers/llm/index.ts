import { llmSettings } from '../../llm-settings.js';
import type { LLMProvider } from './interface.js';
import { OllamaLLM } from './ollama.js';
import { LMStudioLLM } from './lmstudio.js';

export type { LLMProvider };
export type { Message } from './interface.js';

export function createMainLLM(): LLMProvider {
  return createLLMProvider(llmSettings.model);
}

export function createCorrectorLLM(): LLMProvider {
  return createLLMProvider(llmSettings.correctorModel);
}

function createLLMProvider(model: string): LLMProvider {
  const s = llmSettings;
  switch (s.provider) {
    case 'lmstudio': return new LMStudioLLM(model, s.lmstudioBaseUrl, s.lmstudioApiKey);
    default:         return new OllamaLLM(model, s.ollamaBaseUrl, s.ollamaApiKey);
  }
}
