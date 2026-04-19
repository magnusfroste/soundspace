import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Network, Key, Activity, Shield, Copy, Eye, EyeOff,
  RefreshCw, Wrench, Globe,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const MCP_ENDPOINT = `${SUPABASE_URL}/functions/v1/mcp`;

function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

/* ─── Tools catalogue (mirrors the edge function) ─── */
const TOOLS: Array<{ category: string; tools: Array<{ name: string; description: string }> }> = [
  {
    category: "📚 Songs",
    tools: [
      { name: "list_songs", description: "Search & list songs with filters (genre, mood, lyrics, prompt)." },
      { name: "get_song", description: "Full metadata + signed file URL." },
      { name: "update_song", description: "Update title, artist, genre, mood, prompt, lyrics, BPM, key." },
      { name: "delete_song", description: "Soft-delete (move to trash, restorable 30 days)." },
      { name: "restore_song", description: "Restore a song from trash." },
      { name: "permanently_delete_song", description: "Hard delete. Requires confirm:true." },
      { name: "upload_song", description: "Upload via source_url or base64 audio_data." },
      { name: "download_song", description: "Get signed download URL (1h)." },
      { name: "extract_lyrics", description: "Run STT on a song (ElevenLabs / Whisper)." },
      { name: "generate_cover", description: "Generate AI cover art." },
    ],
  },
  {
    category: "🎵 Playlists",
    tools: [
      { name: "list_playlists", description: "All playlists with song counts." },
      { name: "get_playlist", description: "Playlist with ordered songs." },
      { name: "create_playlist", description: "Create new playlist." },
      { name: "update_playlist", description: "Update title, description, cover." },
      { name: "delete_playlist", description: "Delete playlist (songs kept)." },
      { name: "add_song_to_playlist", description: "Append song to playlist." },
      { name: "remove_song_from_playlist", description: "Remove song from playlist." },
      { name: "reorder_playlist_songs", description: "Reorder by full song_ids array." },
    ],
  },
  {
    category: "🤖 AI Generation",
    tools: [
      { name: "generate_music", description: "Generate AI track via configured provider." },
      { name: "list_ai_generations", description: "Recent generation history." },
      { name: "save_generation_to_library", description: "Convert generation into a library song." },
    ],
  },
  {
    category: "🗑️ Trash",
    tools: [
      { name: "list_trash", description: "List soft-deleted songs." },
      { name: "empty_trash", description: "Permanently delete all trashed songs." },
    ],
  },
  {
    category: "📊 Meta",
    tools: [
      { name: "get_stats", description: "Counts: songs, playlists, trash, generations." },
      { name: "list_genres", description: "Unique genres in use." },
      { name: "list_moods", description: "Unique moods in use." },
    ],
  },
];

/* ─── Endpoint card ─── */
function EndpointCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          MCP Endpoint
        </CardTitle>
        <CardDescription>Streamable HTTP — point any MCP-compatible client here</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-md font-mono truncate">
            {MCP_ENDPOINT}
          </code>
          <Button variant="ghost" size="icon" onClick={() => copyText(MCP_ENDPOINT, "Endpoint")}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Send <code>POST</code> with header <code>Accept: application/json, text/event-stream</code> and{" "}
          <code>Authorization: Bearer &lt;token&gt;</code>.
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Token card ─── */
function TokenCard() {
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);

  const { data: token } = useQuery({
    queryKey: ["mcp-token"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "mcp_api_token")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as { token?: string | null })?.token ?? null;
    },
  });

  const rotate = useMutation({
    mutationFn: async () => {
      const newToken = `mcp_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", "mcp_api_token")
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value: { token: newToken } })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert({ key: "mcp_api_token", value: { token: newToken } });
        if (error) throw error;
      }
      return newToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-token"] });
      toast.success("Token rotated");
    },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });

  const masked = token ? `${token.slice(0, 8)}${"•".repeat(24)}${token.slice(-4)}` : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          API Token
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <Shield className="h-3 w-3" /> Bearer token used by external MCP clients
        </CardDescription>
      </CardHeader>
      <CardContent>
        {token ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-md font-mono truncate">
              {show ? token : masked}
            </code>
            <Button variant="ghost" size="icon" onClick={() => setShow(!show)}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => copyText(token, "Token")}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
              <RefreshCw className="h-3 w-3 mr-1" /> Rotate
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
            <Key className="h-3 w-3 mr-1" /> Generate Token
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Tools tab ─── */
function ToolsTab() {
  const total = TOOLS.reduce((acc, c) => acc + c.tools.length, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          Tools <Badge variant="secondary" className="ml-1">{total}</Badge>
        </CardTitle>
        <CardDescription>Available for any authenticated MCP client</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {TOOLS.map((cat) => (
          <div key={cat.category}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {cat.category}
            </h4>
            <div className="space-y-1">
              {cat.tools.map((t) => (
                <div key={t.name} className="flex items-start gap-3 text-sm py-1.5 border-b border-border/40 last:border-0">
                  <code className="text-xs font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded shrink-0 min-w-[180px]">
                    {t.name}
                  </code>
                  <span className="text-muted-foreground text-xs leading-relaxed">{t.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ─── Client config tab ─── */
function ClientConfigTab() {
  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        soundspace: {
          url: MCP_ENDPOINT,
          headers: { Authorization: "Bearer YOUR_TOKEN_HERE" },
        },
      },
    },
    null,
    2,
  );

  const curlExample = `curl -X POST ${MCP_ENDPOINT} \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Claude Desktop / Cursor</CardTitle>
          <CardDescription>Add to your <code>mcp.json</code> config</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto font-mono">{claudeConfig}</pre>
            <Button variant="ghost" size="icon" className="absolute top-2 right-2"
              onClick={() => copyText(claudeConfig, "Config")}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Test with curl</CardTitle>
          <CardDescription>List all available tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto font-mono">{curlExample}</pre>
            <Button variant="ghost" size="icon" className="absolute top-2 right-2"
              onClick={() => copyText(curlExample, "Command")}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Logs tab ─── */
function LogsTab() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["mcp-request-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("a2a_request_logs" as any)
        .select("*")
        .eq("type", "mcp")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15_000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Request Log
        </CardTitle>
        <CardDescription>Recent MCP tool invocations</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No MCP requests yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell><code className="text-xs">{log.skill_id || "—"}</code></TableCell>
                  <TableCell>
                    <Badge variant={log.status === "completed" ? "default" : "destructive"} className="text-xs">
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{log.ip_address || "—"}</TableCell>
                  <TableCell className="text-xs text-destructive truncate max-w-[200px]">{log.error || ""}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Page ─── */
export default function AdminMCP() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          MCP Server
        </h1>
        <p className="text-muted-foreground mt-1">
          Model Context Protocol — exposes the entire platform as tools for external AI agents
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EndpointCard />
        <TokenCard />
      </div>

      <Tabs defaultValue="tools">
        <TabsList>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="config">Client Config</TabsTrigger>
          <TabsTrigger value="logs">Request Log</TabsTrigger>
        </TabsList>
        <TabsContent value="tools" className="mt-4"><ToolsTab /></TabsContent>
        <TabsContent value="config" className="mt-4"><ClientConfigTab /></TabsContent>
        <TabsContent value="logs" className="mt-4"><LogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
