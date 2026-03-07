import { Music } from "lucide-react";
import type { AIProvider, GenerateOptions, GenerationResult, ProviderConfig, ProviderStatus } from "./types";
import { supabase } from "@/integrations/supabase/client";

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

/** Convert a Blob to base64 string */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Call ACE-Step via edge function proxy */
async function proxyCall(endpoint: string, method = "GET", body?: unknown): Promise<any> {
  let data: any;
  let error: any;

  try {
    const result = await supabase.functions.invoke("acestep-proxy", {
      body: { endpoint, method, body },
    });
    data = result.data;
    error = result.error;
  } catch (networkErr: any) {
    throw new Error(
      "Unable to reach the ACE-Step server. Please verify the container is running and try again."
    );
  }

  if (error) {
    throw new Error(`ACE-Step proxy error: ${error.message}`);
  }

  // The proxy returns a JSON error when the upstream server is unreachable (502)
  if (data?.error) {
    const detail = data.detail || data.error;
    throw new Error(
      typeof detail === "string" && detail.includes("unreachable")
        ? "The ACE-Step server is currently offline. Please start the container and try again."
        : `ACE-Step error: ${detail}`
    );
  }

  // Unwrap API envelope: responses are wrapped in {code, data, error, timestamp}
  if (data && typeof data === "object" && "code" in data && "data" in data && "timestamp" in data) {
    if (data.error) {
      throw new Error(`ACE-Step error: ${data.error}`);
    }
    return data.data;
  }

  return data;
}

/** Poll query_result until status is 1 (success) or 2 (failed) */
async function pollResult(
  taskId: string,
  maxAttempts = 120,
  interval = 3000,
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await proxyCall("/query_result", "POST", { task_id_list: [taskId] });

    // After envelope unwrap, result is the array directly
    const tasks = Array.isArray(result) ? result : result?.data || result;
    const task = Array.isArray(tasks) ? tasks[0] : tasks;
    if (!task) throw new Error("AceStep: task not found");

    if (task.status === 1) {
      return typeof task.result === "string" ? JSON.parse(task.result) : task.result;
    }
    if (task.status === 2) throw new Error("AceStep generation failed");

    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("AceStep generation timed out");
}

/** Build the request body/formdata depending on whether audio files are present */
function buildRequest(
  options: GenerateOptions,
  model: string,
): { body: BodyInit; contentType?: string } {
  const hasFiles = options.sourceAudioBlob || options.referenceAudioBlob;
  const taskType = options.taskType || "text2music";

  let prompt = options.prompt;
  if (options.genre) prompt += `, ${options.genre.toLowerCase()} style`;
  if (options.mood) prompt += `, ${options.mood.toLowerCase()} mood`;

  if (hasFiles) {
    const fd = new FormData();
    fd.append("prompt", prompt);
    fd.append("lyrics", options.lyrics || "");
    fd.append("audio_duration", String(options.duration));
    fd.append("model", model);
    fd.append("thinking", "true");
    fd.append("batch_size", "1");
    fd.append("audio_format", "mp3");
    fd.append("inference_steps", "8");
    fd.append("task_type", taskType);

    if (options.sourceAudioBlob) {
      fd.append("src_audio", options.sourceAudioBlob, "source.mp3");
    }
    if (options.referenceAudioBlob) {
      fd.append("reference_audio", options.referenceAudioBlob, "reference.mp3");
    }

    if (taskType === "repaint") {
      fd.append("repainting_start", String(options.repaintStart ?? 0));
      if (options.repaintEnd != null) {
        fd.append("repainting_end", String(options.repaintEnd));
      }
    }

    if (taskType === "cover" && options.coverStrength != null) {
      fd.append("audio_cover_strength", String(options.coverStrength));
    }

    return { body: fd };
  }

  // JSON request for text2music (no files)
  const payload: Record<string, unknown> = {
    prompt,
    lyrics: options.lyrics || "",
    audio_duration: options.duration,
    model,
    thinking: true,
    batch_size: 1,
    audio_format: "mp3",
    inference_steps: 8,
    task_type: taskType,
  };

  return {
    body: JSON.stringify(payload),
    contentType: "application/json",
  };
}

export const aceStepProvider: AIProvider = {
  id: "acestep",
  name: "ACE-Step",
  description: "Open-source music generation (self-hosted ACE-Step v1.5)",
  icon: Music,
  status: "configuring",

  async generate(options: GenerateOptions): Promise<GenerationResult> {
    // Build JSON payload (proxy doesn't support FormData yet)
    const model = aceStepConfig.model || "acestep-v15-turbo";
    const taskType = options.taskType || "text2music";

    let prompt = options.prompt;
    if (options.genre) prompt += `, ${options.genre.toLowerCase()} style`;
    if (options.mood) prompt += `, ${options.mood.toLowerCase()} mood`;

    const payload: Record<string, unknown> = {
      prompt,
      lyrics: options.lyrics || "",
      audio_duration: options.duration,
      model,
      thinking: true,
      batch_size: 1,
      audio_format: "mp3",
      inference_steps: 8,
      task_type: taskType,
    };

    // Musical control params
    if (options.bpm) payload.bpm = options.bpm;
    if (options.keyScale) payload.keyscale = options.keyScale;
    if (options.timeSignature) payload.timesignature = options.timeSignature;

    if (taskType === "repaint") {
      payload.repainting_start = options.repaintStart ?? 0;
      if (options.repaintEnd != null) payload.repainting_end = options.repaintEnd;
    }
    if (taskType === "cover" && options.coverStrength != null) {
      payload.audio_cover_strength = options.coverStrength;
    }

    // Include source audio as base64 for cover/repaint/complete
    if (options.sourceAudioBlob && ["cover", "repaint", "complete"].includes(taskType)) {
      payload.src_audio_base64 = await blobToBase64(options.sourceAudioBlob);
    }
    if (options.referenceAudioBlob) {
      payload.reference_audio_base64 = await blobToBase64(options.referenceAudioBlob);
    }

    // 1. Submit generation task
    const releaseData = await proxyCall("/release_task", "POST", payload);
    // After envelope unwrap, releaseData is {status, task_id} directly
    const taskId = releaseData?.task_id || releaseData?.data?.task_id;
    if (!taskId) throw new Error("ACE-Step did not return a task_id");

    // 2. Poll for result
    const results = await pollResult(taskId);

    // 3. Get audio via proxy using the /v1/audio endpoint
    const firstResult = results[0];
    const audioPath = firstResult?.url || firstResult?.file;
    if (!audioPath) throw new Error("ACE-Step returned no audio file");

    // Download audio through the proxy — use fetch directly for binary data
    // supabase.functions.invoke doesn't reliably return binary responses as Blob
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const audioResponse = await fetch(`${supabaseUrl}/functions/v1/acestep-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ endpoint: audioPath, method: "GET" }),
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    let audioBlob = await audioResponse.blob();
    // If the blob came back as JSON (envelope), it's not audio
    if (audioBlob.type.includes("json") || audioBlob.size < 1000) {
      throw new Error("ACE-Step returned invalid audio data");
    }

    if (audioBlob.size === 0) throw new Error("Failed to download audio from ACE-Step");

    return {
      audioBlob,
      audioUrl: URL.createObjectURL(audioBlob),
      lyrics: firstResult.lyrics || undefined,
      metadata: {
        provider: "acestep",
        prompt: options.prompt,
        duration: firstResult.duration || options.duration,
        genre: options.genre,
        mood: options.mood,
        bpm: firstResult.bpm,
        keyScale: firstResult.keyscale,
        timeSignature: firstResult.timesignature,
        vocalLanguage: firstResult.vocal_language,
      },
    };
  },

  async checkStatus(): Promise<ProviderStatus> {
    try {
      const data = await proxyCall("/health", "GET");
      return data && !data.error ? "ready" : "unavailable";
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

/** Enhance a text prompt via ACE-Step LM */
export async function enhanceCaption(prompt: string): Promise<string> {
  const result = await proxyCall("/enhance_caption", "POST", { caption: prompt });
  return result?.enhanced_caption || result?.caption || result || prompt;
}

/** Format/improve lyrics via ACE-Step LM */
export async function formatLyrics(lyrics: string): Promise<string> {
  const result = await proxyCall("/format_lyrics", "POST", { lyrics });
  return result?.formatted_lyrics || result?.lyrics || result || lyrics;
}
