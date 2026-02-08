import { LayoutDashboard, Users, ListMusic, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const stats = [
    { label: "Usuários Ativos", value: "—", icon: Users, color: "text-primary" },
    { label: "Total de Playlists", value: "—", icon: ListMusic, color: "text-accent" },
    { label: "Músicas no Acervo", value: "—", icon: TrendingUp, color: "text-primary" },
    { label: "Reproduções Hoje", value: "—", icon: LayoutDashboard, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        Dashboard Admin
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Playlists Mais Populares</h2>
        <p className="text-muted-foreground text-sm">Os dados de analytics serão populados em uma fase futura.</p>
      </div>
    </div>
  );
}
