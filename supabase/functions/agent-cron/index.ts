import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  console.log("[agent-cron] Starting automated run (objectives + proactive cycle)");

  // Fetch agent settings
  const { data: settingsRow } = await sb.from("site_settings")
    .select("value")
    .eq("key", "module:sound-agent")
    .maybeSingle();

  const baseSettings = (settingsRow?.value as Record<string, any>) || {
    chatModel: "google/gemini-3-flash-preview",
    sttProvider: "elevenlabs",
  };

  // Override model for autonomous mode — needs strong reasoning for multi-step tool chaining
  const settings = {
    ...baseSettings,
    chatModel: "google/gemini-2.5-flash",
  };

  const results: any[] = [];

  // ── 1. Execute auto-execute objectives ─────────────────────────────────
  const { data: objectives, error } = await sb.from("agent_objectives")
    .select("id, user_id, title, description, progress")
    .eq("status", "active")
    .eq("auto_execute", true);

  if (error) {
    console.error("[agent-cron] Failed to fetch objectives:", error.message);
  }

  if (objectives && objectives.length > 0) {
    console.log(`[agent-cron] Found ${objectives.length} objective(s) — firing requests`);

    for (const obj of objectives) {
      const progressSummary = obj.progress ? JSON.stringify(obj.progress) : "No progress yet";

      const prompt = `[AUTOMATED OBJECTIVE EXECUTION — AUTONOMOUS MODE]

You are running in fully autonomous mode. You MUST use tools to take action. Do NOT just describe what you would do — actually DO it by calling tools.

**Objective:** ${obj.title}
**Description:** ${obj.description || "No description"}
**Current Progress:** ${progressSummary}

## CRITICAL RULES — READ CAREFULLY:
1. Call ONLY ONE tool at a time. Never batch multiple tool calls in one response.
2. After EVERY generate_track, your NEXT tool call MUST be save_to_library with the returned audio_url.
3. Generate only 1 track per run to stay within time limits.
4. After saving, call update_objective_progress to record what you did.

## WORKFLOW (one tool call per step):
Step 1: Call analyze_library to understand current state
Step 2: Call generate_track with a creative prompt (use inference_steps 60 for speed)
Step 3: Call save_to_library with the audio_url from step 2 (include title, artist, genre, mood, bpm)
Step 4: Call update_objective_progress with a summary
Step 5: Call notify_admin with what you accomplished

NEVER call multiple generate_track in one response. ONE track, then SAVE it.`;

      try {
        fetch(`${supabaseUrl}/functions/v1/sound-agent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            settings,
            user_id: obj.user_id,
          }),
        }).then(async (res) => {
          try {
            const reader = res.body!.getReader();
            while (true) {
              const { done } = await reader.read();
              if (done) break;
            }
            console.log(`[agent-cron][bg] Completed objective "${obj.title}"`);
            await sb.from("agent_cron_logs").insert({
              objective_id: obj.id,
              objective_title: obj.title,
              status: "completed",
              user_id: obj.user_id,
            });
            // Notify admin
            await sb.from("admin_notifications").insert({
              user_id: obj.user_id,
              title: `✅ Objective completed: ${obj.title}`,
              message: `SoundAgent autonomously worked on "${obj.title}" and completed the execution.`,
              category: "agent",
            });
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : "Unknown";
            console.error(`[agent-cron][bg] Error for "${obj.title}":`, errMsg);
            await sb.from("agent_cron_logs").insert({
              objective_id: obj.id,
              objective_title: obj.title,
              status: "error",
              error: errMsg,
              user_id: obj.user_id,
            });
          }
        }).catch((e) => {
          console.error(`[agent-cron][bg] Fetch failed for "${obj.title}":`, e);
        });

        console.log(`[agent-cron] Fired objective "${obj.title}" for user ${obj.user_id}`);
        results.push({ type: "objective", objective_id: obj.id, title: obj.title, status: "fired" });
      } catch (e) {
        console.error(`[agent-cron] Error firing objective ${obj.id}:`, e);
        results.push({ type: "objective", objective_id: obj.id, status: "error", error: (e as Error).message });
      }
    }
  }

  // ── 2. Proactive autonomous cycle ──────────────────────────────────────
  // Find first admin user to run the proactive cycle as
  const { data: adminRole } = await sb.from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (adminRole?.user_id) {
    const adminUserId = adminRole.user_id;
    console.log(`[agent-cron] Starting proactive cycle for admin ${adminUserId}`);

    const proactivePrompt = `[AUTONOMOUS PROACTIVE CYCLE — TOOL USE REQUIRED]

You are running in fully autonomous mode. You MUST call tools to take action. Do NOT just describe what you would do.

## CRITICAL RULES:
- Call ONLY ONE tool at a time. Never batch multiple tool calls in one response.
- After EVERY generate_track call, your NEXT call MUST be save_to_library with the audio_url.
- Generate only 1 track to stay within time limits.
- Use inference_steps 60 for faster generation.

## STEP-BY-STEP WORKFLOW (one tool call per step):

Step 1: Call analyze_play_logs(days=7) 
Step 2: Call analyze_library
Step 3: Call generate_track with a creative prompt based on gaps/trends (inference_steps: 60)
Step 4: Call save_to_library with: audio_url from step 3, title, artist="SomHonesto AI", genre, mood, bpm
Step 5: Call proactive_scan to check platform health
Step 6: Call notify_admin summarizing what you did

NEVER call multiple tools at once. One tool per response. Always save after generating.`;

    try {
      fetch(`${supabaseUrl}/functions/v1/sound-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: proactivePrompt }],
          settings,
          user_id: adminUserId,
        }),
      }).then(async (res) => {
        try {
          const reader = res.body!.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
          console.log("[agent-cron][bg] Proactive cycle completed");
          await sb.from("agent_cron_logs").insert({
            objective_title: "Proactive Autonomous Cycle",
            status: "completed",
            user_id: adminUserId,
          });
          // Write admin notification
          await sb.from("admin_notifications").insert({
            user_id: adminUserId,
            title: "🤖 Proactive cycle completed",
            message: "SoundAgent analyzed trends, generated new tracks, curated playlists, and updated the landing page.",
            category: "agent",
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "Unknown";
          console.error("[agent-cron][bg] Proactive cycle error:", errMsg);
          await sb.from("agent_cron_logs").insert({
            objective_title: "Proactive Autonomous Cycle",
            status: "error",
            error: errMsg,
            user_id: adminUserId,
          });
        }
      }).catch((e) => {
        console.error("[agent-cron][bg] Proactive fetch failed:", e);
      });

      console.log("[agent-cron] Fired proactive cycle");
      results.push({ type: "proactive", status: "fired", user_id: adminUserId });
    } catch (e) {
      console.error("[agent-cron] Error firing proactive cycle:", e);
      results.push({ type: "proactive", status: "error", error: (e as Error).message });
    }
  } else {
    console.log("[agent-cron] No admin user found — skipping proactive cycle");
  }

  console.log(`[agent-cron] All ${results.length} task(s) fired. Returning immediately.`);

  return new Response(JSON.stringify({ fired: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
