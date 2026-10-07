/**
 * The opened folder's directory handle, remembered in IndexedDB (handles are structured-cloneable; localStorage can't
 * hold them). The browser still asks for permission again in a new session (D5), so reopening needs a click.
 */
const DB = 'game-asset-suite', STORE = 'handles', KEY = 'artgen-project';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = run(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

export async function rememberHandle(h: FileSystemDirectoryHandle): Promise<void> {
  try { await tx('readwrite', s => s.put(h, KEY)); } catch { /* private mode: nothing to remember */ }
}

export async function recallHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  try { return (await tx('readonly', s => s.get(KEY))) as FileSystemDirectoryHandle | undefined; } catch { return undefined; }
}

export async function forgetHandle(): Promise<void> {
  try { await tx('readwrite', s => s.delete(KEY)); } catch { /* nothing stored */ }
}
