import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and clamp duration (min 3s, max 600s / 10 min)
    // ElevenLabs Music API uses music_length_ms (3000-600000ms)
    const MIN_DURATION_SEC = 3;
    const MAX_DURATION_SEC = 600;
    const DEFAULT_DURATION_SEC = 180; // 3 minutes default
    
    let validDurationSec = duration ? Number(duration) : DEFAULT_DURATION_SEC;
    if (isNaN(validDurationSec) || validDurationSec < MIN_DURATION_SEC) {
      validDurationSec = MIN_DURATION_SEC;
    } else if (validDurationSec > MAX_DURATION_SEC) {
      validDurationSec = MAX_DURATION_SEC;
    }

    // Convert to milliseconds for ElevenLabs API
    const musicLengthMs = Math.round(validDurationSec * 1000);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating music with prompt: "${prompt}", duration: ${validDurationSec}s (${musicLengthMs}ms)`);

    // Call ElevenLabs Music API with music_length_ms parameter
    const response = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: musicLengthMs,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      
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

    // Return the audio directly as binary
    const audioBuffer = await response.arrayBuffer();
    
    console.log(`Music generated successfully, size: ${audioBuffer.byteLength} bytes`);

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="generated-music.mp3"',
      },
    });
  } catch (error) {
    console.error("Music generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
