import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timer, Play, Clock, CheckCircle2, XCircle, Loader2, History, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const CRON_PRESETS = [
  { label: "Every day at 03:00 UTC", value: "0 3 * * *" },
  { label: "Every day at 06:00 UTC", value: "0 6 * * *" },
  { label: "Twice a day (03:00 & 15:00)", value: "0 3,15 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Weekdays at 03:00 UTC", value: "0 3 * * 1-5" },
  { label: "Custom", value: "custom" },
];

function describeCron(expr: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === expr);
  if (preset) return preset.label;

  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;

  const [min, hour, dom, mon, dow] = parts;
  const segments: string[] = [];

  if (hour.includes(",")) segments.push(`at ${hour.split(",").map((h) => `${h.padStart(2, "0")}:${min.padStart(2, "0")}`).join(" & ")} UTC`);
  else if (hour.startsWith("*/")) segments.push(`every ${hour.slice(2)} hours`);
  else if (hour === "*") segments.push(min === "0" ? "every hour" : `every hour at :${min.padStart(2, "0")}`);
  else segments.push(`at ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`);

  if (dow === "1-5") segments.push("on weekdays");
  else if (dow !== "*") segments.push(`on days ${dow}`);

  if (dom !== "*") segments.push(`on day ${dom}`);
  if (mon !== "*") segments.push(`in month ${mon}`);

  return segments.join(" ");
}

export default function AdminAutomation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [cronExpr, setCronExpr] = useState("0 3 * * *");
  const [selectedPreset, setSelectedPreset] = useState("0 3 * * *");
  const [isCustom, setIsCustom] = useState(false);

  // Load saved schedule
  const { data: savedSchedule } = useQuery({
    queryKey: ["cron-schedule"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "agent-cron-schedule")
        .maybeSingle();
      if (data?.value) {
        const val = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        return (val as any).schedule as string;
      }
      return "0 3 * * *";
    },
  });

  useEffect(() => {
    if (savedSchedule) {
      setCronExpr(savedSchedule);
      const preset = CRON_PRESETS.find((p) => p.value === savedSchedule);
      if (preset) {
        setSelectedPreset(savedSchedule);
        setIsCustom(false);
      } else {
        setSelectedPreset("custom");
        setIsCustom(true);
      }
    }
  }, [savedSchedule]);

  const updateSchedule = useMutation({
    mutationFn: async (schedule: string) => {
      const res = await supabase.functions.invoke("update-cron-schedule", {
        body: { schedule },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      toast.success("Cron schedule updated");
      queryClient.invalidateQueries({ queryKey: ["cron-schedule"] });
    },
    onError: (e: any) => toast.error("Failed: " + (e.message || "Unknown error")),
  });

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

  const { data: logs = [] } = useQuery({
    queryKey: ["cron-logs"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_cron_logs")
        .select("id, objective_title, status, error, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const triggerCron = async () => {
    setRunning(true);
    try {
      const res = await supabase.functions.invoke("agent-cron");
      if (res.error) throw res.error;
      toast.success(`Cron completed — processed ${res.data?.processed ?? res.data?.fired ?? 0} task(s)`);
      queryClient.invalidateQueries({ queryKey: ["cron-logs"] });
    } catch (e: any) {
      toast.error("Cron failed: " + (e.message || "Unknown error"));
    } finally {
      setRunning(false);
    }
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    if (value === "custom") {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      setCronExpr(value);
    }
  };

  const hasChanges = cronExpr !== (savedSchedule || "0 3 * * *");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="h-6 w-6" />
            Automation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled and on-demand agent runs.
          </p>
        </div>
        <Button onClick={triggerCron} disabled={running} size="sm" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Now
        </Button>
      </div>

      {/* Run Now explanation */}
      <Card className="p-4 border-dashed">
        <p className="text-sm text-muted-foreground">
          <strong>Run Now</strong> immediately triggers the full autonomous cycle — trend analysis, content generation, playlist curation, and landing page updates — without waiting for the scheduled time.
        </p>
      </Card>

      {/* Editable Cron Schedule */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Cron Schedule
        </h2>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Preset</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Cron Expression</Label>
              <Input
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
                placeholder="0 3 * * *"
                className="font-mono max-w-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: minute hour day-of-month month day-of-week
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cronExpr}</code>
              <span className="text-muted-foreground">— {describeCron(cronExpr)}</span>
            </div>
            {hasChanges && (
              <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                disabled={updateSchedule.isPending}
                onClick={() => updateSchedule.mutate(cronExpr)}
              >
                {updateSchedule.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-3">Auto-Execute Objectives ({objectives.length})</h2>
        {objectives.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Timer className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No objectives have auto-execute enabled.</p>
            <p className="text-xs mt-1">Enable it on any objective to include it in scheduled runs.</p>
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

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Activity Log
        </h2>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No cron runs recorded yet.</p>
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objective</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-sm truncate max-w-[200px]">
                      {log.objective_title || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === "completed" ? "default" : "destructive"} className="text-xs">
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.error || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
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
