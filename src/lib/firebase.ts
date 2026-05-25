import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Allow overriding the Firestore Named Database via URL query `?db=...` on tenant admin pages.
// The Super Admin console itself must always use the main app database.
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const isSuperAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/superadmin');
const overrideDbFromUrl = urlParams.get('db');
const overrideDbFromSession = typeof window !== 'undefined' ? sessionStorage.getItem('db_override') : null;
if (overrideDbFromUrl && typeof window !== 'undefined') {
  sessionStorage.setItem('db_override', overrideDbFromUrl);
} else if (typeof window !== 'undefined' && window.location.pathname === '/') {
  sessionStorage.removeItem('db_override');
}
export const MAIN_FIRESTORE_DB_ID = (firebaseConfig as any).firestoreDatabaseId ?? 'default';
const OVERRIDE_DB = !isSuperAdminRoute ? (overrideDbFromUrl || overrideDbFromSession) : null;
export const FIRESTORE_DB_ID = (OVERRIDE_DB && OVERRIDE_DB.length > 0)
  ? OVERRIDE_DB
  : MAIN_FIRESTORE_DB_ID;
export const db = getFirestore(app, FIRESTORE_DB_ID);
export const mainDb = FIRESTORE_DB_ID === MAIN_FIRESTORE_DB_ID ? db : getFirestore(app, MAIN_FIRESTORE_DB_ID);
export const auth = getAuth(app);
export const storage = getStorage(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
    console.error("Firestore connectivity check error:", error);
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
