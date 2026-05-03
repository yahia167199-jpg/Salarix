import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  UserPlus,
  User,
  Filter,
  Download,
  Upload,
  Printer,
  X as CloseIcon,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { writeBatch, doc as firestoreDoc } from 'firebase/firestore';
import { Employee, Allowance, AllowanceType, EmployeeCategory, EmployeeStatus } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

export const EmployeesList: React.FC<{ filterClassification?: EmployeeCategory }> = ({ filterClassification: initialFilterClassification }) => {
  const { employees, allowanceTypes, branches, sectors, managements, costCenterDepts } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<EmployeeCategory | 'All'>(initialFilterClassification || 'All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string | 'bulk', show: boolean }>({ id: '', show: false });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    classification: 'Standard',
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
    dailyWorkHours: 8,
    status: 'Active',
    paymentMethod: 'Bank',
    allowances: [],
    email: '',
    iqamaExpiryDate: ''
  });

  // Handle auto-sector mapping
  useEffect(() => {
    if (formData.costCenterDept) {
      const mapping = costCenterDepts.find(ccd => ccd.name === formData.costCenterDept);
      if (mapping) {
        setFormData(prev => ({ ...prev, sectors: mapping.sectorName }));
      }
    }
  }, [formData.costCenterDept, costCenterDepts]);

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
      classification: 'Standard',
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
      dailyWorkHours: 8,
      status: 'Active',
      paymentMethod: 'Bank',
      allowances: [],
      email: '',
      iqamaExpiryDate: ''
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
      'رقم الأقامة': emp.iqamaNumber || '',
      'صاحب العمل الرسمي': emp.officialEmployer || '',
      'الراتب الاساسي': emp.basicSalary,
      'بدل سكن': emp.housingAllowance || 0,
      'كود البنك': emp.bankCode || '',
      'الايبــــــــــان': emp.bankAccount || '',
      'المهنة حسب الاقامة': emp.professionAsPerIqama || '',
      'الإسم': emp.name,
      'الجنسية': emp.nationality || '',
      'الوظيفة': emp.jobTitle || '',
      'الرقم الوظيفي': emp.employeeId || '',
      'بداية العمل': emp.joinDate || '',
      'آخر مباشرة': emp.lastDirectDate || '',
      'تاريخ انتهاء الإقامة': emp.iqamaExpiryDate || '',
      'ادارة القطاع': emp.sectorManagement || '',
      'القطاعات': emp.sectors || '',
      'مركز التكلفة / رئيسي': emp.costCenterMain || '',
      'مركز التكلفة / قسم': emp.costCenterDept || '',
      'الموقع': emp.location || '',
      'بدل نقل': emp.transportAllowance || 0,
      'بدل إعاشه': emp.subsistenceAllowance || 0,
      'بدلات أخرى': emp.otherAllowances || 0,
      'بدل جوال': emp.mobileAllowance || 0,
      'بدل ادارة': emp.managementAllowance || 0,
      'المجموع': emp.basicSalary + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + 
                 (emp.subsistenceAllowance || 0) + (emp.otherAllowances || 0) + 
                 (emp.mobileAllowance || 0) + (emp.managementAllowance || 0) +
                 (emp.allowances || []).reduce((sum, a) => sum + a.amount, 0),
      'عدد ساعات العمل': emp.dailyWorkHours || 8,
      'تصنيف التوظيف': emp.classification === 'Standard' ? 'موظف عادي' : 
                       emp.classification === 'Saudi' ? 'سعودي' : 
                       emp.classification === 'Accounting' ? 'محاسبات' : 'موظف عادي',
      'نوع استلام الراتب': emp.paymentMethod === 'Bank' ? 'استلام البنك' : 'استلام راتب',
      'حالة الموظف': emp.status === 'Active' ? 'نشط' : 
                    emp.status === 'Leave' ? 'إجازة' :
                    emp.status === 'End of Service' ? 'انهاء خدمات' :
                    emp.status === 'Out of Sponsorship' ? 'خارج الكفالة' : 'نشط'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "Employees_Master.xlsx");
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
        
        let paymentMethod: 'Bank' | 'Cash' = 'Bank';
        const pMethodRaw = String(row['نوع استلام الراتب'] || '').trim();
        if (pMethodRaw === 'استلام راتب' || pMethodRaw.includes('Cash')) {
          paymentMethod = 'Cash';
        }

        let classification: EmployeeCategory = 'Standard';
        const classRaw = String(row['تصنيف التوظيف'] || '').trim();
        if (classRaw === 'سعودي' || classRaw === 'Saudi') classification = 'Saudi';
        else if (classRaw === 'محاسبات' || classRaw === 'Accounting') classification = 'Accounting';

        let status: EmployeeStatus = 'Active';
        const statusRaw = String(row['حالة الموظف'] || '').trim();
        if (statusRaw === 'إجازة' || statusRaw === 'Leave') status = 'Leave';
        else if (statusRaw === 'انهاء خدمات' || statusRaw === 'End of Service') status = 'End of Service';
        else if (statusRaw === 'خارج الكفالة' || statusRaw === 'Out of Sponsorship') status = 'Out of Sponsorship';

        batch.set(docRef, {
          classification,
          employeeId: String(row['الرقم الوظيفي'] || row['رقم الموظف'] || ''),
          name: row['الإسم'] || row['اسم الموظف'] || 'بدون اسم',
          iqamaNumber: String(row['رقم الأقامة'] || row['رقم الإقامة'] || ''),
          officialEmployer: row['صاحب العمل الرسمي'] || '',
          professionAsPerIqama: row['المهنة حسب الاقامة'] || '',
          nationality: row['الجنسية'] || '',
          jobTitle: row['الوظيفة'] || '',
          joinDate: parseExcelDate(row['بداية العمل']),
          lastDirectDate: parseExcelDate(row['آخر مباشرة']),
          iqamaExpiryDate: parseExcelDate(row['تاريخ انتهاء الإقامة']),
          sectorManagement: row['ادارة القطاع'] || '',
          sectors: row['القطاعات'] || '',
          costCenterMain: row['مركز التكلفة / رئيسي'] || '',
          costCenterDept: row['مركز التكلفة / قسم'] || '',
          location: row['الموقع'] || '',
          bankAccount: row['الايبــــــــــان'] || '',
          bankCode: row['كود البنك'] || '',
          paymentMethod: paymentMethod,
          basicSalary: Number(row['الراتب الاساسي']) || 0,
          housingAllowance: Number(row['بدل سكن']) || 0,
          transportAllowance: Number(row['بدل نقل']) || 0,
          subsistenceAllowance: Number(row['بدل إعاشه']) || 0,
          otherAllowances: Number(row['بدلات أخرى'] || row['بدلات اخرى']) || 0,
          mobileAllowance: Number(row['بدل جوال']) || 0,
          managementAllowance: Number(row['بدل ادارة']) || 0,
          dailyWorkHours: Number(row['عدد ساعات العمل'] || 8) || 8,
          status: status,
          allowances: [],
          email: ''
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

  const calculateBalance = (employee: Employee) => {
    if (!employee.joinDate) return 0;
    
    // Total days of service
    const joinDate = new Date(employee.joinDate);
    if (isNaN(joinDate.getTime())) return 0;
    
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - joinDate.getTime());
    const serviceDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Accrued days (21 days per year)
    const accrued = (serviceDays / 365) * 21;
    
    // In a real app, we'd fetch leaves here too, but for simplicity in this view
    // we show the accrued amount or assume it's stored.
    // However, to keep it consistent with the Leaves page:
    const used = (employee.usedLeaveDays || 0);
    const result = accrued - used;
    return isNaN(result) ? 0 : Math.max(0, Number(result.toFixed(1)));
  };

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (classificationFilter !== 'All') {
      result = result.filter(e => e.classification === classificationFilter);
    }
    return result.filter(e => 
      (e.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.jobTitle?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.sectorManagement?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm, classificationFilter]);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
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
          <div className="relative group">
            <Filter className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
              classificationFilter !== 'All' ? "text-blue-600" : "text-gray-400"
            )} />
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value as any)}
              className={cn(
                "pr-10 pl-10 py-3 bg-white border rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold shadow-sm appearance-none min-w-[180px] text-sm cursor-pointer",
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
            onClick={() => window.print()}
            className="p-3 bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 font-bold"
          >
            <Printer className="w-5 h-5" />
            <span className="hidden md:inline">طباعة</span>
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
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">القطاع</th>
                {!initialFilterClassification && <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">مركز التكلفة / رئيسي</th>}
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">رقم الهوية / الإقامة</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">آخر مباشرة</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">رصيد الإجازات</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">قيمة المرتب</th>
                {!initialFilterClassification && <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">الحالة</th>}
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
                        <p className="text-xs text-gray-400 font-medium">{emp.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold block whitespace-nowrap">
                      {emp.sectors || 'غير محدد'}
                    </span>
                  </td>
                  {!initialFilterClassification && (
                    <td className="px-8 py-5 text-center">
                      <span className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold block whitespace-nowrap">
                        {emp.sectorManagement || 'غير محدد'}
                      </span>
                    </td>
                  )}
                  {initialFilterClassification && (
                    <td className="px-8 py-5 font-bold text-gray-600">
                      {emp.iqamaNumber || 'غير مسجل'}
                    </td>
                  )}
                  <td className="px-8 py-5">
                    <span className="font-bold text-gray-600 block text-sm">
                      {emp.lastDirectDate || '---'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-black">
                      {calculateBalance(emp)} يوم
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-black text-gray-900">{formatCurrency(emp.basicSalary)}</p>
                    {!initialFilterClassification && <p className="text-xs text-gray-400 font-medium">بدلات: {formatCurrency((emp.allowances || []).reduce((sum, a) => sum + a.amount, 0))}</p>}
                  </td>
                  {!initialFilterClassification && (
                    <td className="px-8 py-5">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black",
                        emp.status === 'Active' ? "bg-emerald-50 text-emerald-600" :
                        emp.status === 'End of Service' ? "bg-red-50 text-red-600" :
                        emp.status === 'Leave' ? "bg-blue-50 text-blue-600" :
                        emp.status === 'Out of Sponsorship' ? "bg-orange-50 text-orange-600" :
                        "bg-gray-50 text-gray-600"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", 
                          emp.status === 'Active' ? "bg-emerald-600" :
                          emp.status === 'End of Service' ? "bg-red-600" :
                          emp.status === 'Leave' ? "bg-blue-600" :
                          emp.status === 'Out of Sponsorship' ? "bg-orange-600" :
                          "bg-gray-600"
                        )} />
                        {emp.status === 'Active' ? 'نشط' : 
                         emp.status === 'End of Service' ? 'إنهاء خدمات' :
                         emp.status === 'Leave' ? 'إجازة' : 
                         emp.status === 'Out of Sponsorship' ? 'خارج الكفالة' : 'غير نشط'}
                      </div>
                    </td>
                  )}
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 transition-opacity">
                      <button 
                        onClick={() => setViewingEmployee(emp)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="عرض الملف"
                      >
                        <User className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(emp)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ id: emp.id, show: true })}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
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
                    <label className="text-sm font-bold text-gray-500 mr-2">تصنيف الموظف</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right"
                      value={formData.classification || 'Standard'}
                      onChange={(e) => setFormData({...formData, classification: e.target.value as any})}
                    >
                      <option value="Standard">موظف عادي</option>
                      <option value="Saudi">السعوديين</option>
                      <option value="Accounting">رواتب المحاسبات</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الرقم الوظيفي</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.employeeId || ''}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الإسم</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">رقم الإقامة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.iqamaNumber || ''}
                      onChange={(e) => setFormData({...formData, iqamaNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">تاريخ انتهاء الإقامة</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.iqamaExpiryDate || ''}
                      onChange={(e) => setFormData({...formData, iqamaExpiryDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">صاحب العمل الرسمي</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right"
                      value={formData.officialEmployer || ''}
                      onChange={(e) => setFormData({...formData, officialEmployer: e.target.value})}
                    >
                      <option value="">اختر الفرع / صاحب العمل</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                      {!branches.some(b => b.name === formData.officialEmployer) && formData.officialEmployer && (
                        <option value={formData.officialEmployer}>{formData.officialEmployer}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الجنسية</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.nationality || ''}
                      onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الوظيفة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.jobTitle || ''}
                      onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">المهنة حسب الاقامة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.professionAsPerIqama || ''}
                      onChange={(e) => setFormData({...formData, professionAsPerIqama: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بداية العمل</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.joinDate || ''}
                      onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">آخر مباشرة</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.lastDirectDate || ''}
                      onChange={(e) => setFormData({...formData, lastDirectDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">القطاعات</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right"
                      value={formData.sectors || ''}
                      onChange={(e) => setFormData({...formData, sectors: e.target.value})}
                    >
                      <option value="">اختر القطاع</option>
                      {sectors.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      {!sectors.some(s => s.name === formData.sectors) && formData.sectors && (
                        <option value={formData.sectors}>{formData.sectors}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">مركز التكلفة / رئيسي</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right"
                      value={formData.sectorManagement || ''}
                      onChange={(e) => setFormData({...formData, sectorManagement: e.target.value})}
                    >
                      <option value="">اختر مركز التكلفة</option>
                      {managements.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                      {!managements.some(m => m.name === formData.sectorManagement) && formData.sectorManagement && (
                        <option value={formData.sectorManagement}>{formData.sectorManagement}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">مركز التكلفة / قسم</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right"
                      value={formData.costCenterDept || ''}
                      onChange={(e) => setFormData({...formData, costCenterDept: e.target.value})}
                    >
                      <option value="">اختر القسم التفصيلي</option>
                      {costCenterDepts.map(ccd => (
                        <option key={ccd.id} value={ccd.name}>{ccd.name}</option>
                      ))}
                      {!costCenterDepts.some(ccd => ccd.name === formData.costCenterDept) && formData.costCenterDept && (
                        <option value={formData.costCenterDept}>{formData.costCenterDept}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الموقع</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.location || ''}
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
                    <label className="text-sm font-bold text-gray-500 mr-2">ساعات العمل اليومية</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.dailyWorkHours ?? 8}
                      onChange={(e) => setFormData({...formData, dailyWorkHours: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">كود البنك</label>
                    <input 
                      placeholder="مثال: NCBK, RJHI"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.bankCode || ''}
                      onChange={(e) => setFormData({...formData, bankCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الايبــــــــــان</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.bankAccount || ''}
                      onChange={(e) => setFormData({...formData, bankAccount: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">الراتب الاساسي</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.basicSalary ?? 0}
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
                    <label className="text-sm font-bold text-gray-500 mr-2">حالة الموظف</label>
                    <select 
                      id="employee-status-select"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="Active">نشط</option>
                      <option value="Leave">اجازة</option>
                      <option value="End of Service">انهاء خدمات</option>
                      <option value="Out of Sponsorship">خارج الكفالة</option>
                    </select>
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

      {/* Model - View Details */}
      <AnimatePresence>
        {viewingEmployee && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingEmployee(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-emerald-50/30">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-emerald-100 rounded-[2rem] flex items-center justify-center text-emerald-600 font-black text-3xl shadow-inner">
                    {viewingEmployee.name[0]}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">{viewingEmployee.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="px-3 py-1 bg-white text-gray-500 rounded-xl text-xs font-black shadow-sm border border-gray-100">
                        #{viewingEmployee.employeeId}
                      </span>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black">
                        {viewingEmployee.jobTitle}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewingEmployee(null)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-gray-100 group">
                  <CloseIcon className="w-6 h-6 text-gray-400 group-hover:text-red-500 transition-colors" />
                </button>
              </div>
              
              <div className="p-10 max-h-[75vh] overflow-y-auto space-y-10 custom-scrollbar">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                  <DetailItem label="رقم الإقامة / الهوية" value={viewingEmployee.iqamaNumber} />
                  <DetailItem label="تاريخ انتهاء الإقامة" value={viewingEmployee.iqamaExpiryDate} />
                  <DetailItem label="الجنسية" value={viewingEmployee.nationality} />
                  <DetailItem label="تاريخ التعيين" value={viewingEmployee.joinDate} />
                  <DetailItem label="آخر مباشرة" value={viewingEmployee.lastDirectDate} />
                  <DetailItem label="القطاع" value={viewingEmployee.sectors} />
                  <DetailItem label="مركز التكلفة" value={viewingEmployee.sectorManagement} />
                  <DetailItem label="الموقع" value={viewingEmployee.location} />
                  <DetailItem label="طريقة الدفع" value={viewingEmployee.paymentMethod === 'Bank' ? 'بنك' : 'نقداً'} />
                  <DetailItem label="رصيد الإجازات الحالي" value={`${calculateBalance(viewingEmployee)} يوم`} />
                  <DetailItem label="عدد ساعات العمل" value={`${viewingEmployee.dailyWorkHours || 8} ساعات`} />
                  <DetailItem label="البريد الإلكتروني" value={viewingEmployee.email} />
                </div>

                <div className="p-8 bg-blue-50/30 rounded-[2.5rem] border border-blue-100/50">
                  <h4 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-lg">
                     <span className="w-2.5 h-8 bg-blue-600 rounded-full shadow-lg shadow-blue-200" />
                     الهيكل المالي والبدلات
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    <DetailItem label="الراتب الأساسي" value={formatCurrency(viewingEmployee.basicSalary)} highlight />
                    <DetailItem label="بدل سكن" value={formatCurrency(viewingEmployee.housingAllowance)} />
                    <DetailItem label="بدل نقل" value={formatCurrency(viewingEmployee.transportAllowance)} />
                    <DetailItem label="بدل إعاشة" value={formatCurrency(viewingEmployee.subsistenceAllowance)} />
                    <DetailItem label="بدل جوال" value={formatCurrency(viewingEmployee.mobileAllowance)} />
                    <DetailItem label="بدل إدارة" value={formatCurrency(viewingEmployee.managementAllowance)} />
                    <DetailItem label="بدلات أخرى" value={formatCurrency(viewingEmployee.otherAllowances)} />
                    <DetailItem 
                      label="إجمالي البدلات" 
                      value={formatCurrency(
                        (viewingEmployee.housingAllowance || 0) + 
                        (viewingEmployee.transportAllowance || 0) + 
                        (viewingEmployee.subsistenceAllowance || 0) + 
                        (viewingEmployee.mobileAllowance || 0) + 
                        (viewingEmployee.managementAllowance || 0) + 
                        (viewingEmployee.otherAllowances || 0) +
                        (viewingEmployee.allowances || []).reduce((sum, a) => sum + a.amount, 0)
                      )} 
                      highlight
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center p-8 border-2 border-emerald-100 bg-emerald-50/20 rounded-[2.5rem] shadow-sm">
                   <div>
                     <p className="text-gray-400 font-black uppercase text-xs tracking-widest mb-1">صافي الراتب الشهري</p>
                     <p className="text-sm font-bold text-emerald-600/60">شامل كافة البدلات الثابتة</p>
                   </div>
                   <p className="text-5xl font-black text-emerald-600 tracking-tighter">
                     {formatCurrency(
                       viewingEmployee.basicSalary + 
                       (viewingEmployee.housingAllowance || 0) + 
                       (viewingEmployee.transportAllowance || 0) + 
                       (viewingEmployee.subsistenceAllowance || 0) + 
                       (viewingEmployee.mobileAllowance || 0) + 
                       (viewingEmployee.managementAllowance || 0) + 
                       (viewingEmployee.otherAllowances || 0) +
                       (viewingEmployee.allowances || []).reduce((sum, a) => sum + a.amount, 0)
                     )}
                   </p>
                </div>
              </div>

              <div className="p-10 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
                <button 
                  onClick={() => {
                    handleEdit(viewingEmployee);
                    setViewingEmployee(null);
                  }}
                  className="px-8 py-4 bg-white border border-gray-200 text-blue-600 font-black rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm flex items-center gap-2"
                >
                  <Edit2 className="w-5 h-5" />
                  تعديل البيانات
                </button>
                <button 
                  onClick={() => setViewingEmployee(null)}
                  className="px-10 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-gray-200"
                >
                  حسناً، فهمت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: any; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="space-y-1.5 px-1">
    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={cn(
      "font-black text-sm transition-colors",
      highlight ? "text-blue-600 text-base" : "text-gray-900 hover:text-blue-600"
    )}>
      {value || <span className="text-gray-300 font-normal italic">غير متوفر</span>}
    </p>
  </div>
);

const X = (props: any) => <MoreVertical {...props} />;
