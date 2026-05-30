import { spawn } from 'child_process';

export const SAMPLE_RATE = 16000;
export const MIN_AUDIO_SEC = 0.4;

export function decodeWebmToPcm(webmBytes: Buffer): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const proc = spawn('ffmpeg', [
      '-i', 'pipe:0', '-f', 'f32le', '-acodec', 'pcm_f32le',
      '-ar', String(SAMPLE_RATE), '-ac', '1', 'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.on('close', (code) => resolve(code === 0 ? Buffer.concat(chunks) : Buffer.alloc(0)));
    proc.on('error', () => resolve(Buffer.alloc(0)));
    proc.stdin.end(webmBytes);
  });
}

export function normalizeF32(buf: Buffer): Buffer {
  if (buf.byteLength === 0) return buf;
  const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  let peak = 0;
  for (let i = 0; i < arr.length; i++) {
    const abs = Math.abs(arr[i]);
    if (abs > peak) peak = abs;
  }
  if (peak < 1e-4) return buf;
  const scale = 0.9 / peak;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] * scale;
  return Buffer.from(out.buffer);
}

export function padF32(buf: Buffer, minSeconds = 1.0): Buffer {
  const minBytes = Math.floor(minSeconds * SAMPLE_RATE) * 4;
  if (buf.byteLength >= minBytes) return buf;
  const padded = Buffer.alloc(minBytes, 0);
  buf.copy(padded);
  return padded;
}

export function durationSec(buf: Buffer): number {
  return (buf.byteLength / 4) / SAMPLE_RATE;
}
