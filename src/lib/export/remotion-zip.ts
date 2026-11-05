// Ekspor proyek Remotion (.zip) — paket Pro. Berisi timeline JSON + komponen
// React yang meniru layout studio, siap dibuka di VS Code:
//   npm install && npx remotion studio

import { zipSync, strToU8 } from "fflate";

import type { Composition } from "@/lib/engine/types";
import { FONT_DISPLAY } from "@/lib/engine/themes";
import { defaultPaperCutManifest } from "./papercut/manifest";
import {
  composeGeneratedProject,
  validateGeneratedProject,
  type GeneratedProjectSource,
} from "./generated-project";

export interface ZipMedia {
  audio?: { name: string; blob: Blob } | null;
  bg?: { name: string; blob: Blob } | null;
  video?: { name: string; blob: Blob } | null;
  srt?: string | null;
}

export interface RemotionZipOptions {
  generatedSource?: GeneratedProjectSource | null;
  generatedManifest?: Parameters<typeof composeGeneratedProject>[1] | null;
}

function ext(name: string, fallback: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m && m[1] ? m[1].toLowerCase() : fallback;
}

const PACKAGE_JSON = (title: string) =>
  JSON.stringify(
    {
      name:
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "auto-remotion-video",
      version: "1.0.0",
      private: true,
      scripts: {
        studio: "remotion studio",
        render: "remotion render src/index.ts Main out/video.mp4 --codec=h264",
      },
      dependencies: {
        "@remotion/cli": "4.0.250",
        "@remotion/google-fonts": "4.0.250",
        "lucide-react": "^0.460.0",
        react: "18.3.1",
        "react-dom": "18.3.1",
        remotion: "4.0.250",
      },
      devDependencies: { "@types/react": "^18.3.0", typescript: "^5.5.0" },
    },
    null,
    2,
  );

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: false,
      esModuleInterop: true,
      resolveJsonModule: true,
      skipLibCheck: true,
    },
    include: ["src"],
  },
  null,
  2,
);

const REMOTION_CONFIG = `import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
`;

const INDEX_TS = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const ROOT_TSX = `import { Composition } from "remotion";
import { Main } from "./Main";
import timeline from "./timeline.json";

export const RemotionRoot = () => {
  const t = timeline as any;
  return (
    <Composition
      id="Main"
      component={Main}
      durationInFrames={Math.max(1, Math.round(t.duration * t.fps))}
      fps={t.fps}
      width={t.width}
      height={t.height}
      defaultProps={{ timeline: t }}
    />
  );
};
`;

// Komponen utama: latar tema, media, adegan per Sequence, subtitle sorot kata.
const MAIN_TSX = `import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { icons } from "lucide-react";

type Scene = any;

const pascal = (n: string) => (n || "sparkles").split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");

const Icon: React.FC<{ name?: string; size: number; color: string }> = ({ name, size, color }) => {
  const C = (icons as any)[pascal(name || "sparkles")] || (icons as any).Sparkles;
  return <C size={size} color={color} strokeWidth={1.8} />;
};

const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay * fps, fps, config: { damping: 12, mass: 0.7 } });
};

const Badge: React.FC<{ icon?: string; size: number; theme: any; delay?: number; fill?: string; color?: string }> = ({ icon, size, theme, delay = 0, fill, color }) => {
  const s = useEnter(delay);
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: fill || theme.surface, border: "6px solid " + (color || theme.accent),
      display: "flex", alignItems: "center", justifyContent: "center", transform: "scale(" + s + ")", boxShadow: "8px 10px 0 rgba(0,0,0,0.18)" }}>
      <Icon name={icon} size={size * 0.55} color={color || theme.accent} />
    </div>
  );
};

const Headline: React.FC<{ text?: string; theme: any; font: string; size: number; delay?: number }> = ({ text, theme, font, size, delay = 0 }) => {
  const s = useEnter(delay);
  if (!text) return null;
  return <div style={{ fontFamily: font, fontSize: size, color: theme.ink, textAlign: "center", lineHeight: 1.05, transform: "scale(" + s + ")", padding: "0 6%" }}>{text}</div>;
};

const Card: React.FC<{ theme: any; children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ theme, children, color, style }) => (
  <div style={{ background: theme.surface, borderRadius: 36, boxShadow: "16px 16px 0 " + (color || theme.accent), padding: 40, ...style }}>{children}</div>
);

const SceneView: React.FC<{ scene: Scene; theme: any; font: string; U: number }> = ({ scene, theme, font, U }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = scene.items || [];
  const col: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: U * 0.04, height: "78%" };
  switch (scene.layout) {
    case "hook":
      return (<div style={col}><Badge icon={scene.icon} size={U * 0.24} theme={theme} />
        {scene.sub ? <div style={{ background: theme.accent, color: theme.bg, padding: "12px 28px", borderRadius: 99, fontSize: U * 0.035, fontWeight: 700 }}>{String(scene.sub).toUpperCase()}</div> : null}
        <Headline text={scene.headline || scene.text} theme={theme} font={font} size={U * 0.11} delay={0.3} /></div>);
    case "stat": {
      const p = interpolate(frame, [0.2 * fps, 1.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const num = Number(String(scene.value || "").replace(/[^0-9]/g, ""));
      const shown = num ? Math.round(num * p).toLocaleString("id-ID") + String(scene.value).replace(/[0-9.,]/g, "") : scene.value;
      return (<div style={col}><Card theme={theme}><div style={{ fontFamily: font, fontSize: U * 0.2, color: theme.accent, textAlign: "center" }}>{shown}</div>
        <div style={{ fontSize: U * 0.042, fontWeight: 700, textAlign: "center", color: "#222" }}>{scene.sub}</div></Card>
        <Headline text={scene.headline} theme={theme} font={font} size={U * 0.07} delay={0.6} /></div>);
    }
    case "versus":
      return (<div style={col}><Headline text={scene.headline} theme={theme} font={font} size={U * 0.08} />
        <div style={{ display: "flex", gap: U * 0.06, alignItems: "center" }}>
          {[0, 1].map((i) => (<Card key={i} theme={theme} color={i ? theme.accent2 : theme.accent} style={{ width: U * 0.36, textAlign: "center" }}>
            <Badge icon={(items[i] || {}).icon || (i ? "x" : "check")} size={U * 0.14} theme={theme} delay={0.2 + i * 0.25} color={i ? theme.accent2 : theme.accent} />
            <div style={{ fontFamily: font, fontSize: U * 0.06, marginTop: 20, color: "#222" }}>{(items[i] || {}).label}</div></Card>))}
        </div></div>);
    case "timeline":
    case "list":
      return (<div style={{ ...col, alignItems: "flex-start", padding: "0 12%" }}><Headline text={scene.headline} theme={theme} font={font} size={U * 0.075} />
        {items.map((it: any, i: number) => { const s = spring({ frame: frame - (0.3 + i * 0.4) * fps, fps });
          return (<div key={i} style={{ display: "flex", gap: 28, alignItems: "center", opacity: s, transform: "translateX(" + (1 - s) * -80 + "px)" }}>
            <Badge icon={it.icon || "check"} size={U * 0.11} theme={theme} delay={0.3 + i * 0.4} /><div style={{ fontSize: U * 0.05, fontWeight: 700, color: theme.ink }}>{it.label}</div></div>); })}
      </div>);
    case "anatomy":
      return (<div style={col}><Headline text={scene.headline} theme={theme} font={font} size={U * 0.075} /><Badge icon={scene.icon} size={U * 0.32} theme={theme} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", padding: "0 8%" }}>{items.map((it: any, i: number) => (
          <div key={i} style={{ background: theme.surface, color: "#222", border: "5px solid " + theme.accent2, borderRadius: 20, padding: "12px 24px", fontSize: U * 0.04, fontWeight: 700, opacity: spring({ frame: frame - (0.5 + i * 0.3) * fps, fps }) }}>{it.label}</div>))}</div></div>);
    case "quote": {
      const words = String(scene.headline || scene.text).split(" ");
      const kws = (scene.keywords || []).map((k: string) => k.toLowerCase());
      return (<div style={{ ...col, padding: "0 9%" }}><div style={{ fontFamily: font, fontSize: U * 0.1, textAlign: "center", lineHeight: 1.12 }}>
        {words.map((w, i) => { const s = spring({ frame: frame - i * 3, fps, config: { damping: 10 } });
          return <span key={i} style={{ display: "inline-block", marginRight: "0.25em", transform: "scale(" + s + ")", color: kws.includes(w.toLowerCase().replace(/[^\\p{L}\\p{N}]/gu, "")) ? theme.accent : theme.ink }}>{w}</span>; })}
      </div></div>);
    }
    case "outro":
      return (<div style={col}><Badge icon={scene.icon || "heart"} size={U * 0.22} theme={theme} fill={theme.accent} color={theme.bg} />
        <Headline text={scene.headline || "Terima kasih!"} theme={theme} font={font} size={U * 0.1} delay={0.25} />
        {scene.sub ? <div style={{ background: theme.accent, color: theme.bg, padding: "16px 36px", borderRadius: 99, fontSize: U * 0.042, fontWeight: 700 }}>{scene.sub}</div> : null}</div>);
    case "speaker":
      return scene.headline ? (<div style={{ position: "absolute", top: "7%", width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ background: theme.accent, color: theme.bg, fontFamily: font, fontSize: U * 0.055, padding: "14px 36px", borderRadius: 99 }}>{scene.headline}</div></div>) : null;
    default:
      return (<div style={col}><div style={{ transform: "translateY(" + Math.sin(frame / 15) * 8 + "px)" }}><Icon name={scene.icon} size={U * 0.42} color={theme.ink} /></div>
        <Headline text={scene.headline} theme={theme} font={font} size={U * 0.09} delay={0.4} />
        {scene.sub ? <div style={{ background: theme.accent2, color: theme.bg, padding: "12px 28px", borderRadius: 99, fontSize: U * 0.036, fontWeight: 700 }}>{scene.sub}</div> : null}</div>);
  }
};

const Stickers: React.FC<{ scene: Scene; theme: any; U: number }> = ({ scene, theme, U }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (<>{(scene.stickers || []).map((st: any, i: number) => {
    const s = spring({ frame: frame - (0.4 + i * 0.25) * fps, fps });
    const bob = st.anim === "bob" ? Math.sin(frame / 12 + i) * 12 : 0;
    const rot = st.anim === "spin" ? frame * 2 : -8 + i * 8;
    const fill = i % 2 ? theme.accent2 : theme.accent;
    return (<div key={i} style={{ position: "absolute", left: st.x * 100 + "%", top: st.y * 100 + "%", transform: "translate(-50%,-50%) translateY(" + bob + "px) rotate(" + rot + "deg) scale(" + s + ")",
      width: U * 0.14, height: U * 0.14, borderRadius: 999, background: fill, border: "8px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name={st.icon} size={U * 0.08} color="#fff" /></div>);
  })}</>);
};

const Subtitle: React.FC<{ scene: Scene; theme: any; mode: string; U: number }> = ({ scene, theme, mode, U }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const words = String(scene.text).split(/\\s+/).filter(Boolean);
  const dur = scene.end - scene.start;
  const weights = words.map((w) => Math.max(w.length, 2));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const starts = weights.map((w) => { const s = (acc / total) * dur; acc += w; return s; });
  let active = 0;
  starts.forEach((s, i) => { if (t >= s) active = i; });
  if (mode === "edit") {
    const g = Math.floor(active / 4);
    return (<div style={{ position: "absolute", top: "76%", width: "100%", textAlign: "center", fontSize: U * 0.075, fontWeight: 900 }}>
      {words.slice(g * 4, g * 4 + 4).map((w, i) => (<span key={i} style={{ marginRight: "0.3em", color: g * 4 + i === active ? theme.accent : "#fff", WebkitTextStroke: "3px #000" }}>{w.toUpperCase()}</span>))}</div>);
  }
  return (<div style={{ position: "absolute", bottom: "3%", left: "5%", right: "5%", background: theme.bg + "dd", borderRadius: 24, padding: "18px 24px", textAlign: "center", fontSize: U * 0.046, fontWeight: 700, color: theme.ink }}>
    {words.map((w, i) => (<span key={i} style={{ marginRight: "0.28em", padding: "0 6px", borderRadius: 10, background: i === active ? theme.accent : "transparent", color: i === active ? theme.bg : theme.ink }}>{w}</span>))}</div>);
};

export const Main: React.FC<{ timeline: any }> = ({ timeline }) => {
  const { fps, width, height } = useVideoConfig();
  const t = timeline;
  const theme = t.theme;
  const U = Math.min(width, height);
  const font = t.fontFamily;
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: '"Space Grotesk", sans-serif' }}>
      {t.media.bg ? <Img src={staticFile(t.media.bg)} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }} /> : null}
      {t.media.audio ? <Audio src={staticFile(t.media.audio)} /> : null}
      {t.scenes.map((scene: Scene) => {
        const from = Math.round(scene.start * fps);
        const dur = Math.max(1, Math.round((scene.end - scene.start) * fps));
        const spk = t.mode === "edit" ? (scene.speaker || (scene.layout === "speaker" ? "full" : "pip")) : "hidden";
        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur}>
            <AbsoluteFill>
              {spk === "full" && t.media.video ? <OffthreadVideo src={staticFile(t.media.video)} startFrom={from} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
              {spk === "pip" && t.media.video ? (<div style={{ position: "absolute", right: "5%", bottom: "28%", width: "30%", aspectRatio: "4 / 5", borderRadius: 30, overflow: "hidden", border: "8px solid #fff", boxShadow: "14px 14px 0 " + theme.accent }}>
                <OffthreadVideo src={staticFile(t.media.video)} startFrom={from} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>) : null}
              {scene.generatedVisual ? <div style={{ position: "absolute", top: "5%", left: "7%", right: "7%", color: scene.generatedAccent || theme.accent, fontSize: U * 0.028, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", textAlign: "center", opacity: 0.9 }}>{scene.generatedVisual}</div> : null}
              <SceneView scene={scene} theme={spk === "full" ? { ...theme, ink: "#fff" } : theme} font={font} U={U} />
              <Stickers scene={scene} theme={theme} U={U} />
              {t.subtitleOn ? <Subtitle scene={scene} theme={theme} mode={t.mode} U={U} /> : null}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
`;

const README = (title: string) => `# ${title}

Proyek Remotion hasil ekspor Auto Remotion Studio.

## Jalankan

\`\`\`bash
npm install
npm run studio      # buka editor Remotion di browser
npm run render      # render ke out/video.mp4
\`\`\`

- Semua data adegan ada di \`src/timeline.json\` — ubah teks, layout, ikon, warna di sana.
- Komponen visual ada di \`src/Main.tsx\` (pakai \`spring\` & \`interpolate\` Remotion).
- Ikon memakai \`lucide-react\`; nama ikon = nama kebab-case lucide.
- Font tema: muat via \`@remotion/google-fonts\` bila ingin persis sama.
`;

export async function buildRemotionZip(
  comp: Composition,
  media: ZipMedia,
  options: RemotionZipOptions = {},
): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  const mediaPaths: { audio?: string; bg?: string; video?: string } = {};
  if (media.audio) {
    mediaPaths.audio = `narasi.${ext(media.audio.name, "mp3")}`;
    files[`public/${mediaPaths.audio}`] = new Uint8Array(await media.audio.blob.arrayBuffer());
  }
  if (media.bg) {
    mediaPaths.bg = `background.${ext(media.bg.name, "jpg")}`;
    files[`public/${mediaPaths.bg}`] = new Uint8Array(await media.bg.blob.arrayBuffer());
  }
  if (media.video) {
    mediaPaths.video = `footage.${ext(media.video.name, "mp4")}`;
    files[`public/${mediaPaths.video}`] = new Uint8Array(await media.video.blob.arrayBuffer());
    // mode edit: suara diambil dari footage
    if (!mediaPaths.audio) {
      mediaPaths.audio = mediaPaths.video;
    }
  }
  const timeline = {
    ...comp,
    fontFamily: FONT_DISPLAY[comp.theme.font].family,
    media: mediaPaths,
  };
  const generated =
    options.generatedSource ??
    composeGeneratedProject(
      comp,
      options.generatedManifest ??
        defaultPaperCutManifest({
          title: comp.title,
          mode: comp.mode,
          scenes: comp.scenes.map((s) => ({ id: s.id, text: s.text, keywords: s.keywords })),
        }),
      timeline,
    );
  const validation = validateGeneratedProject(generated);
  if (!validation.ok)
    throw new Error(`Source Remotion tidak aman: ${validation.errors.join(", ")}`);
  const srt =
    media.srt ??
    comp.scenes
      .map((scene, i) => {
        const stamp = (seconds: number) => {
          const ms = Math.round(seconds * 1000);
          const h = Math.floor(ms / 3600000);
          const m = Math.floor(ms / 60000) % 60;
          const s = Math.floor(ms / 1000) % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
        };
        return `${i + 1}\n${stamp(scene.start)} --> ${stamp(scene.end)}\n${scene.text}\n`;
      })
      .join("\n");
  files["package.json"] = strToU8(PACKAGE_JSON(comp.title));
  files["tsconfig.json"] = strToU8(TSCONFIG);
  files["remotion.config.ts"] = strToU8(REMOTION_CONFIG);
  files["README.md"] = strToU8(README(comp.title));
  files["src/index.ts"] = strToU8(INDEX_TS);
  files["src/Root.tsx"] = strToU8(generated.files["src/Root.tsx"] ?? ROOT_TSX);
  files["src/Video.tsx"] = strToU8(
    generated.files["src/Video.tsx"] ?? MAIN_TSX.replace("export const Main", "export const Video"),
  );
  files["src/StudioVisual.tsx"] = strToU8(MAIN_TSX);
  files["timing.json"] = strToU8(
    generated.files["timing.json"] ?? JSON.stringify(timeline, null, 2),
  );
  for (const [path, content] of Object.entries(generated.files)) files[path] = strToU8(content);
  files["src/timeline.json"] = strToU8(JSON.stringify(timeline, null, 2));
  files["public/subtitles.srt"] = strToU8(srt);
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}
