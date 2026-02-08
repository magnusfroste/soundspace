import { ListMusic } from "lucide-react";

export default function AdminPlaylists() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ListMusic className="h-6 w-6 text-primary" />
        Gerenciar Playlists
      </h1>

      <div className="glass rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">Gestão de Playlists</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Crie, edite e organize playlists. Associe músicas e defina categorias. Em desenvolvimento.
        </p>
      </div>
    </div>
  );
}
