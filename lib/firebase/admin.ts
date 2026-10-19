import {
  getApps,
  initializeApp,
  cert,
  applicationDefault,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

export function isAdminFirebaseConfigured(): boolean {
  try {
    if (getApps().length > 0) return true;
  } catch {}
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_PROJECT_ID
  );
}

let initializedApp: App | null = null;

export function getAdminApp(): App | null {
  try {
    const existing = getApps();
    if (existing.length > 0) {
      return existing[0]!;
    }

    if (initializedApp) {
      return initializedApp;
    }

    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (serviceAccountRaw) {
      let serviceAccount: ServiceAccount;
      if (serviceAccountRaw.trim().startsWith('{')) {
        serviceAccount = JSON.parse(serviceAccountRaw);
      } else {
        const decoded = Buffer.from(serviceAccountRaw, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(decoded);
      }

      initializedApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId || projectId,
      });
      return initializedApp;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializedApp = initializeApp({
        credential: applicationDefault(),
        projectId,
      });
      return initializedApp;
    }

    if (process.env.FIREBASE_PROJECT_ID) {
      initializedApp = initializeApp({
        projectId,
      });
      return initializedApp;
    }
  } catch (error) {
    console.warn('Firebase Admin initialization error:', error);
  }

  return null;
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  if (!app) return null;
  return getFirestore(app);
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  if (!app) return null;
  return getAuth(app);
}
