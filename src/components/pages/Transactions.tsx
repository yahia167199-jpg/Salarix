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
  FileSpreadsheet
} from 'lucide-react';
import { db, collection, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, OperationType, handleFirestoreError } from '../../firebase';
import { writeBatch } from 'firebase/firestore';
import { Employee, Transaction } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

import { useMemo } from 'react';

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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
    notes: ''
  });

  useEffect(() => {
    const unsubTrans = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    const unsubEmp = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'employees'));

    return () => { unsubTrans(); unsubEmp(); };
  }, []);

  // Update calculated values when dependencies change
  useEffect(() => {
    const basic = formData.basicSalary || 0;
    const ovHours = formData.overtimeHours || 0;
    const absDays = formData.absenceDays || 0;

    // OT Formula: (Basic / 30 / 10) * 1.5 * hours
    const calculatedOT = (basic / 30 / 10) * 1.5 * ovHours;

    // Absence Formula: ((Basic + All Allowances listed) / 30) * absenceDays
    const totalAllowancesBase = basic + 
                                formData.transportAllowance + 
                                formData.subsistenceAllowance + 
                                formData.otherAllowances + 
                                formData.mobileAllowance + 
                                formData.managementAllowance;
    const calculatedAbsence = (totalAllowancesBase / 30) * absDays;

    if (calculatedOT !== formData.overtimeValue || calculatedAbsence !== formData.absenceDeduction) {
      setFormData(prev => ({
        ...prev,
        overtimeValue: Number(calculatedOT.toFixed(2)),
        absenceDeduction: Number(calculatedAbsence.toFixed(2))
      }));
    }
  }, [
    formData.basicSalary, 
    formData.overtimeHours, 
    formData.absenceDays,
    formData.housingAllowance,
    formData.transportAllowance,
    formData.subsistenceAllowance,
    formData.otherAllowances,
    formData.mobileAllowance,
    formData.managementAllowance
  ]);

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
      });
    } else {
      setFormData({ ...formData, employeeId: empId });
    }
  };

  // Re-run pro-rating if actualWorkDays changes
  useEffect(() => {
    if (!formData.employeeId) return;
    const emp = employees.find(e => e.id === formData.employeeId);
    if (!emp) return;

    const days = formData.actualWorkDays || 30;
    const proRate = (val: number) => Number(((val / 30) * days).toFixed(2));

    setFormData(prev => ({
      ...prev,
      basicSalary: proRate(emp.basicSalary || 0),
      housingAllowance: proRate(emp.housingAllowance || 0),
      transportAllowance: proRate(emp.transportAllowance || 0),
      subsistenceAllowance: proRate(emp.subsistenceAllowance || 0),
      otherAllowances: proRate(emp.otherAllowances || 0),
      mobileAllowance: proRate(emp.mobileAllowance || 0),
      managementAllowance: proRate(emp.managementAllowance || 0),
    }));
  }, [formData.actualWorkDays]);

  const calculateTotals = (data: typeof formData) => {
    const totalIncome = data.basicSalary + data.housingAllowance + data.transportAllowance + 
                        data.subsistenceAllowance + data.otherAllowances + data.mobileAllowance + 
                        data.managementAllowance + data.otherIncome + data.overtimeValue + data.salaryIncrease;
    
    const absenceDed = data.absenceDeduction;
    const hourDed = (data.deductionHours * (data.basicSalary / 240));

    const totalDeductions = data.socialInsurance + data.salaryReceived + data.loans + 
                            data.bankReceived + data.otherDeductions + data.departureDelayDeduction + 
                            absenceDed + hourDed;

    return {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalDeductions: Number(totalDeductions.toFixed(2)),
      netSalary: Number((totalIncome - totalDeductions).toFixed(2))
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
      notes: ''
    });
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'transactions', id));
    setDeleteConfirmId(null);
  };

  const handleEdit = (t: Transaction) => {
    setFormData({ ...t });
    setIsModalOpen(true);
  };

  const handleExportExcel = () => {
    const data = sortedTransactions.map((t) => {
      const emp = employees.find(e => e.id === t.employeeId);
      return {
        'اسم الموظف': emp?.name || 'موظف محذوف',
        'الشهر': t.month,
        'أيام العمل': t.actualWorkDays,
        'الأساسي': t.basicSalary,
        'بدل سكن': t.housingAllowance,
        'إضافي': t.overtimeValue,
        'كافة الإيرادات': t.totalIncome,
        'الخصومات': t.totalDeductions,
        'الصافي': t.netSalary,
        'ملاحظات': t.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `Salarix_Monthly_Transactions_${new Date().toISOString().slice(0, 7)}.xlsx`);
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
      data.forEach((row) => {
        const emp = employees.find(e => e.name === row['اسم الموظف'] || e.employeeId === row['رقم الموظف']);
        if (emp) {
          const docRef = doc(collection(db, 'transactions'));
          const basic = Number(row['الأساسي'] || row['الراتب الأساسي']) || emp.basicSalary;
          const housing = Number(row['بدل سكن']) || emp.housingAllowance;
          const transport = Number(row['بدل نقل']) || emp.transportAllowance;
          
          const rawData = {
            employeeId: emp.id,
            month: row['الشهر'] || new Date().toISOString().slice(0, 7),
            actualWorkDays: Number(row['أيام العمل']) || 30,
            basicSalary: basic,
            housingAllowance: housing,
            transportAllowance: transport,
            subsistenceAllowance: Number(row['بدل إعاشه']) || emp.subsistenceAllowance,
            otherAllowances: Number(row['بدلات اخرى']) || emp.otherAllowances,
            mobileAllowance: Number(row['بدل جوال']) || emp.mobileAllowance,
            managementAllowance: Number(row['بدل ادارة']) || emp.managementAllowance,
            otherIncome: Number(row['دخل آخر']) || 0,
            overtimeHours: Number(row['ساعات الإضافي']) || 0,
            overtimeValue: Number(row['قيمة الإضافي']) || 0,
            socialInsurance: Number(row['تأمين اجتماعي']) || 0,
            salaryReceived: Number(row['استلام راتب']) || 0,
            loans: Number(row['سلف']) || 0,
            bankReceived: Number(row['استلام بنك']) || 0,
            otherDeductions: Number(row['خصومات أخرى']) || 0,
            deductionHours: Number(row['ساعات الخصم']) || 0,
            departureDelayDeduction: 0,
            absenceDays: Number(row['أيام الغياب']) || 0,
            absenceDeduction: Number(row['خصم الغياب']) || 0,
            salaryIncrease: Number(row['زيادة راتب']) || 0,
            notes: row['ملاحظات'] || '',
            status: 'Draft'
          };

          const totals = calculateTotals(rawData as any);
          batch.set(docRef, { ...rawData, ...totals, createdAt: new Date().toISOString() });
        }
      });

      await batch.commit();
      alert('تم استيراد الحركات بنجاح');
    };
    reader.readAsBinaryString(file);
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions]
      .filter(t => {
        const empName = employees.find(e => e.id === t.employeeId)?.name || '';
        return empName.toLowerCase().includes(searchTerm.toLowerCase()) || 
               t.month.includes(searchTerm);
      })
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [transactions, employees, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="البحث بالموظف أو الشهر (YYYY-MM)..."
            className="w-full pr-12 pl-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer p-3 bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 font-bold">
            <Upload className="w-5 h-5" />
            <span className="hidden md:inline">استيراد</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
          </label>
          <button 
            onClick={handleExportExcel}
            className="p-3 bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 font-bold"
          >
            <Download className="w-5 h-5" />
            <span className="hidden md:inline">تصدير</span>
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
                        placeholder="ابحث بالاسم هنا..."
                        className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium mb-2"
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                      />
                      <select 
                        required 
                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                        value={formData.employeeId} 
                        onChange={(e) => handleEmployeeChange(e.target.value)}
                      >
                        <option value="">اختر الموظف من القائمة...</option>
                        {employees
                          .filter(e => e.status === 'Active')
                          .filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase()))
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الشهر</label>
                    <input type="month" required className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.month} onChange={(e) => setFormData({...formData, month: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">أيام العمل الفعلية</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.actualWorkDays} onChange={(e) => setFormData({...formData, actualWorkDays: Number(e.target.value)})} />
                  </div>

                  <div className="md:col-span-3 border-b border-gray-100 pb-2">
                    <h4 className="font-black text-emerald-600">الدخل (الإضافات)</h4>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الراتب الأساسي</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.basicSalary} onChange={(e) => setFormData({...formData, basicSalary: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل سكن</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.housingAllowance} onChange={(e) => setFormData({...formData, housingAllowance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل نقل</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.transportAllowance} onChange={(e) => setFormData({...formData, transportAllowance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ساعات الإضافي</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.overtimeHours} onChange={(e) => setFormData({...formData, overtimeHours: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">قيمة الإضافي</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.overtimeValue} onChange={(e) => setFormData({...formData, overtimeValue: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">دخل آخر</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.otherIncome} onChange={(e) => setFormData({...formData, otherIncome: Number(e.target.value)})} />
                  </div>

                  <div className="md:col-span-3 border-b border-gray-100 pb-2">
                    <h4 className="font-black text-red-600">الخصومات</h4>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">تأمين اجتماعي</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.socialInsurance} onChange={(e) => setFormData({...formData, socialInsurance: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">سلف</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.loans} onChange={(e) => setFormData({...formData, loans: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">أيام الغياب</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.absenceDays} onChange={(e) => setFormData({...formData, absenceDays: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">خصم الغياب</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.absenceDeduction} onChange={(e) => setFormData({...formData, absenceDeduction: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ساعات الخصم</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.deductionHours} onChange={(e) => setFormData({...formData, deductionHours: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">خصومات أخرى</label>
                    <input type="number" className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={formData.otherDeductions} onChange={(e) => setFormData({...formData, otherDeductions: Number(e.target.value)})} />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ملاحظات</label>
                    <textarea className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium h-24" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
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
