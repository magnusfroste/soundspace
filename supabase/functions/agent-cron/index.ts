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

  const settings = (settingsRow?.value as Record<string, any>) || {
    chatModel: "google/gemini-3-flash-preview",
    sttProvider: "elevenlabs",
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

      const prompt = `[AUTOMATED OBJECTIVE EXECUTION]

You are running in autonomous mode. Work toward this objective:

**Objective:** ${obj.title}
**Description:** ${obj.description || "No description"}
**Current Progress:** ${progressSummary}

Analyze what's needed, take concrete actions (generate tracks, fix metadata, fill gaps), and update the objective progress when done. Be efficient — focus on the highest-impact actions first. When done, summarize what you accomplished.`;

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

    const proactivePrompt = `[AUTONOMOUS PROACTIVE CYCLE]

You are running in fully autonomous mode at the scheduled daily maintenance time. Execute the following workflow WITHOUT asking questions — just act on data:

1. **Trend Analysis**: Call analyze_play_logs(days=7) to see what's trending this week
2. **Library Check**: Call analyze_library to find gaps and opportunities  
3. **Generate Content**: Based on trends and gaps, generate 2-3 new tracks in popular or underrepresented genres. Choose creative titles, appropriate BPM/key for the genre.
4. **Save Everything**: Save all generated tracks to the library with full metadata
5. **Playlist Curation**: Create or update a "Fresh Drops" playlist with the newest high-quality tracks (last 7 days)
6. **Landing Promotion**: Call update_featured_tracks with the best 4-6 tracks (mix of new and trending) labeled "Trending Now"
7. **Health Check**: Run proactive_scan and fix any critical issues (missing metadata, empty schedules)

Be creative with track names and prompts. Think like a music curator — what would delight listeners?
After completing, save a skill with what worked well.`;

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
