/**
 * MedQueue PWA Offline IndexedDB Storage Layer
 * Uses native indexedDB API for zero-dependency local caching.
 */

const DB_NAME = 'medqueue-patient-db';
const DB_VERSION = 1;
const STORE_NAME = 'patient_cache';

export interface OfflineCache {
  profile: any;
  timeline: any[];
  prescriptions: any[];
  appointments: any[];
  activeToken: any;
  labReports: any[];
}

/**
 * Open database connection and initialize object stores
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Batch cache all data in a single transaction
 */
export async function cacheOfflineData(data: OfflineCache): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.put(data.profile, 'profile');
      store.put(data.timeline, 'timeline');
      store.put(data.prescriptions, 'prescriptions');
      store.put(data.appointments, 'appointments');
      store.put(data.activeToken, 'activeToken');
      store.put(data.labReports, 'labReports');

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB caching failed:', err);
  }
}

/**
 * Fetch all cached data
 */
export async function getOfflineCache(): Promise<OfflineCache | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const profileReq = store.get('profile');
      const timelineReq = store.get('timeline');
      const prescriptionsReq = store.get('prescriptions');
      const appointmentsReq = store.get('appointments');
      const activeTokenReq = store.get('activeToken');
      const labReportsReq = store.get('labReports');

      transaction.oncomplete = () => {
        db.close();
        resolve({
          profile: profileReq.result ?? null,
          timeline: timelineReq.result ?? [],
          prescriptions: prescriptionsReq.result ?? [],
          appointments: appointmentsReq.result ?? [],
          activeToken: activeTokenReq.result ?? null,
          labReports: labReportsReq.result ?? [],
        });
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB read failed:', err);
    return null;
  }
}

/**
 * Clear cached data on logout
 */
export async function clearOfflineCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB clear failed:', err);
  }
}
