import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { useSecurity } from '../contexts/SecurityContext';
import { useData } from '../contexts/DataContext';

export const LockScreen: React.FC = () => {
  const { unlock } = useSecurity();
  const { companySettings } = useData();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlock(password)) {
      setError(false);
      setPassword('');
    } else {
      setError(true);
      setPassword('');
      // Shake effect or feedback
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f172a] flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 text-center relative z-10"
      >
        <div className="mb-8 flex flex-col items-center">
          {companySettings?.logoUrl ? (
            <img 
              src={companySettings.logoUrl} 
              alt="Logo" 
              className="w-20 h-20 object-contain mb-4 rounded-2xl"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-500/20">
              <Lock className="w-10 h-10 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-black text-white mb-2">{companySettings?.companyName || 'نظام الرواتب'}</h1>
          <p className="text-gray-400 font-medium">النظام مقفل، يرجى إدخال كلمة المرور</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              dir="rtl"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="••••••••"
              autoFocus
              className="w-full bg-white/5 border border-white/10 text-white text-center py-4 px-6 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center gap-2 text-red-400 text-sm font-bold"
              >
                <AlertCircle className="w-4 h-4" />
                <span>كلمة المرور غير صحيحة</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-blue-600/25"
          >
            <Unlock className="w-5 h-5" />
            فتح النظام
          </button>
        </form>
      </motion.div>
    </div>
  );
};
