import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Song = Tables<"songs">;

interface LandingPageSettings {
  playlist_id: string | null;
  enabled: boolean;
}

export function useLandingAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const songIndexRef = useRef(0);

  // Fetch settings and songs on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        // Get landing page settings
        const { data: settings } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "landing_page")
          .maybeSingle();

        if (!settings?.value) {
          setIsLoading(false);
          return;
        }

        const value = settings.value as unknown as LandingPageSettings;
        setIsEnabled(value.enabled);

        if (!value.enabled || !value.playlist_id) {
          setIsLoading(false);
          return;
        }

        // Fetch playlist songs
        const { data: playlistSongs } = await supabase
          .from("playlist_songs")
          .select("song:songs(*)")
          .eq("playlist_id", value.playlist_id)
          .order("position");

        if (playlistSongs && playlistSongs.length > 0) {
          const fetchedSongs = playlistSongs
            .map((ps) => ps.song)
            .filter((s): s is Song => s !== null);
          setSongs(fetchedSongs);
        }
      } catch (error) {
        console.error("Failed to fetch landing audio settings:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  // Create audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.3; // Lower volume for ambient music
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    audio.addEventListener("ended", () => {
      // Play next song
      songIndexRef.current = (songIndexRef.current + 1) % songs.length;
      if (songs[songIndexRef.current]) {
        audio.src = songs[songIndexRef.current].file_url;
        setCurrentSong(songs[songIndexRef.current]);
        audio.play().catch(() => {});
      }
    });

    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [songs]);

  // Trigger playback (called on scroll)
  const triggerPlay = useCallback(() => {
    if (hasTriggered || !isEnabled || songs.length === 0 || !audioRef.current) {
      return;
    }

    setHasTriggered(true);
    const firstSong = songs[0];
    setCurrentSong(firstSong);
    audioRef.current.src = firstSong.file_url;
    audioRef.current.play().catch((error) => {
      console.log("Autoplay blocked:", error);
      // Reset so user can try again with a click
      setHasTriggered(false);
    });
  }, [hasTriggered, isEnabled, songs]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (!audioRef.current.src && songs.length > 0) {
        const firstSong = songs[0];
        setCurrentSong(firstSong);
        audioRef.current.src = firstSong.file_url;
      }
      audioRef.current.play().catch(() => {});
      setHasTriggered(true);
    }
  }, [isPlaying, songs]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioRef.current.muted = newMuted;
  }, [isMuted]);

  return {
    isPlaying,
    isEnabled,
    isLoading,
    currentSong,
    hasTriggered,
    isMuted,
    triggerPlay,
    togglePlay,
    toggleMute,
  };
}
