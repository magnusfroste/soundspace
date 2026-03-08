import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PlayerBar } from "@/components/PlayerBar";
import { MobileNav } from "@/components/MobileNav";
import { AppHeader } from "@/components/AppHeader";
import { AgentChat } from "@/components/agent/AgentChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  const isMobile = useIsMobile();
  const { role } = useAuth();
  const [viewMode, setViewMode] = useState<"dashboard" | "chat">("dashboard");

  // Check if SoundAgent module is enabled
  const { data: moduleSettings } = useQuery({
    queryKey: ["site-settings", "modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", ["modules", "plugins"]);
      if (error) throw error;
      const modulesRow = data?.find((r) => r.key === "modules");
      if (modulesRow) return (modulesRow.value as any) || { enabled_modules: [] };
      const pluginsRow = data?.find((r) => r.key === "plugins");
      if (pluginsRow) {
        const legacy = pluginsRow.value as any;
        return { enabled_modules: legacy?.enabled_plugins || [] };
      }
      return { enabled_modules: [] };
    },
  });

  const enabledModules: string[] = Array.isArray(moduleSettings?.enabled_modules) ? moduleSettings.enabled_modules : [];
  const showChatToggle = role === "admin" && enabledModules.includes("sound-agent");
  const isChat = viewMode === "chat" && showChatToggle;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar — hidden in chat mode and on mobile */}
        {!isChat && !isMobile && <AppSidebar />}

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Header with mode toggle */}
          <AppHeader
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showChatToggle={showChatToggle}
          />

          {isChat ? (
            /* Full-width chat view */
            <div className="flex-1 overflow-hidden">
              <AgentChat fullWidth />
            </div>
          ) : (
            <main className="flex-1 overflow-auto p-4 md:p-6 pb-36 md:pb-6">
              <Outlet />
            </main>
          )}

          {!isChat && (
            <div className="flex-shrink-0">
              <PlayerBar />
            </div>
          )}
        </div>

        {/* Mobile bottom navigation */}
        {isMobile && !isChat && <MobileNav />}
      </div>
    </SidebarProvider>
  );
}
