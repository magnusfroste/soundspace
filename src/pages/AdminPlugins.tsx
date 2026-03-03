import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pluginRegistry, type Plugin } from "@/lib/plugins";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Puzzle, Download, Upload, Zap, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { UdioImporterPlugin } from "@/components/plugins/UdioImporterPlugin";
import { SunoImporterPlugin } from "@/components/plugins/SunoImporterPlugin";

const categoryIcons: Record<string, typeof Download> = {
  import: Download,
  export: Upload,
  automation: Zap,
  analytics: BarChart3,
};

interface PluginSettings {
  enabled_plugins: string[];
}

export default function AdminPlugins() {
  const queryClient = useQueryClient();

  const { data: pluginSettings, isLoading } = useQuery({
    queryKey: ["site-settings", "plugins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "plugins")
        .maybeSingle();

      if (error) throw error;
      return (data?.value as unknown as PluginSettings) || { enabled_plugins: [] };
    },
  });

  const enabledPlugins = pluginSettings?.enabled_plugins || [];

  const toggleMutation = useMutation({
    mutationFn: async ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) => {
      const current = enabledPlugins;
      const updated = enabled
        ? [...current, pluginId]
        : current.filter((id) => id !== pluginId);

      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { key: "plugins", value: JSON.parse(JSON.stringify({ enabled_plugins: updated })) },
          { onConflict: "key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "plugins"] });
    },
    onError: () => {
      toast.error("Failed to update plugin");
    },
  });

  const [activePlugin, setActivePlugin] = useState<string | null>(null);

  const handleToggle = (plugin: Plugin, enabled: boolean) => {
    toggleMutation.mutate({ pluginId: plugin.id, enabled });
    if (enabled) {
      setActivePlugin(plugin.id);
      toast.success(`${plugin.name} enabled`);
    } else {
      if (activePlugin === plugin.id) setActivePlugin(null);
      toast.success(`${plugin.name} disabled`);
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
          <h1 className="text-2xl font-bold">Plugins</h1>
          <p className="text-muted-foreground">
            Extend SoundSpace with modular plugins
          </p>
        </div>
      </div>

      {/* Plugin cards */}
      <div className="grid gap-4">
        {pluginRegistry.map((plugin) => {
          const isEnabled = enabledPlugins.includes(plugin.id);
          const isActive = activePlugin === plugin.id;
          const CategoryIcon = categoryIcons[plugin.category] || Puzzle;

          return (
            <Card
              key={plugin.id}
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
                        <CardTitle className="text-base">{plugin.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                          v{plugin.version}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {plugin.category}
                        </Badge>
                      </div>
                      <CardDescription className="mt-0.5">
                        {plugin.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(plugin, checked)}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              </CardHeader>

              {isEnabled && (
                <CardContent className="pt-0">
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setActivePlugin(isActive ? null : plugin.id)}
                      className="text-sm text-primary hover:underline"
                    >
                      {isActive ? "Hide" : "Open"} plugin
                    </button>
                  </div>

                  {isActive && plugin.id === "udio-importer" && (
                    <UdioImporterPlugin />
                  )}
                  {isActive && plugin.id === "suno-importer" && (
                    <SunoImporterPlugin />
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {pluginRegistry.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No plugins available yet</p>
        </div>
      )}
    </div>
  );
}
