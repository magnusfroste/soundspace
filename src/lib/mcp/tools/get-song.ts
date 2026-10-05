import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAdmin, requireAuth } from "../supabase";

export default defineTool({
  name: "get_song",
  title: "Get song",
  description: "Get full details for one song, including prompt, lyrics and quality metadata.",
  inputSchema: { id: z.string().uuid().describe("Song ID.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    await requireAuth(ctx);
    const { data, error } = await supabaseAdmin().from("songs").select("*").eq("id", id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Song not found" }], isError: true };
    const s = data as unknown as Record<string, unknown>;
    return { content: [{ type: "text", text: JSON.stringify(s) }], structuredContent: { song: s } };
  },
});
