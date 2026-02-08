import { usePlayer } from "@/contexts/PlayerContext";
import { Music, Radio } from "lucide-react";

export default function NowPlaying() {
  const { currentSong, queue, isPlaying } = usePlayer();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Radio className="h-6 w-6 text-primary" />
        Tocando Agora
      </h1>

      {currentSong ? (
        <div className="glass rounded-2xl p-8 flex flex-col items-center text-center">
          <div className="h-48 w-48 rounded-2xl bg-muted flex items-center justify-center overflow-hidden mb-6">
            {currentSong.cover_url ? (
              <img src={currentSong.cover_url} alt={currentSong.title} className="h-full w-full object-cover" />
            ) : (
              <Music className="h-20 w-20 text-muted-foreground" />
            )}
          </div>
          <h2 className="text-2xl font-bold">{currentSong.title}</h2>
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
            <div className="mt-8 w-full max-w-md">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Fila ({queue.length} músicas)</h3>
              <div className="space-y-1">
                {queue.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                      s.id === currentSong.id ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span className="w-6 text-center">{i + 1}</span>
                    <span className="truncate flex-1">{s.title}</span>
                    <span className="text-xs">{s.artist}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-2xl p-12 text-center">
          <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nada tocando</h2>
          <p className="text-muted-foreground">Escolha uma playlist para começar.</p>
        </div>
      )}
    </div>
  );
}
