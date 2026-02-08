import { useEffect, useRef, useState, useCallback } from "react";

interface AudioAnalyserData {
  frequencyData: Uint8Array;
  isActive: boolean;
}

// Singleton audio analyser to share across components
let globalAnalyser: AnalyserNode | null = null;
let globalAudioContext: AudioContext | null = null;
let connectedElement: HTMLAudioElement | null = null;
const subscribers = new Set<(data: AudioAnalyserData) => void>();
let animationId: number | null = null;

function notifySubscribers() {
  if (!globalAnalyser) return;
  
  const frequencyData = new Uint8Array(globalAnalyser.frequencyBinCount);
  globalAnalyser.getByteFrequencyData(frequencyData);
  
  // Check if there's actual audio activity
  const sum = frequencyData.reduce((a, b) => a + b, 0);
  const isActive = sum > 100;
  
  subscribers.forEach(callback => callback({ frequencyData, isActive }));
  
  if (subscribers.size > 0) {
    animationId = requestAnimationFrame(notifySubscribers);
  }
}

function startAnimation() {
  if (animationId === null && subscribers.size > 0) {
    animationId = requestAnimationFrame(notifySubscribers);
  }
}

function stopAnimation() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

export function connectAudioElement(audioElement: HTMLAudioElement) {
  if (connectedElement === audioElement) return;
  
  try {
    if (!globalAudioContext) {
      globalAudioContext = new AudioContext();
    }
    
    // Resume context if suspended
    if (globalAudioContext.state === "suspended") {
      globalAudioContext.resume();
    }
    
    // Create analyser if needed
    if (!globalAnalyser) {
      globalAnalyser = globalAudioContext.createAnalyser();
      globalAnalyser.fftSize = 128;
      globalAnalyser.smoothingTimeConstant = 0.8;
    }
    
    // Connect audio element
    const source = globalAudioContext.createMediaElementSource(audioElement);
    source.connect(globalAnalyser);
    globalAnalyser.connect(globalAudioContext.destination);
    
    connectedElement = audioElement;
    console.log("Audio analyser connected");
  } catch (error) {
    console.error("Failed to connect audio analyser:", error);
  }
}

export function useAudioAnalyser(barCount: number = 64) {
  const [frequencyBars, setFrequencyBars] = useState<number[]>(() => 
    new Array(barCount).fill(0.05)
  );
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    const callback = (data: AudioAnalyserData) => {
      setIsActive(data.isActive);
      
      if (data.isActive) {
        // Downsample frequency data to bar count
        const { frequencyData } = data;
        const step = Math.floor(frequencyData.length / barCount);
        const bars: number[] = [];
        
        for (let i = 0; i < barCount; i++) {
          // Average nearby frequencies for smoother visualization
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += frequencyData[i * step + j] || 0;
          }
          // Normalize to 0-1 range
          bars.push(Math.min(1, (sum / step) / 255));
        }
        
        setFrequencyBars(bars);
      }
    };
    
    subscribers.add(callback);
    startAnimation();
    
    return () => {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        stopAnimation();
      }
    };
  }, [barCount]);
  
  return { frequencyBars, isActive };
}
