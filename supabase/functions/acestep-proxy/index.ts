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

/** Write bytes to a temp file, return the path */
async function writeTempFile(bytes: Uint8Array, name: string): Promise<string> {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/${name}`;
  await Deno.writeFile(path, bytes);
  return path;
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

    // Check if body contains base64 audio that needs file handling
    const hasBase64Audio = body && (body.src_audio_base64 || body.reference_audio_base64);

    let fetchOptions: RequestInit;
    const tempFiles: string[] = [];

    if (hasBase64Audio && endpoint === "/release_task") {
      // Build FormData for file uploads to ACE-Step
      const fd = new FormData();

      // Write base64 audio to temp files and attach
      if (body.src_audio_base64) {
        const bytes = base64ToBytes(body.src_audio_base64);
        const path = await writeTempFile(bytes, "source.mp3");
        tempFiles.push(path);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        fd.append("src_audio", blob, "source.mp3");
      }
      if (body.reference_audio_base64) {
        const bytes = base64ToBytes(body.reference_audio_base64);
        const path = await writeTempFile(bytes, "reference.mp3");
        tempFiles.push(path);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        fd.append("reference_audio", blob, "reference.mp3");
      }

      // Add remaining fields — ensure correct types for Python backend
      const intFields = new Set(["audio_duration", "batch_size", "inference_steps", "repainting_start", "repainting_end"]);
      const floatFields = new Set(["audio_cover_strength"]);

      for (const [key, value] of Object.entries(body)) {
        if (key === "src_audio_base64" || key === "reference_audio_base64") continue;
        if (intFields.has(key)) {
          fd.append(key, String(Math.round(Number(value))));
        } else if (floatFields.has(key)) {
          fd.append(key, String(Number(value)));
        } else if (key === "thinking") {
          // Python expects string "true"/"false" for bool parsing
          fd.append(key, value ? "true" : "false");
        } else {
          fd.append(key, String(value ?? ""));
        }
      }

      const headers: Record<string, string> = {};
      if (ACESTEP_KEY) headers["Authorization"] = `Bearer ${ACESTEP_KEY}`;

      fetchOptions = { method: "POST", headers, body: fd };
    } else {
      // Standard JSON request — ensure numeric types
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ACESTEP_KEY) headers["Authorization"] = `Bearer ${ACESTEP_KEY}`;

      // Coerce types for release_task JSON requests too
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

      fetchOptions = {
        method: method || "GET",
        headers,
        body: jsonBody ? JSON.stringify(jsonBody) : undefined,
      };
    }

    const res = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

    // Clean up temp files
    for (const f of tempFiles) {
      try { await Deno.remove(f); } catch { /* ignore */ }
    }

    const contentType = res.headers.get("content-type") || "";

    // For audio/binary responses, stream them through
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
