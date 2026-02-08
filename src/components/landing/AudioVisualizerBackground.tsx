import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export function AudioVisualizerBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Configuration
    const bars = 64;
    const barWidth = canvas.width / bars;
    let phase = 0;

    // Generate smooth noise-like values
    const generateValues = (time: number): number[] => {
      const values: number[] = [];
      for (let i = 0; i < bars; i++) {
        // Multiple sine waves for organic movement
        const wave1 = Math.sin(time * 0.001 + i * 0.15) * 0.3;
        const wave2 = Math.sin(time * 0.002 + i * 0.1 + 2) * 0.25;
        const wave3 = Math.sin(time * 0.0015 + i * 0.2 + 4) * 0.2;
        const wave4 = Math.sin(time * 0.003 + i * 0.05) * 0.15;
        
        // Center emphasis (higher bars in middle)
        const centerFactor = 1 - Math.abs(i - bars / 2) / (bars / 2) * 0.4;
        
        const value = (wave1 + wave2 + wave3 + wave4 + 0.5) * centerFactor;
        values.push(Math.max(0.05, Math.min(1, value)));
      }
      return values;
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const values = generateValues(time);
      const maxHeight = canvas.height * 0.4;

      // Draw bars from bottom
      values.forEach((value, i) => {
        const height = value * maxHeight;
        const x = i * barWidth;
        const y = canvas.height - height;

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(x, canvas.height, x, y);
        gradient.addColorStop(0, "hsla(145, 65%, 42%, 0.6)");
        gradient.addColorStop(0.5, "hsla(270, 60%, 55%, 0.4)");
        gradient.addColorStop(1, "hsla(270, 60%, 55%, 0.1)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, y, barWidth - 2, height);
      });

      // Draw mirrored bars from top (subtle)
      values.forEach((value, i) => {
        const height = value * maxHeight * 0.3;
        const x = i * barWidth;

        const gradient = ctx.createLinearGradient(x, 0, x, height);
        gradient.addColorStop(0, "hsla(145, 65%, 42%, 0.2)");
        gradient.addColorStop(1, "hsla(145, 65%, 42%, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, 0, barWidth - 2, height);
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-primary/10" />
      
      {/* Canvas visualizer */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 opacity-60"
      />

      {/* Radial glow effects */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsla(145, 65%, 42%, 0.15) 0%, transparent 70%)",
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsla(270, 60%, 55%, 0.1) 0%, transparent 60%)",
        }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Floating orbs */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-primary/40"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 3) * 20}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + i,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Horizontal scan line effect */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        animate={{
          top: ["0%", "100%"],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, hsl(0, 0%, 7%) 100%)",
        }}
      />
    </div>
  );
}
