import { motion } from "framer-motion";
import { Play, Pause, Music2, Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeaturedTrack {
  id: string;
  title: string;
  artist: string;
  genre: string | null;
  mood: string | null;
  file_url: string;
  cover_url: string | null;
  bpm: number | null;
}

interface FeaturedSettings {
  song_ids: string[];
  label: string;
  updated_at?: string;
}

const FALLBACK_TRACKS = [
  { title: "Morning Coffee", description: "Smooth jazz and bossa nova", gradient: "from-amber-500/20 to-orange-600/20", accentColor: "text-amber-400" },
  { title: "Lunch Hour", description: "Relaxed contemporary pop", gradient: "from-blue-500/20 to-cyan-600/20", accentColor: "text-blue-400" },
  { title: "Happy Hour", description: "Electronic and melodic house", gradient: "from-purple-500/20 to-pink-600/20", accentColor: "text-purple-400" },
  { title: "Romantic Dinner", description: "Acoustic classics and soul", gradient: "from-rose-500/20 to-red-600/20", accentColor: "text-rose-400" },
];

const GRADIENTS = [
  "from-amber-500/20 to-orange-600/20",
  "from-blue-500/20 to-cyan-600/20",
  "from-purple-500/20 to-pink-600/20",
  "from-rose-500/20 to-red-600/20",
  "from-emerald-500/20 to-teal-600/20",
  "from-indigo-500/20 to-violet-600/20",
];

const ACCENT_COLORS = [
  "text-amber-400", "text-blue-400", "text-purple-400",
  "text-rose-400", "text-emerald-400", "text-indigo-400",
];

export function ShowcaseSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tracks, setTracks] = useState<FeaturedTrack[]>([]);
  const [label, setLabel] = useState("Playlists for every moment");
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const { data: settings } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "featured_tracks")
          .maybeSingle();

        if (!settings?.value) {
          setLoading(false);
          return;
        }

        const featured = settings.value as unknown as FeaturedSettings;
        if (!featured.song_ids || featured.song_ids.length === 0) {
          setLoading(false);
          return;
        }

        if (featured.label) setLabel(featured.label);

        const { data: songs } = await supabase
          .from("songs")
          .select("id, title, artist, genre, mood, file_url, cover_url, bpm")
          .in("id", featured.song_ids);

        if (songs && songs.length > 0) {
          // Maintain order from featured.song_ids
          const songMap = new Map(songs.map(s => [s.id, s]));
          const ordered = featured.song_ids
            .map(id => songMap.get(id))
            .filter(Boolean) as FeaturedTrack[];
          setTracks(ordered);
        }
      } catch (e) {
        console.error("Failed to fetch featured tracks:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchFeatured();
  }, []);

  const handlePlay = (index: number, fileUrl: string) => {
    if (activeIndex === index) {
      audioRef.current?.pause();
      audioRef.current = null;
      setActiveIndex(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(fileUrl);
    audio.volume = 0.3;
    audio.play().catch(() => {});
    audio.addEventListener("ended", () => setActiveIndex(null));
    audioRef.current = audio;
    setActiveIndex(index);
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // Fallback to static cards if no featured tracks
  if (loading) return null;

  if (tracks.length === 0) {
    return (
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Playlists for every moment</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Smart scheduling that adapts to the rhythm of your business</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FALLBACK_TRACKS.map((playlist, i) => (
              <motion.div key={i} className="relative group rounded-2xl overflow-hidden cursor-pointer" initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: i * 0.1, type: "spring", stiffness: 100, damping: 15 }} whileHover={{ y: -10 }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${playlist.gradient}`} />
                <div className="absolute inset-0 bg-card/40 backdrop-blur-sm" />
                <div className="relative p-6 h-64 flex flex-col justify-between">
                  <div>
                    <h3 className={`text-xl font-bold mb-1 ${playlist.accentColor}`}>{playlist.title}</h3>
                    <p className="text-sm text-muted-foreground">{playlist.description}</p>
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {[...Array(12)].map((_, j) => (
                      <motion.div key={j} className="w-1.5 rounded-full bg-muted-foreground/30" style={{ height: 8 }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
          <motion.div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Curated by AI</span>
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{label}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Fresh tracks picked by our AI — discover what's playing now</p>
        </motion.div>

        <div className={`grid md:grid-cols-2 ${tracks.length > 2 ? "lg:grid-cols-" + Math.min(tracks.length, 4) : ""} gap-6`}>
          {tracks.map((track, i) => (
            <motion.div
              key={track.id}
              className={`relative group rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ${
                activeIndex === i ? "scale-105 z-10" : "hover:scale-102"
              }`}
              initial={{ opacity: 0, y: 60, rotateX: 10 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 100, damping: 15 }}
              whileHover={{ y: -10 }}
              onClick={() => handlePlay(i, track.file_url)}
            >
              {track.cover_url ? (
                <img src={track.cover_url} alt={track.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`} />
              )}
              <div className="absolute inset-0 bg-card/50 backdrop-blur-sm" />

              <div className="relative p-6 h-64 flex flex-col justify-between">
                <div>
                  <h3 className={`text-xl font-bold mb-1 ${ACCENT_COLORS[i % ACCENT_COLORS.length]}`}>
                    {track.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{track.artist}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {track.genre && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{track.genre}</span>
                    )}
                    {track.mood && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{track.mood}</span>
                    )}
                    {track.bpm && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground flex items-center gap-0.5">
                        <Music2 className="h-2.5 w-2.5" />{track.bpm}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-end gap-1 h-16">
                  {[...Array(12)].map((_, j) => (
                    <motion.div
                      key={j}
                      className={`w-1.5 rounded-full ${activeIndex === i ? "bg-primary" : "bg-muted-foreground/30"}`}
                      animate={activeIndex === i ? { height: [8, 20 + Math.random() * 40, 8] } : { height: 8 }}
                      transition={{ duration: 0.5 + Math.random() * 0.3, repeat: activeIndex === i ? Infinity : 0, delay: j * 0.05 }}
                    />
                  ))}
                </div>

                <motion.div
                  className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {activeIndex === i ? (
                    <Pause className="h-5 w-5 text-primary-foreground" />
                  ) : (
                    <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
                  )}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
