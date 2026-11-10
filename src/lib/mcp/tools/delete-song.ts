import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAdmin } from "../supabase";

export default defineTool({
  name: "delete_song",
  title: "Delete song (trash)",
  description: "Soft-delete a song. It stays in trash for 30 days and can be restored.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    await requireAdmin(ctx);
    const { error } = await supabaseForUser(ctx).from("songs").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Song ${id} moved to trash` }] };
  },
});
