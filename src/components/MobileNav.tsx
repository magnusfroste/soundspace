import { Home, ListMusic, Radio, CalendarDays, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const mobileNavItems = [
  { title: "Home", url: "/app", icon: Home },
  { title: "Playlists", url: "/playlists", icon: ListMusic },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Now Playing", url: "/now-playing", icon: Radio },
];

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/app"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.title}</span>
          </NavLink>
        ))}
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <SidebarProvider defaultOpen={true}>
              <AppSidebar />
            </SidebarProvider>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}