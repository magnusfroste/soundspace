import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Music, ListMusic } from "lucide-react";

export default function PlaylistsPage() {
  const { user } = useAuth();

  const { data: playlists, isLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <ListMusic className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          All Playlists
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Choose a playlist for your space.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-3 sm:p-4 animate-pulse">
              <div className="aspect-square rounded-lg bg-muted mb-2 sm:mb-3" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : playlists && playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {playlists.map((pl) => (
            <Link
              key={pl.id}
              to={`/playlists/${pl.id}`}
              className="glass glass-hover rounded-xl p-3 sm:p-4 group"
            >
              <div className="aspect-square rounded-lg bg-muted mb-2 sm:mb-3 flex items-center justify-center overflow-hidden">
                {pl.cover_image_url ? (
                  <img src={pl.cover_image_url} alt={pl.title} className="h-full w-full object-cover" />
                ) : (
                  <Music className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                )}
              </div>
              <h3 className="font-semibold truncate text-sm sm:text-base">{pl.title}</h3>
              <p className="text-xs text-muted-foreground truncate mt-1">
                {pl.description || ""}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass rounded-xl p-6 sm:p-8 text-center">
          <Music className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No playlists found.</p>
        </div>
      )}
    </div>
  );
}
