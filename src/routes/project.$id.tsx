import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookmarkPlus,
  Download,
  FileArchive,
  Film,
  Github,
  ImagePlus,
  Music,
  RefreshCcw,
  Sparkles,
  Trash2,
  Unplug,
  Upload,
  Video,
} from "lucide-react";

import { PreviewPlayer } from "@/components/PreviewPlayer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { designScenes, generateRemotionProject } from "@/lib/ai/ai.functions";
import type { DesignResponse } from "@/lib/ai/schema";
import { checkAiGate, checkRenderGate } from "@/lib/access/plans";
import { markProjectUsed, useAccess } from "@/lib/access/store";
import { applyDesign, scenesFromTimings, genericScene } from "@/lib/engine/planner";
import {
  buildTimings,
  computeSilences,
  splitSentences,
  type TimedSentence,
} from "@/lib/engine/timing";
import { parseSrt } from "@/lib/engine/srt";
import { ASPECT_DIMENSIONS, type Aspect, type Composition } from "@/lib/engine/types";
import { decodeAudio, decodeVideoAudio, type RenderProgress } from "@/lib/encode/exporter";
import { buildRemotionZip } from "@/lib/export/remotion-zip";
import { unzipSync } from "fflate";
import {
  cancelGitHubRender,
  disconnectGitHub,
  getGitHubRenderStatus,
  getGitHubStatus,
} from "@/lib/github/github.functions";
import {
  getMedia,
  getProject,
  listRenders,
  putMedia,
  putRender,
  saveProject,
  type MediaRecord,
  type RenderRecord,
} from "@/lib/storage/db";

export const Route = createFileRoute("/project/$id")({
  head: () => ({
    meta: [
      { title: "Editor Project — Auto Remotion Studio" },
      {
        name: "description",
        content:
          "Editor privat Auto Remotion Studio untuk menyusun timeline, preview, dan render video di device.",
      },
      { property: "og:title", content: "Editor Project — Auto Remotion Studio" },
      {
        property: "og:description",
        content:
          "Editor privat untuk menyusun adegan, preview sinkron audio, dan render MP4 di browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: EditorPage,
});

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function EditorPage() {
  const { id } = Route.useParams();
  const access = useAccess();
  const [comp, setComp] = useState<Composition | null>(null);
  const [missing, setMissing] = useState(false);
  const [audioRec, setAudioRec] = useState<MediaRecord | null>(null);
  const [bgRec, setBgRec] = useState<MediaRecord | null>(null);
  const [videoRec, setVideoRec] = useState<MediaRecord | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [bgBitmap, setBgBitmap] = useState<ImageBitmap | null>(null);
  const [decoded, setDecoded] = useState<AudioBuffer | null>(null);
  const [narration, setNarration] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [renders, setRenders] = useState<RenderRecord[]>([]);
  const [renderUrls, setRenderUrls] = useState<Record<string, string>>({});
  const [githubStatus, setGithubStatus] = useState<{
    configured: boolean;
    connected: boolean;
    login?: string;
    avatarUrl?: string;
  }>({ configured: false, connected: false });
  const [remoteMessage, setRemoteMessage] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const remoteRunRef = useRef<{ runId: number; tag: string } | null>(null);

  useEffect(() => {
    let active = true;
    const result = new URL(window.location.href).searchParams.get("github");
    if (result) {
      const current = new URL(window.location.href);
      current.searchParams.delete("github");
      window.history.replaceState({}, "", `${current.pathname}${current.search}${current.hash}`);
      if (result === "connected")
        toast.success("GitHub tersambung. Render otomatis siap digunakan.");
      else toast.error("Koneksi GitHub belum berhasil. Coba lagi.");
    }
    void getGitHubStatus()
      .then((status) => {
        if (active) setGithubStatus(status);
      })
      .catch(() => {
        if (active) setGithubStatus({ configured: false, connected: false });
      });
    return () => {
      active = false;
    };
  }, []);

  // ---- muat project & media ----
  useEffect(() => {
    let urlAudio: string | null = null;
    let urlBg: string | null = null;
    let urlVideo: string | null = null;
    let cancelled = false;
    void (async () => {
      const json = await getProject(id);
      if (!json) {
        setMissing(true);
        return;
      }
      try {
        const parsed = JSON.parse(json) as Composition;
        setComp(parsed);
        setNarration(parsed.narration ?? parsed.scenes.map((s) => s.text).join(" "));
      } catch {
        setMissing(true);
        return;
      }
      const media = await Promise.all([
        getMedia(`${id}-audio`),
        getMedia(`${id}-bg`),
        getMedia(`${id}-video`),
      ]);
      if (cancelled) return;
      const [audio, bg, video] = media;
      if (audio) {
        setAudioRec(audio);
        urlAudio = URL.createObjectURL(audio.blob);
        setAudioUrl(urlAudio);
      }
      if (bg) {
        setBgRec(bg);
        urlBg = URL.createObjectURL(bg.blob);
        setBgUrl(urlBg);
        void createImageBitmap(bg.blob).then((bmp) => !cancelled && setBgBitmap(bmp));
      }
      if (video) {
        setVideoRec(video);
        urlVideo = URL.createObjectURL(video.blob);
        setVideoUrl(urlVideo);
      }
      const rs = await listRenders(id);
      if (cancelled) return;
      setRenders(rs);
      const urls: Record<string, string> = {};
      for (const r of rs) urls[r.id] = URL.createObjectURL(r.blob);
      setRenderUrls(urls);
    })();
    return () => {
      cancelled = true;
      if (urlAudio) URL.revokeObjectURL(urlAudio);
      if (urlBg) URL.revokeObjectURL(urlBg);
      if (urlVideo) URL.revokeObjectURL(urlVideo);
      for (const u of Object.values(renderUrls)) URL.revokeObjectURL(u);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const persist = useCallback(async (next: Composition) => {
    setComp(next);
    await saveProject(next, JSON.stringify(next));
  }, []);

  if (missing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-sm rounded-xl border-2 border-foreground/20 bg-card p-8 text-center">
          <p className="font-bold">Project tidak ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mungkin sudah dihapus dari device ini.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">
              <ArrowLeft className="size-4" /> Kembali
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!comp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-muted-foreground">Memuat project…</p>
      </div>
    );
  }

  // ---- aksi media ----
  const onAudioFile = async (file: File) => {
    setBusy("audio");
    try {
      const rec = {
        id: `${comp.id}-audio`,
        projectId: comp.id,
        kind: "audio" as const,
        name: file.name,
        mime: file.type || "audio/mpeg",
        blob: file,
      };
      await putMedia(rec);
      setAudioRec({ ...rec, createdAt: Date.now() });
      setAudioUrl(URL.createObjectURL(file));
      const buf = await decodeAudio(file);
      setDecoded(buf);
      toast.success(`Audio "${file.name}" termuat (${buf.duration.toFixed(1)} detik).`);
    } catch {
      toast.error("Gagal membaca audio. Coba format MP3/WAV lain.");
    } finally {
      setBusy(null);
    }
  };

  const onBgFile = async (file: File) => {
    setBusy("bg");
    try {
      const rec = {
        id: `${comp.id}-bg`,
        projectId: comp.id,
        kind: "image" as const,
        name: file.name,
        mime: file.type || "image/jpeg",
        blob: file,
      };
      await putMedia(rec);
      setBgRec({ ...rec, createdAt: Date.now() });
      setBgUrl(URL.createObjectURL(file));
      setBgBitmap(await createImageBitmap(file));
      toast.success("Background termuat.");
    } catch {
      toast.error("Gagal membaca gambar.");
    } finally {
      setBusy(null);
    }
  };

  const onVideoFile = async (file: File) => {
    setBusy("video");
    try {
      const probeUrl = URL.createObjectURL(file);
      const duration = await new Promise<number>((resolve, reject) => {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.onloadedmetadata = () => {
          resolve(probe.duration);
          probe.src = "";
          URL.revokeObjectURL(probeUrl);
        };
        probe.onerror = () => {
          URL.revokeObjectURL(probeUrl);
          reject(new Error("Video tidak dapat dibaca."));
        };
        probe.src = probeUrl;
      });
      const rec = {
        id: `${comp.id}-video`,
        projectId: comp.id,
        kind: "video" as const,
        name: file.name,
        mime: file.type || "video/mp4",
        blob: file,
      };
      await putMedia(rec);
      setVideoRec({ ...rec, createdAt: Date.now() });
      setVideoUrl(URL.createObjectURL(file));
      const embeddedAudio = await decodeVideoAudio(file);
      if (embeddedAudio) setDecoded(embeddedAudio);
      await persist({ ...comp, duration, updatedAt: Date.now() });
      toast.success(
        `Footage termuat (${duration.toFixed(1)} detik)${embeddedAudio ? " dengan audio" : " tanpa track audio"}.`,
      );
    } catch {
      toast.error("Gagal membaca video. Coba MP4 atau WebM dengan codec browser umum.");
    } finally {
      setBusy(null);
    }
  };

  // ---- timeline ----
  const timingsFromNarration = (duration: number): TimedSentence[] => {
    const sentences = splitSentences(narration);
    if (sentences.length === 0) return [];
    if (decoded && duration > 0) {
      const silences = computeSilences(decoded.getChannelData(0), decoded.sampleRate);
      return buildTimings(sentences, silences, duration);
    }
    return buildTimings(sentences, [], duration);
  };

  const syncTimeline = async () => {
    const duration =
      decoded?.duration ??
      (videoRec
        ? comp.duration
        : Math.max(4, narration.split(/\s+/).filter(Boolean).length * 0.38));
    const timings = timingsFromNarration(duration);
    if (timings.length === 0) {
      toast.error("Tulis dulu teks narasinya.");
      return;
    }
    const next = scenesFromTimings(comp, timings, comp.mode === "edit" ? comp.duration : undefined);
    next.narration = narration;
    await persist(next);
    toast.success(`${timings.length} adegan tersusun.`);
  };

  const markSceneStart = async (index: number) => {
    if (index <= 0) {
      toast.info("Adegan pertama selalu mulai dari 0 detik.");
      return;
    }
    const prev = comp.scenes[index - 1];
    const current = comp.scenes[index];
    if (!prev || !current) return;
    const min = prev.start + 0.3;
    const max = current.end - 0.3;
    if (max < min) {
      toast.error("Jarak antar adegan terlalu pendek untuk dipindahkan.");
      return;
    }
    const boundary = Math.max(min, Math.min(max, playhead));
    const scenes = comp.scenes.map((scene, i) => {
      if (i === index - 1) return { ...scene, end: boundary };
      if (i === index) return { ...scene, start: boundary };
      return scene;
    });
    await persist({ ...comp, scenes, updatedAt: Date.now() });
    toast.success(`Batas adegan #${index + 1} dipindah ke ${boundary.toFixed(2)} dtk.`);
  };

  const planWithAi = async () => {
    if (comp.scenes.length === 0) {
      toast.error("Susun timeline dulu (sinkron waktu), baru rancang adegan.");
      return;
    }
    const gate = checkAiGate(access, {
      projectId: comp.id,
      durationSec: comp.duration,
      mode: comp.mode,
    });
    if (!gate.ok) {
      toast.error(gate.message);
      return;
    }
    if (!access) return;
    setBusy("plan");
    try {
      const res: DesignResponse = await designScenes({
        data: {
          code: access.code,
          mode: comp.mode,
          aspect: comp.aspect,
          scenes: comp.scenes.map((s) => ({ text: s.text, seconds: s.end - s.start })),
        },
      });
      if (!res.ok) {
        toast.error("AI gagal: " + res.message);
        return;
      }
      await persist(applyDesign(comp, res.plan));
      markProjectUsed(comp.id);
      toast.success("Adegan dirancang AI.");
    } catch {
      toast.error("Gagal menyusun rencana adegan.");
    } finally {
      setBusy(null);
    }
  };

  const regenerateScene = async (index: number) => {
    const scene = comp.scenes[index];
    if (!scene) return;
    const total = comp.scenes.length;
    const generic = genericScene(index, total, {
      text: scene.text,
      start: scene.start,
      end: scene.end,
    });
    const scenes = comp.scenes.map((s, i) => (i === index ? { ...generic, id: s.id } : s));
    await persist({ ...comp, scenes, updatedAt: Date.now() });
  };

  const updateSceneText = async (index: number, text: string) => {
    const scenes = comp.scenes.map((s, i) => (i === index ? { ...s, text } : s));
    const nextNarration = scenes.map((scene) => scene.text).join(" ");
    setNarration(nextNarration);
    await persist({ ...comp, scenes, narration: nextNarration, updatedAt: Date.now() });
  };

  const changeAspect = async (aspect: Aspect) => {
    const dim = ASPECT_DIMENSIONS[aspect];
    await persist({ ...comp, aspect, width: dim.width, height: dim.height, updatedAt: Date.now() });
  };

  // ---- render & ekspor ----
  const renderNow = async () => {
    if (!githubStatus.connected) {
      toast.error("Silakan login terlebih dahulu untuk membuat video.");
      const target = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/api/github/connect?returnTo=${encodeURIComponent(target)}`);
      return;
    }
    if (comp.scenes.length === 0 || comp.duration <= 0) {
      toast.error("Susun timeline dulu sebelum render.");
      return;
    }
    const gate = checkRenderGate(access, comp.duration, comp.mode, comp.id);
    if (!gate.ok) {
      toast.error(gate.message);
      return;
    }
    if (!access) {
      toast.error("Masukkan Kode Akses untuk render video.");
      return;
    }
    setBusy("render");
    setProgress({ phase: "preparing", frame: 0, totalFrames: 0 });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let resultBlob: Blob;
      let resultMime: string;
      let resultName: string;
      let resultMessage: string;
      {
        setRemoteMessage("Menyiapkan video…");
        const generated = await generateRemotionProject({
          data: {
            code: access.code,
            title: comp.title,
            mode: comp.mode,
            aspect: comp.aspect,
            scenes: comp.scenes.map((scene) => ({
              id: scene.id,
              text: scene.text,
              start: scene.start,
              end: scene.end,
            })),
          },
        });
        if (!generated.ok) throw new Error(generated.message);
        setRemoteMessage("Menyusun source Remotion khusus konten…");
        const packageBlob = await buildRemotionZip(
          comp,
          {
            audio: audioRec ? { name: audioRec.name, blob: audioRec.blob } : null,
            bg: bgRec ? { name: bgRec.name, blob: bgRec.blob } : null,
            video: videoRec ? { name: videoRec.name, blob: videoRec.blob } : null,
          },
          { generatedManifest: generated.manifest },
        );
        if (packageBlob.size > 70 * 1024 * 1024) {
          throw new Error(
            "Ukuran media terlalu besar untuk render otomatis. Kurangi ukuran media lalu coba lagi.",
          );
        }
        setRemoteMessage("Mengirim video…");
        const startResponse = await fetch("/api/github/render", {
          method: "POST",
          headers: { "Content-Type": "application/zip" },
          body: packageBlob,
          signal: controller.signal,
        });
        const startData = (await startResponse.json().catch(() => null)) as {
          runId?: number;
          tag?: string;
          error?: string;
        } | null;
        if (!startResponse.ok || !startData?.runId || !startData.tag) {
          throw new Error(startData?.error ?? "Render otomatis belum bisa dimulai.");
        }
        const remoteRun = { runId: startData.runId, tag: startData.tag };
        remoteRunRef.current = remoteRun;
        setRemoteMessage("Menunggu giliran render…");
        const deadline = Date.now() + 90 * 60 * 1000;
        let completed = false;
        while (Date.now() < deadline) {
          await new Promise((resolve) => window.setTimeout(resolve, 5000));
          if (controller.signal.aborted) throw new DOMException("Render dibatalkan", "AbortError");
          const status = await getGitHubRenderStatus({ data: remoteRun });
          if (status.status === "queued") {
            setRemoteMessage("Menunggu giliran render…");
          } else if (status.status === "in_progress") {
            setRemoteMessage("Sedang membuat video…");
          } else if (status.status === "completed") {
            if (status.conclusion !== "success")
              throw new Error("Render otomatis gagal. Coba render lagi.");
            completed = true;
            break;
          }
        }
        if (!completed)
          throw new Error("Render memerlukan waktu lebih lama dari batas yang diizinkan.");
        setRemoteMessage("Mengambil hasil video…");
        const artifactResponse = await fetch(
          `/api/github/artifact?runId=${remoteRun.runId}&tag=${encodeURIComponent(remoteRun.tag)}`,
          { signal: controller.signal },
        );
        if (!artifactResponse.ok) {
          const detail = (await artifactResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(detail?.error ?? "Video selesai tetapi belum bisa diunduh.");
        }
        const archive = unzipSync(new Uint8Array(await artifactResponse.arrayBuffer()));
        const videoPath = Object.keys(archive).find((path) => path.endsWith("video.mp4"));
        const videoBytes = videoPath ? archive[videoPath] : undefined;
        if (!videoBytes?.byteLength)
          throw new Error("File video tidak ditemukan dalam hasil render.");
        resultBlob = new Blob([Uint8Array.from(videoBytes).buffer], { type: "video/mp4" });
        resultMime = "video/mp4";
        resultName = `${comp.title}.mp4`;
        resultMessage = "Render selesai — video siap diputar dan diunduh.";
      }
      await putRender({
        id: crypto.randomUUID(),
        projectId: comp.id,
        name: resultName,
        mime: resultMime,
        blob: resultBlob,
        durationSec: comp.duration,
      });
      markProjectUsed(comp.id);
      const rs = await listRenders(comp.id);
      setRenders(rs);
      const urls: Record<string, string> = {};
      for (const r of rs) urls[r.id] = URL.createObjectURL(r.blob);
      setRenderUrls(urls);
      toast.success(resultMessage);
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError"))
        toast.info("Render dibatalkan.");
      else
        toast.error(
          err instanceof Error ? `Render gagal: ${err.message}` : "Render gagal. Coba lagi.",
        );
    } finally {
      setBusy(null);
      setProgress(null);
      setRemoteMessage(null);
      remoteRunRef.current = null;
      abortRef.current = null;
    }
  };

  const exportTimeline = () => {
    download(
      `${comp.title}-timeline.json`,
      new Blob([JSON.stringify(comp, null, 2)], { type: "application/json" }),
    );
  };

  const exportRemotion = async () => {
    if (!access || access.plan !== "pro") {
      toast.error("Ekspor project Remotion hanya tersedia untuk paket Pro Creator.");
      return;
    }
    setBusy("zip");
    try {
      const zip = await buildRemotionZip(comp, {
        audio: audioRec ? { name: audioRec.name, blob: audioRec.blob } : null,
        bg: bgRec ? { name: bgRec.name, blob: bgRec.blob } : null,
        video: videoRec ? { name: videoRec.name, blob: videoRec.blob } : null,
      });
      download(`${comp.title}-remotion.zip`, zip);
      toast.success("Project Remotion ZIP siap diunduh.");
    } catch {
      toast.error("Gagal membuat ZIP Remotion.");
    } finally {
      setBusy(null);
    }
  };

  const importSrt = async (file: File) => {
    try {
      if (!file.name.toLowerCase().endsWith(".srt")) {
        toast.error("Pilih file subtitle berekstensi .srt.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran file SRT maksimal 2 MB.");
        return;
      }
      const timings = parseSrt(await file.text());
      const text = timings.map((cue) => cue.text).join(" ");
      const next = scenesFromTimings(comp, timings);
      next.duration = Math.max(comp.duration, next.duration);
      next.narration = text;
      next.updatedAt = Date.now();
      await persist(next);
      setNarration(text);
      toast.success(`${timings.length} subtitle SRT diimpor dengan timestamp aslinya.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File SRT tidak valid.");
    }
  };

  const ready = comp.scenes.length > 0 && comp.duration > 0;

  return (
    <div className="min-h-screen bg-white pb-16">
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && void onAudioFile(e.target.files[0])}
      />
      <input
        ref={bgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && void onBgFile(e.target.files[0])}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && void onVideoFile(e.target.files[0])}
      />
      <input
        ref={srtInputRef}
        type="file"
        accept=".srt,text/srt,application/x-subrip,application/srt,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importSrt(file);
          e.currentTarget.value = "";
        }}
      />

      <header className="border-b-2 border-foreground/15 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon" aria-label="Kembali">
            <Link to="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate font-bold">{comp.title}</p>
            <p className="text-xs text-muted-foreground">
              {comp.width}×{comp.height} · {comp.scenes.length} adegan
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {(["9:16", "16:9", "1:1"] as Aspect[]).map((a) => (
              <button
                key={a}
                onClick={() => void changeAspect(a)}
                className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${
                  comp.aspect === a
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-foreground/25 hover:border-foreground/60"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* kolom kiri: media & narasi */}
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Music className="size-4 text-primary" /> Audio narasi
            </h2>
            <Button
              variant="outline"
              className="w-full font-semibold"
              onClick={() => audioInputRef.current?.click()}
              disabled={busy !== null}
            >
              <Upload className="size-4" /> {audioRec ? audioRec.name : "Upload MP3/WAV"}
            </Button>
            {audioUrl && (
              <p className="mt-2 text-xs text-muted-foreground">
                Audio siap. Gunakan kontrol preview sinkron di panel kanan untuk memutar dan
                menandai waktu.
              </p>
            )}
          </section>

          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <ImagePlus className="size-4 text-primary" /> Background (opsional)
            </h2>
            {bgUrl ? (
              <div className="relative">
                <img
                  src={bgUrl}
                  alt="background"
                  className="max-h-40 w-full rounded-lg object-cover"
                />
                <button
                  aria-label="Ganti background"
                  className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5"
                  onClick={() => bgInputRef.current?.click()}
                >
                  <RefreshCcw className="size-4" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full font-semibold"
                onClick={() => bgInputRef.current?.click()}
                disabled={busy !== null}
              >
                <Upload className="size-4" /> Upload gambar
              </Button>
            )}
          </section>

          {comp.mode === "edit" && (
            <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold">
                <Video className="size-4 text-primary" /> Footage pembicara
              </h2>
              <Button
                variant="outline"
                className="w-full font-semibold"
                onClick={() => videoInputRef.current?.click()}
                disabled={busy !== null}
              >
                <Upload className="size-4" /> {videoRec ? videoRec.name : "Upload video MP4/WebM"}
              </Button>
              {videoUrl && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Footage tersimpan lokal; audio track dapat dipakai untuk sinkronisasi dan render.
                </p>
              )}
            </section>
          )}

          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Film className="size-4 text-primary" /> Teks narasi
            </h2>
            <Textarea
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              rows={6}
              placeholder="Tempel naskah yang sama dengan audio narasi di sini…"
              className="resize-y"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="font-semibold"
                onClick={() => srtInputRef.current?.click()}
                disabled={busy !== null}
              >
                <Upload className="size-4" /> Impor SRT
              </Button>
              <Button
                size="sm"
                className="font-semibold"
                onClick={() => void syncTimeline()}
                disabled={busy !== null}
              >
                <Sparkles className="size-4" /> Sinkron waktu
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="font-semibold"
                onClick={() => void planWithAi()}
                disabled={busy !== null}
              >
                <Sparkles className="size-4" />{" "}
                {busy === "plan" ? "Merancang…" : "Rancang adegan (AI)"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Impor file .srt untuk memakai timestamp subtitle sebagai batas scene dan teks narasi.
              Tanpa SRT, "Sinkron waktu" memperkirakan batas dari naskah dan jeda audio. Untuk
              mengoreksi batas, putar preview lalu tekan "Tandai mulai".
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Privasi: audio tetap diproses lokal. Saat tombol AI ditekan, teks narasi dan durasi
              adegan dikirim ke Kie.ai untuk merancang visual.
            </p>
          </section>

          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 font-bold">Render</h2>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold">Subtitle kata-per-kata</span>
              <input
                type="checkbox"
                checked={comp.subtitleOn}
                onChange={(e) =>
                  void persist({ ...comp, subtitleOn: e.target.checked, updatedAt: Date.now() })
                }
                className="size-5 accent-[var(--primary)]"
                aria-label="Subtitle kata-per-kata"
              />
            </div>
            <Button
              className="w-full font-bold"
              onClick={() => void renderNow()}
              disabled={busy !== null || !ready}
            >
              <Film className="size-4" /> {busy === "render" ? "Merender…" : "Render video"}
            </Button>
            <div className="mt-3 rounded-lg border border-border bg-slate-50 p-3">
              {githubStatus.connected ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <Github className="size-4 shrink-0" />
                    <span className="truncate">
                      Render otomatis aktif{githubStatus.login ? ` · @${githubStatus.login}` : ""}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    disabled={busy !== null}
                    onClick={() => {
                      setBusy("github-disconnect");
                      void disconnectGitHub()
                        .then(() => {
                          setGithubStatus({ configured: true, connected: false });
                          toast.success("Akun GitHub diputuskan.");
                        })
                        .catch(() => toast.error("Koneksi GitHub belum bisa diputuskan."))
                        .finally(() => setBusy(null));
                    }}
                  >
                    <Unplug className="size-3.5" /> Putuskan
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Silakan login terlebih dahulu untuk membuat video final.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-semibold"
                    disabled={busy !== null}
                    onClick={() => {
                      const target = `${window.location.pathname}${window.location.search}`;
                      window.location.assign(
                        `/api/github/connect?returnTo=${encodeURIComponent(target)}`,
                      );
                    }}
                  >
                    <Github className="size-4" /> Login dengan GitHub
                  </Button>
                </div>
              )}
            </div>
            {busy === "render" && progress && (
              <div className="mt-3">
                <Progress
                  value={progress.totalFrames ? (progress.frame / progress.totalFrames) * 100 : 0}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {remoteMessage ??
                    `${progress.phase} ${progress.totalFrames ? `${progress.frame}/${progress.totalFrames} frame` : ""}`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1"
                  onClick={() => {
                    abortRef.current?.abort();
                    const remoteRun = remoteRunRef.current;
                    if (remoteRun) {
                      void cancelGitHubRender({ data: remoteRun }).catch(() => {
                        toast.error("Pembatalan render belum bisa dikirim ke GitHub.");
                      });
                    }
                  }}
                >
                  Batalkan
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full font-semibold"
              onClick={exportTimeline}
            >
              <Download className="size-4" /> Ekspor timeline
            </Button>
            {access?.plan === "pro" && (
              <Button
                variant="outline"
                className="mt-3 w-full font-semibold"
                onClick={() => void exportRemotion()}
                disabled={busy !== null}
              >
                <FileArchive className="size-4" />{" "}
                {busy === "zip" ? "Membuat ZIP…" : "Unduh project Remotion ZIP"}
              </Button>
            )}
          </section>

          {renders.length > 0 && (
            <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
              <h2 className="mb-3 font-bold">Riwayat render</h2>
              <ul className="flex flex-col gap-3">
                {renders.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border p-2">
                    <video src={renderUrls[r.id]} controls className="w-full rounded-md" />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {r.name} · {new Date(r.createdAt).toLocaleString("id-ID")}
                      </span>
                      <a
                        href={renderUrls[r.id]}
                        download={r.name}
                        className="flex items-center gap-1 font-semibold text-primary"
                      >
                        <Download className="size-3.5" /> Unduh
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* kolom kanan: preview & timeline */}
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 font-bold">Preview sinkron</h2>
            <PreviewPlayer
              comp={comp}
              audioUrl={audioUrl}
              videoUrl={videoUrl}
              onTimeChange={setPlayhead}
              assets={
                bgBitmap ? { bg: bgBitmap, bgWidth: bgBitmap.width, bgHeight: bgBitmap.height } : {}
              }
            />
          </section>

          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 font-bold">Timeline adegan</h2>
            {comp.scenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada adegan — tulis teks lalu klik "Sinkron waktu".
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {comp.scenes.map((scene, i) => (
                  <li key={scene.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                        #{i + 1}
                      </span>
                      <span>
                        {scene.start.toFixed(1)}s – {scene.end.toFixed(1)}s
                      </span>
                      <span className="truncate">
                        {scene.layout}
                        {scene.items?.length ? ` · ${scene.items.length} item` : ""}
                      </span>
                      {i > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto shrink-0"
                          disabled={busy !== null || (!audioUrl && !videoUrl)}
                          onClick={() => void markSceneStart(i)}
                          title={`Gunakan posisi preview ${playhead.toFixed(2)} detik sebagai awal scene`}
                        >
                          <BookmarkPlus className="size-3.5" /> Tandai mulai
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={i > 0 ? "shrink-0" : "ml-auto"}
                        onClick={() => void regenerateScene(i)}
                      >
                        <RefreshCcw className="size-3.5" /> Generik
                      </Button>
                    </div>
                    <Textarea
                      value={scene.text}
                      rows={2}
                      onChange={(e) => void updateSceneText(i, e.target.value)}
                      className="resize-none text-sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
