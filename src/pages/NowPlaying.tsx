import { usePlayer } from "@/contexts/PlayerContext";
import { Music, Radio } from "lucide-react";

export default function NowPlaying() {
  const { currentSong, queue, isPlaying } = usePlayer();

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
        <Radio className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        Now Playing
      </h1>

      {currentSong ? (
        <div className="glass rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center">
          <div className="h-40 w-40 sm:h-48 sm:w-48 rounded-2xl bg-muted flex items-center justify-center overflow-hidden mb-4 sm:mb-6">
            {currentSong.cover_url ? (
              <img src={currentSong.cover_url} alt={currentSong.title} className="h-full w-full object-cover" />
            ) : (
              <Music className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground" />
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">{currentSong.title}</h2>
          <p className="text-muted-foreground mt-1">{currentSong.artist}</p>
          {currentSong.genre && (
            <span className="mt-3 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
              {currentSong.genre}
            </span>
          )}
          {isPlaying && (
            <div className="flex items-center gap-1 mt-4">
              <span className="w-1 h-4 bg-primary rounded-full animate-pulse" />
              <span className="w-1 h-6 bg-primary rounded-full animate-pulse delay-75" />
              <span className="w-1 h-3 bg-primary rounded-full animate-pulse delay-150" />
              <span className="w-1 h-5 bg-primary rounded-full animate-pulse delay-100" />
            </div>
          )}

          {queue.length > 1 && (
            <div className="mt-6 sm:mt-8 w-full max-w-md">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Queue ({queue.length} songs)</h3>
              <div className="space-y-1 max-h-[40vh] overflow-auto">
                {queue.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                      s.id === currentSong.id ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span className="w-6 text-center shrink-0">{i + 1}</span>
                    <span className="truncate flex-1">{s.title}</span>
                    <span className="text-xs shrink-0 hidden sm:inline">{s.artist}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-2xl p-8 sm:p-12 text-center">
          <Music className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl font-semibold mb-2">Nothing playing</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Choose a playlist to get started.</p>
        </div>
      )}
    </div>
  );
}
