import { useState, useCallback } from "react";

export interface AudioAnalysis {
  duration: number;
  waveform: number[];
}

export function useAudioAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeAudio = useCallback(async (file: File): Promise<AudioAnalysis | null> => {
    setIsAnalyzing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const duration = audioBuffer.duration;
      
      // Generate waveform data (downsample to ~100 points)
      const channelData = audioBuffer.getChannelData(0);
      const samples = 100;
      const blockSize = Math.floor(channelData.length / samples);
      const waveform: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        const start = i * blockSize;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[start + j] || 0);
        }
        // Normalize to 0-1 range
        waveform.push(sum / blockSize);
      }
      
      // Normalize waveform to max = 1
      const max = Math.max(...waveform, 0.01);
      const normalizedWaveform = waveform.map((v) => v / max);
      
      await audioContext.close();
      
      return { duration, waveform: normalizedWaveform };
    } catch (error) {
      console.error("Audio analysis failed:", error);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { analyzeAudio, isAnalyzing };
}
