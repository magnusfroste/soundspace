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

/** Download a single audio result from ACE-Step */
async function downloadAudio(audioPath: string): Promise<Blob> {
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

  const audioBlob = await audioResponse.blob();
  if (audioBlob.type.includes("json") || audioBlob.size < 1000) {
    throw new Error("ACE-Step returned invalid audio data");
  }
  if (audioBlob.size === 0) throw new Error("Failed to download audio from ACE-Step");
  return audioBlob;
}

/** Build the common payload for ACE-Step generation */
function buildPayload(options: GenerateOptions, model: string, batchSize = 1): Record<string, unknown> {
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
    batch_size: batchSize,
    audio_format: "mp3",
    inference_steps: 8,
    task_type: taskType,
  };

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

  return payload;
}

/** Map a single ACE-Step result item to a GenerationResult */
async function mapResultToGeneration(
  resultItem: any,
  options: GenerateOptions,
): Promise<GenerationResult> {
  const audioPath = resultItem?.url || resultItem?.file;
  if (!audioPath) throw new Error("ACE-Step returned no audio file");

  const audioBlob = await downloadAudio(audioPath);

  return {
    audioBlob,
    audioUrl: URL.createObjectURL(audioBlob),
    lyrics: resultItem.lyrics || undefined,
    qualityScore: resultItem.quality_score ?? resultItem.qualityScore ?? undefined,
    metadata: {
      provider: "acestep",
      prompt: options.prompt,
      duration: resultItem.duration || options.duration,
      genre: options.genre,
      mood: options.mood,
      bpm: resultItem.bpm,
      keyScale: resultItem.keyscale,
      timeSignature: resultItem.timesignature,
      vocalLanguage: resultItem.vocal_language,
    },
  };
}

export const aceStepProvider: AIProvider = {
  id: "acestep",
  name: "ACE-Step",
  description: "Open-source music generation (self-hosted ACE-Step v1.5)",
  icon: Music,
  status: "configuring",

  async generate(options: GenerateOptions): Promise<GenerationResult> {
    const model = aceStepConfig.model || "acestep-v15-turbo";

    const payload = buildPayload(options, model, 1);

    // Include source audio as base64 for cover/repaint/complete
    const taskType = options.taskType || "text2music";
    if (options.sourceAudioBlob && ["cover", "repaint", "complete"].includes(taskType)) {
      payload.src_audio_base64 = await blobToBase64(options.sourceAudioBlob);
    }
    if (options.referenceAudioBlob) {
      payload.reference_audio_base64 = await blobToBase64(options.referenceAudioBlob);
    }

    const releaseData = await proxyCall("/release_task", "POST", payload);
    const taskId = releaseData?.task_id || releaseData?.data?.task_id;
    if (!taskId) throw new Error("ACE-Step did not return a task_id");

    const results = await pollResult(taskId);
    return mapResultToGeneration(results[0], options);
  },

  async generateBatch(options: GenerateOptions): Promise<GenerationResult[]> {
    const model = aceStepConfig.model || "acestep-v15-turbo";
    const batchSize = Math.min(Math.max(options.batchSize || 2, 1), 4);

    const payload = buildPayload(options, model, batchSize);

    const taskType = options.taskType || "text2music";
    if (options.sourceAudioBlob && ["cover", "repaint", "complete"].includes(taskType)) {
      payload.src_audio_base64 = await blobToBase64(options.sourceAudioBlob);
    }
    if (options.referenceAudioBlob) {
      payload.reference_audio_base64 = await blobToBase64(options.referenceAudioBlob);
    }

    const releaseData = await proxyCall("/release_task", "POST", payload);
    const taskId = releaseData?.task_id || releaseData?.data?.task_id;
    if (!taskId) throw new Error("ACE-Step did not return a task_id");

    const results = await pollResult(taskId);
    const resultArray = Array.isArray(results) ? results : [results];

    // Download all variations in parallel
    const variations = await Promise.all(
      resultArray.map((item: any) => mapResultToGeneration(item, options))
    );

    // Run extract analysis on each variation for real quality scoring
    const scored = await Promise.all(
      variations.map(async (v) => {
        try {
          const extracted = await extractAudioFeatures(v.audioBlob);
          v.qualityScore = computeClientQualityScore(extracted, options);
        } catch {
          v.qualityScore = 0.75; // Default if analysis fails
        }
        return v;
      })
    );

    // Sort by real quality score descending
    scored.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

    return scored;
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

/** Extract audio features (BPM, key, caption, etc.) from an audio file */
export interface AudioExtractResult {
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  caption?: string;
  lyrics?: string;
  vocalLanguage?: string;
  duration?: number;
}

export async function extractAudioFeatures(audioBlob: Blob): Promise<AudioExtractResult> {
  const model = aceStepConfig.model || "acestep-v15-turbo";
  const base64 = await blobToBase64(audioBlob);

  const payload = {
    task_type: "extract",
    src_audio_base64: base64,
    model,
    prompt: "",
    lyrics: "",
    audio_duration: 0,
    batch_size: 1,
    audio_format: "mp3",
    inference_steps: 8,
    thinking: true,
  };

  const releaseData = await proxyCall("/release_task", "POST", payload);
  const taskId = releaseData?.task_id || releaseData?.data?.task_id;
  if (!taskId) throw new Error("ACE-Step did not return a task_id for extract");

/** Compute quality score by comparing extracted features vs requested params */
function computeClientQualityScore(
  extracted: AudioExtractResult,
  options: GenerateOptions,
): number {
  let score = 1.0;

  // BPM accuracy (40%)
  if (extracted.bpm && options.bpm) {
    const deviation = Math.abs(extracted.bpm - options.bpm) / options.bpm;
    if (deviation > 0.20) score -= 0.40;
    else if (deviation > 0.10) score -= 0.20;
    else if (deviation > 0.05) score -= 0.05;
  }

  // Key match (35%)
  if (extracted.keyScale && options.keyScale) {
    const eKey = extracted.keyScale.toLowerCase().trim();
    const rKey = options.keyScale.toLowerCase().trim();
    if (eKey !== rKey) {
      const eRoot = eKey.split(" ")[0];
      const rRoot = rKey.split(" ")[0];
      score -= eRoot === rRoot ? 0.15 : 0.35;
    }
  }

  // Time signature (25%)
  if (extracted.timeSignature && options.timeSignature) {
    if (extracted.timeSignature.trim() !== options.timeSignature.trim()) {
      score -= 0.25;
    }
  }

  return Math.max(0, Math.round(score * 100) / 100);
}
  const results = await pollResult(taskId);
  const item = Array.isArray(results) ? results[0] : results;

  return {
    bpm: item?.bpm ?? undefined,
    keyScale: item?.keyscale ?? item?.key_scale ?? undefined,
    timeSignature: item?.timesignature ?? item?.time_signature ?? undefined,
    caption: item?.caption ?? item?.prompt ?? undefined,
    lyrics: item?.lyrics ?? undefined,
    vocalLanguage: item?.vocal_language ?? undefined,
    duration: item?.duration ?? undefined,
  };
}
