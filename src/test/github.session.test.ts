import { describe, expect, it } from "vitest";
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
} from "@/lib/github/session";
import { RENDER_WORKFLOW, RENDER_WORKFLOW_PATH } from "@/lib/github/runner-template";

const secret = "test-only-secret-with-sufficient-entropy";
const session: GitHubSession = {
  accessToken: "access-token-test",
  refreshToken: "refresh-token-test",
  accessExpiresAt: Date.now() + 60_000,
  refreshExpiresAt: Date.now() + 60_000_000,
  login: "creator-test",
  avatarUrl: "https://avatars.githubusercontent.com/u/1",
};

describe("GitHub connection session helpers", () => {
  it("encrypts a session and only recovers it with the same secret", async () => {
    const sealed = await sealSession(session, secret);
    expect(sealed).not.toContain(session.accessToken);
    await expect(openSession(sealed, secret)).resolves.toEqual(session);
    await expect(openSession(sealed, "a-different-secret")).resolves.toBeNull();
  });

  it("rejects expired or tampered sessions", async () => {
    const expired = await sealSession({ ...session, refreshExpiresAt: Date.now() - 1 }, secret);
    expect(await openSession(expired, secret)).toBeNull();
    expect(await openSession("not-a-session", secret)).toBeNull();
  });

  it("signs OAuth state and rejects changes or external return URLs", async () => {
    const state = {
      nonce: "nonce-test",
      returnTo: "/project/test-id",
      expiresAt: Date.now() + 60_000,
    };
    const sealed = await sealOAuthState(state, secret);
    expect(await openOAuthState(sealed, secret)).toEqual(state);
    const [payload, signature] = sealed.split(".");
    const tamperedSignature = `${signature?.[0] === "A" ? "B" : "A"}${signature?.slice(1) ?? ""}`;
    expect(await openOAuthState(`${payload}.${tamperedSignature}`, secret)).toBeNull();
    expect(isLocalReturnPath("https://evil.example/path")).toBe(false);
    expect(isLocalReturnPath("//evil.example/path")).toBe(false);
    expect(isLocalReturnPath("/\\evil.example/path")).toBe(false);
    expect(isLocalReturnPath("/project/test-id")).toBe(true);
  });

  it("sets secure, HttpOnly, host-only cookies and clears them", () => {
    const cookie = setCookie("__Host-test", "opaque", 600);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=None");
    expect(cookieValue("other=x; __Host-test=opaque", "__Host-test")).toBe("opaque");
    expect(clearCookie("__Host-test")).toContain("Max-Age=0");
  });
});

describe("GitHub Actions render runner template", () => {
  it("uses explicit dispatch, read-only repo permission, and short-lived artifacts", () => {
    expect(RENDER_WORKFLOW_PATH).toBe(".github/workflows/render-remotion.yml");
    expect(RENDER_WORKFLOW).toContain("workflow_dispatch:");
    const [renderJob, cleanupJob = ""] = RENDER_WORKFLOW.split("  cleanup:");
    expect(renderJob).toContain("contents: read");
    expect(renderJob).toContain("persist-credentials: false");
    expect(renderJob).toContain("retention-days: 1");
    expect(renderJob).not.toContain("contents: write");
    expect(cleanupJob).toContain("if: always()");
    expect(cleanupJob).toContain("contents: write");
    expect(cleanupJob).not.toContain("checkout");
    expect(cleanupJob).not.toContain("npm install");
    expect(RENDER_WORKFLOW).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
    expect(RENDER_WORKFLOW).toContain(
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    );
    expect(RENDER_WORKFLOW).toContain(
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    );
    expect(RENDER_WORKFLOW).not.toContain("on:\n  push:");
  });
});
