import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Network, Globe, Key, Activity, Shield, Copy, Eye, EyeOff,
  RefreshCw, CheckCircle2, Bot,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function copyToClipboard(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard`);
}

/* ─── Agent Card Section ─── */
function AgentCardSection() {
  const { data: agentCard, isLoading } = useQuery({
    queryKey: ["a2a-agent-card"],
    queryFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-card`);
      if (!res.ok) throw new Error("Failed to fetch agent card");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Agent Card
        </CardTitle>
        <CardDescription>Public discovery document at <code className="text-xs">/.well-known/agent.json</code></CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs space-y-1.5 overflow-x-auto">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : agentCard ? (
            <>
              <Row label="protocol" value={agentCard.protocol} />
              <Row label="agent" value={agentCard.agent} />
              <Row label="status">
                <Badge variant="outline" className="text-xs h-5">{agentCard.status}</Badge>
              </Row>
              <Row label="endpoint" value={agentCard.endpoint} copyable />
              <Row label="skills" value={agentCard.skills?.map((s: any) => s.id).join(", ")} />
              <Row label="accepts" value={agentCard.accepts?.join(", ")} />
            </>
          ) : (
            <p className="text-destructive">Failed to load agent card</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, copyable, children }: { label: string; value?: string; copyable?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      {children ?? (
        <>
          <span className="break-all">{value}</span>
          {copyable && value && (
            <button onClick={() => copyToClipboard(value, label)} className="shrink-0">
              <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ─── API Key Section ─── */
function ApiKeySection() {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [editing, setEditing] = useState(false);

  const { data: apiKeyData } = useQuery({
    queryKey: ["a2a-api-key"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "module:api_tokens")
        .maybeSingle();
      if (error) throw error;
      const val = data?.value as Record<string, string> | null;
      return val?.a2a_api_key || null;
    },
  });

  const saveKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id, value")
        .eq("key", "module:api_tokens")
        .maybeSingle();
      const merged = { ...(existing?.value as Record<string, unknown> || {}), a2a_api_key: key };
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value: merged }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({ key: "module:api_tokens", value: merged });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("API key saved");
      setEditing(false);
      setNewKey("");
      queryClient.invalidateQueries({ queryKey: ["a2a-api-key"] });
    },
    onError: (e: any) => toast.error("Failed to save: " + e.message),
  });

  const generateKey = () => {
    const key = `a2a_${crypto.randomUUID().replace(/-/g, "")}`;
    setNewKey(key);
    setEditing(true);
  };

  const maskedKey = apiKeyData ? `${apiKeyData.slice(0, 8)}${"•".repeat(24)}${apiKeyData.slice(-4)}` : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          API Key
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          External agents authenticate with this Bearer token
        </CardDescription>
      </CardHeader>
      <CardContent>
        {apiKeyData && !editing ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-md font-mono truncate">
              {showKey ? apiKeyData : maskedKey}
            </code>
            <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(apiKeyData, "API key")}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={generateKey}>
              <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
            </Button>
          </div>
        ) : editing ? (
          <div className="flex items-center gap-2">
            <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} className="font-mono text-xs" />
            <Button size="sm" onClick={() => saveKeyMutation.mutate(newKey)} disabled={!newKey || saveKeyMutation.isPending}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setNewKey(""); }}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={generateKey} className="w-full">
            <Key className="h-3 w-3 mr-1" /> Generate Key
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Connected Agents ─── */
function ConnectedAgentsSection() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Connected Agents
        </CardTitle>
        <CardDescription>External A2A-compatible agents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No A2A agents connected yet.</p>
          <p className="text-xs mt-1">Share your agent card endpoint to allow external agents to discover and connect.</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Request Log ─── */
function RequestLogSection() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["a2a-request-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("a2a_request_logs" as any)
        .select("id, type, skill_id, ip_address, status, error, result_summary, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 30_000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Request Log
        </CardTitle>
        <CardDescription>Recent inbound A2A requests</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No A2A requests received yet.</p>
            <p className="text-xs mt-1">Share the endpoint with external agents to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{log.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.skill_id || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "completed" ? "default" : "destructive"} className="text-xs">{log.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{log.ip_address || "—"}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function AdminA2A() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          A2A Protocol
        </h1>
        <p className="text-muted-foreground mt-1">
          Agent-to-Agent integration — manage external agent access to your library
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentCardSection />
        <ApiKeySection />
      </div>

      <ConnectedAgentsSection />
      <RequestLogSection />
    </div>
  );
}
