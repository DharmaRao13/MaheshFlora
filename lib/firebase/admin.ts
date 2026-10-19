import fs from 'fs';
import path from 'path';
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

// Remove invalid or non-existent GOOGLE_APPLICATION_CREDENTIALS file paths
if (typeof process !== 'undefined' && process.env?.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const credPath = path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : path.join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (!fs.existsSync(credPath)) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  } catch {}
}

export function isAdminFirebaseConfigured(): boolean {
  try {
    if (getApps().length > 0) return true;
  } catch {}
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

let initializedApp: App | null = null;
let initializedDb: Firestore | null = null;

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
      let raw = serviceAccountRaw.trim();
      // Strip outer single or double quotes commonly added in deployment dashboards
      if (
        (raw.startsWith("'") && raw.endsWith("'")) ||
        (raw.startsWith('"') && raw.endsWith('"'))
      ) {
        raw = raw.slice(1, -1).trim();
      }

      let serviceAccount: ServiceAccount;
      if (raw.startsWith('{')) {
        serviceAccount = JSON.parse(raw);
      } else {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(decoded);
      }

      // Ensure private key handles literal '\n' escaping from environment strings
      if (serviceAccount.privateKey) {
        serviceAccount.privateKey = serviceAccount.privateKey.replace(/\\n/g, '\n');
      }
      if ((serviceAccount as any).private_key) {
        (serviceAccount as any).private_key = (serviceAccount as any).private_key.replace(/\\n/g, '\n');
      }

      initializedApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId || projectId,
      });
      return initializedApp;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const credPath = path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
          ? process.env.GOOGLE_APPLICATION_CREDENTIALS
          : path.join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
        if (fs.existsSync(credPath)) {
          initializedApp = initializeApp({
            credential: applicationDefault(),
            projectId,
          });
          return initializedApp;
        }
      } catch {}
    }

    if (projectId) {
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
  try {
    const app = getAdminApp();
    if (!app) return null;
    if (!initializedDb) {
      initializedDb = getFirestore(app);
      try {
        initializedDb.settings({ ignoreUndefinedProperties: true });
      } catch {}
    }
    return initializedDb;
  } catch (err) {
    console.warn('Failed to retrieve Firestore Admin instance:', err);
    return null;
  }
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  if (!app) return null;
  return getAuth(app);
}
