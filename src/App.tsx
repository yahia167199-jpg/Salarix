import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

import { DataProvider } from './contexts/DataContext';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LockScreen } from './components/LockScreen';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { isLocked } = useSecurity();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 font-bold">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (user && isLocked) {
    return <LockScreen />;
  }

  return user ? <Layout /> : <Login />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <SecurityProvider>
              <AppContent />
            </SecurityProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
