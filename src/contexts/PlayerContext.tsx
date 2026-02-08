import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { connectAudioElement } from "@/hooks/useAudioAnalyser";

type Song = Tables<"songs">;

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  scheduleMode: boolean;
  currentPlaylistId: string | null;
  playSong: (song: Song) => void;
  playQueue: (songs: Song[], startIndex?: number, playlistId?: string) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setScheduleMode: (enabled: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [scheduleMode, setScheduleModeState] = useState(false);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  
  // Track play session for logging
  const playStartTimeRef = useRef<number | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const playLogIdRef = useRef<string | null>(null);

  // Log play to database
  const logPlay = useCallback(async (songId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("play_logs")
        .insert({
          song_id: songId,
          user_id: user.id,
          duration_listened: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to log play:", error);
        return;
      }

      playLogIdRef.current = data.id;
      playStartTimeRef.current = Date.now();
      currentSongIdRef.current = songId;
      console.log("Play logged:", songId);
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

      console.log("Updated play duration:", durationListened, "seconds");
    } catch (err) {
      console.error("Error updating play duration:", err);
    }

    // Reset tracking
    playLogIdRef.current = null;
    playStartTimeRef.current = null;
  }, []);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.8;
    audio.crossOrigin = "anonymous"; // Required for audio analyser
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("durationchange", () => setDuration(audio.duration || 0));
    audio.addEventListener("ended", () => handleEnded());
    audio.addEventListener("play", () => {
      setIsPlaying(true);
      // Connect to audio analyser on first play
      connectAudioElement(audio);
    });
    audio.addEventListener("pause", () => setIsPlaying(false));

    return () => {
      // Update duration on unmount
      updatePlayDuration();
      audio.pause();
      audio.src = "";
    };
  }, []);

  const handleEnded = useCallback(() => {
    // Update duration for completed song
    updatePlayDuration();
    
    // Auto-advance to next track
    setQueueIndex((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx < queue.length) {
        loadAndPlay(queue[nextIdx]);
        return nextIdx;
      }
      setIsPlaying(false);
      return prev;
    });
  }, [queue, updatePlayDuration]);

  // Update ended handler when queue changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handler = () => handleEnded();
    audio.removeEventListener("ended", handler);
    audio.addEventListener("ended", handler);
    return () => audio.removeEventListener("ended", handler);
  }, [handleEnded]);

  async function loadAndPlay(song: Song) {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Update duration for previous song before switching
    if (currentSongIdRef.current && currentSongIdRef.current !== song.id) {
      await updatePlayDuration();
    }
    
    setCurrentSong(song);
    audio.src = song.file_url;
    audio.play().catch(() => {});
    
    // Log the new play
    logPlay(song.id);
  }

  const playSong = useCallback((song: Song) => {
    setQueue([song]);
    setQueueIndex(0);
    setCurrentPlaylistId(null);
    loadAndPlay(song);
  }, []);

  const playQueue = useCallback((songs: Song[], startIndex = 0, playlistId?: string) => {
    setQueue(songs);
    setQueueIndex(startIndex);
    setCurrentPlaylistId(playlistId || null);
    if (songs[startIndex]) loadAndPlay(songs[startIndex]);
  }, []);

  const setScheduleMode = useCallback((enabled: boolean) => {
    setScheduleModeState(enabled);
    localStorage.setItem("scheduleMode", enabled ? "true" : "false");
  }, []);

  // Load schedule mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("scheduleMode");
    if (saved === "true") setScheduleModeState(true);
  }, []);

  // Schedule auto-play engine
  useEffect(() => {
    if (!scheduleMode) return;

    const checkSchedule = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!profile) return;

        const now = new Date();
        const dayOfWeek = now.getDay();
        const currentTime = now.toTimeString().slice(0, 5);

        // Find active schedule entry
        const { data: entries } = await supabase
          .from("schedule_entries")
          .select("playlist_id")
          .eq("profile_id", profile.id)
          .eq("day_of_week", dayOfWeek)
          .eq("is_active", true)
          .lte("start_time", currentTime)
          .gt("end_time", currentTime)
          .limit(1);

        if (!entries || entries.length === 0) return;

        const scheduledPlaylistId = entries[0].playlist_id;

        // Only switch if different playlist
        if (scheduledPlaylistId === currentPlaylistId) return;

        // Fetch playlist songs
        const { data: playlistSongs } = await supabase
          .from("playlist_songs")
          .select("song:songs(*)")
          .eq("playlist_id", scheduledPlaylistId)
          .order("position");

        if (!playlistSongs || playlistSongs.length === 0) return;

        const songs = playlistSongs
          .map(ps => ps.song)
          .filter((s): s is Song => s !== null);

        if (songs.length > 0) {
          console.log("Schedule: switching to playlist", scheduledPlaylistId);
          playQueue(songs, 0, scheduledPlaylistId);
        }
      } catch (err) {
        console.error("Schedule check failed:", err);
      }
    };

    // Initial check
    checkSchedule();

    // Check every minute
    const interval = setInterval(checkSchedule, 60000);
    return () => clearInterval(interval);
  }, [scheduleMode, currentPlaylistId, playQueue]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const nextTrack = useCallback(() => {
    updatePlayDuration();
    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      setQueueIndex(nextIdx);
      loadAndPlay(queue[nextIdx]);
    }
  }, [queueIndex, queue, updatePlayDuration]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    updatePlayDuration();
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) {
      setQueueIndex(prevIdx);
      loadAndPlay(queue[prevIdx]);
    }
  }, [queueIndex, queue, updatePlayDuration]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentSong, queue, isPlaying, currentTime, duration, volume,
        scheduleMode, currentPlaylistId,
        playSong, playQueue, togglePlay, nextTrack, prevTrack, seek, setVolume,
        setScheduleMode,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}