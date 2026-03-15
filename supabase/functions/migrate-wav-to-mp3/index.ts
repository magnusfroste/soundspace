import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FLACDecoder } from "https://esm.sh/@nickytonline/flac-decoder@0.4.3";
import lamejs from "https://esm.sh/lamejs@1.2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function pcmToMp3(channelData: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = channelData.length;
  const samplesPerCh = channelData[0].length;

  // Convert Float32 → Int16
  const left = new Int16Array(samplesPerCh);
  const right = numChannels > 1 ? new Int16Array(samplesPerCh) : left;
  for (let i = 0; i < samplesPerCh; i++) {
    left[i] = Math.max(-32768, Math.min(32767, Math.round(channelData[0][i] * 32767)));
    if (numChannels > 1) {
      right[i] = Math.max(-32768, Math.min(32767, Math.round(channelData[1][i] * 32767)));
    }
  }

  const enc = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < samplesPerCh; i += 1152) {
    const l = left.subarray(i, i + 1152);
    const r = numChannels > 1 ? right.subarray(i, i + 1152) : l;
    const buf = numChannels > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (buf.length > 0) parts.push(new Uint8Array(buf));
  }
  const flush = enc.flush();
  if (flush.length > 0) parts.push(new Uint8Array(flush));

  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // Accept optional limit param
  let limit = 50;
  try {
    const body = await req.json();
    if (body?.limit) limit = body.limit;
  } catch { /* no body */ }

  const { data: wavSongs, error } = await sb
    .from("songs")
    .select("id, title, file_url")
    .like("file_url", "%.wav%")
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!wavSongs || wavSongs.length === 0) {
    return new Response(JSON.stringify({ message: "No WAV files to convert", converted: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Found ${wavSongs.length} files to convert`);

  // Initialize FLAC decoder once
  const flacDecoder = new FLACDecoder();
  await flacDecoder.ready;

  const results: { id: string; title: string; status: string; originalSize?: number; mp3Size?: number }[] = [];

  for (const song of wavSongs) {
    try {
      const urlParts = song.file_url.split("/storage/v1/object/public/songs/");
      if (urlParts.length < 2) {
        results.push({ id: song.id, title: song.title, status: "skip: can't parse path" });
        continue;
      }
      const storagePath = decodeURIComponent(urlParts[1]);

      console.log(`Downloading: ${song.title} (${storagePath})`);
      const { data: fileData, error: dlErr } = await sb.storage.from("songs").download(storagePath);
      if (dlErr || !fileData) {
        results.push({ id: song.id, title: song.title, status: `download error: ${dlErr?.message}` });
        continue;
      }

      const fileBuffer = await fileData.arrayBuffer();
      const originalSize = fileBuffer.byteLength;
      const fileBytes = new Uint8Array(fileBuffer);

      // Detect format: FLAC starts with "fLaC", WAV with "RIFF"
      const magic = String.fromCharCode(fileBytes[0], fileBytes[1], fileBytes[2], fileBytes[3]);
      console.log(`${song.title}: format=${magic}, size=${originalSize}`);

      let mp3Data: Uint8Array;

      if (magic === "fLaC") {
        // FLAC → PCM → MP3
        const decoded = await flacDecoder.decode(fileBytes);
        console.log(`FLAC decoded: ${decoded.samplesDecoded} samples, ${decoded.sampleRate}Hz, ${decoded.channelData.length}ch`);
        mp3Data = pcmToMp3(decoded.channelData, decoded.sampleRate);
        // Free decoder state for next file
        await flacDecoder.reset();
      } else if (magic === "RIFF") {
        // Actual WAV — parse header
        const dv = new DataView(fileBuffer);
        const numChannels = dv.getUint16(22, true);
        const sampleRate = dv.getUint32(24, true);
        const bitsPerSample = dv.getUint16(34, true);

        // Find data chunk
        let dataOffset = 12;
        while (dataOffset < dv.byteLength - 8) {
          const chunkId = String.fromCharCode(dv.getUint8(dataOffset), dv.getUint8(dataOffset+1), dv.getUint8(dataOffset+2), dv.getUint8(dataOffset+3));
          const chunkSize = dv.getUint32(dataOffset + 4, true);
          if (chunkId === "data") { dataOffset += 8; break; }
          if (chunkSize > fileBuffer.byteLength) break;
          dataOffset += 8 + chunkSize + (chunkSize % 2);
        }

        const bps = bitsPerSample / 8;
        const samplesPerCh = Math.floor((fileBuffer.byteLength - dataOffset) / (bps * numChannels));
        const chData: Float32Array[] = [new Float32Array(samplesPerCh)];
        if (numChannels > 1) chData.push(new Float32Array(samplesPerCh));

        for (let i = 0; i < samplesPerCh; i++) {
          const off = dataOffset + i * numChannels * bps;
          if (off + bps > dv.byteLength) break;
          if (bitsPerSample === 16) {
            chData[0][i] = dv.getInt16(off, true) / 32768;
            if (numChannels > 1) chData[1][i] = dv.getInt16(off + 2, true) / 32768;
          } else if (bitsPerSample === 32) {
            chData[0][i] = dv.getFloat32(off, true);
            if (numChannels > 1) chData[1][i] = dv.getFloat32(off + 4, true);
          }
        }
        mp3Data = pcmToMp3(chData, sampleRate);
      } else {
        results.push({ id: song.id, title: song.title, status: `skip: unknown format (${magic})` });
        continue;
      }

      const mp3Size = mp3Data.length;
      console.log(`Converted: ${originalSize} → ${mp3Size} bytes (${Math.round(mp3Size / originalSize * 100)}%)`);

      // Upload MP3
      const mp3Path = storagePath.replace(/\.wav$/, ".mp3");
      const { error: upErr } = await sb.storage.from("songs").upload(mp3Path, mp3Data, {
        contentType: "audio/mpeg", upsert: true,
      });
      if (upErr) {
        results.push({ id: song.id, title: song.title, status: `upload error: ${upErr.message}` });
        continue;
      }

      const { data: urlData } = sb.storage.from("songs").getPublicUrl(mp3Path);

      // Update DB
      const { error: updateErr } = await sb.from("songs").update({ file_url: urlData.publicUrl }).eq("id", song.id);
      if (updateErr) {
        results.push({ id: song.id, title: song.title, status: `db error: ${updateErr.message}` });
        continue;
      }

      // Remove old file
      await sb.storage.from("songs").remove([storagePath]);
      results.push({ id: song.id, title: song.title, status: "converted", originalSize, mp3Size });
      console.log(`✓ ${song.title}`);
    } catch (e) {
      results.push({ id: song.id, title: song.title, status: `error: ${e.message}` });
      console.error(`✗ ${song.title}: ${e.message}`);
    }
  }

  const converted = results.filter(r => r.status === "converted").length;
  const totalSaved = results
    .filter(r => r.status === "converted")
    .reduce((s, r) => s + ((r.originalSize || 0) - (r.mp3Size || 0)), 0);

  return new Response(JSON.stringify({
    converted, total: wavSongs.length,
    savedBytes: totalSaved,
    savedMB: Math.round(totalSaved / 1024 / 1024),
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
