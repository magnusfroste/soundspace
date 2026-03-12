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

  try {
    const { schedule } = await req.json();

    if (!schedule || typeof schedule !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'schedule' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate cron expression (basic: 5 fields)
    const parts = schedule.trim().split(/\s+/);
    if (parts.length !== 5) {
      return new Response(JSON.stringify({ error: "Invalid cron expression — must have 5 fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the DB function to update pg_cron
    const { error } = await sb.rpc("update_agent_cron_schedule", {
      new_schedule: schedule,
    });

    if (error) throw error;

    // Save to site_settings for UI
    await sb.from("site_settings").upsert(
      { key: "agent-cron-schedule", value: { schedule, updated_at: new Date().toISOString() } },
      { onConflict: "key" }
    );

    return new Response(JSON.stringify({ success: true, schedule }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[update-cron-schedule]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
