import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import {
  clearCookie,
  cookieValue,
  isLocalReturnPath,
  openOAuthState,
  openSession,
  sealOAuthState,
  sealSession,
  setCookie,
  type GitHubSession,
  type OAuthState,
} from "./session";
import {
  RENDER_REPO_FILES,
  RENDER_REPO_MARKER,
  RENDER_REPO_MARKER_PATH,
  RENDER_REPO_NAME,
  RENDER_WORKFLOW_PATH,
} from "./runner-template";

const SESSION_COOKIE = "__Host-ars_github";
const STATE_COOKIE = "__Host-ars_github_state";
const API_ROOT = "https://api.github.com";
const API_VERSION = "2026-03-10";

type GitHubConfig = {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  sessionSecret: string;
};

type GitHubUser = {
  id: number;
  login: string;
  avatar_url?: string;
};

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
};

type GitHubContent = {
  content?: string;
  encoding?: string;
  sha?: string;
};

export class GitHubIntegrationError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

function runtimeEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}

function config(): GitHubConfig | null {
  const env = runtimeEnv();
  const clientId = env["GITHUB_APP_CLIENT_ID"];
  const clientSecret = env["GITHUB_APP_CLIENT_SECRET"];
  const sessionSecret = env["GITHUB_SESSION_SECRET"];
  const callbackUrl = env["GITHUB_APP_CALLBACK_URL"];
  if (!clientId || !clientSecret || !sessionSecret || !callbackUrl) return null;
  if (sessionSecret.length < 32) return null;
  try {
    const callback = new URL(callbackUrl);
    const secureOrigin = callback.protocol === "https:" || callback.hostname === "localhost";
    if (!secureOrigin || callback.pathname !== "/api/github/callback") return null;
  } catch {
    return null;
  }
  return { clientId, clientSecret, callbackUrl, sessionSecret };
}

export function isGitHubConfigured(): boolean {
  return config() !== null;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(value.replace(/\s/g, "")), (c) => c.charCodeAt(0)),
  );
}

function jsonHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function githubPermissionMessage(path: string): string {
  if (path === "/user/repos")
    return "GitHub App belum punya izin membuat repository. Aktifkan Repository creation: Read and write, lalu hubungkan ulang GitHub.";
  if (path.includes("/contents/.github/workflows"))
    return "GitHub App belum punya izin memasang workflow render. Aktifkan Contents: Read and write serta Workflows: Read and write, lalu hubungkan ulang GitHub.";
  if (path.includes("/actions/workflows"))
    return "GitHub App belum punya izin menjalankan workflow. Aktifkan Actions: Read and write serta Workflows: Read and write, lalu hubungkan ulang GitHub.";
  if (path.includes("/actions/"))
    return "GitHub App belum punya izin membaca atau mengelola proses render. Aktifkan Actions: Read and write, lalu hubungkan ulang GitHub.";
  if (path.includes("/releases") || path.includes("/git/refs"))
    return "GitHub App belum punya izin mengelola paket render sementara. Aktifkan Contents: Read and write, lalu hubungkan ulang GitHub.";
  return "Izin GitHub belum lengkap. Aktifkan izin GitHub App yang dibutuhkan, lalu hubungkan ulang GitHub.";
}

async function githubRequest<T>(
  session: GitHubSession,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(jsonHeaders(session.accessToken));
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `GitHub API menolak permintaan (${response.status}).`;
    const friendlyMessage =
      response.status === 401
        ? "Koneksi GitHub kedaluwarsa. Hubungkan ulang akun untuk melanjutkan."
        : response.status === 403
          ? githubPermissionMessage(path)
          : message;
    throw new GitHubIntegrationError(friendlyMessage, response.status);
  }
  return payload as T;
}

async function refreshSession(
  session: GitHubSession,
  settings: GitHubConfig,
): Promise<GitHubSession | null> {
  if (session.accessExpiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken || session.refreshExpiresAt <= Date.now()) return null;
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
  });
  const result = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
    error?: string;
  } | null;
  if (!response.ok || !result?.access_token) return null;
  const now = Date.now();
  const next: GitHubSession = {
    ...session,
    accessToken: result.access_token,
    refreshToken: result.refresh_token ?? session.refreshToken,
    accessExpiresAt:
      typeof result.expires_in === "number"
        ? now + Math.max(60, result.expires_in) * 1000
        : Number.MAX_SAFE_INTEGER,
    refreshExpiresAt:
      typeof result.refresh_token_expires_in === "number"
        ? now + Math.max(60, result.refresh_token_expires_in) * 1000
        : session.refreshExpiresAt,
  };
  setResponseHeader("Set-Cookie", await sessionCookie(next, settings));
  return next;
}

async function sessionCookie(session: GitHubSession, settings: GitHubConfig): Promise<string> {
  const maxAge = Math.max(0, Math.floor((session.refreshExpiresAt - Date.now()) / 1000));
  return setCookie(SESSION_COOKIE, await sealSession(session, settings.sessionSecret), maxAge);
}

async function currentSession(): Promise<GitHubSession | null> {
  const settings = config();
  if (!settings) return null;
  const value = cookieValue(getRequestHeader("cookie") ?? null, SESSION_COOKIE);
  if (!value) return null;
  const session = await openSession(value, settings.sessionSecret);
  if (!session) return null;
  const fresh = await refreshSession(session, settings);
  if (!fresh) setResponseHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
  return fresh;
}

function requireSession(session: GitHubSession | null): GitHubSession {
  if (!session)
    throw new GitHubIntegrationError("Hubungkan GitHub dulu untuk render otomatis.", 401);
  return session;
}

export async function githubStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  login?: string;
  avatarUrl?: string;
}> {
  const configured = isGitHubConfigured();
  if (!configured) return { configured: false, connected: false };
  const session = await currentSession();
  return session
    ? { configured: true, connected: true, login: session.login, avatarUrl: session.avatarUrl }
    : { configured: true, connected: false };
}

export async function beginGitHubOAuth(request: Request): Promise<Response> {
  const settings = config();
  if (!settings) return new Response("GitHub App belum dikonfigurasi.", { status: 503 });
  const requestUrl = new URL(request.url);
  const requestedPath = requestUrl.searchParams.get("returnTo") ?? "/";
  const returnTo = isLocalReturnPath(requestedPath) ? requestedPath : "/";
  const state: OAuthState = {
    nonce: crypto.randomUUID(),
    returnTo,
    expiresAt: Date.now() + 10 * 60_000,
  };
  const signedState = await sealOAuthState(state, settings.sessionSecret);
  const destination = new URL("https://github.com/login/oauth/authorize");
  destination.searchParams.set("client_id", settings.clientId);
  destination.searchParams.set("redirect_uri", settings.callbackUrl);
  destination.searchParams.set("state", state.nonce);
  destination.searchParams.set("allow_signup", "true");
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.toString(),
      "Set-Cookie": setCookie(STATE_COOKIE, signedState, 600),
      "Cache-Control": "no-store",
    },
  });
}

function redirectWithGitHubResult(
  request: Request,
  returnTo: string,
  result: "connected" | "error",
): Response {
  const target = new URL(returnTo, new URL(request.url).origin);
  target.searchParams.set("github", result);
  const headers = new Headers({ Location: target.toString(), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE));
  return new Response(null, { status: 302, headers });
}

export async function completeGitHubOAuth(request: Request): Promise<Response> {
  const settings = config();
  if (!settings) return new Response("GitHub App belum dikonfigurasi.", { status: 503 });
  const url = new URL(request.url);
  const denied = url.searchParams.get("error");
  const signedState = cookieValue(request.headers.get("cookie"), STATE_COOKIE);
  const state = signedState ? await openOAuthState(signedState, settings.sessionSecret) : null;
  const returnedState = url.searchParams.get("state");
  if (denied || !state || !returnedState || returnedState !== state.nonce) {
    return redirectWithGitHubResult(request, state?.returnTo ?? "/", "error");
  }
  const code = url.searchParams.get("code");
  if (!code) return redirectWithGitHubResult(request, state.returnTo, "error");

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        code,
        redirect_uri: settings.callbackUrl,
        state: returnedState,
      }),
    });
    const token = (await tokenResponse.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
    } | null;
    if (!tokenResponse.ok || !token?.access_token) {
      throw new GitHubIntegrationError(
        "GitHub tidak mengembalikan akses yang valid.",
        tokenResponse.status,
      );
    }
    const userResponse = await fetch(`${API_ROOT}/user`, {
      headers: jsonHeaders(token.access_token),
    });
    const user = (await userResponse.json().catch(() => null)) as GitHubUser | null;
    if (!userResponse.ok || !user?.login)
      throw new GitHubIntegrationError("Profil GitHub tidak bisa dibaca.", userResponse.status);

    const now = Date.now();
    const refreshLifetime =
      typeof token.refresh_token_expires_in === "number"
        ? Math.max(60, token.refresh_token_expires_in) * 1000
        : 365 * 24 * 60 * 60 * 1000;
    const session: GitHubSession = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? "",
      accessExpiresAt:
        typeof token.expires_in === "number"
          ? now + Math.max(60, token.expires_in) * 1000
          : Number.MAX_SAFE_INTEGER,
      refreshExpiresAt: now + refreshLifetime,
      login: user.login,
      avatarUrl: user.avatar_url ?? "",
    };
    const response = redirectWithGitHubResult(request, state.returnTo, "connected");
    response.headers.append("Set-Cookie", await sessionCookie(session, settings));
    return response;
  } catch (error) {
    console.error(
      "GitHub OAuth callback failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return redirectWithGitHubResult(request, state.returnTo, "error");
  }
}

export async function disconnectGitHub(): Promise<void> {
  const settings = config();
  const session = await currentSession();
  if (settings && session) {
    try {
      await fetch(`https://api.github.com/applications/${settings.clientId}/grant`, {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${btoa(`${settings.clientId}:${settings.clientSecret}`)}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: session.accessToken }),
      });
    } catch {
      // Token revocation best-effort; always remove the local session cookie.
    }
  }
  setResponseHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
}

async function repoContent(
  session: GitHubSession,
  repo: GitHubRepo,
  path: string,
): Promise<GitHubContent | null> {
  try {
    return await githubRequest<GitHubContent>(
      session,
      `/repos/${repo.full_name}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(repo.default_branch)}`,
    );
  } catch (error) {
    if (error instanceof GitHubIntegrationError && error.status === 404) return null;
    throw error;
  }
}

async function writeRepoFile(
  session: GitHubSession,
  repo: GitHubRepo,
  path: string,
  content: string,
): Promise<void> {
  const current = await repoContent(session, repo, path);
  if (
    current?.content &&
    current.encoding === "base64" &&
    decodeBase64(current.content) === content
  )
    return;
  await githubRequest(
    session,
    `/repos/${repo.full_name}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: current
          ? "Update Auto Remotion render runner"
          : "Set up Auto Remotion render runner",
        content: base64(new TextEncoder().encode(content)),
        branch: repo.default_branch,
        ...(current?.sha ? { sha: current.sha } : {}),
      }),
    },
  );
}

async function userRepo(session: GitHubSession, name: string): Promise<GitHubRepo | null> {
  try {
    return await githubRequest<GitHubRepo>(session, `/repos/${session.login}/${name}`);
  } catch (error) {
    if (error instanceof GitHubIntegrationError && error.status === 404) return null;
    throw error;
  }
}

async function createOrGetRepo(session: GitHubSession): Promise<GitHubRepo> {
  try {
    return await githubRequest<GitHubRepo>(session, "/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: RENDER_REPO_NAME,
        description: "Private render runner managed by Auto Remotion Studio",
        private: true,
        auto_init: true,
        has_issues: false,
        has_projects: false,
        has_wiki: false,
      }),
    });
  } catch (error) {
    if (!(error instanceof GitHubIntegrationError && error.status === 422)) throw error;
    const existing = await userRepo(session, RENDER_REPO_NAME);
    if (!existing) throw error;
    const marker = await repoContent(session, existing, RENDER_REPO_MARKER_PATH);
    if (
      marker?.content &&
      marker.encoding === "base64" &&
      decodeBase64(marker.content).includes('"app": "Auto Remotion Studio"')
    ) {
      return existing;
    }
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session.login.toLowerCase())),
    );
    const suffix = Array.from(digest.subarray(0, 4), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const alternate = `auto-remotion-render-${suffix}`;
    try {
      return await githubRequest<GitHubRepo>(session, "/user/repos", {
        method: "POST",
        body: JSON.stringify({
          name: alternate,
          description: "Private render runner managed by Auto Remotion Studio",
          private: true,
          auto_init: true,
          has_issues: false,
          has_projects: false,
          has_wiki: false,
        }),
      });
    } catch (alternateError) {
      if (!(alternateError instanceof GitHubIntegrationError && alternateError.status === 422))
        throw alternateError;
      const found = await userRepo(session, alternate);
      const foundMarker = found ? await repoContent(session, found, RENDER_REPO_MARKER_PATH) : null;
      if (
        !found ||
        !foundMarker?.content ||
        !decodeBase64(foundMarker.content).includes('"app": "Auto Remotion Studio"')
      ) {
        throw new GitHubIntegrationError(
          "Repo render tidak bisa disiapkan otomatis. Coba lagi atau hubungi dukungan.",
          409,
        );
      }
      return found;
    }
  }
}

async function ensureRepositoryForSession(
  session: GitHubSession,
): Promise<{ session: GitHubSession; repo: GitHubRepo; created: boolean }> {
  let repo: GitHubRepo | null = null;
  let created = false;
  if (session.repository?.fullName) {
    try {
      repo = await githubRequest<GitHubRepo>(session, `/repos/${session.repository.fullName}`);
    } catch (error) {
      if (!(error instanceof GitHubIntegrationError && error.status === 404)) throw error;
    }
  }
  if (!repo) {
    repo = await createOrGetRepo(session);
    created = true;
  }
  if (
    !repo.private ||
    repo.full_name.split("/")[0]?.toLowerCase() !== session.login.toLowerCase()
  ) {
    throw new GitHubIntegrationError(
      "Repo render harus private dan berada di akun GitHub yang terhubung.",
      403,
    );
  }
  const marker = await repoContent(session, repo, RENDER_REPO_MARKER_PATH);
  if (marker?.content && !decodeBase64(marker.content).includes('"app": "Auto Remotion Studio"')) {
    throw new GitHubIntegrationError(
      "Repo bernama render sudah ada dan tidak dikelola Auto Remotion Studio.",
      409,
    );
  }
  for (const file of RENDER_REPO_FILES) await writeRepoFile(session, repo, file.path, file.content);
  const stored: GitHubSession = {
    ...session,
    repository: { id: repo.id, fullName: repo.full_name, defaultBranch: repo.default_branch },
  };
  return { session: stored, repo, created };
}

type GitHubRelease = { id: number; upload_url: string };
type GitHubWorkflowDispatch = { workflow_run_id: number };
type GitHubRun = {
  id: number;
  status: "queued" | "in_progress" | "completed" | string;
  conclusion: string | null;
  repository?: { id: number };
};
type GitHubArtifacts = {
  artifacts: Array<{ id: number; name: string; expired: boolean }>;
};

function isValidRenderTag(value: string): boolean {
  return /^ar-render-[a-f0-9-]{36}$/.test(value);
}

async function deleteTemporaryRelease(
  session: GitHubSession,
  repo: GitHubRepo,
  tag: string,
): Promise<void> {
  if (!isValidRenderTag(tag)) return;
  try {
    const release = await githubRequest<{ id: number }>(
      session,
      `/repos/${repo.full_name}/releases/tags/${encodeURIComponent(tag)}`,
    );
    await githubRequest(session, `/repos/${repo.full_name}/releases/${release.id}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (!(error instanceof GitHubIntegrationError && error.status === 404)) {
      console.warn("Could not remove temporary render release.");
    }
  }
  try {
    await githubRequest(
      session,
      `/repos/${repo.full_name}/git/refs/tags/${encodeURIComponent(tag)}`,
      { method: "DELETE" },
    );
  } catch {
    // GitHub may already have removed the ref with the release.
  }
}

export async function beginGitHubRender(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Permintaan tidak diizinkan." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/zip")) {
    return Response.json({ error: "Paket project tidak valid." }, { status: 415 });
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_RENDER_PACKAGE_BYTES) {
    return Response.json(
      {
        error:
          "File project terlalu besar untuk render GitHub. Coba kecilkan media atau render lokal.",
      },
      { status: 413 },
    );
  }

  const settings = config();
  if (!settings) return Response.json({ error: "GitHub belum tersedia." }, { status: 503 });
  let cleanupContext: { session: GitHubSession; repo: GitHubRepo; tag: string } | null = null;
  try {
    const initialSession = requireSession(await currentSession());
    const packageBytes = await request.arrayBuffer();
    if (packageBytes.byteLength === 0 || packageBytes.byteLength > MAX_RENDER_PACKAGE_BYTES) {
      return Response.json(
        { error: "Ukuran project tidak valid atau melebihi batas render." },
        { status: 413 },
      );
    }
    const { session, repo } = await ensureRepositoryForSession(initialSession);
    setResponseHeader("Set-Cookie", await sessionCookie(session, settings));
    const tag = newRenderTag();
    cleanupContext = { session, repo, tag };
    const release = await githubRequest<GitHubRelease>(
      session,
      `/repos/${repo.full_name}/releases`,
      {
        method: "POST",
        body: JSON.stringify({
          tag_name: tag,
          name: "Temporary Auto Remotion render input",
          body: "Temporary private source package. Auto Remotion Studio removes it after the render job ends.",
          draft: false,
          prerelease: true,
        }),
      },
    );
    const uploadUrl = release.upload_url.replace(
      "{?name,label}",
      `?name=${encodeURIComponent("project.zip")}`,
    );
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
        "Content-Type": "application/zip",
        "Content-Length": String(packageBytes.byteLength),
      },
      body: packageBytes,
    });
    if (!upload.ok) {
      throw new GitHubIntegrationError(
        `Gagal mengunggah paket render ke GitHub (${upload.status}).`,
        upload.status,
      );
    }
    const dispatch = await githubRequest<GitHubWorkflowDispatch>(
      session,
      `/repos/${repo.full_name}/actions/workflows/render-remotion.yml/dispatches`,
      {
        method: "POST",
        body: JSON.stringify({ ref: repo.default_branch, inputs: { release_tag: tag } }),
      },
    );
    if (!Number.isInteger(dispatch.workflow_run_id)) {
      throw new GitHubIntegrationError("GitHub tidak mengembalikan ID proses render.", 502);
    }
    return Response.json(
      { runId: dispatch.workflow_run_id, tag },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (cleanupContext)
      await deleteTemporaryRelease(cleanupContext.session, cleanupContext.repo, cleanupContext.tag);
    if (error instanceof GitHubIntegrationError) {
      return Response.json(
        { error: error.message },
        { status: error.status >= 400 && error.status < 600 ? error.status : 500 },
      );
    }
    console.error(
      "GitHub render start failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return Response.json(
      { error: "Render GitHub tidak bisa dimulai. Coba lagi sebentar." },
      { status: 502 },
    );
  }
}

async function renderRepository(
  session: GitHubSession,
): Promise<{ session: GitHubSession; repo: GitHubRepo }> {
  if (session.repository) {
    const repo = await githubRequest<GitHubRepo>(session, `/repos/${session.repository.fullName}`);
    if (repo.id !== session.repository.id || !repo.private) {
      throw new GitHubIntegrationError("Repo render privat tidak ditemukan.", 404);
    }
    return { session, repo };
  }
  const result = await ensureRepositoryForSession(session);
  const settings = config();
  if (settings) setResponseHeader("Set-Cookie", await sessionCookie(result.session, settings));
  return { session: result.session, repo: result.repo };
}

export async function githubRenderStatus(
  runId: number,
  tag: string,
): Promise<{
  status: string;
  conclusion: string | null;
}> {
  if (!Number.isSafeInteger(runId) || runId < 1 || !isValidRenderTag(tag)) {
    throw new GitHubIntegrationError("ID render tidak valid.", 400);
  }
  const initial = requireSession(await currentSession());
  const { session, repo } = await renderRepository(initial);
  const run = await githubRequest<GitHubRun>(
    session,
    `/repos/${repo.full_name}/actions/runs/${runId}`,
  );
  if (run.repository?.id !== repo.id)
    throw new GitHubIntegrationError("Proses render tidak ditemukan di akun ini.", 404);
  if (run.status === "completed") await deleteTemporaryRelease(session, repo, tag);
  return { status: run.status, conclusion: run.conclusion };
}

export async function cancelGitHubRender(runId: number, tag: string): Promise<void> {
  if (!Number.isSafeInteger(runId) || runId < 1 || !isValidRenderTag(tag)) {
    throw new GitHubIntegrationError("ID render tidak valid.", 400);
  }
  const initial = requireSession(await currentSession());
  const { session, repo } = await renderRepository(initial);
  const run = await githubRequest<GitHubRun>(
    session,
    `/repos/${repo.full_name}/actions/runs/${runId}`,
  );
  if (run.repository?.id !== repo.id)
    throw new GitHubIntegrationError("Proses render tidak ditemukan di akun ini.", 404);
  if (run.status !== "completed") {
    await githubRequest(session, `/repos/${repo.full_name}/actions/runs/${runId}/cancel`, {
      method: "POST",
    });
  }
  await deleteTemporaryRelease(session, repo, tag);
}

export async function downloadGitHubArtifact(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const runId = Number(url.searchParams.get("runId"));
  const tag = url.searchParams.get("tag") ?? "";
  if (!Number.isSafeInteger(runId) || runId < 1 || !isValidRenderTag(tag)) {
    return Response.json({ error: "ID render tidak valid." }, { status: 400 });
  }
  try {
    const initial = requireSession(await currentSession());
    const { session, repo } = await renderRepository(initial);
    const run = await githubRequest<GitHubRun>(
      session,
      `/repos/${repo.full_name}/actions/runs/${runId}`,
    );
    if (
      run.repository?.id !== repo.id ||
      run.status !== "completed" ||
      run.conclusion !== "success"
    ) {
      return Response.json({ error: "Video belum tersedia." }, { status: 409 });
    }
    const artifacts = await githubRequest<GitHubArtifacts>(
      session,
      `/repos/${repo.full_name}/actions/runs/${runId}/artifacts?per_page=100`,
    );
    const artifact = artifacts.artifacts.find(
      (item) => item.name === `render-${tag}` && !item.expired,
    );
    if (!artifact)
      return Response.json({ error: "Artifact video tidak ditemukan." }, { status: 404 });
    const download = await fetch(
      `${API_ROOT}/repos/${repo.full_name}/actions/artifacts/${artifact.id}/zip`,
      {
        headers: jsonHeaders(session.accessToken),
        redirect: "follow",
      },
    );
    if (!download.ok || !download.body) {
      return Response.json({ error: "Video tidak bisa diunduh dari GitHub." }, { status: 502 });
    }
    return new Response(download.body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="render-${tag}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof GitHubIntegrationError ? error.status : 500;
    const message = error instanceof GitHubIntegrationError ? error.message : "Unduhan gagal.";
    return Response.json({ error: message }, { status });
  }
}

export function newRenderTag(): string {
  return `ar-render-${crypto.randomUUID()}`;
}

export const MAX_RENDER_PACKAGE_BYTES = 70 * 1024 * 1024;
