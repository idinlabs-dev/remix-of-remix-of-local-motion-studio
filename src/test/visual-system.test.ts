import { describe, expect, it } from "vitest";

import { getStylePack, getVisualAsset, resolveAssetIcon } from "@/lib/engine/visual-system";
import { newComposition, normalizeComposition } from "@/lib/engine/types";

describe("visual system", () => {
  it("menyediakan Creator Explainer dengan asset minimum", () => {
    const pack = getStylePack("creator-explainer");
    expect(pack.id).toBe("creator-explainer");
    expect(pack.assetIds).toContain("creator-folder");
    expect(pack.motionProfiles).toContain("spring-pop");
  });

  it("mengembalikan fallback icon hanya untuk asset yang tersedia", () => {
    expect(getVisualAsset("creator-folder")?.fallbackIcon).toBe("folder-open");
    expect(resolveAssetIcon("creator-checkmark")).toBe("check");
    expect(resolveAssetIcon("asset-yang-tidak-ada")).toBeUndefined();
  });

  it("memberi style pack default tanpa merusak data composition lama", () => {
    expect(newComposition("Demo").stylePackId).toBe("creator-explainer");
    expect(normalizeComposition({ title: "Legacy", scenes: [] }).stylePackId).toBe("creator-explainer");
  });
});
