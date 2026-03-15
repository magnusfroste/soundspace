import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import lamejs from "https://esm.sh/lamejs@1.2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function wavToMp3(wavBuffer: ArrayBuffer): Uint8Array {
  const dv = new DataView(wavBuffer);
  const numChannels = dv.getUint16(22, true);
  const sampleRate = dv.getUint32(24, true);
  const bitsPerSample = dv.getUint16(34, true);

  // Find "data" chunk — walk chunks from offset 12
  let dataOffset = -1;
  let dataSize = 0;

  // Log first 4 bytes to verify RIFF header
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  console.log(`WAV header: magic="${magic}", ch=${numChannels}, sr=${sampleRate}, bps=${bitsPerSample}, fileSize=${wavBuffer.byteLength}`);

  // Structured chunk walk
  let pos = 12;
  let chunkCount = 0;
  while (pos < dv.byteLength - 8 && chunkCount < 100) {
    const c0 = dv.getUint8(pos), c1 = dv.getUint8(pos+1), c2 = dv.getUint8(pos+2), c3 = dv.getUint8(pos+3);
    const chunkId = String.fromCharCode(c0, c1, c2, c3);
    const chunkSize = dv.getUint32(pos + 4, true);
    console.log(`  Chunk "${chunkId}" at ${pos}, size=${chunkSize}`);
    chunkCount++;

    if (chunkId === "data") {
      dataOffset = pos + 8;
      dataSize = chunkSize;
      break;
    }

    // Validate chunkSize to prevent infinite loop
    if (chunkSize > wavBuffer.byteLength || chunkSize < 0) {
      console.log(`  Invalid chunk size, falling back to byte scan`);
      break;
    }

    // Move to next chunk (word-aligned)
    pos += 8 + chunkSize + (chunkSize % 2);
  }

  // Fallback: full byte scan for "data"
  if (dataOffset < 0) {
    console.log(`Structured walk failed, scanning entire file for 'data' marker...`);
    for (let i = 12; i < dv.byteLength - 8; i++) {
      if (dv.getUint8(i) === 0x64 && dv.getUint8(i+1) === 0x61 &&
          dv.getUint8(i+2) === 0x74 && dv.getUint8(i+3) === 0x61) {
        dataSize = dv.getUint32(i + 4, true);
        dataOffset = i + 8;
        console.log(`  Found 'data' at byte ${i}, size=${dataSize}`);
        break;
      }
    }
  }

  if (dataOffset < 0 || dataOffset >= dv.byteLength) {
    throw new Error(`WAV data chunk not found (fileSize=${wavBuffer.byteLength})`);
  }

  // Use dataSize if valid, otherwise use remaining bytes
  const availableBytes = wavBuffer.byteLength - dataOffset;
  const pcmBytes = (dataSize > 0 && dataSize <= availableBytes) ? dataSize : availableBytes;

  const bytesPerSample = bitsPerSample / 8;
  if (bytesPerSample <= 0 || numChannels <= 0) {
    throw new Error(`Invalid WAV: bps=${bitsPerSample}, ch=${numChannels}`);
  }
  const samplesPerChannel = Math.floor(pcmBytes / (bytesPerSample * numChannels));
  if (samplesPerChannel <= 0) {
    throw new Error(`No PCM samples: pcmBytes=${pcmBytes}, bps=${bytesPerSample}, ch=${numChannels}`);
  }

  const left = new Int16Array(samplesPerChannel);
  const right = numChannels > 1 ? new Int16Array(samplesPerChannel) : left;

  for (let i = 0; i < samplesPerChannel; i++) {
    const off = dataOffset + i * numChannels * bytesPerSample;
    if (off + numChannels * bytesPerSample > dv.byteLength) break;

    if (bitsPerSample === 16) {
      left[i] = dv.getInt16(off, true);
      if (numChannels > 1) right[i] = dv.getInt16(off + 2, true);
    } else if (bitsPerSample === 32) {
      left[i] = Math.max(-32768, Math.min(32767, Math.round(dv.getFloat32(off, true) * 32767)));
      if (numChannels > 1) right[i] = Math.max(-32768, Math.min(32767, Math.round(dv.getFloat32(off + 4, true) * 32767)));
    } else if (bitsPerSample === 24) {
      let v = (dv.getUint8(off+2) << 16) | (dv.getUint8(off+1) << 8) | dv.getUint8(off);
      if (v & 0x800000) v |= ~0xFFFFFF;
      left[i] = v >> 8;
      if (numChannels > 1) {
        const o2 = off + 3;
        let v2 = (dv.getUint8(o2+2) << 16) | (dv.getUint8(o2+1) << 8) | dv.getUint8(o2);
        if (v2 & 0x800000) v2 |= ~0xFFFFFF;
        right[i] = v2 >> 8;
      }
    }
  }

  const enc = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < samplesPerChannel; i += 1152) {
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

  const { data: wavSongs, error } = await sb
    .from("songs")
    .select("id, title, file_url")
    .like("file_url", "%.wav%");

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

  console.log(`Found ${wavSongs.length} WAV files to convert`);
  const results: { id: string; title: string; status: string; wavSize?: number; mp3Size?: number }[] = [];

  for (const song of wavSongs) {
    try {
      const urlParts = song.file_url.split("/storage/v1/object/public/songs/");
      if (urlParts.length < 2) {
        results.push({ id: song.id, title: song.title, status: "skip: can't parse path" });
        continue;
      }
      const storagePath = decodeURIComponent(urlParts[1]);

      console.log(`Downloading: ${song.title} (${storagePath})`);
      const { data: wavData, error: dlErr } = await sb.storage.from("songs").download(storagePath);
      if (dlErr || !wavData) {
        results.push({ id: song.id, title: song.title, status: `download error: ${dlErr?.message}` });
        continue;
      }

      const wavBuffer = await wavData.arrayBuffer();
      const wavSize = wavBuffer.byteLength;

      console.log(`Converting: ${song.title} (${wavSize} bytes, ch=${new DataView(wavBuffer).getUint16(22,true)}, sr=${new DataView(wavBuffer).getUint32(24,true)}, bps=${new DataView(wavBuffer).getUint16(34,true)})`);
      const mp3Data = wavToMp3(wavBuffer);
      const mp3Size = mp3Data.length;
      console.log(`Converted: ${wavSize} → ${mp3Size} bytes (${Math.round(mp3Size / wavSize * 100)}%)`);

      const mp3Path = storagePath.replace(/\.wav$/, ".mp3");
      const { error: upErr } = await sb.storage.from("songs").upload(mp3Path, mp3Data, {
        contentType: "audio/mpeg", upsert: true,
      });
      if (upErr) {
        results.push({ id: song.id, title: song.title, status: `upload error: ${upErr.message}` });
        continue;
      }

      const { data: urlData } = sb.storage.from("songs").getPublicUrl(mp3Path);
      const { error: updateErr } = await sb
        .from("songs")
        .update({ file_url: urlData.publicUrl })
        .eq("id", song.id);

      if (updateErr) {
        results.push({ id: song.id, title: song.title, status: `db update error: ${updateErr.message}` });
        continue;
      }

      await sb.storage.from("songs").remove([storagePath]);
      results.push({ id: song.id, title: song.title, status: "converted", wavSize, mp3Size });
      console.log(`✓ ${song.title}`);
    } catch (e) {
      results.push({ id: song.id, title: song.title, status: `error: ${e.message}` });
      console.error(`✗ ${song.title}: ${e.message}`);
    }
  }

  const converted = results.filter(r => r.status === "converted").length;
  const totalSaved = results
    .filter(r => r.status === "converted")
    .reduce((s, r) => s + ((r.wavSize || 0) - (r.mp3Size || 0)), 0);

  return new Response(JSON.stringify({
    converted, total: wavSongs.length,
    savedBytes: totalSaved,
    savedMB: Math.round(totalSaved / 1024 / 1024),
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
