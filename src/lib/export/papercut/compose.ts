import { wordTimings } from "@/lib/engine/timing";
import type { Composition, Scene } from "@/lib/engine/types";
import { paperCutManifestSchema, type PaperCutManifest } from "./manifest";
import PAPERCUT_KIT_SOURCE from "./PaperCut.kit.tsx?raw";

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export { PAPERCUT_KIT_SOURCE };

const VIDEO_TSX = `import React from "react";
import { OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PaperCutVideo } from "./PaperCut";
import design from "../generated/manifest.json";
import timing from "../timing.json";

export const Video: React.FC<{ timeline?: any; fontFamily?: string }> = ({ timeline: supplied, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl: any = supplied ?? timing;
  const src = tl.media && tl.media.video ? staticFile(tl.media.video) : null;
  const footage = src ? <OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null;
  return <PaperCutVideo t={frame / fps} timeline={tl} design={design as any} footage={footage} fontFamily={fontFamily} />;
};
`;

const ROOT_TSX = `import React from "react";
import { Audio, Composition, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Fredoka";
import { Video } from "./Video";
import timing from "../timing.json";

const { fontFamily } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });

const Main: React.FC<any> = (props) => (
  <>
    <Video {...props} fontFamily={fontFamily + ", sans-serif"} />
    <Audio src={staticFile((timing as any).media?.audio || "narasi.mp3")} />
  </>
);

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Main"
    component={Main}
    durationInFrames={Math.max(1, Math.round(timing.duration * timing.fps))}
    fps={timing.fps}
    width={timing.width}
    height={timing.height}
    defaultProps={{ timeline: timing }}
  />
);
`;

const STUDIO_VISUAL_TSX = `export { PaperCutVideo as StudioVisual } from "./PaperCut";
`;

/** Timeline + waktu per kata (estimasi deterministik) untuk renderer paper-cut. */
export function withWordTimings(comp: Composition, timeline: unknown): Record<string, unknown> {
  const tl = (timeline && typeof timeline === "object" ? (timeline as Record<string, unknown>) : {}) as Record<string, unknown>;
  const scenes = (Array.isArray(tl["scenes"]) ? (tl["scenes"] as Scene[]) : comp.scenes) as Scene[];
  return {
    width: comp.width,
    height: comp.height,
    fps: comp.fps,
    duration: comp.duration,
    mode: comp.mode,
    subtitleOn: comp.subtitleOn,
    ...tl,
    scenes: scenes.map((s) => ({
      ...s,
      words: wordTimings(s.text, s.start, Math.max(0.1, s.end - s.start)).map((w) => ({
        w: w.word,
        start: r3(w.start),
        end: r3(w.end),
      })),
    })),
  };
}

export function composePaperCutProject(
  comp: Composition,
  manifest: PaperCutManifest,
  timeline: unknown,
): { manifest: PaperCutManifest; files: Record<string, string> } {
  const safe = paperCutManifestSchema.parse(manifest);
  const tl = withWordTimings(comp, timeline);
  return {
    manifest: safe,
    files: {
      "src/PaperCut.tsx": PAPERCUT_KIT_SOURCE,
      "src/Video.tsx": VIDEO_TSX,
      "src/Root.tsx": ROOT_TSX,
      "src/StudioVisual.tsx": STUDIO_VISUAL_TSX,
      "timing.json": JSON.stringify(tl, null, 2),
      "generated/manifest.json": JSON.stringify(safe, null, 2),
      "generated/request.json": JSON.stringify(
        { title: comp.title, aspect: comp.aspect, mode: comp.mode, style: "paper-cut" },
        null,
        2,
      ),
    },
  };
}
