import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogIn, Github, Chrome } from 'lucide-react';
import { useMainStoreSettings } from '../hooks/useMainStoreSettings';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";
  const { settings } = useMainStoreSettings();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const finalEmail = email.includes('@') ? email : `${email}@system.local`;
    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, finalEmail, password);
        const user = result.user;

        // Create user doc in firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          name: email.split('@')[0],
          role: 'ADMIN',
          isActive: true,
          createdAt: new Date().toISOString()
        });
      } else {
        const result = await signInWithEmailAndPassword(auth, finalEmail, password);
        const userRef = doc(db, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.isActive === false) {
            setError("هذا الحساب معطل. يرجى مراجعة الإدارة.");
            await auth.signOut();
            setLoading(false);
            return;
          }
        }
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      console.error("Auth Error:", err);
      
      // Auto-create master admin on first login attempt if it doesn't exist
      if (finalEmail === 'master@system.local' && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
        try {
          const result = await createUserWithEmailAndPassword(auth, finalEmail, password);
          const user = result.user;
          
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            name: 'الدعم الفني الرئيسي',
            role: 'ADMIN',
            isRoot: true,
            isActive: true,
            createdAt: new Date().toISOString()
          });
          
          navigate(from, { replace: true });
          return;
        } catch (createErr) {
          console.error("Failed to auto-create master user:", createErr);
        }
      }

      let errorMsg = "خطأ في تسجيل الدخول. يرجى التأكد من اسم المستخدم وكلمة المرور.";
      if (err.code === 'auth/invalid-credential') {
        errorMsg = "بيانات الاعتماد غير صالحة. تأكد من اسم المستخدم وكلمة المرور.";
      } else if (err.code === 'auth/user-not-found') {
        errorMsg = "المستخدم غير موجود.";
      } else if (err.code === 'auth/wrong-password') {
        errorMsg = "كلمة المرور غير صحيحة.";
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = "تم حظر الدخول مؤقتاً لسبب كثرة المحاولات. حاول لاحقاً.";
      }

      setError(isRegistering ? "خطأ في إنشاء الحساب. قد يكون اسم المستخدم مستخدماً بالفعل." : errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }

      if (userSnap && !userSnap.exists()) {
        try {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            name: user.displayName,
            role: 'ADMIN', // First user is admin for demo
            isActive: true,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      } else if (userSnap && userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.isActive === false) {
          setError("هذا الحساب معطل. يرجى مراجعة الإدارة.");
          await auth.signOut();
          setLoading(false);
          return;
        }
      }

      navigate(from, { replace: true });
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-2xl shadow-blue-100/50"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-200">
            <LogIn className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">تسجيل الدخول</h1>
          <p className="text-gray-500 font-medium">مرحباً بك في نظام {settings?.storeName || 'NEZAM PRO'}</p>
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-sm font-black border border-red-100 mb-4 text-center">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-widest block px-1">اسم المستخدم</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all outline-none text-sm font-medium text-right"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-widest block px-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all outline-none text-sm font-medium text-right"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all mt-4 disabled:opacity-50"
          >
            {loading ? 'جاري التحميل...' : (isRegistering ? 'إنشاء حساب مسؤول' : 'دخول للنظام')}
          </button>


        </form>

        <p className="text-center mt-10 text-sm text-gray-400 font-medium">
          هذا النظام محمي. أي محاولة دخول غير مصرح بها سيتم تعقبها.
        </p>
      </motion.div>
    </div>
  );
}


