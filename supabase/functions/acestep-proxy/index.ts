const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Decode base64 string to Uint8Array */
function base64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

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

    // Whitelist allowed endpoints (exact match or prefix match for /v1/audio)
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

    // Check if body contains base64 audio that needs to be sent as FormData
    const hasBase64Audio = body && (body.src_audio_base64 || body.reference_audio_base64);

    let fetchOptions: RequestInit;

    if (hasBase64Audio && endpoint === "/release_task") {
      // Build FormData for file uploads
      const fd = new FormData();
      
      // Add all non-base64 fields
      for (const [key, value] of Object.entries(body)) {
        if (key === "src_audio_base64" || key === "reference_audio_base64") continue;
        fd.append(key, String(value));
      }

      // Add source audio as file
      if (body.src_audio_base64) {
        const audioBytes = base64ToBytes(body.src_audio_base64);
        const audioBlob = new Blob([audioBytes], { type: "audio/mpeg" });
        fd.append("src_audio", audioBlob, "source.mp3");
      }

      // Add reference audio as file
      if (body.reference_audio_base64) {
        const refBytes = base64ToBytes(body.reference_audio_base64);
        const refBlob = new Blob([refBytes], { type: "audio/mpeg" });
        fd.append("reference_audio", refBlob, "reference.mp3");
      }

      const headers: Record<string, string> = {};
      if (ACESTEP_KEY) headers["Authorization"] = `Bearer ${ACESTEP_KEY}`;
      // Don't set Content-Type for FormData — browser sets it with boundary

      fetchOptions = {
        method: method || "POST",
        headers,
        body: fd,
      };
    } else {
      // Standard JSON request
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ACESTEP_KEY) headers["Authorization"] = `Bearer ${ACESTEP_KEY}`;

      fetchOptions = {
        method: method || "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      };
    }

    const res = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

    const contentType = res.headers.get("content-type") || "";

    // For audio/binary responses, stream them through
    if (contentType.includes("audio") || contentType.includes("octet-stream")) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
        },
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
