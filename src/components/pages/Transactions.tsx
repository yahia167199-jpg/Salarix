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
  RotateCcw
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
  const { transactions, employees } = useData();
  const [activeTab, setActiveTab] = useState<'History' | 'MonthlyCard'>('History');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<EmployeeCategory | 'All'>('All');
  const [monthlyCardFilter, setMonthlyCardFilter] = useState<EmployeeCategory | 'All'>('All');
  const [gridStatusFilter, setGridStatusFilter] = useState<'All' | 'Active' | 'Leave'>('All');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  // Return from leave modal state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedEmpForReturn, setSelectedEmpForReturn] = useState<Employee | null>(null);
  const [actualReturnDate, setActualReturnDate] = useState(new Date().toISOString().slice(0, 10));

  // Form State
  const [formData, setFormData] = useState<(Omit<Transaction, 'id' | 'createdAt'> & { id?: string })>({
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
    bankReceived: 0,
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

  const handleEmployeeChange = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const days = formData.actualWorkDays || 30;
      // Pro-rate based on actual work days: (Monthly / 30) * actualWorkDays
      const proRate = (val: number) => Number(((val / 30) * days).toFixed(2));

      setFormData({
        ...formData,
        employeeId: empId,
        basicSalary: proRate(emp.basicSalary || 0),
        housingAllowance: proRate(emp.housingAllowance || 0),
        transportAllowance: proRate(emp.transportAllowance || 0),
        subsistenceAllowance: proRate(emp.subsistenceAllowance || 0),
        otherAllowances: proRate(emp.otherAllowances || 0),
        mobileAllowance: proRate(emp.mobileAllowance || 0),
        managementAllowance: proRate(emp.managementAllowance || 0),
        dailyWorkHours: emp.dailyWorkHours || 8,
      });
    } else {
      setFormData({ ...formData, employeeId: empId });
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

    setFormData(prev => ({
      ...prev,
      ...updatedBase,
      overtimeValue: details.overtimeValue,
      absenceDeduction: details.absenceDeduction
    }));
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
      bankReceived: 0,
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
    const docRef = doc(collection(db, 'transactions'));
    await setDoc(docRef, {
      ...formData,
      ...totals,
      createdAt: new Date().toISOString()
    });
    setIsModalOpen(false);
    resetForm();
  };

  // Update form month when selectedMonth changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, month: selectedMonth }));
  }, [selectedMonth]);

  const handleSkip = async (employeeId: string) => {
    try {
      setLoading(true);
      const existing = transactions.find(t => t.employeeId === employeeId && t.month === selectedMonth);
      if (existing) {
        await setDoc(doc(db, 'transactions', existing.id), {
          ...existing,
          status: 'Skipped',
          updatedAt: serverTimestamp()
        });
      } else {
        const docRef = doc(collection(db, 'transactions'));
        await setDoc(docRef, {
          employeeId,
          month: selectedMonth,
          status: 'Skipped',
          actualWorkDays: 0,
          totalIncome: 0,
          totalDeductions: 0,
          netSalary: 0,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error skipping transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployeesForGrid = useMemo(() => {
    return employees
      .filter(e => {
        if (gridStatusFilter === 'All') return (e.status === 'Active' || e.status === 'Leave');
        return e.status === gridStatusFilter;
      })
      .filter(e => {
        if (monthlyCardFilter === 'All') return true;
        if (monthlyCardFilter === 'Standard') {
          return e.classification !== 'Saudi' && e.classification !== 'Accounting';
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
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [employees, transactions, selectedMonth, monthlyCardFilter, gridStatusFilter, searchTerm, showIncompleteOnly]);

  const gridStats = useMemo(() => {
    const total = employees.filter(e => {
      if (gridStatusFilter === 'All') return (e.status === 'Active' || e.status === 'Leave');
      return e.status === gridStatusFilter;
    }).length;
    const finished = transactions.filter(t => t.month === selectedMonth).length;
    return { total, finished, remaining: total - finished };
  }, [employees, transactions, selectedMonth, gridStatusFilter]);

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

  const handleExportDataEntryTemplate = () => {
    const targetEmployees = employees.filter(emp => 
      (emp.status === 'Active' || emp.status === 'Leave') && 
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
    const data = sortedTransactions.map((t, index) => {
      const emp = employees.find(e => e.id === t.employeeId);
      return {
        'ت عام': index + 1,
        'ت': index + 1,
        'الإسم': emp?.name || 'موظف محذوف',
        'الجنسية': emp?.nationality || '',
        'الوظيفة': emp?.jobTitle || '',
        'الرقم الوظيفي': emp?.employeeId || '',
        'بداية العمل': emp?.joinDate || '',
        'آخر مباشرة': emp?.lastDirectDate || '',
        'رقم الأقامة': emp?.iqamaNumber || '',
        'ادارة القطاع': emp?.sectorManagement || '',
        'القطاعات': emp?.sectors || '',
        'مركز التكلفة / رئيسي': emp?.costCenterMain || '',
        'مركز التكلفة / قسم': emp?.costCenterDept || '',
        'الراتب الاساسي': emp?.basicSalary || 0,
        'بدل سكن': emp?.housingAllowance || 0,
        'بدل نقل': emp?.transportAllowance || 0,
        'بدل إعاشه': emp?.subsistenceAllowance || 0,
        'بدلات اخرى': emp?.otherAllowances || 0,
        'بدل جوال': emp?.mobileAllowance || 0,
        'بدل ادارة': emp?.managementAllowance || 0,
        'المجموع': (emp?.basicSalary || 0) + (emp?.housingAllowance || 0) + (emp?.transportAllowance || 0) + (emp?.subsistenceAllowance || 0) + (emp?.otherAllowances || 0) + (emp?.mobileAllowance || 0) + (emp?.managementAllowance || 0),
        'عدد الايام العمل الفعلي': t.actualWorkDays,
        'بدل سكن (ح حركة)': t.housingAllowance,
        'بدل نقل (ح حركة)': t.transportAllowance,
        'بدل إعاشه (ح حركة)': t.subsistenceAllowance,
        'بدلات اخرى (ح حركة)': t.otherAllowances,
        'بدل جوال (ح حركة)': t.mobileAllowance,
        'بدل ادارة (ح حركة)': t.managementAllowance,
        'دخل آخر': t.otherIncome,
        'عدد ساعات العمل الاضافي': t.overtimeHours,
        'قيمة عمل اضافي': t.overtimeValue,
        'مجموع الدخل': t.totalIncome,
        'تامينات اجتماعية': t.socialInsurance,
        'استلام راتب': t.salaryReceived,
        'سلف': t.loans,
        'استلام بنك': t.bankReceived,
        'اقتطاعات اخرى': t.otherDeductions,
        'عدد الساعات': t.deductionHours,
        'خصم المغادرات والتاخير': t.departureDelayDeduction,
        'عدد ايام الغياب': t.absenceDays,
        'خصم الغياب': t.absenceDeduction,
        'مجموع الاقتطاعات': t.totalDeductions,
        'صافي الراتب': t.netSalary,
        'الحالة': t.status === 'Draft' ? 'مسودة' : 'معتمد',
        'زيادة راتب': t.salaryIncrease || 0
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Final_Payroll");
    XLSX.writeFile(wb, `Final_Approved_Payroll_${new Date().toISOString().slice(0, 7)}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
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
          const docRef = doc(collection(db, 'transactions'));
          
          const rawData = {
            employeeId: emp.id,
            month: row['الشهر'] || new Date().toISOString().slice(0, 7),
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
            salaryReceived: Number(row['استلام راتب']) || 0,
            loans: Number(row['سلف']) || 0,
            bankReceived: Number(row['استلام بنك']) || 0,
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
      if (e.target) e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions]
      .filter(t => {
        const emp = employees.find(e => e.id === t.employeeId);
        const empName = emp?.name || '';
        
        // Search term filter
        const matchesSearch = (empName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
                             (t.month || '').includes(searchTerm || '') ||
                             (emp?.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (emp?.iqamaNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        // Classification filter
        if (classificationFilter !== 'All') {
          if (emp?.classification !== classificationFilter) return false;
        }

        return true;
      })
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [transactions, employees, searchTerm, classificationFilter]);

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

  const handleMonthlyCardSelection = (emp: Employee) => {
    if (emp.status === 'Leave') {
      alert('برجاء تأكيد تاريخ المباشرة أولاً ثم أعد إدخال الكارت الشهري');
      return;
    }
    const existing = transactions.find(t => t.employeeId === emp.id && t.month === selectedMonth);
    if (existing) {
      handleEdit(existing);
    } else {
      handleEmployeeChange(emp.id);
      setIsModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Headers and Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1.5 bg-gray-100/50 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('History')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
              activeTab === 'History' 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
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
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            )}
          >
            <ClipboardList className="w-4 h-4" />
            كارت العمل الشهري
          </button>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          <Calendar className="w-5 h-5 text-gray-400 mr-2" />
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-none outline-none font-black text-gray-900 cursor-pointer"
          />
        </div>
      </div>

      {activeTab === 'History' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="البحث بالاسم، رقم الموظف، أو الإقامة..."
                  className="w-full pr-12 pl-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm"
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
                    "pr-10 pl-10 py-3 bg-white border rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold shadow-sm appearance-none min-w-[200px] text-sm cursor-pointer",
                    classificationFilter !== 'All' ? "border-blue-200 text-blue-700 bg-blue-50/10" : "border-gray-100 text-gray-500 hover:border-gray-200"
                  )}
                >
                  <option value="All">كل التصنيفات</option>
                  <option value="Standard">موظف عادي</option>
                  <option value="Saudi">السعوديين</option>
                  <option value="Accounting">رواتب المحاسبات</option>
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-gray-600" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {sortedTransactions.length > 0 && (
                <button 
                  onClick={deleteAllFiltered}
                  className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 hover:bg-red-100 transition-colors shadow-sm flex items-center gap-2 font-bold"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="hidden md:inline">حذف الكل المصفى</span>
                </button>
              )}
              {transactions.some(t => t.status === 'Draft') && (
                <button 
                  onClick={deleteDrafts}
                  className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-600 hover:bg-amber-100 transition-colors shadow-sm flex items-center gap-2 font-bold"
                >
                  <AlertCircle className="w-5 h-5" />
                  <span className="hidden md:inline">حذف المسودات</span>
                </button>
              )}
              <label className="cursor-pointer p-3 bg-white border border-gray-100 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2 font-bold">
                <Upload className="w-5 h-5" />
                <span className="hidden md:inline">استيراد</span>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
              </label>
              <button 
                onClick={handleExportDataEntryTemplate}
                className="p-3 bg-white border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 font-bold"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span className="hidden md:inline">نموذج الإدخال</span>
              </button>
              <button 
                onClick={handleExportFinalReport}
                className="p-3 bg-white border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 font-bold"
              >
                <Download className="w-5 h-5 text-blue-600" />
                <span className="hidden md:inline">تقرير نهائي</span>
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-200"
              >
                <Plus className="w-5 h-5" />
                <span>إضافة حركة</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase">الموظف</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase">الشهر</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase text-center">صافي الراتب</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase text-center">الحالة</th>
                    <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <p className="font-black text-gray-900">{employees.find(e => e.id === t.employeeId)?.name || 'موظف محذوف'}</p>
                        <p className="text-xs text-gray-400 font-medium">{t.notes}</p>
                      </td>
                      <td className="px-8 py-5 font-bold text-gray-600">{t.month}</td>
                      <td className="px-8 py-5 font-black text-blue-600 text-center">{formatCurrency(t.netSalary)}</td>
                      <td className="px-8 py-5 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-600">
                          تـــــــم
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => handleEdit(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="إضافة كارت"><ClipboardList className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteConfirmId(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="حذف"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Progress Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400">إجمالي الموظفين</p>
                <h4 className="text-xl font-black text-gray-900">{gridStats.total}</h4>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400">تـــــــــم</p>
                <h4 className="text-xl font-black text-emerald-600">{gridStats.finished}</h4>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center">
                <UserMinus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400">المتبقي</p>
                <h4 className="text-xl font-black text-gray-900">{gridStats.remaining}</h4>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                  className="w-full pr-12 pl-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative group">
                <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={monthlyCardFilter}
                  onChange={(e) => setMonthlyCardFilter(e.target.value as any)}
                  className="pr-10 pl-10 py-3 bg-white border border-gray-100 rounded-2xl outline-none font-bold shadow-sm appearance-none min-w-[220px] text-sm cursor-pointer"
                >
                  <option value="All">تصنيف الموظف (الكل)</option>
                  <option value="Standard">موظف عادي</option>
                  <option value="Saudi">السعوديين</option>
                  <option value="Accounting">رواتب المحاسبات</option>
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative group">
                <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={gridStatusFilter}
                  onChange={(e) => setGridStatusFilter(e.target.value as any)}
                  className="pr-10 pl-10 py-3 bg-white border border-gray-100 rounded-2xl outline-none font-bold shadow-sm appearance-none min-w-[150px] text-sm cursor-pointer"
                >
                  <option value="All">حالة الموظف (الكل)</option>
                  <option value="Active">نشط</option>
                  <option value="Leave">إجازة</option>
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <button
                onClick={handleResetMonth}
                className="px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-sm hover:bg-red-100 transition-all border border-red-100 shadow-sm flex items-center gap-2"
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
                    : "bg-white text-gray-600 border-gray-100 hover:bg-gray-50"
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

              return (
                <motion.div
                  layout
                  key={emp.id}
                  onClick={() => handleMonthlyCardSelection(emp)}
                  className={cn(
                    "relative p-4 md:p-6 rounded-3xl border-2 transition-all cursor-pointer hover:shadow-lg active:scale-[0.99] group flex flex-col md:flex-row md:items-center justify-between gap-4",
                    isDone ? "bg-emerald-50/50 border-emerald-100" : 
                    "bg-white border-gray-100 hover:border-blue-200 shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 shadow-sm",
                      isDone ? "bg-white text-emerald-600" :
                      "bg-blue-50 text-blue-600"
                    )}>
                      {emp.name.charAt(0)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-8 flex-1">
                      <div>
                        <h5 className="font-black text-gray-900 group-hover:text-blue-600 transition-colors">{emp.name}</h5>
                        <p className="text-[10px] font-bold text-gray-400">الرقم الوظيفي: {emp.employeeId || '---'}</p>
                      </div>
                      
                      <div className="flex items-center">
                        <span className={cn(
                          "text-[10px] font-black px-3 py-1 rounded-xl shadow-sm",
                          emp.classification === 'Saudi' ? "bg-emerald-100 text-emerald-700" :
                          emp.classification === 'Accounting' ? "bg-purple-100 text-purple-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {emp.classification === 'Standard' ? 'موظف عادي' : 
                           emp.classification === 'Saudi' ? 'سعودي' : 
                           emp.classification === 'Accounting' ? 'محاسبة' : 'موظف عادي'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {emp.status === 'Leave' ? (
                          <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1 rounded-xl">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[10px] md:text-xs font-black">برجاء تأكيد تاريخ المباشرة أولاً ثم أعد إدخال الكارت الشهري</span>
                          </div>
                        ) : isDone ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-black">تـــــــم</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-blue-500">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-black">انتظار الإدخال</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pr-4 md:border-r border-gray-100">
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
            <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
              <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold">لا يوجد موظفين يطابقون الفلتر المختار</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Return from Leave Modal */}
      <AnimatePresence>
        {isReturnModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsReturnModalOpen(false)} 
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-gray-900">تأكيد تاريخ المباشرة</h3>
                <p className="text-gray-500 font-bold mt-2">تنشيط الموظف: {selectedEmpForReturn?.name}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">تاريخ العودة الفعلي</label>
                  <input 
                    type="date" 
                    value={actualReturnDate}
                    onChange={(e) => setActualReturnDate(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-6 py-4 bg-gray-100 text-gray-400 font-black rounded-2xl hover:bg-gray-200 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmReturn}
                  disabled={loading}
                  className="px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900">كارت العمل الشهري</h3>
                    <p className="text-sm font-bold text-gray-400">إدخال حركات الموظف لشهر {selectedMonth}</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الموظف (ابحث واختر)</label>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input 
                        type="text"
                        placeholder="ابحث بالاسم، رقم الموظف، أو الإقامة..."
                        className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium mb-2"
                        value={empSearch || ''}
                        onChange={(e) => setEmpSearch(e.target.value)}
                      />
                      <select 
                        required 
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                        value={formData.employeeId || ''} 
                        onChange={(e) => handleEmployeeChange(e.target.value)}
                      >
                        <option value="">اختر الموظف من القائمة...</option>
                        {employees
                          .filter(e => e.status === 'Active' || e.status === 'Leave')
                          .filter(e => {
                            if (formData.id) return true; // Don't filter if editing existing
                            const isStandard = e.classification !== 'Saudi' && e.classification !== 'Accounting';
                            return isStandard;
                          })
                          .filter(e => 
                            (e.name || '').toLowerCase().includes((empSearch || '').toLowerCase()) ||
                            (e.employeeId || '').toLowerCase().includes((empSearch || '').toLowerCase()) ||
                            (e.iqamaNumber || '').toLowerCase().includes((empSearch || '').toLowerCase())
                          )
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الشهر</label>
                    <input type="month" required className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.month || ''} onChange={(e) => setFormData({...formData, month: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">أيام العمل الفعلية</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.actualWorkDays ?? 0} onChange={(e) => setFormData({...formData, actualWorkDays: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ساعات العمل في اليوم</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.dailyWorkHours ?? 0} onChange={(e) => setFormData({...formData, dailyWorkHours: Number(e.target.value)})} />
                  </div>

                  <div className="md:col-span-3 border-b border-gray-100 pb-2">
                    <h4 className="font-black text-emerald-600">الدخل (الإضافات)</h4>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الراتب الأساسي</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.basicSalary ?? 0} onChange={(e) => setFormData({...formData, basicSalary: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل سكن</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.housingAllowance ?? 0} onChange={(e) => setFormData({...formData, housingAllowance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل نقل</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.transportAllowance ?? 0} onChange={(e) => setFormData({...formData, transportAllowance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل إعاشة</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.subsistenceAllowance ?? 0} onChange={(e) => setFormData({...formData, subsistenceAllowance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل جوال</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.mobileAllowance ?? 0} onChange={(e) => setFormData({...formData, mobileAllowance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل إدارة</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.managementAllowance ?? 0} onChange={(e) => setFormData({...formData, managementAllowance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدلات أخرى</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.otherAllowances ?? 0} onChange={(e) => setFormData({...formData, otherAllowances: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ساعات الإضافي</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.overtimeHours ?? 0} onChange={(e) => setFormData({...formData, overtimeHours: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">قيمة الإضافي</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-emerald-600 bg-emerald-50/50" value={formData.overtimeValue ?? 0} onChange={(e) => setFormData({...formData, overtimeValue: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">زيادة راتب</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.salaryIncrease ?? 0} onChange={(e) => setFormData({...formData, salaryIncrease: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">دخل آخر</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.otherIncome ?? 0} onChange={(e) => setFormData({...formData, otherIncome: Number(e.target.value)})} />
                  </div>

                  <div className="md:col-span-3 border-b border-gray-100 pb-2">
                    <h4 className="font-black text-red-600">الخصومات</h4>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">تأمين اجتماعي</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.socialInsurance ?? 0} onChange={(e) => setFormData({...formData, socialInsurance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">استلام راتب</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.salaryReceived ?? 0} onChange={(e) => setFormData({...formData, salaryReceived: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">استلام بنك</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.bankReceived ?? 0} onChange={(e) => setFormData({...formData, bankReceived: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">سلف</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.loans ?? 0} onChange={(e) => setFormData({...formData, loans: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">أيام الغياب</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.absenceDays ?? 0} onChange={(e) => setFormData({...formData, absenceDays: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">خصم الغياب</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-red-600 bg-red-50/50" value={formData.absenceDeduction ?? 0} onChange={(e) => setFormData({...formData, absenceDeduction: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ساعات الخصم</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.deductionHours ?? 0} onChange={(e) => setFormData({...formData, deductionHours: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">تأخير ومغادرات</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.departureDelayDeduction ?? 0} onChange={(e) => setFormData({...formData, departureDelayDeduction: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">خصومات أخرى</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.otherDeductions ?? 0} onChange={(e) => setFormData({...formData, otherDeductions: Number(e.target.value)})} />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ملاحظات</label>
                    <textarea className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium h-24" value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                  </div>
                </div>
                <div className="bg-blue-50 p-6 rounded-3xl flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-blue-600">صافي الراتب المتوقع</p>
                    <p className="text-3xl font-black text-blue-900">{formatCurrency(calculateTotals(formData).netSalary)}</p>
                  </div>
                  <button type="submit" className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200">حفظ الحركة</button>
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">تأكيد الحذف</h3>
              <p className="text-gray-500 font-medium mb-8">هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-200">نعم، احذف</button>
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all">إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
