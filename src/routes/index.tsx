import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Film, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { newComposition, type Aspect, type Composition } from "@/lib/engine/types";
import { deleteProject, listProjects, saveProject, type ProjectMeta } from "@/lib/storage/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auto Remotion Studio — Video Narasi Otomatis" },
      {
        name: "description",
        content:
          "Ubah audio narasi jadi video animasi bergaya papan tulis. Semua proses — AI, render, encode — jalan di device kamu.",
      },
      { property: "og:title", content: "Auto Remotion Studio — Video Narasi Otomatis" },
      {
        property: "og:description",
        content: "Upload audio + gambar, AI menyusun adegan, render MP4 langsung di browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ASPECTS: Aspect[] = ["9:16", "16:9", "1:1"];

function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listProjects().then(setProjects);
  }, []);

  const createProject = async () => {
    setBusy(true);
    try {
      const comp: Composition = newComposition(`Narasi ${new Date().toLocaleDateString("id-ID")}`, aspect);
      await saveProject(comp, JSON.stringify(comp));
      await navigate({ to: "/project/$id", params: { id: comp.id } });
    } catch {
      toast.error("Gagal membuat project baru.");
    } finally {
      setBusy(false);
    }
  };

  const removeProject = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    toast.success("Project dihapus.");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-muted-foreground">Rasio:</span>
        {ASPECTS.map((a) => (
          <button
            key={a}
            onClick={() => setAspect(a)}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
              aspect === a
                ? "border-primary bg-primary text-primary-foreground"
                : "border-foreground/25 bg-background text-foreground hover:border-foreground/60"
            }`}
          >
            {a}
          </button>
        ))}
        <Button onClick={() => void createProject()} disabled={busy} className="ml-auto font-bold">
          <Plus className="size-4" /> Project baru
        </Button>
      </div>

      {projects === null ? (
        <p className="text-sm text-muted-foreground">Memuat project…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-foreground/25 p-10 text-center">
          <Film className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Belum ada project</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat project baru, upload audio narasi, lalu biarkan AI menyusun adegannya.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id} className="group relative">
              <Link
                to="/project/$id"
                params={{ id: p.id }}
                className="block rounded-xl border-2 border-foreground/20 bg-card p-4 transition-colors hover:border-primary"
              >
                <p className="font-bold">{p.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.aspect} · {p.sceneCount} adegan · {new Date(p.updatedAt).toLocaleString("id-ID")}
                </p>
              </Link>
              <button
                onClick={() => void removeProject(p.id)}
                aria-label={`Hapus ${p.title}`}
                className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Index() {
  return (
    <div className="grid-paper min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-12">
        <header className="mb-10">
          <p className="font-bold uppercase tracking-widest text-primary">Studio video narasi otomatis</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Auto Remotion Studio
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Upload audio narasi + gambar background, AI menyusun adegan animasi bergaya papan tulis, lalu render
            MP4 — semuanya diproses di device kamu sendiri.
          </p>
        </header>
        <ClientOnly fallback={<p className="text-sm text-muted-foreground">Memuat…</p>}>
          <ProjectList />
        </ClientOnly>
      </main>
    </div>
  );
}
