// Penyimpanan Kode Akses & pemakaian kuota di device (localStorage) — tanpa
// database/login. Hook useAccess() sinkron antar komponen & tab.

import { useEffect, useState } from "react";

import { parseAccessCode, type PlanId, type UsageState } from "./plans";

export interface AccessState extends UsageState {
  code: string;
  activatedAt: number;
}

const KEY = "ars:access";
const EVENT = "ars-access-change";

export function loadAccess(): AccessState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AccessState;
    if (!s.code || !parseAccessCode(s.code)) return null;
    return { ...s, used: Array.isArray(s.used) ? s.used : [] };
  } catch {
    return null;
  }
}

function write(state: AccessState | null) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // abaikan
  }
  window.dispatchEvent(new Event(EVENT));
}

export function activateAccess(code: string, plan: PlanId) {
  const prev = loadAccess();
  // Kode sama dipasang ulang → pertahankan riwayat pemakaian.
  const used = prev && prev.code === code ? prev.used : [];
  write({ code, plan, used, activatedAt: Date.now() });
}

export function clearAccess() {
  write(null);
}

export function markProjectUsed(projectId: string) {
  const s = loadAccess();
  if (!s || s.used.includes(projectId)) return;
  write({ ...s, used: [...s.used, projectId] });
}

export function useAccess(): AccessState | null {
  const [state, setState] = useState<AccessState | null>(null);
  useEffect(() => {
    const sync = () => setState(loadAccess());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return state;
}
