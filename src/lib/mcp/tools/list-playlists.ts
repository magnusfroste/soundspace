import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "list_playlists",
  title: "List playlists",
  description: "List all playlists with song counts.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    await requireAuth(ctx);
    const db = supabaseAdmin();
    const { data: playlists, error } = await db.from("playlists").select("*").order("title");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const { data: ps } = await db.from("playlist_songs").select("playlist_id");
    const counts: Record<string, number> = {};
    ps?.forEach((r) => { counts[r.playlist_id] = (counts[r.playlist_id] || 0) + 1; });
    const result = (playlists ?? []).map((p) => ({
      id: p.id, title: p.title, description: p.description,
      cover_image_url: p.cover_image_url, song_count: counts[p.id] ?? 0, created_at: p.created_at,
    }));
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: { playlists: result } };
  },
});
