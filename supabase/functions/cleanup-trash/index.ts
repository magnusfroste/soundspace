import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find songs deleted more than 30 days ago
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredSongs, error: fetchError } = await supabase
      .from("songs")
      .select("id, file_url, cover_url")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (fetchError) throw fetchError;

    if (!expiredSongs || expiredSongs.length === 0) {
      return new Response(JSON.stringify({ deleted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deleted = 0;

    for (const song of expiredSongs) {
      // Remove from playlist_songs
      await supabase.from("playlist_songs").delete().eq("song_id", song.id);
      await supabase.from("user_playlist_songs").delete().eq("song_id", song.id);

      // Try to remove file from storage
      if (song.file_url) {
        const fileName = song.file_url.split("/songs/")[1];
        if (fileName) {
          await supabase.storage.from("songs").remove([fileName]);
        }
      }

      // Delete song record
      const { error } = await supabase.from("songs").delete().eq("id", song.id);
      if (!error) deleted++;
    }

    return new Response(JSON.stringify({ deleted, total: expiredSongs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
