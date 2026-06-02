import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';
const SETTINGS_FILE = join(config.dataDir, 'llm-settings.json');
function defaults() {
    const rawProvider = config.llm.provider;
    const provider = rawProvider === 'lmstudio' ? 'lmstudio' : 'ollama';
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
function load() {
    try {
        return { ...defaults(), ...JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')) };
    }
    catch {
        return defaults();
    }
}
export let llmSettings = load();
export function saveLlmSettings(patch) {
    llmSettings = { ...llmSettings, ...patch };
    writeFileSync(SETTINGS_FILE, JSON.stringify(llmSettings, null, 2));
    return llmSettings;
}
//# sourceMappingURL=llm-settings.js.map