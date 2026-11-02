export const SITE_NAME = "Auto Remotion Studio";
export const SITE_TAGLINE = "AI motion video studio untuk kreator global";
export const SITE_DESCRIPTION =
  "Ubah naskah, audio narasi, atau video pembicara menjadi motion video dengan AI Creative Director dan render langsung di device.";

const configuredOrigin = (import.meta.env["VITE_SITE_URL"] as string | undefined)?.trim().replace(/\/$/, "");

export function absoluteUrl(path: string): string | undefined {
  if (!configuredOrigin) return undefined;
  return `${configuredOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function canonicalLink(path: string) {
  const href = absoluteUrl(path);
  return href ? [{ rel: "canonical", href }] : [];
}

export function socialUrlMeta(path: string) {
  const url = absoluteUrl(path);
  return url ? [{ property: "og:url", content: url }] : [];
}
