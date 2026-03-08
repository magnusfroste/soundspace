import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { moduleRegistry, type Module } from "@/lib/modules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Puzzle, Download, Upload, Zap, BarChart3, Bot } from "lucide-react";
import { toast } from "sonner";
import { UdioImporterPlugin } from "@/components/plugins/UdioImporterPlugin";
import { SunoImporterPlugin } from "@/components/plugins/SunoImporterPlugin";
import { SoundAgentSettings } from "@/components/modules/SoundAgentSettings";

const categoryIcons: Record<string, typeof Download> = {
  import: Download,
  export: Upload,
  automation: Zap,
  analytics: BarChart3,
  "ai-agent": Bot,
};

interface ModuleSettingsData {
  enabled_modules: string[];
}

export default function AdminModules() {
  const queryClient = useQueryClient();

  // Read both "modules" and legacy "plugins" keys for backward compat
  const { data: moduleSettings } = useQuery({
    queryKey: ["site-settings", "modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", ["modules", "plugins"]);

      if (error) throw error;

      const modulesRow = data?.find((r) => r.key === "modules");
      if (modulesRow) {
        return (modulesRow.value as unknown as ModuleSettingsData) || { enabled_modules: [] };
      }

      // Fallback: migrate from plugins key
      const pluginsRow = data?.find((r) => r.key === "plugins");
      if (pluginsRow) {
        const legacy = pluginsRow.value as unknown as { enabled_plugins?: string[] };
        return { enabled_modules: legacy?.enabled_plugins || [] };
      }

      return { enabled_modules: [] };
    },
  });

  const enabledModules = moduleSettings?.enabled_modules || [];

  const toggleMutation = useMutation({
    mutationFn: async ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      const current = enabledModules;
      const updated = enabled
        ? [...current, moduleId]
        : current.filter((id) => id !== moduleId);

      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { key: "modules", value: JSON.parse(JSON.stringify({ enabled_modules: updated })) },
          { onConflict: "key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "modules"] });
    },
    onError: () => {
      toast.error("Failed to update module");
    },
  });

  const [activeModule, setActiveModule] = useState<string | null>(null);

  const handleToggle = (mod: Module, enabled: boolean) => {
    toggleMutation.mutate({ moduleId: mod.id, enabled });
    if (enabled) {
      setActiveModule(mod.id);
      toast.success(`${mod.name} enabled`);
    } else {
      if (activeModule === mod.id) setActiveModule(null);
      toast.success(`${mod.name} disabled`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Puzzle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Modules</h1>
          <p className="text-muted-foreground">
            Enable or disable modular features for SoundSpace
          </p>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid gap-4">
        {moduleRegistry.map((mod) => {
          const isEnabled = enabledModules.includes(mod.id);
          const isActive = activeModule === mod.id;
          const CategoryIcon = categoryIcons[mod.category] || Puzzle;

          return (
            <Card
              key={mod.id}
              className={isActive ? "ring-1 ring-primary/50" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <CategoryIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{mod.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                          v{mod.version}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {mod.category}
                        </Badge>
                      </div>
                      <CardDescription className="mt-0.5">
                        {mod.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(mod, checked)}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              </CardHeader>

              {isEnabled && (
                <CardContent className="pt-0">
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setActiveModule(isActive ? null : mod.id)}
                      className="text-sm text-primary hover:underline"
                    >
                      {isActive ? "Hide" : "Open"} module
                    </button>
                  </div>

                  {isActive && mod.id === "udio-importer" && <UdioImporterPlugin />}
                  {isActive && mod.id === "suno-importer" && <SunoImporterPlugin />}
                  {isActive && mod.id === "sound-agent" && <SoundAgentSettings />}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {moduleRegistry.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No modules available yet</p>
        </div>
      )}
    </div>
  );
}
