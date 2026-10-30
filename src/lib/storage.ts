import { DEFAULT_PLAYLIST, type Playlist } from "./types";

// 設定と動画ファイルはすべてブラウザの IndexedDB に保存する。
// 動画はサーバーへアップロードされない。

const DB_NAME = "signage";
const DB_VERSION = 1;
const META = "meta";
const VIDEOS = "videos";
const PLAYLIST_KEY = "playlist";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(VIDEOS)) db.createObjectStore(VIDEOS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadPlaylist(): Promise<Playlist> {
  const p = await run<Playlist>(META, "readonly", (s) => s.get(PLAYLIST_KEY));
  if (!p) return structuredClone(DEFAULT_PLAYLIST);
  return { items: p.items ?? [], settings: { ...DEFAULT_PLAYLIST.settings, ...p.settings } };
}

export async function savePlaylist(p: Playlist) {
  await run(META, "readwrite", (s) => s.put(p, PLAYLIST_KEY));
}

export async function putVideo(id: string, blob: Blob) {
  await run(VIDEOS, "readwrite", (s) => s.put(blob, id));
}

export async function getVideo(id: string) {
  return run<Blob>(VIDEOS, "readonly", (s) => s.get(id));
}

export async function deleteVideo(id: string) {
  await run(VIDEOS, "readwrite", (s) => s.delete(id));
}

export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function estimateStorage() {
  try {
    return await navigator.storage?.estimate?.();
  } catch {
    return undefined;
  }
}
