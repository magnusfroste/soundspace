import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Network,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  CheckCircle2,
  Globe,
  Key,
  Activity,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function A2ACard() {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [editing, setEditing] = useState(false);

  // Fetch agent card
  const { data: agentCard, isLoading: cardLoading } = useQuery({
    queryKey: ["a2a-agent-card"],
    queryFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-card`);
      if (!res.ok) throw new Error("Failed to fetch agent card");
      return res.json();
    },
    staleTime: 60_000,
  });

  // Fetch API key from site_settings
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

  // Fetch request logs
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["a2a-request-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("a2a_request_logs" as any)
        .select("id, type, skill_id, ip_address, status, error, result_summary, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 30_000,
  });

  // Save API key
  const saveKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      // Upsert site_settings module:api_tokens
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id, value")
        .eq("key", "module:api_tokens")
        .maybeSingle();

      const merged = { ...(existing?.value as Record<string, unknown> || {}), a2a_api_key: key };

      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value: merged })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert({ key: "module:api_tokens", value: merged });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("A2A API key saved");
      setEditing(false);
      setNewKey("");
      queryClient.invalidateQueries({ queryKey: ["a2a-api-key"] });
    },
    onError: (e: any) => toast.error("Failed to save key: " + e.message),
  });

  const generateKey = () => {
    const key = `a2a_${crypto.randomUUID().replace(/-/g, "")}`;
    setNewKey(key);
    setEditing(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const maskedKey = apiKeyData
    ? `${apiKeyData.slice(0, 8)}${"•".repeat(24)}${apiKeyData.slice(-4)}`
    : null;

  return (
    <div className="space-y-6 col-span-full">
      {/* Agent Card Preview */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Network className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  A2A Protocol
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600/30 bg-green-500/10"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Agent-to-Agent protocol — let external agents delegate music generation
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Agent Card Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Agent Card
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs space-y-1.5 overflow-x-auto">
              {cardLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : agentCard ? (
                <>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">protocol:</span>
                    <span>{agentCard.protocol}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">agent:</span>
                    <span>{agentCard.agent}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">status:</span>
                    <Badge variant="outline" className="text-xs h-5">{agentCard.status}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">endpoint:</span>
                    <span className="break-all">{agentCard.endpoint}</span>
                    <button onClick={() => copyToClipboard(agentCard.endpoint)} className="shrink-0">
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">skills:</span>
                    <span>{agentCard.skills?.map((s: any) => s.id).join(", ")}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">accepts:</span>
                    <span>{agentCard.accepts?.join(", ")}</span>
                  </div>
                </>
              ) : (
                <p className="text-destructive">Failed to load agent card</p>
              )}
            </div>
          </div>

          {/* API Key Management */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              API Key
            </h3>

            {apiKeyData && !editing ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-md font-mono">
                  {showKey ? apiKeyData : maskedKey}
                </code>
                <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(apiKeyData)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={generateKey}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                </Button>
              </div>
            ) : editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Enter or generate an API key"
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => saveKeyMutation.mutate(newKey)}
                  disabled={!newKey || saveKeyMutation.isPending}
                >
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setNewKey(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">No API key configured.</p>
                <Button variant="outline" size="sm" onClick={generateKey}>
                  <Key className="h-3 w-3 mr-1" /> Generate Key
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              External agents use this key as Bearer token to authenticate POST requests.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Request Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Inbound A2A Requests
          </CardTitle>
          <CardDescription>Recent requests from external agents</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No A2A requests received yet.</p>
              <p className="text-xs mt-1">Share the agent card endpoint with external agents to get started.</p>
            </div>
          ) : (
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
                      <Badge variant="outline" className="text-xs font-mono">
                        {log.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.skill_id || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.status === "completed" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {log.ip_address || "—"}
                    </TableCell>
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
    </div>
  );
}
