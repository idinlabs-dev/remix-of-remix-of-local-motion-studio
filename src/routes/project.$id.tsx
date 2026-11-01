import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Film,
  ImagePlus,
  Music,
  RefreshCcw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";

import { PreviewPlayer } from "@/components/PreviewPlayer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { planScenes, transcribeAudio, type PlanResponse, type TranscribeResponse } from "@/lib/ai/ai.functions";
import { applyPlan, scenesFromTimings, genericScene } from "@/lib/engine/planner";
import { buildFromTranscript, buildTimings, computeSilences, splitSentences, type TimedSentence } from "@/lib/engine/timing";
import { ASPECT_DIMENSIONS, type Aspect, type Composition, type TimedSentence as _TS } from "@/lib/engine/types";
import { decodeAudio, renderComposition, type RenderProgress } from "@/lib/encode/exporter";
import { getMedia, getProject, listRenders, putMedia, putRender, saveProject, type MediaRecord, type RenderRecord } from "@/lib/storage/db";

export const Route = createFileRoute("/project/$id")({
  head: () => ({
    meta: [
      { title: "Editor Project — Auto Remotion Studio" },
      {
        name: "description",
        content: "Susun timeline adegan dari audio narasi, preview sinkron, lalu render MP4 di device kamu.",
      },
      { property: "og:title", content: "Editor Project — Auto Remotion Studio" },
      { property: "og:description", content: "Susun adegan, preview sinkron audio, render MP4 langsung di browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

const MAX_TRANSCRIBE_BYTES = 18 * 1024 * 1024;

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
  const [comp, setComp] = useState<Composition | null>(null);
  const [missing, setMissing] = useState(false);
  const [audioRec, setAudioRec] = useState<MediaRecord | null>(null);
  const [bgRec, setBgRec] = useState<MediaRecord | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgBitmap, setBgBitmap] = useState<ImageBitmap | null>(null);
  const [decoded, setDecoded] = useState<AudioBuffer | null>(null);
  const [narration, setNarration] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [renders, setRenders] = useState<RenderRecord[]>([]);
  const [renderUrls, setRenderUrls] = useState<Record<string, string>>({});

  const audioInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- muat project & media ----
  useEffect(() => {
    let urlAudio: string | null = null;
    let urlBg: string | null = null;
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
      const media = await Promise.all([getMedia(`${id}-audio`), getMedia(`${id}-bg`)]);
      if (cancelled) return;
      const [audio, bg] = media;
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
      for (const u of Object.values(renderUrls)) URL.revokeObjectURL(u);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const persist = useCallback(
    async (next: Composition) => {
      setComp(next);
      await saveProject(next.id, JSON.stringify(next));
    },
    [],
  );

  if (missing) {
    return (
      <div className="grid-paper flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm rounded-xl border-2 border-foreground/20 bg-card p-8 text-center">
          <p className="font-bold">Project tidak ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">Mungkin sudah dihapus dari device ini.</p>
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
      <div className="grid-paper flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuat project…</p>
      </div>
    );
  }

  // ---- aksi media ----
  const onAudioFile = async (file: File) => {
    setBusy("audio");
    try {
      const rec = { id: `${comp.id}-audio`, projectId: comp.id, kind: "audio" as const, name: file.name, mime: file.type || "audio/mpeg", blob: file };
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
      const rec = { id: `${comp.id}-bg`, projectId: comp.id, kind: "image" as const, name: file.name, mime: file.type || "image/jpeg", blob: file };
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
    const duration = decoded?.duration ?? Math.max(4, narration.split(/\s+/).filter(Boolean).length * 0.38);
    const timings = timingsFromNarration(duration);
    if (timings.length === 0) {
      toast.error("Tulis dulu teks narasinya.");
      return;
    }
    await persist(scenesFromTimings(comp, timings));
    toast.success(`${timings.length} adegan tersusun.`);
  };

  const transcribeNow = async () => {
    if (!audioRec) {
      toast.error("Upload audio dulu untuk transkrip otomatis.");
      return;
    }
    if (audioRec.blob.size > MAX_TRANSCRIBE_BYTES) {
      toast.error("Audio terlalu besar untuk transkrip (maks 18 MB). Potong dulu atau tempel teks manual.");
      return;
    }
    setBusy("transcribe");
    try {
      const base64 = await blobToBase64(audioRec.blob);
      const res: TranscribeResponse = await transcribeAudio({ data: { audioBase64: base64, mime: audioRec.mime } });
      if (!res.ok) {
        toast.error(res.reason === "no-key" ? (res.message ?? "Kunci AI belum diisi.") : "Transkrip gagal: " + (res.message ?? ""));
        return;
      }
      setNarration(res.fullText);
      const duration = decoded?.duration ?? Math.max(...res.items.map((i) => i.end), 1);
      const timings = buildFromTranscript(res.items, duration);
      await persist(scenesFromTimings(comp, timings));
      toast.success(`Transkrip: ${res.items.length} kalimat.`);
    } catch {
      toast.error("Transkrip gagal — coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const planWithAi = async () => {
    if (comp.scenes.length === 0) {
      toast.error("Susun timeline dulu (sinkron waktu), baru rancang adegan.");
      return;
    }
    setBusy("plan");
    try {
      const res: PlanResponse = await planScenes({ data: { sentences: comp.scenes.map((s) => s.text) } });
      if (!res.ok) {
        toast.error(res.reason === "no-key" ? (res.message ?? "Kunci AI belum diisi.") : "AI gagal: " + (res.message ?? ""));
        return;
      }
      await persist(applyPlan(comp, { scenes: res.scenes }));
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
    const generic = genericScene(index, total, { text: scene.text, start: scene.start, end: scene.end });
    const scenes = comp.scenes.map((s, i) => (i === index ? { ...generic, id: s.id } : s));
    await persist({ ...comp, scenes, updatedAt: Date.now() });
  };

  const updateSceneText = async (index: number, text: string) => {
    const scenes = comp.scenes.map((s, i) => (i === index ? { ...s, text } : s));
    await persist({ ...comp, scenes, updatedAt: Date.now() });
  };

  const changeAspect = async (aspect: Aspect) => {
    const dim = ASPECT_DIMENSIONS[aspect];
    await persist({ ...comp, aspect, width: dim.width, height: dim.height, updatedAt: Date.now() });
  };

  // ---- render & ekspor ----
  const renderNow = async () => {
    if (comp.scenes.length === 0 || comp.duration <= 0) {
      toast.error("Susun timeline dulu sebelum render.");
      return;
    }
    setBusy("render");
    setProgress({ phase: "preparing", frame: 0, totalFrames: 0 });
    abortRef.current = new AbortController();
    try {
      const audio = decoded ?? (audioRec ? await decodeAudio(audioRec.blob) : null);
      if (audio && !decoded) setDecoded(audio);
      const result = await renderComposition({
        comp,
        assets: { bg: bgBitmap ?? undefined, bgWidth: bgBitmap?.width, bgHeight: bgBitmap?.height },
        audio,
        onProgress: setProgress,
        signal: abortRef.current.signal,
      });
      await putRender({
        id: crypto.randomUUID(),
        projectId: comp.id,
        name: `${comp.title}.${result.profile.ext}`,
        mime: result.profile.mime,
        blob: result.blob,
        durationSec: result.durationSec,
      });
      const rs = await listRenders(comp.id);
      setRenders(rs);
      const urls: Record<string, string> = {};
      for (const r of rs) urls[r.id] = URL.createObjectURL(r.blob);
      setRenderUrls(urls);
      toast.success(`Render selesai — ${result.profile.container.toUpperCase()}.`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") toast.info("Render dibatalkan.");
      else toast.error("Render gagal: browser ini mungkin tidak mendukung encode video. Coba Chrome/Edge terbaru.");
    } finally {
      setBusy(null);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const exportTimeline = () => {
    download(`${comp.title}-timeline.json`, new Blob([JSON.stringify(comp, null, 2)], { type: "application/json" }));
  };

  const importTimeline = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Composition;
      if (!parsed.scenes || typeof parsed.duration !== "number") throw new Error("bad");
      await persist({ ...parsed, id: comp.id, updatedAt: Date.now() });
      setNarration(parsed.narration ?? "");
      toast.success("Timeline diimpor.");
    } catch {
      toast.error("File timeline tidak valid.");
    }
  };

  const ready = comp.scenes.length > 0 && comp.duration > 0;

  return (
    <div className="grid-paper min-h-screen pb-16">
      <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && void onAudioFile(e.target.files[0])} />
      <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void onBgFile(e.target.files[0])} />
      <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void importTimeline(e.target.files[0])} />

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
                  comp.aspect === a ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25 hover:border-foreground/60"
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
            <h2 className="mb-3 flex items-center gap-2 font-bold"><Music className="size-4 text-primary" /> Audio narasi</h2>
            <Button variant="outline" className="w-full font-semibold" onClick={() => audioInputRef.current?.click()} disabled={busy !== null}>
              <Upload className="size-4" /> {audioRec ? audioRec.name : "Upload MP3/WAV"}
            </Button>
            {audioUrl && <audio src={audioUrl} controls className="mt-3 w-full" />}
          </section>

          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><ImagePlus className="size-4 text-primary" /> Background (opsional)</h2>
            {bgUrl ? (
              <div className="relative">
                <img src={bgUrl} alt="background" className="max-h-40 w-full rounded-lg object-cover" />
                <button
                  aria-label="Ganti background"
                  className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5"
                  onClick={() => bgInputRef.current?.click()}
                >
                  <RefreshCcw className="size-4" />
                </button>
              </div>
            ) : (
              <Button variant="outline" className="w-full font-semibold" onClick={() => bgInputRef.current?.click()} disabled={busy !== null}>
                <Upload className="size-4" /> Upload gambar
              </Button>
            )}
          </section>

          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><Film className="size-4 text-primary" /> Teks narasi</h2>
            <Textarea
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              rows={6}
              placeholder="Tempel teks narasi di sini, atau pakai transkrip otomatis…"
              className="resize-y"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="font-semibold" onClick={() => void transcribeNow()} disabled={busy !== null || !audioRec}>
                <Wand2 className="size-4" /> {busy === "transcribe" ? "Men transkrip…" : "Auto-transkrip (AI)"}
              </Button>
              <Button size="sm" className="font-semibold" onClick={() => void syncTimeline()} disabled={busy !== null}>
                <Sparkles className="size-4" /> Sinkron waktu
              </Button>
              <Button size="sm" variant="secondary" className="font-semibold" onClick={() => void planWithAi()} disabled={busy !== null}>
                <Sparkles className="size-4" /> {busy === "plan" ? "Merancang…" : "Rancang adegan (AI)"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              "Sinkron waktu" memecah kalimat & menyelaraskan dari jeda audio (lokal). "Rancang adegan" memakai AI.
            </p>
          </section>

          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 font-bold">Render</h2>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold">Subtitle kata-per-kata</span>
              <Switch checked={comp.subtitleOn} onCheckedChange={(v) => void persist({ ...comp, subtitleOn: v, updatedAt: Date.now() })} />
            </div>
            <Button className="w-full font-bold" onClick={() => void renderNow()} disabled={busy !== null || !ready}>
              <Film className="size-4" /> {busy === "render" ? "Merender…" : "Render video"}
            </Button>
            {busy === "render" && progress && (
              <div className="mt-3">
                <Progress value={progress.totalFrames ? (progress.frame / progress.totalFrames) * 100 : 0} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {progress.phase} {progress.totalFrames ? `${progress.frame}/${progress.totalFrames} frame` : ""}
                </p>
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => abortRef.current?.abort()}>
                  Batalkan
                </Button>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 font-semibold" onClick={exportTimeline}>
                <Download className="size-4" /> Ekspor timeline
              </Button>
              <Button variant="outline" size="sm" className="flex-1 font-semibold" onClick={() => importInputRef.current?.click()}>
                <Upload className="size-4" /> Impor timeline
              </Button>
            </div>
          </section>

          {renders.length > 0 && (
            <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
              <h2 className="mb-3 font-bold">Riwayat render</h2>
              <ul className="flex flex-col gap-3">
                {renders.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border p-2">
                    <video src={renderUrls[r.id]} controls className="w-full rounded-md" />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{r.name} · {new Date(r.createdAt).toLocaleString("id-ID")}</span>
                      <a href={renderUrls[r.id]} download={r.name} className="flex items-center gap-1 font-semibold text-primary">
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
            <PreviewPlayer comp={comp} audioUrl={audioUrl} assets={bgBitmap ? { bg: bgBitmap, bgWidth: bgBitmap.width, bgHeight: bgBitmap.height } : {}} />
          </section>

          <section className="rounded-xl border-2 border-foreground/15 bg-card p-4">
            <h2 className="mb-3 font-bold">Timeline adegan</h2>
            {comp.scenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada adegan — tulis teks lalu klik "Sinkron waktu".</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {comp.scenes.map((scene, i) => (
                  <li key={scene.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">#{i + 1}</span>
                      <span>{scene.start.toFixed(1)}s – {scene.end.toFixed(1)}s</span>
                      <span className="truncate">{scene.elements.map((e) => e.kind).join(", ")}</span>
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void regenerateScene(i)}>
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
