export interface TranscriptResult {
  text: string;
  language: string;
}

export interface STTProvider {
  transcribe(pcm: Buffer): Promise<TranscriptResult>;
  destroy?(): void;
}
