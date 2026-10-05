import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "add_song_to_playlist",
  title: "Add song to playlist",
  description: "Add a song to the end of a playlist.",
  inputSchema: {
    playlist_id: z.string().uuid(),
    song_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ playlist_id, song_id }, ctx) => {
    await requireAuth(ctx);
    const db = supabaseAdmin();
    const { data: existing } = await db.from("playlist_songs").select("id").eq("playlist_id", playlist_id).eq("song_id", song_id).maybeSingle();
    if (existing) return { content: [{ type: "text", text: "Song already in playlist" }], isError: true };
    const { data: maxPos } = await db.from("playlist_songs").select("position").eq("playlist_id", playlist_id).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from("playlist_songs").insert({ playlist_id, song_id, position: (maxPos?.position ?? -1) + 1 });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: "Song added to playlist" }] };
  },
});
