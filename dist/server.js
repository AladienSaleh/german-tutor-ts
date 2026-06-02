import Fastify from 'fastify';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import { existsSync } from 'fs';
import { config } from './config.js';
import { llmSettings, saveLlmSettings } from './llm-settings.js';
import { listScenarios, loadScenario } from './scenarios.js';
import { handleSession } from './session.js';
import { streamStudyChat, quickTranslate, generateTitle } from './study.js';
import { createSTTProvider } from './providers/stt/index.js';
import { createMainLLM, createCorrectorLLM } from './providers/llm/index.js';
import { createTTSProvider } from './providers/tts/index.js';
const app = Fastify({ logger: { level: 'warn' }, bodyLimit: 20 * 1024 * 1024 }); // 20 MB for image payloads
await app.register(fastifyCors, { origin: true });
await app.register(fastifyWs);
// ── Boot providers ────────────────────────────────────────────────────────────
console.log(`[Boot] STT=${config.stt.provider}  LLM=${llmSettings.provider}/${llmSettings.model}  TTS=${config.tts.provider}`);
const stt = await createSTTProvider();
const tts = createTTSProvider();
let llm = createMainLLM();
let corrector = createCorrectorLLM();
console.log('[Boot] Providers ready');
// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown() {
    console.log('[Boot] Shutting down…');
    stt.destroy?.();
    tts.destroy?.();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// ── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/scenarios', async () => ({ scenarios: listScenarios() }));
app.get('/api/config', async () => ({
    llm: { provider: llmSettings.provider, model: llmSettings.model },
    stt: { provider: config.stt.provider, model: config.stt.model },
    tts: { provider: config.tts.provider },
}));
app.get('/api/health', async () => ({ status: 'ok', uptime: process.uptime() }));
// ── LLM Model Listing ─────────────────────────────────────────────────────────
app.get('/api/llm/models', async (req) => {
    const q = req.query;
    const provider = q.provider ?? llmSettings.provider;
    if (provider === 'ollama') {
        const base = (q.baseUrl ?? llmSettings.ollamaBaseUrl).replace(/\/$/, '');
        const headers = {};
        const key = q.apiKey ?? llmSettings.ollamaApiKey;
        if (key)
            headers['Authorization'] = `Bearer ${key}`;
        const res = await fetch(`${base}/api/tags`, { headers });
        if (!res.ok)
            throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        return { models: (data.models ?? []).map((m) => m.name).sort() };
    }
    if (provider === 'lmstudio') {
        const base = (q.baseUrl ?? llmSettings.lmstudioBaseUrl).replace(/\/$/, '');
        const key = q.apiKey ?? llmSettings.lmstudioApiKey;
        const res = await fetch(`${base}/v1/models`, {
            headers: { 'Authorization': `Bearer ${key || 'lm-studio'}` },
        });
        if (!res.ok)
            throw new Error(`LM Studio HTTP ${res.status}`);
        const data = await res.json();
        return { models: (data.data ?? []).map((m) => m.id).sort() };
    }
    return { models: [] };
});
// ── LLM Settings ──────────────────────────────────────────────────────────────
app.get('/api/llm/settings', async () => llmSettings);
app.post('/api/llm/settings', async (req) => {
    const patch = req.body;
    const updated = saveLlmSettings(patch);
    llm = createMainLLM();
    corrector = createCorrectorLLM();
    console.log(`[LLM] Settings updated: provider=${updated.provider} model=${updated.model}`);
    return updated;
});
app.post('/api/study/chat', async (req, reply) => {
    const body = req.body;
    reply.hijack();
    const res = reply.raw;
    const origin = req.headers['origin'] ?? '*';
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.flushHeaders();
    const sse = (data) => res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
    try {
        for await (const event of streamStudyChat(body.history ?? [], body.userText ?? '', stt, body.imageBase64, body.imageMime, body.audioBase64, body.uploadedAudioBase64)) {
            sse(event);
        }
    }
    catch (err) {
        sse({ type: 'error', text: String(err) });
    }
    finally {
        sse('[DONE]');
        res.end();
    }
});
app.post('/api/study/title', async (req) => {
    const { messages } = req.body;
    const title = await generateTitle(messages ?? []);
    return { title };
});
app.post('/api/study/translate', async (req) => {
    const { text, targetLang } = req.body;
    const translation = await quickTranslate(text.slice(0, 500), targetLang ?? 'ar');
    return { translation };
});
// ── WebSocket ─────────────────────────────────────────────────────────────────
// Registered directly on app (not scoped) and BEFORE static so the wildcard
// route from @fastify/static never intercepts upgrade requests.
app.get('/ws/chat/:scenarioId', { websocket: true }, async (ws, req) => {
    const { scenarioId } = req.params;
    try {
        loadScenario(scenarioId);
    }
    catch {
        ws.send(JSON.stringify({ type: 'error', text: `Unknown scenario: ${scenarioId}` }));
        ws.close();
        return;
    }
    console.log(`[WS] New session: scenario=${scenarioId}`);
    await handleSession(ws, scenarioId, stt, llm, corrector, tts);
    console.log(`[WS] Session ended: scenario=${scenarioId}`);
});
// ── Static frontend ───────────────────────────────────────────────────────────
// wildcard:false — only serve files that exist; never catch /api/* or /ws/*
if (existsSync(config.frontendDist)) {
    await app.register(fastifyStatic, {
        root: config.frontendDist,
        prefix: '/',
        wildcard: false,
    });
    // SPA fallback: all unmatched routes serve index.html
    app.setNotFoundHandler(async (_req, reply) => {
        return reply.sendFile('index.html');
    });
}
else {
    console.warn('[Boot] Frontend dist not found — run: cd frontend && npm run build');
}
// ── Start ─────────────────────────────────────────────────────────────────────
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`[Boot] Listening on http://localhost:${config.port}`);
//# sourceMappingURL=server.js.map