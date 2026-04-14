import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  LayoutDashboard, 
  Receipt, 
  History, 
  LogOut, 
  ChevronRight, 
  Menu, 
  X,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { auth, signOut } from '../firebase';
import { cn } from '../lib/utils';

// Pages
import { Dashboard } from './pages/Dashboard';
import { EmployeesList } from './pages/EmployeesList';
import { PayrollRuns } from './pages/PayrollRuns';
import { Transactions } from './pages/Transactions';
import { AllowanceTypes } from './pages/AllowanceTypes';
import { UsersManagement } from './pages/UsersManagement';

export const Layout: React.FC = () => {
  const { user, profile, isAdmin, isHR, isFinance } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, show: true },
    { id: 'employees', label: 'الموظفين', icon: Users, show: isHR },
    { id: 'allowance-types', label: 'أنواع البدلات', icon: Settings, show: isHR },
    { id: 'transactions', label: 'الحركات الشهرية', icon: History, show: isHR },
    { id: 'payroll', label: 'مسير الرواتب', icon: Receipt, show: isFinance },
    { id: 'users', label: 'المستخدمين والصلاحيات', icon: ShieldCheck, show: isAdmin },
  ];

  const handleLogout = () => signOut(auth);

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'employees': return <EmployeesList />;
      case 'allowance-types': return <AllowanceTypes />;
      case 'transactions': return <Transactions />;
      case 'payroll': return <PayrollRuns />;
      case 'users': return <UsersManagement />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" dir="rtl">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 right-0 z-50 bg-white border-l border-gray-100 transition-all duration-300 shadow-xl shadow-blue-900/5",
          isSidebarOpen ? "w-72" : "w-20"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-24 flex items-center px-6 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              {isSidebarOpen && (
                <span className="text-2xl font-black text-gray-900 tracking-tight">Salarix</span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
            {menuItems.filter(item => item.show).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 group relative",
                  activeTab === item.id 
                    ? "bg-blue-50 text-blue-600 font-bold" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn(
                  "w-6 h-6 shrink-0 transition-transform duration-200",
                  activeTab === item.id ? "scale-110" : "group-hover:scale-110"
                )} />
                {isSidebarOpen && <span className="text-lg">{item.label}</span>}
                {activeTab === item.id && isSidebarOpen && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute left-2 w-1.5 h-6 bg-blue-600 rounded-full"
                  />
                )}
              </button>
            ))}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-50">
            {isSidebarOpen && (
              <div className="mb-4 p-4 bg-gray-50 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  {user?.displayName?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{user?.displayName}</p>
                  <p className="text-xs text-gray-500 font-medium">{profile?.role || 'User'}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-4 p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-colors font-bold",
                !isSidebarOpen && "justify-center"
              )}
            >
              <LogOut className="w-6 h-6 shrink-0" />
              {isSidebarOpen && <span>تسجيل الخروج</span>}
            </button>
          </div>
        </div>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -left-4 top-10 w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors z-[60]"
        >
          <ChevronRight className={cn("w-4 h-4 text-gray-400 transition-transform", isSidebarOpen ? "rotate-0" : "rotate-180")} />
        </button>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-screen",
        isSidebarOpen ? "mr-72" : "mr-20"
      )}>
        <header className="h-24 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-8 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-2xl font-black text-gray-900">
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-900">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="text-xs text-gray-400 font-medium">مرحباً بك في نظام Salarix</span>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
