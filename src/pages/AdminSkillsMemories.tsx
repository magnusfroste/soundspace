import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Lightbulb, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

interface Skill {
  id: string;
  name: string;
  category: string;
  content: string;
  metadata: Record<string, any>;
  use_count: number;
  created_at: string;
}

interface Memory {
  id: string;
  category: string;
  content: string;
  importance: number;
  created_at: string;
}

const SKILL_CATEGORY_COLORS: Record<string, string> = {
  generation: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  mixing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  venue: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  genre: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  production: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

const MEMORY_CATEGORY_COLORS: Record<string, string> = {
  preference: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  context: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  feedback: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  venue: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  style: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

export default function AdminSkillsMemories() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: skills = [] } = useQuery({
    queryKey: ["agent-skills", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_skills")
        .select("*")
        .eq("user_id", user!.id)
        .order("use_count", { ascending: false });
      if (error) throw error;
      return data as Skill[];
    },
  });

  const { data: memories = [] } = useQuery({
    queryKey: ["agent-memories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_memories")
        .select("*")
        .eq("user_id", user!.id)
        .order("importance", { ascending: false });
      if (error) throw error;
      return data as Memory[];
    },
  });

  const deleteSkill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_skills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
      toast.success("Skill deleted");
    },
  });

  const deleteMemory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_memories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-memories"] });
      toast.success("Memory deleted");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6" />
          Skills & Memories
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What SoundAgent has learned across sessions. Skills are reusable recipes, memories are contextual knowledge.
        </p>
      </div>

      <Tabs defaultValue="skills">
        <TabsList>
          <TabsTrigger value="skills" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Skills ({skills.length})
          </TabsTrigger>
          <TabsTrigger value="memories" className="gap-2">
            <Brain className="h-4 w-4" />
            Memories ({memories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="mt-4">
          {skills.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No skills learned yet. SoundAgent saves skills after successful generations.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {skills.map((skill) => (
                <Card key={skill.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm">{skill.name}</h3>
                        <Badge variant="outline" className={SKILL_CATEGORY_COLORS[skill.category] || ""}>
                          {skill.category}
                        </Badge>
                        {skill.use_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            used {skill.use_count}×
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{skill.content}</p>
                      {skill.metadata && Object.keys(skill.metadata).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(skill.metadata).map(([key, val]) => (
                            <Badge key={key} variant="secondary" className="text-xs font-mono">
                              {key}: {typeof val === "object" ? JSON.stringify(val) : String(val)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => deleteSkill.mutate(skill.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="memories" className="mt-4">
          {memories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No memories saved yet. SoundAgent remembers preferences and context from conversations.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {memories.map((mem) => (
                <Card key={mem.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={MEMORY_CATEGORY_COLORS[mem.category] || ""}>
                          {mem.category}
                        </Badge>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: Math.min(mem.importance, 5) }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                          ))}
                          {mem.importance > 5 && (
                            <span className="text-xs text-muted-foreground ml-1">+{mem.importance - 5}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm">{mem.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(mem.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => deleteMemory.mutate(mem.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
