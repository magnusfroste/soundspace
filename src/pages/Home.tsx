import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "@/contexts/PlayerContext";
import { Music, Play, ListMusic, Sparkles, ChevronRight, Headphones, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    await queryClient.invalidateQueries({ queryKey: ["playlists"] });
    await queryClient.invalidateQueries({ queryKey: ["continue-listening", user?.id] });
    await queryClient.invalidateQueries({ queryKey: ["suggested-playlists"] });
  }, [queryClient, user?.id]);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

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
      if (hasAutoPlayedRef.current || currentSong) return;
      if (!suggestedPlaylists || suggestedPlaylists.length === 0) return;

      const justOnboarded = sessionStorage.getItem("just_onboarded");
      if (!justOnboarded) return;

      sessionStorage.removeItem("just_onboarded");
      hasAutoPlayedRef.current = true;

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

  // Continue Listening — find the last played playlist
  const { data: continueListening } = useQuery({
    queryKey: ["continue-listening", user?.id],
    queryFn: async () => {
      const { data: recentLog, error: logError } = await supabase
        .from("play_logs")
        .select("song_id, played_at")
        .eq("user_id", user!.id)
        .order("played_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logError || !recentLog) return null;

      const { data: playlistLink } = await supabase
        .from("playlist_songs")
        .select("playlist_id")
        .eq("song_id", recentLog.song_id)
        .limit(1)
        .maybeSingle();

      if (!playlistLink) return null;

      const { data: playlist } = await supabase
        .from("playlists")
        .select("*")
        .eq("id", playlistLink.playlist_id)
        .maybeSingle();

      if (!playlist) return null;

      const { data: songs } = await supabase
        .from("playlist_songs")
        .select("song:songs(*)")
        .eq("playlist_id", playlist.id)
        .order("position");

      const songList = (songs || [])
        .map((ps) => ps.song)
        .filter((s): s is Tables<"songs"> => s !== null);

      const resumeIndex = Math.max(0, songList.findIndex((s) => s.id === recentLog.song_id));

      return { playlist, songs: songList, resumeIndex, playedAt: recentLog.played_at };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

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
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Welcome to SoundSpace</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
          {hasSuggestedPlaylists && energyLabel
            ? `${energyLabel.charAt(0).toUpperCase() + energyLabel.slice(1)} playlists for your space`
            : "High-quality ambient music for your space."}
        </p>
      </div>

      {/* Continue Listening Section */}
      {continueListening && continueListening.songs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Headphones className="h-5 w-5 text-primary" />
            <h2 className="text-lg sm:text-xl font-semibold">Continue Listening</h2>
          </div>

          <div className="glass rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
              {continueListening.playlist.cover_image_url ? (
                <img
                  src={continueListening.playlist.cover_image_url}
                  alt={continueListening.playlist.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Music className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate text-sm sm:text-base">{continueListening.playlist.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {continueListening.songs.length} songs · Track {continueListening.resumeIndex + 1}
              </p>
            </div>
            <Button
              size="sm"
              className="flex-shrink-0 gap-1.5"
              onClick={() =>
                playQueue(
                  continueListening.songs,
                  continueListening.resumeIndex,
                  continueListening.playlist.id
                )
              }
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Resume</span>
            </Button>
          </div>
        </section>
      )}

      {/* Suggested Playlists Section */}
      {hasSuggestedPlaylists && (
        <section>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg sm:text-xl font-semibold">Your Playlists</h2>
            <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">Recommended</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {suggestedPlaylists.map((pl) => (
              <Link
                key={pl.id}
                to={`/playlists/${pl.id}`}
                className="glass glass-hover rounded-xl p-3 sm:p-4 group cursor-pointer border-2 border-primary/20"
              >
                <div className="aspect-square rounded-lg bg-muted mb-2 sm:mb-3 flex items-center justify-center overflow-hidden relative">
                  {pl.cover_image_url ? (
                    <img src={pl.cover_image_url} alt={pl.title} className="h-full w-full object-cover" />
                  ) : (
                    <Music className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold truncate text-sm sm:text-base">{pl.title}</h3>
                <p className="text-xs text-muted-foreground truncate mt-1">{pl.description || "Playlist"}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Explore More Section */}
      <section>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-primary" />
            {hasSuggestedPlaylists ? "Explore More" : "Featured Playlists"}
          </h2>
          <Link to="/playlists" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {explorePlaylists && explorePlaylists.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {explorePlaylists.slice(0, hasSuggestedPlaylists ? 3 : 6).map((pl) => (
              <Link
                key={pl.id}
                to={`/playlists/${pl.id}`}
                className="glass glass-hover rounded-xl p-3 sm:p-4 group cursor-pointer"
              >
                <div className="aspect-square rounded-lg bg-muted mb-2 sm:mb-3 flex items-center justify-center overflow-hidden relative">
                  {pl.cover_image_url ? (
                    <img src={pl.cover_image_url} alt={pl.title} className="h-full w-full object-cover" />
                  ) : (
                    <Music className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold truncate text-sm sm:text-base">{pl.title}</h3>
                <p className="text-xs text-muted-foreground truncate mt-1">{pl.description || "Playlist"}</p>
              </Link>
            ))}
          </div>
        ) : !hasSuggestedPlaylists ? (
          <div className="glass rounded-xl p-6 sm:p-8 text-center">
            <Music className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No playlists available yet.</p>
            <p className="text-xs text-muted-foreground mt-1">An admin needs to create playlists to get started.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
