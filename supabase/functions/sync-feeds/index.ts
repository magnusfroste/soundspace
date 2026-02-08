import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SourceFeed {
  id: string;
  name: string;
  url: string;
  feed_type: string;
}

interface InternetArchiveDoc {
  identifier: string;
  title: string;
  creator?: string;
  description?: string;
}

interface InternetArchiveResponse {
  response: {
    docs: InternetArchiveDoc[];
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active feeds
    const { data: feeds, error: feedsError } = await supabase
      .from("source_feeds")
      .select("*")
      .eq("is_active", true);

    if (feedsError) {
      console.error("Error fetching feeds:", feedsError);
      throw new Error("Failed to fetch feeds");
    }

    if (!feeds || feeds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No active feeds to sync",
        imported: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalImported = 0;
    const errors: string[] = [];

    for (const feed of feeds as SourceFeed[]) {
      try {
        console.log(`Syncing feed: ${feed.name} (${feed.url})`);
        
        const response = await fetch(feed.url);
        if (!response.ok) {
          errors.push(`${feed.name}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        let songs: Array<{
          title: string;
          artist: string;
          external_url: string;
          genre?: string;
          metadata: Record<string, unknown>;
        }> = [];

        // Parse based on feed type
        if (feed.feed_type === "json") {
          // Handle Internet Archive format
          if (data.response?.docs) {
            const iaData = data as InternetArchiveResponse;
            songs = iaData.response.docs.map((doc) => ({
              title: doc.title || doc.identifier,
              artist: doc.creator || "Unknown Artist",
              external_url: `https://archive.org/download/${doc.identifier}/${doc.identifier}_vbr.mp3`,
              genre: "Creative Commons",
              metadata: {
                source: "internet_archive",
                identifier: doc.identifier,
                description: doc.description,
              },
            }));
          }
        }
        // TODO: Add RSS parsing support

        // Check for existing pending songs to avoid duplicates
        const externalUrls = songs.map(s => s.external_url);
        const { data: existing } = await supabase
          .from("pending_songs")
          .select("external_url")
          .in("external_url", externalUrls);

        const existingUrls = new Set(existing?.map(e => e.external_url) || []);

        // Also check songs table for already imported
        const { data: existingSongs } = await supabase
          .from("songs")
          .select("file_url")
          .in("file_url", externalUrls);

        const existingSongUrls = new Set(existingSongs?.map(s => s.file_url) || []);

        // Filter out duplicates
        const newSongs = songs.filter(
          s => !existingUrls.has(s.external_url) && !existingSongUrls.has(s.external_url)
        );

        if (newSongs.length > 0) {
          const { error: insertError } = await supabase
            .from("pending_songs")
            .insert(
              newSongs.map(song => ({
                source_feed_id: feed.id,
                title: song.title,
                artist: song.artist,
                external_url: song.external_url,
                genre: song.genre,
                metadata: song.metadata,
                status: "pending",
              }))
            );

          if (insertError) {
            console.error(`Error inserting songs for ${feed.name}:`, insertError);
            errors.push(`${feed.name}: Failed to insert songs`);
          } else {
            totalImported += newSongs.length;
          }
        }

        // Update last_synced_at
        await supabase
          .from("source_feeds")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", feed.id);

      } catch (feedError) {
        console.error(`Error processing feed ${feed.name}:`, feedError);
        errors.push(`${feed.name}: ${feedError instanceof Error ? feedError.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync complete. Imported ${totalImported} new songs.`,
        imported: totalImported,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
