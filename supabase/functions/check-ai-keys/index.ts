const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const keys: Record<string, boolean> = {
    openai: Boolean(Deno.env.get("OPENAI_API_KEY")),
    gemini: Boolean(Deno.env.get("GOOGLE_AI_API_KEY")),
    elevenlabs: Boolean(Deno.env.get("ELEVENLABS_API_KEY")),
    lovable_gateway: Boolean(Deno.env.get("LOVABLE_API_KEY")),
    replicate: Boolean(Deno.env.get("REPLICATE_API_KEY")),
    acestep: Boolean(Deno.env.get("ACESTEP_API_KEY")),
  };

  return new Response(JSON.stringify(keys), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
