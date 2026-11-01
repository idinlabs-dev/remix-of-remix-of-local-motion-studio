// Penyimpanan lokal: IndexedDB untuk project & media (blob besar melebihi
// batas localStorage), localStorage untuk preferensi ringan.

export interface ProjectRecord {
  composition: string; // JSON Composition
}

export interface MediaRecord {
  id: string;
  projectId: string;
  kind: "audio" | "image" | "video";
  name: string;
  mime: string;
  blob: Blob;
  createdAt: number;
}

export interface RenderRecord {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  blob: Blob;
  durationSec: number;
  createdAt: number;
}

const DB_NAME = "auto-remotion";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("projects"))
          db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("media"))
          db.createObjectStore("media", { keyPath: "id" });
        if (!db.objectStoreNames.contains("renders")) {
          const store = db.createObjectStore("renders", { keyPath: "id" });
          store.createIndex("projectId", "projectId");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

// ---------- projects ----------

export interface ProjectMeta {
  id: string;
  title: string;
  aspect: string;
  updatedAt: number;
  sceneCount: number;
  hasAudio: boolean;
}

export async function saveProject(
  comp: { id: string; title: string; aspect: string; updatedAt: number; scenes: unknown[] },
  compJson: string,
): Promise<void> {
  await tx("projects", "readwrite", (s) =>
    s.put({
      id: comp.id,
      title: comp.title,
      aspect: comp.aspect,
      updatedAt: comp.updatedAt,
      sceneCount: comp.scenes.length,
      composition: compJson,
    }),
  );
}

export async function getProject(id: string): Promise<string | null> {
  const rec = await tx<{ composition: string } | undefined>("projects", "readonly", (s) =>
    s.get(id),
  );
  return rec?.composition ?? null;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = await tx<
    {
      id: string;
      title: string;
      aspect: string;
      updatedAt: number;
      sceneCount: number;
      composition: string;
    }[]
  >("projects", "readonly", (s) => s.getAll());
  return all
    .map((r) => ({
      id: r.id,
      title: r.title,
      aspect: r.aspect,
      updatedAt: r.updatedAt,
      sceneCount: r.sceneCount,
      hasAudio: false,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  await tx("projects", "readwrite", (s) => s.delete(id));
  const media = await listMedia(id);
  for (const m of media) await deleteMedia(m.id);
}

// ---------- media ----------

export async function putMedia(rec: Omit<MediaRecord, "createdAt">): Promise<string> {
  const full: MediaRecord = { ...rec, createdAt: Date.now() };
  await tx("media", "readwrite", (s) => s.put(full));
  return full.id;
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  const rec = await tx<MediaRecord | undefined>("media", "readonly", (s) => s.get(id));
  return rec ?? null;
}

export async function listMedia(projectId: string): Promise<MediaRecord[]> {
  const all = await tx<MediaRecord[]>("media", "readonly", (s) => s.getAll());
  return all.filter((m) => m.projectId === projectId);
}

export async function deleteMedia(id: string): Promise<void> {
  await tx("media", "readwrite", (s) => s.delete(id));
}

// ---------- renders ----------

export async function putRender(rec: Omit<RenderRecord, "createdAt">): Promise<string> {
  const full: RenderRecord = { ...rec, createdAt: Date.now() };
  await tx("renders", "readwrite", (s) => s.put(full));
  return full.id;
}

export async function listRenders(projectId: string): Promise<RenderRecord[]> {
  const all = await tx<RenderRecord[]>("renders", "readonly", (s) => s.getAll());
  return all.filter((r) => r.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);
}

// ---------- preferensi (localStorage) ----------

export interface Prefs {
  aspect: string;
  quality: "high" | "medium";
}

const PREFS_KEY = "auto-remotion:prefs";

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { aspect: "9:16", quality: "high", ...JSON.parse(raw) } as Prefs;
  } catch {
    // abaikan — localStorage bisa saja tidak tersedia
  }
  return { aspect: "9:16", quality: "high" };
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // abaikan
  }
}
