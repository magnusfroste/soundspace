const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { song_id, audio_url } = await req.json();

    if (!song_id || !audio_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'song_id and audio_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'ElevenLabs API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribing lyrics for song ${song_id} from ${audio_url.slice(0, 80)}...`);

    // Download the audio file
    const audioRes = await fetch(audio_url);
    if (!audioRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to download audio file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioBlob = await audioRes.blob();

    // Send to ElevenLabs Scribe v2 for transcription
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model_id', 'scribe_v2');
    formData.append('tag_audio_events', 'false');
    formData.append('diarize', 'false');

    const scribeRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!scribeRes.ok) {
      const errorText = await scribeRes.text();
      console.error('Scribe API error:', scribeRes.status, errorText);

      if (scribeRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `Transcription failed: ${scribeRes.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcription = await scribeRes.json();
    const lyrics = transcription.text?.trim() || '';

    if (!lyrics) {
      console.log('No speech detected in audio');
      return new Response(
        JSON.stringify({ success: true, lyrics: '', message: 'No vocals detected — likely instrumental' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribed ${lyrics.length} characters of lyrics`);

    // Update the song record with lyrics
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error: updateError } = await supabase
      .from('songs')
      .update({ lyrics })
      .eq('id', song_id);

    if (updateError) {
      console.error('Failed to update song with lyrics:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Transcription succeeded but failed to save lyrics' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, lyrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
