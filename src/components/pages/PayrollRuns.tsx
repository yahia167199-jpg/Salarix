import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  CheckCircle2, 
  Lock, 
  FileSpreadsheet,
  Eye,
  ChevronLeft,
  X,
  Calendar
} from 'lucide-react';
import { db, collection, onSnapshot, setDoc, doc, query, where, getDocs, OperationType, handleFirestoreError } from '../../firebase';
import { writeBatch } from 'firebase/firestore';
import { Employee, PayrollRun, PayrollResult, Transaction } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

import { useMemo } from 'react';

export const PayrollRuns: React.FC = () => {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [results, setResults] = useState<PayrollResult[]>([]);
  
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'payrollRuns'), (snap) => {
      setRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollRun)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'payrollRuns'));
    return unsub;
  }, []);

  const fetchResults = async (runId: string) => {
    const q = query(collection(db, 'payrollResults'), where('payrollRunId', '==', runId));
    const snap = await getDocs(q);
    setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollResult)));
  };

  const calculatePayroll = async () => {
    const runDocRef = doc(collection(db, 'payrollRuns'));
    const runId = runDocRef.id;
    
    // 1. Get all active employees
    const empSnap = await getDocs(query(collection(db, 'employees'), where('status', '==', 'Active')));
    const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));

    // 2. Get all transactions for this month
    const transSnap = await getDocs(query(collection(db, 'transactions'), where('month', '==', month)));
    const transactions = transSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

    const batch = writeBatch(db);
    let totalNet = 0;

    const results: PayrollResult[] = employees.map(emp => {
      // Find transaction for this employee this month
      const empTrans = transactions.find(t => t.employeeId === emp.id);
      
      let basicSalary = emp.basicSalary;
      let housingAllowance = emp.housingAllowance || 0;
      let allowances = (emp.allowances || []).reduce((sum, a) => sum + a.amount, 0) + 
                       (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + 
                       (emp.subsistenceAllowance || 0) + (emp.otherAllowances || 0) + 
                       (emp.mobileAllowance || 0) + (emp.managementAllowance || 0);
      let overtime = 0;
      let deductions = 0;
      let netSalary = basicSalary + allowances;

      if (empTrans) {
        basicSalary = empTrans.basicSalary;
        housingAllowance = empTrans.housingAllowance;
        allowances = empTrans.housingAllowance + empTrans.transportAllowance + 
                     empTrans.subsistenceAllowance + empTrans.otherAllowances + 
                     empTrans.mobileAllowance + empTrans.managementAllowance + 
                     empTrans.otherIncome + empTrans.salaryIncrease;
        overtime = empTrans.overtimeValue;
        deductions = empTrans.totalDeductions;
        netSalary = empTrans.netSalary;
      }
      
      totalNet += netSalary;

      const resultDocRef = doc(collection(db, 'payrollResults'));
      const result: PayrollResult = {
        id: resultDocRef.id,
        payrollRunId: runId,
        employeeId: emp.employeeId || emp.id,
        employeeName: emp.name,
        iqamaNumber: emp.iqamaNumber,
        officialEmployer: emp.officialEmployer,
        location: emp.location,
        paymentMethod: emp.paymentMethod,
        basicSalary,
        housingAllowance,
        allowances,
        overtime,
        deductions,
        netSalary,
        bankAccount: emp.bankAccount,
        bankCode: emp.bankCode
      };

      batch.set(resultDocRef, result);
      return result;
    });

    const run: PayrollRun = {
      id: runId,
      month,
      status: 'Draft',
      totalNet,
      employeeCount: employees.length,
      updatedAt: new Date().toISOString()
    };

    batch.set(runDocRef, run);
    await batch.commit();
    setIsModalOpen(false);
  };

  const updateStatus = async (run: PayrollRun, newStatus: PayrollRun['status']) => {
    await setDoc(doc(db, 'payrollRuns', run.id), { ...run, status: newStatus }, { merge: true });
  };

  const exportToExcel = (run: PayrollRun, results: PayrollResult[]) => {
    // Filter only Bank paymentMethod
    const bankResults = results.filter(r => r.paymentMethod === 'Bank');

    const data = bankResults.map((r) => ({
      'Bank': r.bankCode || '',
      'Account Number': r.bankAccount || '',
      'Total Salary': r.netSalary,
      'Comments': `Salary for ${run.month}`,
      'Employee Name': r.employeeName,
      'National ID/Iqama ID': r.iqamaNumber || '',
      'Employee Address': r.location || '',
      'Basic Salary': r.basicSalary,
      'Housing Allowance': r.housingAllowance,
      'Other Earnings': (r.allowances + r.overtime) - r.housingAllowance,
      'Deductions': r.deductions,
      'صاحب العمل الرسمي': r.officialEmployer || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank_Payroll");
    XLSX.writeFile(wb, `Salarix_Bank_Payroll_${run.month}.xlsx`);
  };

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => b.month.localeCompare(a.month));
  }, [runs]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-gray-900">مسير الرواتب الشهري</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-200"
        >
          <Play className="w-5 h-5" />
          <span>احتساب رواتب شهر جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRuns.map((run) => (
          <div key={run.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Calendar className="w-7 h-7" />
              </div>
              <div className={cn(
                "px-4 py-1.5 rounded-full text-xs font-black",
                run.status === 'Approved' ? "bg-emerald-50 text-emerald-600" :
                run.status === 'Draft' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
              )}>
                {run.status}
              </div>
            </div>
            
            <h4 className="text-2xl font-black text-gray-900 mb-1">{run.month}</h4>
            <p className="text-sm text-gray-400 font-medium mb-6">{run.employeeCount} موظف تم احتسابهم</p>
            
            <div className="p-4 bg-gray-50 rounded-2xl mb-6">
              <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">إجمالي الصافي</p>
              <p className="text-xl font-black text-gray-900">{formatCurrency(run.totalNet)}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => { setSelectedRun(run); fetchResults(run.id); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-100 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>عرض</span>
              </button>
              {run.status === 'Draft' && (
                <button 
                  onClick={() => updateStatus(run, 'Approved')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedRun && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedRun(null)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-white w-full max-w-5xl h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">تفاصيل مسير {selectedRun.month}</h3>
                  <p className="text-sm text-gray-400 font-medium">الحالة: {selectedRun.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => exportToExcel(selectedRun, results)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>تصدير ملف البنك</span>
                  </button>
                  <button onClick={() => setSelectedRun(null)} className="p-2 hover:bg-white rounded-xl transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-8">
                <table className="w-full text-right">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-gray-100">
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">الموظف</th>
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">الأساسي</th>
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">البدلات</th>
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">إضافي</th>
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">خصومات</th>
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">الصافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 font-bold text-gray-900">{r.employeeName}</td>
                        <td className="py-4 text-gray-600">{formatCurrency(r.basicSalary)}</td>
                        <td className="py-4 text-gray-600">{formatCurrency(r.allowances)}</td>
                        <td className="py-4 text-blue-600 font-bold">+{formatCurrency(r.overtime)}</td>
                        <td className="py-4 text-red-600 font-bold">-{formatCurrency(r.deductions)}</td>
                        <td className="py-4 font-black text-gray-900">{formatCurrency(r.netSalary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calculation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8">
              <h3 className="text-2xl font-black text-gray-900 mb-6 text-center">احتساب رواتب شهر جديد</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 mr-2">اختر الشهر</label>
                  <input type="month" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-sm text-blue-700 font-medium leading-relaxed">سيقوم النظام بسحب جميع الموظفين النشطين واحتساب رواتبهم بناءً على الحركات المسجلة لهذا الشهر.</p>
                </div>
                <button 
                  onClick={calculatePayroll}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200"
                >
                  بدء الاحتساب الآن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
