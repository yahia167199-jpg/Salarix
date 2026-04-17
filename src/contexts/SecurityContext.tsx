import React, { createContext, useContext, useState, useEffect } from 'react';
import { useData } from './DataContext';

interface SecurityContextType {
  isLocked: boolean;
  lock: () => void;
  unlock: (password: string) => boolean;
  hasSystemPassword: boolean;
}

const SecurityContext = createContext<SecurityContextType>({
  isLocked: false,
  lock: () => {},
  unlock: () => false,
  hasSystemPassword: false,
});

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companySettings } = useData();
  const [isLocked, setIsLocked] = useState(false);

  // Check if session was locked from localStorage
  useEffect(() => {
    const savedLock = localStorage.getItem('app_locked');
    if (savedLock === 'true' && companySettings?.systemPassword) {
      setIsLocked(true);
    }
  }, [companySettings]);

  const lock = () => {
    if (companySettings?.systemPassword) {
      setIsLocked(true);
      localStorage.setItem('app_locked', 'true');
    }
  };

  const unlock = (password: string) => {
    if (password === companySettings?.systemPassword) {
      setIsLocked(false);
      localStorage.removeItem('app_locked');
      return true;
    }
    return false;
  };

  const hasSystemPassword = !!companySettings?.systemPassword;

  return (
    <SecurityContext.Provider value={{ isLocked, lock, unlock, hasSystemPassword }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => useContext(SecurityContext);
