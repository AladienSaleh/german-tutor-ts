import type { STTProvider, TranscriptResult } from './interface.js';
import { config } from '../../config.js';

const LANG_NAMES: Record<string, string> = { de: 'German', en: 'English', ar: 'Arabic' };

export class GroqSTT implements STTProvider {
  async transcribe(pcm: Buffer): Promise<TranscriptResult> {
    const { Groq } = await import('groq-sdk');
    const client = new Groq({ apiKey: config.apiKeys.groq });

    // Groq needs a file-like object; wrap PCM in a minimal WAV
    const wav = pcmToWav(pcm);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const file = new File([blob], 'audio.wav', { type: 'audio/wav' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (client.audio.transcriptions as any).create({
      file,
      model: config.stt.groqModel,
      response_format: 'verbose_json',
    }) as { text: string; language?: string };

    const lang = result.language ?? 'de';
    return { text: result.text, language: LANG_NAMES[lang] ?? lang };
  }
}

function pcmToWav(pcm: Buffer): Buffer {
  const numChannels = 1;
  const sampleRate = 16000;
  const bitsPerSample = 32;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.byteLength;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}
