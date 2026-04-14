import React from 'react';
import { motion } from 'framer-motion';
import { LogIn, ShieldCheck } from 'lucide-react';
import { signInWithPopup, googleProvider, auth } from '../firebase';

export const Login: React.FC = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]" dir="rtl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-w-md w-full mx-4"
      >
        <div className="bg-white rounded-[2rem] shadow-2xl shadow-blue-100/50 p-10 border border-white/20 backdrop-blur-sm">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 rotate-3">
              <ShieldCheck className="w-10 h-10 text-white -rotate-3" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">Salarix</h1>
            <p className="text-gray-500 font-medium">نظام إدارة الرواتب المتكامل</p>
          </div>

          <div className="space-y-6">
            <button
              onClick={handleLogin}
              className="w-full group relative flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-2xl border-2 border-gray-100 transition-all duration-300 hover:border-blue-200 hover:shadow-md active:scale-[0.98]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" referrerPolicy="no-referrer" />
              <span>تسجيل الدخول بواسطة جوجل</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-gray-400 font-semibold tracking-wider">للموظفين المصرح لهم فقط</span>
              </div>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-gray-400 font-medium">
            &copy; {new Date().getFullYear()} Salarix Payroll System
          </p>
        </div>
      </motion.div>
    </div>
  );
};
