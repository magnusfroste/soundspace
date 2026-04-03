import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import lamejs from "https://esm.sh/lamejs@1.2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Audio format detection + WAV→MP3 compression ───────────────────────

function detectAndOptimize(buffer: ArrayBuffer): { ext: string; mime: string; data: Uint8Array } {
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);

  if (magic === "fLaC") {
    return { ext: "flac", mime: "audio/flac", data: bytes };
  }
  if (magic === "RIFF") {
    return { ext: "mp3", mime: "audio/mpeg", data: wavToMp3(buffer) };
  }
  if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) {
    return { ext: "mp3", mime: "audio/mpeg", data: bytes };
  }
  // ACE-Step default → FLAC
  return { ext: "flac", mime: "audio/flac", data: bytes };
}

function wavToMp3(wavBuffer: ArrayBuffer): Uint8Array {
  const dv = new DataView(wavBuffer);
  const numChannels = dv.getUint16(22, true);
  const sampleRate = dv.getUint32(24, true);
  const bitsPerSample = dv.getUint16(34, true);

  let dataOffset = 12;
  while (dataOffset < dv.byteLength - 8) {
    const chunkId = String.fromCharCode(
      dv.getUint8(dataOffset), dv.getUint8(dataOffset + 1),
      dv.getUint8(dataOffset + 2), dv.getUint8(dataOffset + 3),
    );
    const chunkSize = dv.getUint32(dataOffset + 4, true);
    if (chunkId === "data") { dataOffset += 8; break; }
    dataOffset += 8 + chunkSize;
  }

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor((wavBuffer.byteLength - dataOffset) / bytesPerSample);
  const samplesPerChannel = Math.floor(totalSamples / numChannels);

  const left = new Int16Array(samplesPerChannel);
  const right = numChannels > 1 ? new Int16Array(samplesPerChannel) : left;

  for (let i = 0; i < samplesPerChannel; i++) {
    const offset = dataOffset + i * numChannels * bytesPerSample;
    if (bitsPerSample === 16) {
      left[i] = dv.getInt16(offset, true);
      if (numChannels > 1) right[i] = dv.getInt16(offset + 2, true);
    } else if (bitsPerSample === 32) {
      const lf = dv.getFloat32(offset, true);
      left[i] = Math.max(-32768, Math.min(32767, Math.round(lf * 32767)));
      if (numChannels > 1) {
        const rf = dv.getFloat32(offset + 4, true);
        right[i] = Math.max(-32768, Math.min(32767, Math.round(rf * 32767)));
      }
    } else {
      const b0 = dv.getUint8(offset);
      const b1 = dv.getUint8(offset + 1);
      const b2 = dv.getUint8(offset + 2);
      let val = (b2 << 16) | (b1 << 8) | b0;
      if (val & 0x800000) val |= ~0xFFFFFF;
      left[i] = val >> 8;
      if (numChannels > 1) {
        const o2 = offset + 3;
        let v2 = (dv.getUint8(o2 + 2) << 16) | (dv.getUint8(o2 + 1) << 8) | dv.getUint8(o2);
        if (v2 & 0x800000) v2 |= ~0xFFFFFF;
        right[i] = v2 >> 8;
      }
    }
  }

  const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
  const mp3Parts: Uint8Array[] = [];
  const BLOCK = 1152;

  for (let i = 0; i < samplesPerChannel; i += BLOCK) {
    const lChunk = left.subarray(i, i + BLOCK);
    const rChunk = numChannels > 1 ? right.subarray(i, i + BLOCK) : lChunk;
    const mp3buf = numChannels > 1
      ? mp3Encoder.encodeBuffer(lChunk, rChunk)
      : mp3Encoder.encodeBuffer(lChunk);
    if (mp3buf.length > 0) mp3Parts.push(new Uint8Array(mp3buf));
  }
  const flush = mp3Encoder.flush();
  if (flush.length > 0) mp3Parts.push(new Uint8Array(flush));

  const totalLen = mp3Parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const p of mp3Parts) { result.set(p, off); off += p.length; }
  return result;
}

// ── Auth: validate Bearer token against site_settings ──────────────────

async function validateApiKey(req: Request, supabaseUrl: string): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const { data } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", "openclaw_api_token")
    .maybeSingle();

  if (!data?.value) return false;
  const stored = typeof data.value === "string" ? data.value : (data.value as Record<string, unknown>).token;
  return stored === token;
}

// ── Main handler ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Auth check
  const isValid = await validateApiKey(req, supabaseUrl);
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: "Unauthorized. Provide a valid Bearer token." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Check if OpenClaw integration is enabled
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sbAdmin = createClient(supabaseUrl, serviceKey);
  const { data: integrationsData } = await sbAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "integrations_enabled")
    .maybeSingle();

  const integrations = (integrationsData?.value as Record<string, boolean>) || {};
  if (integrations.openclaw === false) {
    return new Response(
      JSON.stringify({ error: "OpenClaw integration is disabled. Enable it in Integrations settings." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();

    // ── Validate required fields ──
    const audioUrl = body.audio_url as string | undefined;
    const title = body.title as string | undefined;

    if (!audioUrl || !title) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          required: { audio_url: "string (URL to audio file)", title: "string" },
          optional: {
            artist: "string (default: 'OpenClaw')",
            genre: "string",
            mood: "string",
            bpm: "number",
            key_scale: "string (e.g. 'C major', 'A minor')",
            time_signature: "string (e.g. '4/4')",
            duration: "number (seconds)",
            lyrics: "string",
            prompt: "string (the generation prompt used)",
            cover_url: "string (URL to cover art)",
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = sbAdmin;

    // ── Download audio ──
    console.log(`[upload-song] Downloading: ${audioUrl.slice(0, 120)}`);
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download audio: HTTP ${audioRes.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawBuffer = await audioRes.arrayBuffer();
    const rawSize = rawBuffer.byteLength;
    console.log(`[upload-song] Downloaded ${(rawSize / 1024 / 1024).toFixed(1)} MB`);

    // ── Detect format + compress WAV→MP3 (FLAC & MP3 kept as-is) ──
    const { ext, mime, data } = detectAndOptimize(rawBuffer);
    const compressedSize = data.byteLength;
    console.log(`[upload-song] Format: ${ext}, ${(compressedSize / 1024 / 1024).toFixed(1)} MB${rawSize !== compressedSize ? ` (compressed from ${(rawSize / 1024 / 1024).toFixed(1)} MB)` : ""}`);

    // ── Upload to storage ──
    const filename = `openclaw/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await sb.storage.from("songs").upload(filename, data, {
      contentType: mime,
      upsert: false,
    });

    if (uploadErr) {
      console.error(`[upload-song] Storage upload failed:`, uploadErr);
      return new Response(
        JSON.stringify({ error: `Storage upload failed: ${uploadErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: urlData } = sb.storage.from("songs").getPublicUrl(filename);
    const fileUrl = urlData.publicUrl;
    console.log(`[upload-song] Stored: ${fileUrl}`);

    // ── Insert song record ──
    const songData = {
      title: title.slice(0, 255),
      artist: ((body.artist as string) || "OpenClaw").slice(0, 255),
      genre: (body.genre as string) || null,
      mood: (body.mood as string) || null,
      bpm: typeof body.bpm === "number" ? Math.round(body.bpm) : null,
      key_scale: (body.key_scale as string) || null,
      time_signature: (body.time_signature as string) || null,
      duration: typeof body.duration === "number" ? Math.round(body.duration) : 0,
      file_url: fileUrl,
      cover_url: (body.cover_url as string) || null,
      lyrics: (body.lyrics as string) || null,
      prompt: (body.prompt as string) || null,
      origin_source: "openclaw",
    };

    const { data: song, error: insertErr } = await sb
      .from("songs")
      .insert(songData)
      .select("id, title, artist, genre, mood, bpm, key_scale, duration, file_url")
      .single();

    if (insertErr) {
      console.error(`[upload-song] DB insert failed:`, insertErr);
      return new Response(
        JSON.stringify({ error: `Database insert failed: ${insertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[upload-song] ✅ Song created: ${song.id} — "${song.title}"`);

    return new Response(
      JSON.stringify({
        status: "ok",
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          genre: song.genre,
          mood: song.mood,
          bpm: song.bpm,
          key_scale: song.key_scale,
          duration: song.duration,
          file_url: song.file_url,
          format: ext,
          original_size_mb: +(rawSize / 1024 / 1024).toFixed(2),
          stored_size_mb: +(compressedSize / 1024 / 1024).toFixed(2),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(`[upload-song] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
