import { llmSettings } from '../../llm-settings.js';
import { OllamaLLM } from './ollama.js';
import { LMStudioLLM } from './lmstudio.js';
export function createMainLLM() {
    return createLLMProvider(llmSettings.model);
}
export function createCorrectorLLM() {
    return createLLMProvider(llmSettings.correctorModel);
}
function createLLMProvider(model) {
    const s = llmSettings;
    switch (s.provider) {
        case 'lmstudio': return new LMStudioLLM(model, s.lmstudioBaseUrl, s.lmstudioApiKey);
        default: return new OllamaLLM(model, s.ollamaBaseUrl, s.ollamaApiKey);
    }
}
//# sourceMappingURL=index.js.map