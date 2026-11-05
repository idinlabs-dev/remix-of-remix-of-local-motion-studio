import { z } from "zod";
import type { Composition } from "@/lib/engine/types";
import { composePaperCutProject } from "./papercut/compose";
import { paperCutManifestSchema, type PaperCutManifest } from "./papercut/manifest";

export const VISUAL_KINDS = [
  "ritual",
  "phone-wallet",
  "character-punchline",
  "kite-reveal",
  "trading-card",
  "loading-window",
  "salary-slip",
  "lightning",
  "heat",
  "anatomy",
  "current-path",
  "object-transform",
  "diagram",
  "text-stage",
] as const;
export type VisualKind = (typeof VISUAL_KINDS)[number];

const sceneDesignSchema = z.object({
  id: z.string().min(1).max(80),
  visual: z.string().min(1).max(240),
  visualKind: z.enum(VISUAL_KINDS),
  motion: z.enum(["spring", "slide", "zoom", "drift", "glitch", "fade"]).catch("spring"),
  emphasis: z.array(z.string().max(40)).max(4).catch([]),
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .catch("#ffffff"),
});

export const generatedProjectManifestSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(120),
  scenes: z.array(sceneDesignSchema).min(1).max(120),
});
export type GeneratedProjectManifest = z.infer<typeof generatedProjectManifestSchema>;
export type AnyGeneratedManifest = GeneratedProjectManifest | PaperCutManifest;
export interface GeneratedProjectSource {
  manifest: AnyGeneratedManifest;
  files: Record<string, string>;
}

const REQUIRED = ["src/Video.tsx", "src/Root.tsx", "src/StudioVisual.tsx", "timing.json"] as const;
const MAX_SOURCE_BYTES = 220_000;
const BAD_SOURCE = /(?:child_process|process\.env|https?:\/\/|fetch\s*\(|eval\s*\(|new Function)/i;

export function validateGeneratedProject(
  source: GeneratedProjectSource,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const isV2 = (source.manifest as { version?: number }).version === 2;
  if (
    !(isV2
      ? paperCutManifestSchema.safeParse(source.manifest).success
      : generatedProjectManifestSchema.safeParse(source.manifest).success)
  )
    errors.push("manifest tidak sesuai schema");
  if (isV2 && typeof source.files["src/PaperCut.tsx"] !== "string")
    errors.push("file wajib hilang: src/PaperCut.tsx");
  for (const required of REQUIRED)
    if (typeof source.files[required] !== "string" || !source.files[required].trim())
      errors.push(`file wajib hilang: ${required}`);
  let total = 0;
  for (const [path, content] of Object.entries(source.files)) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.startsWith("/") || path.includes(".."))
      errors.push(`path source tidak aman: ${path}`);
    total += new TextEncoder().encode(content).byteLength;
    if (BAD_SOURCE.test(content)) errors.push(`source mengandung pola terlarang: ${path}`);
  }
  if (total > MAX_SOURCE_BYTES) errors.push("source project terlalu besar");
  return errors.length ? { ok: false, errors } : { ok: true };
}

// Deliberately distinct compositions: the switch changes object/staging/animation, not just a label.
export const GENERATED_STUDIO_VISUAL = String.raw`import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { icons } from "lucide-react";

type Scene = any;
const Icon = ({ name, size, color }: any) => { const C = (icons as any)[String(name || "sparkles").split("-").map((p: string) => p[0].toUpperCase() + p.slice(1)).join("")] || (icons as any).Sparkles; return <C size={size} color={color} strokeWidth={1.8} />; };
const Text = ({ children, theme, size = 48 }: any) => <div style={{ color: theme.ink, fontSize: size, fontWeight: 800, textAlign: "center", lineHeight: 1.05 }}>{children}</div>;
const Pop = ({ children, delay = 0 }: any) => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - delay * fps, fps, config: { damping: 12 } }); return <div style={{ transform: "scale(" + s + ")" }}>{children}</div>; };
const Label = ({ children, theme }: any) => <div style={{ color: theme.bg, background: theme.accent, borderRadius: 999, padding: "10px 22px", fontWeight: 800 }}>{children}</div>;
const Ritual = ({ scene, theme, U }: any) => { const f = useCurrentFrame(); const r = 1 + Math.sin(f / 12) * .04; return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: U * .035 }}><div style={{ width: U * .42, height: U * .42, border: "8px solid " + theme.accent, borderRadius: "50%", transform: "rotate(" + f * 1.5 + "deg) scale(" + r + ")", boxShadow: "0 0 0 14px " + theme.accent2 + ", 0 0 35px " + theme.accent }}><div style={{ padding: U * .12 }}><Icon name={scene.icon || "moon-star"} size={U * .16} color={theme.ink} /></div></div><Text theme={theme} size={U * .075}>{scene.headline || scene.text}</Text><Label theme={theme}>{(scene.emphasis || ["RITUAL"])[0]}</Label></div>; };
const Lightning = ({ scene, theme, U }: any) => { const f = useCurrentFrame(); const flash = interpolate(f % 36, [0, 4, 9, 36], [0, 1, .2, 0], { extrapolateRight: "clamp" }); return <div style={{ position: "relative", width: "75%", height: "75%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255," + flash * .18 + ")" }}><div style={{ fontSize: U * .42, color: theme.accent, textShadow: "0 0 28px " + theme.accent2, transform: "skewX(-12deg) scale(" + (1 + flash * .15) + ")" }}>ϟ</div><div style={{ position: "absolute", left: "8%", right: "8%", height: 8, background: theme.accent2, transform: "rotate(-8deg) translateX(" + Math.sin(f / 5) * 18 + "px)" }} /><Text theme={theme} size={U * .07}>{scene.headline || scene.text}</Text></div>; };
const PhoneWallet = ({ scene, theme, U }: any) => { const f = useCurrentFrame(); return <div style={{ display: "flex", alignItems: "center", gap: U * .06 }}><Pop><div style={{ width: U * .3, height: U * .5, border: "10px solid " + theme.ink, borderRadius: 32, background: theme.surface, padding: U * .035, transform: "rotate(" + Math.sin(f / 15) * 3 + "deg)" }}><div style={{ background: theme.accent, height: "48%", borderRadius: 18 }} /><Icon name="wallet-cards" size={U * .1} color={theme.accent2} /></div></Pop><Text theme={theme} size={U * .07}>{scene.headline || scene.text}</Text></div>; };
const Cards = ({ scene, theme, U }: any) => { const f = useCurrentFrame(); const labels = (scene.items || []).slice(0, 3); return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}><Text theme={theme} size={U * .07}>{scene.headline || scene.text}</Text><div style={{ display: "flex", gap: 18 }}>{(labels.length ? labels : [{ label: scene.emphasis?.[0] || "IDEA" }]).map((x: any, i: number) => <div key={i} style={{ width: U * .22, height: U * .3, borderRadius: 20, padding: 18, background: i % 2 ? theme.accent2 : theme.accent, color: theme.bg, transform: "translateY(" + Math.sin(f / 10 + i) * 12 + "px) rotate(" + (i - 1) * 5 + "deg)" }}>{x.label}<Icon name={x.icon || "sparkles"} size={U * .09} color={theme.bg} /></div>)}</div></div>; };
const GenericKind = ({ scene, theme, U, kind }: any) => { const f = useCurrentFrame(); const shapes: any = { "loading-window": ["▰", "▱"], "salary-slip": ["$", "₽"], "heat": ["♨", "🔥"], "anatomy": ["◎", "◉"], "current-path": ["→", "↯"], "object-transform": ["◇", "◆"], "diagram": ["○", "□"], "text-stage": ["Aa", "…"], "character-punchline": ["●", "!"] }; const pair = shapes[kind] || ["✦", "•"]; return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}><div style={{ display: "flex", gap: U * .08, alignItems: "center", transform: "translateY(" + Math.sin(f / 10) * 10 + "px)" }}>{pair.map((s: string, i: number) => <div key={i} style={{ width: U * .22, height: U * .18, display: "flex", alignItems: "center", justifyContent: "center", background: i ? theme.accent2 : theme.accent, color: theme.bg, borderRadius: kind === "diagram" ? 20 : 999, fontSize: U * .1, fontWeight: 900 }}>{s}</div>)}</div><Text theme={theme} size={U * .07}>{scene.headline || scene.text}</Text><Label theme={theme}>{(scene.emphasis || [kind])[0]}</Label></div>; };
export const StudioVisual: React.FC<{ scene: Scene; theme: any; U: number }> = ({ scene, theme, U }) => { switch (scene.generatedKind) { case "ritual": return <Ritual scene={scene} theme={theme} U={U} />; case "lightning": return <Lightning scene={scene} theme={theme} U={U} />; case "phone-wallet": return <PhoneWallet scene={scene} theme={theme} U={U} />; case "trading-card": return <Cards scene={scene} theme={theme} U={U} />; case "kite-reveal": return <GenericKind scene={scene} theme={theme} U={U} kind="kite-reveal" />; case "loading-window": case "salary-slip": case "character-punchline": case "heat": case "anatomy": case "current-path": case "object-transform": case "diagram": case "text-stage": return <GenericKind scene={scene} theme={theme} U={U} kind={scene.generatedKind} />; default: return <GenericKind scene={scene} theme={theme} U={U} kind="fallback" />; } };
export const Main: React.FC<{ timeline: any }> = ({ timeline }) => { const { fps, width, height } = useVideoConfig(); const U = Math.min(width, height); return <AbsoluteFill style={{ background: timeline.theme.bg, fontFamily: timeline.fontFamily }}><div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>{timeline.scenes.map((scene: any) => <div key={scene.id} style={{ display: "none" }} />)}<StudioVisual scene={timeline.scenes[0]} theme={timeline.theme} U={U} /></div></AbsoluteFill>; };
`;

export function composeGeneratedProject(
  comp: Composition,
  manifest: AnyGeneratedManifest,
  timeline: unknown,
): GeneratedProjectSource {
  if ((manifest as { version?: number }).version === 2)
    return composePaperCutProject(comp, manifest as PaperCutManifest, timeline);
  const safe = generatedProjectManifestSchema.parse(manifest);
  const designLiteral = JSON.stringify(safe.scenes, null, 2);
  const video = `import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { StudioVisual } from "./StudioVisual";
import timeline from "../timing.json";
export const AI_SCENE_DESIGNS = ${designLiteral} as const;
export const Video: React.FC<{ timeline?: any }> = ({ timeline: supplied }) => { const t: any = supplied ?? timeline; const { fps } = useVideoConfig(); return <AbsoluteFill style={{ background: t.theme.bg }}>{t.scenes.map((scene: any, i: number) => { const design = AI_SCENE_DESIGNS[i % AI_SCENE_DESIGNS.length]; const from = Math.round(scene.start * fps); const durationInFrames = Math.max(1, Math.round((scene.end - scene.start) * fps)); return <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}><StudioVisual scene={{ ...scene, generatedVisual: design.visual, generatedKind: design.visualKind, generatedMotion: design.motion, generatedEmphasis: design.emphasis, generatedAccent: design.accent }} theme={t.theme} U={Math.min(t.width, t.height)} /></Sequence>; })}</AbsoluteFill>; };
`;
  const root = `import { Audio, Composition, staticFile } from "remotion"; import { Video } from "./Video"; import timing from "../timing.json"; const Main = (props: any) => <><Video {...props} /><Audio src={staticFile(timing.media?.audio || "narasi.mp3")} /></>; export const RemotionRoot = () => <Composition id="Main" component={Main} durationInFrames={Math.max(1, Math.round(timing.duration * timing.fps))} fps={timing.fps} width={timing.width} height={timing.height} defaultProps={{ timeline: timing }} />;`;
  return {
    manifest: safe,
    files: {
      "src/Video.tsx": video,
      "src/Root.tsx": root,
      "src/StudioVisual.tsx": GENERATED_STUDIO_VISUAL,
      "timing.json": JSON.stringify(timeline, null, 2),
      "generated/manifest.json": JSON.stringify(safe, null, 2),
      "generated/request.json": JSON.stringify(
        { title: comp.title, aspect: comp.aspect, mode: comp.mode },
        null,
        2,
      ),
    },
  };
}

export function defaultGeneratedManifest(comp: Composition): GeneratedProjectManifest {
  return {
    version: 1,
    title: comp.title,
    scenes: comp.scenes.map((scene) => ({
      id: scene.id,
      visual: `${scene.layout}: ${scene.headline ?? scene.text.slice(0, 100)}`,
      visualKind:
        scene.layout === "anatomy"
          ? "anatomy"
          : scene.layout === "quote"
            ? "text-stage"
            : "object-transform",
      motion:
        scene.transition === "glitch" ? "glitch" : scene.transition === "zoom" ? "zoom" : "spring",
      emphasis: scene.keywords?.slice(0, 4) ?? [],
      accent: comp.theme.accent,
    })),
  };
}
