async function* streamLines(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n');
            buf = parts.pop() ?? '';
            for (const line of parts)
                if (line.trim())
                    yield line;
        }
        if (buf.trim())
            yield buf;
    }
    finally {
        reader.releaseLock();
    }
}
export class OllamaLLM {
    model;
    apiKey;
    chatUrl;
    constructor(model, baseUrl = 'http://localhost:11434', apiKey = '') {
        this.model = model;
        this.apiKey = apiKey;
        this.chatUrl = `${baseUrl.replace(/\/$/, '')}/api/chat`;
    }
    headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.apiKey)
            h['Authorization'] = `Bearer ${this.apiKey}`;
        return h;
    }
    async *stream(messages) {
        const res = await fetch(this.chatUrl, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                model: this.model,
                messages,
                stream: true,
                think: false,
                options: { num_predict: 150, temperature: 0.7, keep_alive: -1 },
            }),
        });
        if (!res.ok || !res.body)
            throw new Error(`Ollama HTTP ${res.status}`);
        for await (const line of streamLines(res.body)) {
            try {
                const chunk = JSON.parse(line);
                if (chunk.message?.content)
                    yield chunk.message.content;
                if (chunk.done)
                    break;
            }
            catch { /* skip malformed */ }
        }
    }
    async complete(messages) {
        const res = await fetch(this.chatUrl, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                model: this.model,
                messages,
                stream: false,
                think: false,
                options: { num_predict: 80, temperature: 0.3, keep_alive: -1 },
            }),
        });
        if (!res.ok)
            throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        return data.message.content.trim();
    }
}
//# sourceMappingURL=ollama.js.map