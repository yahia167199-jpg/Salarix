import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, collection, onSnapshot, OperationType, auth, FirestoreErrorInfo } from '../firebase';
import { Employee, Transaction, PayrollRun, AllowanceType, AppUser } from '../types';

interface DataContextType {
  employees: Employee[];
  transactions: Transaction[];
  payrollRuns: PayrollRun[];
  allowanceTypes: AllowanceType[];
  appUsers: AppUser[];
  loading: boolean;
  error: FirestoreErrorInfo | null;
}

const DataContext = createContext<DataContextType>({
  employees: [],
  transactions: [],
  payrollRuns: [],
  allowanceTypes: [],
  appUsers: [],
  loading: true,
  error: null,
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  useEffect(() => {
    const handleLocalError = (err: unknown, op: OperationType, path: string) => {
      try {
        const errInfo: FirestoreErrorInfo = {
          error: err instanceof Error ? err.message : String(err),
          authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData.map(provider => ({
              providerId: provider.providerId,
              displayName: provider.displayName,
              email: provider.email,
              photoUrl: provider.photoURL
            })) || []
          },
          operationType: op,
          path
        };
        setError(errInfo);
      } catch (e) {
        console.error('Failed to handle firestore error:', e);
      }
    };

    // Single listeners for the entire application to reduce read quotas
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'employees'));

    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'transactions'));

    const unsubPayrollRuns = onSnapshot(collection(db, 'payrollRuns'), (snap) => {
      setPayrollRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollRun)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'payrollRuns'));

    const unsubAllowanceTypes = onSnapshot(collection(db, 'allowanceTypes'), (snap) => {
      setAllowanceTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllowanceType)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'allowanceTypes'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAppUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'users'));

    const timer = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubEmployees();
      unsubTransactions();
      unsubPayrollRuns();
      unsubAllowanceTypes();
      unsubUsers();
      clearTimeout(timer);
    };
  }, []);

  if (error) {
    throw new Error(JSON.stringify(error));
  }

  return (
    <DataContext.Provider value={{ employees, transactions, payrollRuns, allowanceTypes, appUsers, loading, error }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
