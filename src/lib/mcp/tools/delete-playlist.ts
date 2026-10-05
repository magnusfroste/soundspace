import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "delete_playlist",
  title: "Delete playlist",
  description: "Delete a playlist and its song links. Songs themselves are kept in the library.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    await requireAuth(ctx);
    const db = supabaseAdmin();
    await db.from("playlist_songs").delete().eq("playlist_id", id);
    const { error } = await db.from("playlists").delete().eq("id", id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Playlist ${id} deleted` }] };
  },
});
