import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Plus, Trash2, Pause, Play, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Objective {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: Record<string, any>;
  auto_execute: boolean;
  created_at: string;
}

export default function AdminObjectives() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [autoExecute, setAutoExecute] = useState(false);

  const { data: objectives = [] } = useQuery({
    queryKey: ["agent-objectives", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_objectives")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Objective[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agent_objectives").insert({
        user_id: user!.id,
        title,
        description: description || null,
        auto_execute: autoExecute,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-objectives"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setAutoExecute(false);
      toast.success("Objective created");
    },
    onError: () => toast.error("Failed to create objective"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("agent_objectives").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-objectives"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_objectives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-objectives"] });
      toast.success("Objective deleted");
    },
  });

  const toggleAutoExecute = useMutation({
    mutationFn: async ({ id, auto_execute }: { id: string; auto_execute: boolean }) => {
      const { error } = await supabase.from("agent_objectives").update({ auto_execute }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-objectives"] }),
  });

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Objectives
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set persistent goals for SoundAgent to work toward across sessions.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Objective
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Objective</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build a 200-track lounge library" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed goal — genres, moods, track count, quality targets..." rows={4} />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="auto-exec" checked={autoExecute} onCheckedChange={setAutoExecute} />
                <Label htmlFor="auto-exec">Auto-execute nightly</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, SoundAgent will autonomously work toward this objective during scheduled maintenance.
              </p>
              <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending} className="w-full">
                Create Objective
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {objectives.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No objectives yet. Create one to give SoundAgent a persistent goal.</p>
        </div>
      )}

      <div className="grid gap-4">
        {objectives.map((obj) => (
          <Card key={obj.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{obj.title}</h3>
                  <Badge variant="outline" className={statusColors[obj.status] || ""}>
                    {obj.status}
                  </Badge>
                  {obj.auto_execute && (
                    <Badge variant="outline" className="text-xs">auto</Badge>
                  )}
                </div>
                {obj.description && (
                  <p className="text-sm text-muted-foreground mt-1">{obj.description}</p>
                )}
                {obj.progress && Object.keys(obj.progress).length > 0 && (
                  <div className="mt-3 text-xs font-mono bg-muted/50 rounded-lg p-3">
                    {Object.entries(obj.progress).filter(([k]) => k !== "last_updated").map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key.replace(/_/g, " ")}:</span>
                        <span>{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                      </div>
                    ))}
                    {obj.progress.last_updated && (
                      <div className="text-muted-foreground mt-1 pt-1 border-t border-border">
                        Last updated: {new Date(obj.progress.last_updated as string).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="flex items-center gap-2 mr-3">
                  <Switch
                    checked={obj.auto_execute}
                    onCheckedChange={(v) => toggleAutoExecute.mutate({ id: obj.id, auto_execute: v })}
                    aria-label="Auto-execute"
                  />
                  <span className="text-xs text-muted-foreground">Auto</span>
                </div>
                {obj.status === "active" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateStatus.mutate({ id: obj.id, status: "paused" })} title="Pause">
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                {obj.status === "paused" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateStatus.mutate({ id: obj.id, status: "active" })} title="Resume">
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {(obj.status === "active" || obj.status === "paused") && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateStatus.mutate({ id: obj.id, status: "completed" })} title="Complete">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(obj.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
