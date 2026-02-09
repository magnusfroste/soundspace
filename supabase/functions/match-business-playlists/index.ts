import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BusinessProfile {
  businessType: string;
  businessSubtype: string;
  atmospheres: string[];
  preferredGenres: string[];
}

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
}

interface PlaylistWithSongs extends Playlist {
  genres: string[];
  moods: string[];
}

interface MatchedPlaylist extends Playlist {
  reasoning: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body: BusinessProfile = await req.json();
    const { businessType, businessSubtype, atmospheres, preferredGenres } = body;

    console.log("Matching playlists for:", {
      businessType,
      businessSubtype,
      atmospheres,
      preferredGenres,
    });

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Fetch all playlists with their songs' genre/mood data
    const { data: playlists, error: playlistError } = await supabase
      .from("playlists")
      .select("id, title, description, category, cover_image_url");

    if (playlistError) {
      console.error("Error fetching playlists:", playlistError);
      throw new Error("Failed to fetch playlists");
    }

    if (!playlists || playlists.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch song metadata for each playlist
    const playlistsWithSongs: PlaylistWithSongs[] = await Promise.all(
      playlists.map(async (playlist) => {
        const { data: playlistSongs } = await supabase
          .from("playlist_songs")
          .select("song_id")
          .eq("playlist_id", playlist.id);

        if (!playlistSongs || playlistSongs.length === 0) {
          return { ...playlist, genres: [], moods: [] };
        }

        const songIds = playlistSongs.map((ps) => ps.song_id);
        const { data: songs } = await supabase
          .from("songs")
          .select("genre, mood")
          .in("id", songIds);

        const genres = songs
          ?.map((s) => s.genre)
          .filter((g): g is string => !!g) || [];
        const moods = songs
          ?.map((s) => s.mood)
          .filter((m): m is string => !!m) || [];

        return {
          ...playlist,
          genres: [...new Set(genres)],
          moods: [...new Set(moods)],
        };
      })
    );

    // Build the AI prompt
    const businessDescription = buildBusinessDescription(
      businessType,
      businessSubtype,
      atmospheres,
      preferredGenres
    );

    const playlistDescriptions = playlistsWithSongs.map((p, i) => {
      return `${i + 1}. "${p.title}" (Category: ${p.category || "N/A"})
   Description: ${p.description || "No description"}
   Genres in playlist: ${p.genres.join(", ") || "Unknown"}
   Moods in playlist: ${p.moods.join(", ") || "Unknown"}`;
    }).join("\n\n");

    const prompt = `You are a music curation expert for business environments.

A business owner has provided the following profile:
${businessDescription}

Here are the available playlists:

${playlistDescriptions}

Based on the business profile, select the TOP 2-3 playlists that would be the best fit. Consider:
- The business type and subtype (what music suits this environment?)
- The desired atmospheres (calm, energetic, luxurious, etc.)
- Genre preferences (if specified)
- How well each playlist's content matches these criteria

Respond ONLY with valid JSON in this exact format:
{
  "matches": [
    {
      "playlist_index": 1,
      "reasoning": "Short explanation why this fits (1-2 sentences, under 30 words)"
    }
  ]
}

Select 2-3 playlists maximum. Use playlist_index (1-based) to reference them.`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      throw new Error("Failed to get AI recommendations");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    console.log("AI response:", aiContent);

    // Parse AI response
    let aiMatches: { playlist_index: number; reasoning: string }[] = [];
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiMatches = parsed.matches || [];
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Fallback: return first 2 playlists with generic reasoning
      aiMatches = playlists.slice(0, 2).map((_, i) => ({
        playlist_index: i + 1,
        reasoning: "Recommended based on your business profile.",
      }));
    }

    // Build final matched playlists
    const matchedPlaylists: MatchedPlaylist[] = aiMatches
      .filter((m) => m.playlist_index > 0 && m.playlist_index <= playlists.length)
      .map((m) => {
        const playlist = playlists[m.playlist_index - 1];
        return {
          id: playlist.id,
          title: playlist.title,
          description: playlist.description,
          category: playlist.category,
          cover_image_url: playlist.cover_image_url,
          reasoning: m.reasoning,
        };
      });

    console.log("Matched playlists:", matchedPlaylists.length);

    return new Response(JSON.stringify({ matches: matchedPlaylists }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in match-business-playlists:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildBusinessDescription(
  businessType: string,
  businessSubtype: string,
  atmospheres: string[],
  preferredGenres: string[]
): string {
  const typeLabel = businessSubtype
    ? `${businessSubtype.replace(/_/g, " ")} (${businessType})`
    : businessType;

  let description = `Business Type: ${typeLabel}\n`;
  description += `Desired Atmosphere: ${atmospheres.join(", ")}\n`;

  if (preferredGenres.length > 0) {
    description += `Preferred Genres: ${preferredGenres.join(", ")}`;
  } else {
    description += `Preferred Genres: No specific preference (suggest based on business type and atmosphere)`;
  }

  return description;
}
