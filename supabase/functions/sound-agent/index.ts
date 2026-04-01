import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import lamejs from "https://esm.sh/lamejs@1.2.1";

/**
 * Detect audio format from raw bytes and return format info + optimized data.
 * ACE-Step returns FLAC data (not WAV), so we detect and handle both.
 */
function detectAudioFormat(buffer: ArrayBuffer): { ext: string; mime: string; data: Uint8Array } {
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  
  if (magic === "fLaC") {
    // FLAC — store as-is (browsers support natively, ~50% smaller than WAV)
    return { ext: "flac", mime: "audio/flac", data: bytes };
  }
  
  if (magic === "RIFF") {
    // Actual WAV — convert to MP3
    return { ext: "mp3", mime: "audio/mpeg", data: wavToMp3(buffer) };
  }
  
  // Check for MP3 (ID3 header or sync word)
  if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3
      (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) { // sync
    return { ext: "mp3", mime: "audio/mpeg", data: bytes };
  }
  
  // Unknown — store as FLAC (most likely from ACE-Step)
  console.warn(`Unknown audio format magic: ${magic}, treating as FLAC`);
  return { ext: "flac", mime: "audio/flac", data: bytes };
}

/**
 * Convert a WAV ArrayBuffer to MP3 (128 kbps).
 */
function wavToMp3(wavBuffer: ArrayBuffer): Uint8Array {
  const dv = new DataView(wavBuffer);

  // Parse WAV header
  const numChannels = dv.getUint16(22, true);
  const sampleRate = dv.getUint32(24, true);
  const bitsPerSample = dv.getUint16(34, true);

  // Find "data" sub-chunk
  let dataOffset = 12;
  while (dataOffset < dv.byteLength - 8) {
    const chunkId = String.fromCharCode(
      dv.getUint8(dataOffset), dv.getUint8(dataOffset + 1),
      dv.getUint8(dataOffset + 2), dv.getUint8(dataOffset + 3),
    );
    const chunkSize = dv.getUint32(dataOffset + 4, true);
    if (chunkId === "data") {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor((wavBuffer.byteLength - dataOffset) / bytesPerSample);
  const samplesPerChannel = Math.floor(totalSamples / numChannels);

  // Extract interleaved PCM → per-channel Int16 arrays
  const left = new Int16Array(samplesPerChannel);
  const right = numChannels > 1 ? new Int16Array(samplesPerChannel) : left;

  for (let i = 0; i < samplesPerChannel; i++) {
    const offset = dataOffset + i * numChannels * bytesPerSample;
    if (bitsPerSample === 16) {
      left[i] = dv.getInt16(offset, true);
      if (numChannels > 1) right[i] = dv.getInt16(offset + 2, true);
    } else if (bitsPerSample === 32) {
      // 32-bit float → 16-bit int
      const lf = dv.getFloat32(offset, true);
      left[i] = Math.max(-32768, Math.min(32767, Math.round(lf * 32767)));
      if (numChannels > 1) {
        const rf = dv.getFloat32(offset + 4, true);
        right[i] = Math.max(-32768, Math.min(32767, Math.round(rf * 32767)));
      }
    } else {
      // 24-bit → 16-bit (shift down 8 bits)
      const b0 = dv.getUint8(offset);
      const b1 = dv.getUint8(offset + 1);
      const b2 = dv.getUint8(offset + 2);
      let val = (b2 << 16) | (b1 << 8) | b0;
      if (val & 0x800000) val |= ~0xFFFFFF; // sign extend
      left[i] = val >> 8;
      if (numChannels > 1) {
        const o2 = offset + 3;
        let v2 = (dv.getUint8(o2 + 2) << 16) | (dv.getUint8(o2 + 1) << 8) | dv.getUint8(o2);
        if (v2 & 0x800000) v2 |= ~0xFFFFFF;
        right[i] = v2 >> 8;
      }
    }
  }

  // Encode to MP3 128 kbps
  const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
  const mp3Parts: Uint8Array[] = [];
  const BLOCK = 1152;

  for (let i = 0; i < samplesPerChannel; i += BLOCK) {
    const lChunk = left.subarray(i, i + BLOCK);
    const rChunk = numChannels > 1 ? right.subarray(i, i + BLOCK) : lChunk;
    const mp3buf = numChannels > 1
      ? mp3Encoder.encodeBuffer(lChunk, rChunk)
      : mp3Encoder.encodeBuffer(lChunk);
    if (mp3buf.length > 0) mp3Parts.push(new Uint8Array(mp3buf));
  }
  const flush = mp3Encoder.flush();
  if (flush.length > 0) mp3Parts.push(new Uint8Array(flush));

  // Concat
  const totalLen = mp3Parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const p of mp3Parts) { result.set(p, off); off += p.length; }
  return result;
}

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

async function fetchListeningTrends(supabaseUrl: string): Promise<string> {
  try {
    const sb = getServiceClient(supabaseUrl);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: logs } = await sb.from("play_logs").select("song_id, duration_listened").gte("played_at", since).limit(500);
    if (!logs || logs.length < 5) return "";

    const songIds = [...new Set(logs.map(l => l.song_id))];
    const { data: songs } = await sb.from("songs").select("id, genre, mood, bpm").in("id", songIds.slice(0, 100));
    if (!songs) return "";

    const genreCounts: Record<string, number> = {};
    const moodCounts: Record<string, number> = {};
    const bpmSum: number[] = [];
    const songMap = new Map(songs.map(s => [s.id, s]));

    for (const log of logs) {
      const s = songMap.get(log.song_id);
      if (!s) continue;
      if (s.genre) genreCounts[s.genre] = (genreCounts[s.genre] || 0) + 1;
      if (s.mood) moodCounts[s.mood] = (moodCounts[s.mood] || 0) + 1;
      if (s.bpm) bpmSum.push(s.bpm);
    }

    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g, c]) => `${g}(${c})`).join(", ");
    const topMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, c]) => `${m}(${c})`).join(", ");
    const avgBpm = bpmSum.length > 0 ? Math.round(bpmSum.reduce((a, b) => a + b, 0) / bpmSum.length) : null;

    return `\n## RECENT LISTENING TRENDS (last 7 days, ${logs.length} plays)\nTop genres: ${topGenres || "N/A"}\nTop moods: ${topMoods || "N/A"}\nAvg BPM: ${avgBpm || "N/A"}\nUse this to personalize recommendations.\n`;
  } catch {
    return "";
  }
}

function buildSystemPrompt(context: { objectives?: any[]; skills?: any[]; memories?: any[] }, listeningTrends = ""): string {
  const currentTime = new Date().toISOString();
  
  let contextBlock = "";
  if (context.objectives?.length) {
    contextBlock += "\n## ACTIVE OBJECTIVES\n";
    for (const obj of context.objectives) {
      contextBlock += `- **${obj.title}** (${obj.status}): ${obj.description || "—"} | Progress: ${obj.progress ? JSON.stringify(obj.progress) : "none"}\n`;
    }
  }
  if (context.skills?.length) {
    contextBlock += "\n## LEARNED SKILLS\n";
    for (const s of context.skills) contextBlock += `- **${s.name}** [${s.category}] (${s.use_count}×): ${s.content}\n`;
  }
  if (context.memories?.length) {
    contextBlock += "\n## MEMORIES\n";
    for (const m of context.memories) contextBlock += `- [${m.category}] ${m.content}\n`;
  }

  return `[UTC: ${currentTime}] Cron: 03:00 UTC.
${BASE_SYSTEM_PROMPT}${listeningTrends}${contextBlock}`;
}

const BASE_SYSTEM_PROMPT = `You are SoundAgent — a creative music consultant and production partner for background music in commercial spaces. You think musically, reason through choices, and collaborate naturally.

## CONVERSATION STYLE
- ONE question per turn. Start with a brief creative observation, then ask ONE focused question.
- Think out loud: share BPM reasoning, key choices, genre hybrids, venue psychology.
- Use analogies ("think Nujabes meets Bill Evans"). Be opinionated but flexible.
- Keep it concise. No filler.

## WORKFLOW
1. **Explore** — understand the vibe through 3-5 iterative turns (never dump questions)
2. **Brief** — summarize a clear spec (tracks, BPM, key, genre, mood). Wait for approval.
3. **Execute** — generate → analyze → compare → retry if needed → save → playlist

## QUALITY CONTROL
After generating: analyze immediately. Compare against brief:
- BPM >15% off → retry. Wrong key family → retry. Genre mismatch → retry.
- Max 3 attempts per track. Save best. Report scorecard.
- Quality minimum: 70/100. Below = rejected, retry with adjusted params.

## MUSICAL KNOWLEDGE
**Energy-BPM:** Calm 60-85 | Focus 80-100 | Upbeat 100-125 | Energy 120-150
**Time-of-day:** Morning(06-10)→Calm | Midday(10-14)→Focus | Afternoon(14-18)→Upbeat | Evening(18-22)→Groove | Night(22-02)→Chill
**Standardized genres:** Jazz, Lounge Jazz, Smooth Jazz, Ambient, Lo-Fi, Electronic, Classical, Neo-Classical, Acoustic, World, Soul, Bossa Nova, Downtempo, Trip-Hop, R&B, Funk, Blues
**Standardized moods:** Relaxed, Calm, Energetic, Upbeat, Focused, Uplifting, Romantic, Dreamy, Warm, Reflective

## CAPABILITIES
- **Library**: analyze distribution, find gaps, fix metadata, generate covers, transcribe lyrics
- **Schedule**: build/analyze weekly schedule using playlists mapped to time-of-day energy
- **Playlists**: create, analyze key/BPM flow, suggest optimal reorder (Circle of Fifths)
- **Analytics**: analyze play logs for trends, run proactive health checks
- **Landing page**: feature best/newest tracks via update_featured_tracks
- **Venue research**: use research_music_style to get AI-powered recommendations for ANY venue type

## AUTONOMOUS MODE (cron)
Be fully autonomous. Order: analyze_play_logs → analyze_library → generate tracks → save → playlist → update_featured_tracks → proactive_scan. Never ask questions. Vary genres (check distribution first, never same genre twice). Use standardized names.

## OBJECTIVE TYPES
**One-time** ("Create 4 tracks") → mark completed when done.
**Ongoing** ("Ensure all tracks have lyrics") → NEVER complete. Update progress each run. Keywords: ensure, maintain, keep, always.
VERIFY before completing: check actual state (e.g. missing_lyrics count).

## PERSISTENCE
- Save **skills** after successful generations (recipe that worked).
- Save **memories** when user shares preferences/context.
- Update **objectives** when you make progress.

## USER FEEDBACK
When the user rates a suggestion (via rate_suggestion), use the feedback to adjust your approach:
- Score 1-3: significantly change direction — different genre, BPM range, or mood
- Score 4-6: fine-tune — adjust parameters but keep general direction
- Score 7-10: on track — continue with similar approach
Always acknowledge the feedback briefly before proceeding.

## RULES
- Never auto-execute multi-track production without user approval of brief
- Single quick requests → proceed directly
- Always save tracks via save_to_library. Always analyze before saving.
- After saving: report 🎵 **Listen:** [audio_url]
- After all tracks saved → create_playlist to bundle them`;


// ── Tools definition ────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "research_music_style",
      description: "Get AI-powered recommendations for what background music works best for ANY venue type and atmosphere. Uses AI reasoning to provide tailored BPM, genre, mood, key, and instrumentation suggestions.",
      parameters: {
        type: "object",
        properties: {
          venue_type: { type: "string", description: "Type of venue — any type works: 'dental clinic', 'wine bar', 'yoga studio', 'bookshop', 'coworking space', etc." },
          atmosphere: { type: "string", description: "Desired atmosphere, e.g. 'relaxed', 'upscale', 'energetic', 'intimate', 'professional'" },
          time_of_day: { type: "string", description: "Optional: 'morning', 'afternoon', 'evening', 'night'" },
          clientele: { type: "string", description: "Optional: target audience, e.g. 'young professionals', 'families', 'elderly'" }
        },
        required: ["venue_type"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "rate_suggestion",
      description: "Record user feedback on a suggestion or generated track. Use when the user expresses satisfaction/dissatisfaction.",
      parameters: {
        type: "object",
        properties: {
          score: { type: "number", description: "Rating 1-10 (1=terrible, 10=perfect)" },
          feedback: { type: "string", description: "What the user said about the suggestion" },
          context: { type: "string", description: "What was being rated (e.g. 'generated jazz track', 'venue recommendation')" }
        },
        required: ["score", "feedback"],
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
  // ── Schedule management tools ──
  {
    type: "function",
    function: {
      name: "list_playlists",
      description: "List all available playlists (admin-curated). Use to find playlist IDs for scheduling.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max playlists to return (default 50)" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_schedule_entry",
      description: "Create a schedule entry to assign a playlist to a specific day and time slot. Use this to build the weekly music schedule.",
      parameters: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "Profile ID of the business user" },
          playlist_id: { type: "string", description: "ID of the playlist to schedule" },
          day_of_week: { type: "number", description: "Day of week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday" },
          start_time: { type: "string", description: "Start time in HH:MM format (e.g. '09:00')" },
          end_time: { type: "string", description: "End time in HH:MM format (e.g. '12:00')" },
          color: { type: "string", description: "Optional hex color for the block (e.g. '#9b87f5')" }
        },
        required: ["profile_id", "playlist_id", "day_of_week", "start_time", "end_time"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_schedule_entry",
      description: "Update an existing schedule entry. Can change playlist, day, time, color, or active state.",
      parameters: {
        type: "object",
        properties: {
          entry_id: { type: "string", description: "ID of the schedule entry to update" },
          playlist_id: { type: "string", description: "New playlist ID" },
          day_of_week: { type: "number", description: "New day of week (0=Sun, 1=Mon, ..., 6=Sat)" },
          start_time: { type: "string", description: "New start time in HH:MM format" },
          end_time: { type: "string", description: "New end time in HH:MM format" },
          color: { type: "string", description: "New hex color" },
          is_active: { type: "boolean", description: "Enable or disable this entry" }
        },
        required: ["entry_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_schedule_entry",
      description: "Delete a schedule entry by ID.",
      parameters: {
        type: "object",
        properties: {
          entry_id: { type: "string", description: "ID of the schedule entry to delete" }
        },
        required: ["entry_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "clear_schedule",
      description: "Delete ALL schedule entries for a profile. Use when the user wants to start fresh.",
      parameters: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "Profile ID whose schedule to clear" }
        },
        required: ["profile_id"],
        additionalProperties: false
      }
    }
  },
  // ── Analytics & proactive tools ──
  {
    type: "function",
    function: {
      name: "analyze_play_logs",
      description: "Analyze listening data to understand what music gets played most. Returns top songs, genres, moods, and BPM ranges by play count and listen duration. Use to make data-driven music decisions.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "How many days back to analyze (default 30)" },
          user_id: { type: "string", description: "Optional: filter by specific user" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "proactive_scan",
      description: "Run a comprehensive health check across the entire platform: schedule coverage, library gaps, playlist quality, and listening trends. Returns prioritized actionable suggestions. Use this when starting a conversation or when the user asks 'what should I do next?'.",
      parameters: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "Optional profile ID for schedule analysis" }
        },
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
  {
    type: "function",
    function: {
      name: "update_featured_tracks",
      description: "Update the featured tracks shown on the public landing page. Pass up to 6 song IDs to showcase as 'Fresh Drops' or 'Trending Now'. Songs should be high-quality, recent, or popular.",
      parameters: {
        type: "object",
        properties: {
          song_ids: { type: "array", items: { type: "string" }, description: "Array of song IDs to feature (max 6)" },
          label: { type: "string", description: "Showcase label, e.g. 'Fresh Drops', 'Trending Now', 'Staff Picks'" },
        },
        required: ["song_ids"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "notify_admin",
      description: "Send a notification to the admin dashboard. Use after completing significant autonomous work (e.g. tracks generated, playlists created, landing page updated).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short notification title" },
          message: { type: "string", description: "Detailed message about what was done" },
          category: { type: "string", description: "Category: generation, playlist, promotion, analytics, agent" },
        },
        required: ["title", "message"],
        additionalProperties: false
      }
    }
  },
];

// ── Knowledge base ──────────────────────────────────────────────────────
// ── Tool executors ──────────────────────────────────────────────────────

/** Dynamic AI-powered venue research — works for ANY venue type */
async function executeResearch(args: { venue_type: string; atmosphere?: string; time_of_day?: string; clientele?: string }): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    // Fallback to basic heuristics
    return { venue_type: args.venue_type, atmosphere: args.atmosphere || "general", recommendations: { bpm: [80, 110], genres: ["Jazz", "Ambient", "Lo-Fi"], moods: ["Relaxed", "Calm"], instrumentation: "Piano, soft guitar, ambient pads" }, tips: "Default recommendations (AI unavailable)." };
  }

  try {
    const prompt = `You are a music curation expert. Recommend background music for:
- Venue: ${args.venue_type}${args.atmosphere ? `, ${args.atmosphere} atmosphere` : ""}${args.time_of_day ? `, ${args.time_of_day} time` : ""}${args.clientele ? `, clientele: ${args.clientele}` : ""}

Return ONLY a JSON object (no markdown):
{"bpm_range":[min,max],"genres":["Genre1","Genre2","Genre3"],"moods":["Mood1","Mood2"],"keys":["C major","G major"],"instrumentation":"description of instruments","tips":"one sentence of advice","energy_level":"low|medium|high"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        venue_type: args.venue_type,
        atmosphere: args.atmosphere || "general",
        time_of_day: args.time_of_day,
        clientele: args.clientele,
        recommendations: {
          bpm: parsed.bpm_range || [80, 110],
          genres: parsed.genres || [],
          moods: parsed.moods || [],
          keys: parsed.keys || [],
          instrumentation: parsed.instrumentation || "",
          energy_level: parsed.energy_level || "medium",
        },
        tips: parsed.tips || "",
        source: "ai_generated",
      };
    }
    throw new Error("Could not parse AI response");
  } catch (e: any) {
    console.log("Dynamic venue research failed, using heuristic:", e.message);
    return { venue_type: args.venue_type, atmosphere: args.atmosphere || "general", recommendations: { bpm: [80, 110], genres: ["Jazz", "Ambient", "Lo-Fi"], moods: ["Relaxed", "Calm"], instrumentation: "Piano, soft guitar, ambient pads" }, tips: "Heuristic recommendations (AI lookup failed).", source: "fallback" };
  }
}

/** Record user feedback and save as memory for future reference */
async function executeRateSuggestion(args: { score: number; feedback: string; context?: string }, supabaseUrl: string, userId: string | null): Promise<any> {
  const score = Math.max(1, Math.min(10, Math.round(args.score)));
  const direction = score <= 3 ? "significantly_change" : score <= 6 ? "fine_tune" : "continue";
  
  // Save as memory if user is authenticated
  if (userId) {
    const sb = getServiceClient(supabaseUrl);
    await sb.from("agent_memories").insert({
      user_id: userId,
      category: "feedback",
      content: `Rating ${score}/10 on ${args.context || "suggestion"}: "${args.feedback}". Direction: ${direction}.`,
      importance: score <= 3 ? 9 : score <= 6 ? 6 : 3,
    }).catch(() => {});
  }

  return {
    score,
    direction,
    acknowledged: true,
    message: score <= 3 
      ? "Understood — I'll take a significantly different approach."
      : score <= 6 
        ? "Got it — I'll fine-tune my approach." 
        : "Great — I'll continue in this direction.",
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

// ── Genre normalization ─────────────────────────────────────────────────

const GENRE_NORMALIZATION_MAP: Record<string, string> = {
  // Lounge variants
  "lounge": "Lounge Jazz", "lounge jazz": "Lounge Jazz", "lounge_jazz": "Lounge Jazz",
  "jazz lounge": "Lounge Jazz", "jazzy lounge": "Lounge Jazz",
  "ambient lounge": "Ambient Lounge", "ambient_lounge": "Ambient Lounge",
  "chill lounge": "Ambient Lounge", "lounge ambient": "Ambient Lounge",
  // Jazz variants
  "jazz": "Jazz", "smooth jazz": "Smooth Jazz", "smooth_jazz": "Smooth Jazz",
  "bossa nova": "Bossa Nova", "bossa": "Bossa Nova",
  "latin jazz": "Latin Jazz", "latin_jazz": "Latin Jazz",
  // Ambient variants
  "ambient": "Ambient", "ambient electronic": "Ambient Electronic",
  "ambient_electronic": "Ambient Electronic", "dark ambient": "Dark Ambient",
  // Lo-Fi variants
  "lo-fi": "Lo-Fi", "lofi": "Lo-Fi", "lo fi": "Lo-Fi", "lo-fi hip hop": "Lo-Fi",
  "lo-fi beats": "Lo-Fi", "lofi hip hop": "Lo-Fi", "chillhop": "Lo-Fi",
  // Electronic variants
  "electronic": "Electronic", "electronica": "Electronic", "synth": "Electronic",
  "downtempo": "Downtempo", "trip-hop": "Trip-Hop", "trip hop": "Trip-Hop",
  // Acoustic
  "acoustic": "Acoustic", "folk": "Acoustic Folk", "singer-songwriter": "Acoustic",
  // Classical
  "classical": "Classical", "neo-classical": "Neo-Classical", "neoclassical": "Neo-Classical",
  "piano": "Classical Piano", "orchestral": "Classical",
  // World
  "world": "World", "world music": "World", "ethnic": "World",
  // Other
  "soul": "Soul", "r&b": "R&B", "rnb": "R&B", "funk": "Funk",
  "blues": "Blues", "reggae": "Reggae", "pop": "Pop",
};

const MOOD_NORMALIZATION_MAP: Record<string, string> = {
  "relaxed": "Relaxed", "relaxing": "Relaxed", "chill": "Relaxed", "mellow": "Relaxed",
  "calm": "Calm", "peaceful": "Calm", "serene": "Calm", "tranquil": "Calm",
  "energetic": "Energetic", "upbeat": "Upbeat", "lively": "Energetic",
  "focused": "Focused", "concentration": "Focused", "study": "Focused",
  "uplifting": "Uplifting", "happy": "Uplifting", "joyful": "Uplifting",
  "romantic": "Romantic", "intimate": "Romantic", "sensual": "Romantic",
  "dreamy": "Dreamy", "ethereal": "Dreamy", "floating": "Dreamy",
  "warm": "Warm", "cozy": "Warm", "nostalgic": "Nostalgic",
  "melancholic": "Melancholic", "sad": "Melancholic", "reflective": "Reflective",
};

function normalizeGenre(genre: string | null | undefined): string | null {
  if (!genre) return null;
  const key = genre.toLowerCase().trim();
  if (GENRE_NORMALIZATION_MAP[key]) return GENRE_NORMALIZATION_MAP[key];
  // Capitalize first letter of each word if no match
  return genre.trim().replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeMood(mood: string | null | undefined): string | null {
  if (!mood) return null;
  const key = mood.toLowerCase().trim();
  if (MOOD_NORMALIZATION_MAP[key]) return MOOD_NORMALIZATION_MAP[key];
  return mood.trim().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Enhanced generation with real quality assessment ────────────────────

const QUALITY_THRESHOLD = 0.7;
const MAX_REGENERATION_ATTEMPTS = 3;
const BATCH_SIZE = 2;

/** Poll an ACE-Step extract/generate task until complete */
async function pollAceStepTask(
  acestepProxy: string,
  headers: Record<string, string>,
  taskId: string,
  maxAttempts = 60,
  interval = 3000,
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, interval));
    const pollRes = await fetch(acestepProxy, {
      method: "POST", headers,
      body: JSON.stringify({ endpoint: "/query_result", method: "POST", body: { task_id_list: [taskId] } }),
    });
    if (!pollRes.ok) continue;
    let pollData = await pollRes.json();
    if (pollData && typeof pollData === "object" && "code" in pollData && "data" in pollData) pollData = pollData.data;
    const tasks = Array.isArray(pollData) ? pollData : pollData?.data || [pollData];
    const task = Array.isArray(tasks) ? tasks[0] : tasks;
    if (!task) continue;
    if (task.status === 1) return typeof task.result === "string" ? JSON.parse(task.result) : task.result;
    if (task.status === 2) throw new Error("ACE-Step task failed");
  }
  throw new Error("ACE-Step task timed out");
}

/** Analyze audio via ACE-Step extract endpoint → returns BPM, key, caption */
async function analyzeAudioViaExtract(
  acestepProxy: string,
  headers: Record<string, string>,
  audioUrl: string,
): Promise<{ bpm?: number; keyScale?: string; timeSignature?: string; caption?: string } | null> {
  try {
    const submitRes = await fetch(acestepProxy, {
      method: "POST", headers,
      body: JSON.stringify({
        endpoint: "/release_task", method: "POST",
        body: { task_type: "extract", audio_url: audioUrl, audio_duration: 0, batch_size: 1, inference_steps: 100, thinking: true },
      }),
    });
    if (!submitRes.ok) return null;

    let submitData = await submitRes.json();
    if (submitData && typeof submitData === "object" && "code" in submitData && "data" in submitData) submitData = submitData.data;
    const taskId = submitData?.task_id || submitData?.taskId || submitData?.id;
    if (!taskId) return null;

    const result = await pollAceStepTask(acestepProxy, headers, taskId, 40, 3000);
    const item = Array.isArray(result) ? result[0] : result;
    if (!item) return null;

    return {
      bpm: item.bpm ?? undefined,
      keyScale: item.keyscale ?? item.key_scale ?? undefined,
      timeSignature: item.timesignature ?? item.time_signature ?? undefined,
      caption: item.caption ?? item.prompt ?? undefined,
    };
  } catch (e) {
    console.log("Extract analysis failed:", e);
    return null;
  }
}

/** Simple keyword-based caption similarity (0-1) */
function computeCaptionSimilarity(extractedCaption: string | undefined, originalPrompt: string): number {
  if (!extractedCaption || !originalPrompt) return 1.0; // No penalty if unavailable
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);
  const promptWords = new Set(normalize(originalPrompt));
  const captionWords = normalize(extractedCaption);
  if (promptWords.size === 0 || captionWords.length === 0) return 1.0;
  const matches = captionWords.filter(w => promptWords.has(w)).length;
  return matches / Math.max(promptWords.size, 1);
}

/** Refine prompt on retry — add more specific musical instructions */
function refinePromptForRetry(
  originalPrompt: string,
  attempt: number,
  requested: { bpm: number; keyScale: string; timeSig: string },
  lastAnalysis?: { bpm?: number; keyScale?: string; caption?: string } | null,
): string {
  const additions: string[] = [];
  if (attempt >= 2) {
    additions.push(`IMPORTANT: Must be exactly ${requested.bpm} BPM in ${requested.keyScale}, ${requested.timeSig} time signature`);
  }
  if (attempt >= 3 && lastAnalysis) {
    if (lastAnalysis.bpm && Math.abs(lastAnalysis.bpm - requested.bpm) > requested.bpm * 0.1) {
      additions.push(`Previous attempt was ${lastAnalysis.bpm} BPM which is wrong — target exactly ${requested.bpm} BPM`);
    }
    if (lastAnalysis.keyScale && lastAnalysis.keyScale.toLowerCase() !== requested.keyScale.toLowerCase()) {
      additions.push(`Previous attempt was in ${lastAnalysis.keyScale} — must be ${requested.keyScale}`);
    }
  }
  return additions.length > 0 ? `${originalPrompt}. ${additions.join(". ")}` : originalPrompt;
}

/** Inference steps escalation per attempt */
function getInferenceStepsForAttempt(baseSteps: number, attempt: number): number {
  // attempt 1 → base, attempt 2 → base*1.5, attempt 3 → base*2
  const multiplier = 1 + (attempt - 1) * 0.5;
  return Math.min(Math.round(baseSteps * multiplier), 250);
}

/** Compute a real quality score by comparing extracted features vs requested params */
function computeRealQualityScore(
  extracted: { bpm?: number; keyScale?: string; timeSignature?: string; caption?: string } | null,
  requested: { bpm: number; keyScale: string; timeSig: string; prompt?: string },
): number {
  if (!extracted) return 0.75; // Default passing score if analysis unavailable

  let score = 1.0;

  // BPM accuracy (weight: 35%)
  if (extracted.bpm && requested.bpm) {
    const bpmDeviation = Math.abs(extracted.bpm - requested.bpm) / requested.bpm;
    if (bpmDeviation > 0.20) score -= 0.35;
    else if (bpmDeviation > 0.10) score -= 0.18;
    else if (bpmDeviation > 0.05) score -= 0.05;
  }

  // Key match (weight: 30%)
  if (extracted.keyScale && requested.keyScale) {
    const extractedKey = extracted.keyScale.toLowerCase().trim();
    const requestedKey = requested.keyScale.toLowerCase().trim();
    if (extractedKey !== requestedKey) {
      const extractedRoot = extractedKey.split(" ")[0];
      const requestedRoot = requestedKey.split(" ")[0];
      if (extractedRoot === requestedRoot) {
        score -= 0.12;
      } else {
        score -= 0.30;
      }
    }
  }

  // Time signature match (weight: 20%)
  if (extracted.timeSignature && requested.timeSig) {
    if (extracted.timeSignature.trim() !== requested.timeSig.trim()) {
      score -= 0.20;
    }
  }

  // Caption similarity (weight: 15%) — does the output sound like what was requested?
  if (requested.prompt) {
    const captionSim = computeCaptionSimilarity(extracted.caption, requested.prompt);
    if (captionSim < 0.3) score -= 0.15;       // Very different
    else if (captionSim < 0.5) score -= 0.08;   // Somewhat different
  }

  return Math.max(0, Math.round(score * 100) / 100);
}

/** Lyrics structure templates by genre */
const LYRICS_STRUCTURES: Record<string, string> = {
  jazz: "[Intro]\n[Verse 1]\n[Chorus]\n[Verse 2]\n[Bridge]\n[Outro]",
  ambient: "[Intro]\n[Movement 1]\n[Movement 2]\n[Outro]",
  lofi: "[Intro]\n[Loop 1]\n[Loop 2]\n[Outro]",
  electronic: "[Intro]\n[Build]\n[Drop]\n[Breakdown]\n[Drop 2]\n[Outro]",
  classical: "[Intro]\n[Theme A]\n[Development]\n[Theme B]\n[Recapitulation]\n[Coda]",
  acoustic: "[Intro]\n[Verse 1]\n[Chorus]\n[Verse 2]\n[Chorus]\n[Bridge]\n[Outro]",
  default: "[Intro]\n[Verse]\n[Chorus]\n[Verse]\n[Chorus]\n[Outro]",
};

/** Auto-insert lyrics structure tags based on genre */
function applyLyricsStructure(lyrics: string | undefined, genre: string | undefined): string {
  if (lyrics && lyrics.trim() && !lyrics.includes("[")) {
    // If lyrics exist but no tags, wrap in verse/chorus structure
    const lines = lyrics.split("\n").filter(l => l.trim());
    if (lines.length > 0) {
      const midpoint = Math.floor(lines.length / 2);
      return `[Verse]\n${lines.slice(0, midpoint).join("\n")}\n\n[Chorus]\n${lines.slice(midpoint).join("\n")}`;
    }
  }
  if (!lyrics || lyrics === "[Instrumental]") {
    // Return instrumental marker
    return "[Instrumental]";
  }
  return lyrics;
}

/** Find a reference track from library matching genre/mood for Cover mode */
async function findReferenceAudio(supabaseUrl: string, genre?: string, mood?: string, bpm?: number): Promise<{ url: string; id: string } | null> {
  const sb = getServiceClient(supabaseUrl);
  let query = sb.from("songs").select("id, file_url, bpm, genre, mood, quality_score").order("quality_score", { ascending: false, nullsFirst: false }).limit(10);
  
  if (genre) query = query.ilike("genre", `%${genre}%`);
  if (mood) query = query.ilike("mood", `%${mood}%`);
  
  const { data } = await query;
  if (!data || data.length === 0) return null;
  
  // If BPM provided, find closest match
  if (bpm) {
    const sorted = data.sort((a, b) => Math.abs((a.bpm || 100) - bpm) - Math.abs((b.bpm || 100) - bpm));
    return { url: sorted[0].file_url, id: sorted[0].id };
  }
  
  // Return highest quality match
  return { url: data[0].file_url, id: data[0].id };
}

/** Fetch matching skills and extract parameters */
async function getSkillParameters(supabaseUrl: string, userId: string, genre?: string, mood?: string): Promise<{
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  inference_steps?: number;
  cover_strength?: number;
  task_type?: string;
  repainting_start?: number;
  repainting_end?: number;
}> {
  const sb = getServiceClient(supabaseUrl);
  const { data: skills } = await sb.from("agent_skills")
    .select("name, content, metadata")
    .eq("user_id", userId)
    .eq("category", "generation")
    .limit(20);
  
  if (!skills || skills.length === 0) return {};
  
  // Find skill matching genre or mood
  const searchTerms = [genre?.toLowerCase(), mood?.toLowerCase()].filter(Boolean);
  const matchingSkill = skills.find(s => 
    searchTerms.some(term => s.name.toLowerCase().includes(term!) || s.content.toLowerCase().includes(term!))
  );
  
  if (!matchingSkill) return {};
  
  const meta = matchingSkill.metadata as Record<string, any> || {};
  const params: any = {};
  
  // Extract BPM (handle range like "90-100" or single value)
  if (meta.bpm_range) {
    const match = String(meta.bpm_range).match(/(\d+)/);
    if (match) params.bpm = parseInt(match[1], 10);
  } else if (meta.bpm) {
    params.bpm = parseInt(meta.bpm, 10);
  }
  
  if (meta.key) params.key_scale = meta.key;
  if (meta.time_signature) params.time_signature = meta.time_signature;
  
  // ACE-Step specific parameters
  if (meta.inference_steps) params.inference_steps = parseInt(meta.inference_steps, 10);
  if (meta.cover_strength !== undefined) params.cover_strength = parseFloat(meta.cover_strength);
  if (meta.task_type) params.task_type = meta.task_type;
  if (meta.repainting_start !== undefined) params.repainting_start = parseInt(meta.repainting_start, 10);
  if (meta.repainting_end !== undefined) params.repainting_end = parseInt(meta.repainting_end, 10);
  
  console.log(`Skill "${matchingSkill.name}" injected params:`, params);
  return params;
}

/** Core generation logic — analyzes ALL batch variations and picks the best */
async function generateWithBatch(
  acestepProxy: string,
  headers: Record<string, string>,
  params: {
    caption: string;
    lyrics: string;
    duration: number;
    bpm: number;
    keyScale: string;
    timeSig: string;
    referenceAudioUrl?: string;
    inferenceSteps?: number;
    coverStrength?: number;
    taskType?: string;
    repaintingStart?: number;
    repaintingEnd?: number;
  }
): Promise<{ audioBlob: ArrayBuffer; qualityScore: number; metadata: any; lastAnalysis?: any } | { error: string }> {
  const taskType = params.taskType || (params.referenceAudioUrl ? "cover" : "text2music");
  const body: Record<string, any> = {
    task_type: taskType,
    caption: params.caption,
    lyrics: params.lyrics,
    audio_duration: params.duration,
    bpm: params.bpm,
    keyscale: params.keyScale,
    timesignature: params.timeSig,
    batch_size: BATCH_SIZE,
    inference_steps: params.inferenceSteps || 100,
    thinking: true,
  };
  
  if (params.referenceAudioUrl) {
    body.audio_url = params.referenceAudioUrl;
    body.audio_cover_strength = params.coverStrength ?? 0.5;
  }
  
  if (taskType === "repaint") {
    if (params.repaintingStart !== undefined) body.repainting_start = params.repaintingStart;
    if (params.repaintingEnd !== undefined) body.repainting_end = params.repaintingEnd;
  }

  const releaseRes = await fetch(acestepProxy, {
    method: "POST", headers,
    body: JSON.stringify({ endpoint: "/release_task", method: "POST", body })
  });

  if (!releaseRes.ok) {
    const err = await releaseRes.text();
    return { error: `Failed to submit generation task: ${err}` };
  }

  const releaseData = await releaseRes.json();
  console.log("ACE-Step release_task response:", JSON.stringify(releaseData));
  const unwrapped = (releaseData && typeof releaseData === "object" && "code" in releaseData && "data" in releaseData) ? releaseData.data : releaseData;
  const taskId = unwrapped?.task_id || unwrapped?.taskId || unwrapped?.id;
  if (!taskId) return { error: `No task_id returned. Response: ${JSON.stringify(releaseData).slice(0, 300)}` };

  let resultData: any;
  try {
    resultData = await pollAceStepTask(acestepProxy, headers, taskId, 120, 3000);
  } catch (e: any) {
    return { error: e.message || "Generation timed out" };
  }

  const resultItems = Array.isArray(resultData) ? resultData : [resultData];
  console.log(`Batch returned ${resultItems.length} variations — analyzing ALL`);

  const sb = getServiceClient(acestepProxy.replace("/functions/v1/acestep-proxy", ""));

  // Analyze ALL variations in parallel and pick the best
  const candidates: { audioBlob: ArrayBuffer; qualityScore: number; extracted: any; item: any; index: number }[] = [];

  const analysisTasks = resultItems.map(async (item: any, index: number) => {
    const audioPath = item?.url || item?.file;
    if (!audioPath) {
      console.log(`Variation ${index}: no audio path, skipping`);
      return;
    }

    try {
      const audioRes = await fetch(acestepProxy, { method: "POST", headers, body: JSON.stringify({ endpoint: audioPath, method: "GET" }) });
      if (!audioRes.ok) {
        console.log(`Variation ${index}: download failed (${audioRes.status})`);
        return;
      }

      const audioBlob = await audioRes.arrayBuffer();
      if (audioBlob.byteLength < 1000) {
        console.log(`Variation ${index}: audio too small (${audioBlob.byteLength})`);
        return;
      }

      // Upload temp file for extract analysis
      const tempAudio = detectAudioFormat(audioBlob);
      const tempFileName = `agent/tmp-analysis-${crypto.randomUUID()}.${tempAudio.ext}`;
      await sb.storage.from("songs").upload(tempFileName, tempAudio.data, { contentType: tempAudio.mime, upsert: true });
      const { data: tempUrlData } = sb.storage.from("songs").getPublicUrl(tempFileName);

      const extracted = await analyzeAudioViaExtract(acestepProxy, headers, tempUrlData.publicUrl);
      sb.storage.from("songs").remove([tempFileName]).catch(() => {});

      const qualityScore = computeRealQualityScore(extracted, {
        bpm: params.bpm,
        keyScale: params.keyScale,
        timeSig: params.timeSig,
        prompt: params.caption,
      });

      console.log(`Variation ${index}: quality=${qualityScore}, BPM=${extracted?.bpm}, key=${extracted?.keyScale}, caption_match=${extracted?.caption ? 'yes' : 'no'}`);
      candidates.push({ audioBlob, qualityScore, extracted, item, index });
    } catch (e: any) {
      console.log(`Variation ${index}: analysis error: ${e.message}`);
    }
  });

  await Promise.all(analysisTasks);

  if (candidates.length === 0) {
    // Fallback: just download first item without analysis
    const fallbackPath = resultItems[0]?.url || resultItems[0]?.file;
    if (!fallbackPath) return { error: `No audio path in any result` };
    const audioRes = await fetch(acestepProxy, { method: "POST", headers, body: JSON.stringify({ endpoint: fallbackPath, method: "GET" }) });
    if (!audioRes.ok) return { error: `Failed to download audio (${audioRes.status})` };
    const audioBlob = await audioRes.arrayBuffer();
    return { audioBlob, qualityScore: 0.75, metadata: { bpm: params.bpm, key_scale: params.keyScale, time_signature: params.timeSig, variations_generated: resultItems.length, variations_analyzed: 0, analysis: null } };
  }

  // Sort by quality score, pick best
  candidates.sort((a, b) => b.qualityScore - a.qualityScore);
  const best = candidates[0];
  console.log(`Best variation: #${best.index} with quality=${best.qualityScore} (analyzed ${candidates.length}/${resultItems.length})`);

  return {
    audioBlob: best.audioBlob,
    qualityScore: best.qualityScore,
    lastAnalysis: best.extracted,
    metadata: {
      bpm: best.extracted?.bpm ?? best.item.bpm ?? params.bpm,
      key_scale: best.extracted?.keyScale ?? best.item.keyscale ?? params.keyScale,
      time_signature: best.extracted?.timeSignature ?? best.item.timesignature ?? params.timeSig,
      variations_generated: resultItems.length,
      variations_analyzed: candidates.length,
      selected_variation: best.index,
      all_scores: candidates.map(c => ({ variation: c.index, score: c.qualityScore })),
      analysis: best.extracted ? { extracted_bpm: best.extracted.bpm, extracted_key: best.extracted.keyScale, extracted_time_sig: best.extracted.timeSignature, caption: best.extracted.caption } : null,
    }
  };
}

async function executeGenerate(args: any, supabaseUrl: string, anonKey: string, userId?: string) {
  // Check if ACE-Step integration is enabled
  const aceStepEnabled = await isIntegrationEnabledServer("acestep", supabaseUrl);
  if (!aceStepEnabled) {
    return { error: "ACE-Step integration is disabled. Enable it in the Integrations panel to generate tracks." };
  }

  const acestepProxy = `${supabaseUrl}/functions/v1/acestep-proxy`;
  const headers: Record<string, string> = { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` };
  
  const caption = args.prompt;
  const duration = Math.min(Math.max(args.duration || 60, 30), 180);
  
  // 1. Apply lyrics structure tags
  const lyrics = applyLyricsStructure(args.lyrics, args.genre);
  
  // 2. Get skill parameters (if user_id available)
  let skillParams: any = {};
  if (userId) {
    skillParams = await getSkillParameters(supabaseUrl, userId, args.genre, args.mood);
  }
  
  // Merge with explicit args (explicit args take precedence)
  const bpm = args.bpm || skillParams.bpm || 100;
  const keyScale = args.key_scale || skillParams.key_scale || "C major";
  const timeSig = args.time_signature || skillParams.time_signature || "4/4";
  const inferenceSteps = skillParams.inference_steps || 100;
  const coverStrength = skillParams.cover_strength;
  const taskType = skillParams.task_type;
  const repaintingStart = skillParams.repainting_start;
  const repaintingEnd = skillParams.repainting_end;
  
  // 3. Find reference audio for Cover mode (unless task_type already set by skill)
  let referenceAudioUrl: string | undefined;
  if (!taskType && (args.genre || args.mood)) {
    const refTrack = await findReferenceAudio(supabaseUrl, args.genre, args.mood, bpm);
    if (refTrack) {
      referenceAudioUrl = refTrack.url;
      console.log(`Using reference track ${refTrack.id} for Cover mode`);
    }
  }

  const sb = getServiceClient(supabaseUrl);
  
  // 4. Quality gate with auto-regeneration, inference escalation & prompt refinement
  let bestResult: { audioBlob: ArrayBuffer; qualityScore: number; metadata: any; lastAnalysis?: any } | null = null;
  let attempts = 0;
  let lastAnalysis: any = null;
  
  while (attempts < MAX_REGENERATION_ATTEMPTS) {
    attempts++;
    const escalatedSteps = getInferenceStepsForAttempt(inferenceSteps, attempts);
    const refinedCaption = refinePromptForRetry(caption, attempts, { bpm, keyScale, timeSig }, lastAnalysis);
    
    console.log(`Generation attempt ${attempts}/${MAX_REGENERATION_ATTEMPTS}, inference_steps=${escalatedSteps}, prompt_refined=${attempts > 1}`);
    
    const result = await generateWithBatch(acestepProxy, headers, {
      caption: refinedCaption, lyrics, duration, bpm, keyScale, timeSig, referenceAudioUrl,
      inferenceSteps: escalatedSteps, coverStrength, taskType, repaintingStart, repaintingEnd
    });
    
    if ("error" in result) {
      console.log(`Attempt ${attempts} failed: ${result.error}`);
      if (attempts >= MAX_REGENERATION_ATTEMPTS) return result;
      continue;
    }
    
    // Track last analysis for prompt refinement on next retry
    lastAnalysis = result.lastAnalysis || null;
    
    // Check quality gate
    if (result.qualityScore >= QUALITY_THRESHOLD) {
      console.log(`Quality threshold met (${result.qualityScore} >= ${QUALITY_THRESHOLD}) on attempt ${attempts}`);
      bestResult = result;
      break;
    }
    
    // Keep best attempt even if below threshold
    if (!bestResult || result.qualityScore > bestResult.qualityScore) {
      bestResult = result;
    }
    
    if (attempts < MAX_REGENERATION_ATTEMPTS) {
      console.log(`Quality ${result.qualityScore} below threshold ${QUALITY_THRESHOLD}, escalating inference_steps and refining prompt...`);
    }
  }
  
  if (!bestResult) {
    return { error: "All generation attempts failed" };
  }
  
  // Convert audio for storage (WAV→MP3, FLAC kept as-is)
  const audioOut = detectAudioFormat(bestResult.audioBlob);
  console.log(`Audio conversion: ${bestResult.audioBlob.byteLength} → ${audioOut.data.length} bytes (${audioOut.ext})`);
  const fileName = `agent/${crypto.randomUUID()}.${audioOut.ext}`;
  const { error: uploadErr } = await sb.storage.from("songs").upload(fileName, audioOut.data, { contentType: audioOut.mime, upsert: true });
  if (uploadErr) return { error: `Upload failed: ${uploadErr.message}` };

  const { data: urlData } = sb.storage.from("songs").getPublicUrl(fileName);
  console.log("Track uploaded:", urlData.publicUrl);

  return {
    success: true,
    audio_url: urlData.publicUrl,
    duration,
    bpm: bestResult.metadata.bpm,
    key_scale: bestResult.metadata.key_scale,
    time_signature: bestResult.metadata.time_signature,
    quality_score: Math.round(bestResult.qualityScore <= 1 ? bestResult.qualityScore * 100 : bestResult.qualityScore),
    quality_analysis: bestResult.metadata.analysis || null,
    prompt: caption,
    attempts,
    variations_generated: bestResult.metadata.variations_generated,
    used_reference_audio: !!referenceAudioUrl,
    skill_params_injected: Object.keys(skillParams).length > 0,
  };
}

async function executeAnalyze(args: { audio_url: string }, supabaseUrl: string, anonKey: string) {
  const aceStepEnabled = await isIntegrationEnabledServer("acestep", supabaseUrl);
  if (!aceStepEnabled) {
    return { error: "ACE-Step integration is disabled. Enable it in the Integrations panel to analyze tracks." };
  }
  const acestepProxy = `${supabaseUrl}/functions/v1/acestep-proxy`;
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` };

  const extracted = await analyzeAudioViaExtract(acestepProxy, headers, args.audio_url);
  if (!extracted) {
    return { error: "Analysis failed — ACE-Step extract did not return results." };
  }

  return {
    success: true,
    bpm: extracted.bpm,
    key: extracted.keyScale,
    time_signature: extracted.timeSignature,
    caption: extracted.caption,
    note: "Real analysis via ACE-Step extract endpoint.",
  };
}

async function executeSave(args: any, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  // Normalize genre/mood and convert quality score to 0-100 scale
  const genre = normalizeGenre(args.genre);
  const mood = normalizeMood(args.mood);
  let qualityScore = args.quality_score ?? null;
  // If score is decimal (0-1), convert to percentage (0-100)
  if (qualityScore !== null && qualityScore > 0 && qualityScore <= 1) {
    qualityScore = Math.round(qualityScore * 100);
  }
  // Quality gate: reject tracks under 70
  if (qualityScore !== null && qualityScore < 70) {
    return { error: `Quality score ${qualityScore} is below minimum threshold (70). Track not saved. Try regenerating with different parameters.`, quality_score: qualityScore };
  }
  const { data, error } = await sb.from("songs").insert({
    title: args.title, file_url: args.audio_url, genre, mood,
    bpm: args.bpm ? Math.round(args.bpm) : null, key_scale: args.key_scale || null,
    time_signature: args.time_signature || null, duration: Math.round(args.duration || 60),
    lyrics: args.lyrics || null, prompt: args.prompt || null, quality_score: qualityScore,
    artist: "SoundAgent AI", origin_source: "sound_agent",
  }).select("id").single();
  if (error) return { error: `Save failed: ${error.message}` };
  return { success: true, song_id: data.id, title: args.title, genre, mood, quality_score: qualityScore, message: `"${args.title}" saved to song library.` };
}

async function executeUpdateSong(args: any, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const updates: Record<string, any> = {};
  if (args.title !== undefined) updates.title = args.title;
  if (args.artist !== undefined) updates.artist = args.artist;
  if (args.genre !== undefined) updates.genre = normalizeGenre(args.genre);
  if (args.mood !== undefined) updates.mood = normalizeMood(args.mood);
  if (args.bpm !== undefined) updates.bpm = Math.round(args.bpm);
  if (args.key_scale !== undefined) updates.key_scale = args.key_scale;
  if (args.time_signature !== undefined) updates.time_signature = args.time_signature;
  if (args.lyrics !== undefined) updates.lyrics = args.lyrics;
  if (args.quality_score !== undefined) {
    let qs = args.quality_score;
    if (qs > 0 && qs <= 1) qs = Math.round(qs * 100);
    updates.quality_score = qs;
  }

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
    if (item.genre !== undefined) updates.genre = normalizeGenre(item.genre);
    if (item.mood !== undefined) updates.mood = normalizeMood(item.mood);
    if (item.bpm !== undefined) updates.bpm = Math.round(item.bpm);
    if (item.key_scale !== undefined) updates.key_scale = item.key_scale;
    if (item.time_signature !== undefined) updates.time_signature = item.time_signature;
    if (item.lyrics !== undefined) updates.lyrics = item.lyrics;
    if (item.quality_score !== undefined) {
      let qs = item.quality_score;
      if (qs > 0 && qs <= 1) qs = Math.round(qs * 100);
      updates.quality_score = qs;
    }

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

async function executeReadSchedule(args: { profile_id?: string }, supabaseUrl: string, userId?: string | null) {
  const sb = getServiceClient(supabaseUrl);
  
  // Resolve profile_id if not provided
  let profileId = args.profile_id;
  if (!profileId && userId) {
    const { data: profile } = await sb.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    profileId = profile?.id;
  }
  if (!profileId) return { total_slots: 0, message: "No profile found. Cannot read schedule.", profile_id: null };

  let query = sb.from("schedule_entries").select("id, day_of_week, start_time, end_time, is_active, playlist_id, color, profile_id").order("day_of_week").order("start_time");
  query = query.eq("profile_id", profileId);
  const { data: entries, error } = await query;
  if (error) return { error: error.message };
  if (!entries || entries.length === 0) return { total_slots: 0, profile_id: profileId, message: "No schedule entries found. Use create_schedule_entry with this profile_id to add entries." };

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
      entry_id: e.id,
      day: DAY_NAMES[e.day_of_week] || `Day ${e.day_of_week}`,
      day_of_week: e.day_of_week,
      time: `${e.start_time.slice(0, 5)}-${e.end_time.slice(0, 5)}`,
      start_time: e.start_time.slice(0, 5),
      end_time: e.end_time.slice(0, 5),
      slot_duration_min: slotMinutes, playlist_title: playlist?.title || "Unknown",
      playlist_id: e.playlist_id, song_count: stats.song_count,
      music_duration_min: stats.total_duration_min, coverage_percent: coveragePercent,
      needs_more_music: coveragePercent < 80, is_active: e.is_active, color: e.color,
    };
  });

  const underCovered = slots.filter(s => s.needs_more_music && s.is_active);
  return {
    profile_id: profileId,
    total_slots: slots.length, active_slots: slots.filter(s => s.is_active).length,
    schedule: slots, under_covered_slots: underCovered.length,
    summary: underCovered.length > 0
      ? `${underCovered.length} active slot(s) have less than 80% music coverage.`
      : "All active slots have sufficient music coverage (≥80%).",
  };
}

async function executeListPlaylists(args: { limit?: number }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data, error } = await sb.from("playlists").select("id, title, description, cover_image_url").order("title").limit(args.limit || 50);
  if (error) return { error: error.message };
  // Enrich with song counts
  const playlistIds = (data || []).map(p => p.id);
  const { data: pSongs } = await sb.from("playlist_songs").select("playlist_id, song_id").in("playlist_id", playlistIds.length > 0 ? playlistIds : ["none"]);
  const countMap: Record<string, number> = {};
  for (const ps of (pSongs || [])) {
    countMap[ps.playlist_id] = (countMap[ps.playlist_id] || 0) + 1;
  }
  const playlists = (data || []).map(p => ({
    ...p,
    song_count: countMap[p.id] || 0,
  }));
  return { playlists, count: playlists.length, tip: "Use playlist IDs with create_schedule_entry to assign them to time slots." };
}

async function executeCreateScheduleEntry(args: { profile_id: string; playlist_id: string; day_of_week: number; start_time: string; end_time: string; color?: string }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { data, error } = await sb.from("schedule_entries").insert({
    profile_id: args.profile_id,
    playlist_id: args.playlist_id,
    day_of_week: args.day_of_week,
    start_time: args.start_time,
    end_time: args.end_time,
    color: args.color || "#9b87f5",
  }).select("id").single();
  if (error) return { error: `Failed to create schedule entry: ${error.message}` };
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return { success: true, entry_id: data.id, message: `Schedule entry created: ${dayNames[args.day_of_week]} ${args.start_time}-${args.end_time}` };
}

async function executeDeleteScheduleEntry(args: { entry_id: string }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { error } = await sb.from("schedule_entries").delete().eq("id", args.entry_id);
  if (error) return { error: `Failed to delete schedule entry: ${error.message}` };
  return { success: true, message: "Schedule entry deleted." };
}

async function executeUpdateScheduleEntry(args: { entry_id: string; playlist_id?: string; day_of_week?: number; start_time?: string; end_time?: string; color?: string; is_active?: boolean }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const updates: Record<string, any> = {};
  if (args.playlist_id !== undefined) updates.playlist_id = args.playlist_id;
  if (args.day_of_week !== undefined) updates.day_of_week = args.day_of_week;
  if (args.start_time !== undefined) updates.start_time = args.start_time;
  if (args.end_time !== undefined) updates.end_time = args.end_time;
  if (args.color !== undefined) updates.color = args.color;
  if (args.is_active !== undefined) updates.is_active = args.is_active;
  if (Object.keys(updates).length === 0) return { error: "No fields to update" };
  const { error } = await sb.from("schedule_entries").update(updates).eq("id", args.entry_id);
  if (error) return { error: `Failed to update schedule entry: ${error.message}` };
  return { success: true, entry_id: args.entry_id, updated_fields: Object.keys(updates), message: `Schedule entry updated: ${Object.keys(updates).join(", ")}` };
}

async function executeClearSchedule(args: { profile_id: string }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const { error, count } = await sb.from("schedule_entries").delete().eq("profile_id", args.profile_id);
  if (error) return { error: `Failed to clear schedule: ${error.message}` };
  return { success: true, message: `Schedule cleared. All entries removed.` };
}

async function executeAnalyzePlayLogs(args: { days?: number; user_id?: string }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const daysBack = args.days || 30;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  
  let query = sb.from("play_logs").select("song_id, duration_listened, played_at").gte("played_at", since);
  if (args.user_id) query = query.eq("user_id", args.user_id);
  const { data: logs, error } = await query.limit(1000);
  if (error) return { error: error.message };
  if (!logs || logs.length === 0) return { total_plays: 0, period_days: daysBack, message: "No play data in this period." };

  const songIds = [...new Set(logs.map(l => l.song_id))];
  const { data: songs } = await sb.from("songs").select("id, title, genre, mood, bpm").in("id", songIds);
  const songMap = new Map((songs || []).map(s => [s.id, s]));

  const songPlays: Record<string, { count: number; duration: number; title: string; genre?: string; mood?: string }> = {};
  const genrePlays: Record<string, { count: number; duration: number }> = {};
  const moodPlays: Record<string, { count: number; duration: number }> = {};
  const bpmBuckets: Record<string, number> = { "60-85": 0, "85-100": 0, "100-125": 0, "125+": 0 };

  for (const log of logs) {
    const song = songMap.get(log.song_id);
    const dur = log.duration_listened || 0;
    const title = song?.title || "Unknown";
    
    if (!songPlays[log.song_id]) songPlays[log.song_id] = { count: 0, duration: 0, title, genre: song?.genre || undefined, mood: song?.mood || undefined };
    songPlays[log.song_id].count++;
    songPlays[log.song_id].duration += dur;

    const genre = song?.genre || "Untagged";
    if (!genrePlays[genre]) genrePlays[genre] = { count: 0, duration: 0 };
    genrePlays[genre].count++;
    genrePlays[genre].duration += dur;

    const mood = song?.mood || "Untagged";
    if (!moodPlays[mood]) moodPlays[mood] = { count: 0, duration: 0 };
    moodPlays[mood].count++;
    moodPlays[mood].duration += dur;

    if (song?.bpm) {
      if (song.bpm < 85) bpmBuckets["60-85"]++;
      else if (song.bpm < 100) bpmBuckets["85-100"]++;
      else if (song.bpm < 125) bpmBuckets["100-125"]++;
      else bpmBuckets["125+"]++;
    }
  }

  const topSongs = Object.entries(songPlays).sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([id, s]) => ({ song_id: id, ...s, duration_min: Math.round(s.duration / 60) }));
  const topGenres = Object.entries(genrePlays).sort((a, b) => b[1].count - a[1].count).map(([g, s]) => ({ genre: g, plays: s.count, duration_min: Math.round(s.duration / 60) }));
  const topMoods = Object.entries(moodPlays).sort((a, b) => b[1].count - a[1].count).map(([m, s]) => ({ mood: m, plays: s.count, duration_min: Math.round(s.duration / 60) }));

  return {
    period_days: daysBack, total_plays: logs.length,
    total_listen_minutes: Math.round(logs.reduce((s, l) => s + (l.duration_listened || 0), 0) / 60),
    top_songs: topSongs, genre_breakdown: topGenres, mood_breakdown: topMoods, bpm_distribution: bpmBuckets,
    insight: topGenres.length > 0 ? `Most played genre: ${topGenres[0].genre} (${topGenres[0].plays} plays). Consider generating more ${topGenres[0].genre} tracks.` : "Not enough data for insights yet.",
  };
}

async function executeProactiveScan(args: { profile_id?: string }, supabaseUrl: string, userId?: string | null) {
  const suggestions: { priority: number; category: string; message: string; action?: string }[] = [];

  // 1. Schedule analysis
  const scheduleResult = await executeReadSchedule(args, supabaseUrl, userId);
  const profileId = scheduleResult.profile_id;

  if (scheduleResult.total_slots === 0) {
    suggestions.push({ priority: 1, category: "schedule", message: "No schedule configured. Your music won't auto-play without a schedule.", action: "create_schedule" });
  } else if (scheduleResult.under_covered_slots > 0) {
    suggestions.push({ priority: 2, category: "schedule", message: `${scheduleResult.under_covered_slots} time slot(s) have less than 80% music coverage.`, action: "fill_schedule_gaps" });
  }

  // Check for empty weekdays
  if (scheduleResult.schedule) {
    const scheduledDays = new Set(scheduleResult.schedule.map((s: any) => s.day_of_week));
    const missingWeekdays = [1, 2, 3, 4, 5].filter(d => !scheduledDays.has(d));
    if (missingWeekdays.length > 0) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      suggestions.push({ priority: 2, category: "schedule", message: `No music scheduled for: ${missingWeekdays.map(d => dayNames[d]).join(", ")}`, action: "add_schedule_entries" });
    }
  }

  // 2. Library health
  const libraryResult = await executeAnalyzeLibrary(supabaseUrl);
  if (libraryResult.total_tracks === 0) {
    suggestions.push({ priority: 1, category: "library", message: "Library is empty! Generate some tracks to get started.", action: "generate_tracks" });
  } else {
    if (libraryResult.gaps?.missing_genres?.length > 0) {
      suggestions.push({ priority: 3, category: "library", message: `Missing genres: ${libraryResult.gaps.missing_genres.join(", ")}. More variety = better scheduling.`, action: "generate_missing_genres" });
    }
    if (libraryResult.gaps?.empty_bpm_ranges?.length > 0) {
      suggestions.push({ priority: 4, category: "library", message: `No tracks in BPM range(s): ${libraryResult.gaps.empty_bpm_ranges.join(", ")}`, action: "fill_bpm_gaps" });
    }
  }

  // 3. Incomplete metadata
  const incompleteResult = await executeFindIncomplete({ limit: 50 }, supabaseUrl);
  if (incompleteResult.incomplete_count > 0) {
    const counts = incompleteResult.counts;
    const issues: string[] = [];
    if (counts.lyrics > 0) issues.push(`${counts.lyrics} missing lyrics`);
    if (counts.cover > 0) issues.push(`${counts.cover} missing covers`);
    if (counts.genre > 0) issues.push(`${counts.genre} untagged genre`);
    if (counts.bpm > 0) issues.push(`${counts.bpm} missing BPM`);
    suggestions.push({ priority: 3, category: "metadata", message: `${incompleteResult.incomplete_count} songs need attention: ${issues.join(", ")}`, action: "fix_metadata" });
  }

  // 4. Play trends (last 7 days)
  const playResult = await executeAnalyzePlayLogs({ days: 7 }, supabaseUrl);
  if (playResult.total_plays > 0 && playResult.top_songs?.length > 0) {
    const topGenre = playResult.genre_breakdown?.[0];
    if (topGenre) {
      const genreCount = libraryResult.genre_distribution?.[topGenre.genre] || 0;
      if (genreCount < 10) {
        suggestions.push({ priority: 2, category: "trending", message: `"${topGenre.genre}" is your most-played genre (${topGenre.plays} plays this week) but you only have ${genreCount} tracks. Generate more!`, action: "generate_popular_genre" });
      }
    }
  }

  suggestions.sort((a, b) => a.priority - b.priority);

  return {
    profile_id: profileId,
    total_suggestions: suggestions.length,
    suggestions: suggestions.slice(0, 5),
    summary: suggestions.length === 0
      ? "Everything looks great! Your library, schedule, and metadata are all in good shape. 🎉"
      : `Found ${suggestions.length} improvement(s). Top priority: ${suggestions[0].message}`,
  };
}


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

async function executeNotifyAdmin(args: { title: string; message: string; category?: string }, supabaseUrl: string, userId: string) {
  const sb = getServiceClient(supabaseUrl);
  const { error } = await sb.from("admin_notifications").insert({
    user_id: userId,
    title: args.title,
    message: args.message,
    category: args.category || "agent",
  });
  if (error) return { error: `Failed to send notification: ${error.message}` };
  return { success: true, message: `Notification sent: "${args.title}"` };
}

// ── Featured tracks tool executor ────────────────────────────────────────

async function executeUpdateFeaturedTracks(args: { song_ids: string[]; label?: string }, supabaseUrl: string) {
  const sb = getServiceClient(supabaseUrl);
  const songIds = (args.song_ids || []).slice(0, 6);
  if (songIds.length === 0) return { error: "No song IDs provided" };

  // Verify songs exist
  const { data: songs, error: fetchErr } = await sb.from("songs").select("id, title").in("id", songIds);
  if (fetchErr) return { error: `Failed to verify songs: ${fetchErr.message}` };
  if (!songs || songs.length === 0) return { error: "None of the provided song IDs exist" };

  const validIds = songs.map(s => s.id);
  const label = args.label || "Fresh Drops";

  // Upsert into site_settings
  const { error: upsertErr } = await sb.from("site_settings")
    .upsert({ key: "featured_tracks", value: { song_ids: validIds, label, updated_at: new Date().toISOString() } }, { onConflict: "key" });
  if (upsertErr) return { error: `Failed to update featured tracks: ${upsertErr.message}` };

  return {
    success: true,
    featured_count: validIds.length,
    label,
    songs: songs.map(s => s.title),
    message: `Landing page updated: ${validIds.length} tracks featured as "${label}".`,
  };
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
  const chatModel = settings?.chatModel || "google/gemini-2.5-pro";
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
        // Fetch persistent context + listening trends in parallel
        const [context, listeningTrends] = await Promise.all([
          userId ? fetchAgentContext(supabaseUrl, userId) : Promise.resolve({ objectives: [], skills: [], memories: [] }),
          fetchListeningTrends(supabaseUrl),
        ]);
        const systemPrompt = buildSystemPrompt(context, listeningTrends);

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
              list_playlists: "Listing available playlists...",
              create_schedule_entry: "Creating schedule entry...",
              update_schedule_entry: "Updating schedule entry...",
              delete_schedule_entry: "Deleting schedule entry...",
              clear_schedule: "Clearing entire schedule...",
              analyze_play_logs: "Analyzing listening data...",
              proactive_scan: "Running health check...",
              update_featured_tracks: "Updating landing page showcase...",
              notify_admin: "Sending notification...",
            };
            console.log(`[sound-agent] Tool call #${toolCallCount}: ${fn}(${JSON.stringify(args).slice(0, 200)})`);
            push("status", { phase: "tool", tool: fn, message: toolLabels[fn] || `Running ${fn}...` });

            try {
              switch (fn) {
                case "research_music_style": result = executeResearch(args); break;
                case "generate_track": result = await executeGenerate(args, supabaseUrl, anonKey, userId); if (result.audio_url) collectedAudioUrls.push(result.audio_url); break;
                case "analyze_track": result = await executeAnalyze(args, supabaseUrl, anonKey); break;
                case "save_to_library": result = await executeSave(args, supabaseUrl); break;
                case "list_library": result = await executeListLibrary(args, supabaseUrl); break;
                case "create_playlist": result = await executeCreatePlaylist(args, supabaseUrl); break;
                case "analyze_library": result = await executeAnalyzeLibrary(supabaseUrl); break;
                case "read_schedule": result = await executeReadSchedule(args, supabaseUrl, userId); break;
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
                case "list_playlists": result = await executeListPlaylists(args, supabaseUrl); break;
                case "create_schedule_entry": result = await executeCreateScheduleEntry(args, supabaseUrl); break;
                case "update_schedule_entry": result = await executeUpdateScheduleEntry(args, supabaseUrl); break;
                case "delete_schedule_entry": result = await executeDeleteScheduleEntry(args, supabaseUrl); break;
                case "clear_schedule": result = await executeClearSchedule(args, supabaseUrl); break;
                case "analyze_play_logs": result = await executeAnalyzePlayLogs(args, supabaseUrl); break;
                case "proactive_scan": result = await executeProactiveScan(args, supabaseUrl, userId); break;
                case "update_featured_tracks": result = await executeUpdateFeaturedTracks(args, supabaseUrl); break;
                case "notify_admin": result = userId ? await executeNotifyAdmin(args, supabaseUrl, userId) : { error: "No user context" }; break;
                default: result = { error: `Unknown tool: ${fn}` };
              }
            } catch (e) { result = { error: `Tool error: ${e.message}` }; console.error(`[sound-agent] Tool ${fn} error:`, e.message); }

            console.log(`[sound-agent] Tool ${fn} result: ${JSON.stringify(result).slice(0, 300)}`);
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
