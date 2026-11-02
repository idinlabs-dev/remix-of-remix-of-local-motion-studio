export interface GitHubSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  login: string;
  avatarUrl: string;
  repository?: {
    id: number;
    fullName: string;
    defaultBranch: string;
  };
}

export interface OAuthState {
  nonce: string;
  returnTo: string;
  expiresAt: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function sign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

export async function sealSession(session: GitHubSession, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(secret),
    encoder.encode(JSON.stringify(session)),
  );
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv);
  payload.set(new Uint8Array(ciphertext), iv.length);
  return toBase64Url(payload);
}

export async function openSession(value: string, secret: string): Promise<GitHubSession | null> {
  try {
    const payload = fromBase64Url(value);
    if (payload.length < 29) return null;
    const iv = Uint8Array.from(payload.slice(0, 12));
    const ciphertext = Uint8Array.from(payload.slice(12));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await aesKey(secret),
      ciphertext,
    );
    const candidate = JSON.parse(decoder.decode(plaintext)) as Partial<GitHubSession>;
    if (
      typeof candidate.accessToken !== "string" ||
      typeof candidate.refreshToken !== "string" ||
      typeof candidate.accessExpiresAt !== "number" ||
      typeof candidate.refreshExpiresAt !== "number" ||
      typeof candidate.login !== "string" ||
      typeof candidate.avatarUrl !== "string" ||
      (candidate.repository !== undefined &&
        (typeof candidate.repository !== "object" ||
          candidate.repository === null ||
          typeof candidate.repository.id !== "number" ||
          typeof candidate.repository.fullName !== "string" ||
          typeof candidate.repository.defaultBranch !== "string")) ||
      candidate.refreshExpiresAt <= Date.now()
    ) {
      return null;
    }
    return candidate as GitHubSession;
  } catch {
    return null;
  }
}

export async function sealOAuthState(state: OAuthState, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(state)));
  return `${payload}.${toBase64Url(await sign(payload, secret))}`;
}

export async function openOAuthState(value: string, secret: string): Promise<OAuthState | null> {
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra !== undefined) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureBytes = Uint8Array.from(fromBase64Url(signature));
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(payload));
    if (!valid) return null;
    const state = JSON.parse(decoder.decode(fromBase64Url(payload))) as Partial<OAuthState>;
    if (
      typeof state.nonce !== "string" ||
      typeof state.returnTo !== "string" ||
      typeof state.expiresAt !== "number" ||
      state.expiresAt <= Date.now() ||
      !isLocalReturnPath(state.returnTo)
    ) {
      return null;
    }
    return state as OAuthState;
  } catch {
    return null;
  }
}

export function isLocalReturnPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !Array.from(path).some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
  );
}

export function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0 || part.slice(0, index).trim() !== name) continue;
    return part.slice(index + 1).trim();
  }
  return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}; HttpOnly; Secure; SameSite=None`;
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`;
}
