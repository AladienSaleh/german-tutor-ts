export interface TTSProvider {
  synthesize(text: string): Promise<Buffer | null>;
  destroy?(): void;
}
