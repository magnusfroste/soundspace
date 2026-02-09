import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music, Shuffle, Repeat, Repeat1 } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const {
    currentSong, isPlaying, currentTime, duration, volume,
    shuffle, repeatMode,
    togglePlay, nextTrack, prevTrack, seek, setVolume,
    setShuffle, setRepeatMode,
  } = usePlayer();

  const cycleRepeatMode = () => {
    if (repeatMode === "off") setRepeatMode("all");
    else if (repeatMode === "all") setRepeatMode("one");
    else setRepeatMode("off");
  };

  if (!currentSong) {
    return (
      <div className="h-20 border-t border-border bg-player flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Music className="h-5 w-5" />
          <span className="text-sm">Select a song to start</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-20 border-t border-border bg-player flex items-center px-4 gap-4">
      {/* Song Info */}
      <div className="flex items-center gap-3 w-[240px] min-w-0">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {currentSong.cover_url ? (
            <img src={currentSong.cover_url} alt={currentSong.title} className="h-full w-full object-cover" />
          ) : (
            <Music className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate text-player-foreground">{currentSong.title}</p>
          <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex-1 flex flex-col items-center gap-1 max-w-[600px] mx-auto">
        <div className="flex items-center gap-3">
          {/* Shuffle Button */}
          <button
            onClick={() => setShuffle(!shuffle)}
            className={cn(
              "transition-colors p-1",
              shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            title={shuffle ? "Shuffle on" : "Shuffle off"}
          >
            <Shuffle className="h-4 w-4" />
          </button>

          <button onClick={prevTrack} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            onClick={togglePlay}
            className="h-9 w-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
            )}
          </button>
          <button onClick={nextTrack} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="h-5 w-5" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={cycleRepeatMode}
            className={cn(
              "transition-colors p-1",
              repeatMode !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            title={
              repeatMode === "off" ? "Repeat off" :
              repeatMode === "all" ? "Repeat all" : "Repeat one"
            }
          >
            {repeatMode === "one" ? (
              <Repeat1 className="h-4 w-4" />
            ) : (
              <Repeat className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={([val]) => seek(val)}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 w-[160px] justify-end">
        <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)} className="text-muted-foreground hover:text-foreground transition-colors">
          {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <Slider
          value={[volume]}
          max={1}
          step={0.01}
          onValueChange={([val]) => setVolume(val)}
          className="w-24"
        />
      </div>
    </div>
  );
}
