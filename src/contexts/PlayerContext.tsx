import React, { createContext, useContext, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayQueue, type Song, type RepeatMode } from "@/hooks/usePlayQueue";
import { useAudioEngine } from "@/hooks/useAudioEngine";

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  scheduleMode: boolean;
  currentPlaylistId: string | null;
  playSong: (song: Song) => void;
  playQueue: (songs: Song[], startIndex?: number, playlistId?: string) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setShuffle: (enabled: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setScheduleMode: (enabled: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const pq = usePlayQueue();

  // handleEnded bridges the two hooks
  const handleEnded = useCallback(() => {
    engine.updatePlayDuration();

    if (pq.repeatMode === "one") {
      // loadAndPlay the same song again
      const song = pq.queue[pq.queueIndex];
      if (song) engine.loadAndPlay(song);
      return;
    }

    pq.markPlayed(pq.queueIndex);
    const nextIdx = pq.getNextIndex(pq.queueIndex, pq.queue.length);

    if (nextIdx !== null) {
      pq.setQueueIndex(nextIdx);
      engine.loadAndPlay(pq.queue[nextIdx]);
    }
    // If null, playback simply stops (isPlaying will become false via the audio element)
  }, [pq.queue, pq.queueIndex, pq.repeatMode, pq.getNextIndex]);

  const engine = useAudioEngine({ onEnded: handleEnded });

  // --- Composed actions ---

  const playSong = useCallback(
    (song: Song) => {
      pq.setQueue([song]);
      pq.setQueueIndex(0);
      pq.setCurrentPlaylistId(null);
      pq.resetPlayed();
      engine.loadAndPlay(song);
    },
    [engine.loadAndPlay]
  );

  const playQueueFn = useCallback(
    (songs: Song[], startIndex = 0, playlistId?: string) => {
      pq.setQueue(songs);
      pq.setQueueIndex(startIndex);
      pq.setCurrentPlaylistId(playlistId || null);
      pq.resetPlayed();
      if (songs[startIndex]) engine.loadAndPlay(songs[startIndex]);
    },
    [engine.loadAndPlay]
  );

  const nextTrack = useCallback(() => {
    engine.updatePlayDuration();
    pq.markPlayed(pq.queueIndex);
    const nextIdx = pq.getNextIndex(pq.queueIndex, pq.queue.length);
    if (nextIdx !== null) {
      pq.setQueueIndex(nextIdx);
      engine.loadAndPlay(pq.queue[nextIdx]);
    }
  }, [pq.queueIndex, pq.queue, pq.getNextIndex, engine.updatePlayDuration, engine.loadAndPlay]);

  const prevTrack = useCallback(() => {
    if (engine.currentTime > 3) {
      engine.seek(0);
      return;
    }
    engine.updatePlayDuration();
    const prevIdx = pq.queueIndex - 1;
    if (prevIdx >= 0) {
      pq.setQueueIndex(prevIdx);
      engine.loadAndPlay(pq.queue[prevIdx]);
    }
  }, [pq.queueIndex, pq.queue, engine.currentTime, engine.updatePlayDuration, engine.loadAndPlay, engine.seek]);

  // --- Schedule auto-play engine ---
  useEffect(() => {
    if (!pq.scheduleMode) return;

    const checkSchedule = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!profile) return;

        const now = new Date();
        const dayOfWeek = now.getDay();
        const currentTime = now.toTimeString().slice(0, 5);

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
        if (scheduledPlaylistId === pq.currentPlaylistId) return;

        const { data: playlistSongs } = await supabase
          .from("playlist_songs")
          .select("song:songs(*)")
          .eq("playlist_id", scheduledPlaylistId)
          .order("position");

        if (!playlistSongs || playlistSongs.length === 0) return;

        const songs = playlistSongs
          .map((ps) => ps.song)
          .filter((s): s is Song => s !== null);

        if (songs.length > 0) {
          playQueueFn(songs, 0, scheduledPlaylistId);
        }
      } catch (err) {
        console.error("Schedule check failed:", err);
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 60000);
    return () => clearInterval(interval);
  }, [pq.scheduleMode, pq.currentPlaylistId, playQueueFn]);

  return (
    <PlayerContext.Provider
      value={{
        currentSong: engine.currentSong,
        queue: pq.queue,
        isPlaying: engine.isPlaying,
        currentTime: engine.currentTime,
        duration: engine.duration,
        volume: engine.volume,
        shuffle: pq.shuffle,
        repeatMode: pq.repeatMode,
        scheduleMode: pq.scheduleMode,
        currentPlaylistId: pq.currentPlaylistId,
        playSong,
        playQueue: playQueueFn,
        togglePlay: engine.togglePlay,
        nextTrack,
        prevTrack,
        seek: engine.seek,
        setVolume: engine.setVolume,
        setShuffle: pq.setShuffle,
        setRepeatMode: pq.setRepeatMode,
        setScheduleMode: pq.setScheduleMode,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
