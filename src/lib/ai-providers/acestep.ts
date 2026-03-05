import { Music } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderConfig, ProviderStatus } from "./types";

const STORAGE_KEY = "somhonesto_acestep_config";

function loadConfig(): ProviderConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore
  }
  return { endpointUrl: "", model: "acestep-v15-turbo", apiKey: "" };
}

function saveConfig(config: ProviderConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

let aceStepConfig: ProviderConfig = loadConfig();

/** Poll query_result until status is 1 (success) or 2 (failed) */
async function pollResult(
  baseUrl: string,
  taskId: string,
  headers: Record<string, string>,
  maxAttempts = 120,
  interval = 3000,
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${baseUrl}/query_result`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ task_id_list: [taskId] }),
    });

    if (!res.ok) throw new Error(`AceStep poll error: ${res.status}`);

    const json = await res.json();
    const task = json.data?.[0];

    if (!task) throw new Error("AceStep: task not found");

    if (task.status === 1) {
      // result is a JSON string
      const results = typeof task.result === "string" ? JSON.parse(task.result) : task.result;
      return results;
    }

    if (task.status === 2) {
      throw new Error("AceStep generation failed");
    }

    // status 0 — still running, wait and retry
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error("AceStep generation timed out");
}

export const aceStepProvider: AIProvider = {
  id: "acestep",
  name: "ACE-Step",
  description: "Open-source music generation (self-hosted ACE-Step v1.5)",
  icon: Music,
  status: "configuring",

  async generate(options: GenerateOptions): Promise<GenerationResult> {
    if (!aceStepConfig.endpointUrl) {
      throw new Error("ACE-Step endpoint not configured");
    }

    const baseUrl = aceStepConfig.endpointUrl.replace(/\/+$/, "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (aceStepConfig.apiKey) {
      headers["Authorization"] = `Bearer ${aceStepConfig.apiKey}`;
    }

    let prompt = options.prompt;
    if (options.genre) prompt += `, ${options.genre.toLowerCase()} style`;
    if (options.mood) prompt += `, ${options.mood.toLowerCase()} mood`;

    // 1. Submit generation task
    const releaseRes = await fetch(`${baseUrl}/release_task`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        lyrics: options.lyrics || "",
        audio_duration: options.duration,
        model: aceStepConfig.model || "acestep-v15-turbo",
        thinking: true,
        batch_size: 1,
        audio_format: "mp3",
        inference_steps: 8,
      }),
    });

    if (!releaseRes.ok) {
      const err = await releaseRes.text();
      throw new Error(`ACE-Step submission failed: ${err}`);
    }

    const releaseData = await releaseRes.json();
    const taskId = releaseData.data?.task_id;
    if (!taskId) throw new Error("ACE-Step did not return a task_id");

    // 2. Poll for result
    const results = await pollResult(baseUrl, taskId, headers);

    // 3. Download first audio file
    const firstResult = results[0];
    if (!firstResult?.file) throw new Error("ACE-Step returned no audio file");

    const audioUrl = firstResult.file.startsWith("http")
      ? firstResult.file
      : `${baseUrl}${firstResult.file}`;

    const audioRes = await fetch(audioUrl, { headers });
    if (!audioRes.ok) throw new Error("Failed to download ACE-Step audio");

    const audioBlob = await audioRes.blob();

    return {
      audioBlob,
      audioUrl: URL.createObjectURL(audioBlob),
      lyrics: firstResult.lyrics || undefined,
      metadata: {
        provider: "acestep",
        prompt: options.prompt,
        duration: options.duration,
        genre: options.genre,
        mood: options.mood,
      },
    };
  },

  async checkStatus(): Promise<ProviderStatus> {
    if (!aceStepConfig.endpointUrl) return "configuring";

    try {
      const headers: Record<string, string> = {};
      if (aceStepConfig.apiKey) {
        headers["Authorization"] = `Bearer ${aceStepConfig.apiKey}`;
      }

      const res = await fetch(`${aceStepConfig.endpointUrl.replace(/\/+$/, "")}/health`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000),
      });

      return res.ok ? "ready" : "unavailable";
    } catch {
      return "unavailable";
    }
  },

  configure(config: ProviderConfig) {
    aceStepConfig = { ...aceStepConfig, ...config };
    saveConfig(aceStepConfig);
  },
};

export function getAceStepConfig(): ProviderConfig {
  return { ...aceStepConfig };
}

export function setAceStepConfig(config: Partial<ProviderConfig>) {
  aceStepConfig = { ...aceStepConfig, ...config };
  saveConfig(aceStepConfig);
}
