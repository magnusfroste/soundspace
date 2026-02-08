import { useMemo } from "react";

interface AudioWaveformProps {
  waveform: number[];
  className?: string;
}

export function AudioWaveform({ waveform, className = "" }: AudioWaveformProps) {
  const bars = useMemo(() => {
    // Create mirrored waveform effect
    return waveform.map((value, index) => ({
      height: Math.max(value * 100, 4), // Min 4% height for visibility
      index,
    }));
  }, [waveform]);

  return (
    <div className={`flex items-center justify-center gap-[2px] h-12 ${className}`}>
      {bars.map(({ height, index }) => (
        <div
          key={index}
          className="bg-primary/60 rounded-full transition-all duration-150"
          style={{
            width: "3px",
            height: `${height}%`,
            minHeight: "2px",
          }}
        />
      ))}
    </div>
  );
}
