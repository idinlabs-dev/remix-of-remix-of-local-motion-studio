import { createFileRoute } from "@tanstack/react-router";
import { beginGitHubRender } from "@/lib/github/github.server";

export const Route = createFileRoute("/api/github/render")({
  server: {
    handlers: {
      POST: async ({ request }) => beginGitHubRender(request),
    },
  },
});
