import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { AppLayout } from "@/components/AppLayout";
import AuthPage from "@/pages/Auth";
import HomePage from "@/pages/Home";
import PlaylistsPage from "@/pages/Playlists";
import PlaylistDetail from "@/pages/PlaylistDetail";
import NowPlaying from "@/pages/NowPlaying";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminIngestion from "@/pages/AdminIngestion";
import AdminPlaylists from "@/pages/AdminPlaylists";
import AdminSettings from "@/pages/AdminSettings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
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
  if (user) return <Navigate to="/" replace />;
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
            <Route path="/auth" element={<AuthGuard />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlists/:id" element={<PlaylistDetail />} />
              <Route path="/now-playing" element={<NowPlaying />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/ingestion" element={<AdminIngestion />} />
              <Route path="/admin/playlists" element={<AdminPlaylists />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
