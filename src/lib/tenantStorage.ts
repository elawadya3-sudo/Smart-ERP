/**
 * Tenant Storage Service
 * يخزّن بيانات النسخ المباعة في localStorage على جهاز المالك
 * لا يحتاج Firestore أو أي أذونات خارجية
 */

import type { Tenant } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { mainDb, FIRESTORE_DB_ID } from './firebase';
import { superAdminDb } from './superAdminFirebase';
import { ensureSuperAdminSession } from './superAdminAuth';

const CURRENT_APP_DB_ID = FIRESTORE_DB_ID || ((firebaseConfig as any).firestoreDatabaseId ?? 'default');

export async function getAllTenants(): Promise<Tenant[]> {
  const q = query(collection(mainDb, 'tenants'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const docRef = doc(mainDb, 'tenants', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Tenant;
  }
  return null;
}

export async function createTenant(data: Omit<Tenant, 'id' | 'createdAt'>): Promise<Tenant> {
  const docRef = await addDoc(collection(mainDb, 'tenants'), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { id: docRef.id, ...data, createdAt: new Date().toISOString() } as Tenant;
}

export async function updateTenant(id: string, data: Partial<Omit<Tenant, 'id' | 'createdAt'>>): Promise<Tenant | null> {
  const docRef = doc(mainDb, 'tenants', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
  return getTenantById(id);
}

export async function deleteTenant(id: string): Promise<boolean> {
  const docRef = doc(mainDb, 'tenants', id);
  await deleteDoc(docRef);
  return true;
}

export async function getAllTenantsAsSuperAdmin(): Promise<Tenant[]> {
  await ensureSuperAdminSession();
  const q = query(collection(superAdminDb, 'tenants'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Tenant));
}

export async function getTenantByIdAsSuperAdmin(id: string): Promise<Tenant | null> {
  await ensureSuperAdminSession();
  const docRef = doc(superAdminDb, 'tenants', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Tenant;
  }
  return null;
}

export async function createTenantAsSuperAdmin(data: Omit<Tenant, 'id' | 'createdAt'>): Promise<Tenant> {
  await ensureSuperAdminSession();
  const docRef = await addDoc(collection(superAdminDb, 'tenants'), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { id: docRef.id, ...data, createdAt: new Date().toISOString() } as Tenant;
}

export async function updateTenantAsSuperAdmin(id: string, data: Partial<Omit<Tenant, 'id' | 'createdAt'>>): Promise<Tenant | null> {
  await ensureSuperAdminSession();
  const docRef = doc(superAdminDb, 'tenants', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
  return getTenantByIdAsSuperAdmin(id);
}

export async function deleteTenantAsSuperAdmin(id: string): Promise<boolean> {
  await ensureSuperAdminSession();
  const docRef = doc(superAdminDb, 'tenants', id);
  await deleteDoc(docRef);
  return true;
}

export async function getCurrentTenant(): Promise<Tenant | null> {
  try {
    const tenants = await getAllTenants();
    return tenants.find((t) => t.dbId === CURRENT_APP_DB_ID) ?? null;
  } catch (error) {
    console.warn('Unable to resolve current tenant from Firestore:', error);
    return null;
  }
}
