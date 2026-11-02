import { afterEach, describe, expect, it, vi } from "vitest";

import { checkKieKey } from "@/lib/ai/kie.server";

function mockCredits(credits: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 200, msg: "success", data: credits }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Kie.ai API key validation", () => {
  it("allows activating a valid key even when its Kie.ai credit balance is zero", async () => {
    mockCredits(0);
    await expect(checkKieKey("test-api-key", { requireCredits: false })).resolves.toEqual({
      credits: 0,
    });
  });

  it("still blocks AI calls when the Kie.ai balance is zero", async () => {
    mockCredits(0);
    await expect(checkKieKey("test-api-key")).rejects.toThrow(/Saldo kredit akun Kie.ai/);
  });

  it("accepts an active key with positive credits for AI calls", async () => {
    mockCredits(12.5);
    await expect(checkKieKey("test-api-key")).resolves.toEqual({ credits: 12.5 });
  });
});
