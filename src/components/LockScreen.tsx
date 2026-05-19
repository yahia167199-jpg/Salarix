import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, AlertCircle, LogOut, ShieldCheck } from 'lucide-react';
import { useSecurity } from '../contexts/SecurityContext';
import { useData } from '../contexts/DataContext';
import { auth, signOut } from '../firebase';
import { cn } from '../lib/utils';

export const LockScreen: React.FC = () => {
  const { unlock } = useSecurity();
  const { companySettings } = useData();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Artificial small delay for "checking" feel
    setTimeout(() => {
      if (unlock(password)) {
        setError(false);
        setPassword('');
      } else {
        setError(true);
        setPassword('');
      }
      setLoading(false);
    }, 600);
  };

  const handleLogout = () => {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      signOut(auth);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f172a] flex items-center justify-center p-4 overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 text-center relative z-10 shadow-2xl shadow-black/50"
      >
        <div className="mb-10 flex flex-col items-center">
          <motion.div 
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            transition={{ repeat: Infinity, duration: 2, repeatType: 'reverse', ease: 'easeInOut' }}
            className="relative"
          >
            {companySettings?.logoUrl ? (
              <img 
                src={companySettings.logoUrl} 
                alt="Logo" 
                className="w-24 h-24 object-contain mb-6 rounded-3xl p-2 bg-white/10"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/40 relative">
                <Lock className="w-12 h-12 text-white" />
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-4 border-[#0f172a] shadow-lg">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
          </motion.div>
          
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
            {companySettings?.companyName || 'Salarix'}
          </h1>
          <div className="h-1 w-12 bg-blue-500 rounded-full mb-4 mx-auto" />
          <p className="text-blue-100 font-bold opacity-70">نظام الرواتب مقفل</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <div className="relative">
              <input
                type="password"
                dir="rtl"
                value={password}
                disabled={loading}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="أدخل كلمة مرور النظام"
                autoFocus
                className={cn(
                  "w-full bg-white/5 border text-white text-center py-5 px-6 rounded-2xl outline-none transition-all font-mono text-lg",
                  error ? "border-red-500 ring-4 ring-red-500/20" : "border-white/10 focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500/50",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-center gap-2 text-red-400 text-sm font-black"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>كلمة المرور غير صحيحة، حاول مجدداً</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className={cn(
              "w-full py-5 rounded-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 font-black text-lg shadow-xl shadow-blue-600/20",
              loading ? "bg-blue-600/50 cursor-wait" : "bg-blue-600 hover:bg-blue-700 hover:-translate-y-1",
              !password && "opacity-50 grayscale cursor-not-allowed",
              "text-white"
            )}
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Unlock className="w-6 h-6" />
                <span>فتح النظام</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors mx-auto font-bold text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>نسيت كلمة المرور؟ تسجيل الخروج</span>
          </button>
        </div>
      </motion.div>

      {/* Footer Info */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/20 text-xs font-bold tracking-widest uppercase">
          SECURE SYSTEM SESSION &bull; SALARIX v2.0
        </p>
      </div>
    </div>
  );
};
