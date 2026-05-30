import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { STTProvider, TranscriptResult } from './interface.js';
import { config } from '../../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIDECAR = join(__dirname, '..', '..', '..', 'stt_server.py');

export class LocalSTT implements STTProvider {
  private proc: ChildProcess | null = null;
  private ready = false;
  private readonly url: string;

  constructor() {
    this.url = `http://127.0.0.1:${config.stt.port}/transcribe`;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        WHISPER_MODEL: config.stt.model,
        WHISPER_COMPUTE: config.stt.compute,
        STT_PORT: String(config.stt.port),
      };

      // config.pythonBin may be a command with args
      const parts = config.pythonBin.trim().split(/\s+/);
      const cmd = parts[0];
      const args = [...parts.slice(1), SIDECAR];
      this.proc = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });

      const timeout = setTimeout(() => reject(new Error('[STT] Sidecar startup timeout')), 60_000);

      this.proc.stdout!.on('data', (chunk: Buffer) => {
        const line = chunk.toString();
        process.stdout.write(`[STT sidecar] ${line}`);
        if (line.includes('Ready on port')) {
          clearTimeout(timeout);
          this.ready = true;
          resolve();
        }
      });

      this.proc.stderr!.on('data', (chunk: Buffer) => {
        process.stderr.write(`[STT sidecar] ${chunk}`);
      });

      this.proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
      this.proc.on('exit', (code) => {
        this.ready = false;
        if (code !== 0 && code !== null) {
          console.error(`[STT] Sidecar exited with code ${code}`);
        }
      });
    });
  }

  async transcribe(pcm: Buffer): Promise<TranscriptResult> {
    if (!this.ready) throw new Error('[STT] Sidecar not ready');

    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(pcm.byteLength) },
      body: pcm,
    });

    if (!res.ok) throw new Error(`[STT] Sidecar HTTP ${res.status}`);
    return res.json() as Promise<TranscriptResult>;
  }

  destroy() {
    this.proc?.kill();
    this.proc = null;
    this.ready = false;
  }
}
