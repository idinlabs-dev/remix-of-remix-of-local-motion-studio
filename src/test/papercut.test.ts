import { describe, expect, it } from "vitest";
import { newComposition } from "@/lib/engine/types";
import {
  composeGeneratedProject,
  defaultGeneratedManifest,
  validateGeneratedProject,
} from "@/lib/export/generated-project";
import { PAPERCUT_KIT_SOURCE, composePaperCutProject } from "@/lib/export/papercut/compose";
import {
  PAPERCUT_COMPONENTS,
  PAPERCUT_DOCS,
  defaultPaperCutManifest,
  normalizePaperCutManifest,
  paperCutManifestSchema,
} from "@/lib/export/papercut/manifest";
import { PAPERCUT_PROJECT_TOOL, paperCutPrompt } from "@/lib/ai/papercut-schema";

function comp(lines: string[], mode: "explainer" | "edit" = "explainer") {
  const c = newComposition("Uji Paper Cut", "9:16", mode);
  let t = 0;
  c.scenes = lines.map((text, i) => {
    const end = t + 3;
    const scene = { id: `s${i + 1}`, start: t, end, text, layout: "icon" as const, transition: "fade" as const };
    t = end;
    return scene;
  });
  c.duration = t;
  return c;
}
const ctx = (c: ReturnType<typeof comp>) => ({
  title: c.title,
  mode: c.mode,
  scenes: c.scenes.map((s) => ({ id: s.id, text: s.text, keywords: s.keywords })),
});

describe("manifest paper-cut v2", () => {
  it("menerima layer valid dan menormalkan nilai di luar batas", () => {
    const m = paperCutManifestSchema.parse({
      version: 2,
      style: "paper-cut",
      title: "x",
      scenes: [{ id: "a", stage: "sea", layers: [{ c: "ship", x: 9, y: -1, s: 99, motion: "wow" }] }],
    });
    const l = m.scenes[0]!.layers[0]!;
    expect(l.x).toBe(0.5);
    expect(l.y).toBe(0.78);
    expect(l.s).toBe(1);
    expect(l.motion).toBe("none");
  });

  it("menolak komponen yang tidak ada", () => {
    const r = paperCutManifestSchema.safeParse({
      version: 2,
      style: "paper-cut",
      title: "x",
      scenes: [{ id: "a", layers: [{ c: "naga-terbang" }] }],
    });
    expect(r.success).toBe(false);
  });

  it("membersihkan karakter berbahaya pada teks layer", () => {
    const m = paperCutManifestSchema.parse({
      version: 2,
      style: "paper-cut",
      title: "x",
      scenes: [{ id: "a", layers: [{ c: "chip", text: "<b>halo</b>{x}" }] }],
    });
    expect(m.scenes[0]!.layers[0]!.text).toBe("bhalo/bx");
  });

  it("normalize memperbaiki keluaran AI yang rusak dan menjaga id/urutan", () => {
    const c = comp(["Kapal berlayar di laut.", "Uang gaji naik.", "Kenapa bisa begitu?"]);
    const { manifest, repaired } = normalizePaperCutManifest(
      { scenes: [{ id: "s1", layers: [{ c: "naga-terbang" }, { c: "ship" }] }, { id: "zzz" }] },
      ctx(c),
    );
    expect(manifest.scenes.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(repaired).toBeGreaterThan(0);
    expect(manifest.scenes[0]!.layers).toHaveLength(1);
    expect(manifest.scenes[1]!.layers.length).toBeGreaterThan(0);
  });

  it("normalize tetap valid bila kandidat bukan objek", () => {
    const c = comp(["Satu.", "Dua."]);
    const { manifest, repaired } = normalizePaperCutManifest(null, ctx(c));
    expect(manifest.scenes).toHaveLength(2);
    expect(repaired).toBe(2);
  });
});

describe("heuristik cadangan", () => {
  it("memetakan kata kunci ke komponen dan preset stage", () => {
    const c = comp(["Kapal pinisi berlayar di laut lepas.", "Roket meluncur ke antariksa.", "Dua puluh Oktober ada demo."]);
    const m = defaultPaperCutManifest(ctx(c));
    expect(m.scenes[0]!.stage).toBe("sea");
    expect(m.scenes[0]!.layers[0]!.c).toBe("ship");
    expect(m.scenes[1]!.layers[0]!.c).toBe("rocket");
    expect(m.scenes[1]!.stage).toBe("night");
  });

  it("mengisi teks kalender dari tanggal", () => {
    const c = comp(["Pada 20 Oktober ada rapat."]);
    const m = defaultPaperCutManifest(ctx(c));
    const cal = m.scenes[0]!.layers.find((l) => l.c === "calendar");
    expect(cal?.text).toBe("OKT|20");
  });

  it("selalu menghasilkan layer minimal satu, walau tanpa kata kunci", () => {
    const c = comp(["Hmm begitulah."]);
    const m = defaultPaperCutManifest(ctx(c));
    expect(m.scenes[0]!.layers[0]!.c).toBe("person");
  });

  it("mode edit mengisi header judul", () => {
    const c = comp(["Halo."], "edit");
    expect(defaultPaperCutManifest(ctx(c)).header?.title).toBe("Uji Paper Cut");
  });
});

describe("composer paper-cut", () => {
  it("menghasilkan source valid, aman, dan membawa waktu per kata", () => {
    const c = comp(["Kapal berlayar di laut.", "Uang gaji naik sepuluh persen."]);
    const m = defaultPaperCutManifest(ctx(c));
    const src = composePaperCutProject(c, m, { ...c, media: { audio: "narasi.mp3" } });
    expect(validateGeneratedProject(src)).toEqual({ ok: true });
    expect(Object.keys(src.files)).toContain("src/PaperCut.tsx");
    const tl = JSON.parse(src.files["timing.json"]!);
    expect(tl.scenes[0].words.length).toBeGreaterThan(2);
    expect(tl.scenes[0].words[0].start).toBe(0);
    expect(tl.mode).toBe("explainer");
  });

  it("composeGeneratedProject membagi v2 ke composer paper-cut dan v1 tetap utuh", () => {
    const c = comp(["Kapal berlayar."]);
    const v2 = composeGeneratedProject(c, defaultPaperCutManifest(ctx(c)), c);
    expect(Object.keys(v2.files)).toContain("src/PaperCut.tsx");
    const v1 = composeGeneratedProject(c, defaultGeneratedManifest(c), c);
    expect(Object.keys(v1.files)).not.toContain("src/PaperCut.tsx");
    expect(validateGeneratedProject(v1)).toEqual({ ok: true });
  });

  it("kit murni: tanpa Math.random, timer, atau jaringan", () => {
    expect(PAPERCUT_KIT_SOURCE).not.toMatch(/Math\.random|setTimeout|setInterval|useState|Date\.now/);
    expect(PAPERCUT_KIT_SOURCE).not.toMatch(/fetch\s*\(|https?:\/\/|eval\s*\(/);
  });

  it("validator menolak source paper-cut berisi pola terlarang", () => {
    const c = comp(["Kapal."]);
    const src = composePaperCutProject(c, defaultPaperCutManifest(ctx(c)), c);
    src.files["src/Video.tsx"] += "\nfetch('x');";
    expect(validateGeneratedProject(src).ok).toBe(false);
  });
});

describe("konsistensi registry, docs, dan tool AI", () => {
  it("setiap komponen punya implementasi di kit dan dokumentasi", () => {
    for (const name of PAPERCUT_COMPONENTS) {
      expect(PAPERCUT_KIT_SOURCE.includes(`${name}:`) || PAPERCUT_KIT_SOURCE.includes(`'${name}':`)).toBe(true);
      expect(PAPERCUT_DOCS[name].length).toBeGreaterThan(2);
    }
  });

  it("enum tool AI sama dengan daftar komponen", () => {
    const items = PAPERCUT_PROJECT_TOOL.input_schema.properties.scenes.items.properties.layers.items.properties;
    expect(items.c.enum).toEqual([...PAPERCUT_COMPONENTS]);
  });

  it("prompt memuat jumlah scene, aturan atribusi, dan seluruh komponen", () => {
    const c = comp(["Satu kalimat.", "Dua kalimat."]);
    const p = paperCutPrompt({ title: c.title, mode: c.mode, aspect: c.aspect, scenes: c.scenes });
    expect(p).toContain("harus tepat 2");
    expect(p).toContain("Menurut narasumber");
    for (const name of PAPERCUT_COMPONENTS) expect(p).toContain(`- ${name}:`);
  });
});
