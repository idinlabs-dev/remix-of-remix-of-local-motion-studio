import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Film, KeyRound, Mic, Plus, Sparkles, Trash2, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { verifyAccess } from "@/lib/ai/ai.functions";
import { formatRupiah, PLANS, remainingVideos, type PlanId } from "@/lib/access/plans";
import { formatCountdown, makeOrderId, msUntilJakartaMidnight } from "@/lib/access/promo";
import { activateAccess, useAccess } from "@/lib/access/store";
import { newComposition, type Aspect, type Composition, type Mode } from "@/lib/engine/types";
import { SITE_DESCRIPTION, SITE_NAME, canonicalLink, socialUrlMeta } from "@/lib/seo";
import { deleteProject, listProjects, saveProject, type ProjectMeta } from "@/lib/storage/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE_NAME} — AI Motion Video Studio` },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "keywords", content: "AI video editor, motion explainer, podcast editor, talking head, Remotion" },
      { property: "og:title", content: `${SITE_NAME} — AI Motion Video Studio` },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:type", content: "website" },
      ...socialUrlMeta("/"),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${SITE_NAME} — AI Motion Video Studio` },
      { name: "twitter:description", content: SITE_DESCRIPTION },
    ],
    links: canonicalLink("/"),
  }),
  component: Index,
});

const ASPECTS: Aspect[] = ["9:16", "16:9", "1:1"];

function AccessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const access = useAccess();

  const submit = async () => {
    setBusy(true);
    try {
      const res = await verifyAccess({ data: { code } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      activateAccess(code.replace(/\s+/g, "").trim(), res.plan);
      toast.success(`Kode ${res.plan === "pro" ? "Pro Creator" : "Starter"} aktif.`);
      onOpenChange(false);
      setCode("");
    } catch {
      toast.error("Kode belum bisa diverifikasi. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aktifkan Kode Akses</DialogTitle>
          <DialogDescription>
            Kode diverifikasi di server, tetapi kunci layanan tidak pernah ditampilkan di browser.
          </DialogDescription>
        </DialogHeader>
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PRO-sk-... atau STARTER-sk-..." autoFocus />
        {access && <p className="text-xs text-muted-foreground">Kode aktif saat ini akan diganti jika kode baru valid.</p>}
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={busy || code.length < 16}>
            <KeyRound className="size-4" /> {busy ? "Memeriksa…" : "Aktifkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Pricing({ onBuy }: { onBuy: (plan: PlanId) => void }) {
  return (
    <section className="mt-14" id="harga">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-bold uppercase tracking-widest text-primary">Akses kreator</p>
          <h2 className="mt-1 text-3xl font-bold">Pilih paket sesuai workflow</h2>
        </div>
        <p className="rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">Promo reset tengah malam WIB</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.values(PLANS) as typeof PLANS[PlanId][]).map((plan) => (
          <article key={plan.id} className={`rounded-2xl border-2 p-5 ${plan.id === "pro" ? "border-primary bg-primary/5" : "border-foreground/15 bg-card"}`}>
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-xl font-bold">{plan.name}</h3><p className="text-sm text-muted-foreground">{plan.videos} video · maksimal {plan.maxSeconds} detik</p></div>
              {plan.id === "pro" && <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">REKOMENDASI</span>}
            </div>
            <div className="mt-4 flex items-baseline gap-2"><span className="text-3xl font-black">{formatRupiah(plan.price)}</span><del className="text-sm text-muted-foreground">{formatRupiah(plan.strikePrice)}</del></div>
            <ul className="mt-4 space-y-2 text-sm">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-primary">✓</span>{feature}</li>)}</ul>
            <Button className="mt-5 w-full" variant={plan.id === "pro" ? "default" : "outline"} onClick={() => onBuy(plan.id)}><CreditCard className="size-4" /> Beli {plan.name}</Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectList() {
  const navigate = useNavigate();
  const access = useAccess();
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [mode, setMode] = useState<Mode>("explainer");
  const [busy, setBusy] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [countdown, setCountdown] = useState(() => msUntilJakartaMidnight(Date.now()));

  useEffect(() => { void listProjects().then(setProjects); }, []);
  useEffect(() => { const timer = window.setInterval(() => setCountdown(msUntilJakartaMidnight(Date.now())), 1000); return () => window.clearInterval(timer); }, []);

  const createProject = async () => {
    setBusy(true);
    try {
      const comp: Composition = newComposition(mode === "edit" ? "Talking Head" : `Narasi ${new Date().toLocaleDateString("id-ID")}`, aspect, mode);
      await saveProject(comp, JSON.stringify(comp));
      await navigate({ to: "/project/$id", params: { id: comp.id } });
    } catch { toast.error("Gagal membuat project baru."); } finally { setBusy(false); }
  };
  const removeProject = async (id: string) => { await deleteProject(id); setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev)); toast.success("Project dihapus."); };
  const buy = (plan: PlanId) => { toast.info(`Order ${makeOrderId(plan, Date.now())} siap dibuat. QRIS dan WhatsApp admin akan diaktifkan setelah konfigurasi pembayaran selesai.`); };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-muted-foreground">Rasio:</span>{ASPECTS.map((a) => <button key={a} onClick={() => setAspect(a)} className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${aspect === a ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25 bg-background"}`}>{a}</button>)}<Button onClick={() => void createProject()} disabled={busy} className="ml-auto font-bold"><Plus className="size-4" /> Project baru</Button></div>
      <div className="grid gap-4 md:grid-cols-2">
        <button onClick={() => setMode("explainer")} className={`rounded-2xl border-2 p-5 text-left transition ${mode === "explainer" ? "border-primary bg-primary/10" : "border-foreground/15 bg-card"}`}><Mic className="size-8 text-primary" /><h2 className="mt-3 text-xl font-bold">Motion Explainer</h2><p className="mt-1 text-sm text-muted-foreground">Audio + naskah menjadi video faceless dengan scene dan subtitle dinamis.</p></button>
        <button onClick={() => setMode("edit")} className={`rounded-2xl border-2 p-5 text-left transition ${mode === "edit" ? "border-primary bg-primary/10" : "border-foreground/15 bg-card"}`}><Video className="size-8 text-primary" /><h2 className="mt-3 text-xl font-bold">Podcast / Talking-Head</h2><p className="mt-1 text-sm text-muted-foreground">Upload video pembicara untuk micro-zoom, caption punchy, PiP, dan cut-in.</p></button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4"><p className="font-semibold">Diskon harian berakhir dalam <span className="font-black text-primary">{formatCountdown(countdown)}</span></p><Button variant="outline" onClick={() => setAccessOpen(true)}><KeyRound className="size-4" /> {access ? `${remainingVideos(access)} video tersisa` : "Masukkan Kode Akses"}</Button></div>
      {projects === null ? <p className="text-sm text-muted-foreground">Memuat project…</p> : projects.length === 0 ? <div className="rounded-xl border-2 border-dashed border-foreground/25 p-10 text-center"><Film className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 font-semibold">Belum ada project</p><p className="mt-1 text-sm text-muted-foreground">Pilih mode di atas lalu buat project baru.</p></div> : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{projects.map((p) => <li key={p.id} className="group relative"><Link to="/project/$id" params={{ id: p.id }} className="block rounded-xl border-2 border-foreground/20 bg-card p-4 hover:border-primary"><p className="font-bold">{p.title}</p><p className="mt-1 text-xs text-muted-foreground">{p.aspect} · {p.sceneCount} adegan · {new Date(p.updatedAt).toLocaleString("id-ID")}</p></Link><button onClick={() => void removeProject(p.id)} aria-label={`Hapus ${p.title}`} className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"><Trash2 className="size-4" /></button></li>)}</ul>}
      <Pricing onBuy={buy} />
      <AccessDialog open={accessOpen} onOpenChange={setAccessOpen} />
    </div>
  );
}

function Index() {
  return <div className="grid-paper min-h-screen"><main className="mx-auto max-w-5xl px-4 py-12"><header className="mb-10"><p className="font-bold uppercase tracking-widest text-primary">Studio video narasi otomatis</p><h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">Dari ide mentah menjadi motion video.</h1><p className="mt-4 max-w-2xl text-lg text-muted-foreground">Creative Director AI memilih mood, layout, warna, ikon, dan timing sesuai topikmu. Render dan encode tetap berjalan di device kamu.</p><div className="mt-5 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Topik bebas: sains, horor, finansial, sejarah, edukasi, dan apa pun.</div></header><ClientOnly fallback={<p className="text-sm text-muted-foreground">Memuat…</p>}><ProjectList /></ClientOnly></main></div>;
}
