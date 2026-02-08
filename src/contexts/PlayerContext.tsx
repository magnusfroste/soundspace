import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Song = Tables<"songs">;

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playSong: (song: Song) => void;
  playQueue: (songs: Song[], startIndex?: number) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
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

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.8;
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("durationchange", () => setDuration(audio.duration || 0));
    audio.addEventListener("ended", () => handleEnded());
    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  const handleEnded = useCallback(() => {
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
  }, [queue]);

  // Update ended handler when queue changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handler = () => handleEnded();
    audio.removeEventListener("ended", handler);
    audio.addEventListener("ended", handler);
    return () => audio.removeEventListener("ended", handler);
  }, [handleEnded]);

  function loadAndPlay(song: Song) {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentSong(song);
    audio.src = song.file_url;
    audio.play().catch(() => {});
  }

  const playSong = useCallback((song: Song) => {
    setQueue([song]);
    setQueueIndex(0);
    loadAndPlay(song);
  }, []);

  const playQueue = useCallback((songs: Song[], startIndex = 0) => {
    setQueue(songs);
    setQueueIndex(startIndex);
    if (songs[startIndex]) loadAndPlay(songs[startIndex]);
  }, []);

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
    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      setQueueIndex(nextIdx);
      loadAndPlay(queue[nextIdx]);
    }
  }, [queueIndex, queue]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) {
      setQueueIndex(prevIdx);
      loadAndPlay(queue[prevIdx]);
    }
  }, [queueIndex, queue]);

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
        playSong, playQueue, togglePlay, nextTrack, prevTrack, seek, setVolume,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
