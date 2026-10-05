import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "create_playlist",
  title: "Create playlist",
  description: "Create a new playlist.",
  inputSchema: {
    title: z.string().min(1),
    description: z.string().optional(),
    cover_image_url: z.string().url().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ title, description, cover_image_url }, ctx) => {
    await requireAuth(ctx);
    const { data, error } = await supabaseAdmin().from("playlists")
      .insert({ title, description: description ?? null, cover_image_url: cover_image_url ?? null })
      .select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Created playlist "${title}"` }], structuredContent: { playlist: data as unknown as Record<string, unknown> } };
  },
});
