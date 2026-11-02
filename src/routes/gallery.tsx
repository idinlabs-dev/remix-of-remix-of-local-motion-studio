import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Film, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { listProjects, listRenders, type RenderRecord } from "@/lib/storage/db";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Auto Remotion Studio" },
      { name: "description", content: "Video yang sudah dibuat di Auto Remotion Studio." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: GalleryPage,
});

type GalleryRender = RenderRecord & { projectTitle: string };

function GalleryPage() {
  const [items, setItems] = useState<GalleryRender[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void (async () => {
      const projects = await listProjects();
      const grouped = await Promise.all(
        projects.map(async (project) => {
          const renders = await listRenders(project.id);
          return renders.map((render) => ({ ...render, projectTitle: project.title }));
        }),
      );
      if (!active) return;
      const next = grouped.flat();
      setItems(next);
      const nextUrls: Record<string, string> = {};
      next.forEach((render) => {
        nextUrls[render.id] = URL.createObjectURL(render.blob);
      });
      setUrls(nextUrls);
    })().catch(() => active && setItems([]));

    return () => {
      active = false;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
    // URL cleanup on unmount is sufficient; render list is loaded once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-white pb-16">
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Kembali ke beranda">
            <Link to="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Koleksi video
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-tight">Gallery</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Video yang dibuat di browser ini tersimpan aman di perangkatmu.
            </p>
          </div>
        </div>

        {items === null ? (
          <p className="text-sm text-muted-foreground">Memuat gallery…</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border px-6 py-20 text-center">
            <Film className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">Belum ada video</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Setelah video selesai dibuat, hasilnya akan muncul di sini dan bisa langsung diputar
              atau diunduh.
            </p>
            <Button asChild className="mt-6">
              <Link to="/">Buat project pertama</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((render) => (
              <article
                key={render.id}
                className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm"
              >
                <video
                  src={urls[render.id]}
                  controls
                  preload="metadata"
                  className="aspect-[9/16] w-full bg-slate-100 object-contain"
                />
                <div className="p-4">
                  <p className="truncate font-bold">{render.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <FolderOpen className="size-3.5" /> {render.projectTitle}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(render.createdAt).toLocaleString("id-ID")}
                  </p>
                  <a
                    href={urls[render.id]}
                    download={render.name}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                  >
                    <Download className="size-4" /> Unduh video
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
