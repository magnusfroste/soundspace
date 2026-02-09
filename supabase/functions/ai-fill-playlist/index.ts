import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, maxSongs = 10, excludeIds = [] } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch available songs
    const { data: songs, error: songsError } = await supabase
      .from("songs")
      .select("id, title, artist, genre, mood, duration, cover_url")
      .order("title");

    if (songsError) {
      console.error("Failed to fetch songs:", songsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch songs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out excluded songs
    const excludeSet = new Set(excludeIds);
    const availableSongs = songs?.filter((s) => !excludeSet.has(s.id)) || [];

    if (availableSongs.length === 0) {
      return new Response(
        JSON.stringify({ songs: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare song catalog for AI
    const songCatalog = availableSongs.map((s, i) => ({
      index: i,
      id: s.id,
      title: s.title,
      artist: s.artist,
      genre: s.genre || "unknown",
      mood: s.mood || "unknown",
    }));

    const systemPrompt = `You are a music curator AI. Given a user's description of the vibe they want, select the most appropriate songs from the catalog provided.

Return ONLY a JSON array of song indices that match the vibe. No explanations, just the JSON array.

Example output: [0, 3, 7, 12, 15]

Guidelines:
- Match songs based on genre, mood, title, and artist style
- Consider the overall atmosphere the user is describing
- Return up to ${maxSongs} songs
- Return an empty array [] if no songs match`;

    const userMessage = `Vibe description: "${prompt}"

Song catalog:
${JSON.stringify(songCatalog, null, 2)}

Return the indices of songs that match this vibe (max ${maxSongs} songs):`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    // Parse AI response to get indices
    let selectedIndices: number[] = [];
    try {
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\d,\s]*\]/);
      if (jsonMatch) {
        selectedIndices = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, content);
      selectedIndices = [];
    }

    // Map indices to actual songs
    const selectedSongs = selectedIndices
      .filter((i) => i >= 0 && i < availableSongs.length)
      .slice(0, maxSongs)
      .map((i) => availableSongs[i]);

    console.log(`AI selected ${selectedSongs.length} songs for prompt: "${prompt}"`);

    return new Response(
      JSON.stringify({ songs: selectedSongs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-fill-playlist error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
