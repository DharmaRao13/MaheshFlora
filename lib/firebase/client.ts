import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, onSnapshot, doc, collection, DocumentData, QuerySnapshot } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (!app) {
    if (getApps().length > 0) {
      app = getApp();
    } else {
      app = initializeApp(firebaseConfig);
    }
  }
  return app;
}

export function getClientDb(): Firestore | null {
  if (!db && isFirebaseConfigured()) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      db = getFirestore(firebaseApp);
    }
  }
  return db;
}

export function getClientAuth(): Auth | null {
  if (!auth && isFirebaseConfigured()) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      auth = getAuth(firebaseApp);
    }
  }
  return auth;
}

let analyticsInstance: any = null;

export async function getClientAnalytics() {
  if (typeof window === 'undefined') return null;
  if (!analyticsInstance && isFirebaseConfigured()) {
    try {
      const { getAnalytics, isSupported } = await import('firebase/analytics');
      const supported = await isSupported();
      if (supported) {
        const firebaseApp = getFirebaseApp();
        if (firebaseApp) {
          analyticsInstance = getAnalytics(firebaseApp);
        }
      }
    } catch (err) {
      console.warn('Firebase Analytics initialization skipped:', err);
    }
  }
  return analyticsInstance;
}

/**
 * Real-time listener for today's published daily flower prices.
 * Returns an unsubscribe function.
 */
export function subscribeToDailyPrices(
  onUpdate: (record: any) => void,
  onError?: (error: Error) => void
): () => void {
  const firestore = getClientDb();
  if (!firestore) {
    return () => {};
  }

  const docRef = doc(firestore, 'dailyPrices', 'current');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate({ id: snapshot.id, ...snapshot.data() });
      }
    },
    (err) => {
      console.warn('Real-time dailyPrices listener error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener for an individual order's status and tracking updates.
 * Returns an unsubscribe function.
 */
export function subscribeToOrder(
  orderId: string,
  onUpdate: (order: any) => void,
  onError?: (error: Error) => void
): () => void {
  const firestore = getClientDb();
  if (!firestore || !orderId) {
    return () => {};
  }

  const docRef = doc(firestore, 'orders', orderId);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate({ id: snapshot.id, ...snapshot.data() });
      }
    },
    (err) => {
      console.warn(`Real-time order tracking error for ${orderId}:`, err);
      if (onError) onError(err);
    }
  );
}
