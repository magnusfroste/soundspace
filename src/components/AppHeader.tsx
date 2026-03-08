import { LayoutDashboard, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppHeaderProps {
  viewMode: "dashboard" | "chat";
  onViewModeChange: (mode: "dashboard" | "chat") => void;
  showChatToggle: boolean;
}

export function AppHeader({ viewMode, onViewModeChange, showChatToggle }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useProfile(user?.id);

  return (
    <header className="h-12 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Sidebar trigger — always visible (controls whichever sidebar is active) */}
        <SidebarTrigger className="h-7 w-7" />

        {/* Mode toggle */}
        {showChatToggle && (
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => onViewModeChange("dashboard")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "dashboard"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => onViewModeChange("chat")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "chat"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
          </div>
        )}
      </div>

      {/* Right side — theme toggle + profile */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NavLink to="/profile" className="hover:opacity-80 transition-opacity">
          <Avatar className="h-7 w-7">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.display_name ?? "User"} />}
            <AvatarFallback className="text-[10px] bg-muted">
              {profile?.display_name ? profile.display_name.slice(0, 2).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
        </NavLink>
      </div>
    </header>
  );
}
