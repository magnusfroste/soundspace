import { Sparkles } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderStatus } from "./types";

export const elevenlabsProvider: AIProvider = {
  id: "elevenlabs",
  name: "ElevenLabs",
  description: "High-quality AI music generation with text-to-music",
  icon: Sparkles,
  status: "ready",

  async generate(options: GenerateOptions): Promise<GenerationResult> {
    let fullPrompt = options.prompt;
    if (options.genre) fullPrompt += `, ${options.genre.toLowerCase()} style`;
    if (options.mood) fullPrompt += `, ${options.mood.toLowerCase()} mood`;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-music`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: fullPrompt, duration: options.duration }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate music");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioBlob,
      audioUrl,
      metadata: {
        provider: "elevenlabs",
        prompt: options.prompt,
        duration: options.duration,
        genre: options.genre,
        mood: options.mood,
      },
    };
  },

  async checkStatus(): Promise<ProviderStatus> {
    // Could add a health check endpoint here
    return "ready";
  },
};
