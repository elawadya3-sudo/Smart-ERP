/**
 * Super Admin Authentication
 * مصادقة مستقلة تماماً عن Firebase Auth — تعتمد على sessionStorage
 * بيانات الدخول: superadmin / F00tPrint@SuperAdmin#2025!
 * 
 * عند النجاح، يتم تسجيل دخول anonymous في Firebase Auth
 * حتى تتمكن من الكتابة في Firestore collections المحمية
 */

import { onAuthStateChanged, signInAnonymously, signOut as firebaseSignOut, type Unsubscribe } from 'firebase/auth';
import { superAdminAuth as auth } from './superAdminFirebase';

const SUPER_ADMIN_USERNAME = 'superadmin';
const SUPER_ADMIN_PLAIN = 'F00tPrint@SuperAdmin#2025!';
const SESSION_KEY = 'sa_session_token';
const SESSION_EXPIRY_KEY = 'sa_session_expiry';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Generate a random session token */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Attempt Super Admin login
 * 1. Validates username/password locally
 * 2. Signs into Firebase anonymously (for Firestore write access)
 * 3. Stores session in sessionStorage
 */
export async function superAdminLogin(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (username.trim() !== SUPER_ADMIN_USERNAME) {
    return { success: false, error: 'اسم المستخدم غير صحيح' };
  }

  if (password !== SUPER_ADMIN_PLAIN) {
    return { success: false, error: 'كلمة المرور غير صحيحة' };
  }

  try {
    // Ensure the current auth session is anonymous and valid for Firestore rules.
    await ensureSuperAdminSession();
  } catch (err) {
    console.warn('Super Admin anonymous session failed:', err);
    return { success: false, error: 'فشل تسجيل دخول المسؤول الرئيسي. يرجى المحاولة مرة أخرى.' };
  }

  // Create local session
  const token = generateToken();
  const expiry = Date.now() + SESSION_DURATION_MS;
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(SESSION_EXPIRY_KEY, expiry.toString());

  return { success: true };
}

function isAnonymousSuperAdminActive(): boolean {
  return auth.currentUser?.isAnonymous === true && isSuperAdminAuthenticated();
}

export async function ensureSuperAdminSession(): Promise<void> {
  if (isAnonymousSuperAdminActive()) {
    return;
  }

  if (auth.currentUser) {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Failed signing out existing user before anonymous login:', err);
    }
  }

  try {
    await signInAnonymously(auth);
    await waitForAnonymousUser();
    const currentUser = auth.currentUser;
    if (currentUser?.isAnonymous) {
      try {
        await currentUser.getIdToken(true);
      } catch (tokenError) {
        console.warn('Failed to refresh Super Admin anonymous token:', tokenError);
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (typeof err === 'object' && err !== null && 'code' in err && (err as any).code === 'auth/admin-restricted-operation') {
      throw new Error('Firebase anonymous authentication is disabled. Please enable Anonymous Auth in Firebase Console.');
    }
    throw new Error(errorMessage);
  }
}

async function waitForAnonymousUser(): Promise<void> {
  return new Promise((resolve, reject) => {
    let unsubscribe: Unsubscribe | null = null;
    const timeoutId = window.setTimeout(() => {
      if (unsubscribe) {
        unsubscribe();
      }
      reject(new Error('Timed out waiting for Firebase anonymous auth.'));
    }, 10000);

    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user?.isAnonymous) {
          window.clearTimeout(timeoutId);
          if (unsubscribe) {
            unsubscribe();
          }
          resolve();
        }
      },
      (error) => {
        window.clearTimeout(timeoutId);
        if (unsubscribe) {
          unsubscribe();
        }
        reject(error);
      }
    );
  });
}

/** Check if Super Admin is currently logged in */
export function isSuperAdminAuthenticated(): boolean {
  const token = sessionStorage.getItem(SESSION_KEY);
  const expiry = sessionStorage.getItem(SESSION_EXPIRY_KEY);

  if (!token || !expiry) return false;
  if (Date.now() > parseInt(expiry, 10)) {
    superAdminLogout();
    return false;
  }
  return true;
}

/** Log out Super Admin — also clears Firebase anonymous session */
export async function superAdminLogout(): Promise<void> {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  try {
    if (auth.currentUser?.isAnonymous) {
      await firebaseSignOut(auth);
    }
  } catch (err) {
    console.warn('Error signing out Firebase anonymous user:', err);
  }
}

/** Extend session (call on activity) */
export function extendSuperAdminSession(): void {
  if (isSuperAdminAuthenticated()) {
    const expiry = Date.now() + SESSION_DURATION_MS;
    sessionStorage.setItem(SESSION_EXPIRY_KEY, expiry.toString());
  }
}
