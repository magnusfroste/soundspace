import { Settings } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        Integrações
      </h1>

      <div className="glass rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">Gerenciamento de APIs</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Gerencie chaves de API para fontes externas de músicas royalty-free. Em desenvolvimento.
        </p>
      </div>
    </div>
  );
}
