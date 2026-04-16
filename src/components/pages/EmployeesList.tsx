import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  UserPlus,
  Filter,
  Download,
  Upload,
  X as CloseIcon,
  FileSpreadsheet
} from 'lucide-react';
import { db, collection, onSnapshot, setDoc, doc, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { writeBatch, doc as firestoreDoc } from 'firebase/firestore';
import { Employee, Allowance, AllowanceType } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

export const EmployeesList: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string | 'bulk', show: boolean }>({ id: '', show: false });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);

  // Form State
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    employeeId: '',
    name: '',
    iqamaNumber: '',
    officialEmployer: '',
    professionAsPerIqama: '',
    nationality: '',
    jobTitle: '',
    joinDate: '',
    lastDirectDate: '',
    sectorManagement: '',
    sectors: '',
    costCenterMain: '',
    costCenterDept: '',
    location: '',
    bankAccount: '',
    bankCode: '',
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    subsistenceAllowance: 0,
    otherAllowances: 0,
    mobileAllowance: 0,
    managementAllowance: 0,
    status: 'Active',
    paymentMethod: 'Bank',
    allowances: [],
    email: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'employees'));

    const unsubTypes = onSnapshot(collection(db, 'allowanceTypes'), (snap) => {
      setAllowanceTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllowanceType)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'allowanceTypes'));

    return () => { unsub(); unsubTypes(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingEmployee?.id || doc(collection(db, 'employees')).id;
    await setDoc(doc(db, 'employees', id), formData);
    setIsModalOpen(false);
    setEditingEmployee(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      name: '',
      iqamaNumber: '',
      officialEmployer: '',
      professionAsPerIqama: '',
      nationality: '',
      jobTitle: '',
      joinDate: '',
      lastDirectDate: '',
      sectorManagement: '',
      sectors: '',
      costCenterMain: '',
      costCenterDept: '',
      location: '',
      bankAccount: '',
      bankCode: '',
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      subsistenceAllowance: 0,
      otherAllowances: 0,
      mobileAllowance: 0,
      managementAllowance: 0,
      status: 'Active',
      paymentMethod: 'Bank',
      allowances: [],
      email: ''
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
      batch.delete(doc(db, 'employees', id));
    });
    await batch.commit();
    setSelectedIds([]);
    setDeleteConfirm({ id: '', show: false });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map(e => e.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAddAllowance = () => {
    setFormData({
      ...formData,
      allowances: [...formData.allowances, { id: crypto.randomUUID(), type: '', amount: 0 }]
    });
  };

  const handleRemoveAllowance = (index: number) => {
    const newAllowances = [...formData.allowances];
    newAllowances.splice(index, 1);
    setFormData({ ...formData, allowances: newAllowances });
  };

  const handleAllowanceChange = (index: number, field: keyof Allowance, value: string | number) => {
    const newAllowances = [...formData.allowances];
    newAllowances[index] = { ...newAllowances[index], [field]: value };
    setFormData({ ...formData, allowances: newAllowances });
  };

  const handleExportExcel = () => {
    const data = employees.map((emp, index) => ({
      'ت عام': index + 1,
      'ت': index + 1,
      'رقم الموظف': emp.employeeId || '',
      'رقم الأقامة': emp.iqamaNumber || '',
      'صاحب العمل الرسمي': emp.officialEmployer || '',
      'الراتب الاساسي': emp.basicSalary,
      'بدل سكن': emp.housingAllowance || 0,
      'بدل نقل': emp.transportAllowance || 0,
      'بدل إعاشه': emp.subsistenceAllowance || 0,
      'بدل جوال': emp.mobileAllowance || 0,
      'بدل ادارة': emp.managementAllowance || 0,
      'بدلات اخرى': emp.otherAllowances || 0,
      'الايبــــــــــان': emp.bankAccount || '',
      'كود البنك': emp.bankCode || '',
      'طريقة الاستلام': emp.paymentMethod === 'Bank' ? 'استلام بنك' : 'استلام راتب',
      'المهنة حسب الاقامة': emp.professionAsPerIqama || '',
      'الإسم': emp.name,
      'الجنسية': emp.nationality || '',
      'الوظيفة': emp.jobTitle || '',
      'بداية العمل': emp.joinDate || '',
      'آخر مباشرة': emp.lastDirectDate || '',
      'ادارة القطاع': emp.sectorManagement || '',
      'القطاعات': emp.sectors || '',
      'مركز التكلفة / رئيسي': emp.costCenterMain || '',
      'مركز التكلفة / قسم': emp.costCenterDept || '',
      'الموقع': emp.location || '',
      'المجموع': emp.basicSalary + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + 
                 (emp.subsistenceAllowance || 0) + (emp.otherAllowances || 0) + 
                 (emp.mobileAllowance || 0) + (emp.managementAllowance || 0) +
                 (emp.allowances || []).reduce((sum, a) => sum + a.amount, 0),
      'الحالة': emp.status === 'Active' ? 'نشط' : 'غير نشط'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "Salarix_Employees_Master.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataArr = evt.target?.result;
      const wb = XLSX.read(dataArr, { type: 'binary', cellDates: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const parseExcelDate = (val: any) => {
        if (!val) return '';
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'number') {
          const date = new Date(Math.round((val - 25569) * 86400 * 1000));
          return date.toISOString().split('T')[0];
        }
        return String(val);
      };

      const batch = writeBatch(db);
      data.forEach((row) => {
        const docRef = doc(collection(db, 'employees'));
        const allowances: Allowance[] = [];
        
        let paymentMethod: 'Bank' | 'Cash' = 'Bank';
        const pMethodRaw = row['نوع استلام الراتب'] || row['طريقة الاستلام'] || '';
        if (pMethodRaw === 'استلام راتب' || pMethodRaw === 'Cash') {
          paymentMethod = 'Cash';
        }

        batch.set(docRef, {
          employeeId: String(row['رقم الموظف'] || row['الرقم الوظيفي'] || ''),
          name: row['الإسم'] || row['اسم الموظف'] || row['الاسم'] || 'بدون اسم',
          iqamaNumber: String(row['رقم الأقامة'] || row['رقم الإقامة'] || ''),
          officialEmployer: row['صاحب العمل الرسمي'] || '',
          professionAsPerIqama: row['المهنة حسب الاقامة'] || '',
          nationality: row['الجنسية'] || '',
          jobTitle: row['الوظيفة'] || '',
          joinDate: parseExcelDate(row['بداية العمل']),
          lastDirectDate: parseExcelDate(row['آخر مباشرة']),
          sectorManagement: row['ادارة القطاع'] || '',
          sectors: row['القطاعات'] || '',
          costCenterMain: row['مركز التكلفة / رئيسي'] || '',
          costCenterDept: row['مركز التكلفة / قسم'] || '',
          location: row['الموقع'] || '',
          bankAccount: row['الايبــــــــــان'] || row['رقم الحساب (IBAN)'] || '',
          bankCode: row['كود البنك'] || row['البنك'] || '',
          paymentMethod: paymentMethod,
          basicSalary: Number(row['الراتب الاساسي'] || row['الراتب الأساسي']) || 0,
          housingAllowance: Number(row['بدل سكن']) || 0,
          transportAllowance: Number(row['بدل نقل']) || 0,
          subsistenceAllowance: Number(row['بدل إعاشه']) || 0,
          otherAllowances: Number(row['بدلات اخرى']) || 0,
          mobileAllowance: Number(row['بدل جوال']) || 0,
          managementAllowance: Number(row['بدل ادارة']) || 0,
          status: (row['الحالة'] === 'نشط' || row['Status'] === 'Active') ? 'Active' : 'Inactive',
          allowances: allowances,
          email: row['البريد الإلكتروني'] || ''
        });
      });

      await batch.commit();
      alert('تم استيراد البيانات بنجاح');
    };
    reader.readAsBinaryString(file);
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({ 
      ...emp,
      allowances: (emp.allowances || []).map(a => ({ ...a, id: a.id || crypto.randomUUID() }))
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'employees', id));
    setDeleteConfirm({ id: '', show: false });
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      (e.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.jobTitle?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.sectorManagement?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="البحث عن موظف أو قسم..."
            className="w-full pr-12 pl-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button 
              onClick={() => setDeleteConfirm({ id: 'bulk', show: true })}
              className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-5 h-5" />
              <span>حذف المحدد ({selectedIds.length})</span>
            </button>
          )}
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
            onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-200"
          >
            <UserPlus className="w-5 h-5" />
            <span>إضافة موظف</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-right">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">الموظف</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">القسم</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">الراتب الأساسي</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">الحالة</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className={cn("hover:bg-gray-50/50 transition-colors group", selectedIds.includes(emp.id) && "bg-blue-50/30")}>
                  <td className="px-8 py-5">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedIds.includes(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                    />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg">
                        {emp.name[0]}
                      </div>
                      <div>
                        <p className="font-black text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-400 font-medium">{emp.email || 'لا يوجد بريد'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">
                      {emp.sectorManagement || 'غير محدد'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-black text-gray-900">{formatCurrency(emp.basicSalary)}</p>
                    <p className="text-xs text-gray-400 font-medium">بدلات: {formatCurrency((emp.allowances || []).reduce((sum, a) => sum + a.amount, 0))}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black",
                      emp.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", emp.status === 'Active' ? "bg-emerald-600" : "bg-red-600")} />
                      {emp.status === 'Active' ? 'نشط' : 'غير نشط'}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(emp)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ id: emp.id, show: true })}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-2xl font-black text-gray-900">
                  {editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الرقم الوظيفي</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.employeeId}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الإسم</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">رقم الإقامة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.iqamaNumber}
                      onChange={(e) => setFormData({...formData, iqamaNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">صاحب العمل الرسمي</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.officialEmployer}
                      onChange={(e) => setFormData({...formData, officialEmployer: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الجنسية</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.nationality}
                      onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الوظيفة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">المهنة حسب الاقامة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.professionAsPerIqama}
                      onChange={(e) => setFormData({...formData, professionAsPerIqama: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بداية العمل</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.joinDate}
                      onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">آخر مباشرة</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.lastDirectDate}
                      onChange={(e) => setFormData({...formData, lastDirectDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">ادارة القطاع</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.sectorManagement}
                      onChange={(e) => setFormData({...formData, sectorManagement: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">القطاعات</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.sectors}
                      onChange={(e) => setFormData({...formData, sectors: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">مركز التكلفة / رئيسي</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.costCenterMain}
                      onChange={(e) => setFormData({...formData, costCenterMain: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">مركز التكلفة / قسم</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.costCenterDept}
                      onChange={(e) => setFormData({...formData, costCenterDept: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الموقع</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">نوع استلام الراتب</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                    >
                      <option value="Bank">استلام بنك</option>
                      <option value="Cash">استلام راتب</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">كود البنك</label>
                    <input 
                      placeholder="مثال: NCBK, RJHI"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.bankCode}
                      onChange={(e) => setFormData({...formData, bankCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الايبــــــــــان</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.bankAccount}
                      onChange={(e) => setFormData({...formData, bankAccount: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الراتب الاساسي</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.basicSalary}
                      onChange={(e) => setFormData({...formData, basicSalary: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل سكن</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.housingAllowance}
                      onChange={(e) => setFormData({...formData, housingAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل نقل</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.transportAllowance}
                      onChange={(e) => setFormData({...formData, transportAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل إعاشه</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.subsistenceAllowance}
                      onChange={(e) => setFormData({...formData, subsistenceAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل جوال</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.mobileAllowance}
                      onChange={(e) => setFormData({...formData, mobileAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل ادارة</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.managementAllowance}
                      onChange={(e) => setFormData({...formData, managementAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدلات اخرى</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.otherAllowances}
                      onChange={(e) => setFormData({...formData, otherAllowances: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الحالة</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="Active">نشط</option>
                      <option value="Inactive">غير نشط</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-500 mr-2">بدلات إضافية (مخصصة)</label>
                      <button 
                        type="button"
                        onClick={handleAddAllowance}
                        className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        إضافة بدل
                      </button>
                    </div>
                    <div className="space-y-3">
                      {formData.allowances.map((allowance, index) => (
                        <div key={allowance.id || index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                          <select 
                            className="flex-1 bg-white px-4 py-2 rounded-xl border border-gray-100 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={allowance.type}
                            onChange={(e) => handleAllowanceChange(index, 'type', e.target.value)}
                          >
                            <option value="">اختر نوع البدل...</option>
                            {allowanceTypes.map(t => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                          <input 
                            type="number"
                            placeholder="المبلغ"
                            className="w-32 bg-white px-4 py-2 rounded-xl border border-gray-100 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={allowance.amount}
                            onChange={(e) => handleAllowanceChange(index, 'amount', Number(e.target.value))}
                          />
                          <button 
                            type="button"
                            onClick={() => handleRemoveAllowance(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <CloseIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200"
                  >
                    حفظ البيانات
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm({ id: '', show: false })}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">تأكيد الحذف</h3>
              <p className="text-gray-500 font-medium mb-8">
                {deleteConfirm.id === 'bulk' 
                  ? `هل أنت متأكد من حذف ${selectedIds.length} موظف؟ لا يمكن التراجع عن هذا الإجراء.`
                  : 'هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => deleteConfirm.id === 'bulk' ? handleBulkDelete() : handleDelete(deleteConfirm.id)}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-200"
                >
                  نعم، احذف
                </button>
                <button 
                  onClick={() => setDeleteConfirm({ id: '', show: false })}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const X = (props: any) => <MoreVertical {...props} />;
