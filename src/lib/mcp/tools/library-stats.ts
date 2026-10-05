import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "library_stats",
  title: "Library stats",
  description: "Get totals: songs, trashed songs, playlists, and genre/mood distribution.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    await requireAuth(ctx);
    const db = supabaseAdmin();
    const [{ count: total }, { count: trashed }, { count: playlists }, { data: songs }] = await Promise.all([
      db.from("songs").select("*", { count: "exact", head: true }).is("deleted_at", null),
      db.from("songs").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
      db.from("playlists").select("*", { count: "exact", head: true }),
      db.from("songs").select("genre, mood").is("deleted_at", null),
    ]);
    const genres: Record<string, number> = {};
    const moods: Record<string, number> = {};
    songs?.forEach((s) => {
      if (s.genre) genres[s.genre] = (genres[s.genre] || 0) + 1;
      if (s.mood) moods[s.mood] = (moods[s.mood] || 0) + 1;
    });
    const stats = { songs: total ?? 0, trashed: trashed ?? 0, playlists: playlists ?? 0, genres, moods };
    return { content: [{ type: "text", text: JSON.stringify(stats) }], structuredContent: { stats } };
  },
});
