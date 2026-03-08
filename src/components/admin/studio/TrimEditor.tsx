import { useState, useRef, useEffect, useCallback } from "react";
import { Scissors, Play, Pause, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TrimEditorProps {
  audioUrl: string;
  onTrimmed: (newUrl: string) => void;
  onCancel: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function TrimEditor({ audioUrl, onTrimmed, onCancel }: TrimEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const regionsRef = useRef<any>(null);
  const activeRegionRef = useRef<any>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [duration, setDuration] = useState(0);
  const [regionStart, setRegionStart] = useState(0);
  const [regionEnd, setRegionEnd] = useState(0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);

  // Initialize wavesurfer
  useEffect(() => {
    let ws: any = null;
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;

      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (await import("wavesurfer.js/dist/plugins/regions.esm.js")).default;

      if (cancelled) return;

      const regions = RegionsPlugin.create();
      regionsRef.current = regions;

      ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "hsl(var(--muted-foreground) / 0.3)",
        progressColor: "hsl(var(--primary))",
        cursorColor: "hsl(var(--primary))",
        cursorWidth: 2,
        height: 96,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        plugins: [regions],
      });

      wavesurferRef.current = ws;

      ws.on("ready", () => {
        if (cancelled) return;
        const dur = ws.getDuration();
        setDuration(dur);
        setRegionStart(0);
        setRegionEnd(dur);

        const region = regions.addRegion({
          start: 0,
          end: dur,
          color: "hsl(var(--primary) / 0.15)",
          drag: false,
          resize: true,
        });
        activeRegionRef.current = region;

        region.on("update-end", () => {
          setRegionStart(region.start);
          setRegionEnd(region.end);
        });

        setIsReady(true);
      });

      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => setIsPlaying(false));

      ws.load(audioUrl);
    }

    init();

    return () => {
      cancelled = true;
      if (ws) {
        ws.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    const region = activeRegionRef.current;
    if (!ws || !region) return;

    if (isPlaying) {
      ws.pause();
    } else {
      region.play();
    }
  }, [isPlaying]);

  const resetRegion = useCallback(() => {
    const region = activeRegionRef.current;
    if (!region) return;
    region.setOptions({ start: 0, end: duration });
    setRegionStart(0);
    setRegionEnd(duration);
    setFadeIn(0);
    setFadeOut(0);
  }, [duration]);

  const trimmedDuration = regionEnd - regionStart;
  const maxFade = Math.floor(trimmedDuration / 2 * 10) / 10; // max half of selection

  const handleTrim = useCallback(async () => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    setIsTrimming(true);

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();

      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(regionStart * sampleRate);
      const endSample = Math.floor(regionEnd * sampleRate);
      const newLength = endSample - startSample;

      if (newLength <= 0) {
        toast.error("Selected region is too short");
        setIsTrimming(false);
        return;
      }

      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        sampleRate
      );

      const fadeInSamples = Math.floor(fadeIn * sampleRate);
      const fadeOutSamples = Math.floor(fadeOut * sampleRate);

      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const sourceData = audioBuffer.getChannelData(ch);
        const targetData = trimmedBuffer.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
          let gain = 1;

          // Apply fade in (equal-power / cosine curve)
          if (fadeInSamples > 0 && i < fadeInSamples) {
            gain = Math.sin((i / fadeInSamples) * Math.PI * 0.5);
          }

          // Apply fade out
          if (fadeOutSamples > 0 && i >= newLength - fadeOutSamples) {
            const fadePos = (newLength - 1 - i) / fadeOutSamples;
            gain *= Math.sin(fadePos * Math.PI * 0.5);
          }

          targetData[i] = sourceData[startSample + i] * gain;
        }
      }

      const mp3Blob = await audioBufferToMp3(trimmedBuffer);

      const fileName = `ai-gen/trimmed-${crypto.randomUUID()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, mp3Blob, { contentType: "audio/mpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("songs")
        .getPublicUrl(fileName);

      await audioContext.close();

      const parts: string[] = [];
      parts.push(`Trimmed to ${formatTime(trimmedDuration)}`);
      if (fadeIn > 0) parts.push(`fade in ${fadeIn}s`);
      if (fadeOut > 0) parts.push(`fade out ${fadeOut}s`);
      toast.success(parts.join(" · "));

      onTrimmed(urlData.publicUrl);
    } catch (err: any) {
      console.error("Trim error:", err);
      toast.error(err.message || "Failed to trim audio");
    } finally {
      setIsTrimming(false);
    }
  }, [audioUrl, regionStart, regionEnd, fadeIn, fadeOut, trimmedDuration, onTrimmed]);

  const removedDuration = duration - trimmedDuration;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Trim Editor</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag the edges of the highlighted region to select the part you want to keep.
      </p>

      {/* Waveform container */}
      <div className="relative rounded-md border bg-muted/20 p-2">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-md">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Time info */}
      {isReady && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Selection: <span className="font-mono text-foreground">{formatTime(regionStart)}</span>
            {" → "}
            <span className="font-mono text-foreground">{formatTime(regionEnd)}</span>
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">
              {formatTime(trimmedDuration)} kept
            </Badge>
            {removedDuration > 0.5 && (
              <Badge variant="outline" className="text-xs font-mono text-destructive">
                −{formatTime(removedDuration)}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Fade controls */}
      {isReady && (
        <div className="grid grid-cols-2 gap-4 p-3 rounded-md border bg-muted/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Fade In</Label>
              <span className="text-xs font-mono text-muted-foreground">{fadeIn.toFixed(1)}s</span>
            </div>
            <Slider
              value={[fadeIn]}
              onValueChange={([v]) => setFadeIn(Math.round(v * 10) / 10)}
              min={0}
              max={Math.min(maxFade, 10)}
              step={0.1}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Fade Out</Label>
              <span className="text-xs font-mono text-muted-foreground">{fadeOut.toFixed(1)}s</span>
            </div>
            <Slider
              value={[fadeOut]}
              onValueChange={([v]) => setFadeOut(Math.round(v * 10) / 10)}
              min={0}
              max={Math.min(maxFade, 10)}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={togglePlay}
          disabled={!isReady}
        >
          {isPlaying ? (
            <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</>
          ) : (
            <><Play className="h-3.5 w-3.5 mr-1" /> Preview</>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={resetRegion}
          disabled={!isReady || isTrimming}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>

        <div className="flex-1" />

        <Button
          size="sm"
          onClick={handleTrim}
          disabled={!isReady || isTrimming || (removedDuration < 0.1 && fadeIn === 0 && fadeOut === 0)}
        >
          {isTrimming ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Processing...</>
          ) : (
            <><Check className="h-3.5 w-3.5 mr-1" /> Apply</>
          )}
        </Button>
      </div>
    </div>
  );
}

/** Encode an AudioBuffer to an MP3 Blob using lamejs. */
async function audioBufferToMp3(buffer: AudioBuffer): Promise<Blob> {
  const lamejs = await import("lamejs");
  const Mp3Encoder = (lamejs as any).default?.Mp3Encoder ?? (lamejs as any).Mp3Encoder;

  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const kbps = 192;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);

  const blockSize = 1152;
  const mp3Data: Int8Array[] = [];

  // Convert float32 to int16
  const toInt16 = (float32: Float32Array): Int16Array => {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  };

  const left = toInt16(buffer.getChannelData(0));
  const right = numChannels > 1 ? toInt16(buffer.getChannelData(1)) : left;

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
  }

  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(new Int8Array(end));

  return new Blob(mp3Data, { type: "audio/mpeg" });
}
