import type { PersistedGraphState, UserProfile } from '@/core/types';

/**
 * Persistencia 100% local. IndexedDB nativo, sin wrappers externos.
 * Mandamiento: "Privacidad Local-First" — nada sale del navegador.
 */

const DB_NAME = 'bemberse-db';
const DB_VERSION = 2;
const STORE_GRAPH = 'graph';
const STORE_PROFILE = 'profile';
const CURRENT_KEY = 'current';
const PROFILE_KEY = 'profile';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_GRAPH)) {
        db.createObjectStore(STORE_GRAPH);
      }
      if (!db.objectStoreNames.contains(STORE_PROFILE)) {
        db.createObjectStore(STORE_PROFILE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
  });

  return dbPromise;
}

export async function saveGraphState(state: PersistedGraphState): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GRAPH, 'readwrite');
    tx.objectStore(STORE_GRAPH).put(state, CURRENT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Error guardando el grafo.'));
  });
}

export async function loadGraphState(): Promise<PersistedGraphState | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GRAPH, 'readonly');
    const req = tx.objectStore(STORE_GRAPH).get(CURRENT_KEY);
    req.onsuccess = () => resolve((req.result as PersistedGraphState) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Error leyendo el grafo.'));
  });
}

export async function clearGraphState(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GRAPH, 'readwrite');
    tx.objectStore(STORE_GRAPH).delete(CURRENT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Error borrando el grafo.'));
  });
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILE, 'readwrite');
    tx.objectStore(STORE_PROFILE).put(profile, PROFILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Error guardando el perfil.'));
  });
}

export async function loadProfile(): Promise<UserProfile | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILE, 'readonly');
    const req = tx.objectStore(STORE_PROFILE).get(PROFILE_KEY);
    req.onsuccess = () => resolve((req.result as UserProfile) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Error leyendo el perfil.'));
  });
}

/**
 * Guarda la vista preferida dentro del perfil que ya existe (mismo store,
 * misma clave, sin migracion). Sin perfil no hay donde guardarla.
 */
export async function savePreferredView(view: 'network' | 'dendrogram'): Promise<void> {
  const profile = await loadProfile();
  if (!profile) return;
  await saveProfile({ ...profile, preferredView: view });
}

/** Comprueba si IndexedDB esta disponible (modo incognito estricto, etc). */
export function isPersistenceAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
