<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Arsitektur

- Hanya panggilan AI yang lewat server (server function tipis `src/lib/ai/ai.functions.ts` membaca `GEMINI_API_KEY` dari `process.env` di dalam handler); pemecahan kalimat, timing, render canvas, dan encode video (mediabunny/WebCodecs) semuanya berjalan di browser — proyek ini memang "render di device".
- Komponen editor memakai checkbox native, bukan Switch Radix — Radix Switch crash dengan "invalid hook call" (duplikat React) di bundel dev proyek ini.
- Skema AI (Zod) & prompt ada di `src/lib/ai/schema.ts` agar aman dipakai client & server; rencana adegan generik ada di `src/lib/engine/planner.ts`.
