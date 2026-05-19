import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  History,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  Filter,
  ChevronDown,
  CheckCircle2,
  FastForward,
  UserCheck,
  UserMinus,
  LayoutGrid,
  ClipboardList,
  AlertCircle,
  RotateCcw,
  Building2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Edit2,
  ShieldCheck,
  TrendingUpDown,
  Receipt,
  Banknote,
  Users,
  CalendarX,
  Printer
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, serverTimestamp, OperationType, handleFirestoreError } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Employee, Transaction, EmployeeCategory } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { calculatePayrollDetails } from '../../lib/payrollUtils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

import { useMemo } from 'react';

export const Transactions: React.FC = () => {
  const { transactions, employees, payrollRuns, companySettings } = useData();
  const [activeTab, setActiveTab] = useState<'History' | 'MonthlyCard'>('History');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isViewCardOpen, setIsViewCardOpen] = useState(false);
  const [selectedTxForView, setSelectedTxForView] = useState<Transaction | null>(null);
  const [importMonth, setImportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<EmployeeCategory | 'All' | 'OutofSponsorship'>('Standard');
  const [monthlyCardFilter, setMonthlyCardFilter] = useState<EmployeeCategory | 'All' | 'OutofSponsorship'>('Standard');
  const [gridStatusFilter, setGridStatusFilter] = useState<'All' | 'Active' | 'Leave' | 'Out of Sponsorship (Active)' | 'Out of Sponsorship (Leave)'>('Active');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const [isVarianceModalOpen, setIsVarianceModalOpen] = useState(false);
  const [varianceResults, setVarianceResults] = useState<any>(null);
  const [loadingVariance, setLoadingVariance] = useState(false);

  // Return from leave modal state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedEmpForReturn, setSelectedEmpForReturn] = useState<Employee | null>(null);
  const [actualReturnDate, setActualReturnDate] = useState(new Date().toISOString().slice(0, 10));

  // Form State
  const [formData, setFormData] = useState<(Omit<Transaction, 'id' | 'createdAt'> & { id?: string, createdAt?: string })>({
    employeeId: '',
    month: new Date().toISOString().slice(0, 7),
    actualWorkDays: 30,
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    subsistenceAllowance: 0,
    otherAllowances: 0,
    mobileAllowance: 0,
    managementAllowance: 0,
    otherIncome: 0,
    overtimeHours: 0,
    overtimeValue: 0,
    totalIncome: 0,
    socialInsurance: 0,
    salaryReceived: 0,
    loans: 0,
    otherDeductions: 0,
    deductionHours: 0,
    departureDelayDeduction: 0,
    absenceDays: 0,
    absenceDeduction: 0,
    totalDeductions: 0,
    netSalary: 0,
    status: 'Draft',
    salaryIncrease: 0,
    dailyWorkHours: 8,
    notes: ''
  });

  // Helper to calculate remaining days in month from a specific date
  const calculateRemainingDaysInMonth = (inputDate: string, targetMonth: string) => {
    if (!inputDate || !targetMonth || !inputDate.startsWith(targetMonth)) return 30;
    
    try {
      const date = new Date(inputDate);
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      
      // Get last day of the month to know total days (30, 31, 28, 29)
      const lastDay = new Date(year, month + 1, 0).getDate();
      
      // Remaining days: Total - Current + 1 (to include the start day)
      // Example: 31st is last day, joined on 15th -> (31 - 15) + 1 = 17 days
      return Math.max(1, lastDay - day + 1);
    } catch (e) {
      return 30;
    }
  };

  const handleEmployeeChange = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      // Logic: Calculate suggested work days if joined/returned this month
      const directDate = emp.lastDirectDate || emp.joinDate;
      let suggestedDays = 30;
      
      if (directDate && directDate.startsWith(formData.month)) {
        suggestedDays = calculateRemainingDaysInMonth(directDate, formData.month);
      }

      const days = suggestedDays;
      // Pro-rate based on suggested/actual work days: (Monthly / 30) * actualWorkDays
      const proRate = (val: number) => Number(((val / 30) * days).toFixed(2));

      // Auto-notes logic for Directing/Joining Date
      let initialNotes = '';
      if (directDate && directDate.startsWith(formData.month)) {
        const parts = directDate.split('-');
        if (parts.length === 3) {
          const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          initialNotes = `مباشرة عمل يوم ${formattedDate} م`;
        }
      }

      setFormData({
        ...formData,
        id: undefined, // CRITICAL: Clear ID when changing employee to prevent overwriting
        employeeId: empId,
        actualWorkDays: suggestedDays,
        basicSalary: proRate(emp.basicSalary || 0),
        housingAllowance: proRate(emp.housingAllowance || 0),
        transportAllowance: proRate(emp.transportAllowance || 0),
        subsistenceAllowance: proRate(emp.subsistenceAllowance || 0),
        otherAllowances: proRate(emp.otherAllowances || 0),
        mobileAllowance: proRate(emp.mobileAllowance || 0),
        managementAllowance: proRate(emp.managementAllowance || 0),
        dailyWorkHours: emp.dailyWorkHours || 8,
        notes: initialNotes
      });
    } else {
      setFormData({ ...formData, id: undefined, employeeId: empId });
    }
  };

  // Re-run calculations and pro-rating if key inputs change
  useEffect(() => {
    if (!formData.employeeId) return;
    const emp = employees.find(e => e.id === formData.employeeId);
    if (!emp) return;

    const days = formData.actualWorkDays || 30;
    const proRate = (val: number) => Number(((val / 30) * days).toFixed(2));

    const updatedBase = {
      basicSalary: proRate(emp.basicSalary || 0),
      housingAllowance: proRate(emp.housingAllowance || 0),
      transportAllowance: proRate(emp.transportAllowance || 0),
      subsistenceAllowance: proRate(emp.subsistenceAllowance || 0),
      otherAllowances: proRate(emp.otherAllowances || 0),
      mobileAllowance: proRate(emp.mobileAllowance || 0),
      managementAllowance: proRate(emp.managementAllowance || 0),
    };

    // Requirement 1, 2, 5: Centralized calculation of absence and overtime
    // Requirement: Overtime calculation must use original basic salary from employee profile
    const details = calculatePayrollDetails({ 
      ...formData, 
      ...updatedBase,
      overtimeBaseSalary: emp.basicSalary 
    });

    // Auto-notes logic
    let newNotes = formData.notes || '';
    
    // 1. Join/Direct Date note
    const directDate = emp.lastDirectDate || emp.joinDate;
    const joinNote = (directDate && directDate.startsWith(formData.month)) 
      ? (() => {
          const parts = directDate.split('-');
          return parts.length === 3 ? `مباشرة عمل يوم ${parts[2]}/${parts[1]}/${parts[0]} م` : '';
        })()
      : '';

    // 2. Absence note
    const absenceNote = formData.absenceDays > 0 ? `خصم ${formData.absenceDays} يوم غياب` : '';

    // Merge notes logic: 
    // We want to keep manual notes but manage auto ones
    // For simplicity, we'll construct the dynamic part
    const autoParts = [joinNote, absenceNote].filter(Boolean);
    const autoString = autoParts.join(' - ');

    // If notes were empty or only contained previous auto-notes, we update them
    // This is tricky without knowing what's manual. 
    // Let's just update the notes if they are empty or if we are just starting
    // OR we just append/prepend if not present.
    // Better: If the user hasn't typed anything else, or if the auto-string changes
    
    setFormData(prev => {
      let finalNotes = prev.notes || '';
      
      // If notes are empty or only contained old auto-notes pattern, replace them
      // pattern matches "خصم \d+ يوم غياب" and "مباشرة عمل يوم \d+/\d+/\d+ م"
      const absenceRegex = /خصم \d+ يوم غياب/;
      const joinRegex = /مباشرة عمل يوم \d+\/\d+\/\d+ م/;
      
      let tempNotes = finalNotes;
      
      // Remove old auto notes to re-add fresh ones
      tempNotes = tempNotes.replace(absenceRegex, '').replace(joinRegex, '').trim();
      // Remove artifacts like " - - " or " - " at ends
      tempNotes = tempNotes.replace(/^ - | - $/g, '').replace(/ -  - /g, ' - ').trim();
      
      const combined = [tempNotes, autoString].filter(Boolean).join(' - ');
      
      return {
        ...prev,
        ...updatedBase,
        overtimeValue: details.overtimeValue,
        absenceDeduction: details.absenceDeduction,
        notes: combined
      };
    });
  }, [formData.actualWorkDays, formData.overtimeHours, formData.absenceDays, formData.dailyWorkHours, formData.employeeId]);

  const calculateTotals = (data: typeof formData) => {
    const emp = employees.find(e => e.id === data.employeeId);
    // Requirement: Ensure overtime calculation always uses the contract basic salary from the employee profile
    const details = calculatePayrollDetails({
      ...data,
      overtimeBaseSalary: emp?.basicSalary
    });
    return {
      totalIncome: details.totalIncome,
      totalDeductions: details.totalDeductions,
      netSalary: details.netSalary,
      overtimeValue: details.overtimeValue,
      absenceDeduction: details.absenceDeduction,
    };
  };

  const resetForm = () => {
    setFormData({
      id: undefined,
      employeeId: '',
      month: selectedMonth,
      actualWorkDays: 30,
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      subsistenceAllowance: 0,
      otherAllowances: 0,
      mobileAllowance: 0,
      managementAllowance: 0,
      otherIncome: 0,
      overtimeHours: 0,
      overtimeValue: 0,
      totalIncome: 0,
      socialInsurance: 0,
      salaryReceived: 0,
      loans: 0,
      otherDeductions: 0,
      deductionHours: 0,
      departureDelayDeduction: 0,
      absenceDays: 0,
      absenceDeduction: 0,
      totalDeductions: 0,
      netSalary: 0,
      status: 'Draft',
      salaryIncrease: 0,
      dailyWorkHours: 8,
      notes: ''
    });
    setEmpSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totals = calculateTotals(formData);
    
    try {
      setLoading(true);
      const transactionData = {
        ...formData,
        ...totals,
        updatedAt: serverTimestamp()
      };

      // Use deterministic ID to prevent duplicates (employeeId_month)
      const transactionId = `${formData.employeeId}_${formData.month}`;
      
      await setDoc(doc(db, 'transactions', transactionId), {
        ...transactionData,
        id: transactionId, // Ensure ID is consistent
        createdAt: formData.createdAt || new Date().toISOString()
      });

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, formData.id ? OperationType.UPDATE : OperationType.CREATE, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  // Update form month when selectedMonth changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, month: selectedMonth }));
  }, [selectedMonth]);

  const handleSkip = async (employeeId: string) => {
    try {
      setLoading(true);
      // Use deterministic ID
      const transactionId = `${employeeId}_${selectedMonth}`;
      
      await setDoc(doc(db, 'transactions', transactionId), {
        id: transactionId,
        employeeId,
        month: selectedMonth,
        status: 'Skipped',
        actualWorkDays: 0,
        totalIncome: 0,
        totalDeductions: 0,
        netSalary: 0,
        createdAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error skipping transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployeesForGrid = useMemo(() => {
    // 1. Deduplicate employees by employeeId + name to avoid UI duplicates caused by accidental double entries
    const uniqueEmployeesMap = new Map();
    employees.forEach(emp => {
      // Create a key that identifies duplicates (same official ID or same name)
      const key = `${emp.employeeId}_${emp.name}`;
      const existing = uniqueEmployeesMap.get(key);
      
      // If we found a duplicate, prefer the one that has a transaction in the current month
      if (existing) {
        const hasTransactionNew = transactions.some(t => t.employeeId === emp.id && t.month === selectedMonth);
        const hasTransactionOld = transactions.some(t => t.employeeId === existing.id && t.month === selectedMonth);
        
        if (hasTransactionNew && !hasTransactionOld) {
          uniqueEmployeesMap.set(key, emp);
        }
      } else {
        uniqueEmployeesMap.set(key, emp);
      }
    });
    
    const uniqueEmployees = Array.from(uniqueEmployeesMap.values());

    return uniqueEmployees
      .filter(e => {
        if (gridStatusFilter === 'All') return (e.status === 'Active' || e.status === 'Leave' || e.status === 'Out of Sponsorship' || e.status === 'Out of Sponsorship (Active)' || e.status === 'Out of Sponsorship (Leave)');
        if (gridStatusFilter === 'Active') return (e.status === 'Active' || e.status === 'Out of Sponsorship (Active)' || e.status === 'Out of Sponsorship');
        if (gridStatusFilter === 'Leave') return (e.status === 'Leave' || e.status === 'Out of Sponsorship (Leave)');
        return e.status === gridStatusFilter;
      })
      .filter(e => {
        if (monthlyCardFilter === 'All') return true;
        if (monthlyCardFilter === 'OutofSponsorship') {
          return e.status === 'Out of Sponsorship' || e.status === 'Out of Sponsorship (Active)' || e.status === 'Out of Sponsorship (Leave)';
        }
        if (monthlyCardFilter === 'Standard') {
          return (e.classification !== 'Saudi' && e.classification !== 'Accounting') || 
                 (e.status === 'Out of Sponsorship' || e.status === 'Out of Sponsorship (Active)' || e.status === 'Out of Sponsorship (Leave)');
        }
        return e.classification === monthlyCardFilter;
      })
      .filter(e => {
        const matchesSearch = (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (e.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (showIncompleteOnly) {
          const hasAction = transactions.find(t => t.employeeId === e.id && t.month === selectedMonth);
          return !hasAction;
        }
        return true;
      })
      .sort((a, b) => {
        const idA = parseInt(a.employeeId || '0', 10);
        const idB = parseInt(b.employeeId || '0', 10);
        if (isNaN(idA) || isNaN(idB)) {
          return (a.employeeId || '').localeCompare(b.employeeId || '');
        }
        return idA - idB;
      });
  }, [employees, transactions, selectedMonth, monthlyCardFilter, gridStatusFilter, searchTerm, showIncompleteOnly]);

  const gridStats = useMemo(() => {
    // 1. Deduplicate employees first (same as in filtering logic)
    const uniqueEmployeesMap = new Map();
    employees.forEach(emp => {
      const key = `${emp.employeeId}_${emp.name}`;
      const existing = uniqueEmployeesMap.get(key);
      if (existing) {
        const hasTransactionNew = transactions.some(t => t.employeeId === emp.id && t.month === selectedMonth);
        const hasTransactionOld = transactions.some(t => t.employeeId === existing.id && t.month === selectedMonth);
        if (hasTransactionNew && !hasTransactionOld) uniqueEmployeesMap.set(key, emp);
      } else {
        uniqueEmployeesMap.set(key, emp);
      }
    });
    const uniqueEmployees = Array.from(uniqueEmployeesMap.values());

    // 2. Filter unique employees by current status AND classification
    const targetEmployees = uniqueEmployees.filter(e => {
      // Status Filter
      let statusMatch = false;
      if (gridStatusFilter === 'All') {
        statusMatch = ['Active', 'Leave', 'Out of Sponsorship', 'Out of Sponsorship (Active)', 'Out of Sponsorship (Leave)'].includes(e.status);
      } else if (gridStatusFilter === 'Active') {
        statusMatch = (e.status === 'Active' || e.status === 'Out of Sponsorship (Active)' || e.status === 'Out of Sponsorship');
      } else if (gridStatusFilter === 'Leave') {
        statusMatch = (e.status === 'Leave' || e.status === 'Out of Sponsorship (Leave)');
      } else {
        statusMatch = e.status === gridStatusFilter;
      }
      if (!statusMatch) return false;

      // Classification Filter
      if (monthlyCardFilter === 'All') return true;
      if (monthlyCardFilter === 'OutofSponsorship') {
        return e.status === 'Out of Sponsorship' || e.status === 'Out of Sponsorship (Active)' || e.status === 'Out of Sponsorship (Leave)';
      }
      if (monthlyCardFilter === 'Standard') {
        return (e.classification !== 'Saudi' && e.classification !== 'Accounting') || 
               (e.status === 'Out of Sponsorship' || e.status === 'Out of Sponsorship (Active)' || e.status === 'Out of Sponsorship (Leave)');
      }
      return e.classification === monthlyCardFilter;
    });

    const total = targetEmployees.length;

    // 3. Map of target unique IDs for quick lookup
    const targetEmpIds = new Set(targetEmployees.map(e => e.id));

    // 4. Filter transactions for the selected month
    const monthTx = transactions.filter(t => t.month === selectedMonth);
    
    // 5. Count unique employees WHO ARE in the filtered target list AND have a transaction
    const uniqueFinishedEmpIds = new Set(
      monthTx
        .filter(t => targetEmpIds.has(t.employeeId))
        .map(t => t.employeeId)
    );
    
    const finished = uniqueFinishedEmpIds.size;
    
    // 6. Calculate totals for finished employees
    let totalNetSalary = 0;
    let totalEarnings = 0;
    let totalDeductions = 0;
    let totalBankSalaries = 0;
    let totalCashSalaries = 0;

    uniqueFinishedEmpIds.forEach(empId => {
      const t = monthTx.find(tx => tx.employeeId === empId);
      const emp = employees.find(e => e.id === empId);
      if (t) {
        totalNetSalary += (t.netSalary || 0);

        if (emp?.paymentMethod === 'Bank') {
          totalBankSalaries += (t.netSalary || 0);
        } else {
          totalCashSalaries += (t.netSalary || 0);
        }
        
        // Earnings: Basic, Housing, Transport, Subsistence, Mobile, Management, Other, Overtime, Increase, Other Income
        totalEarnings += (
          (t.basicSalary || 0) + 
          (t.housingAllowance || 0) + 
          (t.transportAllowance || 0) + 
          (t.subsistenceAllowance || 0) + 
          (t.mobileAllowance || 0) + 
          (t.managementAllowance || 0) + 
          (t.otherAllowances || 0) + 
          (t.overtimeValue || 0) + 
          (t.salaryIncrease || 0) + 
          (t.otherIncome || 0)
        );

        // Deductions: Social Insurance, Salary Received, Loans, Absence, Delay/Departure, Other + Hour Deduction Value
        const hourDeductionValue = (t.deductionHours || 0) * ((t.basicSalary || 0) / (30 * (emp?.dailyWorkHours || 8)));
        totalDeductions += (
          (t.socialInsurance || 0) + 
          (t.salaryReceived || 0) + 
          (t.loans || 0) + 
          (t.absenceDeduction || 0) + 
          (t.departureDelayDeduction || 0) + 
          (t.otherDeductions || 0) +
          hourDeductionValue
        );
      }
    });
    
    // 7. Detect duplicates in the full monthly transaction list (total records vs unique emp IDs for THIS month)
    const uniqueAllEmpIdsInMonth = new Set(monthTx.map(t => t.employeeId));
    const duplicatesCount = monthTx.length - uniqueAllEmpIdsInMonth.size;

    return { 
      total, 
      finished, 
      remaining: Math.max(0, total - finished), 
      duplicatesCount, 
      totalNetSalary,
      totalEarnings,
      totalDeductions,
      totalBankSalaries,
      totalCashSalaries
    };
  }, [employees, transactions, selectedMonth, gridStatusFilter, monthlyCardFilter]);

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'transactions', id));
    setDeleteConfirmId(null);
  };

  const deleteDrafts = async () => {
    const drafts = transactions.filter(t => t.status === 'Draft');
    if (drafts.length === 0) return alert('لا يوجد حركات مسودة لحذفها');
    
    if (!window.confirm(`هل أنت متأكد من حذف جميع الحركات في حالة "مسودة" عدد (${drafts.length})؟`)) return;
    
    try {
      const batch = writeBatch(db);
      drafts.forEach(d => {
        batch.delete(doc(db, 'transactions', d.id));
      });
      await batch.commit();
      alert('تم حذف جميع المسودات بنجاح');
    } catch (error) {
      console.error('Error deleting drafts:', error);
    }
  };

  const handleEdit = (t: Transaction) => {
    // Correctly handle pro-rating and calculations when editing
    const emp = employees.find(e => e.id === t.employeeId);
    setFormData({ ...t, dailyWorkHours: t.dailyWorkHours || emp?.dailyWorkHours || 8 });
    setIsModalOpen(true);
  };

  const deleteAllFiltered = async () => {
    if (sortedTransactions.length === 0) return alert('لا توجد سجلات لحذفها');
    
    if (!window.confirm(`هل أنت متأكد من حذف جميع السجلات الظاهرة؟ (عدد: ${sortedTransactions.length})`)) return;
    
    try {
      setLoading(true);
      const batch = writeBatch(db);
      sortedTransactions.forEach(t => {
        batch.delete(doc(db, 'transactions', t.id));
      });
      await batch.commit();
      alert('تم حذف السجلات بنجاح');
    } catch (error) {
      console.error('Error deleting records:', error);
      alert('حدث خطأ أثناء الحذف');
    } finally {
      setLoading(false);
    }
  };

  const handleResetMonth = async () => {
    // Filter transactions by the selected month
    const monthTransactions = transactions.filter(t => t.month === selectedMonth);
    if (monthTransactions.length === 0) return alert('لا توجد حركات لهذا الشهر لحذفها');
    
    if (!window.confirm(`هل أنت متأكد من إعادة تعيين (حذف) جميع حركات شهر ${selectedMonth}؟ سيتم إرجاع جميع الموظفين لحالة "انتظار الإدخال".`)) return;
    
    try {
      setLoading(true);
      const batch = writeBatch(db);
      monthTransactions.forEach(t => {
        batch.delete(doc(db, 'transactions', t.id));
      });
      await batch.commit();
      alert('تمت إعادة تعيين الشهر بالكامل بنجاح');
    } catch (error) {
      console.error('Error resetting month:', error);
      alert('حدث خطأ أثناء إعادة التعيين');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFromLastMonth = async () => {
    if (!selectedMonth) return;
    
    // Calculate last month string (YYYY-MM)
    const [year, month] = selectedMonth.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear--;
    }
    const lastMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    
    const lastMonthTx = transactions.filter(t => t.month === lastMonthStr);
    if (lastMonthTx.length === 0) {
      return alert(`لا توجد حركات مسجلة في الشهر السابق (${lastMonthStr}) لنسخها.`);
    }
    
    const currentMonthTx = transactions.filter(t => t.month === selectedMonth);
    const existingEmpIds = new Set(currentMonthTx.map(t => t.employeeId));
    
    const toCopy = lastMonthTx.filter(t => !existingEmpIds.has(t.employeeId));
    
    if (toCopy.length === 0) {
      return alert('كل موظفي الشهر السابق لديهم حركات مسجلة بالفعل في هذا الشهر.');
    }
    
    if (!window.confirm(`هل أنت متأكد من نسخ عدد (${toCopy.length}) حركة من شهر ${lastMonthStr} إلى شهر ${selectedMonth}؟ سيتم نسخ كافة البيانات (أيام العمل، البدلات، الإضافي، إلخ).`)) return;
    
    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      toCopy.forEach(t => {
        const newId = `${t.employeeId}_${selectedMonth}`;
        const newTx = {
          ...t,
          id: newId,
          month: selectedMonth,
          createdAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
          status: 'Draft' // Reset to draft status
        };
        batch.set(doc(db, 'transactions', newId), newTx);
      });
      
      await batch.commit();
      alert(`تم نسخ ${toCopy.length} حركة بنجاح.`);
    } catch (error) {
      console.error('Error copying transactions:', error);
      alert('حدث خطأ أثناء نسخ الحركات');
    } finally {
      setLoading(false);
    }
  };

  const handleExportDataEntryTemplate = () => {
    const targetEmployees = employees.filter(emp => 
      (emp.status === 'Active' || emp.status === 'Leave' || emp.status === 'Out of Sponsorship' || emp.status === 'Out of Sponsorship (Active)' || emp.status === 'Out of Sponsorship (Leave)') && 
      (emp.classification === 'Standard' || !emp.classification)
    );

    const data = targetEmployees.map((emp, index) => ({
      'ت عام': index + 1,
      'ت': index + 1,
      'الإسم': emp.name,
      'الجنسية': emp.nationality || '',
      'الوظيفة': emp.jobTitle || '',
      'الرقم الوظيفي': emp.employeeId || '',
      'ادارة القطاع': emp.sectorManagement || '',
      'القطاعات': emp.sectors || '',
      'مركز التكلفة / رئيسي': emp.costCenterMain || '',
      'مركز التكلفة / قسم': emp.costCenterDept || '',
      'الراتب الاساسي': emp.basicSalary,
      'بدل سكن': emp.housingAllowance || 0,
      'بدل نقل': emp.transportAllowance || 0,
      'بدل إعاشه': emp.subsistenceAllowance || 0,
      'بدلات اخرى': emp.otherAllowances || 0,
      'بدل جوال': emp.mobileAllowance || 0,
      'بدل ادارة': emp.managementAllowance || 0,
      'المجموع الراتب بالبدلات الاساسية': emp.basicSalary + (emp.housingAllowance || 0) + 
                                         (emp.transportAllowance || 0) + (emp.subsistenceAllowance || 0) + 
                                         (emp.otherAllowances || 0) + (emp.mobileAllowance || 0) + 
                                         (emp.managementAllowance || 0),
      'عدد الايام العمل الفعلي': 30,
      'بدل سكن (حركة)': emp.housingAllowance || 0,
      'بدل نقل (حركة)': emp.transportAllowance || 0,
      'بدل إعاشه (حركة)': emp.subsistenceAllowance || 0,
      'بدلات اخرى (حركة)': emp.otherAllowances || 0,
      'بدل جوال (حركة)': emp.mobileAllowance || 0,
      'بدل ادارة (حركة)': emp.managementAllowance || 0,
      'دخل آخر': 0,
      'عدد ساعات العمل الاضافي': 0,
      'تامينات اجتماعية': 0,
      'سلف': 0,
      'اقتطاعات اخرى': 0,
      'خصم المغادرات والتاخير': 0,
      'عدد الساعات': 0,
      'عدد ايام الغياب': 0,
      'ملاحظات': ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Input_Template");
    XLSX.writeFile(wb, `Payroll_Input_Template_${new Date().toISOString().slice(0, 7)}.xlsx`);
  };

  const handleExportFinalReport = () => {
    // 1. Get all unique employees and deduplicate (same logic as in grid)
    const uniqueEmployeesMap = new Map();
    employees.forEach(emp => {
      const key = `${emp.employeeId}_${emp.name}`;
      const existing = uniqueEmployeesMap.get(key);
      if (existing) {
        const hasTransactionNew = transactions.some(t => t.employeeId === emp.id && t.month === selectedMonth);
        const hasTransactionOld = transactions.some(t => t.employeeId === existing.id && t.month === selectedMonth);
        if (hasTransactionNew && !hasTransactionOld) uniqueEmployeesMap.set(key, emp);
      } else {
        uniqueEmployeesMap.set(key, emp);
      }
    });

    const allEmployees = Array.from(uniqueEmployeesMap.values());

    // 2. Filter for Export: Include Standard, Accounting, and Saudi
    // Filter by allowed active statuses
    const targetEmployees = allEmployees
      .filter(emp => {
        // Include Saudis, Standard, and Accounting
        // Requirement: Must have a target active status
        const isTargetStatus = emp.status === 'Active' || emp.status === 'Out of Sponsorship (Active)' || emp.status === 'Out of Sponsorship';
        if (!isTargetStatus) return false;

        return true;
      })
      .sort((a, b) => {
        const idA = parseInt(a.employeeId || '0', 10);
        const idB = parseInt(b.employeeId || '0', 10);
        if (isNaN(idA) || isNaN(idB)) {
          return (a.employeeId || '').localeCompare(b.employeeId || '');
        }
        return idA - idB;
      });

    const data = targetEmployees.map((emp, index) => {
      const t = transactions.find(tx => tx.employeeId === emp.id && tx.month === selectedMonth);
      
      // Values from transaction or defaults if not processed
      const basicSalary = t ? t.basicSalary : (emp.basicSalary || 0);
      const housing = t ? t.housingAllowance : (emp.housingAllowance || 0);
      const transport = t ? t.transportAllowance : (emp.transportAllowance || 0);
      const subsistence = t ? t.subsistenceAllowance : (emp.subsistenceAllowance || 0);
      const other = t ? t.otherAllowances : (emp.otherAllowances || 0);
      const mobile = t ? t.mobileAllowance : (emp.mobileAllowance || 0);
      const management = t ? t.managementAllowance : (emp.managementAllowance || 0);

      return {
        'ت عام': index + 1,
        'ت': index + 1,
        'الإسم': emp.name,
        'الجنسية': emp.nationality || '',
        'الوظيفة': emp.jobTitle || '',
        'الرقم الوظيفي': emp.employeeId || '',
        'بداية العمل': emp.joinDate || '',
        'آخر مباشرة': emp.lastDirectDate || '',
        'رقم الأقامة': emp.iqamaNumber || '',
        'ادارة القطاع': emp.sectorManagement || '',
        'القطاعات': emp.sectors || '',
        'مركز التكلفة / رئيسي': emp.costCenterMain || '',
        'مركز التكلفة / قسم': emp.costCenterDept || '',
        'الراتب الاساسي': emp.basicSalary || 0,
        'بدل سكن': emp.housingAllowance || 0,
        'بدل نقل': emp.transportAllowance || 0,
        'بدل إعاشه': emp.subsistenceAllowance || 0,
        'بدلات اخرى': emp.otherAllowances || 0,
        'بدل جوال': emp.mobileAllowance || 0,
        'بدل ادارة': emp.managementAllowance || 0,
        'المجموع': (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.subsistenceAllowance || 0) + (emp.otherAllowances || 0) + (emp.mobileAllowance || 0) + (emp.managementAllowance || 0),
        'عدد الايام العمل الفعلي': t ? t.actualWorkDays : 30,
        'بدل سكن (ح حركة)': housing,
        'بدل نقل (ح حركة)': transport,
        'بدل إعاشه (ح حركة)': subsistence,
        'بدلات اخرى (ح حركة)': other,
        'بدل جوال (ح حركة)': mobile,
        'بدل ادارة (ح حركة)': management,
        'دخل آخر': t ? t.otherIncome : 0,
        'عدد ساعات العمل الاضافي': t ? t.overtimeHours : 0,
        'قيمة عمل اضافي': t ? t.overtimeValue : 0,
        'مجموع الدخل': t ? t.totalIncome : (basicSalary + housing + transport + subsistence + other + mobile + management),
        'تامينات اجتماعية': t ? t.socialInsurance : 0,
        'استلام راتب': t ? t.salaryReceived : 0,
        'سلف': t ? t.loans : 0,
        'اقتطاعات اخرى': t ? t.otherDeductions : 0,
        'عدد الساعات': t ? t.deductionHours : 0,
        'خصم المغادرات والتاخير': t ? t.departureDelayDeduction : 0,
        'عدد ايام الغياب': t ? t.absenceDays : 0,
        'خصم الغياب': t ? t.absenceDeduction : 0,
        'مجموع الاقتطاعات': t ? t.totalDeductions : 0,
        'صافي الراتب': t ? t.netSalary : (basicSalary + housing + transport + subsistence + other + mobile + management),
        'الحالة': t ? (t.status === 'Draft' ? 'مسودة' : 'معتمد') : 'غير مدخل',
        'زيادة راتب': t ? (t.salaryIncrease || 0) : 0,
        'ملاحظات': t ? (t.notes || '') : ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Final_Payroll");
    XLSX.writeFile(wb, `Final_Approved_Payroll_${selectedMonth}.xlsx`);
  };

  const handleImportExcel = async () => {
    if (!importFile) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const dataArr = evt.target?.result;
        const wb = XLSX.read(dataArr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const batch = writeBatch(db);
        for (const row of data) {
          const emp = employees.find(e => 
            String(e.name).trim() === String(row['الإسم'] || row['اسم الموظف'] || '').trim() || 
            String(e.employeeId).trim() === String(row['الرقم الوظيفي'] || row['رقم الموظف'] || '').trim()
          );

          if (emp) {
            const rowMonth = importMonth;
            const transactionId = `${emp.id}_${rowMonth}`;
            const docRef = doc(db, 'transactions', transactionId);
            
            const rawData = {
              id: transactionId,
              employeeId: emp.id,
              month: rowMonth,
              actualWorkDays: Number(row['عدد الايام العمل الفعلي'] || row['أيام العمل']) || 30,
              basicSalary: Number(row['الراتب الاساسي (حركة)'] || row['الراتب الاساسي'] || row['الأساسي']) || emp.basicSalary,
              housingAllowance: Number(row['بدل سكن (حركة)'] || row['بدل سكن (ح حركة)'] || row['بدل سكن']) ?? emp.housingAllowance,
              transportAllowance: Number(row['بدل نقل (حركة)'] || row['بدل نقل (ح حركة)'] || row['بدل نقل']) ?? emp.transportAllowance,
              subsistenceAllowance: Number(row['بدل إعاشه (حركة)'] || row['بدل إعاشه (ح حركة)'] || row['بدل إعاشه']) ?? emp.subsistenceAllowance,
              otherAllowances: Number(row['بدلات اخرى (حركة)'] || row['بدلات اخرى (ح حركة)'] || row['بدلات اخرى']) ?? emp.otherAllowances,
              mobileAllowance: Number(row['بدل جوال (حركة)'] || row['بدل جوال (ح حركة)'] || row['بدل جوال']) ?? emp.mobileAllowance,
              managementAllowance: Number(row['بدل ادارة (حركة)'] || row['بدل ادارة (ح حركة)'] || row['بدل ادارة']) ?? emp.managementAllowance,
              otherIncome: Number(row['دخل آخر']) || 0,
              overtimeHours: Number(row['عدد ساعات العمل الاضافي'] || row['ساعات الإضافي']) || 0,
              overtimeValue: Number(row['قيمة عمل اضافي'] || row['قيمة الإضافي']) || 0,
              socialInsurance: Number(row['تامينات اجتماعية'] || row['تأمين اجتماعي']) || 0,
              salaryReceived: Number(row['استلام راتب'] || row['استلام الكاش']) || 0,
              loans: Number(row['سلف']) || 0,
              otherDeductions: Number(row['اقتطاعات اخرى'] || row['خصومات أخرى']) || 0,
              deductionHours: Number(row['عدد الساعات'] || row['ساعات الخصم']) || 0,
              departureDelayDeduction: Number(row['خصم المغادرات والتاخير']) || 0,
              absenceDays: Number(row['عدد ايام الغياب'] || row['أيام الغياب']) || 0,
              absenceDeduction: Number(row['خصم الغياب']) || 0,
              salaryIncrease: Number(row['زيادة راتب']) || 0,
              dailyWorkHours: Number(row['ساعات العمل اليومية'] || emp.dailyWorkHours) || 8,
              notes: row['ملاحظات'] || '',
              status: 'Draft'
            };

            const totals = calculateTotals(rawData as any);
            batch.set(docRef, { ...rawData, ...totals, createdAt: new Date().toISOString() });
          }
        }

        await batch.commit();
        alert('تم استيراد الحركات بنجاح');
        setIsImportModalOpen(false);
        setImportFile(null);
      } catch (error) {
        console.error('Error importing excel:', error);
        alert('حدث خطأ أثناء استيراد البيانات');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(importFile);
  };

  const sortedTransactions = useMemo(() => {
    // 1. Deduplicate transactions by employeeId + month to handle legacy duplicate data
    const uniqueTxMap = new Map();
    transactions.forEach(t => {
      const key = `${t.employeeId}_${t.month}`;
      const existing = uniqueTxMap.get(key);
      
      // Prefer the most recently created or updated transaction
      if (!existing || (t.createdAt || '') > (existing.createdAt || '')) {
        uniqueTxMap.set(key, t);
      }
    });

    const uniqueTransactions = Array.from(uniqueTxMap.values());

    return uniqueTransactions
      .filter(t => {
        // Strict month filter
        if (t.month !== selectedMonth) return false;

        const emp = employees.find(e => e.id === t.employeeId);
        const empName = emp?.name || '';
        
        // Search term filter
        const matchesSearch = (empName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
                             (emp?.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (emp?.iqamaNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        // Classification filter
        if (classificationFilter !== 'All') {
          if (classificationFilter === 'OutofSponsorship') {
            if (!(emp?.status === 'Out of Sponsorship' || emp?.status === 'Out of Sponsorship (Active)' || emp?.status === 'Out of Sponsorship (Leave)')) return false;
          } else if (classificationFilter === 'Standard') {
            const isOutOfSponsorship = emp?.status === 'Out of Sponsorship' || emp?.status === 'Out of Sponsorship (Active)' || emp?.status === 'Out of Sponsorship (Leave)';
            if (!isOutOfSponsorship && (emp?.classification === 'Saudi' || emp?.classification === 'Accounting')) return false;
          } else {
            if (emp?.classification !== classificationFilter) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const empA = employees.find(e => e.id === a.employeeId);
        const empB = employees.find(e => e.id === b.employeeId);
        const idA = parseInt(empA?.employeeId || '0', 10);
        const idB = parseInt(empB?.employeeId || '0', 10);
        if (isNaN(idA) || isNaN(idB)) {
          return (empA?.employeeId || '').localeCompare(empB?.employeeId || '');
        }
        return idA - idB;
      });
  }, [transactions, employees, searchTerm, classificationFilter, selectedMonth]);

  const handleReturnFromLeave = (emp: Employee) => {
    setSelectedEmpForReturn(emp);
    setActualReturnDate(new Date().toISOString().slice(0, 10));
    setIsReturnModalOpen(true);
  };

  const confirmReturn = async () => {
    if (!selectedEmpForReturn) return;

    try {
      setLoading(true);
      
      // Update employee status and direct date
      await setDoc(doc(db, 'employees', selectedEmpForReturn.id), {
        ...selectedEmpForReturn,
        status: 'Active',
        lastDirectDate: actualReturnDate,
        updatedAt: serverTimestamp()
      });

      // Also update any active leave records to 'Completed'
      const q = query(
        collection(db, 'leaves'),
        where('employeeId', '==', selectedEmpForReturn.id),
        where('status', '==', 'Active')
      );
      const leaveSnap = await getDocs(q);
      const batch = writeBatch(db);
      leaveSnap.forEach(l => {
        batch.update(doc(db, 'leaves', l.id), {
          status: 'Completed',
          returnDate: actualReturnDate,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();

      alert(`تم تنشيط الموظف ${selectedEmpForReturn.name} بنجاح تحديث تاريخ المباشرة إلى ${actualReturnDate}`);
      setIsReturnModalOpen(false);
      setSelectedEmpForReturn(null);
    } catch (error) {
      console.error('Error returning from leave:', error);
      alert('حدث خطأ أثناء تنشيط الموظف');
    } finally {
      setLoading(false);
    }
  };

  const formatMonthArabic = (monthStr: string) => {
    if (!monthStr) return '---';
    const [year, month] = monthStr.split('-');
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  const getPreviousMonth = (currentMonthStr: string) => {
    const [year, month] = currentMonthStr.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  };

  const handleVarianceAnalysis = async () => {
    setLoadingVariance(true);
    try {
      const prevMonth = getPreviousMonth(selectedMonth);
      const prevRun = payrollRuns.find(r => r.month === prevMonth);
      
      let prevResults: any[] = [];
      if (prevRun) {
        const q = query(collection(db, 'payrollResults'), where('payrollRunId', '==', prevRun.id));
        const snap = await getDocs(q);
        prevResults = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const currentTransactions = transactions.filter(t => t.month === selectedMonth);
      
      // Map current transactions to a result-like structure
      const currentResults = currentTransactions.map(t => {
        const emp = employees.find(e => e.id === t.employeeId);
        return {
          ...t,
          employeeName: emp?.name || '---',
          paymentMethod: emp?.paymentMethod || 'Bank',
          totalIncome: t.totalIncome || 0,
          totalDeductions: t.totalDeductions || 0,
          netSalary: t.netSalary || 0
        };
      });

      // Comparison Summary
      const summary = {
        earnings: {
          current: currentResults.reduce((sum, r) => sum + r.totalIncome, 0),
          prev: prevResults.reduce((sum, r: any) => sum + r.totalIncome, 0),
        },
        deductions: {
          current: currentResults.reduce((sum, r) => sum + r.totalDeductions, 0),
          prev: prevResults.reduce((sum, r: any) => sum + r.totalDeductions, 0),
        },
        net: {
          current: currentResults.reduce((sum, r) => sum + r.netSalary, 0),
          prev: prevResults.reduce((sum, r: any) => sum + r.netSalary, 0),
        },
        paymentBank: {
          current: currentResults.filter(r => r.paymentMethod === 'Bank').reduce((sum, r) => sum + r.netSalary, 0),
          prev: prevResults.filter((r: any) => r.paymentMethod === 'Bank').reduce((sum, r: any) => sum + r.netSalary, 0),
          count: currentResults.filter(r => r.paymentMethod === 'Bank').length,
          prevCount: prevResults.filter((r: any) => r.paymentMethod === 'Bank').length
        },
        paymentCash: {
          current: currentResults.filter(r => r.paymentMethod === 'Cash').reduce((sum, r) => sum + r.netSalary, 0),
          prev: prevResults.filter((r: any) => r.paymentMethod === 'Cash').reduce((sum, r: any) => sum + r.netSalary, 0),
          count: currentResults.filter(r => r.paymentMethod === 'Cash').length,
          prevCount: prevResults.filter((r: any) => r.paymentMethod === 'Cash').length
        },
        employeeCount: {
          current: currentResults.length,
          prev: prevResults.length,
        },
        leaves: {
          current: employees.filter(e => (e.status === 'Leave' || e.status === 'Out of Sponsorship (Leave)')).length,
          prev: 0,
        }
      };

      // Employee level comparison
      const allEmpIds = Array.from(new Set([
        ...currentResults.map(r => r.employeeId),
        ...prevResults.map((r: any) => r.employeeId)
      ]));

      const comparisons = allEmpIds.map(empId => {
        const curr = currentResults.find(r => r.employeeId === empId);
        const prev = prevResults.find((r: any) => r.employeeId === empId);
        const emp = employees.find(e => e.id === empId);

        let note = 'مستقر';
        if (!prev && curr) note = 'موظف جديد';
        else if (prev && !curr) note = 'مستبعد / في إجازة';
        else if (prev && curr) {
          const diff = curr.netSalary - prev.netSalary;
          if (Math.abs(diff) < 0.01) note = 'لا يوجد تغيير';
          else {
            const reasons = [];
            if (curr.basicSalary !== prev.basicSalary) reasons.push('تغير في الأساسي');
            if (curr.absenceDays > (prev.absenceDays || 0)) reasons.push('زيادة أيام غياب');
            if (curr.overtimeValue > (prev.overtimeValue || 0)) reasons.push('إضافة عمل إضافي');
            if (curr.loans > (prev.loans || 0)) reasons.push('تحصيل سلف');
            if (curr.otherIncome > (prev.otherIncome || 0)) reasons.push('بدلات إضافية');
            
            note = reasons.length > 0 ? reasons.join(' + ') : (diff > 0 ? 'زيادة في الصافي' : 'نقص في الصافي');
          }
        }

        return {
          name: curr?.employeeName || prev?.employeeName || emp?.name || '---',
          employeeId: emp?.employeeId || '---',
          prevNet: prev?.netSalary || 0,
          currNet: curr?.netSalary || 0,
          diff: (curr?.netSalary || 0) - (prev?.netSalary || 0),
          note
        };
      }).sort((a, b) => {
        const idA = parseInt(a.employeeId || '0', 10);
        const idB = parseInt(b.employeeId || '0', 10);
        if (isNaN(idA) || isNaN(idB)) return (a.employeeId || '').localeCompare(b.employeeId || '');
        return idA - idB;
      });

      setVarianceResults({ summary, comparisons, prevMonth });
      setIsVarianceModalOpen(true);
    } catch (error) {
      console.error('Error calculating variance:', error);
    } finally {
      setLoadingVariance(false);
    }
  };

  const handleMonthlyCardSelection = (emp: Employee) => {
    if (emp.status === 'Leave') {
      alert('برجاء تأكيد تاريخ المباشرة أولاً ثم أعد إدخال الكارت الشهري');
      return;
    }
    const existing = transactions.find(t => t.employeeId === emp.id && t.month === selectedMonth);
    if (existing) {
      handleEdit(existing);
    } else {
      resetForm();
      handleEmployeeChange(emp.id);
      setIsModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Headers and Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1.5 bg-gray-100/50 dark:bg-gray-800/50 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('History')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
              activeTab === 'History' 
                ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" 
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50"
            )}
          >
            <History className="w-4 h-4" />
            سجل الحركات
          </button>
          <button
            onClick={() => setActiveTab('MonthlyCard')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
              activeTab === 'MonthlyCard' 
                ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" 
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50"
            )}
          >
            <ClipboardList className="w-4 h-4" />
            كارت العمل الشهري
          </button>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-2 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <Calendar className="w-5 h-5 text-gray-400 mr-2" />
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-none outline-none font-black text-gray-900 dark:text-white cursor-pointer"
          />
        </div>
      </div>

      {/* Summary Filter / Alerts */}
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-sm">
        {!selectedMonth ? (
          <div className="flex flex-col items-center justify-center py-6 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
            <h3 className="text-xl font-black">لابد من اختيار الشهر أولاً</h3>
          </div>
        ) : transactions.filter(t => t.month === selectedMonth).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-blue-600 dark:text-blue-400">
            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
            <h3 className="text-xl font-black">لا يوجد حركات في هذا الشهر الجاري ({selectedMonth})</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-blue-50/50 dark:bg-blue-900/20 p-5 rounded-[2rem] border border-blue-100/50 dark:border-blue-900/30 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">إجمالي المستحقات</span>
              </div>
              <h4 className="text-lg font-black text-gray-900 dark:text-white">
                {formatCurrency(gridStats.totalEarnings)}
              </h4>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">للموظفين المختارين بالتصفية</p>
            </div>

            <div className="bg-red-50/50 dark:bg-red-900/20 p-5 rounded-[2rem] border border-red-100/50 dark:border-red-900/30 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <ArrowDownRight className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">إجمالي الخصومات</span>
              </div>
              <h4 className="text-lg font-black text-gray-900 dark:text-white">
                {formatCurrency(gridStats.totalDeductions)}
              </h4>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">للموظفين المختارين بالتصفية</p>
            </div>

            <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-5 rounded-[2rem] border border-emerald-100/50 dark:border-emerald-900/30 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">إجمالي الصافي للمصفى</span>
              </div>
              <h4 className="text-lg font-black text-gray-900 dark:text-white">
                {formatCurrency(gridStats.totalNetSalary)}
              </h4>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">صافي الموظفين المختارين</p>
            </div>

            <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-5 rounded-[2rem] border border-indigo-100/50 dark:border-indigo-900/30 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Building2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">رواتب البنك</span>
              </div>
              <h4 className="text-lg font-black text-gray-900 dark:text-white">
                {formatCurrency(gridStats.totalBankSalaries)}
              </h4>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">المحولين للبنوك (حسب التصفية)</p>
            </div>

            <div className="bg-amber-50/50 dark:bg-amber-900/20 p-5 rounded-[2rem] border border-amber-100/50 dark:border-amber-900/30 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Wallet className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">رواتب الكاش</span>
              </div>
              <h4 className="text-lg font-black text-gray-900 dark:text-white">
                {formatCurrency(gridStats.totalCashSalaries)}
              </h4>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">المستلمين كاش (حسب التصفية)</p>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'History' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                <History className="w-8 h-8 text-blue-600" />
                سجل الحركات الشهرية
              </h1>
              <p className="text-gray-400 font-bold mr-11">مراقبة واعتماد مسيرات الرواتب والسلف والبدلات</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Button removed as per request */}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="البحث بالاسم، رقم الموظف، أو الإقامة..."
                  className="w-full pr-12 pl-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm text-gray-900 dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative group">
                <Filter className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                  classificationFilter !== 'All' ? "text-blue-600" : "text-gray-400"
                )} />
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value as any)}
                  className={cn(
                    "pr-10 pl-10 py-3 bg-white dark:bg-gray-900 border rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold shadow-sm appearance-none min-w-[200px] text-sm cursor-pointer",
                    classificationFilter !== 'All' 
                      ? "border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 bg-blue-50/10 dark:bg-blue-900/20" 
                      : "border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  <option value="All">كل التصنيفات</option>
                  <option value="Standard">موظف عادي</option>
                  <option value="Saudi">السعوديين</option>
                  <option value="OutofSponsorship">خارج الكفالة</option>
                  <option value="Accounting">رواتب المحاسبات</option>
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-gray-600" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {sortedTransactions.length > 0 && (
                <button 
                  onClick={deleteAllFiltered}
                  className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm flex items-center gap-2 font-bold"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="hidden md:inline">حذف الكل المصفى</span>
                </button>
              )}
              {transactions.some(t => t.status === 'Draft') && (
                <button 
                  onClick={deleteDrafts}
                  className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shadow-sm flex items-center gap-2 font-bold"
                >
                  <AlertCircle className="w-5 h-5" />
                  <span className="hidden md:inline">حذف المسودات</span>
                </button>
              )}
              <button 
                onClick={() => {
                  setImportMonth(selectedMonth);
                  setIsImportModalOpen(true);
                }}
                className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shadow-sm flex items-center gap-2 font-bold"
              >
                <Upload className="w-5 h-5" />
                <span className="hidden md:inline">استيراد</span>
              </button>
              <button 
                onClick={handleExportDataEntryTemplate}
                className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2 font-bold"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span className="hidden md:inline">نموذج الإدخال</span>
              </button>
              <button 
                onClick={handleExportFinalReport}
                className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2 font-bold"
              >
                <Download className="w-5 h-5 text-blue-600" />
                <span className="hidden md:inline">تقرير نهائي</span>
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/20"
              >
                <Plus className="w-5 h-5" />
                <span>إضافة حركة</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase">الموظف</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase">الشهر</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase text-center">صافي الراتب</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase text-right">الملاحظات</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase text-center">الحالة</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {sortedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <History className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-400 dark:text-gray-500 font-bold">لا يوجد حركات لهذا الشهر يطابق البحث ({selectedMonth})</p>
                      </td>
                    </tr>
                  ) : sortedTransactions.map((t) => {
                    const emp = employees.find(e => e.id === t.employeeId);
                    const isJoiningThisMonth = (emp?.lastDirectDate && emp.lastDirectDate.startsWith(t.month)) || 
                                                (emp?.joinDate && emp.joinDate.startsWith(t.month));
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all group border-b border-gray-50 dark:border-gray-800/50">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                              {emp?.name?.[0] || '?'}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <p className="font-black text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{emp?.name || 'موظف محذوف'}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-gray-400">ID: {emp?.employeeId || '---'}</span>
                                {isJoiningThisMonth && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-black bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-lg">
                                    <Calendar className="w-2.5 h-2.5" />
                                    مباشرة جديدة
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 font-bold text-gray-600 dark:text-gray-400 tabular-nums">{t.month}</td>
                        <td className="px-8 py-6 text-center">
                          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl inline-block border border-blue-100 dark:border-blue-900/30">
                            <span className="text-lg font-black text-blue-700 dark:text-blue-400 tabular-nums tracking-tighter">{formatCurrency(t.netSalary)}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-xs font-bold text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={t.notes}>
                          {t.notes || '---'}
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                              Approved
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button 
                              onClick={() => {
                                setSelectedTxForView(t);
                                setIsViewCardOpen(true);
                              }}
                              className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                              title="عرض كارت العمل"
                            >
                              <FileSpreadsheet className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleEdit(t)} 
                              className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm"
                              title="تعديل"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(t.id)} 
                              className="p-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm"
                              title="إعادة تعيين"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                <LayoutGrid className="w-8 h-8 text-indigo-600" />
                كارت العمل الشهري
              </h1>
              <p className="text-gray-400 font-bold mr-11">إدخال ومراجعة الحركات اليومية والبدلات لكل موقع</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleVarianceAnalysis}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2"
              >
                <TrendingUpDown className="w-5 h-5" />
                <span>تحليل الفروقات (Variance)</span>
              </button>
              <button 
                onClick={handleResetMonth}
                className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-black text-sm hover:bg-red-600 hover:text-white transition-all border border-red-100 dark:border-red-900/30 shadow-sm flex items-center gap-2 active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
                <span>تصفير الشهر</span>
              </button>
            </div>
          </div>

          {/* Progress Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500">إجمالي الموظفين</p>
                <h4 className="text-xl font-black text-gray-900 dark:text-white">{gridStats.total}</h4>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500">تـــــــــم</p>
                <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400">{gridStats.finished}</h4>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-2xl flex items-center justify-center">
                <UserMinus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500">المتبقي</p>
                <h4 className="text-xl font-black text-gray-900 dark:text-white">{gridStats.remaining}</h4>
              </div>
            </div>
          </div>

          {gridStats.duplicatesCount > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
                <p className="text-sm font-black text-red-900 dark:text-red-200">
                  تنبيه: تم اكتشاف عدد ({gridStats.duplicatesCount}) حركات مكررة لنفس الموظفين في هذا الشهر. 
                  الجدول أدناه يعرض أحدث نسخة فقط، ولكن ينصح بإعادة تعيين الشهر أو حذف المكرر يدوياً لضمان دقة التقارير.
                </p>
              </div>
              <button 
                onClick={handleResetMonth}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black shadow-sm shrink-0"
              >
                إعادة تعيين الشهر
              </button>
            </motion.div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                  className="w-full pr-12 pl-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm text-gray-900 dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative group">
                <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <select
                  value={monthlyCardFilter}
                  onChange={(e) => setMonthlyCardFilter(e.target.value as any)}
                  className="pr-10 pl-10 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl outline-none font-bold shadow-sm appearance-none min-w-[220px] text-sm cursor-pointer text-gray-900 dark:text-white"
                >
                  <option value="All">تصنيف الموظف (الكل)</option>
                  <option value="Standard">موظف عادي</option>
                  <option value="Saudi">السعوديين</option>
                  <option value="OutofSponsorship">خارج الكفالة</option>
                  <option value="Accounting">رواتب المحاسبات</option>
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              </div>
              <div className="relative group">
                <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <select
                  value={gridStatusFilter}
                  onChange={(e) => setGridStatusFilter(e.target.value as any)}
                  className="pr-10 pl-10 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl outline-none font-bold shadow-sm appearance-none min-w-[150px] text-sm cursor-pointer text-gray-900 dark:text-white"
                >
                  <option value="Active">نشط (يشمل خارج الكفالة)</option>
                  <option value="Leave">إجازة (يشمل خارج الكفالة)</option>
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              </div>
              <button
                onClick={handleResetMonth}
                className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-black text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-100 dark:border-red-900/30 shadow-sm flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تعيين الشهر بالكامل</span>
              </button>
              <button
                onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
                className={cn(
                  "px-6 py-3 rounded-2xl font-black text-sm transition-all border shadow-sm",
                  showIncompleteOnly 
                    ? "bg-amber-600 text-white border-amber-500" 
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                {showIncompleteOnly ? "عرض الكل" : "عرض غير المكتمل فقط"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {filteredEmployeesForGrid.map((emp) => {
              const transaction = transactions.find(t => t.employeeId === emp.id && t.month === selectedMonth);
              const isDone = !!transaction;
              const isJoiningThisMonth = (emp.lastDirectDate && emp.lastDirectDate.startsWith(selectedMonth)) || 
                                          (emp.joinDate && emp.joinDate.startsWith(selectedMonth));

              return (
                <motion.div
                  layout
                  key={emp.id}
                  onClick={() => handleMonthlyCardSelection(emp)}
                  className={cn(
                    "relative p-5 md:p-7 rounded-[2.5rem] border-2 transition-all cursor-pointer hover:shadow-2xl active:scale-[0.98] group flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden",
                    emp.status === 'Leave' 
                      ? "bg-gradient-to-br from-blue-900 to-blue-950 border-blue-800 text-white shadow-xl shadow-blue-900/40" 
                      : isDone 
                        ? "bg-emerald-50/20 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20" 
                        : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-700 shadow-xl shadow-gray-100/50 dark:shadow-none"
                  )}
                >
                  <div className="flex items-center gap-5 flex-1">
                    <div className={cn(
                      "w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-black shrink-0 shadow-lg relative transition-transform group-hover:scale-110",
                      emp.status === 'Leave'
                        ? "bg-blue-800 text-white border-2 border-blue-700 shadow-blue-900/50"
                        : isDone 
                          ? "bg-emerald-600 text-white shadow-emerald-500/20" 
                          : "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-blue-500/20"
                    )}>
                      {emp.name.charAt(0)}
                      <div className={cn(
                        "absolute -top-1 -right-1 w-5 h-5 rounded-full border-4 border-white dark:border-gray-950 bg-emerald-500",
                        emp.status === 'Leave' && "bg-blue-400",
                        emp.status === 'End of Service' && "bg-red-500",
                        emp.status === 'Inactive' && "bg-gray-500"
                      )} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-10 flex-1">
                      <div>
                        <h5 className={cn(
                          "font-black transition-colors text-xl tracking-tight",
                          emp.status === 'Leave' ? "text-white" : "text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        )}>{emp.name}</h5>
                          <div className="flex flex-wrap items-center gap-4 mt-2">
                            <p className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-lg",
                              emp.status === 'Leave' ? "bg-white/10 text-blue-200" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            )}>ID: {emp.employeeId || '---'}</p>
                            
                            {isJoiningThisMonth && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1 rounded-xl border-2 animate-pulse transition-all shadow-sm",
                                  emp.status === 'Leave' 
                                    ? "bg-amber-500/20 border-amber-400 text-amber-200" 
                                    : "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                                )}
                              >
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                <Calendar className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-black">
                                  تنبيه مباشرة: {emp.lastDirectDate || emp.joinDate}
                                  {" "}
                                  ({calculateRemainingDaysInMonth(emp.lastDirectDate || emp.joinDate || '', selectedMonth)} يوم عمل)
                                </span>
                              </motion.div>
                            )}
                          </div>
                      </div>
                      
                      <div className="flex items-center">
                        <span className={cn(
                          "text-[10px] font-black px-3 py-1.5 rounded-xl shadow-sm border",
                          emp.status === 'Leave' ? "bg-white/10 text-white border-white/20" :
                          emp.classification === 'Saudi' ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-100" :
                          emp.classification === 'Accounting' ? "bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-100" :
                          "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-100"
                        )}>
                          {emp.sectors || (emp.classification === 'Standard' ? 'موظف عادي' : 
                                         emp.classification === 'Saudi' ? 'سعودي' : 
                                         emp.classification === 'Accounting' ? 'محاسبة' : 'موظف عادي')}
                        </span>
                      </div>
 
                      <div className="flex items-center gap-2">
                        {emp.status === 'Leave' ? (
                          <div className="flex items-center gap-1.5 text-blue-100 bg-white/10 px-3 py-1 rounded-xl border border-white/20">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[10px] md:text-xs font-black">حالة: إجـــــازة (تأكيد المباشرة مطلوب)</span>
                          </div>
                        ) : isDone ? (
                          <div className="flex items-center gap-4">
                            <div className="hidden sm:flex flex-col items-end px-3 py-1 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20">
                              <span className="text-[9px] font-black text-emerald-600/60 dark:text-emerald-400/60 uppercase">صافي الراتب</span>
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(transaction?.netSalary || 0)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-xl group/reset">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-xs font-black">تـــــــم</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (transaction?.id) setDeleteConfirmId(transaction.id);
                                }}
                                className="mr-2 p-1 text-emerald-400 hover:text-red-500 transition-colors"
                                title="إعادة تعيين (حذف الحركة)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-blue-500 dark:text-blue-400">
                            <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
                            <span className="text-xs font-black">انتظار الإدخال</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
 
                  <div className="flex items-center gap-2 pr-4 md:border-r border-gray-100 dark:border-gray-800">
                    {emp.status === 'Leave' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReturnFromLeave(emp);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all shadow-sm"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>تأكيد المباشرة</span>
                      </button>
                    )}
                    {!isDone && emp.status !== 'Leave' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSkip(emp.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-2xl transition-all font-bold text-xs"
                      >
                        <FastForward className="w-4 h-4" />
                        <span>تخطي</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMonthlyCardSelection(emp);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 rounded-2xl font-black text-xs transition-all shadow-sm",
                        isDone ? "bg-emerald-500 text-white hover:bg-emerald-600" :
                        emp.status === 'Leave' ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60" :
                        "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                      )}
                      disabled={emp.status === 'Leave' && !isDone}
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة كارت</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredEmployeesForGrid.length === 0 && (
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-700">
              <Search className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400 dark:text-gray-500 font-bold">لا يوجد موظفين يطابقون الفلتر المختار</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsImportModalOpen(false)} 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-gray-100 dark:border-gray-800"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">استيراد حركات الشهرية</h3>
                <p className="text-gray-500 dark:text-gray-400 font-bold mt-2">يرجى اختيار الشهر والسنة واختيار ملف الإكسيل</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">الشهر والسنة المستهدفين</label>
                  <input 
                    type="month" 
                    value={importMonth}
                    onChange={(e) => setImportMonth(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">ملف الإكسيل</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="hidden" 
                      id="import-file-input"
                    />
                    <label 
                      htmlFor="import-file-input"
                      className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-bold group"
                    >
                      <span className="text-gray-500 dark:text-gray-400 truncate">
                        {importFile ? importFile.name : 'اختر الملف...'}
                      </span>
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-black rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleImportExcel}
                  disabled={loading || !importFile}
                  className="px-6 py-4 bg-blue-600 text-white font-black rounded-2xl enabled:hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'جاري الاستيراد...' : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>بدء الاستيراد</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return from Leave Modal */}
      <AnimatePresence>
        {isReturnModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsReturnModalOpen(false)} 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-gray-100 dark:border-gray-800"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">تأكيد تاريخ المباشرة</h3>
                <p className="text-gray-500 dark:text-gray-400 font-bold mt-2">تنشيط الموظف: {selectedEmpForReturn?.name}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">تاريخ العودة الفعلي</label>
                  <input 
                    type="date" 
                    value={actualReturnDate}
                    onChange={(e) => setActualReturnDate(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-6 py-4 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-black rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmReturn}
                  disabled={loading}
                  className="px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2"
                >
                  {loading ? 'جاري الحفظ...' : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>تأكيد المباشرة</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-gray-900 w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-50/50 via-white to-gray-50/50 dark:from-gray-800/30 dark:via-gray-900 dark:to-gray-800/30">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/30 transform -rotate-3">
                    <ClipboardList className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">كارت العمل الشهري</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full text-xs font-black border border-blue-100 dark:border-blue-800">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>كشف شهر {formData.month}</span>
                      </div>
                      <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                      <span className="text-gray-400 dark:text-gray-500 text-xs font-bold tracking-wide italic">نظام إدارة الرواتب والتدقيق المالي الذكي</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-3xl transition-all active:scale-95 group">
                  <X className="w-7 h-7 text-gray-400 group-hover:text-red-500 transition-colors" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Employee Header Info */}
                <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/20 dark:to-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col xl:flex-row xl:items-end justify-between gap-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                  
                  <div className="space-y-5 flex-1 relative z-10">
                    <div className="flex items-center gap-2 mr-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <label className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">Select Employee / تحديد بيانات الموظف</label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative group">
                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-blue-500" />
                        <input 
                          type="text"
                          placeholder="ابحث بالاسم، رقم الموظف، أو الإقامة..."
                          className="w-full pr-14 pl-5 py-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 outline-none font-bold text-gray-900 dark:text-white shadow-sm transition-all text-lg placeholder:text-gray-300"
                          value={empSearch || ''}
                          onChange={(e) => setEmpSearch(e.target.value)}
                        />
                      </div>
                      
                      <select 
                        required 
                        className="w-full px-8 py-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 outline-none font-black text-gray-900 dark:text-white shadow-sm transition-all cursor-pointer text-lg appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23cbd5e1%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:1.25rem] bg-[right_1.5rem_center] bg-no-repeat" 
                        value={formData.employeeId || ''} 
                        onChange={(e) => handleEmployeeChange(e.target.value)}
                      >
                        <option value="" className="dark:bg-gray-900">-- اختر الموظف النهائي من القائمة --</option>
                        {employees
                          .filter(e => e.status === 'Active' || e.status === 'Leave' || e.status === 'Out of Sponsorship' || e.status === 'Out of Sponsorship (Active)')
                          .filter(e => 
                            (e.name || '').toLowerCase().includes((empSearch || '').toLowerCase()) ||
                            (e.employeeId || '').toLowerCase().includes((empSearch || '').toLowerCase()) ||
                            (e.iqamaNumber || '').toLowerCase().includes((empSearch || '').toLowerCase())
                          )
                          .map(e => (
                            <option key={e.id} value={e.id} className="dark:bg-gray-900">{e.name} | الرقم: {e.employeeId}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm md:w-[280px]">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Month / شهر الحساب</label>
                       <input type="month" required className="bg-transparent border-none p-0 w-full font-black text-gray-900 dark:text-white outline-none" value={formData.month || ''} onChange={(e) => setFormData({...formData, month: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Work Stats Block */}
                  <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-50 dark:border-gray-800 pb-4">
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <h4 className="font-black text-gray-900 dark:text-white">معايير العمل (Basis)</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase mr-2 tracking-widest">أيام العمل</label>
                        <input type="number" className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-black text-gray-900 dark:text-white transition-all" value={formData.actualWorkDays ?? 0} onChange={(e) => setFormData({...formData, actualWorkDays: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase mr-2 tracking-widest">ساعات اليوم</label>
                        <input type="number" className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-black text-gray-900 dark:text-white transition-all" value={formData.dailyWorkHours ?? 0} onChange={(e) => setFormData({...formData, dailyWorkHours: Number(e.target.value)})} />
                      </div>
                    </div>
                  </div>

                  {/* Notes Block */}
                  <div className="bg-amber-50/30 dark:bg-amber-900/5 p-8 rounded-[2.5rem] border border-amber-100/50 dark:border-amber-900/20 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b border-amber-100/50 dark:border-amber-900/20 pb-4">
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <h4 className="font-black text-amber-900 dark:text-amber-100">ملاحظات النظام والحركة</h4>
                    </div>
                    <textarea className="w-full px-5 py-4 bg-white/80 dark:bg-gray-900 border border-amber-100 dark:border-amber-800 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold h-24 text-gray-900 dark:text-white transition-all resize-none" value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="اكتب أي ملاحظات إضافية هنا..." />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* Income Group */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b-2 border-emerald-500 pb-3 mb-2">
                       <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                         <TrendingUp className="w-5 h-5" />
                       </div>
                       <h4 className="font-black text-emerald-600 uppercase tracking-widest">Earnings / المستحقات</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { id: 'basicSalary', label: 'الراتب الأساسي', icon: Wallet },
                        { id: 'housingAllowance', label: 'بدل سكن', icon: Building2 },
                        { id: 'transportAllowance', label: 'بدل نقل', icon: RotateCcw },
                        { id: 'subsistenceAllowance', label: 'بدل إعاشة', icon: Wallet },
                        { id: 'mobileAllowance', label: 'بدل جوال', icon: Wallet },
                        { id: 'managementAllowance', label: 'بدل إدارة', icon: ShieldCheck },
                        { id: 'otherAllowances', label: 'بدلات أخرى', icon: Plus },
                        { id: 'salaryIncrease', label: 'زيادة راتب', icon: TrendingUp },
                        { id: 'otherIncome', label: 'دخل آخر', icon: Plus },
                      ].map((item) => (
                        <div key={item.id} className="space-y-1.5 p-4 bg-emerald-50/30 dark:bg-emerald-900/5 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 group hover:border-emerald-500 transition-all">
                          <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 mr-1 uppercase tracking-tighter">{item.label}</label>
                          <input 
                            type="number" 
                            className="w-full bg-transparent border-none p-0 font-black text-gray-900 dark:text-white outline-none text-lg tabular-nums" 
                            value={(formData as any)[item.id] ?? 0} 
                            onChange={(e) => setFormData({...formData, [item.id]: Number(e.target.value)})} 
                          />
                        </div>
                      ))}
                      
                      {/* Special Overtime Block */}
                      <div className="sm:col-span-2 space-y-4 p-5 bg-emerald-600 text-white rounded-3xl shadow-xl shadow-emerald-500/20 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black uppercase tracking-widest opacity-80">Overtime / العمل الإضافي</span>
                          <TrendingUp className="w-4 h-4 opacity-50" />
                        </div>
                        <div className="flex items-center justify-between gap-6">
                           <div className="space-y-1 flex-1">
                             <label className="text-[10px] font-black opacity-60">Number of Hours</label>
                             <input type="number" className="w-full bg-transparent border-none p-0 font-black text-2xl outline-none" value={formData.overtimeHours ?? 0} onChange={(e) => setFormData({...formData, overtimeHours: Number(e.target.value)})} />
                           </div>
                           <div className="w-px h-10 bg-white/20" />
                           <div className="space-y-1 flex-1 text-left">
                             <label className="text-[10px] font-black opacity-60">Value (Auto)</label>
                             <div className="text-2xl font-black tabular-nums">{formatCurrency(formData.overtimeValue).split(' ')[0]}</div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deductions Group */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b-2 border-red-500 pb-3 mb-2">
                       <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                         <TrendingDown className="w-5 h-5" />
                       </div>
                       <h4 className="font-black text-red-600 uppercase tracking-widest">Deductions / الاستقطاعات</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { id: 'socialInsurance', label: 'تأمين اجتماعي', icon: ShieldCheck },
                        { id: 'salaryReceived', label: 'استلام راتب', icon: Wallet },
                        { id: 'loans', label: 'سلف', icon: Wallet },
                        { id: 'otherDeductions', label: 'خصومات أخرى', icon: Trash2 },
                        { id: 'deductionHours', label: 'ساعات الخصم', icon: History },
                        { id: 'departureDelayDeduction', label: 'تأخير ومغادرات', icon: History },
                      ].map((item) => (
                        <div key={item.id} className="space-y-1.5 p-4 bg-red-50/30 dark:bg-red-900/5 rounded-2xl border border-red-100 dark:border-red-900/20 group hover:border-red-500 transition-all">
                          <label className="text-[10px] font-black text-red-700 dark:text-red-400 mr-1 uppercase tracking-tighter">{item.label}</label>
                          <input 
                            type="number" 
                            className="w-full bg-transparent border-none p-0 font-black text-gray-900 dark:text-white outline-none text-lg tabular-nums" 
                            value={(formData as any)[item.id] ?? 0} 
                            onChange={(e) => setFormData({...formData, [item.id]: Number(e.target.value)})} 
                          />
                        </div>
                      ))}

                      {/* Special Absence Block */}
                      <div className="sm:col-span-2 space-y-4 p-5 bg-red-600 text-white rounded-3xl shadow-xl shadow-red-500/20 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black uppercase tracking-widest opacity-80">Absence / الغياب</span>
                          <TrendingDown className="w-4 h-4 opacity-50" />
                        </div>
                        <div className="flex items-center justify-between gap-6">
                           <div className="space-y-1 flex-1">
                             <label className="text-[10px] font-black opacity-60">Number of Days</label>
                             <input type="number" className="w-full bg-transparent border-none p-0 font-black text-2xl outline-none" value={formData.absenceDays ?? 0} onChange={(e) => setFormData({...formData, absenceDays: Number(e.target.value)})} />
                           </div>
                           <div className="w-px h-10 bg-white/20" />
                           <div className="space-y-1 flex-1 text-left">
                             <label className="text-[10px] font-black opacity-60">Total Deduction (Auto)</label>
                             <div className="text-2xl font-black tabular-nums">{formatCurrency(formData.absenceDeduction).split(' ')[0]}</div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl -mx-8 -mb-8 p-10 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/40">
                      <Wallet className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Estimated Net / صافي الراتب المتوقع</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-5xl font-black text-gray-900 dark:text-white tabular-nums tracking-tighter">
                           {formatCurrency(calculateTotals(formData).netSalary).split(' ')[0]}
                        </p>
                        <span className="text-xl font-bold text-gray-400 uppercase">SAR</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)}
                      className="px-8 py-5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-black rounded-3xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-lg"
                    >
                      إلغاء الإجراء
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="px-12 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-3xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-[0_15px_35px_-5px_rgba(37,99,235,0.4)] text-lg flex items-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                      {loading ? 'جاري الحفظ...' : (
                        <>
                          <CheckCircle2 className="w-6 h-6" />
                          <span>اعتماد وحفظ الكارت</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border border-gray-100 dark:border-gray-800">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">تأكيد الحذف</h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-8">هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-200 dark:shadow-none">نعم، احذف</button>
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-white font-black rounded-2xl transition-all">إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* View Card Modal (Printable) */}
      <AnimatePresence>
        {isViewCardOpen && selectedTxForView && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsViewCardOpen(false)} className="absolute inset-0 bg-gray-900/80 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between no-print">
                <h3 className="text-xl font-black text-gray-900 dark:text-white">تفاصيل كارت العمل الشهري</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    <Download className="w-4 h-4" />
                    <span>طباعة الكارت</span>
                  </button>
                  <button onClick={() => setIsViewCardOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-10 bg-white text-black" id="printable-card">
                {/* Official Header */}
                <div className="flex justify-between items-start border-b-4 border-gray-900 pb-8 mb-8 relative">
                  <div className="text-right">
                    <div className="text-xs font-black text-blue-600 mb-1 tracking-widest uppercase">Employee Monthly Pay Card</div>
                    <h2 className="text-3xl font-black mb-1">{employees.find(e => e.id === selectedTxForView.employeeId)?.name}</h2>
                    <div className="flex items-center gap-4 text-gray-500 font-bold text-sm">
                      <span>الرقم: <span className="text-black font-black">{employees.find(e => e.id === selectedTxForView.employeeId)?.employeeId}</span></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      <span>المهنة: <span className="text-black font-black">{employees.find(e => e.id === selectedTxForView.employeeId)?.jobTitle}</span></span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="bg-gray-900 text-white px-6 py-2 rounded-xl font-black text-sm mb-2 shadow-lg">
                      إصدار: {selectedTxForView.month}
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter tabular-nums">
                      Ref ID: {selectedTxForView.id?.slice(0, 8)}
                    </div>
                  </div>
                </div>

                {/* Progress Indicators (Work Pct) */}
                <div className="mb-10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-black text-gray-400">إتمام أيام العمل الشهرية</span>
                    <span className="text-sm font-black text-blue-600">{Math.round((selectedTxForView.actualWorkDays / 30) * 100)}%</span>
                  </div>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-blue-600 rounded-full" 
                      style={{ width: `${(selectedTxForView.actualWorkDays / 30) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] font-bold text-gray-400">{selectedTxForView.actualWorkDays} يوم عمل فعلية</span>
                    <span className="text-[10px] font-bold text-gray-400">المعيار: 30 يوم</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-10">
                  {/* Income Column */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b-2 border-emerald-600 pb-2 mb-4">
                      <div className="w-6 h-6 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-black text-emerald-700">المزايا والمستحقات (Income)</h4>
                    </div>
                    
                    <div className="space-y-3">
                      {[
                        { label: 'الراتب الأساسي', val: selectedTxForView.basicSalary },
                        { label: 'بدل سكن', val: selectedTxForView.housingAllowance },
                        { label: 'بدل نقل', val: selectedTxForView.transportAllowance },
                        { label: 'بدل إعاشه', val: selectedTxForView.subsistenceAllowance },
                        { label: `إضافي (${selectedTxForView.overtimeHours} ساعة)`, val: selectedTxForView.overtimeValue },
                        ...(selectedTxForView.salaryIncrease > 0 ? [{ label: 'زيادة راتب استثنائية', val: selectedTxForView.salaryIncrease }] : [])
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm group">
                          <span className="text-gray-500 font-bold">{item.label}</span>
                          <span className="font-black text-gray-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight tabular-nums">{formatCurrency(item.val)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t-2 border-emerald-100 flex justify-between items-center">
                      <span className="text-sm font-black text-emerald-800">إجمالي المزايا</span>
                      <span className="text-xl font-black text-emerald-700 tabular-nums">{formatCurrency(selectedTxForView.totalIncome)}</span>
                    </div>
                  </div>

                  {/* Deduction Column */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b-2 border-red-600 pb-2 mb-4">
                      <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-white">
                        <TrendingDown className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="font-black text-red-700">الاستقطاعات والخصوم (Deductions)</h4>
                    </div>
                    
                    <div className="space-y-3">
                      {[
                        { label: 'تأمينات اجتماعية (GOSI)', val: selectedTxForView.socialInsurance },
                        { label: 'سلف ومستردات', val: selectedTxForView.loans },
                        { label: `غياب (${selectedTxForView.absenceDays} يوم)`, val: selectedTxForView.absenceDeduction },
                        { label: 'تأخير وانصراف مبكر', val: selectedTxForView.departureDelayDeduction },
                        { label: 'خصومات أخرى', val: selectedTxForView.otherDeductions }
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm group">
                          <span className="text-gray-500 font-bold">{item.label}</span>
                          <span className="font-black text-gray-900 group-hover:text-red-600 transition-colors uppercase tracking-tight tabular-nums">{formatCurrency(item.val)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t-2 border-red-100 flex justify-between items-center">
                      <span className="text-sm font-black text-red-800">إجمالي الخصم</span>
                      <span className="text-xl font-black text-red-700 tabular-nums">{formatCurrency(selectedTxForView.totalDeductions)}</span>
                    </div>
                  </div>
                </div>

                {/* Final Net Box (Ultra Bold) */}
                <div className="relative mb-12">
                  <div className="absolute inset-0 bg-blue-600 blur-2xl opacity-10 rounded-full" />
                  <div className="relative bg-gradient-to-br from-gray-900 to-blue-900 text-white p-8 rounded-[2.5rem] flex justify-between items-center shadow-2xl no-print-shadow">
                    <div className="text-right">
                      <p className="text-xs font-black text-blue-300 uppercase tracking-[0.2em] mb-2">Net Payable Salary / صافي الراتب</p>
                      <h3 className="text-6xl font-black tabular-nums tracking-tighter">
                        {formatCurrency(selectedTxForView.netSalary).split(' ')[0]}
                        <span className="text-xl font-medium text-white/50 mr-2 uppercase">SAR</span>
                      </h3>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                        <ShieldCheck className="w-8 h-8 text-white" />
                      </div>
                      <span className="text-[8px] font-black mt-2 text-blue-200">VERIFIED CARD</span>
                    </div>
                  </div>
                </div>

                {selectedTxForView.notes && (
                  <div className="bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200 mb-12">
                    <div className="flex items-center gap-2 mb-2">
                       <AlertCircle className="w-4 h-4 text-gray-400" />
                       <p className="text-[10px] font-black text-gray-400 uppercase">System Notes / ملاحظات</p>
                    </div>
                    <p className="text-sm font-bold text-gray-800 leading-relaxed">{selectedTxForView.notes}</p>
                  </div>
                )}

                {/* Secure Footer (Print Format) */}
                <div className="grid grid-cols-2 gap-20 pt-10 text-[11px] font-black border-t-2 border-gray-100">
                  <div className="text-center">
                    <div className="w-full h-24 border-b border-gray-200 mb-2" />
                    <p className="text-gray-400">توقيع المستلم / Employee Signature</p>
                  </div>
                  <div className="text-center">
                    <div className="w-full h-24 border-b border-gray-200 mb-2" />
                    <p className="text-gray-400">الختم والاعتماد / Authorized Approval</p>
                  </div>
                </div>

                <div className="text-center mt-12">
                   <p className="text-[8px] text-gray-300 font-bold uppercase tracking-widest">
                     This document was automatically generated by Salarix HR on {new Date().toLocaleDateString('ar-SA')}
                   </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Variance Analysis Modal */}
      <AnimatePresence>
        {isVarianceModalOpen && varianceResults && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsVarianceModalOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm no-print" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-gray-900 w-full max-w-6xl h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 print:h-auto print:static print:rounded-none print:shadow-none print:border-none print:bg-white">
              
              {/* Header */}
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shadow-sm bg-white dark:bg-gray-900 no-print">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-500/20 transform -rotate-3">
                    <TrendingUpDown className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">تحليل الفروقات الذكي (Variance Analysis)</h3>
                    <p className="text-sm font-bold text-gray-400 mt-1">مقارنة {formatMonthArabic(selectedMonth)} مع {formatMonthArabic(varianceResults.prevMonth)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-black rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
                  >
                    <Printer className="w-5 h-5" />
                    <span>طباعة</span>
                  </button>
                  <button onClick={() => setIsVarianceModalOpen(false)} className="p-4 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl transition-all active:scale-95">
                    <X className="w-7 h-7" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-10 space-y-12 custom-scrollbar rtl text-right print:p-0 print:overflow-visible">
                
                {/* Print Only Header (Logo & Company Name) */}
                <div className="hidden print:flex justify-between items-start border-b-4 border-gray-900 pb-8 mb-10 rtl">
                  <div className="text-right">
                    <h1 className="text-3xl font-black text-gray-900 leading-tight">{companySettings?.companyName}</h1>
                    <p className="text-xl font-bold text-gray-600 mt-2">تقرير تحليل فروقات الرواتب والشهرية</p>
                    <div className="flex items-center gap-4 mt-4 text-sm text-gray-500 font-bold">
                       <div className="flex items-center gap-1"><Calendar className="w-4 h-4" /> <span>الفترة: {formatMonthArabic(selectedMonth)}</span></div>
                       <div className="flex items-center gap-1"><History className="w-4 h-4" /> <span>المقارنة بـ: {formatMonthArabic(varianceResults.prevMonth)}</span></div>
                    </div>
                  </div>
                  {companySettings?.logoUrl && (
                    <img src={companySettings.logoUrl} alt="Logo" className="h-24 w-auto object-contain" referrerPolicy="no-referrer" />
                  )}
                </div>

                {/* Print Orientation Hack */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    @page { size: portrait; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                  }
                `}} />
                
                {/* Visual Summary Bento */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {[
                    { 
                      label: 'إجمالي رواتب الكاش', 
                      val: varianceResults.summary.paymentCash, 
                      color: 'bg-amber-600', 
                      icon: Banknote,
                      subLabel: 'Cash Salaries'
                    },
                    { 
                      label: 'إجمالي رواتب البنك', 
                      val: varianceResults.summary.paymentBank, 
                      color: 'bg-emerald-600', 
                      icon: Receipt,
                      subLabel: 'Bank Transfers'
                    },
                    { 
                      label: 'إجمالي الاستقطاعات', 
                      val: varianceResults.summary.deductions, 
                      color: 'bg-rose-600', 
                      icon: TrendingDown,
                      subLabel: 'Total Deductions'
                    },
                    { 
                      label: 'موظفين في إجازة', 
                      val: varianceResults.summary.leaves, 
                      color: 'bg-blue-900', 
                      icon: CalendarX,
                      subLabel: 'On Leave',
                      isNumber: true
                    },
                    { 
                      label: 'صافي الرواتب', 
                      val: varianceResults.summary.net, 
                      color: 'bg-indigo-600', 
                      icon: Wallet,
                      subLabel: 'Net Salaries'
                    },
                  ].map((item, idx) => {
                    const diff = item.val.current - item.val.prev;
                    const isPositive = diff > 0.01;
                    const isNegative = diff < -0.01;
                    const Icon = item.icon;
                    
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                          "p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group",
                          item.color
                        )}
                      >
                         <Icon className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform pointer-events-none" />
                         <div className="relative z-10 space-y-4">
                            <div className="flex items-center justify-between">
                               <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                  <Icon className="w-6 h-6" />
                               </div>
                               <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                                  {item.subLabel}
                                </div>
                            </div>
                            <div>
                               <p className="text-xs font-bold text-white/70 mb-1">{item.label}</p>
                               <h4 className="text-3xl font-black tabular-nums tracking-tighter">
                                  {item.isNumber ? item.val.current : formatCurrency(item.val.current)}
                                </h4>
                            </div>
                            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                               <div className={cn(
                                  "px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1",
                                  isPositive ? "bg-emerald-400 text-emerald-950" : isNegative ? "bg-rose-400 text-rose-950" : "bg-white/20 text-white"
                               )}>
                                  {isPositive ? <ArrowUpRight className="w-3 h-3" /> : isNegative ? <ArrowDownRight className="w-3 h-3" /> : null}
                                  {item.isNumber ? Math.abs(diff) : formatCurrency(Math.abs(diff))}
                               </div>
                               {item.isNumber ? (
                                 <span className="text-[10px] font-bold opacity-60 italic">موظف</span>
                               ) : (
                                 <span className="text-[10px] font-bold opacity-60 italic">عدد الموظفين: {item.val.count}</span>
                               )}
                            </div>
                         </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Detail Table */}
                <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl">
                    <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-gray-800/20">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                             <Users className="w-5 h-5" />
                          </div>
                          <h4 className="text-xl font-black text-gray-900 dark:text-white text-right">تفاصيل مقارنة الموظفين</h4>
                       </div>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-right border-collapse">
                          <thead>
                             <tr className="bg-gray-50 dark:bg-gray-800">
                                <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">الرقم</th>
                                <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">الموظف</th>
                                <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">الصافي ({formatMonthArabic(varianceResults.prevMonth)})</th>
                                <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">الصافي ({formatMonthArabic(selectedMonth)})</th>
                                <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">الفارق المالي</th>
                                <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">ملاحظة ذكية</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                             {varianceResults.comparisons.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                   <td className="p-6 font-bold text-gray-500 tabular-nums">{item.employeeId}</td>
                                   <td className="p-6">
                                      <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-xs font-black text-gray-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors uppercase">
                                            {item.name[0]}
                                         </div>
                                         <div>
                                            <p className="font-black text-gray-900 dark:text-white">{item.name}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Employee Record</p>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-6 font-bold text-gray-500 tabular-nums">{formatCurrency(item.prevNet)}</td>
                                   <td className="p-6 font-black text-gray-900 dark:text-white tabular-nums">{formatCurrency(item.currNet)}</td>
                                   <td className={cn(
                                      "p-6 font-black tabular-nums",
                                      item.diff > 0.01 ? "text-emerald-600" : item.diff < -0.01 ? "text-rose-600" : "text-gray-400"
                                   )}>
                                      {item.diff > 0 ? '+' : ''}{formatCurrency(item.diff)}
                                   </td>
                                   <td className="p-6">
                                      <span className={cn(
                                         "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                                         item.note === 'موظف جديد' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                         item.note === 'مستبعد / في إجازة' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                         "bg-gray-50 text-gray-400 border-gray-100 dark:bg-gray-800 dark:border-gray-700"
                                      )}>
                                         {item.note}
                                      </span>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                </div>

                {/* Signatures & Approvals (Print Only) */}
                <div className="hidden print:grid grid-cols-3 gap-12 mt-20 pt-10 border-t-2 border-gray-900">
                  <div className="text-center space-y-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                       <UserCheck className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                       <p className="font-black text-gray-900 text-lg">إعداد المحاسب</p>
                       <div className="mt-8 h-20 border-b border-gray-300 w-48 mx-auto"></div>
                       <p className="text-xs text-gray-400 mt-2 italic font-bold">التوقيع والتاريخ</p>
                    </div>
                  </div>
                  <div className="text-center space-y-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                       <Building2 className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                       <p className="font-black text-gray-900 text-lg">مراجعة المدير المالي</p>
                       <div className="mt-8 h-20 border-b border-gray-300 w-48 mx-auto"></div>
                       <p className="text-xs text-gray-400 mt-2 italic font-bold">التوقيع والتاريخ</p>
                    </div>
                  </div>
                  <div className="text-center space-y-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                       <ShieldCheck className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                       <p className="font-black text-gray-900 text-lg">الاعتماد النهائي</p>
                       <div className="mt-8 h-20 border-b border-gray-300 w-48 mx-auto"></div>
                       <p className="text-xs text-gray-400 mt-2 italic font-bold">الختم والتوقيع الرسمي</p>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
