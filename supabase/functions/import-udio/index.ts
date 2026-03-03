const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UDIO_API = 'https://www.udio.com/api/songs';

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

    // Extract song ID from Udio URL
    const match = url.match(/udio\.com\/songs\/([\w-]+)/);
    if (!match) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Udio URL. Expected format: https://www.udio.com/songs/<song-id>' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const songId = match[1];
    console.log('Fetching Udio song:', songId);

    // Fetch song metadata from Udio API
    const metaRes = await fetch(`${UDIO_API}?songIds=${songId}`);
    if (!metaRes.ok) {
      console.error('Udio API response:', metaRes.status);
      return new Response(
        JSON.stringify({ success: false, error: `Udio API returned ${metaRes.status}. The song may be private or not exist.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metaData = await metaRes.json();
    const song = metaData?.songs?.[0];
    if (!song) {
      return new Response(
        JSON.stringify({ success: false, error: 'Song not found on Udio' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const title = song.title || 'Untitled';
    const artist = song.artist || 'Unknown Artist';
    const audioUrl = song.song_path; // CDN URL to the audio file
    const coverUrl = song.image_path || null;
    const duration = Math.round(song.duration || 0);
    const tags = song.tags || [];

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
        JSON.stringify({ success: false, error: 'Failed to download audio from Udio CDN' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioBlob = await audioRes.arrayBuffer();
    const fileExt = audioUrl.includes('.wav') ? 'wav' : 'mp3';
    const fileName = `udio-${songId}.${fileExt}`;

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

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('songs')
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData.publicUrl;

    // Derive genre/mood from tags
    const genre = tags[0] || null;
    const mood = tags[1] || null;

    // Insert into songs table
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
        origin_source: 'udio_import',
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
