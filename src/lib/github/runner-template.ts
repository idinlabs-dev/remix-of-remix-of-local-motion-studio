const GH = "$";

export const RENDER_WORKFLOW_PATH = ".github/workflows/render-remotion.yml";
export const RENDER_REPO_MARKER_PATH = ".autoremotion-managed.json";
export const RENDER_REPO_NAME = "auto-remotion-render";

export const RENDER_REPO_MARKER = JSON.stringify(
  { app: "Auto Remotion Studio", schema: 1 },
  null,
  2,
);

export const RENDER_WORKFLOW = String.raw`name: Auto Remotion Render
run-name: Auto Remotion Render ${GH}{{ inputs.release_tag }}

on:
  workflow_dispatch:
    inputs:
      release_tag:
        description: Temporary source package identifier
        required: true
        type: string

permissions:
  contents: read

concurrency:
  group: ${GH}{{ github.repository }}-${GH}{{ inputs.release_tag }}
  cancel-in-progress: false

jobs:
  render:
    runs-on: ubuntu-24.04
    timeout-minutes: 90
    permissions:
      contents: read
    steps:
      - name: Checkout runner project
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with:
          node-version: 22

      - name: Validate run input
        env:
          RELEASE_TAG: ${GH}{{ inputs.release_tag }}
        run: |
          if [[ ! "$RELEASE_TAG" =~ ^ar-render-[a-f0-9-]{36}$ ]]; then
            echo "Invalid render identifier" >&2
            exit 1
          fi

      - name: Download temporary source package
        env:
          GH_TOKEN: ${GH}{{ github.token }}
          RELEASE_TAG: ${GH}{{ inputs.release_tag }}
        run: |
          mkdir -p input
          gh release download "$RELEASE_TAG" --repo "$GITHUB_REPOSITORY" --pattern project.zip --dir input
          test -s input/project.zip

      - name: Safely extract Remotion project
        run: |
          python3 - <<'PY'
          import pathlib, stat, zipfile
          from pathlib import PurePosixPath

          archive = pathlib.Path("input/project.zip")
          root = pathlib.Path("work/project")
          root.mkdir(parents=True, exist_ok=True)
          max_entries = 20000
          max_uncompressed = 1024 * 1024 * 1024
          with zipfile.ZipFile(archive) as zf:
              entries = zf.infolist()
              if len(entries) > max_entries:
                  raise SystemExit("Project archive contains too many files")
              if sum(entry.file_size for entry in entries) > max_uncompressed:
                  raise SystemExit("Project archive is too large after extraction")
              for entry in entries:
                  path = PurePosixPath(entry.filename)
                  mode = (entry.external_attr >> 16) & 0o170000
                  if path.is_absolute() or ".." in path.parts or mode == stat.S_IFLNK:
                      raise SystemExit("Unsafe path in project archive")
              zf.extractall(root)
          package = root / "package.json"
          if not package.exists():
              children = list(root.iterdir())
              if len(children) == 1 and children[0].is_dir() and (children[0] / "package.json").exists():
                  root = children[0]
                  package = root / "package.json"
          if not package.exists():
              raise SystemExit("package.json not found")
          with open("project-root.txt", "w", encoding="utf-8") as handle:
              handle.write(str(root.resolve()))
          PY

      - name: Install project dependencies
        run: |
          PROJECT_ROOT="$(cat project-root.txt)"
          cd "$PROJECT_ROOT"
          npm install --ignore-scripts --no-audit --no-fund
          npx remotion browser ensure

      - name: Render MP4
        run: |
          PROJECT_ROOT="$(cat project-root.txt)"
          cd "$PROJECT_ROOT"
          mkdir -p out
          npx remotion render src/index.ts Main out/video.mp4 --codec=h264 --log=error
          test -s out/video.mp4

      - name: Return video to editor
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
        with:
          name: render-${GH}{{ inputs.release_tag }}
          path: work/project/out/video.mp4
          if-no-files-found: error
          retention-days: 1

  cleanup:
    if: always()
    needs: render
    runs-on: ubuntu-24.04
    permissions:
      contents: write
    steps:
      - name: Remove temporary source package
        env:
          GH_TOKEN: ${GH}{{ github.token }}
          RELEASE_TAG: ${GH}{{ inputs.release_tag }}
        run: |
          gh release delete "$RELEASE_TAG" --repo "$GITHUB_REPOSITORY" --cleanup-tag --yes || true
`;

export const RENDER_REPO_FILES = [
  {
    path: RENDER_REPO_MARKER_PATH,
    content: RENDER_REPO_MARKER,
  },
  {
    path: RENDER_WORKFLOW_PATH,
    content: RENDER_WORKFLOW,
  },
] as const;
