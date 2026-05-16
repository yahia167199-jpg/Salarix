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
    
    // 1. Deduplicate employees (Standard logic used in Transactions Final Report)
    const uniqueEmployeesMap = new Map();
    allEmployees.forEach(emp => {
      const key = `${emp.employeeId}_${emp.name}`;
      const existing = uniqueEmployeesMap.get(key);
      if (existing) {
        const hasTransactionNew = allTransactions.some(t => t.employeeId === emp.id && t.month === month);
        const hasTransactionOld = allTransactions.some(t => t.employeeId === existing.id && t.month === month);
        if (hasTransactionNew && !hasTransactionOld) uniqueEmployeesMap.set(key, emp);
      } else {
        uniqueEmployeesMap.set(key, emp);
      }
    });

    // 2. Filter employees for payroll calculation
    // Include Standard, Saudi, and Accounting classifications
    // Requirement: Must have an active status (Active or Out of Sponsorship variants)
    const targetEmployees = Array.from(uniqueEmployeesMap.values())
      .filter(emp => {
        // Updated Requirement: Bank only, Active only (no Leave), and must have Transactions
        const isActive = emp.status === 'Active' || 
                        emp.status === 'Out of Sponsorship (Active)' || 
                        emp.status === 'Out of Sponsorship';
        const isBank = emp.paymentMethod === 'Bank';
        const hasMovement = allTransactions.some(t => t.employeeId === emp.id && t.month === month);
        
        return isActive && isBank && hasMovement;
      })
      .sort((a, b) => {
        const idA = parseInt(a.employeeId || '0', 10);
        const idB = parseInt(b.employeeId || '0', 10);
        if (isNaN(idA) || isNaN(idB)) return (a.employeeId || '').localeCompare(b.employeeId || '');
        return idA - idB;
      });

    const monthTransactions = allTransactions.filter(t => t.month === month);
    const batch = writeBatch(db);
    let totalNet = 0;

    const results: PayrollResult[] = targetEmployees.map(emp => {
      // Find transaction for this employee this month
      const empTrans = monthTransactions.find(t => t.employeeId === emp.id);
      
      // If skipped, net is 0
      if (empTrans?.status === 'Skipped') {
        const resultDocRef = doc(collection(db, 'payrollResults'));
        const result: PayrollResult = {
          id: resultDocRef.id,
          payrollRunId: runId,
          employeeId: emp.id,
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
          basicSalary: 0,
          housingAllowance: 0,
          transportAllowance: 0,
          subsistenceAllowance: 0,
          otherAllowances: 0,
          mobileAllowance: 0,
          managementAllowance: 0,
          otherIncome: 0,
          salaryIncrease: 0,
          overtimeHours: 0,
          overtimeValue: 0,
          totalIncome: 0,
          socialInsurance: 0,
          salaryReceived: 0,
          loans: 0,
          otherDeductions: 0,
          deductionHours: 0,
          delayDeduction: 0,
          absenceDays: 0,
          absenceDeduction: 0,
          totalDeductions: 0,
          netSalary: 0,
          roundingDiff: 0,
          grossBase: 0,
          otherEarnings: 0,
          bankExportAmount: 0,
          cashExportAmount: 0
        };
        batch.set(resultDocRef, result);
        return result;
      }

      // Use values from transaction or defaults if not processed
      const basicSalary = empTrans ? Number(empTrans.basicSalary || 0) : (emp.basicSalary || 0);
      const housing = empTrans ? Number(empTrans.housingAllowance || 0) : (emp.housingAllowance || 0);
      const transport = empTrans ? Number(empTrans.transportAllowance || 0) : (emp.transportAllowance || 0);
      const subsistence = empTrans ? Number(empTrans.subsistenceAllowance || 0) : (emp.subsistenceAllowance || 0);
      const other = empTrans ? Number(empTrans.otherAllowances || 0) : (emp.otherAllowances || 0);
      const mobile = empTrans ? Number(empTrans.mobileAllowance || 0) : (emp.mobileAllowance || 0);
      const management = empTrans ? Number(empTrans.managementAllowance || 0) : (emp.managementAllowance || 0);

      const details = calculatePayrollDetails({
        basicSalary,
        housingAllowance: housing,
        transportAllowance: transport,
        subsistenceAllowance: subsistence,
        otherAllowances: other,
        mobileAllowance: mobile,
        managementAllowance: management,
        otherIncome: empTrans ? Number(empTrans.otherIncome || 0) : 0,
        overtimeHours: empTrans ? Number(empTrans.overtimeHours || 0) : 0,
        overtimeValue: empTrans ? Number(empTrans.overtimeValue || 0) : 0,
        salaryIncrease: empTrans ? Number(empTrans.salaryIncrease || 0) : 0,
        socialInsurance: empTrans ? Number(empTrans.socialInsurance || 0) : 0,
        salaryReceived: empTrans ? Number(empTrans.salaryReceived || 0) : 0,
        loans: empTrans ? Number(empTrans.loans || 0) : 0,
        otherDeductions: empTrans ? Number(empTrans.otherDeductions || 0) : 0,
        deductionHours: empTrans ? Number(empTrans.deductionHours || 0) : 0,
        departureDelayDeduction: empTrans ? Number(empTrans.departureDelayDeduction || 0) : 0,
        absenceDays: empTrans ? Number(empTrans.absenceDays || 0) : 0,
        absenceDeduction: empTrans ? Number(empTrans.absenceDeduction || 0) : 0,
        dailyWorkHours: emp.dailyWorkHours || 8,
        overtimeBaseSalary: emp.basicSalary,
        paymentMethod: emp.paymentMethod,
        notes: empTrans?.notes || ''
      });
    
      const resultDocRef = doc(collection(db, 'payrollResults'));
      const netSalary = Number(details.netSalary.toFixed(2));
      
      const result: PayrollResult = {
        id: resultDocRef.id,
        payrollRunId: runId,
        employeeId: emp.id, // Internal ID for relationship
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
        salaryIncrease: details.salaryIncrease,
        overtimeHours: details.overtimeHours,
        overtimeValue: details.overtimeValue,
        totalIncome: details.totalIncome,
        socialInsurance: details.socialInsurance,
        salaryReceived: details.salaryReceived,
        loans: details.loans,
        otherDeductions: details.otherDeductions,
        deductionHours: details.deductionHours,
        delayDeduction: details.delayDeduction,
        absenceDays: details.absenceDays,
        absenceDeduction: details.absenceDeduction,
        totalDeductions: details.totalDeductions,
        netSalary: netSalary,
        roundingDiff: 0,
        
        // Legacy/Computed
        grossBase: details.grossBase,
        otherEarnings: details.otherEarnings,
        bankExportAmount: details.bankExportAmount,
        cashExportAmount: details.cashExportAmount
      };

      batch.set(resultDocRef, result);
      totalNet += netSalary;
      return result;
    });

    const run: PayrollRun = {
      id: runId,
      month,
      status: 'Draft',
      totalNet: Number(totalNet.toFixed(2)),
      employeeCount: targetEmployees.length,
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
    // 1. Inclusion Rule: Total Salary > 0 AND Payment Method === 'Bank' AND Has Movement this month
    const bankEmployees = results.filter(r => {
      const hasMovement = allTransactions.some(t => t.employeeId === r.employeeId && t.month === run.month);
      return r.paymentMethod === 'Bank' && r.netSalary > 0 && hasMovement;
    });
    
    // Create an active subset of results for correct reconciliations
    const activeResults = results.filter(r => 
      allTransactions.some(t => t.employeeId === r.employeeId && t.month === run.month)
    );
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
      // Rule: If status is Out of Sponsorship, group under "خارج الكفالة"
      const emp = allEmployees.find(e => e.id === curr.employeeId);
      const isOutOfSponsorship = emp?.status === 'Out of Sponsorship' || emp?.status === 'Out of Sponsorship (Active)' || emp?.status === 'Out of Sponsorship (Leave)';
      
      const b = isOutOfSponsorship ? 'خارج الكفالة' : (curr.officialEmployer || 'غير محدد');
      acc[b] = (acc[b] || 0) + curr.netSalary;
      return acc;
    }, {});
    
    const branchNames = [
      'مصنع إيفاء لتعبئة المياه',
      'شركة صالح سعيد طيشان و اولادة',
      'شركة نهضه الصناعية',
      'شركة صالح سعيد طيشان و اولادة - فرع الرياض',
      'شركة صالح سعيد طيشان واولادة',
      'بيتنا الافضل',
      'خارج الكفالة',
      'جملا',
      'غير محدد'
    ];

    const branchRows = branchNames.map(name => [name, branchMap[name] || 0]);
    const branchGrandTotal = Object.values(branchMap).reduce((sum: any, val: any) => sum + val, 0);

    // 5. Reconciliation (Certified = Standard Employees only)
    const getIsStandard = (r: PayrollResult) => {
      const emp = allEmployees.find(e => (e.id === r.employeeId));
      return emp?.classification !== 'Saudi' && emp?.classification !== 'Accounting';
    };

    const certifiedBankAmount = activeResults
      .filter(r => r.paymentMethod === 'Bank' && getIsStandard(r))
      .reduce((sum, r) => sum + r.netSalary, 0);
    
    const certifiedCashAmount = activeResults
      .filter(r => r.paymentMethod === 'Cash' && getIsStandard(r))
      .reduce((sum, r) => sum + r.netSalary, 0);

    const bankCount = activeResults.filter(r => r.paymentMethod === 'Bank').length;
    const cashCount = activeResults.filter(r => r.paymentMethod === 'Cash').length;
    const totalEmployeesCount = activeResults.length;
    
    // الفرق بالزيادة = إجمالي Total Salary (من شيت البنك) – رواتب موظفين البنك (من المعتمد)
    const excessDiff = Number((sumTotalSalary - certifiedBankAmount).toFixed(2));

    // 6. Difference Breakdown
    const accountingTotal = activeResults.reduce((sum, r) => {
      const emp = allEmployees.find(e => (e.id === r.employeeId));
      return (emp?.classification === 'Accounting' && r.paymentMethod === 'Bank') ? sum + r.netSalary : sum;
    }, 0);

    const saudiTotal = activeResults.reduce((sum, r) => {
      const emp = allEmployees.find(e => (e.id === r.employeeId));
      return (emp?.classification === 'Saudi' && r.paymentMethod === 'Bank') ? sum + r.netSalary : sum;
    }, 0);

    const breakdownSum = Number((accountingTotal + saudiTotal).toFixed(2));
    // The final rounding difference is what's left of the excess after accounting/saudi
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
      ['* إجمالي فرق جبر الكسور العشرية', sumRoundingDiff],
      [],
      ['🏢 ملخص الفروع (Branch Summary)'],
      ['الفرع', 'مجموع Total Salary'],
      ...branchRows,
      ['إجمالي كل الفروع', branchGrandTotal]
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
        <h3 className="text-xl font-black text-gray-900 dark:text-white">مسير الرواتب الشهري</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-200 dark:shadow-none"
        >
          <Play className="w-5 h-5" />
          <span>احتساب رواتب شهر جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRuns.map((run) => (
          <div key={run.id} className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-black",
                  run.status === 'Approved' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                  run.status === 'Draft' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
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
                  className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-white hover:bg-red-500 transition-all bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center group/del active:scale-90"
                  title="حذف المسير"
                >
                  <Trash2 className="w-4 h-4 transition-transform group-hover/del:scale-110" />
                </button>
              </div>
            </div>
            
            <h4 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{run.month}</h4>
            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium mb-6">{run.employeeCount} موظف تم احتسابهم</p>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl mb-6">
              <p className="text-xs text-gray-400 dark:text-gray-500 font-bold mb-1 uppercase tracking-wider">إجمالي الصافي</p>
              <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(run.totalNet)}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => { setSelectedRun(run); fetchResults(run.id); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedRun(null)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-white dark:bg-gray-900 w-full max-w-5xl h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800">
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">تفاصيل مسير {selectedRun.month}</h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">الحالة: {selectedRun.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => deleteRun(selectedRun.id, selectedRun.status)}
                    className="flex items-center gap-2 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold rounded-2xl transition-all"
                    title="حذف المسير نهائياً"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>حذف المسير</span>
                  </button>
                  <button 
                    onClick={() => exportToExcel(selectedRun, results)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>تصدير ملف البنك</span>
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    <Printer className="w-5 h-5" />
                    <span>طباعة</span>
                  </button>
                  <button onClick={() => setSelectedRun(null)} className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors"><X className="w-6 h-6 text-gray-400 dark:text-gray-500" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-8">
                <table className="w-full text-right">
                  <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="pb-4 text-sm font-black text-gray-400 dark:text-gray-500 uppercase">الموظف</th>
                      <th className="pb-4 text-sm font-black text-gray-400 dark:text-gray-500 uppercase">الأساسي</th>
                      <th className="pb-4 text-sm font-black text-gray-400 dark:text-gray-500 uppercase">إجمالي الاستحقاقات</th>
                      <th className="pb-4 text-sm font-black text-gray-400 dark:text-gray-500 uppercase">إجمالي الاستقطاعات</th>
                      <th className="pb-4 text-sm font-black text-gray-400 dark:text-gray-500 uppercase">الصافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="py-4 font-bold text-gray-900 dark:text-white">{r.employeeName}</td>
                        <td className="py-4 text-gray-600 dark:text-gray-400">{formatCurrency(r.basicSalary)}</td>
                        <td className="py-4 text-emerald-600 dark:text-emerald-400 font-bold">+{formatCurrency(r.totalIncome)}</td>
                        <td className="py-4 text-red-600 dark:text-red-400 font-bold">-{formatCurrency(r.totalDeductions)}</td>
                        <td className="py-4 font-black text-gray-900 dark:text-white">{formatCurrency(r.netSalary)}</td>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-gray-100 dark:border-gray-800">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-6 text-center">احتساب رواتب شهر جديد</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">اختر الشهر</label>
                  <input type="month" className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white" value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <p className="text-sm text-blue-700 dark:text-blue-400 font-medium leading-relaxed">سيقوم النظام بسحب جميع الموظفين النشطين واحتساب رواتبهم بناءً على الحركات المسجلة لهذا الشهر.</p>
                </div>
                <button 
                  onClick={calculatePayroll}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 dark:shadow-none"
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

export default PayrollRuns;
