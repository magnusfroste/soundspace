import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({
          connected: false,
          error: "ElevenLabs API key not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Fetching ElevenLabs subscription info...");

    // Fetch user subscription info
    const response = await fetch(
      "https://api.elevenlabs.io/v1/user/subscription",
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);

      // Parse error details
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.detail?.status === "missing_permissions") {
          // Key is valid but missing permissions - still show as connected
          return new Response(
            JSON.stringify({
              connected: true,
              tier: "unknown",
              character_count: 0,
              character_limit: 0,
              usage_percent: 0,
              next_reset: null,
              limited_access: true,
              error_detail: "API key lacks 'user_read' permission for usage stats",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } else if (response.status === 401) {
          errorMessage = "Invalid API key";
        }
      } catch {
        // Ignore JSON parse errors
      }

      return new Response(
        JSON.stringify({
          connected: false,
          error: errorMessage,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    console.log("ElevenLabs subscription data received:", {
      tier: data.tier,
      character_count: data.character_count,
      character_limit: data.character_limit,
    });

    // Calculate usage percentage
    const usagePercent =
      data.character_limit > 0
        ? Math.round((data.character_count / data.character_limit) * 100)
        : 0;

    // Format next reset date
    let nextResetDate = null;
    if (data.next_character_count_reset_unix) {
      nextResetDate = new Date(
        data.next_character_count_reset_unix * 1000
      ).toISOString();
    }

    return new Response(
      JSON.stringify({
        connected: true,
        tier: data.tier,
        character_count: data.character_count,
        character_limit: data.character_limit,
        usage_percent: usagePercent,
        next_reset: nextResetDate,
        can_extend_limit: data.can_extend_character_limit,
        voice_limit: data.voice_limit,
        professional_voice_limit: data.professional_voice_limit,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching ElevenLabs status:", error);
    return new Response(
      JSON.stringify({
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
