import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

const SETTINGS_FILE = join(config.dataDir, 'llm-settings.json');

export interface LlmSettings {
  provider: 'ollama' | 'lmstudio';
  model: string;
  correctorModel: string;
  ollamaBaseUrl: string;
  ollamaApiKey: string;
  lmstudioBaseUrl: string;
  lmstudioApiKey: string;
}

function defaults(): LlmSettings {
  const rawProvider = config.llm.provider;
  const provider: 'ollama' | 'lmstudio' =
    rawProvider === 'lmstudio' ? 'lmstudio' : 'ollama';
  return {
    provider,
    model: config.llm.model,
    correctorModel: config.llm.correctorModel,
    ollamaBaseUrl: config.llm.ollamaUrl.replace(/\/api\/chat$/, '') || 'http://localhost:11434',
    ollamaApiKey: '',
    lmstudioBaseUrl: config.llm.lmstudioBaseUrl,
    lmstudioApiKey: config.llm.lmstudioApiKey,
  };
}

function load(): LlmSettings {
  try {
    return { ...defaults(), ...JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')) as Partial<LlmSettings> };
  } catch {
    return defaults();
  }
}

export let llmSettings: LlmSettings = load();

export function saveLlmSettings(patch: Partial<LlmSettings>): LlmSettings {
  llmSettings = { ...llmSettings, ...patch };
  writeFileSync(SETTINGS_FILE, JSON.stringify(llmSettings, null, 2));
  return llmSettings;
}
