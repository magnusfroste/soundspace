import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "restore_song",
  title: "Restore song",
  description: "Restore a soft-deleted song from trash back into the library.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    await requireAuth(ctx);
    const { error } = await supabaseAdmin().from("songs").update({ deleted_at: null }).eq("id", id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Song ${id} restored` }] };
  },
});
