import { HardDrive } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderConfig, ProviderStatus } from "./types";

const STORAGE_KEY = "somhonesto_local_ai_config";

function loadConfig(): ProviderConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {
    endpointUrl: "http://localhost:11434",
    model: "",
    apiKey: "",
  };
}

function saveConfig(config: ProviderConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

let localConfig: ProviderConfig = loadConfig();

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

    if (!localConfig.model) {
      throw new Error("Local AI model not configured");
    }

    // Construct headers with optional API key
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (localConfig.apiKey) {
      headers["Authorization"] = `Bearer ${localConfig.apiKey}`;
    }

    // Call the local endpoint
    const response = await fetch(`${localConfig.endpointUrl}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: localConfig.model,
        prompt: `Generate ${options.duration} seconds of ${options.genre || "ambient"} music with a ${options.mood || "relaxed"} mood. ${options.prompt}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local AI error: ${error}`);
    }

    const data = await response.json();
    
    // Handle audio response - this depends on the model's output format
    if (data.audio_url) {
      const audioResponse = await fetch(data.audio_url);
      const audioBlob = await audioResponse.blob();
      return {
        audioBlob,
        audioUrl: URL.createObjectURL(audioBlob),
        metadata: {
          provider: "local",
          prompt: options.prompt,
          duration: options.duration,
          genre: options.genre,
          mood: options.mood,
        },
      };
    }

    throw new Error("Local AI did not return audio. Make sure your model supports audio generation.");
  },

  async checkStatus(): Promise<ProviderStatus> {
    if (!localConfig.endpointUrl) {
      return "configuring";
    }

    try {
      const headers: Record<string, string> = {};
      if (localConfig.apiKey) {
        headers["Authorization"] = `Bearer ${localConfig.apiKey}`;
      }

      const response = await fetch(`${localConfig.endpointUrl}/api/tags`, {
        method: "GET",
        headers,
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
    saveConfig(localConfig);
  },
};

export function getLocalConfig(): ProviderConfig {
  return { ...localConfig };
}

export function setLocalConfig(config: Partial<ProviderConfig>) {
  localConfig = { ...localConfig, ...config };
  saveConfig(localConfig);
}
