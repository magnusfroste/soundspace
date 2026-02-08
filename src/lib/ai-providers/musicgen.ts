import { Cpu } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderStatus } from "./types";

export const musicgenProvider: AIProvider = {
  id: "musicgen",
  name: "MusicGen",
  description: "Meta's open-source model via Replicate",
  icon: Cpu,
  status: "coming_soon",

  async generate(_options: GenerateOptions): Promise<GenerationResult> {
    throw new Error("MusicGen integration coming soon");
  },

  async checkStatus(): Promise<ProviderStatus> {
    return "coming_soon";
  },
};
