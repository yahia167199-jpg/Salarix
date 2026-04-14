import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, doc, getDoc, collection, query, where, getDocs } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Employee, AppUser } from './types';

interface AuthContextType {
  user: User | null;
  profile: Employee | AppUser | null;
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
  const [profile, setProfile] = useState<Employee | AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // 1. Check users collection by email
        const userEmail = firebaseUser.email?.toLowerCase();
        if (userEmail) {
          const userDoc = await getDoc(doc(db, 'users', userEmail));
          if (userDoc.exists()) {
            setProfile({ id: userDoc.id, ...userDoc.data() } as AppUser);
            setLoading(false);
            return;
          }
        }

        // 2. Fallback to employees collection by UID
        const docRef = doc(db, 'employees', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile({ id: docSnap.id, ...docSnap.data() } as Employee);
        } else {
          // 3. Fallback to default admin
          if (firebaseUser.email === 'yahia167199@gmail.com') {
            setProfile({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Admin',
              role: 'Admin',
              status: 'Active',
              email: firebaseUser.email,
            } as any);
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
