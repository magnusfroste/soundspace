import { LucideIcon } from "lucide-react";

export type ProviderStatus = "ready" | "configuring" | "unavailable" | "coming_soon";

export interface GenerateOptions {
  prompt: string;
  duration: number;
  genre?: string;
  mood?: string;
  lyrics?: string;
}

export interface GenerationResult {
  audioBlob: Blob;
  audioUrl: string;
  metadata: {
    provider: string;
    prompt: string;
    duration: number;
    genre?: string;
    mood?: string;
  };
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
  checkStatus(): Promise<ProviderStatus>;
  configure?(config: ProviderConfig): void;
}

export interface GenerationHistoryItem {
  id: string;
  provider: string;
  prompt: string;
  genre?: string;
  mood?: string;
  duration: number;
  audioUrl: string;
  audioBlob?: Blob;
  savedToLibrary: boolean;
  songId?: string;
  createdAt: Date;
}

export const GENRES = ["Jazz", "Ambient", "Acoustic", "Electronic", "Classical", "Lo-Fi", "World"] as const;
export const MOODS = ["Relaxed", "Energetic", "Focused", "Uplifting", "Calm", "Romantic"] as const;

export type Genre = typeof GENRES[number];
export type Mood = typeof MOODS[number];
