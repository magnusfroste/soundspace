import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MatchRequest {
  atmospheres: string[];
  preferredGenres?: string[];
}

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
}

interface MatchedPlaylist extends Playlist {
  reasoning: string;
}

// Energy level mapping for playlists
const ENERGY_MAP: Record<string, string[]> = {
  calm: ["relaxed", "mellow", "peaceful", "zen", "quiet", "soothing"],
  chill: ["chill", "lofi", "lo-fi", "laid-back", "easy", "smooth"],
  focus: ["focused", "productive", "background", "ambient", "work", "study"],
  upbeat: ["upbeat", "positive", "happy", "cheerful", "bright", "pop"],
  groove: ["groove", "groovy", "rhythmic", "soul", "funk", "smooth"],
  energy: ["energetic", "lively", "dynamic", "vibrant", "fun", "high-energy"],
};

// Match atmosphere to energy level
function getEnergyForAtmosphere(atmosphere: string): string | null {
  const lower = atmosphere.toLowerCase();
  
  // Direct matches to energy levels (exact playlist names)
  if (lower === "calm") return "calm";
  if (lower === "chill") return "chill";
  if (lower === "focus") return "focus";
  if (lower === "upbeat") return "upbeat";
  if (lower === "groove") return "groove";
  if (lower === "energy") return "energy";
  
  // Keyword matches
  if (lower.includes("calm") || lower.includes("relaxed") || lower.includes("peaceful") || lower.includes("zen")) {
    return "calm";
  }
  if (lower.includes("chill") || lower.includes("lofi") || lower.includes("laid-back")) {
    return "chill";
  }
  if (lower.includes("focused") || lower.includes("professional") || lower.includes("productive") || lower.includes("work") || lower.includes("minimal")) {
    return "focus";
  }
  if (lower.includes("upbeat") || lower.includes("positive") || lower.includes("happy") || lower.includes("cheerful")) {
    return "upbeat";
  }
  if (lower.includes("groove") || lower.includes("rhythmic") || lower.includes("soul") || lower.includes("funk")) {
    return "groove";
  }
  if (lower.includes("energetic") || lower.includes("lively") || lower.includes("dynamic") || lower.includes("vibrant")) {
    return "energy";
  }
  
  // Style mappings
  if (lower.includes("cozy") || lower.includes("intimate") || lower.includes("mellow")) {
    return "chill";
  }
  if (lower.includes("modern") || lower.includes("sophisticated") || lower.includes("elegant")) {
    return "focus";
  }
  if (lower.includes("casual") || lower.includes("social")) {
    return "upbeat";
  }
  if (lower.includes("fun") || lower.includes("party")) {
    return "energy";
  }
  
  return null;
}

// Score a playlist based on energy match
function scorePlaylist(playlist: Playlist, targetEnergies: string[]): number {
  const title = playlist.title.toLowerCase();
  let score = 0;
  
  for (const energy of targetEnergies) {
    // Direct title match (highest score)
    if (title === energy) {
      score += 100;
    }
    // Title contains energy word
    else if (title.includes(energy)) {
      score += 50;
    }
    // Check description for keywords
    else if (playlist.description) {
      const description = playlist.description.toLowerCase();
      const energyKeywords = ENERGY_MAP[energy] || [];
      if (energyKeywords.some(kw => description.includes(kw))) {
        score += 25;
      }
    }
  }
  
  return score;
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
    const body: MatchRequest = await req.json();
    const { atmospheres, preferredGenres } = body;

    console.log("Matching playlists for atmospheres:", atmospheres);

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Fetch all playlists
    const { data: playlists, error: playlistError } = await supabase
      .from("playlists")
      .select("id, title, description, cover_image_url");

    if (playlistError) {
      console.error("Error fetching playlists:", playlistError);
      throw new Error("Failed to fetch playlists");
    }

    if (!playlists || playlists.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map atmospheres to energy levels
    const targetEnergies = new Set<string>();
    for (const atmosphere of atmospheres) {
      const energy = getEnergyForAtmosphere(atmosphere);
      if (energy) {
        targetEnergies.add(energy);
      }
    }

    // If no clear energy mapping, default to focus (safe background music)
    if (targetEnergies.size === 0) {
      targetEnergies.add("focus");
    }

    console.log("Target energies:", Array.from(targetEnergies));

    // Score all playlists
    const scoredPlaylists = playlists.map(playlist => ({
      playlist,
      score: scorePlaylist(playlist, Array.from(targetEnergies)),
    }));

    // Sort by score and take top matches
    scoredPlaylists.sort((a, b) => b.score - a.score);
    
    // Take playlists with score > 0, or fallback to first 2
    let topPlaylists = scoredPlaylists.filter(p => p.score > 0).slice(0, 3);
    
    if (topPlaylists.length === 0) {
      topPlaylists = scoredPlaylists.slice(0, 2);
    }

    // Build matched playlists with reasoning
    const matchedPlaylists: MatchedPlaylist[] = topPlaylists.map(({ playlist }) => {
      const title = playlist.title.toLowerCase();
      let reasoning = "";
      
      if (title === "calm") {
        reasoning = "Perfect for creating a relaxed, peaceful atmosphere.";
      } else if (title === "focus") {
        reasoning = "Ideal background music that won't distract your customers.";
      } else if (title === "energy") {
        reasoning = "Great for adding energy and vibrancy to your space.";
      } else {
        reasoning = "Matches your preferred atmosphere and style.";
      }
      
      return {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description,
        cover_image_url: playlist.cover_image_url,
        reasoning,
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
