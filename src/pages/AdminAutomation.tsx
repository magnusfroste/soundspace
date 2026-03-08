import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timer, Play, Clock, CheckCircle2, XCircle, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function AdminAutomation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: objectives = [] } = useQuery({
    queryKey: ["auto-objectives", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_objectives")
        .select("id, title, status, auto_execute, updated_at, progress")
        .eq("user_id", user!.id)
        .eq("auto_execute", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const triggerCron = async () => {
    setRunning(true);
    try {
      const res = await supabase.functions.invoke("agent-cron");
      if (res.error) throw res.error;
      toast.success(`Cron completed — processed ${res.data?.processed ?? 0} objective(s)`);
    } catch (e: any) {
      toast.error("Cron failed: " + (e.message || "Unknown error"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="h-6 w-6" />
            Automation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated agent runs and scheduled tasks. The cron executes nightly at 03:00 UTC.
          </p>
        </div>
        <Button onClick={triggerCron} disabled={running} size="sm" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Now
        </Button>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Cron Schedule
        </h2>
        <p className="text-sm text-muted-foreground">
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">0 3 * * *</code> — Every day at 03:00 UTC
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Processes all objectives with <Badge variant="outline" className="text-xs">auto-execute</Badge> enabled. 
          The agent receives full tool access and works through each objective sequentially.
        </p>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-3">Auto-Execute Objectives ({objectives.length})</h2>
        {objectives.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Timer className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No objectives have auto-execute enabled.</p>
            <p className="text-xs mt-1">Enable it on any objective to include it in nightly runs.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {objectives.map((obj) => (
              <Card key={obj.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {obj.status === "active" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{obj.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Last updated {new Date(obj.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={obj.status === "active" ? "default" : "secondary"} className="shrink-0">
                  {obj.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
