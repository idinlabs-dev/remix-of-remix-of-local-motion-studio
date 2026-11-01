// Tipe data timeline — gaya Remotion: komposisi berbasis frame, dirender
// deterministik dari waktu (detik) ke frame.

export type Aspect = "9:16" | "16:9" | "1:1";

export const ASPECT_DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

/** Elemen visual yang bisa dipilih AI — dideskripsikan di CATALOG (kit.ts). */
export type ElKind =
  "title" | "illustration" | "flow" | "label" | "bubble" | "emphasize" | "outro" | "badge" | "list";

export type Entrance = "left" | "right" | "top" | "bottom";

export interface SceneElement {
  kind: ElKind;
  /** Nama bentuk doodle untuk kind "illustration" (mis. "plane", "wing"). */
  shape?: string;
  text?: string;
  /** Posisi relatif 0..1 terhadap lebar/tinggi canvas. */
  x?: number;
  y?: number;
  /** Skala relatif 0.5..1.6 terhadap ukuran dasar elemen. */
  scale?: number;
  /** Indeks variasi (warna/arah) 0..3 — supaya tiap project beda rasa. */
  variant?: number;
  from?: Entrance;
}

export interface Scene {
  id: string;
  /** Waktu mulai/selesai dalam detik. */
  start: number;
  end: number;
  title?: string;
  /** Kalimat narasi untuk adegan ini. */
  text: string;
  elements: SceneElement[];
}

export interface Composition {
  id: string;
  title: string;
  aspect: Aspect;
  fps: number;
  width: number;
  height: number;
  /** Durasi total video (detik) — biasanya durasi audio + jeda penutup. */
  duration: number;
  scenes: Scene[];
  bgMediaId?: string;
  subtitleOn: boolean;
  /** Teks narasi lengkap — disimpan supaya editor bisa memuatnya kembali. */
  narration?: string;
  createdAt: number;
  updatedAt: number;
}

export const OUTRO_HOLD_SECONDS = 0.8;

export function newComposition(title: string, aspect: Aspect = "9:16"): Composition {
  const dim = ASPECT_DIMENSIONS[aspect];
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    aspect,
    fps: 30,
    width: dim.width,
    height: dim.height,
    duration: 0,
    scenes: [],
    subtitleOn: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Adegan yang aktif pada waktu t — dipakai renderer & sinkronisasi. */
export function pickScene(comp: Composition, time: number): Scene | null {
  for (const scene of comp.scenes) {
    if (time >= scene.start && time < scene.end) return scene;
  }
  const last = comp.scenes[comp.scenes.length - 1];
  if (last && time >= last.end && time < comp.duration) return last;
  return null;
}
