const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ACESTEP_URL = Deno.env.get("ACESTEP_API_URL");
  const ACESTEP_KEY = Deno.env.get("ACESTEP_API_KEY");

  if (!ACESTEP_URL) {
    return new Response(
      JSON.stringify({ error: "ACESTEP_API_URL not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { endpoint, method, body } = await req.json();

    const allowedExact = ["/health", "/v1/models", "/release_task", "/query_result", "/create_random_sample", "/format_lyrics"];
    const allowedPrefixes = ["/v1/audio"];
    const isAllowed = endpoint && (
      allowedExact.includes(endpoint) ||
      allowedPrefixes.some((p: string) => endpoint.startsWith(p))
    );
    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: "Endpoint not allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = ACESTEP_URL.replace(/\/+$/, "");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ACESTEP_KEY) headers["Authorization"] = `Bearer ${ACESTEP_KEY}`;

    // Coerce types for release_task to ensure Python gets ints/floats/bools
    let jsonBody = body;
    if (body && endpoint === "/release_task") {
      jsonBody = { ...body };
      const intKeys = ["audio_duration", "batch_size", "inference_steps", "repainting_start", "repainting_end"];
      for (const k of intKeys) {
        if (k in jsonBody) jsonBody[k] = Math.round(Number(jsonBody[k]));
      }
      if ("audio_cover_strength" in jsonBody) {
        jsonBody.audio_cover_strength = Number(jsonBody.audio_cover_strength);
      }
      if ("thinking" in jsonBody) {
        jsonBody.thinking = Boolean(jsonBody.thinking);
      }
    }

    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers,
      body: jsonBody ? JSON.stringify(jsonBody) : undefined,
    };

    const res = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("audio") || contentType.includes("octet-stream")) {
      return new Response(res.body, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": contentType },
      });
    }

    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
