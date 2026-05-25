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
              let role = data.role.toUpperCase();
              if (role === 'EMPLOYEE') role = 'CASHIER';
              if (role === 'ADMIN') role = 'ADMIN';
              
              setUser({
                ...data,
                role: role as any
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
