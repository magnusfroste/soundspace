
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
5. ALWAYS save every successfully generated track to the library using save_to_library — this is MANDATORY, never skip this step

Always explain your reasoning. When generating music, describe what you're creating and why.
For lyrics, use structural tags like [Verse], [Chorus], [Bridge], [Outro].
When the user asks for multiple tracks, work through them methodically one at a time.

CRITICAL RULES:
- After generating a track, ALWAYS call save_to_library immediately. Do NOT wait for user approval.
- After saving, report the audio URL so the user can listen: 🎵 **Listen:** [audio_url]
- Every generated track MUST end up in the song library. If save_to_library fails, report the error.`;

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
  console.log("ACE-Step release_task response:", JSON.stringify(releaseData));
  
  // Handle various response formats from ACE-Step
  const taskId = releaseData.task_id || releaseData.taskId || releaseData.id || (releaseData.data && (releaseData.data.task_id || releaseData.data.taskId || releaseData.data.id));
  if (!taskId) return { error: `No task_id returned from ACE-Step. Response: ${JSON.stringify(releaseData).slice(0, 300)}` };

  // Helper to check if status means "done"
  const isDone = (s: string) => ["completed", "success", "succeeded"].includes(s?.toLowerCase?.() || "");
  const isFailed = (s: string) => ["failed", "error"].includes(s?.toLowerCase?.() || "");

  // Check if already completed in release response
  const releaseStatus = releaseData.data?.status || releaseData.status;
  if (isDone(releaseStatus)) {
    console.log("Task completed immediately, fetching audio...");
  } else {
    // Poll for result (max 120s)
    let pollDone = false;
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
      const status = pollData.data?.status || pollData.status || "";
      console.log(`Poll ${i}: status=${status}`);

      if (isDone(status)) { pollDone = true; break; }
      if (isFailed(status)) {
        return { error: `Generation failed: ${pollData.data?.error || pollData.error || "unknown"}` };
      }
    }
    if (!pollDone) return { error: "Generation timed out after 120 seconds" };
  }

  // Fetch generated audio
  const audioRes = await fetch(acestepProxy, {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint: `/v1/audio/tasks/${taskId}/result?index=0`,
      method: "GET",
    })
  });

  if (!audioRes.ok) {
    const errText = await audioRes.text();
    console.log("Audio fetch failed:", audioRes.status, errText);
    return { error: `Failed to download generated audio (${audioRes.status})` };
  }

  const audioBlob = await audioRes.arrayBuffer();
  console.log(`Audio downloaded: ${audioBlob.byteLength} bytes`);

  if (audioBlob.byteLength < 1000) {
    return { error: `Audio too small (${audioBlob.byteLength} bytes) — generation may have failed silently` };
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
        const MAX_TOOL_CALLS = 10;
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
