import { Radio } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderConfig, ProviderStatus } from "./types";

const STORAGE_KEY = "somhonesto_mubert_config";

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
  };
}

function saveConfig(config: ProviderConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

let mubertConfig: ProviderConfig = loadConfig();

export const mubertProvider: AIProvider = {
  id: "mubert",
  name: "Mubert",
  description: "Royalty-free AI music, perfect for commercial spaces",
  icon: Radio,
  status: "configuring",

  async generate(options: GenerateOptions): Promise<GenerationResult> {
    if (!mubertConfig.apiKey) {
      throw new Error("Mubert API key not configured. Get your key at mubert.com/render/pricing");
    }

    // Mubert API integration
    // Step 1: Get a track token
    const tokenResponse = await fetch("https://api-b2b.mubert.com/v2/GetServiceAccess", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "GetServiceAccess",
        params: {
          email: "api@somhonesto.com", // This should be configured
          license: mubertConfig.apiKey,
          token: mubertConfig.apiKey,
        },
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to authenticate with Mubert");
    }

    const tokenData = await tokenResponse.json();
    if (tokenData.status !== 1) {
      throw new Error(tokenData.error?.text || "Mubert authentication failed");
    }

    const pat = tokenData.data?.pat;
    if (!pat) {
      throw new Error("Failed to get Mubert access token");
    }

    // Step 2: Generate track
    const generateResponse = await fetch("https://api-b2b.mubert.com/v2/RecordTrackTTM", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "RecordTrackTTM",
        params: {
          pat,
          duration: options.duration,
          tags: [options.genre, options.mood].filter(Boolean),
          mode: "track",
          format: "mp3",
          prompt: options.prompt,
        },
      }),
    });

    if (!generateResponse.ok) {
      throw new Error("Failed to generate track with Mubert");
    }

    const generateData = await generateResponse.json();
    if (generateData.status !== 1) {
      throw new Error(generateData.error?.text || "Mubert generation failed");
    }

    const trackUrl = generateData.data?.tasks?.[0]?.download_link;
    if (!trackUrl) {
      throw new Error("Mubert did not return a track URL");
    }

    // Download the track
    const audioResponse = await fetch(trackUrl);
    const audioBlob = await audioResponse.blob();

    return {
      audioBlob,
      audioUrl: URL.createObjectURL(audioBlob),
      metadata: {
        provider: "mubert",
        prompt: options.prompt,
        duration: options.duration,
        genre: options.genre,
        mood: options.mood,
      },
    };
  },

  async checkStatus(): Promise<ProviderStatus> {
    if (!mubertConfig.apiKey) {
      return "configuring";
    }

    try {
      // Test the API key with a lightweight request
      const response = await fetch("https://api-b2b.mubert.com/v2/GetServiceAccess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GetServiceAccess",
          params: {
            email: "test@example.com",
            license: mubertConfig.apiKey,
            token: mubertConfig.apiKey,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 1) {
          return "ready";
        }
      }
      return "unavailable";
    } catch {
      return "unavailable";
    }
  },

  configure(config: ProviderConfig) {
    mubertConfig = { ...mubertConfig, ...config };
    saveConfig(mubertConfig);
  },
};

export function getMubertConfig(): ProviderConfig {
  return { ...mubertConfig };
}

export function setMubertConfig(config: Partial<ProviderConfig>) {
  mubertConfig = { ...mubertConfig, ...config };
  saveConfig(mubertConfig);
}
