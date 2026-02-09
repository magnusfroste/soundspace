import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserPlaylists } from "@/hooks/useUserPlaylists";
import { CreatePlaylistDialog } from "@/components/user-playlists";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Plus, Music, Loader2, Lock } from "lucide-react";

export default function MyPlaylists() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const { playlists, isLoading, createPlaylist } = useUserPlaylists();

  // Check if feature is enabled
  const { data: premiumSettings, isLoading: checkingFeature } = useQuery({
    queryKey: ["site-settings", "premium_features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "premium_features")
        .maybeSingle();

      if (error) throw error;
      return data?.value as { custom_playlists_enabled?: boolean } | null;
    },
  });

  const featureEnabled = premiumSettings?.custom_playlists_enabled ?? false;

  if (checkingFeature || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Feature Not Available</h2>
        <p className="text-muted-foreground max-w-md">
          Custom playlists is a premium feature. Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  const handleCreate = async (data: { title: string; description?: string }) => {
    const result = await createPlaylist.mutateAsync(data);
    if (result) {
      navigate(`/my-playlists/${result.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Playlists</h1>
            <p className="text-muted-foreground">Create and manage your custom playlists</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Playlist
        </Button>
      </div>

      {playlists?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No playlists yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first playlist and start adding songs
            </p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Playlist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists?.map((playlist) => (
            <Card
              key={playlist.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/my-playlists/${playlist.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {playlist.cover_image_url ? (
                    <img
                      src={playlist.cover_image_url}
                      alt=""
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center">
                      <Music className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{playlist.title}</h3>
                    {playlist.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {playlist.description}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {playlist.song_count} {playlist.song_count === 1 ? "song" : "songs"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePlaylistDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isLoading={createPlaylist.isPending}
      />
    </div>
  );
}
