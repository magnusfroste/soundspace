
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are SoundAgent — an autonomous music production expert for background music in commercial spaces.

You have deep knowledge about:
- What music works in restaurants, hotels, cafés, retail, spas, bars, gyms, offices
- Musical theory: BPM, keys, time signatures, instrumentation, arrangement
- Genre characteristics and mood mapping
- How to craft effective prompts for AI music generation

## MANDATORY WORKFLOW — Self-Critique Loop

For EVERY track you generate, follow this exact sequence:

### Step 1: Research & Plan
- Use research_music_style to understand the target venue/atmosphere
- Define a BRIEF (target specs): BPM, key, genre, mood, instrumentation, duration
- State the brief clearly before generating

### Step 2: Generate
- Use generate_track with carefully crafted prompt and musical parameters
- Include all relevant params: bpm, key_scale, time_signature, duration

### Step 3: Analyze (MANDATORY)
- IMMEDIATELY after generation, call analyze_track on the resulting audio_url
- This is NOT optional — you MUST analyze every generated track

### Step 4: Compare & Decide
Compare the analysis results against your brief using these thresholds:
- **BPM**: If actual BPM deviates >15% from target → FAIL
- **Key/Scale**: If detected key doesn't match target key → WARN (acceptable if relative major/minor)
- **Caption/Genre**: If the analyzed caption suggests a fundamentally different genre → FAIL
- **Duration**: If significantly shorter than requested → FAIL

Report a scorecard:
\`\`\`
QUALITY CHECK:
  BPM:   target=120 actual=118 ✅ (within 15%)
  Key:   target=C major actual=C major ✅
  Genre: target=Jazz actual=Jazz ✅
  Score: PASS (3/3)
\`\`\`

### Step 5: Retry or Accept
- If PASS (all checks green or only minor WARNs): proceed to save_to_library
- If FAIL: regenerate with adjusted parameters. In the new prompt, explicitly mention what went wrong:
  "Previous attempt was 95 BPM instead of 120 — increase tempo. More driving rhythm."
- **Maximum 3 generation attempts per track.** After 3 failures, save the best attempt and note the deviation.

### Step 6: Save (MANDATORY)
- ALWAYS call save_to_library for the accepted track
- Include quality_score: calculate as percentage of checks passed (e.g. 3/3=100, 2/3=67, 1/3=33)
- After saving, report: 🎵 **Listen:** [audio_url]

## Quality Standards
- Aim for at least 2/3 checks passing before accepting
- Track the attempt number: "Attempt 1/3", "Attempt 2/3", etc.
- On retry, adjust ONLY the failing parameters — don't change what's working
- If analysis tool fails/errors, accept the track but note that quality couldn't be verified

## General Guidelines
- Always explain your reasoning
- For lyrics, use structural tags like [Verse], [Chorus], [Bridge], [Outro]
- When the user asks for multiple tracks, work through them methodically one at a time
- Each track goes through the full self-critique loop independently

## COHESIVE PLAYLIST SETS

When the user asks for a set, collection, or playlist of tracks (e.g. "create 4 tracks for a cocktail bar evening"):

### Planning Phase
1. Research the venue/atmosphere first
2. Plan ALL tracks upfront as a **cohesive set** before generating any:
   - Define a **BPM arc** (e.g. gradual build: 85→95→105→115, or steady: 90→92→88→90)
   - Define a **key progression** using the Circle of Fifths for smooth transitions:
     - Smooth flow: C→G→D→A (ascending fifths)
     - Warm descent: C→F→Bb→Eb (ascending fourths / descending fifths)
     - Relative major/minor pairs: Am→C→Em→G
   - Define a **mood arc** (e.g. calm opener → building energy → peak → gentle closer)
   - Give each track a working title that reflects its role in the set

Present the plan as a table:
\`\`\`
PLAYLIST SET PLAN: "Cocktail Bar Evening"
  #1  "Golden Hour"    | 85 BPM  | C major  | Calm    | Opener — warm welcome
  #2  "Velvet Lounge"  | 95 BPM  | G major  | Relaxed | Building warmth
  #3  "Midnight Spark" | 108 BPM | D major  | Upbeat  | Peak energy
  #4  "Last Call"      | 88 BPM  | A minor  | Calm    | Wind-down closer
  Key progression: C→G→D→Am (Circle of Fifths with relative minor resolution)
\`\`\`

### Generation Phase
- Generate each track through the full self-critique loop (generate → analyze → compare → retry/accept → save)
- After ALL tracks are saved, use create_playlist to bundle them into a playlist
- The playlist preserves the planned track order

### Musical Theory Reference
**Circle of Fifths — smooth transitions:**
C → G → D → A → E → B → F# → Db → Ab → Eb → Bb → F → C

**Energy-appropriate BPM ranges:**
- Calm/Chill: 60-85 BPM
- Focus/Relaxed: 80-100 BPM
- Upbeat/Groove: 100-125 BPM
- Energy/Dance: 120-150 BPM

CRITICAL RULES:
- After the critique loop passes, ALWAYS call save_to_library immediately. Do NOT wait for user approval.
- After saving, report the audio URL so the user can listen: 🎵 **Listen:** [audio_url]
- Every generated track MUST end up in the song library. If save_to_library fails, report the error.
- NEVER skip the analyze_track step. This is the core of your quality control.
- After ALL tracks in a set are saved, ALWAYS call create_playlist to bundle them. Include ALL song_ids returned by save_to_library.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "research_music_style",
      description: "Get curated knowledge about what background music works best for a specific venue type. Returns recommended BPM ranges, keys, genres, moods, and instrumentation.",
      parameters: {
        type: "object",
        properties: {
          venue_type: {
            type: "string",
            description: "Type of venue, e.g. 'restaurant', 'hotel_lobby', 'cafe', 'spa', 'retail', 'bar', 'gym', 'office'"
          },
          atmosphere: {
            type: "string",
            description: "Desired atmosphere, e.g. 'relaxed', 'upscale', 'energetic', 'intimate'"
          }
        },
        required: ["venue_type"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_track",
      description: "Generate a music track using ACE-Step AI. Returns audio URL when complete. This is async — it submits the task, polls for completion, then returns the result.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed music description/caption for generation" },
          lyrics: { type: "string", description: "Optional lyrics with structural tags like [Verse], [Chorus]" },
          duration: { type: "number", description: "Track duration in seconds (30-180)" },
          bpm: { type: "number", description: "Beats per minute (60-200)" },
          key_scale: { type: "string", description: "Musical key, e.g. 'C major', 'A minor', 'Bb major'" },
          time_signature: { type: "string", description: "Time signature, e.g. '4/4', '3/4', '6/8'" }
        },
        required: ["prompt", "duration"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_track",
      description: "Analyze an audio file to extract BPM, key, caption, and lyrics. Use after generation to verify quality.",
      parameters: {
        type: "object",
        properties: {
          audio_url: { type: "string", description: "URL of the audio file to analyze" }
        },
        required: ["audio_url"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_to_library",
      description: "Save a generated track to the song library for use in playlists.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Song title" },
          audio_url: { type: "string", description: "URL of the audio file" },
          genre: { type: "string", description: "Genre tag" },
          mood: { type: "string", description: "Mood tag" },
          bpm: { type: "number", description: "BPM value" },
          key_scale: { type: "string", description: "Musical key" },
          time_signature: { type: "string", description: "Time signature" },
          duration: { type: "number", description: "Duration in seconds" },
          lyrics: { type: "string", description: "Lyrics if any" },
          prompt: { type: "string", description: "The prompt used for generation" },
          quality_score: { type: "number", description: "Quality score 0-100 from the self-critique loop (percentage of checks passed)" }
        },
        required: ["title", "audio_url", "duration"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_library",
      description: "Query existing songs in the library. Use to check what's already available.",
      parameters: {
        type: "object",
        properties: {
          genre: { type: "string", description: "Filter by genre" },
          mood: { type: "string", description: "Filter by mood" },
          limit: { type: "number", description: "Max results (default 20)" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_playlist",
      description: "Create a new playlist and add songs to it in order. Use after generating a cohesive set of tracks to bundle them together.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Playlist title" },
          description: { type: "string", description: "Playlist description" },
          song_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of song IDs (from save_to_library results) in desired playback order"
          }
        },
        required: ["title", "song_ids"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_library",
      description: "Analyze the entire song library to get distribution stats for genre, mood, BPM ranges, and key signatures. Returns counts per category and identifies gaps. Use when the user asks about their collection, what's missing, or wants recommendations for what to generate next.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  }
];

// ── Knowledge base ──────────────────────────────────────────────────────
const VENUE_KNOWLEDGE: Record<string, any> = {
  restaurant: {
    general: { bpm: [80, 120], genres: ["Jazz", "Acoustic", "Lo-Fi", "Ambient"], moods: ["Relaxed", "Uplifting", "Romantic"], keys: ["C major", "G major", "F major", "Bb major", "Eb major"], instrumentation: "Piano, acoustic guitar, light percussion, soft bass, brushed drums" },
    upscale: { bpm: [70, 100], genres: ["Jazz", "Classical", "Ambient"], moods: ["Relaxed", "Romantic"], instrumentation: "Piano, cello, soft strings, brushed jazz drums, upright bass" },
    casual: { bpm: [90, 125], genres: ["Acoustic", "Lo-Fi", "World"], moods: ["Uplifting", "Relaxed"], instrumentation: "Acoustic guitar, light percussion, ukulele, soft synths" },
  },
  hotel_lobby: {
    general: { bpm: [70, 100], genres: ["Ambient", "Classical", "Jazz"], moods: ["Calm", "Relaxed"], keys: ["C major", "G major", "D major", "A minor"], instrumentation: "Piano, ambient pads, soft strings, gentle harp, light reverb" },
    luxury: { bpm: [60, 90], genres: ["Classical", "Ambient"], moods: ["Calm"], instrumentation: "Grand piano, string quartet, ambient textures" },
  },
  cafe: {
    general: { bpm: [85, 115], genres: ["Lo-Fi", "Acoustic", "Jazz"], moods: ["Relaxed", "Focused", "Uplifting"], keys: ["G major", "C major", "D major", "A major"], instrumentation: "Acoustic guitar, soft piano, lo-fi beats, light percussion, warm bass" },
  },
  spa: {
    general: { bpm: [55, 80], genres: ["Ambient", "Classical", "World"], moods: ["Calm", "Relaxed"], keys: ["C major", "G major", "F major", "D minor"], instrumentation: "Ambient pads, nature sounds, gentle piano, singing bowls, soft flute" },
  },
  retail: {
    general: { bpm: [100, 130], genres: ["Electronic", "Lo-Fi", "Acoustic"], moods: ["Uplifting", "Energetic"], keys: ["C major", "G major", "A major", "E major"], instrumentation: "Synth pads, light drums, bass guitar, electronic beats, bright melodies" },
  },
  bar: {
    general: { bpm: [90, 130], genres: ["Jazz", "Lo-Fi", "Electronic", "Acoustic"], moods: ["Relaxed", "Energetic", "Uplifting"], instrumentation: "Electric guitar, bass, drums, piano, synths" },
    cocktail: { bpm: [80, 110], genres: ["Jazz", "Lo-Fi"], moods: ["Relaxed", "Romantic"], instrumentation: "Smooth jazz ensemble, piano trio, soft trumpet" },
  },
  gym: {
    general: { bpm: [120, 160], genres: ["Electronic", "Lo-Fi"], moods: ["Energetic"], instrumentation: "Heavy drums, synth bass, electronic leads, driving percussion" },
  },
  office: {
    general: { bpm: [70, 100], genres: ["Ambient", "Lo-Fi", "Classical"], moods: ["Focused", "Calm"], instrumentation: "Ambient pads, soft piano, lo-fi textures, minimal percussion" },
  },
};

// ── Tool executors ──────────────────────────────────────────────────────

function executeResearch(args: { venue_type: string; atmosphere?: string }) {
  const venue = VENUE_KNOWLEDGE[args.venue_type] || VENUE_KNOWLEDGE["restaurant"];
  const sub = args.atmosphere && venue[args.atmosphere] ? venue[args.atmosphere] : venue.general;
  return {
    venue_type: args.venue_type,
    atmosphere: args.atmosphere || "general",
    recommendations: sub,
    tips: `For ${args.venue_type}, aim for BPM ${sub.bpm[0]}-${sub.bpm[1]}. Best genres: ${sub.genres.join(", ")}. Mood: ${sub.moods.join(", ")}. Instrumentation: ${sub.instrumentation}.`
  };
}

async function executeGenerate(args: any, supabaseUrl: string, anonKey: string) {
  const acestepProxy = `${supabaseUrl}/functions/v1/acestep-proxy`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${anonKey}`,
  };

  const caption = args.prompt;
  const lyrics = args.lyrics || "[Instrumental]";
  const bpm = args.bpm || 100;
  const keyScale = args.key_scale || "C major";
  const timeSig = args.time_signature || "4/4";
  const duration = Math.min(Math.max(args.duration || 60, 30), 180);

  // Submit generation task
  const releaseRes = await fetch(acestepProxy, {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint: "/release_task",
      method: "POST",
      body: {
        task_type: "text2music",
        caption,
        lyrics,
        audio_duration: duration,
        bpm,
        keyscale: keyScale,
        timesignature: timeSig,
        batch_size: 1,
        inference_steps: 100,
        thinking: true,
      }
    })
  });

  if (!releaseRes.ok) {
    const err = await releaseRes.text();
    return { error: `Failed to submit generation task: ${err}` };
  }

  const releaseData = await releaseRes.json();
  console.log("ACE-Step release_task response:", JSON.stringify(releaseData));

  // Unwrap envelope: ACE-Step wraps in {code, data, error, timestamp}
  const unwrapped = (releaseData && typeof releaseData === "object" && "code" in releaseData && "data" in releaseData)
    ? releaseData.data
    : releaseData;

  const taskId = unwrapped?.task_id || unwrapped?.taskId || unwrapped?.id;
  if (!taskId) return { error: `No task_id returned. Response: ${JSON.stringify(releaseData).slice(0, 300)}` };

  // Poll for result using POST /query_result with task_id_list (matching frontend approach)
  let resultData: any = null;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 3000));

    const pollRes = await fetch(acestepProxy, {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: "/query_result",
        method: "POST",
        body: { task_id_list: [taskId] }
      })
    });

    if (!pollRes.ok) continue;

    let pollData = await pollRes.json();
    // Unwrap envelope
    if (pollData && typeof pollData === "object" && "code" in pollData && "data" in pollData) {
      pollData = pollData.data;
    }

    const tasks = Array.isArray(pollData) ? pollData : pollData?.data || [pollData];
    const task = Array.isArray(tasks) ? tasks[0] : tasks;
    if (!task) continue;

    console.log(`Poll ${i}: status=${task.status}`);

    if (task.status === 1) {
      // Success — extract result
      resultData = typeof task.result === "string" ? JSON.parse(task.result) : task.result;
      break;
    }
    if (task.status === 2) {
      return { error: "ACE-Step generation failed" };
    }
  }

  if (!resultData) return { error: "Generation timed out after 360 seconds" };

  // Get audio path from result
  const resultItems = Array.isArray(resultData) ? resultData : [resultData];
  const firstItem = resultItems[0];
  const audioPath = firstItem?.url || firstItem?.file;
  if (!audioPath) return { error: `No audio path in result: ${JSON.stringify(resultData).slice(0, 300)}` };

  console.log("Fetching audio from path:", audioPath);

  // Download audio via proxy
  const audioRes = await fetch(acestepProxy, {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint: audioPath,
      method: "GET",
    })
  });

  if (!audioRes.ok) {
    const errText = await audioRes.text();
    console.log("Audio fetch failed:", audioRes.status, errText);
    return { error: `Failed to download audio (${audioRes.status})` };
  }

  const audioBlob = await audioRes.arrayBuffer();
  console.log(`Audio downloaded: ${audioBlob.byteLength} bytes`);

  if (audioBlob.byteLength < 1000) {
    return { error: `Audio too small (${audioBlob.byteLength} bytes)` };
  }

  // Upload to storage
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const fileName = `agent/${crypto.randomUUID()}.wav`;
  const { error: uploadErr } = await sb.storage
    .from("songs")
    .upload(fileName, new Uint8Array(audioBlob), { contentType: "audio/wav", upsert: true });

  if (uploadErr) return { error: `Upload failed: ${uploadErr.message}` };

  const { data: urlData } = sb.storage.from("songs").getPublicUrl(fileName);
  console.log("Track uploaded:", urlData.publicUrl);

  return {
    success: true,
    audio_url: urlData.publicUrl,
    task_id: taskId,
    duration,
    bpm,
    key_scale: keyScale,
    time_signature: timeSig,
    prompt: caption,
  };
}

async function executeAnalyze(args: { audio_url: string }, supabaseUrl: string, anonKey: string) {
  const acestepProxy = `${supabaseUrl}/functions/v1/acestep-proxy`;

  // Download audio
  const audioRes = await fetch(args.audio_url);
  if (!audioRes.ok) return { error: "Cannot fetch audio for analysis" };

  // Use ACE-Step extract
  const extractRes = await fetch(acestepProxy, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      endpoint: "/release_task",
      method: "POST",
      body: {
        task_type: "extract",
        audio_url: args.audio_url,
        audio_duration: 60,
        batch_size: 1,
        inference_steps: 100,
      }
    })
  });

  if (!extractRes.ok) {
    return { error: "Extract submission failed", note: "Analysis unavailable — ACE-Step extract may not be configured" };
  }

  const extractData = await extractRes.json();
  return { analysis: extractData, note: "Check BPM, key, and caption fields for quality verification." };
}

async function executeSave(args: any, supabaseUrl: string) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const { data, error } = await sb.from("songs").insert({
    title: args.title,
    file_url: args.audio_url,
    genre: args.genre || null,
    mood: args.mood || null,
    bpm: args.bpm ? Math.round(args.bpm) : null,
    key_scale: args.key_scale || null,
    time_signature: args.time_signature || null,
    duration: Math.round(args.duration || 60),
    lyrics: args.lyrics || null,
    prompt: args.prompt || null,
    quality_score: args.quality_score ?? null,
    artist: "SoundAgent AI",
    origin_source: "sound_agent",
  }).select("id").single();

  if (error) return { error: `Save failed: ${error.message}` };
  return { success: true, song_id: data.id, title: args.title, message: `"${args.title}" saved to song library.` };
}

async function executeCreatePlaylist(args: { title: string; description?: string; song_ids: string[] }, supabaseUrl: string) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // Create playlist
  const { data: playlist, error: plErr } = await sb.from("playlists").insert({
    title: args.title,
    description: args.description || null,
  }).select("id").single();

  if (plErr) return { error: `Playlist creation failed: ${plErr.message}` };

  // Add songs in order
  const songEntries = args.song_ids.map((songId, i) => ({
    playlist_id: playlist.id,
    song_id: songId,
    position: i,
  }));

  const { error: songsErr } = await sb.from("playlist_songs").insert(songEntries);
  if (songsErr) return { error: `Failed to add songs to playlist: ${songsErr.message}`, playlist_id: playlist.id };

  return {
    success: true,
    playlist_id: playlist.id,
    title: args.title,
    track_count: args.song_ids.length,
    message: `Playlist "${args.title}" created with ${args.song_ids.length} tracks.`
  };
}

async function executeListLibrary(args: any, supabaseUrl: string) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  let query = sb.from("songs").select("id, title, artist, genre, mood, bpm, key_scale, duration").order("created_at", { ascending: false }).limit(args.limit || 20);
  if (args.genre) query = query.ilike("genre", `%${args.genre}%`);
  if (args.mood) query = query.ilike("mood", `%${args.mood}%`);

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { songs: data, count: data?.length || 0 };
}

async function executeAnalyzeLibrary(supabaseUrl: string) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const { data, error } = await sb.from("songs")
    .select("genre, mood, bpm, key_scale, quality_score, duration");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { total: 0, message: "Library is empty. No songs to analyze." };

  // Genre distribution
  const genreCounts: Record<string, number> = {};
  const moodCounts: Record<string, number> = {};
  const keyCounts: Record<string, number> = {};
  const bpmBuckets = { "60-85 (Calm)": 0, "85-100 (Focus)": 0, "100-125 (Upbeat)": 0, "125-160 (Energy)": 0, "other": 0 };
  let totalDuration = 0;
  let withBpm = 0;
  let qualityScores: number[] = [];

  for (const song of data) {
    const genre = song.genre || "Untagged";
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;

    const mood = song.mood || "Untagged";
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;

    if (song.key_scale) keyCounts[song.key_scale] = (keyCounts[song.key_scale] || 0) + 1;

    if (song.bpm) {
      withBpm++;
      if (song.bpm >= 60 && song.bpm < 85) bpmBuckets["60-85 (Calm)"]++;
      else if (song.bpm >= 85 && song.bpm < 100) bpmBuckets["85-100 (Focus)"]++;
      else if (song.bpm >= 100 && song.bpm < 125) bpmBuckets["100-125 (Upbeat)"]++;
      else if (song.bpm >= 125 && song.bpm <= 160) bpmBuckets["125-160 (Energy)"]++;
      else bpmBuckets["other"]++;
    }

    if (song.quality_score != null) qualityScores.push(Number(song.quality_score));
    totalDuration += song.duration || 0;
  }

  // Identify gaps
  const expectedGenres = ["Jazz", "Ambient", "Acoustic", "Electronic", "Classical", "Lo-Fi", "World"];
  const missingGenres = expectedGenres.filter(g => !Object.keys(genreCounts).some(k => k.toLowerCase().includes(g.toLowerCase())));

  const expectedMoods = ["Relaxed", "Energetic", "Focused", "Uplifting", "Calm", "Romantic"];
  const missingMoods = expectedMoods.filter(m => !Object.keys(moodCounts).some(k => k.toLowerCase().includes(m.toLowerCase())));

  const emptyBpmRanges = Object.entries(bpmBuckets).filter(([k, v]) => v === 0 && k !== "other").map(([k]) => k);

  const avgQuality = qualityScores.length > 0
    ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
    : null;

  return {
    total_tracks: data.length,
    total_duration_minutes: Math.round(totalDuration / 60),
    genre_distribution: genreCounts,
    mood_distribution: moodCounts,
    bpm_distribution: bpmBuckets,
    key_distribution: keyCounts,
    average_quality_score: avgQuality,
    gaps: {
      missing_genres: missingGenres,
      missing_moods: missingMoods,
      empty_bpm_ranges: emptyBpmRanges,
    },
    recommendations: missingGenres.length > 0 || missingMoods.length > 0 || emptyBpmRanges.length > 0
      ? `Gaps found: ${missingGenres.length} missing genres, ${missingMoods.length} missing moods, ${emptyBpmRanges.length} empty BPM ranges. Consider generating tracks to fill these.`
      : "Library is well-balanced across genres, moods, and BPM ranges.",
  };
}

// ── SSE helpers ─────────────────────────────────────────────────────────

function sseEvent(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Main handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use a ReadableStream to push SSE events as work progresses
  const encoder = new TextEncoder();

  let reqBody: any;
  try {
    reqBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { messages, conversation_id, settings } = reqBody;
  const chatModel = settings?.chatModel || "google/gemini-3-flash-preview";
  
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, data: any) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        const llmMessages: any[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ];

        const collectedAudioUrls: string[] = [];
        const MAX_TOOL_CALLS = 25;
        let toolCallCount = 0;

        // ── Tool-calling loop (non-streaming) ──
        push("status", { phase: "thinking", message: "Analyzing your request..." });

        while (toolCallCount < MAX_TOOL_CALLS) {
          const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: chatModel,
              messages: llmMessages,
              tools: TOOLS,
              stream: false,
            }),
          });

          if (!llmRes.ok) {
            const status = llmRes.status;
            const text = await llmRes.text();
            if (status === 429) { push("error", { error: "Rate limit exceeded. Please try again shortly." }); break; }
            if (status === 402) { push("error", { error: "AI credits exhausted. Please add credits." }); break; }
            push("error", { error: `AI gateway error ${status}` });
            break;
          }

          const llmData = await llmRes.json();
          const choice = llmData.choices?.[0];
          if (!choice) { push("error", { error: "No response from AI" }); break; }

          const msg = choice.message;
          llmMessages.push(msg);

          // No tool calls → break to stream final response
          if (!msg.tool_calls || msg.tool_calls.length === 0) {
            break;
          }

          // Execute tool calls with status updates
          for (const tc of msg.tool_calls) {
            toolCallCount++;
            const fn = tc.function.name;
            const args = JSON.parse(tc.function.arguments || "{}");
            let result: any;

            // Push status for each tool
            const toolLabels: Record<string, string> = {
              research_music_style: "Researching music style...",
              generate_track: "Generating track via ACE-Step...",
              analyze_track: "Analyzing audio quality...",
              save_to_library: "Saving to library...",
              list_library: "Checking existing library...",
              create_playlist: "Creating playlist...",
            };
            push("status", { phase: "tool", tool: fn, message: toolLabels[fn] || `Running ${fn}...` });

            try {
              switch (fn) {
                case "research_music_style": result = executeResearch(args); break;
                case "generate_track":
                  result = await executeGenerate(args, supabaseUrl, anonKey);
                  if (result.audio_url) collectedAudioUrls.push(result.audio_url);
                  break;
                case "analyze_track": result = await executeAnalyze(args, supabaseUrl, anonKey); break;
                case "save_to_library": result = await executeSave(args, supabaseUrl); break;
                case "list_library": result = await executeListLibrary(args, supabaseUrl); break;
                case "create_playlist": result = await executeCreatePlaylist(args, supabaseUrl); break;
                default: result = { error: `Unknown tool: ${fn}` };
              }
            } catch (e) {
              result = { error: `Tool error: ${e.message}` };
            }

            llmMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
          }
        }

        // ── Stream final response ──
        push("status", { phase: "responding", message: "Composing response..." });

        // If last message is already assistant text (from non-tool break), stream it token-by-token via a new streaming call
        // Remove the last assistant message from history to re-request with streaming
        const lastMsg = llmMessages[llmMessages.length - 1];
        if (lastMsg.role === "assistant" && lastMsg.content && !lastMsg.tool_calls?.length) {
          llmMessages.pop();
        }

        const streamRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: chatModel,
            messages: llmMessages,
            tools: TOOLS,
            stream: true,
          }),
        });

        if (!streamRes.ok || !streamRes.body) {
          const text = await streamRes.text();
          push("error", { error: `Streaming failed: ${streamRes.status}` });
          push("done", { audio_urls: collectedAudioUrls });
          controller.close();
          return;
        }

        // Parse SSE from upstream and re-emit as token events
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nlIdx: number;
          while ((nlIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nlIdx);
            buffer = buffer.slice(nlIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) push("token", { content });
            } catch { /* partial JSON, skip */ }
          }
        }

        push("done", { audio_urls: collectedAudioUrls, tool_call_count: toolCallCount });
        controller.close();
      } catch (e) {
        push("error", { error: e instanceof Error ? e.message : "Unknown error" });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
