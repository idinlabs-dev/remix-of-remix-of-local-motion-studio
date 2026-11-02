// Siapkan audio untuk transkrip: resample ke 16 kHz mono di device, potong
// per bagian (di jeda), lalu encode WAV 16-bit → base64.

export const TRANSCRIBE_RATE = 16_000;

export async function toMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  const length = Math.ceil(buffer.duration * TRANSCRIBE_RATE);
  const off = new OfflineAudioContext(1, Math.max(1, length), TRANSCRIBE_RATE);
  const src = off.createBufferSource();
  src.buffer = buffer;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0).slice();
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function wavChunksBase64(mono16k: Float32Array, ranges: { start: number; end: number }[]): string[] {
  return ranges.map((r) => {
    const a = Math.floor(r.start * TRANSCRIBE_RATE);
    const b = Math.min(mono16k.length, Math.ceil(r.end * TRANSCRIBE_RATE));
    return bytesToBase64(encodeWav(mono16k.subarray(a, b), TRANSCRIBE_RATE));
  });
}
