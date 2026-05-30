import { spawn } from 'child_process';
import type { TTSProvider } from './interface.js';

// Uses Microsoft Edge TTS via the edge-tts Python package (free, no API key).
// Install: pip install edge-tts
// Voice: de-DE-KatjaNeural (female) or de-DE-ConradNeural (male)
const VOICE = 'de-DE-KatjaNeural';

export class EdgeTTS implements TTSProvider {
  async synthesize(text: string): Promise<Buffer | null> {
    if (!text.trim()) return null;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const proc = spawn('edge-tts', [
        '--voice', VOICE,
        '--text', text,
        '--write-media', '/dev/stdout',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout!.on('data', (c: Buffer) => chunks.push(c));
      proc.on('close', (code) => {
        if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new Error(`edge-tts exited ${code}`));
      });
      proc.on('error', reject);
    });
  }
}
