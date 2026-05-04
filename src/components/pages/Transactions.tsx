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
  ChevronDown
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, serverTimestamp, OperationType, handleFirestoreError } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { writeBatch } from 'firebase/firestore';
import { Employee, Transaction, EmployeeCategory } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { calculatePayrollDetails } from '../../lib/payrollUtils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

import { useMemo } from 'react';

export const Transactions: React.FC = () => {
  const { transactions, employees } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<EmployeeCategory | 'All'>('All');

  // Form State
  const [formData, setFormData] = useState<Omit<Transaction, 'id' | 'createdAt'>>({
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

  const resetForm = () => {
    setFormData({
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
  };

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
    setFormData({ ...t });
    setIsModalOpen(true);
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
      'عدد ايام الغياب': 0
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="البحث بالاسم، رقم الموظف، الإقامة أو الشهر..."
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
              <option value="All">كل التصنيفات (التصفية)</option>
              <option value="Standard">موظف عادي</option>
              <option value="Saudi">السعوديين</option>
              <option value="Accounting">رواتب المحاسبات</option>
            </select>
            <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-gray-600" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {transactions.some(t => t.status === 'Draft') && (
            <button 
              onClick={deleteDrafts}
              className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 hover:bg-red-100 transition-colors shadow-sm flex items-center gap-2 font-bold"
              title="حذف كافة المسودات"
            >
              <Trash2 className="w-5 h-5" />
              <span className="hidden md:inline">حذف المسودات</span>
            </button>
          )}
          <label className="cursor-pointer p-3 bg-white border border-gray-100 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2 font-bold" title="استيراد الحركات من اكسيل">
            <Upload className="w-5 h-5" />
            <span className="hidden md:inline">استيراد الحركات</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
          </label>
          <button 
            onClick={handleExportDataEntryTemplate}
            className="p-3 bg-white border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 font-bold"
            title="تصدير نموذج إدخال البيانات"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span className="hidden md:inline">نموذج الإدخال</span>
          </button>
          <button 
            onClick={handleExportFinalReport}
            className="p-3 bg-white border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 font-bold"
            title="تصدير الشيت النهائي المعتمد"
          >
            <Download className="w-5 h-5 text-blue-600" />
            <span className="hidden md:inline">تصدير النهائي المعتمد</span>
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
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase">إجمالي الدخل</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase">إجمالي الخصومات</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase">صافي الراتب</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase">الإجراءات</th>
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
                  <td className="px-8 py-5 font-black text-emerald-600">{formatCurrency(t.totalIncome)}</td>
                  <td className="px-8 py-5 font-black text-red-600">{formatCurrency(t.totalDeductions)}</td>
                  <td className="px-8 py-5 font-black text-blue-600">{formatCurrency(t.netSalary)}</td>
                  <td className="px-8 py-5">
                    <button 
                      onClick={() => setDeleteConfirmId(t.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-2xl font-black text-gray-900">إضافة حركة شهرية تفصيلية</h3>
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
                          .filter(e => e.status === 'Active')
                          .filter(e => e.classification === 'Standard' || !e.classification)
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
