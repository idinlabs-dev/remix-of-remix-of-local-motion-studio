import type { BackgroundStyle, FontKey, Theme } from "./types";

export type VisualAssetCategory = "character" | "object" | "sticker" | "ui" | "diagram";
export type AssetAnchor = "center" | "bottom" | "top" | "left" | "right";
export type MotionProfile =
  | "spring-pop"
  | "slide-stagger"
  | "drag-drop"
  | "type-on"
  | "counter-reveal"
  | "orbit-float"
  | "shake-emphasis"
  | "idle-bob"
  | "wipe-highlight"
  | "camera-push";

/** Metadata asset internal; renderer dapat memakai src atau fallback berbasis icon. */
export interface VisualAsset {
  id: string;
  category: VisualAssetCategory;
  /** URL/path opsional. Asset tanpa src tetap valid dan memakai fallback renderer. */
  src?: string;
  tags: string[];
  compatibleStyles: string[];
  anchor: AssetAnchor;
  defaultScale: number;
  variants?: string[];
  fallbackIcon?: string;
}

export interface SubtitleTreatment {
  id: string;
  label: string;
  highlight: "word" | "phrase" | "none";
  placement: "bottom" | "center" | "object-aware";
}

export interface StylePack {
  id: string;
  label: string;
  description: string;
  theme: Theme;
  cardRadius: number;
  borderWidth: number;
  shadow: "soft" | "hard" | "none";
  iconStyle: "outline" | "filled";
  motionProfiles: MotionProfile[];
  subtitleTreatments: SubtitleTreatment[];
  assetIds: string[];
  beatTempoSeconds: [number, number];
  density: "airy" | "balanced" | "dense";
}

/** Asset visual minimum untuk Creator Explainer; semuanya aman jika file visual belum tersedia. */
export const VISUAL_ASSETS: readonly VisualAsset[] = [
  {
    id: "creator-folder",
    category: "object",
    tags: ["folder", "file", "organize", "digital"],
    compatibleStyles: ["creator-explainer"],
    anchor: "center",
    defaultScale: 1,
    fallbackIcon: "folder-open",
  },
  {
    id: "creator-cursor",
    category: "sticker",
    tags: ["cursor", "click", "pointer", "ui"],
    compatibleStyles: ["creator-explainer"],
    anchor: "right",
    defaultScale: 0.65,
    fallbackIcon: "mouse-pointer-2",
  },
  {
    id: "creator-spark",
    category: "sticker",
    tags: ["spark", "idea", "success", "magic"],
    compatibleStyles: ["creator-explainer"],
    anchor: "top",
    defaultScale: 0.7,
    fallbackIcon: "sparkles",
  },
  {
    id: "creator-checkmark",
    category: "sticker",
    tags: ["check", "done", "success", "list"],
    compatibleStyles: ["creator-explainer"],
    anchor: "right",
    defaultScale: 0.65,
    fallbackIcon: "check",
  },
  {
    id: "creator-warning",
    category: "sticker",
    tags: ["warning", "risk", "attention"],
    compatibleStyles: ["creator-explainer"],
    anchor: "top",
    defaultScale: 0.65,
    fallbackIcon: "triangle-alert",
  },
  {
    id: "creator-process-card",
    category: "ui",
    tags: ["process", "workflow", "steps", "card"],
    compatibleStyles: ["creator-explainer"],
    anchor: "center",
    defaultScale: 1,
    fallbackIcon: "layout-dashboard",
  },
];

export const CREATOR_EXPLAINER: StylePack = {
  id: "creator-explainer",
  label: "Creator Explainer",
  description: "Gaya explainer modern dengan kartu ringan, sticker, dan gerakan cepat yang tetap terbaca.",
  theme: {
    mood: "Creator Explainer",
    bg: "#f8f5ee",
    surface: "#ffffff",
    ink: "#17213b",
    muted: "#9aa1b5",
    accent: "#ef4b4f",
    accent2: "#3867d6",
    font: "grotesk" as FontKey,
    background: "paper-grid" as BackgroundStyle,
    particles: "none",
  },
  cardRadius: 0.035,
  borderWidth: 0.005,
  shadow: "soft",
  iconStyle: "outline",
  motionProfiles: ["spring-pop", "slide-stagger", "drag-drop", "idle-bob", "wipe-highlight", "camera-push"],
  subtitleTreatments: [
    { id: "word-punch", label: "Sorot kata penting", highlight: "word", placement: "bottom" },
    { id: "marker-highlight", label: "Highlight marker", highlight: "phrase", placement: "bottom" },
  ],
  assetIds: VISUAL_ASSETS.filter((asset) => asset.compatibleStyles.includes("creator-explainer")).map((asset) => asset.id),
  beatTempoSeconds: [1.5, 2.5],
  density: "airy",
};

export const STYLE_PACKS: Record<string, StylePack> = {
  "creator-explainer": CREATOR_EXPLAINER,
};

export function getStylePack(id: string | undefined): StylePack {
  return STYLE_PACKS[id ?? ""] ?? CREATOR_EXPLAINER;
}

export function getVisualAsset(id: string | undefined, stylePackId = "creator-explainer"): VisualAsset | undefined {
  if (!id) return undefined;
  const asset = VISUAL_ASSETS.find((candidate) => candidate.id === id);
  if (!asset || !asset.compatibleStyles.includes(stylePackId)) return undefined;
  return asset;
}

export function resolveAssetIcon(id: string | undefined, stylePackId = "creator-explainer"): string | undefined {
  return getVisualAsset(id, stylePackId)?.fallbackIcon;
}
