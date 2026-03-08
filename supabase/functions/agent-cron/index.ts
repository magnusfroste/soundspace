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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  console.log("[agent-cron] Starting automated objective execution");

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

  console.log(`[agent-cron] Found ${objectives.length} objective(s) to execute`);

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
    console.log(`[agent-cron] Processing objective: "${obj.title}" for user ${obj.user_id}`);

    const progressSummary = obj.progress ? JSON.stringify(obj.progress) : "No progress yet";

    const prompt = `[AUTOMATED OBJECTIVE EXECUTION]

You are running in autonomous mode. Work toward this objective:

**Objective:** ${obj.title}
**Description:** ${obj.description || "No description"}
**Current Progress:** ${progressSummary}

Analyze what's needed, take concrete actions (generate tracks, fix metadata, fill gaps), and update the objective progress when done. Be efficient — focus on the highest-impact actions first. When done, summarize what you accomplished.`;

    try {
      // Call sound-agent with the objective prompt
      const response = await fetch(`${supabaseUrl}/functions/v1/sound-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          settings,
          user_id: obj.user_id,
        }),
      });

      if (!response.ok) {
        console.error(`[agent-cron] sound-agent failed for objective ${obj.id}: ${response.status}`);
        results.push({ objective_id: obj.id, status: "error", error: `HTTP ${response.status}` });
        continue;
      }

      // Consume SSE stream to completion (we don't display it, just let it run)
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let lastContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        // Extract last content for logging
        const tokenMatch = text.match(/"content":"([^"]+)"/g);
        if (tokenMatch) lastContent = tokenMatch[tokenMatch.length - 1];
      }

      console.log(`[agent-cron] Completed objective "${obj.title}"`);
      results.push({ objective_id: obj.id, title: obj.title, status: "completed" });
    } catch (e) {
      console.error(`[agent-cron] Error processing objective ${obj.id}:`, e);
      results.push({ objective_id: obj.id, status: "error", error: e instanceof Error ? e.message : "Unknown" });
    }
  }

  console.log(`[agent-cron] Finished. Results:`, JSON.stringify(results));

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
