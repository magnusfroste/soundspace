import { Radio } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderStatus } from "./types";

export const mubertProvider: AIProvider = {
  id: "mubert",
  name: "Mubert",
  description: "Royalty-free AI music, perfect for commercial spaces",
  icon: Radio,
  status: "coming_soon",

  async generate(_options: GenerateOptions): Promise<GenerationResult> {
    throw new Error("Mubert integration coming soon");
  },

  async checkStatus(): Promise<ProviderStatus> {
    return "coming_soon";
  },
};
