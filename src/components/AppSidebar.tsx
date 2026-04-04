import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Home, ListMusic, Radio, LayoutDashboard, Music2, CalendarDays, Library, Sparkles, Plug, Settings, Mic, Crown, Puzzle, Users, Bot, Network, Trash2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import { useProfile } from "@/hooks/useProfile";
import { isIntegrationEnabled } from "@/lib/integrations-state";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

const baseBusinessNav = [
  { title: "Home", url: "/app", icon: Home },
  { title: "Playlists", url: "/playlists", icon: ListMusic },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Now Playing", url: "/now-playing", icon: Radio },
];

const adminNavStatic = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "AI Studio", url: "/admin/studio", icon: Sparkles },
  { title: "Song Library", url: "/admin/library", icon: Library },
  { title: "Manage Playlists", url: "/admin/playlists", icon: ListMusic },
  { title: "Trash", url: "/admin/trash", icon: Trash2 },
  { title: "Integrations", url: "/admin/integrations", icon: Plug },
  { title: "Modules", url: "/admin/modules", icon: Puzzle },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Site Settings", url: "/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const location = useLocation();
  const isAdmin = role === "admin";

  // Fetch enabled modules to conditionally show SoundAgent
  const { data: moduleSettings } = useModuleSettings();

  const enabledModules: string[] = Array.isArray(moduleSettings?.enabled_modules) ? moduleSettings.enabled_modules : [];
  const soundAgentEnabled = enabledModules.includes("sound-agent");
  const a2aEnabled = isIntegrationEnabled("a2a");

  // Build admin nav — conditional entries based on modules/integrations
  const adminNav = [
    ...adminNavStatic.slice(0, 2), // Dashboard, AI Studio
    ...(soundAgentEnabled ? [
      { title: "SoundAgent", url: "/admin/agent", icon: Bot },
    ] : []),
    ...adminNavStatic.slice(2), // rest
    ...(a2aEnabled ? [
      { title: "A2A Protocol", url: "/admin/a2a", icon: Network },
    ] : []),
  ];

  // Fetch user profile for avatar & display name
  const { data: profile } = useProfile(user?.id);

  // Fetch premium features setting
  const { data: premiumSettings } = useQuery({
    queryKey: ["site-settings", "premium_features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "premium_features")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const announcementsEnabled = (premiumSettings?.value as { announcements_enabled?: boolean })?.announcements_enabled ?? false;
  const customPlaylistsEnabled = (premiumSettings?.value as { custom_playlists_enabled?: boolean })?.custom_playlists_enabled ?? false;

  // Build business nav based on feature flags
  const businessNav = [
    ...baseBusinessNav.slice(0, 3), // Home, Playlists, Schedule
    ...(announcementsEnabled ? [{ title: "Announcements", url: "/announcements", icon: Mic, premium: true }] : []),
    ...(customPlaylistsEnabled ? [{ title: "My Playlists", url: "/my-playlists", icon: Crown, premium: true }] : []),
    ...baseBusinessNav.slice(3), // Now Playing
  ] as Array<{ title: string; url: string; icon: typeof Home; premium?: boolean }>;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Music2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                SoundSpace
              </h1>
              
            </div>
          </div>
          <SidebarTrigger className="h-7 w-7 flex-shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {businessNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </span>
                      {item.premium && (
                        <Crown className="h-3 w-3 text-amber-500" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <div className="glass rounded-lg p-3 group-data-[collapsible=icon]:p-2 space-y-2">
          <NavLink to="/profile" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center hover:opacity-80 transition-opacity">
            <Avatar className="h-7 w-7 shrink-0">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.display_name ?? "User"} />}
              <AvatarFallback className="text-[10px] bg-muted">
                {profile?.display_name ? profile.display_name.slice(0, 2).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate group-data-[collapsible=icon]:hidden">
              {profile?.display_name || "Profile"}
            </span>
          </NavLink>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0" 
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 group-data-[collapsible=icon]:mr-0 mr-2" />
            <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
          </Button>
        </div>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
}
