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
import Onboarding from "@/pages/Onboarding";
import HomePage from "@/pages/Home";
import PlaylistsPage from "@/pages/Playlists";
import PlaylistDetail from "@/pages/PlaylistDetail";
import NowPlaying from "@/pages/NowPlaying";
import SchedulePage from "@/pages/Schedule";
import AnnouncementsPage from "@/pages/Announcements";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminAIStudio from "@/pages/AdminAIStudio";
import AdminLibrary from "@/pages/AdminLibrary";
import AdminPlaylists from "@/pages/AdminPlaylists";
import AdminIntegrations from "@/pages/AdminIntegrations";
import AdminSettings from "@/pages/AdminSettings";
import AdminModules from "@/pages/AdminModules";
import AdminUsers from "@/pages/AdminUsers";
import AdminAgent from "@/pages/AdminAgent";
import AdminObjectives from "@/pages/AdminObjectives";
import MyPlaylists from "@/pages/MyPlaylists";
import MyPlaylistDetail from "@/pages/MyPlaylistDetail";
import NotFound from "@/pages/NotFound";
import ProfilePage from "@/pages/ProfilePage";

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

function OnboardingGuard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <Onboarding />;
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
            <Route path="/onboarding" element={<OnboardingGuard />} />
            
            {/* Protected app routes */}
            <Route element={<ProtectedRoutes />}>
              <Route path="/app" element={<HomePage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlists/:id" element={<PlaylistDetail />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/now-playing" element={<NowPlaying />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/my-playlists" element={<MyPlaylists />} />
              <Route path="/my-playlists/:id" element={<MyPlaylistDetail />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/studio" element={<AdminAIStudio />} />
              <Route path="/admin/library" element={<AdminLibrary />} />
              <Route path="/admin/playlists" element={<AdminPlaylists />} />
              <Route path="/admin/integrations" element={<AdminIntegrations />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/modules" element={<AdminModules />} />
              <Route path="/admin/plugins" element={<AdminModules />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/agent" element={<AdminAgent />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
