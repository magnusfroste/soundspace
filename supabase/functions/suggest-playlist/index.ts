import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Playlist {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, genre, mood, playlists } = await req.json();

    if (!playlists || playlists.length === 0) {
      return new Response(
        JSON.stringify({ suggestedPlaylistId: null, reason: "No playlists available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ suggestedPlaylistId: null, reason: "AI not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context for AI
    const playlistDescriptions = (playlists as Playlist[])
      .map((p, i) => `${i + 1}. "${p.title}" (Category: ${p.category || "none"}, Description: ${p.description || "none"})`)
      .join("\n");

    const musicContext = [
      `Music description: ${prompt}`,
      genre ? `Genre: ${genre}` : null,
      mood ? `Mood: ${mood}` : null,
    ].filter(Boolean).join("\n");

    console.log("Analyzing music for playlist suggestion:", { prompt, genre, mood });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a music curator AI. Given a description of generated music, suggest the best matching playlist from the available options. Respond with ONLY a JSON object containing "playlistIndex" (1-based index) and "reason" (brief explanation in Swedish). If no playlist matches well, set playlistIndex to 0.`,
          },
          {
            role: "user",
            content: `${musicContext}\n\nAvailable playlists:\n${playlistDescriptions}\n\nWhich playlist best matches this music?`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ suggestedPlaylistId: null, reason: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ suggestedPlaylistId: null, reason: "AI analysis failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content);

    // Parse the AI response
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const playlistIndex = parsed.playlistIndex;
      const reason = parsed.reason || "AI-baserat förslag";

      if (playlistIndex > 0 && playlistIndex <= playlists.length) {
        const suggestedPlaylist = playlists[playlistIndex - 1];
        return new Response(
          JSON.stringify({ 
            suggestedPlaylistId: suggestedPlaylist.id, 
            suggestedPlaylistTitle: suggestedPlaylist.title,
            reason 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
    }

    return new Response(
      JSON.stringify({ suggestedPlaylistId: null, reason: "Ingen passande playlist hittades" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Suggest playlist error:", error);
    return new Response(
      JSON.stringify({ suggestedPlaylistId: null, reason: "Error analyzing music" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
