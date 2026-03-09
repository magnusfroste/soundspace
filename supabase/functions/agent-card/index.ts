const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const agentCard = {
    protocol: "a2a/1.0",
    agent: "SoundSpace",
    status: "online",
    endpoint: `${supabaseUrl}/functions/v1/a2a-negotiate`,
    skills: [
      {
        id: "generate_track",
        name: "Generate Track",
        description: "Generate custom AI music tracks",
        input_schema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Detailed description of the music to generate (genre, mood, BPM, instruments, etc.)",
            },
            duration: {
              type: "number",
              description: "Duration in seconds (3-300, default 180)",
            },
            context: {
              type: "object",
              description:
                "Optional context: venue type, time of day, energy level",
            },
          },
          required: ["prompt"],
        },
      },
    ],
    accepts: ["task", "query", "ping"],
    meta: {
      name: "SoundSpace Music Agent",
      description:
        "AI-powered background music generation for commercial spaces. Generates studio-quality tracks tailored to venue type, mood, and time of day.",
      version: "1.0.0",
    },
  };

  return new Response(JSON.stringify(agentCard, null, 2), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
});
