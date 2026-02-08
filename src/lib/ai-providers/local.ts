import { HardDrive } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderConfig, ProviderStatus } from "./types";

let localConfig: ProviderConfig = {
  endpointUrl: "http://localhost:11434",
  model: "",
};

export const localAIProvider: AIProvider = {
  id: "local",
  name: "Local AI",
  description: "Self-hosted music generation with Ollama or LMStudio",
  icon: HardDrive,
  status: "configuring",

  async generate(options: GenerateOptions): Promise<GenerationResult> {
    if (!localConfig.endpointUrl) {
      throw new Error("Local AI endpoint not configured");
    }

    // Stub implementation - actual inference would happen here
    throw new Error("Local AI generation not yet implemented. Configure your local endpoint in settings.");
  },

  async checkStatus(): Promise<ProviderStatus> {
    if (!localConfig.endpointUrl) {
      return "configuring";
    }

    try {
      const response = await fetch(`${localConfig.endpointUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        return "ready";
      }
      return "unavailable";
    } catch {
      return "unavailable";
    }
  },

  configure(config: ProviderConfig) {
    localConfig = { ...localConfig, ...config };
  },
};

export function getLocalConfig(): ProviderConfig {
  return { ...localConfig };
}

export function setLocalConfig(config: Partial<ProviderConfig>) {
  localConfig = { ...localConfig, ...config };
}
