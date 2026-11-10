import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAdmin } from "../supabase";

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
    await requireAdmin(ctx);
    const { error } = await supabaseForUser(ctx).from("playlist_songs").delete().eq("playlist_id", playlist_id).eq("song_id", song_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: "Song removed from playlist" }] };
  },
});
