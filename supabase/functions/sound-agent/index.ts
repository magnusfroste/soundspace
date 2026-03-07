
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

Your workflow:
1. When given a task, first use research_music_style to understand what works for the venue
2. Generate tracks using generate_track with carefully crafted prompts
3. After generation, use analyze_track to verify BPM/key match the brief
4. If quality is poor or specs don't match, regenerate with adjusted parameters
5. Save approved tracks to the library using save_to_library

Always explain your reasoning. When generating music, describe what you're creating and why.
For lyrics, use structural tags like [Verse], [Chorus], [Bridge], [Outro].
When the user asks for multiple tracks, work through them methodically one at a time.

IMPORTANT: After generating a track, ALWAYS report the audio URL to the user so they can listen.
Format audio URLs as: 🎵 **Listen:** [audio_url]`;

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
          prompt: { type: "string", description: "The prompt used for generation" }
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

  // Build caption from prompt
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
  const taskId = releaseData.task_id;
  if (!taskId) return { error: "No task_id returned from ACE-Step" };

  // Poll for result (max 120s)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const pollRes = await fetch(acestepProxy, {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: `/query_result?task_id=${taskId}`,
        method: "GET",
      })
    });

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    if (pollData.status === "completed" || pollData.status === "success") {
      // Get audio
      const audioRes = await fetch(acestepProxy, {
        method: "POST",
        headers,
        body: JSON.stringify({
          endpoint: `/v1/audio/tasks/${taskId}/result?index=0`,
          method: "GET",
        })
      });

      if (!audioRes.ok) return { error: "Failed to download generated audio" };

      const audioBlob = await audioRes.arrayBuffer();

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

    if (pollData.status === "failed" || pollData.status === "error") {
      return { error: `Generation failed: ${pollData.error || "unknown"}` };
    }
  }

  return { error: "Generation timed out after 120 seconds" };
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

  const { error } = await sb.from("songs").insert({
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
    artist: "SoundAgent AI",
    origin_source: "sound_agent",
  });

  if (error) return { error: `Save failed: ${error.message}` };
  return { success: true, title: args.title, message: `"${args.title}" saved to song library.` };
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

// ── Main handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversation_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Build messages with system prompt
    const llmMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const collectedAudioUrls: string[] = [];
    const MAX_TOOL_CALLS = 10;
    let toolCallCount = 0;

    // Tool-calling loop
    while (toolCallCount < MAX_TOOL_CALLS) {
      const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: llmMessages,
          tools: TOOLS,
          stream: false,
        }),
      });

      if (!llmRes.ok) {
        const status = llmRes.status;
        const text = await llmRes.text();
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error ${status}: ${text}`);
      }

      const llmData = await llmRes.json();
      const choice = llmData.choices?.[0];
      if (!choice) throw new Error("No response from AI");

      const msg = choice.message;
      llmMessages.push(msg);

      // If no tool calls, we're done — stream the final response
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        break;
      }

      // Execute tool calls
      for (const tc of msg.tool_calls) {
        toolCallCount++;
        const fn = tc.function.name;
        const args = JSON.parse(tc.function.arguments || "{}");
        let result: any;

        try {
          switch (fn) {
            case "research_music_style":
              result = executeResearch(args);
              break;
            case "generate_track":
              result = await executeGenerate(args, supabaseUrl, anonKey);
              if (result.audio_url) collectedAudioUrls.push(result.audio_url);
              break;
            case "analyze_track":
              result = await executeAnalyze(args, supabaseUrl, anonKey);
              break;
            case "save_to_library":
              result = await executeSave(args, supabaseUrl);
              break;
            case "list_library":
              result = await executeListLibrary(args, supabaseUrl);
              break;
            default:
              result = { error: `Unknown tool: ${fn}` };
          }
        } catch (e) {
          result = { error: `Tool execution error: ${e.message}` };
        }

        llmMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Extract final assistant content
    const lastMsg = llmMessages[llmMessages.length - 1];
    const content = lastMsg.role === "assistant" ? (lastMsg.content || "") : "I completed the tool operations but couldn't generate a summary.";

    return new Response(
      JSON.stringify({
        content,
        audio_urls: collectedAudioUrls,
        tool_call_count: toolCallCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sound-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
