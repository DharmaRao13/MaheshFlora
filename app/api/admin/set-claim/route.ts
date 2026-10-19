import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorization } from '@/lib/auth';
import { getAdminAuth } from '@/lib/firebase/admin';

/**
 * Trusted server-side endpoint to assign or revoke Firebase custom claims (e.g. admin: true).
 * Protected by verifyAdminAuthorization (requires x-admin-key / ADMIN_SECRET_KEY).
 */
export async function POST(req: NextRequest) {
  try {
    const authCheck = verifyAdminAuthorization(req);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Server administrative key required to modify custom claims.' },
        { status: 401 }
      );
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Firebase Admin Auth is not configured on this server.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { email, uid, admin } = body;

    let targetUid = uid;

    if (!targetUid && email) {
      const user = await adminAuth.getUserByEmail(email.toLowerCase().trim());
      targetUid = user.uid;
    }

    if (!targetUid) {
      return NextResponse.json(
        { error: 'Target user email or uid is required.' },
        { status: 400 }
      );
    }

    // Set custom claim admin: true (or false if explicitly requested)
    const isAdminClaim = admin !== false;
    await adminAuth.setCustomUserClaims(targetUid, {
      admin: isAdminClaim,
    });

    const updatedUser = await adminAuth.getUser(targetUid);

    return NextResponse.json({
      success: true,
      message: `Successfully set custom claim admin: ${isAdminClaim} for user ${updatedUser.email || targetUid}`,
      uid: targetUid,
      email: updatedUser.email,
      customClaims: updatedUser.customClaims,
    });
  } catch (error: any) {
    console.error('Error setting custom claim:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to set custom claim.' },
      { status: 500 }
    );
  }
}
