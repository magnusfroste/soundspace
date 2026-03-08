import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getServiceClient(supabaseUrl: string) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceKey);
}

// ── System prompt builder ───────────────────────────────────────────────

function buildSystemPrompt(context: { objectives?: any[]; skills?: any[]; memories?: any[] }): string {
  let contextBlock = "";

  if (context.objectives?.length) {
    contextBlock += "\n\n## ACTIVE OBJECTIVES\nThese are the user's current goals. Reference them when relevant and proactively suggest actions that advance them.\n";
    for (const obj of context.objectives) {
      const progress = obj.progress ? JSON.stringify(obj.progress) : "no progress tracked yet";
      contextBlock += `- **${obj.title}** (${obj.status}): ${obj.description || "No description"}\n  Progress: ${progress}\n`;
    }
  }

  if (context.skills?.length) {
    contextBlock += "\n\n## LEARNED SKILLS\nThese are patterns you've discovered that work well. Use them when relevant — they represent proven recipes.\n";
    for (const skill of context.skills) {
      contextBlock += `- **${skill.name}** [${skill.category}] (used ${skill.use_count}×): ${skill.content}\n`;
    }
  }

  if (context.memories?.length) {
    contextBlock += "\n\n## MEMORIES\nCross-session context about this user and their preferences. Always respect these.\n";
    for (const mem of context.memories) {
      contextBlock += `- [${mem.category}, importance:${mem.importance}] ${mem.content}\n`;
    }
  }

  return BASE_SYSTEM_PROMPT + contextBlock + SYSTEM_PROMPT_FOOTER;
}

const BASE_SYSTEM_PROMPT = `You are SoundAgent — a creative music consultant and production partner for background music in commercial spaces.

You think out loud, reason through musical choices, and collaborate with the user to craft the perfect sound. You are NOT a rigid pipeline — you are a musical thinker.

## YOUR ROLE

You are part consultant, part producer. Your conversations flow naturally through phases:

### Phase 1: Explore & Reason (default)
When a user describes what they need:
- Start with a SHORT observation or insight (2-3 sentences max) showing you understand the vibe
- Then ask ONE focused question (max two if tightly related)
- Wait for the answer before going deeper
- Build understanding progressively over 3-5 turns, not all at once
- Each turn should feel like a natural back-and-forth, not an interview

Think openly about: venue psychology, genre hybrids, BPM/key choices, reference artists — but share your reasoning gradually, not all at once.

DO NOT dump multiple questions at once. One turn = one insight + one question.

**Example reasoning:**
> "For a cocktail bar at sunset, I'm thinking warm jazz-influenced lo-fi — something between Nujabes and Bill Evans. BPM around 85-95 keeps it conversational. Key of Eb major has that golden warmth. But if you want more edge, we could go minor key with some Rhodes piano..."

### Phase 2: The Brief
When the user and you have aligned on a direction, summarize a **brief** — a clear spec for what you'll produce:

\`\`\`
📋 BRIEF: "Golden Hour Set"
  Tracks: 4
  Venue: Cocktail bar, evening
  #1 "Amber Welcome"   | 85 BPM  | Eb major | Warm jazz-lofi  | Opener
  #2 "Velvet Drift"    | 92 BPM  | Bb major | Smooth groove   | Building
  #3 "Midnight Bloom"  | 100 BPM | F major  | Upbeat soul-hop | Peak
  #4 "Last Light"      | 78 BPM  | C minor  | Mellow ambient  | Closer
  Key flow: Eb→Bb→F→Cm (Circle of Fifths with minor resolution)
\`\`\`

**Wait for user approval before executing.** The user might want to adjust the plan.

### Phase 3: Execute (on user's go-ahead)
When the user says something like "go", "do it", "sounds good, make it", "execute", "create them":
- Work through each track using your tools
- For each track: generate → analyze → compare to brief → retry if needed (max 3 attempts) → save
- Report progress with quality scorecards
- After all tracks are saved, bundle into a playlist if it's a set
- Report final results with listen links

## QUALITY CONTROL (during execution)

When generating, run the self-critique loop:
1. Generate with carefully crafted parameters
2. Analyze the result immediately
3. Compare against the brief:
   - BPM deviation >15% → retry
   - Wrong key family → retry  
   - Genre mismatch → retry
4. Report a scorecard after each track
5. Max 3 attempts per track — save best attempt

## MUSICAL KNOWLEDGE

You have deep expertise in:
- **Venue psychology**: What music works where and why
- **Music theory**: Circle of Fifths, key relationships, BPM-energy mapping, harmonic progressions
- **Production**: Instrumentation, arrangement, dynamics, transitions
- **Genre fluency**: Jazz, ambient, lo-fi, electronic, classical, acoustic, world, and hybrids

**Energy-BPM mapping:**
- Calm/Chill: 60-85 BPM
- Focus/Relaxed: 80-100 BPM
- Upbeat/Groove: 100-125 BPM
- Energy/Dance: 120-150 BPM

**Time-of-day energy:**
- 06:00-10:00 → Calm/Focus (70-95 BPM)
- 10:00-14:00 → Focus/Upbeat (85-110 BPM)
- 14:00-18:00 → Upbeat/Groove (95-120 BPM)
- 18:00-22:00 → Groove/Energy (100-130 BPM)
- 22:00-02:00 → Chill/Calm (70-95 BPM)

## ADDITIONAL CAPABILITIES

You can also help with:
- **Library analysis**: Check genre/mood/BPM distribution, find gaps, suggest what to create
- **Schedule analysis**: Read the weekly schedule, find under-covered slots, suggest/generate fills
- **Playlist optimization**: Analyze transition flow, suggest reorder based on Circle of Fifths + BPM smoothness (always ask before applying)
- **Library maintenance**: Find songs missing lyrics/covers/tags and fix them systematically
- **Single track requests**: For quick jobs, you can skip the planning phase and go straight to execution

## LEARNING & MEMORY

You have access to persistent memory across sessions:
- **Skills**: When you discover a recipe/pattern that works (e.g. "lounge jazz: BPM 90-100, Dm/Gm, piano+bass works great"), save it as a skill via save_skill. Reference saved skills in future sessions.
- **Memories**: When the user shares preferences, context, or feedback (e.g. "I don't like synth-heavy tracks", "my bar is in Stockholm"), save it via save_memory. Always respect memories.
- **Objectives**: The user can set persistent goals. Check active objectives and suggest actions that advance them. After completing work, update objective progress.

**IMPORTANT**: Proactively save skills after successful generations. Save memories when the user shares new context. Update objectives when you make progress toward them.

## CONVERSATION STYLE

- ONE question per turn. Never list multiple questions. Build understanding iteratively.
- Start each reply with a brief creative observation before asking
- If the user gives a short answer, acknowledge it and ask the natural follow-up
- Think out loud — share your musical reasoning
- Use analogies and references ("think Boards of Canada meets Satie")
- Be opinionated but flexible — suggest strong choices, accept user preferences
- Use markdown formatting for briefs and scorecards
- Keep it concise but substantive — no filler
- For lyrics, use structural tags like [Verse], [Chorus], [Bridge], [Outro]`;

const SYSTEM_PROMPT_FOOTER = `

## CRITICAL RULES

- **Never auto-execute** a multi-track production without user confirmation of the brief
- For single quick requests ("make me one chill track"), you can proceed directly
- After execution, ALWAYS save tracks via save_to_library — every generated track must end up in the library
- After saving, report: 🎵 **Listen:** [audio_url]
- NEVER skip analyze_track — this is your quality control
- After ALL tracks in a set are saved, ALWAYS call create_playlist to bundle them
- After successful generation, ALWAYS save_skill with the recipe that worked
- When user shares preferences/context, ALWAYS save_memory`;


// ── Tools definition ────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "research_music_style",
      description: "Get curated knowledge about what background music works best for a specific venue type.",
      parameters: {
        type: "object",
        properties: {
          venue_type: { type: "string", description: "Type of venue, e.g. 'restaurant', 'hotel_lobby', 'cafe', 'spa', 'retail', 'bar', 'gym', 'office'" },
          atmosphere: { type: "string", description: "Desired atmosphere, e.g. 'relaxed', 'upscale', 'energetic', 'intimate'" }
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
      description: "Generate a music track using ACE-Step AI. Returns audio URL when complete.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Detailed music description/caption for generation" },
          lyrics: { type: "string", description: "Optional lyrics with structural tags like [Verse], [Chorus]" },
          duration: { type: "number", description: "Track duration in seconds (30-180)" },
          bpm: { type: "number", description: "Beats per minute (60-200)" },
          key_scale: { type: "string", description: "Musical key, e.g. 'C major', 'A minor'" },
          time_signature: { type: "string", description: "Time signature, e.g. '4/4', '3/4'" }
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
      description: "Analyze an audio file to extract BPM, key, caption, and lyrics.",
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
      description: "Save a generated track to the song library.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" }, audio_url: { type: "string" }, genre: { type: "string" },
          mood: { type: "string" }, bpm: { type: "number" }, key_scale: { type: "string" },
          time_signature: { type: "string" }, duration: { type: "number" }, lyrics: { type: "string" },
          prompt: { type: "string" }, quality_score: { type: "number" }
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
      description: "Query existing songs in the library.",
      parameters: {
        type: "object",
        properties: {
          genre: { type: "string" }, mood: { type: "string" }, limit: { type: "number" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_playlist",
      description: "Create a new playlist and add songs to it in order.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" }, description: { type: "string" },
          song_ids: { type: "array", items: { type: "string" } }
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
      description: "Analyze library distribution: genre, mood, BPM, key. Identifies gaps.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "read_schedule",
      description: "Read the weekly music schedule with gap analysis.",
      parameters: {
        type: "object",
        properties: { profile_id: { type: "string" } },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_playlist_flow",
      description: "Analyze a playlist's key/BPM flow and suggest optimal reorder.",
      parameters: {
        type: "object",
        properties: { playlist_id: { type: "string" } },
        required: ["playlist_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reorder_playlist",
      description: "Apply a new song order to an existing playlist.",
      parameters: {
        type: "object",
        properties: {
          playlist_id: { type: "string" },
          song_ids: { type: "array", items: { type: "string" } }
        },
        required: ["playlist_id", "song_ids"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_incomplete_songs",
      description: "Scan library for songs with missing metadata.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "transcribe_song",
      description: "Transcribe lyrics from audio using speech-to-text.",
      parameters: {
        type: "object",
        properties: {
          song_id: { type: "string" }, audio_url: { type: "string" }
        },
        required: ["song_id", "audio_url"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_song_cover",
      description: "Generate a cover image for a song.",
      parameters: {
        type: "object",
        properties: {
          song_id: { type: "string" }, title: { type: "string" },
          genre: { type: "string" }, mood: { type: "string" }, prompt: { type: "string" }
        },
        required: ["song_id", "title"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_song",
      description: "Update metadata on an existing song in the library (genre, mood, BPM, key, lyrics, etc.).",
      parameters: {
        type: "object",
        properties: {
          song_id: { type: "string", description: "ID of the song to update" },
          title: { type: "string" },
          artist: { type: "string" },
          genre: { type: "string" },
          mood: { type: "string" },
          bpm: { type: "number" },
          key_scale: { type: "string" },
          time_signature: { type: "string" },
          lyrics: { type: "string" },
          quality_score: { type: "number" },
        },
        required: ["song_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bulk_update_songs",
      description: "Update metadata on multiple songs in a single call. Each entry specifies a song_id and the fields to update. Much more efficient than calling update_song repeatedly.",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            description: "Array of song updates, each with song_id and fields to change",
            items: {
              type: "object",
              properties: {
                song_id: { type: "string" },
                title: { type: "string" },
                artist: { type: "string" },
                genre: { type: "string" },
                mood: { type: "string" },
                bpm: { type: "number" },
                key_scale: { type: "string" },
                time_signature: { type: "string" },
                lyrics: { type: "string" },
                quality_score: { type: "number" },
              },
              required: ["song_id"],
            }
          }
        },
        required: ["updates"],
        additionalProperties: false
      }
    }
  },
  // ── Persistence tools ──
  {
    type: "function",
    function: {
      name: "save_skill",
      description: "Save a learned pattern/recipe that worked well. Use after successful generation to remember what works.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short name, e.g. 'Cocktail Bar Jazz Recipe'" },
          category: { type: "string", description: "Category: generation, mixing, venue, genre, production" },
          content: { type: "string", description: "The recipe/pattern details. Be specific: BPM, key, instruments, what made it work." },
          metadata: { type: "object", description: "Optional structured data (bpm_range, genres, keys, etc.)" }
        },
        required: ["name", "category", "content"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save a cross-session memory about the user's preferences or context.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Category: preference, context, feedback, venue, style" },
          content: { type: "string", description: "What to remember" },
          importance: { type: "number", description: "1-10, how important this memory is (default 5)" }
        },
        required: ["category", "content"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_objectives",
      description: "List the user's active objectives/goals.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "update_objective_progress",
      description: "Update progress on an objective after completing relevant work.",
      parameters: {
        type: "object",
        properties: {
          objective_id: { type: "string", description: "ID of the objective" },
          progress_update: { type: "object", description: "Progress data to merge (e.g. {tracks_created: 4, genres_covered: ['jazz', 'ambient']})" },
          status: { type: "string", description: "Optionally change status: active, paused, completed" }
        },
        required: ["objective_id", "progress_update"],
        additionalProperties: false
      }
    }
  },
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

async function isIntegrationEnabledServer(integrationId: string, supabaseUrl: string): Promise<boolean> {
  try {
    const sb = getServiceClient(supabaseUrl);
    const { data } = await sb.from("site_settings").select("value").eq("key", "integrations_enabled").maybeSingle();
    if (!data?.value) return true; // Default to enabled if no settings found
    const state = data.value as Record<string, boolean>;
    return state[integrationId] !== false;
  } catch {
    return true; // Default to enabled on error
  }
}

async function executeGenerate(args: any, supabaseUrl: string, anonKey: string) {
  // Check if ACE-Step integration is enabled
  const aceStepEnabled = await isIntegrationEnabledServer("acestep", supabaseUrl);
  if (!aceStepEnabled) {
    return { error: "ACE-Step integration is disabled. Enable it in the Integrations panel to generate tracks." };
  }

  const acestepProxy = `${supabaseUrl}/functions/v1/acestep-proxy`;
  const headers: Record<string, string> = { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` };
  const caption = args.prompt;
  const lyrics = args.lyrics || "[Instrumental]";
  const bpm = args.bpm || 100;
  const keyScale = args.key_scale || "C major";
  const timeSig = args.time_signature || "4/4";
  const duration = Math.min(Math.max(args.duration || 60, 30), 180);

  const releaseRes = await fetch(acestepProxy, {
    method: "POST", headers,
    body: JSON.stringify({ endpoint: "/release_task", method: "POST", body: {
      task_type: "text2music", caption, lyrics, audio_duration: duration,
      bpm, keyscale: keyScale, timesignature: timeSig, batch_size: 1, inference_steps: 100, thinking: true,
    }})
  });

  if (!releaseRes.ok) { const err = await releaseRes.text(); return { error: `Failed to submit generation task: ${err}` }; }

  const releaseData = await releaseRes.json();
  console.log("ACE-Step release_task response:", JSON.stringify(releaseData));
  const unwrapped = (releaseData && typeof releaseData === "object" && "code" in releaseData && "data" in releaseData) ? releaseData.data : releaseData;
  const taskId = unwrapped?.task_id || unwrapped?.taskId || unwrapped?.id;
  if (!taskId) return { error: `No task_id returned. Response: ${JSON.stringify(releaseData).slice(0, 300)}` };

  let resultData: any = null;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(acestepProxy, { method: "POST", headers, body: JSON.stringify({ endpoint: "/query_result", method: "POST", body: { task_id_list: [taskId] } }) });
    if (!pollRes.ok) continue;
    let pollData = await pollRes.json();
    if (pollData && typeof pollData === "object" && "code" in pollData && "data" in pollData) pollData = pollData.data;
    const tasks = Array.isArray(pollData) ? pollData : pollData?.data || [pollData];
    const task = Array.isArray(tasks) ? tasks[0] : tasks;
    if (!task) continue;
    console.log(`Poll ${i}: status=${task.status}`);
    if (task.status === 1) { resultData = typeof task.result === "string" ? JSON.parse(task.result) : task.result; break; }
    if (task.status === 2) return { error: "ACE-Step generation failed" };
  }

  if (!resultData) return { error: "Generation timed out after 360 seconds" };

  const resultItems = Array.isArray(resultData) ? resultData : [resultData];
  const firstItem = resultItems[0];
  const audioPath = firstItem?.url || firstItem?.file;
  if (!audioPath) return { error: `No audio path in result: ${JSON.stringify(resultData).slice(0, 300)}` };

  console.log("Fetching audio from path:", audioPath);
  const audioRes = await fetch(acestepProxy, { method: "POST", headers, body: JSON.stringify({ endpoint: audioPath, method: "GET" }) });
  if (!audioRes.ok) { console.log("Audio fetch failed:", audioRes.status); return { error: `Failed to download audio (${audioRes.status})` }; }

  const audioBlob = await audioRes.arrayBuffer();
  console.log(`Audio downloaded: ${audioBlob.byteLength} bytes`);
  if (audioBlob.byteLength < 1000) return { error: `Audio too small (${audioBlob.byteLength} bytes)` };

  const sb = getServiceClient(supabaseUrl);
  const fileName = `agent/${crypto.randomUUID()}.wav`;
  const { error: uploadErr } = await sb.storage.from("songs").upload(fileName, new Uint8Array(audioBlob), { contentType: "audio/wav", upsert: true });
  if (uploadErr) return { error: `Upload failed: ${uploadErr.message}` };

  const { data: urlData } = sb.storage.from("songs").getPublicUrl(fileName);
  console.log("Track uploaded:", urlData.publicUrl);

  return { success: true, audio_url: urlData.publicUrl, task_id: taskId, duration, bpm, key_scale: keyScale, time_signature: timeSig, prompt: caption };
}

async function executeAnalyze(args: { audio_url: string }, supabaseUrl: string, anonKey: string) {
  const acestepProxy = `${supabaseUrl}/functions/v1/acestep-proxy`;
  const extractRes = await fetch(acestepProxy, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
    body: JSON.stringify({ endpoint: "/release_task", method: "POST", body: { task_type: "extract", audio_url: args.audio_url, audio_duration: 60, batch_size: 1, inference_steps: 100 } })
  });
  if (!extractRes.ok) return { error: "Extract submission failed", note: "Analysis unavailable" };
  const extractData = await extractRes.json();
  return { analysis: extractData, note: "Check BPM, key, and caption fields for quality verification." };
}

async function executeSave(args: any, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data, error } = await sb.from("songs").insert({
    title: args.title, file_url: args.audio_url, genre: args.genre || null, mood: args.mood || null,
    bpm: args.bpm ? Math.round(args.bpm) : null, key_scale: args.key_scale || null,
    time_signature: args.time_signature || null, duration: Math.round(args.duration || 60),
    lyrics: args.lyrics || null, prompt: args.prompt || null, quality_score: args.quality_score ?? null,
    artist: "SoundAgent AI", origin_source: "sound_agent",
  }).select("id").single();
  if (error) return { error: `Save failed: ${error.message}` };
  return { success: true, song_id: data.id, title: args.title, message: `"${args.title}" saved to song library.` };
}

async function executeUpdateSong(args: any, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const updates: Record<string, any> = {};
  if (args.title !== undefined) updates.title = args.title;
  if (args.artist !== undefined) updates.artist = args.artist;
  if (args.genre !== undefined) updates.genre = args.genre;
  if (args.mood !== undefined) updates.mood = args.mood;
  if (args.bpm !== undefined) updates.bpm = Math.round(args.bpm);
  if (args.key_scale !== undefined) updates.key_scale = args.key_scale;
  if (args.time_signature !== undefined) updates.time_signature = args.time_signature;
  if (args.lyrics !== undefined) updates.lyrics = args.lyrics;
  if (args.quality_score !== undefined) updates.quality_score = args.quality_score;

  if (Object.keys(updates).length === 0) return { error: "No fields to update" };

  const { error } = await sb.from("songs").update(updates).eq("id", args.song_id);
  if (error) return { error: `Update failed: ${error.message}` };
  return { success: true, song_id: args.song_id, updated_fields: Object.keys(updates), message: `Song updated: ${Object.keys(updates).join(", ")}` };
}

async function executeBulkUpdateSongs(args: { updates: any[] }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const results: { song_id: string; success: boolean; updated_fields?: string[]; error?: string }[] = [];

  for (const item of args.updates) {
    const updates: Record<string, any> = {};
    if (item.title !== undefined) updates.title = item.title;
    if (item.artist !== undefined) updates.artist = item.artist;
    if (item.genre !== undefined) updates.genre = item.genre;
    if (item.mood !== undefined) updates.mood = item.mood;
    if (item.bpm !== undefined) updates.bpm = Math.round(item.bpm);
    if (item.key_scale !== undefined) updates.key_scale = item.key_scale;
    if (item.time_signature !== undefined) updates.time_signature = item.time_signature;
    if (item.lyrics !== undefined) updates.lyrics = item.lyrics;
    if (item.quality_score !== undefined) updates.quality_score = item.quality_score;

    if (Object.keys(updates).length === 0) {
      results.push({ song_id: item.song_id, success: false, error: "No fields to update" });
      continue;
    }

    const { error } = await sb.from("songs").update(updates).eq("id", item.song_id);
    if (error) {
      results.push({ song_id: item.song_id, success: false, error: error.message });
    } else {
      results.push({ song_id: item.song_id, success: true, updated_fields: Object.keys(updates) });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  return { success: true, total: results.length, succeeded, failed: results.length - succeeded, results, message: `Bulk update: ${succeeded}/${results.length} songs updated.` };
}

async function executeCreatePlaylist(args: { title: string; description?: string; song_ids: string[] }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data: playlist, error: plErr } = await sb.from("playlists").insert({ title: args.title, description: args.description || null }).select("id").single();
  if (plErr) return { error: `Playlist creation failed: ${plErr.message}` };
  const songEntries = args.song_ids.map((songId, i) => ({ playlist_id: playlist.id, song_id: songId, position: i }));
  const { error: songsErr } = await sb.from("playlist_songs").insert(songEntries);
  if (songsErr) return { error: `Failed to add songs: ${songsErr.message}`, playlist_id: playlist.id };
  return { success: true, playlist_id: playlist.id, title: args.title, track_count: args.song_ids.length, message: `Playlist "${args.title}" created with ${args.song_ids.length} tracks.` };
}

async function executeListLibrary(args: any, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  let query = sb.from("songs").select("id, title, artist, genre, mood, bpm, key_scale, duration").order("created_at", { ascending: false }).limit(args.limit || 20);
  if (args.genre) query = query.ilike("genre", `%${args.genre}%`);
  if (args.mood) query = query.ilike("mood", `%${args.mood}%`);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { songs: data, count: data?.length || 0 };
}

async function executeAnalyzeLibrary(supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data, error } = await sb.from("songs").select("genre, mood, bpm, key_scale, quality_score, duration");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { total: 0, message: "Library is empty." };

  const genreCounts: Record<string, number> = {};
  const moodCounts: Record<string, number> = {};
  const keyCounts: Record<string, number> = {};
  const bpmBuckets = { "60-85 (Calm)": 0, "85-100 (Focus)": 0, "100-125 (Upbeat)": 0, "125-160 (Energy)": 0, "other": 0 };
  let totalDuration = 0, withBpm = 0;
  const qualityScores: number[] = [];

  for (const song of data) {
    genreCounts[song.genre || "Untagged"] = (genreCounts[song.genre || "Untagged"] || 0) + 1;
    moodCounts[song.mood || "Untagged"] = (moodCounts[song.mood || "Untagged"] || 0) + 1;
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

  const expectedGenres = ["Jazz", "Ambient", "Acoustic", "Electronic", "Classical", "Lo-Fi", "World"];
  const missingGenres = expectedGenres.filter(g => !Object.keys(genreCounts).some(k => k.toLowerCase().includes(g.toLowerCase())));
  const expectedMoods = ["Relaxed", "Energetic", "Focused", "Uplifting", "Calm", "Romantic"];
  const missingMoods = expectedMoods.filter(m => !Object.keys(moodCounts).some(k => k.toLowerCase().includes(m.toLowerCase())));
  const emptyBpmRanges = Object.entries(bpmBuckets).filter(([k, v]) => v === 0 && k !== "other").map(([k]) => k);
  const avgQuality = qualityScores.length > 0 ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length) : null;

  return {
    total_tracks: data.length, total_duration_minutes: Math.round(totalDuration / 60),
    genre_distribution: genreCounts, mood_distribution: moodCounts,
    bpm_distribution: bpmBuckets, key_distribution: keyCounts,
    average_quality_score: avgQuality,
    gaps: { missing_genres: missingGenres, missing_moods: missingMoods, empty_bpm_ranges: emptyBpmRanges },
    recommendations: missingGenres.length > 0 || missingMoods.length > 0 || emptyBpmRanges.length > 0
      ? `Gaps found: ${missingGenres.length} missing genres, ${missingMoods.length} missing moods, ${emptyBpmRanges.length} empty BPM ranges.`
      : "Library is well-balanced.",
  };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function executeReadSchedule(args: { profile_id?: string }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  let query = sb.from("schedule_entries").select("id, day_of_week, start_time, end_time, is_active, playlist_id, color").order("day_of_week").order("start_time");
  if (args.profile_id) query = query.eq("profile_id", args.profile_id);
  const { data: entries, error } = await query;
  if (error) return { error: error.message };
  if (!entries || entries.length === 0) return { total_slots: 0, message: "No schedule entries found." };

  const playlistIds = [...new Set(entries.map(e => e.playlist_id))];
  const { data: playlists } = await sb.from("playlists").select("id, title").in("id", playlistIds);
  const playlistMap = new Map((playlists || []).map(p => [p.id, p]));
  const { data: playlistSongs } = await sb.from("playlist_songs").select("playlist_id, song_id").in("playlist_id", playlistIds);
  const songIds = [...new Set((playlistSongs || []).map(ps => ps.song_id))];
  const { data: songs } = await sb.from("songs").select("id, duration").in("id", songIds.length > 0 ? songIds : ["none"]);
  const songDurationMap = new Map((songs || []).map(s => [s.id, s.duration || 0]));

  const playlistStats: Record<string, { song_count: number; total_duration_min: number }> = {};
  for (const pid of playlistIds) {
    const pSongs = (playlistSongs || []).filter(ps => ps.playlist_id === pid);
    const totalDur = pSongs.reduce((sum, ps) => sum + (songDurationMap.get(ps.song_id) || 0), 0);
    playlistStats[pid] = { song_count: pSongs.length, total_duration_min: Math.round(totalDur / 60) };
  }

  const slots = entries.map(e => {
    const playlist = playlistMap.get(e.playlist_id);
    const stats = playlistStats[e.playlist_id] || { song_count: 0, total_duration_min: 0 };
    const [sh, sm] = e.start_time.split(":").map(Number);
    const [eh, em] = e.end_time.split(":").map(Number);
    const slotMinutes = (eh * 60 + em) - (sh * 60 + sm);
    const coveragePercent = slotMinutes > 0 ? Math.round((stats.total_duration_min / slotMinutes) * 100) : 0;
    return {
      day: DAY_NAMES[e.day_of_week] || `Day ${e.day_of_week}`,
      time: `${e.start_time.slice(0, 5)}-${e.end_time.slice(0, 5)}`,
      slot_duration_min: slotMinutes, playlist_title: playlist?.title || "Unknown",
      playlist_id: e.playlist_id, song_count: stats.song_count,
      music_duration_min: stats.total_duration_min, coverage_percent: coveragePercent,
      needs_more_music: coveragePercent < 80, is_active: e.is_active,
    };
  });

  const underCovered = slots.filter(s => s.needs_more_music && s.is_active);
  return {
    total_slots: slots.length, active_slots: slots.filter(s => s.is_active).length,
    schedule: slots, under_covered_slots: underCovered.length,
    summary: underCovered.length > 0
      ? `${underCovered.length} active slot(s) have less than 80% music coverage.`
      : "All active slots have sufficient music coverage (≥80%).",
  };
}

const KEY_ORDER = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];

function keyDistance(a: string, b: string): number {
  if (!a || !b) return 6;
  const normalizeKey = (k: string) => k.replace(/ (major|minor)$/i, "").replace("♯", "#").replace("♭", "b");
  const isMinor = (k: string) => /minor/i.test(k);
  const minorToMajor: Record<string, string> = { "A": "C", "E": "G", "B": "D", "F#": "A", "C#": "E", "G#": "B", "D#": "F#", "Bb": "Db", "F": "Ab", "C": "Eb", "G": "Bb", "D": "F" };
  let ka = normalizeKey(a); let kb = normalizeKey(b);
  if (isMinor(a) && minorToMajor[ka]) ka = minorToMajor[ka];
  if (isMinor(b) && minorToMajor[kb]) kb = minorToMajor[kb];
  const ia = KEY_ORDER.indexOf(ka); const ib = KEY_ORDER.indexOf(kb);
  if (ia === -1 || ib === -1) return 3;
  const dist = Math.abs(ia - ib);
  return Math.min(dist, 12 - dist);
}

function transitionScore(keyDist: number, bpmDiff: number): { score: number; label: string } {
  const keyScore = keyDist <= 1 ? 3 : keyDist <= 2 ? 2 : 1;
  const bpmScore = bpmDiff <= 8 ? 3 : bpmDiff <= 15 ? 2 : 1;
  const total = keyScore + bpmScore;
  const label = total >= 5 ? "smooth" : total >= 3 ? "acceptable" : "rough";
  return { score: total, label };
}

async function executeAnalyzePlaylistFlow(args: { playlist_id: string }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data: playlist } = await sb.from("playlists").select("id, title").eq("id", args.playlist_id).single();
  if (!playlist) return { error: "Playlist not found" };
  const { data: entries } = await sb.from("playlist_songs").select("song_id, position").eq("playlist_id", args.playlist_id).order("position");
  if (!entries || entries.length === 0) return { error: "Playlist is empty" };
  const songIds = entries.map(e => e.song_id);
  const { data: songs } = await sb.from("songs").select("id, title, bpm, key_scale, mood, genre").in("id", songIds);
  if (!songs) return { error: "Could not fetch song details" };
  const songMap = new Map(songs.map(s => [s.id, s]));
  const ordered = songIds.map(id => songMap.get(id)).filter(Boolean) as any[];

  const transitions: any[] = [];
  let totalScore = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i], b = ordered[i + 1];
    const kd = keyDistance(a.key_scale || "", b.key_scale || "");
    const bd = Math.abs((a.bpm || 0) - (b.bpm || 0));
    const ts = transitionScore(kd, bd);
    totalScore += ts.score;
    transitions.push({ from: a.title, to: b.title, key_from: a.key_scale || "?", key_to: b.key_scale || "?", bpm_from: a.bpm || "?", bpm_to: b.bpm || "?", key_distance: kd, bpm_diff: bd, quality: ts.label, score: ts.score });
  }
  const avgScore = transitions.length > 0 ? Math.round((totalScore / (transitions.length * 6)) * 100) : 100;

  const optimized = [ordered[0]];
  const remaining = ordered.slice(1);
  while (remaining.length > 0) {
    const last = optimized[optimized.length - 1];
    let bestIdx = 0, bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const kd = keyDistance(last.key_scale || "", remaining[i].key_scale || "");
      const bd = Math.abs((last.bpm || 0) - (remaining[i].bpm || 0));
      const cost = kd * 3 + bd * 0.2;
      if (cost < bestCost) { bestCost = cost; bestIdx = i; }
    }
    optimized.push(remaining.splice(bestIdx, 1)[0]);
  }

  let optScore = 0;
  for (let i = 0; i < optimized.length - 1; i++) {
    const kd = keyDistance(optimized[i].key_scale || "", optimized[i + 1].key_scale || "");
    const bd = Math.abs((optimized[i].bpm || 0) - (optimized[i + 1].bpm || 0));
    optScore += transitionScore(kd, bd).score;
  }
  const optAvgScore = optimized.length > 1 ? Math.round((optScore / ((optimized.length - 1) * 6)) * 100) : 100;

  return {
    playlist_title: playlist.title, track_count: ordered.length,
    current_flow_score: avgScore, rough_transitions: transitions.filter(t => t.quality === "rough").length,
    transitions, optimized_flow_score: optAvgScore, improvement: optAvgScore - avgScore,
    suggested_order: optimized.map((s, i) => ({ position: i, song_id: s.id, title: s.title, bpm: s.bpm, key: s.key_scale })),
    suggested_song_ids: optimized.map(s => s.id),
    recommendation: optAvgScore > avgScore ? `Reordering can improve flow from ${avgScore}% to ${optAvgScore}%.` : "Current order is already well-optimized.",
  };
}

async function executeReorderPlaylist(args: { playlist_id: string; song_ids: string[] }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { error: delErr } = await sb.from("playlist_songs").delete().eq("playlist_id", args.playlist_id);
  if (delErr) return { error: `Failed to clear playlist: ${delErr.message}` };
  const entries = args.song_ids.map((songId, i) => ({ playlist_id: args.playlist_id, song_id: songId, position: i }));
  const { error: insErr } = await sb.from("playlist_songs").insert(entries);
  if (insErr) return { error: `Failed to reorder: ${insErr.message}` };
  return { success: true, message: `Playlist reordered with ${args.song_ids.length} tracks.` };
}

async function executeFindIncomplete(args: { limit?: number }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data, error } = await sb.from("songs").select("id, title, artist, genre, mood, bpm, key_scale, lyrics, cover_url, file_url, origin_source").order("created_at", { ascending: false }).limit(args.limit || 50);
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { total: 0, message: "Library is empty." };

  const missingLyrics = data.filter(s => !s.lyrics);
  const missingCover = data.filter(s => !s.cover_url);
  const missingGenre = data.filter(s => !s.genre);
  const missingMood = data.filter(s => !s.mood);
  const missingBpm = data.filter(s => !s.bpm);
  const incomplete = data.filter(s => !s.lyrics || !s.cover_url || !s.genre || !s.mood || !s.bpm);

  return {
    total_scanned: data.length, incomplete_count: incomplete.length,
    breakdown: {
      missing_lyrics: missingLyrics.map(s => ({ id: s.id, title: s.title, audio_url: s.file_url })),
      missing_cover: missingCover.map(s => ({ id: s.id, title: s.title, genre: s.genre, mood: s.mood })),
      missing_genre: missingGenre.map(s => ({ id: s.id, title: s.title })),
      missing_mood: missingMood.map(s => ({ id: s.id, title: s.title })),
      missing_bpm: missingBpm.map(s => ({ id: s.id, title: s.title, audio_url: s.file_url })),
    },
    counts: { lyrics: missingLyrics.length, cover: missingCover.length, genre: missingGenre.length, mood: missingMood.length, bpm: missingBpm.length },
    recommendation: incomplete.length > 0 ? `${incomplete.length} songs need attention.` : "All songs have complete metadata! 🎉",
  };
}

async function executeTranscribeSong(args: { song_id: string; audio_url: string }, supabaseUrl: string, anonKey: string, sttProvider: string = "elevenlabs") {
  const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-lyrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
    body: JSON.stringify({ song_id: args.song_id, audio_url: args.audio_url, provider: sttProvider }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) return { error: data.error || `Transcription failed (${res.status})` };
  return { success: true, song_id: args.song_id, lyrics: data.lyrics || "[Instrumental]", message: data.lyrics ? `Transcribed ${data.lyrics.length} characters.` : "No vocals detected." };
}

async function executeGenerateSongCover(args: { song_id: string; title: string; genre?: string; mood?: string; prompt?: string }, supabaseUrl: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { error: "LOVABLE_API_KEY not configured" };
  const coverPrompt = [args.title, args.genre && `${args.genre} music`, args.mood && `${args.mood} atmosphere`, args.prompt].filter(Boolean).join(", ");
  const res = await fetch(`${supabaseUrl}/functions/v1/generate-cover`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
    body: JSON.stringify({ prompt: coverPrompt, style: "modern abstract" }),
  });
  const data = await res.json();
  if (!res.ok || data.error) return { error: data.error || `Cover generation failed (${res.status})` };
  const imageUrl = data.imageUrl;
  if (!imageUrl) return { error: "No image returned" };

  const sb = getServiceClient(supabaseUrl);
  let imageBlob: Uint8Array;
  if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.split(",")[1];
    const binary = atob(base64);
    imageBlob = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) imageBlob[i] = binary.charCodeAt(i);
  } else {
    const imgRes = await fetch(imageUrl);
    imageBlob = new Uint8Array(await imgRes.arrayBuffer());
  }
  const fileName = `covers/${args.song_id}.png`;
  const { error: uploadErr } = await sb.storage.from("songs").upload(fileName, imageBlob, { contentType: "image/png", upsert: true });
  if (uploadErr) return { error: `Upload failed: ${uploadErr.message}` };
  const { data: urlData } = sb.storage.from("songs").getPublicUrl(fileName);
  const { error: updateErr } = await sb.from("songs").update({ cover_url: urlData.publicUrl }).eq("id", args.song_id);
  if (updateErr) return { error: `Saved image but failed to update song: ${updateErr.message}` };
  return { success: true, song_id: args.song_id, cover_url: urlData.publicUrl, message: `Cover art generated for "${args.title}".` };
}

// ── Persistence tool executors ──────────────────────────────────────────

async function executeSaveSkill(args: { name: string; category: string; content: string; metadata?: any }, supabaseUrl: string, userId: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data, error } = await sb.from("agent_skills").insert({
    user_id: userId, name: args.name, category: args.category,
    content: args.content, metadata: args.metadata || {},
  }).select("id").single();
  if (error) return { error: `Failed to save skill: ${error.message}` };
  return { success: true, skill_id: data.id, message: `Skill "${args.name}" saved.` };
}

async function executeSaveMemory(args: { category: string; content: string; importance?: number }, supabaseUrl: string, userId: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data, error } = await sb.from("agent_memories").insert({
    user_id: userId, category: args.category,
    content: args.content, importance: args.importance || 5,
  }).select("id").single();
  if (error) return { error: `Failed to save memory: ${error.message}` };
  return { success: true, memory_id: data.id, message: `Memory saved: "${args.content.slice(0, 60)}..."` };
}

async function executeListObjectives(supabaseUrl: string, userId: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data, error } = await sb.from("agent_objectives")
    .select("id, title, description, status, progress, auto_execute, created_at")
    .eq("user_id", userId)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { objectives: data || [], count: data?.length || 0 };
}

async function executeUpdateObjectiveProgress(args: { objective_id: string; progress_update: any; status?: string }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  // Fetch current progress
  const { data: obj, error: fetchErr } = await sb.from("agent_objectives").select("progress").eq("id", args.objective_id).single();
  if (fetchErr) return { error: `Objective not found: ${fetchErr.message}` };

  const currentProgress = (obj.progress as Record<string, any>) || {};
  const mergedProgress = { ...currentProgress, ...args.progress_update, last_updated: new Date().toISOString() };

  const updateData: any = { progress: mergedProgress, updated_at: new Date().toISOString() };
  if (args.status) updateData.status = args.status;

  const { error } = await sb.from("agent_objectives").update(updateData).eq("id", args.objective_id);
  if (error) return { error: `Failed to update: ${error.message}` };
  return { success: true, message: `Objective progress updated.${args.status ? ` Status → ${args.status}` : ""}` };
}

// ── Fetch agent context ─────────────────────────────────────────────────

async function fetchAgentContext(supabaseUrl: string, userId: string) {
  const sb = getServiceClient(supabaseUrl);

  const [objRes, skillRes, memRes] = await Promise.all([
    sb.from("agent_objectives").select("title, description, status, progress")
      .eq("user_id", userId).in("status", ["active", "paused"]).order("created_at", { ascending: false }).limit(10),
    sb.from("agent_skills").select("name, category, content, use_count")
      .eq("user_id", userId).order("use_count", { ascending: false }).limit(20),
    sb.from("agent_memories").select("category, content, importance")
      .eq("user_id", userId).order("importance", { ascending: false }).limit(30),
  ]);

  return {
    objectives: objRes.data || [],
    skills: skillRes.data || [],
    memories: memRes.data || [],
  };
}

// ── LLM routing helpers ─────────────────────────────────────────────────

interface LLMConfig { url: string; headers: Record<string, string>; model: string; }

function getLLMConfig(chatModel: string): LLMConfig {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const isNative = chatModel.startsWith("native:");
  const resolvedModel = isNative ? chatModel.replace("native:", "") : chatModel;

  if (isNative && resolvedModel.startsWith("openai/") && OPENAI_API_KEY) {
    return { url: "https://api.openai.com/v1/chat/completions", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" }, model: resolvedModel.replace("openai/", "") };
  }
  if (isNative && resolvedModel.startsWith("google/") && GOOGLE_AI_API_KEY) {
    return { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" }, model: resolvedModel.replace("google/", "") };
  }
  return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, model: resolvedModel };
}

// ── SSE helpers ─────────────────────────────────────────────────────────

function sseEvent(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Main handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const encoder = new TextEncoder();
  let reqBody: any;
  try { reqBody = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { messages, conversation_id, settings, user_id: bodyUserId } = reqBody;
  const chatModel = settings?.chatModel || "google/gemini-3-flash-preview";
  const sttProvider = settings?.sttProvider || "elevenlabs";

  // Resolve user_id securely:
  // 1. Try JWT auth first (normal user requests)
  // 2. Only allow body user_id if caller authenticates with service role key (cron jobs)
  let userId: string | null = null;
  const authHeader = req.headers.get("authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKeyVal = Deno.env.get("SUPABASE_ANON_KEY");

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    // Check if caller is using service role key — trusted internal caller (cron)
    if (token === serviceRoleKey && bodyUserId) {
      userId = bodyUserId;
    } else if (token !== anonKeyVal) {
      // Regular user JWT — extract user_id from token
      try {
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, token);
        const { data: { user } } = await sb.auth.getUser();
        userId = user?.id || null;
      } catch { /* invalid token */ }
    }
    // If token === anonKey and no valid JWT, userId stays null (anonymous)
  }

  console.log(`[sound-agent] Request: model=${chatModel}, messages=${messages?.length || 0}, conv=${conversation_id}, user=${userId}`);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const useNativeOpenAI = chatModel.startsWith("openai/") && Deno.env.get("OPENAI_API_KEY");
  const useNativeGemini = chatModel.startsWith("google/") && Deno.env.get("GOOGLE_AI_API_KEY");
  if (!useNativeOpenAI && !useNativeGemini && !LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "No AI API key configured." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, data: any) => { controller.enqueue(encoder.encode(sseEvent(event, data))); };

      try {
        // Fetch persistent context
        const context = userId ? await fetchAgentContext(supabaseUrl, userId) : { objectives: [], skills: [], memories: [] };
        const systemPrompt = buildSystemPrompt(context);

        const llmMessages: any[] = [{ role: "system", content: systemPrompt }, ...messages];
        const collectedAudioUrls: string[] = [];
        const MAX_TOOL_CALLS = 25;
        let toolCallCount = 0;

        push("status", { phase: "thinking", message: "Analyzing your request..." });
        const llmConfig = getLLMConfig(chatModel);

        while (toolCallCount < MAX_TOOL_CALLS) {
          const llmRes = await fetch(llmConfig.url, {
            method: "POST", headers: llmConfig.headers,
            body: JSON.stringify({ model: llmConfig.model, messages: llmMessages, tools: TOOLS, stream: false }),
          });

          if (!llmRes.ok) {
            const status = llmRes.status;
            const text = await llmRes.text();
            console.error(`[sound-agent] LLM error ${status}:`, text.slice(0, 500));
            if (status === 429) { push("error", { error: "Rate limit exceeded. Please try again shortly." }); break; }
            if (status === 402) { push("error", { error: "AI credits exhausted." }); break; }
            push("error", { error: `AI gateway error ${status}` }); break;
          }

          const llmData = await llmRes.json();
          const choice = llmData.choices?.[0];
          if (!choice) { push("error", { error: "No response from AI" }); break; }

          const msg = choice.message;
          llmMessages.push(msg);

          if (!msg.tool_calls || msg.tool_calls.length === 0) break;

          for (const tc of msg.tool_calls) {
            toolCallCount++;
            const fn = tc.function.name;
            const args = JSON.parse(tc.function.arguments || "{}");
            let result: any;

            const toolLabels: Record<string, string> = {
              research_music_style: "Researching music style...",
              generate_track: "Generating track via ACE-Step...",
              analyze_track: "Analyzing audio quality...",
              save_to_library: "Saving to library...",
              list_library: "Checking existing library...",
              create_playlist: "Creating playlist...",
              analyze_library: "Analyzing library collection...",
              read_schedule: "Reading weekly schedule...",
              analyze_playlist_flow: "Analyzing playlist flow...",
              reorder_playlist: "Reordering playlist...",
              find_incomplete_songs: "Scanning for incomplete metadata...",
              transcribe_song: "Transcribing lyrics...",
              generate_song_cover: "Generating cover art...",
              update_song: "Updating song metadata...",
              bulk_update_songs: "Bulk updating songs...",
              save_skill: "Saving learned skill...",
              save_memory: "Saving memory...",
              list_objectives: "Checking objectives...",
              update_objective_progress: "Updating objective progress...",
            };
            push("status", { phase: "tool", tool: fn, message: toolLabels[fn] || `Running ${fn}...` });

            try {
              switch (fn) {
                case "research_music_style": result = executeResearch(args); break;
                case "generate_track": result = await executeGenerate(args, supabaseUrl, anonKey); if (result.audio_url) collectedAudioUrls.push(result.audio_url); break;
                case "analyze_track": result = await executeAnalyze(args, supabaseUrl, anonKey); break;
                case "save_to_library": result = await executeSave(args, supabaseUrl); break;
                case "list_library": result = await executeListLibrary(args, supabaseUrl); break;
                case "create_playlist": result = await executeCreatePlaylist(args, supabaseUrl); break;
                case "analyze_library": result = await executeAnalyzeLibrary(supabaseUrl); break;
                case "read_schedule": result = await executeReadSchedule(args, supabaseUrl); break;
                case "analyze_playlist_flow": result = await executeAnalyzePlaylistFlow(args, supabaseUrl); break;
                case "reorder_playlist": result = await executeReorderPlaylist(args, supabaseUrl); break;
                case "find_incomplete_songs": result = await executeFindIncomplete(args, supabaseUrl); break;
                case "transcribe_song": result = await executeTranscribeSong(args, supabaseUrl, anonKey, sttProvider); break;
                case "generate_song_cover": result = await executeGenerateSongCover(args, supabaseUrl); break;
                case "update_song": result = await executeUpdateSong(args, supabaseUrl); break;
                case "bulk_update_songs": result = await executeBulkUpdateSongs(args, supabaseUrl); break;
                case "save_skill": result = userId ? await executeSaveSkill(args, supabaseUrl, userId) : { error: "No user context" }; break;
                case "save_memory": result = userId ? await executeSaveMemory(args, supabaseUrl, userId) : { error: "No user context" }; break;
                case "list_objectives": result = userId ? await executeListObjectives(supabaseUrl, userId) : { objectives: [], count: 0 }; break;
                case "update_objective_progress": result = await executeUpdateObjectiveProgress(args, supabaseUrl); break;
                default: result = { error: `Unknown tool: ${fn}` };
              }
            } catch (e) { result = { error: `Tool error: ${e.message}` }; }

            llmMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
          }
        }

        // Stream final response
        push("status", { phase: "responding", message: "Composing response..." });

        const lastMsg = llmMessages[llmMessages.length - 1];
        if (lastMsg.role === "assistant" && lastMsg.content && (!lastMsg.tool_calls || lastMsg.tool_calls.length === 0)) {
          console.log(`[sound-agent] Emitting cached assistant response (${lastMsg.content.length} chars)`);
          push("token", { content: lastMsg.content });
          push("done", { audio_urls: collectedAudioUrls, tool_call_count: toolCallCount });
          controller.close();
          return;
        }

        console.log("[sound-agent] Requesting streaming final response");
        const streamRes = await fetch(llmConfig.url, {
          method: "POST", headers: llmConfig.headers,
          body: JSON.stringify({ model: llmConfig.model, messages: llmMessages, stream: true }),
        });

        if (!streamRes.ok || !streamRes.body) {
          const text = await streamRes.text();
          console.error(`[sound-agent] Streaming failed: ${streamRes.status}`, text.slice(0, 300));
          push("error", { error: `Streaming failed: ${streamRes.status}` });
          push("done", { audio_urls: collectedAudioUrls });
          controller.close();
          return;
        }

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
            } catch { /* partial JSON */ }
          }
        }

        console.log(`[sound-agent] Done. Tool calls: ${toolCallCount}, audio urls: ${collectedAudioUrls.length}`);
        push("done", { audio_urls: collectedAudioUrls, tool_call_count: toolCallCount });
        controller.close();
      } catch (e) {
        console.error("[sound-agent] Fatal error:", e instanceof Error ? e.message : e);
        push("error", { error: e instanceof Error ? e.message : "Unknown error" });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
});
