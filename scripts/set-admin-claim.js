/**
 * Mahesh Flora — Set Admin Custom Claim
 * Usage:
 *   node scripts/set-admin-claim.js <email-or-uid> [true|false]
 *
 * Example:
 *   node scripts/set-admin-claim.js admin@maheshflora.com
 */

const fs = require('fs');
const path = require('path');
const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Load .env.local if present
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
}

function initializeAdmin() {
  const existingApps = getApps();
  if (existingApps.length > 0) return existingApps[0];

  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
    });
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const serviceAccount = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  return initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

async function main() {
  const target = process.argv[2];
  const claimValue = process.argv[3] !== 'false';

  if (!target || target === 'your-admin-email@example.com') {
    console.error('Error: Please provide your actual administrator user email or UID.');
    console.log('Usage: node scripts/set-admin-claim.js <your-actual-email-or-uid> [true|false]');
    console.log('Example: node scripts/set-admin-claim.js myemail@gmail.com');
    process.exit(1);
  }

  const app = initializeAdmin();
  const auth = getAuth(app);

  let user;
  if (target.includes('@')) {
    console.log(`Looking up user by email: ${target}...`);
    user = await auth.getUserByEmail(target.toLowerCase());
  } else {
    console.log(`Looking up user by UID: ${target}...`);
    user = await auth.getUser(target);
  }

  console.log(`Found user: ${user.email || user.uid} (UID: ${user.uid})`);
  await auth.setCustomUserClaims(user.uid, { admin: claimValue });
  console.log(`✅ Successfully set custom claim { admin: ${claimValue} } on UID: ${user.uid}`);

  const refreshedUser = await auth.getUser(user.uid);
  console.log('Current custom claims:', refreshedUser.customClaims);
}

main().catch((err) => {
  console.error('Failed to set admin custom claim:', err.message);
  process.exit(1);
});
