import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, collection, onSnapshot, OperationType, auth, FirestoreErrorInfo, doc } from '../firebase';
import { Employee, Transaction, PayrollRun, AllowanceType, AppUser, Branch, Sector, Management, CompanySettings, Leave, CostCenterDept } from '../types';
import { useAuth } from '../AuthContext';

interface DataContextType {
  employees: Employee[];
  transactions: Transaction[];
  payrollRuns: PayrollRun[];
  allowanceTypes: AllowanceType[];
  appUsers: AppUser[];
  branches: Branch[];
  sectors: Sector[];
  managements: Management[];
  costCenterDepts: CostCenterDept[];
  leaves: Leave[];
  companySettings: CompanySettings | null;
  loading: boolean;
  error: FirestoreErrorInfo | null;
}

const DataContext = createContext<DataContextType>({
  employees: [],
  transactions: [],
  payrollRuns: [],
  allowanceTypes: [],
  appUsers: [],
  branches: [],
  sectors: [],
  managements: [],
  costCenterDepts: [],
  leaves: [],
  companySettings: null,
  loading: true,
  error: null,
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [managements, setManagements] = useState<Management[]>([]);
  const [costCenterDepts, setCostCenterDepts] = useState<CostCenterDept[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreErrorInfo | null>(null);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading && !user) {
        setLoading(false);
      }
      return;
    }

    const handleLocalError = (err: unknown, op: OperationType, path: string) => {
      // Ignore "Missing or insufficient permissions" if we just signed out or are signing in
      if (err instanceof Error && err.message.includes('permissions')) {
        console.warn(`Permission denied for ${path}, might be auth transition.`);
        return;
      }
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

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'branches'));

    const unsubSectors = onSnapshot(collection(db, 'sectors'), (snap) => {
      setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'sectors'));

    const unsubManagements = onSnapshot(collection(db, 'managements'), (snap) => {
      setManagements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Management)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'managements'));

    const unsubCostCenterDepts = onSnapshot(collection(db, 'costCenterDepts'), (snap) => {
      setCostCenterDepts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CostCenterDept)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'costCenterDepts'));

    const unsubLeaves = onSnapshot(collection(db, 'leaves'), (snap) => {
      setLeaves(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leave)));
    }, (err) => handleLocalError(err, OperationType.LIST, 'leaves'));

    const unsubSettings = onSnapshot(doc(db, 'companySettings', 'main'), (snap) => {
      if (snap.exists()) {
        setCompanySettings(snap.data() as CompanySettings);
      } else {
        setCompanySettings({ companyName: 'نظام الرواتب الذكي' });
      }
    }, (err) => handleLocalError(err, OperationType.GET, 'companySettings/main'));

    const timer = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubEmployees();
      unsubTransactions();
      unsubPayrollRuns();
      unsubAllowanceTypes();
      unsubUsers();
      unsubBranches();
      unsubSectors();
      unsubManagements();
      unsubCostCenterDepts();
      unsubLeaves();
      unsubSettings();
      clearTimeout(timer);
    };
  }, [user, authLoading]);

  if (error) {
    throw new Error(JSON.stringify(error));
  }

  return (
    <DataContext.Provider value={{ employees, transactions, payrollRuns, allowanceTypes, appUsers, branches, sectors, managements, costCenterDepts, leaves, companySettings, loading, error }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
