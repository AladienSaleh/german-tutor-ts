import { spawn } from 'child_process';
import { unlinkSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { config } from '../../config.js';
// Matches the original Python project exactly:
// spawn piper with --output_file <tmpfile>, read the file, delete it.
// Using a real file (not /dev/stdout) ensures piper can seek back
// to finalise the WAV header with correct size fields.
export class PiperTTS {
    async synthesize(text) {
        if (!text.trim())
            return null;
        const tmpFile = join(tmpdir(), `piper_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);
        return new Promise((resolve, reject) => {
            const parts = config.pythonBin.trim().split(/\s+/);
            const proc = spawn(parts[0], [...parts.slice(1), '-m', 'piper',
                '--model', config.tts.piperVoice,
                '--output_file', tmpFile], { stdio: ['pipe', 'pipe', 'pipe'] });
            proc.stderr.on('data', () => { });
            const timer = setTimeout(() => {
                proc.kill();
                if (existsSync(tmpFile))
                    unlinkSync(tmpFile);
                reject(new Error('[TTS] Piper timeout'));
            }, 15_000);
            proc.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0 && existsSync(tmpFile)) {
                    try {
                        const data = readFileSync(tmpFile);
                        unlinkSync(tmpFile);
                        resolve(data);
                    }
                    catch (err) {
                        reject(err);
                    }
                }
                else {
                    if (existsSync(tmpFile))
                        unlinkSync(tmpFile);
                    reject(new Error(`[TTS] Piper exited ${code}`));
                }
            });
            proc.on('error', (err) => {
                clearTimeout(timer);
                if (existsSync(tmpFile))
                    unlinkSync(tmpFile);
                reject(err);
            });
            // Send text to piper — same as original: proc.communicate(input=text.encode())
            proc.stdin.end(text.trim());
        });
    }
}
//# sourceMappingURL=piper.js.map