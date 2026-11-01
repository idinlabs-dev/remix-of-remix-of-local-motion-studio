// Ekspor video: render frame demi frame di device, encode WebCodecs, mux
// mediabunny jadi MP4 (H.264+AAC) atau fallback WebM (VP9+Opus).

import {
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo,
  Mp4OutputFormat,
  Output,
  VideoSample,
  VideoSampleSource,
  WebMOutputFormat,
  type AudioCodec,
  type VideoCodec,
} from "mediabunny";

import { drawFrame, type RenderAssets } from "@/lib/engine/renderer";
import type { Composition } from "@/lib/engine/types";

export type ContainerKind = "mp4" | "webm";

export interface EncodeProfile {
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  container: ContainerKind;
  mime: string;
  ext: string;
}

/**
 * Pemilihan profil dari hasil dukungan codec — fungsi murni supaya bisa diuji.
 * Aturannya: H.264+AAC (MP4) lebih diutamakan; kalau tidak didukung device,
 * pakai VP9+Opus (WebM).
 */
export function pickProfileFromSupport(support: {
  avc: boolean;
  aac: boolean;
  vp9: boolean;
  opus: boolean;
}): EncodeProfile | null {
  if (support.avc && support.aac) {
    return {
      videoCodec: "avc",
      audioCodec: "aac",
      container: "mp4",
      mime: "video/mp4",
      ext: "mp4",
    };
  }
  if (support.vp9 && support.opus) {
    return {
      videoCodec: "vp9",
      audioCodec: "opus",
      container: "webm",
      mime: "video/webm",
      ext: "webm",
    };
  }
  return null;
}

export async function chooseEncodeProfile(): Promise<EncodeProfile | null> {
  const [avc, aac, vp9, opus] = await Promise.all([
    canEncodeVideo("avc"),
    canEncodeAudio("aac"),
    canEncodeVideo("vp9"),
    canEncodeAudio("opus"),
  ]);
  return pickProfileFromSupport({ avc, aac, vp9, opus });
}

export interface RenderProgress {
  phase: "preparing" | "video" | "audio" | "finalizing" | "done";
  frame: number;
  totalFrames: number;
}

export interface RenderResult {
  blob: Blob;
  profile: EncodeProfile;
  durationSec: number;
}

const VIDEO_BITRATE = 6_000_000;
const AUDIO_BITRATE = 128_000;

export interface RenderOptions {
  comp: Composition;
  assets: RenderAssets;
  audio?: AudioBuffer | null;
  onProgress?: (p: RenderProgress) => void;
  signal?: AbortSignal;
}

/** Render komposisi + audio jadi file video di browser. */
export async function renderComposition(options: RenderOptions): Promise<RenderResult> {
  const { comp, assets, audio, onProgress, signal } = options;
  const profile = await chooseEncodeProfile();
  if (!profile) {
    throw new Error(
      "Browser ini tidak mendukung encode video (WebCodecs). Coba Chrome atau Edge versi baru.",
    );
  }
  onProgress?.({ phase: "preparing", frame: 0, totalFrames: 0 });

  const fps = comp.fps;
  const totalFrames = Math.max(1, Math.round(comp.duration * fps));

  const output = new Output({
    format:
      profile.container === "mp4"
        ? new Mp4OutputFormat({ fastStart: "in-memory" })
        : new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(comp.width, comp.height)
      : Object.assign(document.createElement("canvas"), { width: comp.width, height: comp.height });
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Tidak bisa membuat canvas render.");

  const videoSource = new VideoSampleSource({
    codec: profile.videoCodec,
    bitrate: VIDEO_BITRATE,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioSampleSource | null = null;
  if (audio) {
    audioSource = new AudioSampleSource({ codec: profile.audioCodec, bitrate: AUDIO_BITRATE });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  const chunk = 0.5; // detik per sampel audio
  const totalAudioChunks = audio ? Math.ceil(audio.duration / chunk) : 0;

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) throw new DOMException("Render dibatalkan", "AbortError");
      const t = frame / fps;
      drawFrame(ctx, comp, t, assets);
      const sample = new VideoSample(canvas as unknown as CanvasImageSource, {
        timestamp: t,
        duration: 1 / fps,
      });
      await videoSource.add(sample);
      sample.close();
      if (frame % 6 === 0) {
        onProgress?.({ phase: "video", frame, totalFrames });
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    onProgress?.({ phase: "video", frame: totalFrames, totalFrames });

    if (audio && audioSource) {
      const channels = Math.min(2, audio.numberOfChannels);
      const sampleRate = audio.sampleRate;
      for (let i = 0; i < totalAudioChunks; i++) {
        if (signal?.aborted) throw new DOMException("Render dibatalkan", "AbortError");
        const start = Math.floor(i * chunk * sampleRate);
        const end = Math.min(audio.length, Math.floor((i + 1) * chunk * sampleRate));
        const frames = end - start;
        if (frames <= 0) break;
        // f32-planar: semua plane diratakan dalam satu buffer.
        const data = new Float32Array(frames * channels);
        for (let c = 0; c < channels; c++) {
          const src = audio.getChannelData(Math.min(c, audio.numberOfChannels - 1));
          data.set(src.subarray(start, end), c * frames);
        }
        const audioSample = new AudioSample({
          data,
          format: "f32-planar",
          numberOfChannels: channels,
          sampleRate,
          timestamp: start / sampleRate,
        });
        await audioSource.add(audioSample);
        audioSample.close();
        if (i % 8 === 0) {
          onProgress?.({ phase: "audio", frame: i, totalFrames: totalAudioChunks });
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      onProgress?.({ phase: "audio", frame: totalAudioChunks, totalFrames: totalAudioChunks });
    }

    onProgress?.({ phase: "finalizing", frame: totalFrames, totalFrames });
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error("Render gagal: buffer kosong.");
  onProgress?.({ phase: "done", frame: totalFrames, totalFrames });
  return {
    blob: new Blob([buffer], { type: profile.mime }),
    profile,
    durationSec: comp.duration,
  };
}

/** AudioBuffer dari Blob audio — decode lokal di device (Web Audio). */
export async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    return buf;
  } finally {
    void ctx.close();
  }
}
