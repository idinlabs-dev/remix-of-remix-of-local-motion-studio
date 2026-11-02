import { createFileRoute } from "@tanstack/react-router";
import { downloadGitHubArtifact } from "@/lib/github/github.server";

export const Route = createFileRoute("/api/github/artifact")({
  server: {
    handlers: {
      GET: async ({ request }) => downloadGitHubArtifact(request),
    },
  },
});
