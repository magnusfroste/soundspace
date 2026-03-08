import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ModuleSettingsData {
  enabled_modules: string[];
}

export function useModuleSettings() {
  return useQuery({
    queryKey: ["site-settings", "modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", ["modules", "plugins"]);
      if (error) throw error;

      const modulesRow = data?.find((r) => r.key === "modules");
      if (modulesRow) return (modulesRow.value as ModuleSettingsData) || { enabled_modules: [] };

      const pluginsRow = data?.find((r) => r.key === "plugins");
      if (pluginsRow) {
        const legacy = pluginsRow.value as any;
        return { enabled_modules: legacy?.enabled_plugins || [] } as ModuleSettingsData;
      }

      return { enabled_modules: [] };
    },
  });
}
