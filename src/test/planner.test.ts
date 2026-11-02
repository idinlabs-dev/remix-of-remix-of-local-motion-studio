import { describe, expect, it } from "vitest";

import { explicitIcon, guessIcon } from "@/lib/engine/planner";

describe("semantic icon selection", () => {
  it("prioritizes the concrete mechanism mentioned in a sentence", () => {
    expect(guessIcon("Piston mendorong cairan di dalam mesin", 0)).toBe("cog");
    expect(guessIcon("Pembakaran bahan bakar menghasilkan panas", 1)).toBe("fuel");
    expect(guessIcon("Tekanan meningkat di dalam ruang", 2)).toBe("gauge");
  });

  it("does not invent a topic icon when the text has no explicit topic keyword", () => {
    expect(explicitIcon("Pada akhirnya, semuanya berubah.")).toBeUndefined();
  });
});
