const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUNO_API = 'https://studio-api.suno.ai/api/feed/';

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
    const fileExt = audioUrl.includes('.wav') ? 'wav' : 'mp3';
    const fileName = `suno-${songId}.${fileExt}`;

    // Upload to Supabase Storage
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: uploadError } = await supabase.storage
      .from('songs')
      .upload(fileName, audioBlob, {
        contentType: fileExt === 'wav' ? 'audio/wav' : 'audio/mpeg',
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
