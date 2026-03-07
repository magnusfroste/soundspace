import { LucideIcon } from "lucide-react";

export type ProviderStatus = "ready" | "configuring" | "unavailable" | "coming_soon";

export type AceStepTaskType = "text2music" | "cover" | "repaint" | "lego" | "extract" | "complete";

export interface GenerateOptions {
  prompt: string;
  duration: number;
  genre?: string;
  mood?: string;
  lyrics?: string;
  /** ACE-Step specific */
  taskType?: AceStepTaskType;
  sourceAudioBlob?: Blob;
  referenceAudioBlob?: Blob;
  repaintStart?: number;
  repaintEnd?: number;
  coverStrength?: number;
  /** Musical control params */
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  /** Batch generation — number of variations (1-4) */
  batchSize?: number;
}

export interface GenerationResult {
  audioBlob: Blob;
  audioUrl: string;
  lyrics?: string;
  qualityScore?: number;
  metadata: {
    provider: string;
    prompt: string;
    duration: number;
    genre?: string;
    mood?: string;
    bpm?: number;
    keyScale?: string;
    timeSignature?: string;
    vocalLanguage?: string;
  };
}

/** Multiple variations from a single generation request */
export interface BatchGenerationResult {
  variations: GenerationResult[];
  selectedIndex: number;
}

export interface ProviderConfig {
  endpointUrl?: string;
  model?: string;
  apiKey?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: ProviderStatus;
  
  generate(options: GenerateOptions): Promise<GenerationResult>;
  generateBatch?(options: GenerateOptions): Promise<GenerationResult[]>;
  checkStatus(): Promise<ProviderStatus>;
  configure?(config: ProviderConfig): void;
}

export interface GenerationHistoryItem {
  id: string;
  provider: string;
  prompt: string;
  genre?: string;
  mood?: string;
  lyrics?: string;
  duration: number;
  audioUrl: string;
  audioBlob?: Blob;
  savedToLibrary: boolean;
  songId?: string;
  createdAt: Date;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  vocalLanguage?: string;
}

export const GENRES = ["Jazz", "Ambient", "Acoustic", "Electronic", "Classical", "Lo-Fi", "World"] as const;
export const MOODS = ["Relaxed", "Energetic", "Focused", "Uplifting", "Calm", "Romantic"] as const;

export type Genre = typeof GENRES[number];
export type Mood = typeof MOODS[number];
