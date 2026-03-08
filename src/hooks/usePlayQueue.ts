import { useState, useCallback, useRef, useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";

export type Song = Tables<"songs">;
export type RepeatMode = "off" | "one" | "all";

export interface PlayQueueState {
  queue: Song[];
  queueIndex: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  scheduleMode: boolean;
  currentPlaylistId: string | null;
  playedIndicesRef: React.MutableRefObject<Set<number>>;
}

export interface PlayQueueActions {
  setQueue: (songs: Song[]) => void;
  setQueueIndex: (index: number) => void;
  setShuffle: (enabled: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setScheduleMode: (enabled: boolean) => void;
  setCurrentPlaylistId: (id: string | null) => void;
  getNextIndex: (currentIdx: number, queueLen: number) => number | null;
  markPlayed: (index: number) => void;
  resetPlayed: () => void;
}

export function usePlayQueue(): PlayQueueState & PlayQueueActions {
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>("all");
  const [scheduleMode, setScheduleModeState] = useState(false);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const playedIndicesRef = useRef<Set<number>>(new Set());

  // Load persisted settings
  useEffect(() => {
    const savedSchedule = localStorage.getItem("scheduleMode");
    if (savedSchedule === "true") setScheduleModeState(true);

    const savedShuffle = localStorage.getItem("shuffle");
    if (savedShuffle === "true") setShuffleState(true);

    const savedRepeat = localStorage.getItem("repeatMode") as RepeatMode | null;
    if (savedRepeat && ["off", "one", "all"].includes(savedRepeat)) {
      setRepeatModeState(savedRepeat);
    }
  }, []);

  const setShuffle = useCallback((enabled: boolean) => {
    setShuffleState(enabled);
    localStorage.setItem("shuffle", enabled ? "true" : "false");
    playedIndicesRef.current.clear();
  }, []);

  const setRepeatMode = useCallback((mode: RepeatMode) => {
    setRepeatModeState(mode);
    localStorage.setItem("repeatMode", mode);
  }, []);

  const setScheduleMode = useCallback((enabled: boolean) => {
    setScheduleModeState(enabled);
    localStorage.setItem("scheduleMode", enabled ? "true" : "false");
  }, []);

  const getNextIndex = useCallback(
    (currentIdx: number, queueLen: number): number | null => {
      if (shuffle) {
        const unplayed = Array.from({ length: queueLen }, (_, i) => i).filter(
          (i) => i !== currentIdx && !playedIndicesRef.current.has(i)
        );

        if (unplayed.length > 0) {
          return unplayed[Math.floor(Math.random() * unplayed.length)];
        }

        if (repeatMode === "all") {
          playedIndicesRef.current.clear();
          const available = Array.from({ length: queueLen }, (_, i) => i).filter(
            (i) => i !== currentIdx
          );
          return available.length > 0
            ? available[Math.floor(Math.random() * available.length)]
            : 0;
        }
        return null;
      }

      const nextIdx = currentIdx + 1;
      if (nextIdx < queueLen) return nextIdx;
      if (repeatMode === "all") return 0;
      return null;
    },
    [shuffle, repeatMode]
  );

  const markPlayed = useCallback((index: number) => {
    playedIndicesRef.current.add(index);
  }, []);

  const resetPlayed = useCallback(() => {
    playedIndicesRef.current.clear();
  }, []);

  return {
    queue,
    queueIndex,
    shuffle,
    repeatMode,
    scheduleMode,
    currentPlaylistId,
    playedIndicesRef,
    setQueue,
    setQueueIndex,
    setShuffle,
    setRepeatMode,
    setScheduleMode,
    setCurrentPlaylistId,
    getNextIndex,
    markPlayed,
    resetPlayed,
  };
}
