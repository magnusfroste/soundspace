const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const agentCard = {
    protocol: "a2a/1.0",
    agent: "SoundSpace",
    status: "online",
    endpoint: `${supabaseUrl}/functions/v1/a2a-negotiate`,
    skills: [
      {
        id: "generate_track",
        name: "Generate Track",
        description: "Generate custom AI music tracks via SoundAgent",
        input_schema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Detailed description of the music to generate" },
            duration: { type: "number", description: "Duration in seconds (3-300, default 180)" },
            context: { type: "object", description: "Optional context: venue type, time of day, energy level" },
          },
          required: ["prompt"],
        },
      },
      {
        id: "upload_song",
        name: "Upload Song",
        description: "Upload a finished song (provide an audio URL + metadata) directly to the SoundSpace library. The audio is downloaded and stored permanently.",
        input_schema: {
          type: "object",
          properties: {
            audio_url: { type: "string", description: "Public URL to the audio file (mp3, wav, flac)" },
            title: { type: "string", description: "Song title" },
            artist: { type: "string", description: "Artist name (default: OpenClaw)" },
            genre: { type: "string", description: "Genre tag" },
            mood: { type: "string", description: "Mood tag" },
            bpm: { type: "number", description: "Beats per minute" },
            key_scale: { type: "string", description: "Musical key (e.g. 'C Major', 'A Minor')" },
            time_signature: { type: "string", description: "Time signature (e.g. '4/4')" },
            duration: { type: "number", description: "Duration in seconds" },
            cover_url: { type: "string", description: "URL to cover art image" },
            lyrics: { type: "string", description: "Song lyrics" },
            prompt: { type: "string", description: "Original generation prompt" },
            origin_source: { type: "string", description: "Origin tag (default: a2a_upload)" },
          },
          required: ["audio_url", "title"],
        },
      },
      {
        id: "list_playlists",
        name: "List Playlists",
        description: "List all available playlists in SoundSpace",
        input_schema: { type: "object", properties: {} },
      },
      {
        id: "add_to_playlist",
        name: "Add to Playlist",
        description: "Add an existing song to a playlist",
        input_schema: {
          type: "object",
          properties: {
            song_id: { type: "string", description: "UUID of the song to add" },
            playlist_id: { type: "string", description: "UUID of the target playlist" },
          },
          required: ["song_id", "playlist_id"],
        },
      },
      {
        id: "list_songs",
        name: "List Songs",
        description: "List songs in the library with optional filters",
        input_schema: {
          type: "object",
          properties: {
            genre: { type: "string", description: "Filter by genre (partial match)" },
            mood: { type: "string", description: "Filter by mood (partial match)" },
            artist: { type: "string", description: "Filter by artist (partial match)" },
            limit: { type: "number", description: "Max results (default 50)" },
          },
        },
      },
    ],
    accepts: ["task", "query", "ping"],
    meta: {
      name: "SoundSpace Music Agent",
      description:
        "AI-powered background music platform for commercial spaces. Upload tracks, manage playlists, and generate new music.",
      version: "2.0.0",
    },
  };

  return new Response(JSON.stringify(agentCard, null, 2), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
});
