# Patch: gaya paper-cut untuk Auto Remotion Studio

## Cara memasang
```bash
unzip -o auto-remotion-papercut-patch.zip -d /path/ke/repo     # menimpa/menambah file sesuai path repo
npm test                                                      # vitest (termasuk src/test/papercut.test.ts)
npm run build
```

## File baru
- `src/lib/export/papercut/PaperCut.kit.tsx` : pustaka 47 komponen + renderer (disalin ke source Remotion hasil generate)
- `src/lib/export/papercut/manifest.ts` : skema Zod v2, dokumentasi komponen, heuristik cadangan, normalisasi keluaran AI
- `src/lib/export/papercut/compose.ts` : composer v2 (Video/Root/timing.json dengan waktu per kata)
- `src/lib/ai/papercut-schema.ts` : tool, prompt art director, dan parser tahan-rusak
- `src/test/papercut.test.ts` : 16 test
- `docs/papercut.md`, `docs/papercut-gallery-1.png`, `docs/papercut-gallery-2.png`

## File diubah
- `src/lib/export/generated-project.ts` : tipe manifest union (v1|v2), `composeGeneratedProject` memilih jalur v2, validator mengenali v2
- `src/lib/ai/ai.functions.ts` : `generateRemotionProject` menerima `style` (`papercut` default, `classic` = perilaku lama), token maksimum 16000 untuk v2
- `src/lib/export/remotion-zip.ts` : manifest cadangan = paper-cut; package.json hasil generate memakai Remotion `4.0.250` (dipin, sudah terbukti di GitHub Actions) dan skrip render `src/index.ts Main --codec=h264`

## Perilaku
- UI tidak berubah. Project baru otomatis memakai paper-cut; gaya lama tetap tersedia lewat `style: "classic"`.
- Keluaran AI yang rusak tidak membuat gagal: layer/scene yang tidak valid diganti heuristik (`repaired` melaporkan jumlahnya).
- Panduan lengkap: `docs/papercut.md`.
