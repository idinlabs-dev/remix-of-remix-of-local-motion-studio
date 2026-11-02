// Daftar ikon universal (lintas genre) yang boleh dipilih AI. Murni data —
// aman dipakai server (validasi) & client (render).

export const ICON_NAMES = [
  // alam & petualangan
  "mountain", "mountain-snow", "tree-pine", "trees", "tent", "compass", "sun", "moon", "moon-star",
  "cloud-rain", "cloud-lightning", "cloud-fog", "snowflake", "flame", "droplet", "wind", "leaf", "waves",
  "tornado", "rainbow", "thermometer", "sunrise", "sunset", "sprout", "flower", "feather", "shell",
  // misteri & horor
  "ghost", "skull", "eye", "eye-off", "key-round", "lock", "door-open", "house", "castle", "church",
  "bone", "fingerprint", "siren", "lamp", "drama", "spade",
  // sains & teknologi
  "atom", "flask-conical", "microscope", "dna", "brain", "rocket", "orbit", "telescope", "cpu", "zap",
  "magnet", "satellite", "radiation", "biohazard", "bot", "code", "server", "database", "plug",
  "battery-charging", "wifi", "smartphone", "laptop",
  // dunia & sejarah
  "globe", "earth", "map", "map-pin", "landmark", "scroll", "crown", "sword", "swords", "shield",
  "hourglass", "clock", "calendar", "anchor", "gavel", "scale", "newspaper", "flag",
  // bisnis & finansial
  "trending-up", "trending-down", "chart-line", "chart-bar", "chart-pie", "coins", "wallet", "bitcoin",
  "banknote", "piggy-bank", "dollar-sign", "circle-dollar-sign", "percent", "calculator", "receipt",
  "briefcase", "building", "building-2", "factory", "store", "shopping-cart", "handshake",
  // kesehatan & tubuh
  "heart", "heart-pulse", "stethoscope", "pill", "syringe", "hospital", "apple", "dumbbell", "bike",
  "footprints", "hand", "hand-heart",
  // orang & emosi
  "user", "users", "baby", "smile", "frown", "laugh", "angry", "meh", "thumbs-up", "thumbs-down",
  "message-circle", "megaphone", "quote",
  // edukasi, kreatif & hiburan
  "lightbulb", "book-open", "graduation-cap", "school", "pen-tool", "palette", "camera", "film",
  "clapperboard", "video", "music", "mic", "headphones", "podcast", "radio", "tv", "gamepad-2",
  "ticket", "dice-5", "puzzle",
  // pencapaian & simbol
  "trophy", "medal", "target", "star", "sparkles", "sparkle", "gem", "gift", "badge-check", "infinity",
  "triangle-alert", "circle-help", "check", "x", "ban", "search", "arrow-right", "arrow-up", "gauge",
  "timer", "alarm-clock",
  // transportasi & hidup sehari-hari
  "car", "plane", "ship", "train-front", "fuel", "tractor", "wrench", "hammer", "cog", "recycle",
  "pickaxe", "utensils", "coffee", "pizza", "wheat", "wine", "glasses", "shirt",
  // hewan
  "fish", "bird", "dog", "cat", "bug", "paw-print", "rabbit", "turtle", "snail", "egg",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const SET = new Set<string>(ICON_NAMES);

export function isIconName(v: unknown): v is IconName {
  return typeof v === "string" && SET.has(v);
}

/** Nama ikon valid, atau fallback universal. */
export function safeIcon(v: unknown, fallback: IconName = "sparkles"): IconName {
  if (isIconName(v)) return v;
  if (typeof v === "string") {
    const k = v.trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (SET.has(k)) return k as IconName;
  }
  return fallback;
}
