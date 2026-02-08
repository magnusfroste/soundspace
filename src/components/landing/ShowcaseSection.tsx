import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { useState, useRef } from "react";

const playlists = [
  {
    title: "Café da Manhã",
    description: "Jazz suave e bossa nova",
    gradient: "from-amber-500/20 to-orange-600/20",
    accentColor: "text-amber-400",
  },
  {
    title: "Hora do Almoço",
    description: "Pop contemporâneo relaxante",
    gradient: "from-blue-500/20 to-cyan-600/20",
    accentColor: "text-blue-400",
  },
  {
    title: "Happy Hour",
    description: "Eletrônico e house melódico",
    gradient: "from-purple-500/20 to-pink-600/20",
    accentColor: "text-purple-400",
  },
  {
    title: "Jantar Romântico",
    description: "Clássicos acústicos e MPB",
    gradient: "from-rose-500/20 to-red-600/20",
    accentColor: "text-rose-400",
  },
];

export function ShowcaseSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Playlists para cada momento
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Programação inteligente que se adapta ao ritmo do seu negócio
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {playlists.map((playlist, i) => (
            <motion.div
              key={i}
              className={`relative group rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ${
                activeIndex === i ? "scale-105 z-10" : "hover:scale-102"
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setActiveIndex(activeIndex === i ? null : i)}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${playlist.gradient}`} />
              <div className="absolute inset-0 bg-card/40 backdrop-blur-sm" />

              {/* Content */}
              <div className="relative p-6 h-64 flex flex-col justify-between">
                <div>
                  <h3 className={`text-xl font-bold mb-1 ${playlist.accentColor}`}>
                    {playlist.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {playlist.description}
                  </p>
                </div>

                {/* Equalizer animation */}
                <div className="flex items-end gap-1 h-16">
                  {[...Array(12)].map((_, j) => (
                    <motion.div
                      key={j}
                      className={`w-1.5 rounded-full ${
                        activeIndex === i ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                      animate={activeIndex === i ? {
                        height: [8, 20 + Math.random() * 40, 8],
                      } : { height: 8 }}
                      transition={{
                        duration: 0.5 + Math.random() * 0.3,
                        repeat: activeIndex === i ? Infinity : 0,
                        delay: j * 0.05,
                      }}
                    />
                  ))}
                </div>

                {/* Play button */}
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
