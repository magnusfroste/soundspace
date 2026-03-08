import { LayoutDashboard, Users, ListMusic, TrendingUp, Music, Play, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [songsRes, playlistsRes, usersRes, playsRes] = await Promise.all([
        supabase.from("songs").select("id", { count: "exact", head: true }),
        supabase.from("playlists").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("play_logs").select("id", { count: "exact", head: true }),
      ]);

      return {
        songs: songsRes.count ?? 0,
        playlists: playlistsRes.count ?? 0,
        users: usersRes.count ?? 0,
        totalPlays: playsRes.count ?? 0,
      };
    },
  });

  const { data: topSongs } = useQuery({
    queryKey: ["admin-top-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("play_logs")
        .select("song_id, songs(title, artist)")
        .limit(1000);

      if (error) throw error;

      const counts: Record<string, { title: string; artist: string; plays: number }> = {};
      data?.forEach((log) => {
        const songId = log.song_id;
        const song = log.songs as { title: string; artist: string } | null;
        if (song) {
          if (!counts[songId]) {
            counts[songId] = { title: song.title, artist: song.artist, plays: 0 };
          }
          counts[songId].plays++;
        }
      });

      return Object.values(counts)
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 6);
    },
  });

  const { data: topPlaylists } = useQuery({
    queryKey: ["admin-top-playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, title, cover_image_url, playlist_songs(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data
        ?.map((pl) => ({
          id: pl.id,
          title: pl.title,
          cover: pl.cover_image_url,
          songCount: pl.playlist_songs?.[0]?.count ?? 0,
        }))
        .sort((a, b) => b.songCount - a.songCount)
        .slice(0, 5);
    },
  });

  const { data: genreData } = useQuery({
    queryKey: ["admin-genre-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("songs").select("genre");
      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((song) => {
        const genre = song.genre || "Unknown";
        counts[genre] = (counts[genre] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    },
  });

  const statCards = [
    { label: "Active Users", value: stats?.users ?? "—", icon: Users, color: "text-primary" },
    { label: "Total Playlists", value: stats?.playlists ?? "—", icon: ListMusic, color: "text-accent" },
    { label: "Songs in Library", value: stats?.songs ?? "—", icon: Music, color: "text-primary" },
    { label: "Total Plays", value: stats?.totalPlays ?? "—", icon: Play, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        Analytics Dashboard
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              <span className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Songs Chart */}
        <div className="glass rounded-xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Most Played Songs
          </h2>
          {topSongs && topSongs.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topSongs} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="title"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  width={55}
                  tickFormatter={(v) => (v.length > 10 ? v.slice(0, 10) + "…" : v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No plays yet. Data will appear as users listen to music.</p>
              </div>
            </div>
          )}
        </div>

        {/* Genre Distribution */}
        <div className="glass rounded-xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <Music className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Songs by Genre
          </h2>
          {genreData && genreData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={200} className="sm:max-w-[50%]">
                <PieChart>
                  <Pie
                    data={genreData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={35}
                  >
                    {genreData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 w-full sm:w-auto">
                {genreData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ background: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                    <span className="ml-auto font-medium shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No genre data available
            </div>
          )}
        </div>
      </div>

      {/* Top Playlists */}
      <div className="glass rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
          <ListMusic className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Top Playlists
        </h2>
        {topPlaylists && topPlaylists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {topPlaylists.map((pl, index) => (
              <div key={pl.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className="text-xl sm:text-2xl font-bold text-muted-foreground w-5 sm:w-6 shrink-0">
                  {index + 1}
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                  {pl.cover ? (
                    <img src={pl.cover} alt={pl.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Music className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">{pl.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {pl.songCount} songs
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No playlists available.</p>
        )}
      </div>
    </div>
  );
}
