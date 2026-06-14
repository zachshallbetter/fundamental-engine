// Client-side cache for the project atoms. The 63KB atoms file is imported as a fingerprinted URL
// (so it leaves the JS bundle) and fetched once; this module persists it in IndexedDB — with a
// localStorage fallback — so repeat loads skip the network AND the JSON parse. The cache is keyed by
// the asset URL, which carries a content hash, so a new build (new hash) invalidates it for free.
export interface Atom {
  kind: string;
  id: string;
  label: string;
  color?: string;
  href?: string;
  weight?: number;
  data?: Record<string, unknown>;
}

const DB_NAME = "Fundamental";
const STORE = "kv";
const REC_KEY = "atoms";
const LS_KEY = "Fundamental:atoms";

interface Cached {
  url: string;
  atoms: Atom[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(): Promise<Cached | undefined> {
  return openDB().then(
    (db) =>
      new Promise<Cached | undefined>((resolve, reject) => {
        const r = db.transaction(STORE).objectStore(STORE).get(REC_KEY);
        r.onsuccess = () => resolve(r.result as Cached | undefined);
        r.onerror = () => reject(r.error);
      }).finally(() => db.close()),
  );
}

function idbSet(rec: Cached): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec, REC_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }).finally(() => db.close()),
  );
}

async function persist(rec: Cached): Promise<void> {
  try {
    await idbSet(rec);
    return;
  } catch {
    /* IndexedDB blocked/unavailable — fall back to localStorage */
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rec));
  } catch {
    /* quota / private mode — skip the cache, the field still works */
  }
}

/**
 * Resolve the project atoms, cache-first. `url` is the fingerprinted asset URL of atoms.json.
 * Order: IndexedDB → localStorage → network. Misses are persisted (best-effort) for next time.
 */
export async function getAtoms(url: string): Promise<Atom[]> {
  try {
    const hit = await idbGet();
    if (hit && hit.url === url && Array.isArray(hit.atoms)) return hit.atoms;
  } catch {
    /* IndexedDB unavailable — try localStorage next */
  }
  try {
    const ls = localStorage.getItem(LS_KEY);
    if (ls) {
      const rec = JSON.parse(ls) as Cached;
      if (rec.url === url && Array.isArray(rec.atoms)) return rec.atoms;
    }
  } catch {
    /* malformed/blocked — fall through to network */
  }
  const res = await fetch(url);
  const atoms = ((await res.json()).atoms ?? []) as Atom[];
  void persist({ url, atoms });
  return atoms;
}
