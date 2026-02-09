import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePlayer } from "@/contexts/PlayerContext";
import { Music, Play, ListMusic, Sparkles, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

interface Profile {
  onboarding_completed: boolean | null;
  suggested_playlist_ids: string[] | null;
  business_type: string | null;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playQueue, currentSong } = usePlayer();
  const hasAutoPlayedRef = useRef(false);

  // Fetch profile to check onboarding status
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed, suggested_playlist_ids, business_type")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user,
  });

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed) {
      navigate("/onboarding", { replace: true });
    }
  }, [profileLoading, profile, navigate]);

  // Fetch suggested playlists if they exist
  const { data: suggestedPlaylists } = useQuery({
    queryKey: ["suggested-playlists", profile?.suggested_playlist_ids],
    queryFn: async () => {
      if (!profile?.suggested_playlist_ids?.length) return [];
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .in("id", profile.suggested_playlist_ids);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.suggested_playlist_ids?.length,
  });

  // Auto-play all suggested playlists after onboarding
  useEffect(() => {
    const autoPlay = async () => {
      // Only auto-play once per session and if no music is playing
      if (hasAutoPlayedRef.current || currentSong) return;
      if (!suggestedPlaylists || suggestedPlaylists.length === 0) return;

      // Check if we just came from onboarding
      const justOnboarded = sessionStorage.getItem("just_onboarded");
      if (!justOnboarded) return;

      // Clear the flag
      sessionStorage.removeItem("just_onboarded");
      hasAutoPlayedRef.current = true;

      // Fetch songs from ALL suggested playlists
      const allSongs: Tables<"songs">[] = [];
      
      for (const playlist of suggestedPlaylists) {
        const { data: playlistSongsData } = await supabase
          .from("playlist_songs")
          .select("song:songs(*)")
          .eq("playlist_id", playlist.id)
          .order("position");

        if (playlistSongsData) {
          const songs = playlistSongsData
            .map(ps => ps.song)
            .filter((s): s is NonNullable<typeof s> => s !== null);
          allSongs.push(...songs);
        }
      }

      if (allSongs.length > 0) {
        console.log("Auto-playing all suggested playlists:", allSongs.length, "songs");
        playQueue(allSongs, 0, "suggested");
      }
    };

    autoPlay();
  }, [suggestedPlaylists, currentSong, playQueue]);

  // Fetch all playlists for "Explore more"
  const { data: allPlaylists } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*").limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Filter out suggested playlists from "Explore more" section
  const explorePlaylists = allPlaylists?.filter(
    (pl) => !profile?.suggested_playlist_ids?.includes(pl.id)
  );

  const hasSuggestedPlaylists = suggestedPlaylists && suggestedPlaylists.length > 0;
  const energyLabel = profile?.business_type;

  if (profileLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome to SomHonesto</h1>
        <p className="text-muted-foreground mt-2">
          {hasSuggestedPlaylists && energyLabel
            ? `${energyLabel.charAt(0).toUpperCase() + energyLabel.slice(1)} playlists for your space`
            : "High-quality ambient music for your space."}
        </p>
      </div>

      {/* Suggested Playlists Section */}
      {hasSuggestedPlaylists && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Your Playlists</h2>
            <Badge variant="secondary" className="ml-2">Recommended</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestedPlaylists.map((pl) => (
              <Link
                key={pl.id}
                to={`/playlists/${pl.id}`}
                className="glass glass-hover rounded-xl p-4 group cursor-pointer border-2 border-primary/20"
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
                <p className="text-xs text-muted-foreground truncate mt-1">{pl.description || "Playlist"}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Explore More Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-primary" />
            {hasSuggestedPlaylists ? "Explore More" : "Featured Playlists"}
          </h2>
          <Link to="/playlists" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {explorePlaylists && explorePlaylists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {explorePlaylists.slice(0, hasSuggestedPlaylists ? 3 : 6).map((pl) => (
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
                <p className="text-xs text-muted-foreground truncate mt-1">{pl.description || "Playlist"}</p>
              </Link>
            ))}
          </div>
        ) : !hasSuggestedPlaylists ? (
          <div className="glass rounded-xl p-8 text-center">
            <Music className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No playlists available yet.</p>
            <p className="text-xs text-muted-foreground mt-1">An admin needs to create playlists to get started.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
