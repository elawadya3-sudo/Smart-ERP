import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const SUPER_ADMIN_APP_NAME = 'superadmin-app';

function getSuperAdminApp() {
  if (getApps().some((app) => app.name === SUPER_ADMIN_APP_NAME)) {
    return getApp(SUPER_ADMIN_APP_NAME);
  }
  return initializeApp(firebaseConfig, SUPER_ADMIN_APP_NAME);
}

const superAdminApp = getSuperAdminApp();
export const superAdminAuth = getAuth(superAdminApp);
export const superAdminDb = getFirestore(superAdminApp, (firebaseConfig as any).firestoreDatabaseId ?? 'default');
