import { CORRECTOR_PROMPT } from './config.js';
const SENTENCE_RE = /([.!?\n]+)/;
async function* splitSentences(gen) {
    let buf = '';
    for await (const chunk of gen) {
        buf += chunk;
        const parts = buf.split(SENTENCE_RE);
        // parts alternates: text, delimiter, text, delimiter, ...last is leftover
        while (parts.length >= 3) {
            const sentence = (parts.shift() + (parts.shift() ?? '')).trim();
            if (sentence)
                yield sentence;
        }
        buf = parts[0] ?? '';
    }
    if (buf.trim())
        yield buf.trim();
}
export class TutorBrain {
    llm;
    corrector;
    tts;
    history;
    constructor(llm, corrector, tts, systemPrompt, scenarioPlan) {
        this.llm = llm;
        this.corrector = corrector;
        this.tts = tts;
        this.history = [{ role: 'system', content: `${systemPrompt}\n\n${scenarioPlan}` }];
    }
    async *openingTurn() {
        yield* this.streamReply('[START: begin the lesson with point 1]', false);
    }
    async *userTurn(transcript, lang, sttMs) {
        yield { type: 'transcript', text: transcript, lang };
        // Fire correction check in parallel — does NOT block the reply stream
        const correctionPromise = this.checkCorrection(transcript);
        // Push user message and start reply immediately
        this.history.push({ role: 'user', content: transcript });
        yield* this.streamReply(null, true, sttMs, correctionPromise);
    }
    async checkCorrection(userText) {
        try {
            const result = await this.corrector.complete([
                { role: 'system', content: CORRECTOR_PROMPT },
                { role: 'user', content: `Student said: ${userText}` },
            ]);
            return result.toUpperCase().includes('OK') ? null : result;
        }
        catch {
            return null;
        }
    }
    async *streamReply(seedMessage, fromUser, sttMs = 0, correctionPromise) {
        if (seedMessage) {
            this.history.push({ role: 'user', content: seedMessage });
        }
        const ttsStart = Date.now();
        let ttsTotal = 0;
        let fullReply = '';
        const replyGen = splitSentences(this.llm.stream(this.history));
        for await (const sentence of replyGen) {
            fullReply += sentence + ' ';
            yield { type: 'reply_text', text: sentence };
            const t0 = Date.now();
            try {
                const audio = await this.tts.synthesize(sentence);
                ttsTotal += Date.now() - t0;
                if (audio)
                    yield { type: 'audio', data: audio.toString('base64') };
            }
            catch (err) {
                console.error('[Brain] TTS error:', err);
            }
        }
        this.history.push({ role: 'assistant', content: fullReply.trim() });
        if (fromUser) {
            yield { type: 'timing', timing: { sttMs, ttsMs: ttsTotal } };
            // Emit correction now — parallel check is likely already done
            if (correctionPromise) {
                const correction = await correctionPromise;
                if (correction)
                    yield { type: 'correction', text: correction };
            }
        }
        yield { type: 'turn_end' };
    }
    get conversationHistory() {
        return this.history;
    }
}
//# sourceMappingURL=brain.js.map