import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PlayerBar } from "@/components/PlayerBar";
import { MobileNav } from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
        <div className="min-h-screen flex w-full">
        {/* Desktop sidebar - hidden on mobile */}
        {!isMobile && <AppSidebar />}
        
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <main className="flex-1 overflow-auto p-4 md:p-6 pb-36 md:pb-6">
            <Outlet />
          </main>
          <div className="flex-shrink-0">
            <PlayerBar />
          </div>
        </div>
        
        {/* Mobile bottom navigation */}
        {isMobile && <MobileNav />}
      </div>
    </SidebarProvider>
  );
}
