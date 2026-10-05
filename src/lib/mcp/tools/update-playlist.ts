import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "update_playlist",
  title: "Update playlist",
  description: "Rename a playlist or change its description or cover.",
  inputSchema: {
    id: z.string().uuid(),
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    cover_image_url: z.string().url().nullable().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, ...updates }, ctx) => {
    await requireAuth(ctx);
    const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) return { content: [{ type: "text", text: "No fields to update" }], isError: true };
    const { error } = await supabaseAdmin().from("playlists").update(clean).eq("id", id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Playlist ${id} updated` }] };
  },
});
