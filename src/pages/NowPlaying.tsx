import { usePlayer } from "@/contexts/PlayerContext";
import { Music, Radio, Shuffle, Repeat, Repeat1 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NowPlaying() {
  const { currentSong, queue, isPlaying, shuffle, repeatMode, setShuffle, setRepeatMode } = usePlayer();

  const cycleRepeatMode = () => {
    if (repeatMode === "off") setRepeatMode("all");
    else if (repeatMode === "all") setRepeatMode("one");
    else setRepeatMode("off");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
        <Radio className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        Now Playing
      </h1>

      {currentSong ? (
        <div className="glass rounded-2xl p-4 sm:p-8 flex flex-col items-center text-center">
          <div className="h-32 w-32 sm:h-48 sm:w-48 rounded-2xl bg-muted flex items-center justify-center overflow-hidden mb-3 sm:mb-6">
            {currentSong.cover_url ? (
              <img src={currentSong.cover_url} alt={currentSong.title} className="h-full w-full object-cover" />
            ) : (
              <Music className="h-12 w-12 sm:h-20 sm:w-20 text-muted-foreground" />
            )}
          </div>
          <h2 className="text-lg sm:text-2xl font-bold">{currentSong.title}</h2>
          <p className="text-muted-foreground text-sm mt-1">{currentSong.artist}</p>

          {/* Status row: genre + shuffle/repeat indicators */}
          <div className="flex items-center gap-2 mt-3">
            {currentSong.genre && (
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
                {currentSong.genre}
              </span>
            )}
            <button
              onClick={() => setShuffle(!shuffle)}
              className={cn("p-1.5 rounded-full transition-colors", shuffle ? "text-primary bg-primary/10" : "text-muted-foreground")}
              aria-label="Shuffle"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={cycleRepeatMode}
              className={cn("p-1.5 rounded-full transition-colors", repeatMode !== "off" ? "text-primary bg-primary/10" : "text-muted-foreground")}
              aria-label="Repeat"
            >
              {repeatMode === "one" ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
            </button>
          </div>

          {isPlaying && (
            <div className="flex items-center gap-1 mt-3">
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse" />
              <span className="w-1 h-6 bg-primary rounded-full animate-pulse delay-75" />
              <span className="w-1 h-3 bg-primary rounded-full animate-pulse delay-150" />
              <span className="w-1 h-5 bg-primary rounded-full animate-pulse delay-100" />
            </div>
          )}

          {queue.length > 1 && (
            <div className="mt-4 sm:mt-8 w-full max-w-md">
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">
                Queue ({queue.length} songs)
              </h3>
              <div className="space-y-0.5 max-h-[35vh] sm:max-h-[40vh] overflow-auto">
                {queue.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg text-xs sm:text-sm",
                      s.id === currentSong.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                    )}
                  >
                    <span className="w-5 sm:w-6 text-center shrink-0 text-[10px] sm:text-xs">{i + 1}</span>
                    <span className="truncate flex-1 text-left">{s.title}</span>
                    <span className="text-[10px] sm:text-xs shrink-0 hidden sm:inline">{s.artist}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-2xl p-6 sm:p-12 text-center">
          <Music className="h-10 w-10 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-3 sm:mb-4" />
          <h2 className="text-base sm:text-xl font-semibold mb-1 sm:mb-2">Nothing playing</h2>
          <p className="text-muted-foreground text-sm">Choose a playlist to get started.</p>
        </div>
      )}
    </div>
  );
}
