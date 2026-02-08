import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePlayer } from "@/contexts/PlayerContext";
import { Music, Play, ListMusic } from "lucide-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  const { user } = useAuth();
  const { playQueue } = usePlayer();

  const { data: playlists } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*").limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Bem-vindo ao SomHonesto</h1>
        <p className="text-muted-foreground mt-2">
          Música ambiente de alta qualidade para o seu negócio.
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-primary" />
            Playlists em Destaque
          </h2>
          <Link to="/playlists" className="text-sm text-primary hover:underline">
            Ver todas
          </Link>
        </div>

        {playlists && playlists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((pl) => (
              <Link
                key={pl.id}
                to={`/playlists/${pl.id}`}
                className="glass glass-hover rounded-xl p-4 group cursor-pointer"
              >
                <div className="h-32 rounded-lg bg-muted mb-3 flex items-center justify-center overflow-hidden relative">
                  {pl.cover_image_url ? (
                    <img src={pl.cover_image_url} alt={pl.title} className="h-full w-full object-cover" />
                  ) : (
                    <Music className="h-10 w-10 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold truncate">{pl.title}</h3>
                <p className="text-xs text-muted-foreground truncate mt-1">{pl.description || pl.category || "Playlist"}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass rounded-xl p-8 text-center">
            <Music className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma playlist disponível ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Um admin precisa criar playlists para começar.</p>
          </div>
        )}
      </section>
    </div>
  );
}
