const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function transcribeWithElevenLabs(audioBlob: Blob): Promise<string> {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) throw new Error('ElevenLabs API key is not configured');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp3');
  formData.append('model_id', 'scribe_v2');
  formData.append('tag_audio_events', 'false');
  formData.append('diarize', 'false');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Scribe API error:', res.status, errorText);
    if (res.status === 429) throw new Error('Rate limit exceeded. Try again later.');
    throw new Error(`ElevenLabs transcription failed: ${res.status}`);
  }

  const transcription = await res.json();
  return transcription.text?.trim() || '';
}

async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key is not configured');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Whisper API error:', res.status, errorText);
    if (res.status === 429) throw new Error('Rate limit exceeded. Try again later.');
    throw new Error(`OpenAI Whisper transcription failed: ${res.status}`);
  }

  const text = await res.text();
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { song_id, audio_url, provider } = await req.json();
    const sttProvider = provider || 'elevenlabs';

    if (!song_id || !audio_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'song_id and audio_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribing lyrics for song ${song_id} via ${sttProvider} from ${audio_url.slice(0, 80)}...`);

    // Download the audio file
    const audioRes = await fetch(audio_url);
    if (!audioRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to download audio file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioBlob = await audioRes.blob();

    // Transcribe with selected provider
    let lyrics: string;
    try {
      if (sttProvider === 'openai') {
        lyrics = await transcribeWithWhisper(audioBlob);
      } else {
        lyrics = await transcribeWithElevenLabs(audioBlob);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed';
      const status = message.includes('Rate limit') ? 429 : 500;
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lyrics) {
      console.log('No speech detected in audio');
      return new Response(
        JSON.stringify({ success: true, lyrics: '', message: 'No vocals detected — likely instrumental' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribed ${lyrics.length} characters of lyrics via ${sttProvider}`);

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
