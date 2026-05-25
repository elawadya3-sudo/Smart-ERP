import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff, Lock, User, AlertCircle, Zap } from 'lucide-react';
import { superAdminLogin } from '../../lib/superAdminAuth';
import { useSuperAdmin } from '../../context/SuperAdminContext';

export default function SuperAdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const navigate = useNavigate();
  const { checkAuth } = useSuperAdmin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attempts >= 5) {
      setError('تم تجاوز الحد الأقصى للمحاولات. يرجى إغلاق المتصفح وإعادة المحاولة.');
      return;
    }
    setLoading(true);
    setError(null);

    // Simulate a slight delay for security UX
    await new Promise((r) => setTimeout(r, 800));

    const result = await superAdminLogin(username, password);
    if (result.success) {
      checkAuth();
      navigate('/superadmin', { replace: true });
    } else {
      setAttempts((a) => a + 1);
      setError(result.error || 'بيانات الدخول غير صحيحة');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0f0c29, #1a1a3e, #0f0c29)' }}>
      
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ y: [-10, 10, -10], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 60%)' }}
        />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md mx-4"
        dir="rtl"
      >
        {/* Card */}
        <div className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(15, 12, 41, 0.8)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)'
          }}>

          {/* Header */}
          <div className="p-8 pb-6 text-center"
            style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center relative"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <ShieldCheck className="w-10 h-10 text-white" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-2xl"
                style={{ border: '2px solid rgba(139,92,246,0.5)', margin: '-4px' }}
              />
            </motion.div>

            <h1 className="text-2xl font-black text-white mb-1">
              لوحة التحكم الرئيسية
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Zap className="w-3 h-3" style={{ color: '#a78bfa' }} />
              <p className="text-sm font-medium" style={{ color: '#a78bfa' }}>
                Super Admin — وصول مقيّد
              </p>
              <Zap className="w-3 h-3" style={{ color: '#a78bfa' }} />
            </div>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-4 rounded-2xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Username */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7c7ca8' }}>
                  اسم المستخدم
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <User className="w-4 h-4" style={{ color: '#6366f1' }} />
                  </div>
                  <input
                    id="sa-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="superadmin"
                    autoComplete="off"
                    required
                    className="w-full pr-11 pl-4 py-3.5 rounded-xl text-sm font-medium outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      color: '#e2e8f0',
                      textAlign: 'right'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(139,92,246,0.7)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.25)'}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7c7ca8' }}>
                  كلمة المرور
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <Lock className="w-4 h-4" style={{ color: '#6366f1' }} />
                  </div>
                  <input
                    id="sa-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pr-11 pl-12 py-3.5 rounded-xl text-sm font-medium outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      color: '#e2e8f0',
                      textAlign: 'right'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(139,92,246,0.7)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.25)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 flex items-center pl-4 transition-opacity hover:opacity-80"
                    style={{ color: '#7c7ca8' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Attempts warning */}
              {attempts > 0 && (
                <p className="text-xs text-center" style={{ color: '#f59e0b' }}>
                  محاولات متبقية: {5 - attempts}
                </p>
              )}

              {/* Submit */}
              <motion.button
                id="sa-login-btn"
                type="submit"
                disabled={loading || attempts >= 5}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl font-black text-sm tracking-wide transition-all mt-2 relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                    جاري التحقق...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    دخول آمن
                  </span>
                )}
              </motion.button>
            </form>

            <p className="text-center mt-6 text-xs" style={{ color: '#4a4a6a' }}>
              🔒 هذه المنطقة محمية — أي محاولة دخول غير مصرح بها يتم تسجيلها
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
