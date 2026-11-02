import { describe, expect, it } from "vitest";

import { parseAccessCode } from "@/lib/access/plans";

describe("admin-issued access codes", () => {
  it("accepts a valid raw API key as a Starter code without checking provider credits", () => {
    expect(parseAccessCode("abcd1234efgh5678ijkl9012mnop3456")).toEqual({
      plan: "starter",
      key: "abcd1234efgh5678ijkl9012mnop3456",
    });
  });

  it("uses the PRO prefix to select the Pro package", () => {
    expect(parseAccessCode("PRO-abcd1234efgh5678ijkl9012mnop3456")).toEqual({
      plan: "pro",
      key: "abcd1234efgh5678ijkl9012mnop3456",
    });
  });

  it("rejects malformed access code formats", () => {
    expect(parseAccessCode("not a valid key")).toBeNull();
  });
});
