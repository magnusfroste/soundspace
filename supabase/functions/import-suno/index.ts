import lamejs from "https://esm.sh/lamejs@1.2.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUNO_API = 'https://studio-api.suno.ai/api/feed/';

/** Convert WAV ArrayBuffer to MP3 Uint8Array (128 kbps) */
function wavToMp3(wavBuffer: ArrayBuffer): Uint8Array {
  const dv = new DataView(wavBuffer);
  const numChannels = dv.getUint16(22, true);
  const sampleRate = dv.getUint32(24, true);
  const bitsPerSample = dv.getUint16(34, true);
  let dataOffset = 12;
  while (dataOffset < dv.byteLength - 8) {
    const id = String.fromCharCode(dv.getUint8(dataOffset), dv.getUint8(dataOffset+1), dv.getUint8(dataOffset+2), dv.getUint8(dataOffset+3));
    const sz = dv.getUint32(dataOffset + 4, true);
    if (id === "data") { dataOffset += 8; break; }
    dataOffset += 8 + sz;
  }
  const bps = bitsPerSample / 8;
  const samplesPerCh = Math.floor((wavBuffer.byteLength - dataOffset) / bps / numChannels);
  const left = new Int16Array(samplesPerCh);
  const right = numChannels > 1 ? new Int16Array(samplesPerCh) : left;
  for (let i = 0; i < samplesPerCh; i++) {
    const off = dataOffset + i * numChannels * bps;
    if (bitsPerSample === 16) {
      left[i] = dv.getInt16(off, true);
      if (numChannels > 1) right[i] = dv.getInt16(off + 2, true);
    } else if (bitsPerSample === 32) {
      left[i] = Math.max(-32768, Math.min(32767, Math.round(dv.getFloat32(off, true) * 32767)));
      if (numChannels > 1) right[i] = Math.max(-32768, Math.min(32767, Math.round(dv.getFloat32(off + 4, true) * 32767)));
    } else {
      const b = off; let v = (dv.getUint8(b+2)<<16)|(dv.getUint8(b+1)<<8)|dv.getUint8(b);
      if (v & 0x800000) v |= ~0xFFFFFF; left[i] = v >> 8;
      if (numChannels > 1) { const b2=off+3; let v2=(dv.getUint8(b2+2)<<16)|(dv.getUint8(b2+1)<<8)|dv.getUint8(b2); if(v2&0x800000)v2|=~0xFFFFFF; right[i]=v2>>8; }
    }
  }
  const enc = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < samplesPerCh; i += 1152) {
    const l = left.subarray(i, i+1152);
    const r = numChannels > 1 ? right.subarray(i, i+1152) : l;
    const buf = numChannels > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (buf.length > 0) parts.push(new Uint8Array(buf));
  }
  const flush = enc.flush();
  if (flush.length > 0) parts.push(new Uint8Array(flush));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract song ID from Suno URL — supports suno.com/song/<id> and suno.com/s/<id>
    const match = url.match(/suno\.com\/(?:song|s)\/([\w-]+)/);
    if (!match) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Suno URL. Expected format: https://suno.com/song/<song-id>' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const songId = match[1];
    console.log('Fetching Suno song:', songId);

    // Fetch song metadata from Suno public feed API
    const metaRes = await fetch(`${SUNO_API}${songId}`);
    if (!metaRes.ok) {
      console.error('Suno API response:', metaRes.status);
      return new Response(
        JSON.stringify({ success: false, error: `Suno API returned ${metaRes.status}. The song may be private or not exist.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metaData = await metaRes.json();
    // Suno feed returns an array or a single object
    const songs = Array.isArray(metaData) ? metaData : [metaData];
    const song = songs[0];
    if (!song) {
      return new Response(
        JSON.stringify({ success: false, error: 'Song not found on Suno' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const title = song.title || 'Untitled';
    const artist = song.display_name || song.handle || 'Unknown Artist';
    const audioUrl = song.audio_url || song.song_path;
    const coverUrl = song.image_url || song.image_large_url || null;
    const duration = Math.round(song.duration || song.metadata?.duration || 0);
    const tags = song.metadata?.tags ? (typeof song.metadata.tags === 'string' ? song.metadata.tags.split(',').map((t: string) => t.trim()) : song.metadata.tags) : [];
    const prompt = song.metadata?.prompt || song.prompt || null;

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'No audio URL found for this song' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Downloading audio: ${title} by ${artist} (${duration}s)`);

    // Download the audio file
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to download audio from Suno CDN' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioBlob = await audioRes.arrayBuffer();
    const isWav = audioUrl.includes('.wav') || audioRes.headers.get('content-type')?.includes('audio/wav');

    let uploadData: Uint8Array | ArrayBuffer = audioBlob;
    let contentType = 'audio/mpeg';
    const fileName = `suno-${songId}.mp3`;

    if (isWav) {
      console.log(`Converting WAV (${audioBlob.byteLength} bytes) to MP3...`);
      uploadData = wavToMp3(audioBlob);
      console.log(`Converted to MP3: ${(uploadData as Uint8Array).length} bytes`);
    } else {
      uploadData = new Uint8Array(audioBlob);
    }

    // Upload to Supabase Storage
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: uploadError } = await supabase.storage
      .from('songs')
      .upload(fileName, uploadData, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to upload audio to storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('songs')
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData.publicUrl;

    const genre = tags[0] || null;
    const mood = tags[1] || null;

    const { data: insertedSong, error: insertError } = await supabase
      .from('songs')
      .insert({
        title,
        artist,
        file_url: fileUrl,
        cover_url: coverUrl,
        duration,
        genre,
        mood,
        prompt,
        origin_source: 'suno_import',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save song to catalog' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Song imported successfully:', insertedSong.id);

    return new Response(
      JSON.stringify({
        success: true,
        title,
        artist,
        duration,
        song_id: insertedSong.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
