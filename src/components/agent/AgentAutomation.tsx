import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timer, Play, Clock, CheckCircle2, XCircle, Loader2, History } from "lucide-react";
import { toast } from "sonner";

export function AgentAutomation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: objectives = [] } = useQuery({
    queryKey: ["auto-objectives", user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.from("agent_objectives").select("id, title, status, auto_execute, updated_at, progress").eq("user_id", user!.id).eq("auto_execute", true).order("updated_at", { ascending: false }); if (error) throw error; return data; },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["cron-logs"], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.from("agent_cron_logs" as any).select("id, objective_title, status, error, created_at").order("created_at", { ascending: false }).limit(50); if (error) throw error; return data as any[]; },
  });

  const triggerCron = async () => {
    setRunning(true);
    try {
      const res = await supabase.functions.invoke("agent-cron");
      if (res.error) throw res.error;
      toast.success(`Cron completed — processed ${res.data?.processed ?? 0} objective(s)`);
      queryClient.invalidateQueries({ queryKey: ["cron-logs"] });
    } catch (e: any) { toast.error("Cron failed: " + (e.message || "Unknown error")); }
    finally { setRunning(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Automated agent runs. The cron executes nightly at 03:00 UTC.</p>
        <Button onClick={triggerCron} disabled={running} size="sm" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Now
        </Button>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Cron Schedule</h2>
        <p className="text-sm text-muted-foreground"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">0 3 * * *</code> — Every day at 03:00 UTC</p>
        <p className="text-sm text-muted-foreground mt-2">Processes all objectives with <Badge variant="outline" className="text-xs">auto-execute</Badge> enabled.</p>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-3">Auto-Execute Objectives ({objectives.length})</h2>
        {objectives.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Timer className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No objectives have auto-execute enabled.</p></div>
        ) : (
          <div className="grid gap-2">
            {objectives.map((obj) => (
              <Card key={obj.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {obj.status === "active" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="text-sm font-medium truncate">{obj.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">Last updated {new Date(obj.updated_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={obj.status === "active" ? "default" : "secondary"} className="shrink-0">{obj.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /> Activity Log</h2>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground"><History className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No cron runs recorded yet.</p></div>
        ) : (
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Objective</TableHead><TableHead>Status</TableHead><TableHead>Error</TableHead><TableHead className="text-right">Timestamp</TableHead></TableRow></TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-sm truncate max-w-[200px]">{log.objective_title || "—"}</TableCell>
                    <TableCell><Badge variant={log.status === "completed" ? "default" : "destructive"} className="text-xs">{log.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.error || "—"}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
