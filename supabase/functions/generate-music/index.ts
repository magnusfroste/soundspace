import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Parse a multipart/mixed response from ElevenLabs /v1/music/detailed.
 * Returns { metadata: object, audioBytes: Uint8Array }.
 */
async function parseMultipartMixed(
  response: Response
): Promise<{ metadata: Record<string, unknown>; audioBytes: Uint8Array }> {
  const contentType = response.headers.get("content-type") || "";
  const boundaryMatch = contentType.match(/boundary=(.+)/);

  if (!boundaryMatch) {
    // Fallback: not multipart — assume raw audio (old API behaviour)
    const buf = await response.arrayBuffer();
    return { metadata: {}, audioBytes: new Uint8Array(buf) };
  }

  const boundary = boundaryMatch[1].trim();
  const raw = new Uint8Array(await response.arrayBuffer());

  // Convert to string to find part boundaries, but keep raw bytes for audio
  const decoder = new TextDecoder();
  const text = decoder.decode(raw);
  const delimiter = `--${boundary}`;
  const parts = text.split(delimiter).filter((p) => p.trim() && p.trim() !== "--");

  let metadata: Record<string, unknown> = {};
  let audioBytes = new Uint8Array();

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.slice(0, headerEnd).toLowerCase();
    const bodyStart = headerEnd + 4; // skip \r\n\r\n

    if (headers.includes("application/json")) {
      // JSON metadata part
      const jsonBody = part.slice(bodyStart).trim();
      // Remove trailing boundary markers
      const cleaned = jsonBody.replace(/\r\n--.*$/, "").trim();
      try {
        metadata = JSON.parse(cleaned);
      } catch (e) {
        console.error("Failed to parse metadata JSON:", e);
      }
    } else if (headers.includes("audio/") || headers.includes("application/octet-stream")) {
      // Audio part — find offset in raw bytes
      const partHeaderBytes = new TextEncoder().encode(part.slice(0, bodyStart));
      const partStartInText = text.indexOf(part);
      const audioStartOffset = new TextEncoder().encode(text.slice(0, partStartInText)).length + partHeaderBytes.length;

      // Find end: next boundary in raw bytes
      const nextBoundary = new TextEncoder().encode(`\r\n${delimiter}`);
      let audioEndOffset = raw.length;
      outer: for (let i = audioStartOffset; i < raw.length - nextBoundary.length; i++) {
        for (let j = 0; j < nextBoundary.length; j++) {
          if (raw[i + j] !== nextBoundary[j]) continue outer;
        }
        audioEndOffset = i;
        break;
      }

      audioBytes = raw.slice(audioStartOffset, audioEndOffset);
    }
  }

  return { metadata, audioBytes };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration, lyrics } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MIN_DURATION_SEC = 3;
    const MAX_DURATION_SEC = 300; // detailed endpoint max 5 min
    const DEFAULT_DURATION_SEC = 180;

    let validDurationSec = duration ? Number(duration) : DEFAULT_DURATION_SEC;
    if (isNaN(validDurationSec) || validDurationSec < MIN_DURATION_SEC) {
      validDurationSec = MIN_DURATION_SEC;
    } else if (validDurationSec > MAX_DURATION_SEC) {
      validDurationSec = MAX_DURATION_SEC;
    }

    const musicLengthMs = Math.round(validDurationSec * 1000);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the full prompt, appending lyrics if provided
    let fullPrompt = prompt;
    if (lyrics && lyrics.trim()) {
      fullPrompt += `\n\nLyrics:\n${lyrics.trim()}`;
    }

    console.log(`Generating music (detailed) — prompt: "${fullPrompt.slice(0, 100)}...", duration: ${validDurationSec}s, hasLyrics: ${!!lyrics}`);

    // Use /v1/music/detailed to get composition plan + audio
    const response = await fetch("https://api.elevenlabs.io/v1/music/detailed", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        music_length_ms: musicLengthMs,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);

      // Try to extract suggestion from bad_prompt errors
      if (response.status === 422) {
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson?.detail?.message) {
            return new Response(
              JSON.stringify({
                error: errorJson.detail.message,
                suggestion: errorJson.detail.suggestion || null,
              }),
              { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch { /* fall through */ }
      }

      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid ElevenLabs API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse multipart/mixed response
    const { metadata, audioBytes } = await parseMultipartMixed(response);

    console.log(`Music generated — audio: ${audioBytes.length} bytes, metadata keys: ${Object.keys(metadata).join(", ")}`);

    // Extract lyrics from composition plan if available
    let extractedLyrics: string | null = null;
    const compositionPlan = (metadata as Record<string, unknown>).composition_plan as Record<string, unknown> | undefined;
    if (compositionPlan?.sections) {
      const sections = compositionPlan.sections as Array<{ lines?: string[]; name?: string }>;
      const lyricsLines: string[] = [];
      for (const section of sections) {
        if (section.lines && section.lines.length > 0) {
          if (section.name) lyricsLines.push(`[${section.name}]`);
          lyricsLines.push(...section.lines);
          lyricsLines.push("");
        }
      }
      if (lyricsLines.length > 0) {
        extractedLyrics = lyricsLines.join("\n").trim();
      }
    }

    // Encode audio as base64
    const audioBase64 = base64Encode(audioBytes);

    return new Response(
      JSON.stringify({
        audio: audioBase64,
        lyrics: extractedLyrics,
        compositionPlan: compositionPlan || null,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Music generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
