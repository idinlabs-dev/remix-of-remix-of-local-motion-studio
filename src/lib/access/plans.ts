// Paket harga & aturan kuota — murni data/fungsi supaya bisa diuji dan
// dipakai di server maupun browser.

export type PlanId = "starter" | "pro";
export type ModeId = "explainer" | "edit";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  strikePrice: number;
  videos: number;
  maxSeconds: number;
  modes: ModeId[];
  remotionZip: boolean;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 20000,
    strikePrice: 40000,
    videos: 30,
    maxSeconds: 90,
    modes: ["explainer"],
    remotionZip: false,
    features: [
      "30 video",
      "Durasi maks 90 detik / video",
      "Mode Explainer: audio + teks narasi → video animasi",
      "AI Creative Director: tema, layout & objek otomatis",
      "Auto-transkrip & subtitle sorot kata",
      "Render MP4 langsung di device",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro Creator",
    price: 49000,
    strikePrice: 99000,
    videos: 100,
    maxSeconds: 120,
    modes: ["explainer", "edit"],
    remotionZip: true,
    features: [
      "100 video",
      "Durasi maks 120 detik / video",
      "Semua fitur Starter",
      "Mode Edit Video: auto-edit rekaman bicara + caption punchy + PiP",
      "Ekspor proyek Remotion (.zip) untuk diedit di VS Code",
      "Prioritas bantuan via WhatsApp",
    ],
  },
};

export function formatRupiah(n: number): string {
  return "Rp" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Kode akses: kode yang diberikan admin. Awalan "PRO-" = paket Pro, selain
 * itu Starter. Sisa kode adalah kunci layanan AI (tidak pernah ditampilkan).
 */
export function parseAccessCode(raw: string): { plan: PlanId; key: string } | null {
  const code = raw.replace(/\s+/g, "").trim();
  let plan: PlanId = "starter";
  let key = code;
  const m = /^(PRO|STR|STARTER)-(.+)$/i.exec(code);
  if (m && m[1] && m[2]) {
    plan = m[1].toUpperCase() === "PRO" ? "pro" : "starter";
    key = m[2];
  }
  if (!/^[A-Za-z0-9_\-]{16,128}$/.test(key)) return null;
  return { plan, key };
}

/** Tampilkan kode tersamar, mis. "PRO-••••••3f9a". */
export function maskCode(raw: string): string {
  const parsed = parseAccessCode(raw);
  if (!parsed) return "••••";
  const prefix = parsed.plan === "pro" ? "PRO-" : "";
  return `${prefix}••••••${parsed.key.slice(-4)}`;
}

export interface UsageState {
  plan: PlanId;
  /** project yang sudah memakai jatah video */
  used: string[];
}

export type GateResult = { ok: true; consumes: boolean } | { ok: false; message: string };

/** Boleh memakai AI untuk project ini? Satu project = satu jatah video. */
export function checkAiGate(
  state: UsageState | null,
  opts: { projectId: string; durationSec: number; mode: ModeId },
): GateResult {
  if (!state) return { ok: false, message: "Masukkan Kode Akses dulu untuk memakai AI." };
  const plan = PLANS[state.plan];
  if (!plan.modes.includes(opts.mode)) {
    return { ok: false, message: "Mode Edit Video hanya tersedia di paket Pro Creator." };
  }
  if (opts.durationSec > plan.maxSeconds + 0.5) {
    return { ok: false, message: `Durasi ${Math.round(opts.durationSec)} detik melebihi batas paket ${plan.name} (${plan.maxSeconds} detik).` };
  }
  const already = state.used.includes(opts.projectId);
  if (!already && state.used.length >= plan.videos) {
    return { ok: false, message: `Jatah ${plan.videos} video paket ${plan.name} sudah habis.` };
  }
  return { ok: true, consumes: !already };
}

/** Render butuh kode aktif & durasi sesuai paket (tidak memakai jatah). */
export function checkRenderGate(state: UsageState | null, durationSec: number, mode: ModeId): GateResult {
  if (!state) return { ok: false, message: "Masukkan Kode Akses untuk render video." };
  const plan = PLANS[state.plan];
  if (!plan.modes.includes(mode)) return { ok: false, message: "Mode Edit Video hanya untuk paket Pro Creator." };
  if (durationSec > plan.maxSeconds + 1) {
    return { ok: false, message: `Durasi video melebihi batas paket ${plan.name} (${plan.maxSeconds} detik).` };
  }
  return { ok: true, consumes: false };
}

export function remainingVideos(state: UsageState | null): number {
  if (!state) return 0;
  return Math.max(0, PLANS[state.plan].videos - state.used.length);
}
