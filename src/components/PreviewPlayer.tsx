// Preview player: canvas yang menggambar frame memakai renderer yang sama
// dengan hasil ekspor — apa yang terlihat = hasil render.

import { useEffect, useRef, useState } from "react";

import { drawFrame, type RenderAssets } from "@/lib/engine/renderer";
import type { Composition } from "@/lib/engine/types";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw } from "lucide-react";

interface PreviewPlayerProps {
  comp: Composition;
  audioUrl?: string | null;
  videoUrl?: string | null;
  assets?: RenderAssets;
}

export function PreviewPlayer({ comp, audioUrl, videoUrl, assets }: PreviewPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef(0);
  const clockRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastUiRef = useRef(0);
  const stateRef = useRef({ comp, assets, playing: false, videoUrl, audioUrl });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  stateRef.current = { comp, assets, playing, videoUrl, audioUrl };

  const drawAt = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const video = videoRef.current;
    const videoAssets =
      video && video.readyState >= 2 && video.videoWidth > 0
        ? { video, videoWidth: video.videoWidth, videoHeight: video.videoHeight }
        : {};
    drawFrame(ctx, stateRef.current.comp, t, { ...stateRef.current.assets, ...videoAssets });
  };

  // Gambar ulang saat komposisi berubah / font siap.
  useEffect(() => {
    drawAt(time);
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) drawAt(time);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp, assets]);

  // Loop render sinkron audio (atau clock internal saat tanpa audio).
  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const audio = audioRef.current;
      const video = videoRef.current;
      let t = 0;
      const isPlaying = stateRef.current.playing;
      if (audio && audioUrl) {
        t = audio.currentTime;
        if (video && videoUrl && isPlaying && Math.abs(video.currentTime - t) > 0.12)
          video.currentTime = t;
      } else if (video && videoUrl) {
        t = video.currentTime;
        if (!isPlaying) return;
        if (video.ended || t >= stateRef.current.comp.duration) setPlaying(false);
      } else if (isPlaying) {
        const now = performance.now() / 1000;
        const dt = Math.min(0.25, now - (lastTickRef.current || now));
        lastTickRef.current = now;
        clockRef.current = Math.min(clockRef.current + dt, stateRef.current.comp.duration);
        if (clockRef.current >= stateRef.current.comp.duration) {
          setPlaying(false);
        }
        t = clockRef.current;
      } else {
        return;
      }
      drawAt(t);
      if (t - lastUiRef.current > 0.1 || t < lastUiRef.current) {
        lastUiRef.current = t;
        setTime(t);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioUrl, videoUrl]);

  const toggle = () => {
    const next = !playing;
    setPlaying(next);
    const audio = audioRef.current;
    const video = videoRef.current;
    if (audio && audioUrl) {
      if (next) {
        if (audio.ended || audio.currentTime >= comp.duration) audio.currentTime = 0;
        void audio.play();
        if (video && videoUrl) {
          if (video.ended || video.currentTime >= comp.duration) video.currentTime = 0;
          void video.play();
        }
      } else {
        audio.pause();
        video?.pause();
      }
    } else if (video && videoUrl) {
      if (next) {
        if (video.ended || video.currentTime >= comp.duration) video.currentTime = 0;
        void video.play();
      } else video.pause();
    } else if (next) {
      lastTickRef.current = 0;
      if (clockRef.current >= comp.duration) clockRef.current = 0;
    }
  };

  const seek = (t: number) => {
    const audio = audioRef.current;
    if (audio && audioUrl) audio.currentTime = t;
    const video = videoRef.current;
    if (video && videoUrl) video.currentTime = t;
    else clockRef.current = t;
    drawAt(t);
    setTime(t);
  };

  const restart = () => {
    seek(0);
  };

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-xl border-4 border-foreground/85 bg-card shadow-[6px_6px_0_0_var(--border)]">
        <canvas
          ref={canvasRef}
          width={comp.width}
          height={comp.height}
          className="block h-auto w-full"
          onClick={toggle}
        />
      </div>
      <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" className="hidden" />
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          preload="auto"
          muted={Boolean(audioUrl)}
          playsInline
          className="hidden"
          onLoadedData={() => drawAt(time)}
        />
      )}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" onClick={restart} aria-label="Ulang dari awal">
          <RotateCcw className="size-4" />
        </Button>
        <Button size="icon" onClick={toggle} aria-label={playing ? "Jeda" : "Putar"}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <input
          type="range"
          min={0}
          max={Math.max(comp.duration, 0.1)}
          step={0.05}
          value={Math.min(time, comp.duration)}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-2 flex-1 accent-[var(--primary)]"
          aria-label="Geser waktu"
        />
        <span className="w-16 text-right font-mono text-xs text-muted-foreground">
          {fmt(time)}/{fmt(comp.duration)}
        </span>
      </div>
    </div>
  );
}
