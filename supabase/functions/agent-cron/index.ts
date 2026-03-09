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

  console.log("[agent-cron] Starting automated objective execution (fire-and-forget)");

  // Fetch all active objectives with auto_execute enabled
  const { data: objectives, error } = await sb.from("agent_objectives")
    .select("id, user_id, title, description, progress")
    .eq("status", "active")
    .eq("auto_execute", true);

  if (error) {
    console.error("[agent-cron] Failed to fetch objectives:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!objectives || objectives.length === 0) {
    console.log("[agent-cron] No auto-execute objectives found");
    return new Response(JSON.stringify({ message: "No objectives to execute" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[agent-cron] Found ${objectives.length} objective(s) — firing requests`);

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

  for (const obj of objectives) {
    const progressSummary = obj.progress ? JSON.stringify(obj.progress) : "No progress yet";

    const prompt = `[AUTOMATED OBJECTIVE EXECUTION]

You are running in autonomous mode. Work toward this objective:

**Objective:** ${obj.title}
**Description:** ${obj.description || "No description"}
**Current Progress:** ${progressSummary}

Analyze what's needed, take concrete actions (generate tracks, fix metadata, fill gaps), and update the objective progress when done. Be efficient — focus on the highest-impact actions first. When done, summarize what you accomplished.`;

    try {
      // Fire-and-forget: send request but don't await the response stream
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
        // Background: consume stream so it completes, then log
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
      results.push({ objective_id: obj.id, title: obj.title, status: "fired" });

    } catch (e) {
      console.error(`[agent-cron] Error firing objective ${obj.id}:`, e);
      const errMsg = e instanceof Error ? e.message : "Unknown";
      results.push({ objective_id: obj.id, status: "error", error: errMsg });
    }
  }

  console.log(`[agent-cron] All ${results.length} objective(s) fired. Returning immediately.`);

  return new Response(JSON.stringify({ fired: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
