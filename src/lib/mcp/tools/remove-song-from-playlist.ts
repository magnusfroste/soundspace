import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "remove_song_from_playlist",
  title: "Remove song from playlist",
  description: "Remove a song from a playlist. The song stays in the library.",
  inputSchema: {
    playlist_id: z.string().uuid(),
    song_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ playlist_id, song_id }, ctx) => {
    await requireAuth(ctx);
    const { error } = await supabaseAdmin().from("playlist_songs").delete().eq("playlist_id", playlist_id).eq("song_id", song_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: "Song removed from playlist" }] };
  },
});
