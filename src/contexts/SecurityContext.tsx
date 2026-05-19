import React, { createContext, useContext, useState, useEffect } from 'react';
import { useData } from './DataContext';

interface SecurityContextType {
  isLocked: boolean;
  lock: () => void;
  unlock: (password: string) => boolean;
  hasSystemPassword: boolean;
  idleTimeout: number; // in minutes
  setIdleTimeout: (minutes: number) => void;
}

const SecurityContext = createContext<SecurityContextType>({
  isLocked: false,
  lock: () => {},
  unlock: () => false,
  hasSystemPassword: false,
  idleTimeout: 30,
  setIdleTimeout: () => {},
});

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companySettings } = useData();
  const [isLocked, setIsLocked] = useState(false);
  const [idleTimeout, setIdleTimeoutState] = useState(() => {
    return Number(localStorage.getItem('idle_timeout')) || 30;
  });

  const setIdleTimeout = (minutes: number) => {
    setIdleTimeoutState(minutes);
    localStorage.setItem('idle_timeout', String(minutes));
  };

  // Check if session was locked from localStorage
  useEffect(() => {
    const savedLock = localStorage.getItem('app_locked');
    if (savedLock === 'true' && companySettings?.systemPassword) {
      setIsLocked(true);
    }
  }, [companySettings]);

  // Idle Timer Logic
  useEffect(() => {
    if (!companySettings?.systemPassword || isLocked) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lock();
      }, idleTimeout * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [idleTimeout, isLocked, companySettings?.systemPassword]);

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
    <SecurityContext.Provider value={{ isLocked, lock, unlock, hasSystemPassword, idleTimeout, setIdleTimeout }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => useContext(SecurityContext);
