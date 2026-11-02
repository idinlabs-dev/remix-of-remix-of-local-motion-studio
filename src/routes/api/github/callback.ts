import { createFileRoute } from "@tanstack/react-router";
import { completeGitHubOAuth } from "@/lib/github/github.server";

export const Route = createFileRoute("/api/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => completeGitHubOAuth(request),
    },
  },
});
