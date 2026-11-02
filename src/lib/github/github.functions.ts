import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getGitHubStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { githubStatus } = await import("./github.server");
  return githubStatus();
});

export const disconnectGitHub = createServerFn({ method: "POST" }).handler(async () => {
  const { disconnectGitHub: disconnect } = await import("./github.server");
  await disconnect();
  return { ok: true };
});

export const getGitHubRenderStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        runId: z.number().int().positive(),
        tag: z.string().regex(/^ar-render-[a-f0-9-]{36}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { githubRenderStatus } = await import("./github.server");
    return githubRenderStatus(data.runId, data.tag);
  });

export const cancelGitHubRender = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        runId: z.number().int().positive(),
        tag: z.string().regex(/^ar-render-[a-f0-9-]{36}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { cancelGitHubRender: cancel } = await import("./github.server");
    await cancel(data.runId, data.tag);
    return { ok: true };
  });
