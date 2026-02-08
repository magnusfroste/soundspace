import { Upload, Music } from "lucide-react";

export default function AdminIngestion() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Upload className="h-6 w-6 text-primary" />
        Ingestão de Músicas
      </h1>

      <div className="glass rounded-xl p-8 text-center">
        <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Music className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Motor de Ingestão</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Interface para upload de MP3s para o armazenamento, edição de metadados (título, artista, gênero, humor, BPM) e associação a playlists. Em desenvolvimento.
        </p>
      </div>
    </div>
  );
}
