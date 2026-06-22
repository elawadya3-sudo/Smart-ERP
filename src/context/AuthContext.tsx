import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Tenant } from '../types';
import { getCurrentTenant } from '../lib/tenantStorage';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeAuthState: (() => void) | undefined;

    const init = async () => {
      try {
        const t = await getCurrentTenant();
        setTenant(t);
      } catch (err) {
        console.error('Failed to load current tenant:', err);
      }

      unsubscribeAuthState = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data() as User;
              let role = data.role?.toUpperCase() || 'CASHIER';
              if (role === 'EMPLOYEE') role = 'CASHIER';
              if (role === 'ADMIN') role = 'ADMIN';

              const roleDefaultPermissions: Record<string, any> = {
                ADMIN: {
                  dashboard: true,
                  pos: true,
                  inventory: true,
                  accounting: true,
                  customers: true,
                  reports: true,
                  settings: true,
                  branchManagement: true,
                  cashierManagement: true,
                  systemReset: true,
                },
                BRANCH_MANAGER: {
                  dashboard: true,
                  pos: true,
                  inventory: false,
                  accounting: false,
                  customers: true,
                  reports: true,
                  settings: false,
                  branchManagement: true,
                  cashierManagement: false,
                  systemReset: false,
                },
                WAREHOUSE_MANAGER: {
                  dashboard: true,
                  pos: false,
                  inventory: true,
                  accounting: false,
                  customers: false,
                  reports: true,
                  settings: false,
                  branchManagement: false,
                  cashierManagement: false,
                  systemReset: false,
                },
                CASHIER: {
                  dashboard: false,
                  pos: true,
                  inventory: false,
                  accounting: false,
                  customers: false,
                  reports: false,
                  settings: false,
                  branchManagement: false,
                  cashierManagement: false,
                  systemReset: false,
                },
                SALES: {
                  dashboard: false,
                  pos: true,
                  inventory: false,
                  accounting: false,
                  customers: true,
                  reports: true,
                  settings: false,
                  branchManagement: false,
                  cashierManagement: false,
                  systemReset: false,
                },
                PURCHASES: {
                  dashboard: false,
                  pos: false,
                  inventory: true,
                  accounting: false,
                  customers: false,
                  reports: true,
                  settings: false,
                  branchManagement: false,
                  cashierManagement: false,
                  systemReset: false,
                },
                HR: {
                  dashboard: true,
                  pos: false,
                  inventory: false,
                  accounting: false,
                  customers: false,
                  reports: false,
                  settings: true,
                  branchManagement: false,
                  cashierManagement: true,
                  systemReset: false,
                },
                ACCOUNTANT: {
                  dashboard: true,
                  pos: false,
                  inventory: false,
                  accounting: true,
                  customers: false,
                  reports: true,
                  settings: false,
                  branchManagement: false,
                  cashierManagement: false,
                  systemReset: false,
                },
              };

              const mergedPermissions = {
                ...(roleDefaultPermissions[role] || roleDefaultPermissions['CASHIER']),
                ...(data.permissions || {})
              };

              setUser({
                ...data,
                role: role as any,
                permissions: mergedPermissions
              });
            } else {
              // If user exists in Auth but not in Firestore, we might need to handle it
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'موظف',
                role: 'CASHIER',
                createdAt: new Date().toISOString()
              });
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    };

    init();

    return () => {
      if (unsubscribeAuthState) unsubscribeAuthState();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, tenant, loading, signIn: async () => {}, signOut: () => auth.signOut() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
