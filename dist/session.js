import { decodeWebmToPcm, normalizeF32, padF32, durationSec, MIN_AUDIO_SEC } from './audio.js';
import { TutorBrain } from './brain.js';
import { loadScenario, scenarioPlanText } from './scenarios.js';
import { Session } from './persistence.js';
import { SYSTEM_PROMPT } from './config.js';
// @fastify/websocket uses an event-based socket, not an async iterable.
// This adapter wraps it so session logic can use `for await`.
async function* wsMessages(ws) {
    const queue = [];
    let resolver = null;
    let closed = false;
    ws.on('message', (data) => {
        queue.push(Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
        resolver?.();
        resolver = null;
    });
    const close = () => {
        closed = true;
        resolver?.();
        resolver = null;
    };
    ws.on('close', close);
    ws.on('error', close);
    while (!closed || queue.length > 0) {
        if (queue.length === 0) {
            await new Promise(r => { resolver = r; });
        }
        if (queue.length > 0)
            yield queue.shift();
    }
}
export async function handleSession(ws, scenarioId, stt, llm, corrector, tts) {
    const scenario = loadScenario(scenarioId);
    const brain = new TutorBrain(llm, corrector, tts, SYSTEM_PROMPT, scenarioPlanText(scenario));
    const dbSession = new Session(scenarioId);
    function send(msg) {
        try {
            ws.send(JSON.stringify(msg));
        }
        catch { /* WS closed */ }
    }
    async function flush(gen) {
        for await (const msg of gen)
            send(msg);
    }
    try {
        await flush(brain.openingTurn());
        for await (const raw of wsMessages(ws)) {
            const msg = JSON.parse(raw.toString());
            if (msg.type !== 'audio' || !msg.data)
                continue;
            const webm = Buffer.from(msg.data, 'base64');
            const t0 = Date.now();
            let pcm = await decodeWebmToPcm(webm);
            if (pcm.byteLength === 0) {
                send({ type: 'error', text: 'Audio decode failed' });
                continue;
            }
            if (durationSec(pcm) < MIN_AUDIO_SEC)
                continue;
            pcm = normalizeF32(pcm);
            pcm = padF32(pcm);
            const { text, language } = await stt.transcribe(pcm);
            const sttMs = Date.now() - t0;
            if (!text)
                continue;
            console.log(`[Session] STT (${sttMs}ms): "${text}" [${language}]`);
            dbSession.logTurn('user', text, undefined, { sttMs });
            await flush(brain.userTurn(text, language, sttMs));
            const lastAssistant = brain.conversationHistory.filter(m => m.role === 'assistant').at(-1);
            if (lastAssistant)
                dbSession.logTurn('assistant', lastAssistant.content);
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('WebSocket') && !msg.includes('1005') && !msg.includes('1000')) {
            console.error('[Session] Unexpected error:', err);
        }
    }
    finally {
        dbSession.close();
    }
}
//# sourceMappingURL=session.js.map