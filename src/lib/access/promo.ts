// Promo harian: hitung mundur ke tengah malam WIB (UTC+7) + ID pesanan &
// tautan WhatsApp konfirmasi pembayaran.

export const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;

/** Sisa ms sampai 00:00 WIB berikutnya — promo reset setiap tengah malam. */
export function msUntilJakartaMidnight(nowMs: number): number {
  const into = (((nowMs + WIB_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - into;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** ID pesanan pendek, mis. "ARS-PRO-021126-7K2Q". */
export function makeOrderId(plan: "starter" | "pro", nowMs: number, random: () => number = Math.random): string {
  const d = new Date(nowMs + WIB_OFFSET_MS);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(random() * alphabet.length)] ?? "X";
  return `ARS-${plan === "pro" ? "PRO" : "STR"}-${dd}${mm}${yy}-${suffix}`;
}

export function whatsappLink(number: string, text: string): string {
  const digits = number.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
