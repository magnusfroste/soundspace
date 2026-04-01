import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { connectAudioElement } from "@/hooks/useAudioAnalyser";
import type { Song } from "@/hooks/usePlayQueue";

interface UseAudioEngineOptions {
  onEnded: () => void;
}

export interface AudioEngineState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface AudioEngineActions {
  loadAndPlay: (song: Song) => Promise<void>;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  updatePlayDuration: () => Promise<void>;
}

export function useAudioEngine({ onEnded }: UseAudioEngineOptions): AudioEngineState & AudioEngineActions {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);

  // Play logging refs
  const playStartTimeRef = useRef<number | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const playLogIdRef = useRef<string | null>(null);

  // Stable ref for the onEnded callback so the audio listener stays current
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Log play to database
  const logPlay = useCallback(async (songId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("play_logs")
        .insert({ song_id: songId, user_id: user.id, duration_listened: 0 })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to log play:", error);
        return;
      }

      playLogIdRef.current = data.id;
      playStartTimeRef.current = Date.now();
      currentSongIdRef.current = songId;
    } catch (err) {
      console.error("Error logging play:", err);
    }
  }, []);

  // Update duration when song changes or stops
  const updatePlayDuration = useCallback(async () => {
    if (!playLogIdRef.current || !playStartTimeRef.current) return;

    const durationListened = Math.floor((Date.now() - playStartTimeRef.current) / 1000);

    try {
      await supabase
        .from("play_logs")
        .update({ duration_listened: durationListened })
        .eq("id", playLogIdRef.current);
    } catch (err) {
      console.error("Error updating play duration:", err);
    }

    playLogIdRef.current = null;
    playStartTimeRef.current = null;
  }, []);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.8;
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("durationchange", () => setDuration(audio.duration || 0));
    audio.addEventListener("ended", () => onEndedRef.current());
    audio.addEventListener("play", () => {
      setIsPlaying(true);
      connectAudioElement(audio);
    });
    audio.addEventListener("pause", () => setIsPlaying(false));

    return () => {
      updatePlayDuration();
      audio.pause();
      audio.src = "";
    };
  }, []);

  const loadAndPlay = useCallback(
    async (song: Song) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (currentSongIdRef.current && currentSongIdRef.current !== song.id) {
        await updatePlayDuration();
      }

      setCurrentSong(song);
      audio.src = song.file_url;
      audio.load(); // Ensures iOS Safari prepares the new source
      try {
        await audio.play();
      } catch (err) {
        // iOS Safari may block autoplay — keep song loaded so user can tap play
        console.warn("Autoplay blocked (iOS?):", err);
        setIsPlaying(false);
      }
      logPlay(song.id);
    },
    [updatePlayDuration, logPlay]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  }, []);

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    loadAndPlay,
    togglePlay,
    seek,
    setVolume,
    updatePlayDuration,
  };
}
