import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { AppLayout } from "@/components/AppLayout";
import Index from "@/pages/Index";
import AuthPage from "@/pages/Auth";
import HomePage from "@/pages/Home";
import PlaylistsPage from "@/pages/Playlists";
import PlaylistDetail from "@/pages/PlaylistDetail";
import NowPlaying from "@/pages/NowPlaying";
import SchedulePage from "@/pages/Schedule";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminAIStudio from "@/pages/AdminAIStudio";
import AdminLibrary from "@/pages/AdminLibrary";
import AdminPlaylists from "@/pages/AdminPlaylists";
import AdminIntegrations from "@/pages/AdminIntegrations";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <PlayerProvider>
      <AppLayout />
    </PlayerProvider>
  );
}

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthGuard />} />
            
            {/* Protected app routes */}
            <Route element={<ProtectedRoutes />}>
              <Route path="/app" element={<HomePage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlists/:id" element={<PlaylistDetail />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/now-playing" element={<NowPlaying />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/studio" element={<AdminAIStudio />} />
              <Route path="/admin/library" element={<AdminLibrary />} />
              <Route path="/admin/playlists" element={<AdminPlaylists />} />
              <Route path="/admin/integrations" element={<AdminIntegrations />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
