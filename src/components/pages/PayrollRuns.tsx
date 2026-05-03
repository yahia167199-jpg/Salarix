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
  Calendar,
  Trash2,
  Printer
} from 'lucide-react';
import { db, collection, setDoc, doc, query, where, getDocs, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { writeBatch } from 'firebase/firestore';
import { Employee, PayrollRun, PayrollResult, Transaction } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { calculatePayrollDetails } from '../../lib/payrollUtils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

import { useMemo } from 'react';

export const PayrollRuns: React.FC = () => {
  const { payrollRuns: runs, employees: allEmployees, transactions: allTransactions } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [results, setResults] = useState<PayrollResult[]>([]);
  
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const calculatePayroll = async () => {
    const runDocRef = doc(collection(db, 'payrollRuns'));
    const runId = runDocRef.id;
    
    // Use data from global context to avoid redundant Firestore reads
    const employees = allEmployees.filter(e => e.status === 'Active');
    const transactions = allTransactions.filter(t => t.month === month);

    const batch = writeBatch(db);
    let totalNet = 0;

    const results: PayrollResult[] = employees
      .filter(emp => emp.status === 'Active')
      .map(emp => {
        // Find transaction for this employee this month
        const empTrans = transactions.find(t => t.employeeId === emp.id);
        
        // Use consolidated calculation utility for all financial fields
        // Requirement: Overtime calculation must use original basic salary from employee profile
        const details = calculatePayrollDetails({
          ...(empTrans || {
            basicSalary: emp.basicSalary,
            housingAllowance: emp.housingAllowance,
            transportAllowance: emp.transportAllowance,
            subsistenceAllowance: emp.subsistenceAllowance,
            otherAllowances: emp.otherAllowances,
            mobileAllowance: emp.mobileAllowance,
            managementAllowance: emp.managementAllowance,
            dailyWorkHours: emp.dailyWorkHours || 8,
          }),
          overtimeBaseSalary: emp.basicSalary 
        });
      
      totalNet += details.netSalary;

      const resultDocRef = doc(collection(db, 'payrollResults'));
      const result: PayrollResult = {
        id: resultDocRef.id,
        payrollRunId: runId,
        employeeId: emp.employeeId || emp.id,
        employeeName: emp.name,
        iqamaNumber: emp.iqamaNumber,
        officialEmployer: emp.officialEmployer,
        location: emp.location,
        sectors: emp.sectors,
        costCenterMain: emp.costCenterMain,
        costCenterDept: emp.costCenterDept,
        paymentMethod: emp.paymentMethod,
        bankAccount: emp.bankAccount,
        bankCode: emp.bankCode,

        // Map calculated details to result object
        basicSalary: details.basicSalary,
        housingAllowance: details.housingAllowance,
        transportAllowance: details.transportAllowance,
        subsistenceAllowance: details.subsistenceAllowance,
        otherAllowances: details.otherAllowances,
        mobileAllowance: details.mobileAllowance,
        managementAllowance: details.managementAllowance,
        otherIncome: details.otherIncome,
        overtimeHours: details.overtimeHours,
        overtimeValue: details.overtimeValue,
        totalIncome: details.totalIncome,
        socialInsurance: details.socialInsurance,
        salaryReceived: details.salaryReceived,
        loans: details.loans,
        bankReceived: details.bankReceived,
        otherDeductions: details.otherDeductions,
        deductionHours: details.deductionHours,
        delayDeduction: details.delayDeduction,
        absenceDays: details.absenceDays,
        absenceDeduction: details.absenceDeduction,
        totalDeductions: details.totalDeductions,
        netSalary: Math.round(details.netSalary),
        roundingDiff: Number((Math.round(details.netSalary) - details.netSalary).toFixed(2)),
        
        // Legacy/Computed
        grossBase: details.grossBase,
        otherEarnings: details.otherEarnings,
        bankExportAmount: details.bankExportAmount,
        cashExportAmount: details.cashExportAmount
      };

      batch.set(resultDocRef, result);
      totalNet += result.netSalary;
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

  const fetchResults = async (runId: string) => {
    const q = query(collection(db, 'payrollResults'), where('payrollRunId', '==', runId));
    const snap = await getDocs(q);
    setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollResult)));
  };

  const updateStatus = async (run: PayrollRun, newStatus: PayrollRun['status']) => {
    await setDoc(doc(db, 'payrollRuns', run.id), { ...run, status: newStatus }, { merge: true });
  };

  const deleteRun = async (runId: string, runStatus: string) => {
    const isApproved = runStatus === 'Approved' || runStatus === 'Confirmed' || runStatus === 'معتمد';
    const warningHeader = isApproved ? "⚠️ تنبيه: حذف مسير معتمد" : "حذف مسير رواتب";
    const warningBody = isApproved 
      ? "هذا المسير معتمد حالياً. حذفه سيؤدي إلى مسح كافة النتائج والتقارير المالية المرتبطة به نهائياً وبشكل لا يمكن التراجع عنه."
      : "سيتم حذف جميع نتائج هذا المسير والتقارير المرتبطة به نهائياً.";

    if (!window.confirm(`${warningHeader}\n\n${warningBody}\n\nهل أنت متأكد من رغبتك في الحذف النهائي والتمكن من إعادة الاحتساب؟`)) return;
    
    try {
      // 1. Get all associated results for this run
      const q = query(collection(db, 'payrollResults'), where('payrollRunId', '==', runId));
      const snap = await getDocs(q);
      
      const batch = writeBatch(db);
      
      // 2. Add all related result deletions to the batch
      snap.forEach(d => {
        batch.delete(doc(db, 'payrollResults', d.id));
      });
      
      // 3. Add the main payroll run document deletion to the batch
      batch.delete(doc(db, 'payrollRuns', runId));
      
      // 4. Commit all deletions atomically
      await batch.commit();

      // 5. Clear local state to refresh UI
      if (selectedRun?.id === runId) {
        setSelectedRun(null);
        setResults([]);
      }
    } catch (error) {
      console.error('Error during permanent deletion:', error);
      handleFirestoreError(error, OperationType.DELETE, `payrollRuns/${runId}`);
    }
  };

  const exportToExcel = (run: PayrollRun, results: PayrollResult[]) => {
    // 1. Inclusion Rule: Total Salary > 0 AND Payment Method === 'Bank'
    const bankEmployees = results.filter(r => r.paymentMethod === 'Bank' && r.netSalary > 0);
    
    // 2. Prepare Row Data
    const [year, monthNum] = run.month.split('-');
    const formattedDate = `${monthNum}/${year}`;

    const employeeRows = bankEmployees.map((r) => [
      r.bankCode || '',        // Bank
      r.bankAccount || '',     // Account Number
      r.netSalary,             // Total Salary
      `راتب شهر ${formattedDate}`, // Comments
      r.employeeName,          // Employee Name
      r.iqamaNumber || '',     // National ID / Iqama ID
      '(ALBAHA)',              // Employee Address
      r.basicSalary,           // Basic Salary
      r.housingAllowance,      // Housing Allowance
      r.otherEarnings,         // Other Earnings
      r.totalDeductions,       // Deductions
      r.officialEmployer || '' // الفرع
    ]);

    const headers = [
      'Bank', 
      'Account Number', 
      'Total Salary', 
      'Comments', 
      'Employee Name', 
      'National ID / Iqama ID', 
      'Employee Address', 
      'Basic Salary', 
      'Housing Allowance', 
      'Other Earnings', 
      'Deductions', 
      'الفرع'
    ];

    // 3. Totals Calculation (Bank Sheet specific)
    const sumTotalSalary = bankEmployees.reduce((sum, e) => sum + e.netSalary, 0);
    const sumBasic = bankEmployees.reduce((sum, e) => sum + e.basicSalary, 0);
    const sumHousing = bankEmployees.reduce((sum, e) => sum + e.housingAllowance, 0);
    const sumOtherEarnings = bankEmployees.reduce((sum, e) => sum + e.otherEarnings, 0);
    const sumDeductions = bankEmployees.reduce((sum, e) => sum + e.totalDeductions, 0);
    const sumRoundingDiff = bankEmployees.reduce((sum, e) => sum + (e.roundingDiff || 0), 0);
    
    const calculatedNet = Number(((sumBasic + sumHousing + sumOtherEarnings) - sumDeductions).toFixed(2));
    const systemDiff = Number((calculatedNet - (sumTotalSalary - sumRoundingDiff)).toFixed(2));

    // 4. Branch Summary
    const branchMap = bankEmployees.reduce((acc: any, curr) => {
      const b = curr.officialEmployer || 'غير محدد';
      acc[b] = (acc[b] || 0) + curr.netSalary;
      return acc;
    }, {});
    const branchRows = Object.entries(branchMap).map(([name, amount]) => [name, amount]);
    const branchGrandTotal = Object.values(branchMap).reduce((sum: any, val: any) => sum + val, 0);

    // 5. Reconciliation (Certified = Standard Employees only)
    const getIsStandard = (empId: string) => {
      const emp = allEmployees.find(e => (e.employeeId === empId || e.id === empId));
      return !emp?.classification || emp.classification === 'Standard';
    };

    const certifiedBankAmount = results
      .filter(r => r.paymentMethod === 'Bank' && getIsStandard(r.employeeId))
      .reduce((sum, r) => sum + r.netSalary, 0);
    
    const certifiedCashAmount = results
      .filter(r => r.paymentMethod === 'Cash' && getIsStandard(r.employeeId))
      .reduce((sum, r) => sum + r.netSalary, 0);

    const bankCount = results.filter(r => r.paymentMethod === 'Bank').length;
    const cashCount = results.filter(r => r.paymentMethod === 'Cash').length;
    const totalEmployeesCount = results.length;
    
    // الفرق بالزيادة = إجمالي Total Salary (من شيت البنك) – رواتب موظفين البنك (من المعتمد)
    const excessDiff = Number((sumTotalSalary - certifiedBankAmount).toFixed(2));

    // 6. Difference Breakdown
    const accountingTotal = results.reduce((sum, r) => {
      const emp = allEmployees.find(e => (e.employeeId === r.employeeId || e.id === r.employeeId));
      return emp?.classification === 'Accounting' ? sum + r.netSalary : sum;
    }, 0);

    const saudiTotal = results.reduce((sum, r) => {
      const emp = allEmployees.find(e => (e.employeeId === r.employeeId || e.id === r.employeeId));
      return emp?.classification === 'Saudi' ? sum + r.netSalary : sum;
    }, 0);

    const breakdownSum = Number((accountingTotal + saudiTotal).toFixed(2));
    const finalRoundingDiff = Number((excessDiff - breakdownSum).toFixed(2));

    // 7. Consolidating the final AOA
    const finalAoa = [
      headers,
      ...employeeRows,
      [],
      ['1. إجمالي التحويل البنكي', sumTotalSalary],
      [],
      ['2. إجمالي مكونات الرواتب'],
      ['إجمالي Basic Salary', sumBasic],
      ['إجمالي Housing Allowance', sumHousing],
      ['إجمالي Other Earnings', sumOtherEarnings],
      ['إجمالي Deductions', sumDeductions],
      [],
      ['3. صافي الرواتب المحسوب', calculatedNet],
      ['4. فرق النظام', systemDiff],
      ['5. إجمالي فرق جبر الكسور العشرية', sumRoundingDiff],
      [],
      ['🏢 ملخص الفروع (Branch Summary)'],
      ['الفرع', 'مجموع Total Salary'],
      ...branchRows,
      ['إجمالي كل الفروع', branchGrandTotal],
      [],
      ['🔗 قسم المطابقة (Reconciliation)'],
      ['رواتب موظفين البنك (المعتمد)', certifiedBankAmount],
      ['رواتب موظفين الكاش', certifiedCashAmount],
      ['إجمالي الموظفين (عدد)', totalEmployeesCount],
      ['عدد موظفي البنك', bankCount],
      ['عدد موظفي الكاش', cashCount],
      [],
      ['الفرق بالزيادة (Bank Sheet vs Certified Base)', excessDiff],
      [],
      ['📊 تحليل الفروقات (Difference Breakdown)'],
      ['المحاسبات', accountingTotal],
      ['السعودين', saudiTotal],
      ['إجماليهم', breakdownSum],
      ['فرق جبر الكسور', finalRoundingDiff]
    ];

    // 8. Generate and Download
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(finalAoa);
    
    ws['!cols'] = [
      { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 },
      { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Bank_Payroll_Statement");
    XLSX.writeFile(wb, `Bank_Payroll_${run.month}.xlsx`);
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
              <div className="flex flex-col items-end gap-2">
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-black",
                  run.status === 'Approved' ? "bg-emerald-50 text-emerald-600" :
                  run.status === 'Draft' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                )}>
                  {run.status}
                </div>
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    deleteRun(run.id, run.status); 
                  }}
                  className="p-2.5 text-gray-400 hover:text-white hover:bg-red-500 transition-all bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center group/del active:scale-90"
                  title="حذف المسير"
                >
                  <Trash2 className="w-4 h-4 transition-transform group-hover/del:scale-110" />
                </button>
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
                    onClick={() => deleteRun(selectedRun.id, selectedRun.status)}
                    className="flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 font-bold rounded-2xl transition-all"
                    title="حذف المسير نهائياً"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>حذف المسير</span>
                  </button>
                  <button 
                    onClick={() => exportToExcel(selectedRun, results)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>تصدير ملف البنك</span>
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    <Printer className="w-5 h-5" />
                    <span>طباعة</span>
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
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">إجمالي الاستحقاقات</th>
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">إجمالي الاستقطاعات</th>
                      <th className="pb-4 text-sm font-black text-gray-400 uppercase">الصافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 font-bold text-gray-900">{r.employeeName}</td>
                        <td className="py-4 text-gray-600">{formatCurrency(r.basicSalary)}</td>
                        <td className="py-4 text-emerald-600 font-bold">+{formatCurrency(r.totalIncome)}</td>
                        <td className="py-4 text-red-600 font-bold">-{formatCurrency(r.totalDeductions)}</td>
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
