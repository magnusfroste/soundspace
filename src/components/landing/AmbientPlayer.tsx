import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Music, Volume2 } from "lucide-react";
import { useLandingAudio } from "@/hooks/useLandingAudio";
import { useEffect, useRef } from "react";

export function AmbientPlayer() {
  const { 
    isPlaying, 
    isEnabled, 
    isLoading,
    currentSong, 
    hasTriggered,
    triggerPlay, 
    togglePlay 
  } = useLandingAudio();

  const hasScrolledRef = useRef(false);

  // Scroll trigger
  useEffect(() => {
    if (!isEnabled || isLoading) return;

    const handleScroll = () => {
      // Trigger when user scrolls past 100px
      if (window.scrollY > 100 && !hasScrolledRef.current) {
        hasScrolledRef.current = true;
        triggerPlay();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isEnabled, isLoading, triggerPlay]);

  // Don't render if disabled or loading
  if (!isEnabled || isLoading) return null;

  return (
    <AnimatePresence>
      {hasTriggered && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="glass rounded-full px-4 py-3 flex items-center gap-3 shadow-lg border border-border/50">
            {/* Play/Pause button */}
            <button
              onClick={togglePlay}
              className="h-10 w-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 text-primary-foreground" />
              ) : (
                <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
              )}
            </button>

            {/* Song info */}
            <div className="flex flex-col min-w-0 max-w-[180px]">
              <div className="flex items-center gap-1.5">
                <Volume2 className="h-3 w-3 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">Now Playing</span>
              </div>
              {currentSong ? (
                <span className="text-sm font-medium truncate">
                  {currentSong.title}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Ambient Music
                </span>
              )}
            </div>

            {/* Music icon with animation */}
            {isPlaying && (
              <div className="flex items-center gap-0.5 h-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-primary rounded-full"
                    animate={{
                      height: ["8px", "16px", "8px"],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
