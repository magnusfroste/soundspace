import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Proxy/rewrite handler for /a2a
 * Forwards all requests to a2a-negotiate function
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Parse incoming request
    const method = req.method;
    const headers = new Headers(req.headers);
    let body: BodyInit | null = null;

    if (method !== "GET" && method !== "HEAD") {
      body = await req.text();
    }

    // Forward to a2a-negotiate function
    const negotiateUrl = `${supabaseUrl}/functions/v1/a2a-negotiate`;
    const negotiateRes = await fetch(negotiateUrl, {
      method,
      headers,
      body,
    });

    // Return the response with CORS headers
    const responseBody = await negotiateRes.text();
    return new Response(responseBody, {
      status: negotiateRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": negotiateRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[a2a] Proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Proxy error", detail: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
