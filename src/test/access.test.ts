import { describe, expect, it } from "vitest";

import { checkAiGate, checkRenderGate } from "@/lib/access/plans";

describe("access usage gates", () => {
  it("requires access before rendering", () => {
    expect(checkRenderGate(null, 30, "explainer", "project-1")).toMatchObject({ ok: false });
  });

  it("blocks a new project when the plan quota is exhausted", () => {
    const used = Array.from({ length: 30 }, (_, i) => `project-${i}`);
    expect(
      checkRenderGate({ plan: "starter", used }, 30, "explainer", "new-project"),
    ).toMatchObject({ ok: false });
    expect(
      checkAiGate(
        { plan: "starter", used },
        { projectId: "new-project", durationSec: 30, mode: "explainer" },
      ),
    ).toMatchObject({ ok: false });
  });

  it("allows rerendering a project already counted against quota", () => {
    const state = { plan: "starter" as const, used: ["project-1"] };
    expect(checkRenderGate(state, 30, "explainer", "project-1")).toEqual({
      ok: true,
      consumes: false,
    });
  });

  it("enforces plan duration and mode restrictions", () => {
    const starter = { plan: "starter" as const, used: [] };
    expect(checkRenderGate(starter, 92, "explainer", "project-1")).toMatchObject({ ok: false });
    expect(checkRenderGate(starter, 30, "edit", "project-1")).toMatchObject({ ok: false });
  });
});
