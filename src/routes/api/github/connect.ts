import { createFileRoute } from "@tanstack/react-router";
import { beginGitHubOAuth } from "@/lib/github/github.server";

export const Route = createFileRoute("/api/github/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => beginGitHubOAuth(request),
    },
  },
});
