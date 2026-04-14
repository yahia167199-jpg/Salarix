import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, doc, getDoc } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Employee } from './types';

interface AuthContextType {
  user: User | null;
  profile: Employee | null;
  loading: boolean;
  isAdmin: boolean;
  isHR: boolean;
  isFinance: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isHR: false,
  isFinance: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user profile from employees collection
        const docRef = doc(db, 'employees', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile({ id: docSnap.id, ...docSnap.data() } as Employee);
        } else {
          // If user is the default admin email, we might want to handle it
          if (firebaseUser.email === 'yahia167199@gmail.com') {
            setProfile({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Admin',
              role: 'Admin',
              status: 'Active',
              email: firebaseUser.email,
            } as Employee);
          } else {
            setProfile(null);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = profile?.role === 'Admin' || user?.email === 'yahia167199@gmail.com';
  const isHR = profile?.role === 'HR' || isAdmin;
  const isFinance = profile?.role === 'Finance' || isAdmin;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isHR, isFinance }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
