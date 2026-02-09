import { Cpu } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderConfig, ProviderStatus } from "./types";

const STORAGE_KEY = "somhonesto_musicgen_config";

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
    apiKey: "",
    model: "facebook/musicgen-small",
  };
}

function saveConfig(config: ProviderConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

let musicgenConfig: ProviderConfig = loadConfig();

// Available MusicGen models on Replicate
export const MUSICGEN_MODELS = [
  { id: "facebook/musicgen-small", name: "MusicGen Small", description: "Fast generation, good quality" },
  { id: "facebook/musicgen-medium", name: "MusicGen Medium", description: "Better quality, moderate speed" },
  { id: "facebook/musicgen-large", name: "MusicGen Large", description: "Best quality, slower" },
  { id: "facebook/musicgen-melody", name: "MusicGen Melody", description: "Can condition on melody input" },
] as const;

export const musicgenProvider: AIProvider = {
  id: "musicgen",
  name: "MusicGen",
  description: "Meta's open-source model via Replicate",
  icon: Cpu,
  status: "configuring",

  async generate(options: GenerateOptions): Promise<GenerationResult> {
    if (!musicgenConfig.apiKey) {
      throw new Error("Replicate API key not configured. Get your key at replicate.com");
    }

    const model = musicgenConfig.model || "facebook/musicgen-small";

    // Create prediction on Replicate
    const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${musicgenConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: getModelVersion(model),
        input: {
          prompt: `${options.genre || "ambient"} ${options.mood || "relaxed"} music. ${options.prompt}`,
          duration: Math.min(options.duration, 30), // MusicGen max is typically 30s
          model_version: "stereo-large",
          output_format: "mp3",
          normalization_strategy: "peak",
        },
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Replicate error: ${error}`);
    }

    const prediction = await createResponse.json();
    
    // Poll for completion
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: {
          "Authorization": `Token ${musicgenConfig.apiKey}`,
        },
      });

      if (!pollResponse.ok) {
        throw new Error("Failed to check generation status");
      }

      result = await pollResponse.json();
      attempts++;
    }

    if (result.status === "failed") {
      throw new Error(result.error || "MusicGen generation failed");
    }

    if (result.status !== "succeeded") {
      throw new Error("Generation timed out");
    }

    // Download the audio
    const audioUrl = result.output;
    if (!audioUrl) {
      throw new Error("MusicGen did not return audio");
    }

    const audioResponse = await fetch(audioUrl);
    const audioBlob = await audioResponse.blob();

    return {
      audioBlob,
      audioUrl: URL.createObjectURL(audioBlob),
      metadata: {
        provider: "musicgen",
        prompt: options.prompt,
        duration: options.duration,
        genre: options.genre,
        mood: options.mood,
      },
    };
  },

  async checkStatus(): Promise<ProviderStatus> {
    if (!musicgenConfig.apiKey) {
      return "configuring";
    }

    try {
      // Verify API key with a lightweight request
      const response = await fetch("https://api.replicate.com/v1/account", {
        headers: {
          "Authorization": `Token ${musicgenConfig.apiKey}`,
        },
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
    musicgenConfig = { ...musicgenConfig, ...config };
    saveConfig(musicgenConfig);
  },
};

// Model version hashes for Replicate
function getModelVersion(model: string): string {
  const versions: Record<string, string> = {
    "facebook/musicgen-small": "671ac645ce5e552cc63a54a2bbff63fcf798043055f2d186b9cb26a6c1d6c6c",
    "facebook/musicgen-medium": "563e5ed5dbee3ebc47f54de9b2bfc25a7a8d8c82984e42cfb3e0e1d9c43c7c67",
    "facebook/musicgen-large": "7be0f12c54a8d033a0fbd14418c9af98962da9a86f5ff7811f9b3423a1f0b7d7",
    "facebook/musicgen-melody": "b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
  };
  return versions[model] || versions["facebook/musicgen-small"];
}

export function getMusicgenConfig(): ProviderConfig {
  return { ...musicgenConfig };
}

export function setMusicgenConfig(config: Partial<ProviderConfig>) {
  musicgenConfig = { ...musicgenConfig, ...config };
  saveConfig(musicgenConfig);
}
