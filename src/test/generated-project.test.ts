import { describe, expect, it } from "vitest";

import {
  composeGeneratedProject,
  defaultGeneratedManifest,
  generatedProjectManifestSchema,
  validateGeneratedProject,
} from "@/lib/export/generated-project";
import { newComposition } from "@/lib/engine/types";

describe("generated Remotion project", () => {
  it("composes required per-content source files", () => {
    const comp = newComposition("Gunung api");
    comp.scenes = [
      {
        id: "s-1",
        start: 0,
        end: 2,
        text: "Lava panas mengalir",
        layout: "icon",
        transition: "fade",
      },
    ];
    const source = composeGeneratedProject(comp, defaultGeneratedManifest(comp), comp);
    expect(validateGeneratedProject(source)).toEqual({ ok: true });
    expect(source.files["src/Video.tsx"]).toContain("AI_SCENE_DESIGNS");
    expect(source.files["src/Video.tsx"]).toContain("generatedKind: design.visualKind");
    expect(source.files["src/StudioVisual.tsx"]).toContain("switch (scene.generatedKind)");
    expect(source.files["src/StudioVisual.tsx"]).toContain('case "ritual"');
    expect(source.files["src/StudioVisual.tsx"]).toContain('case "lightning"');
    expect(source.files["src/Root.tsx"]).toContain("Composition");
    expect(source.files["timing.json"]).toContain("Gunung api");
  });

  it("parses only concrete visualKind values in the manifest", () => {
    const comp = newComposition("Ilmu gaib dan petir");
    comp.scenes = [
      {
        id: "s-1",
        start: 0,
        end: 2,
        text: "Ritual memanggil petir",
        layout: "icon",
        transition: "fade",
      },
    ];
    const manifest = defaultGeneratedManifest(comp);
    expect(generatedProjectManifestSchema.safeParse(manifest).success).toBe(true);
    expect(
      generatedProjectManifestSchema.safeParse({
        ...manifest,
        scenes: [{ ...manifest.scenes[0], visualKind: "not-a-kind" }],
      }).success,
    ).toBe(false);
  });

  it("rejects traversal and executable source patterns", () => {
    const comp = newComposition("X");
    comp.scenes = [{ id: "s-1", start: 0, end: 1, text: "X", layout: "icon", transition: "fade" }];
    const source = composeGeneratedProject(comp, defaultGeneratedManifest(comp), comp);
    source.files["../escape.ts"] = "process.env.SECRET";
    const result = validateGeneratedProject(source);
    expect(result.ok).toBe(false);
  });
});
