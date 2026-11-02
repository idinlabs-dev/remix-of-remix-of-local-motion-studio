import { afterEach, describe, expect, it, vi } from "vitest";

import { checkKieKey } from "@/lib/ai/kie.server";

function mockCreditResponse(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Kie.ai activation validation", () => {
  it("rejects a key with zero credits before activation", async () => {
    mockCreditResponse(200, { code: 200, msg: "success", data: 0 });
    await expect(checkKieKey("synthetic-api-key")).rejects.toThrow(/Saldo API key Kie.ai habis/);
  });

  it("accepts a valid key with positive credits", async () => {
    mockCreditResponse(200, { code: 200, msg: "success", data: 12.5 });
    await expect(checkKieKey("synthetic-api-key")).resolves.toEqual({ credits: 12.5 });
  });

  it("rejects an invalid API key", async () => {
    mockCreditResponse(401, { code: 401, msg: "unauthorized" });
    await expect(checkKieKey("synthetic-api-key")).rejects.toThrow(/Kode akses tidak valid/);
  });
});
