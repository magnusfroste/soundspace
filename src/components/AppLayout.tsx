import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PlayerBar } from "@/components/PlayerBar";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
          <PlayerBar />
        </div>
      </div>
    </SidebarProvider>
  );
}
