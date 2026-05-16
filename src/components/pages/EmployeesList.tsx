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
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export const EmployeesList: React.FC<{ filterClassification?: EmployeeCategory }> = ({ filterClassification: initialFilterClassification }) => {
  const { employees, allowanceTypes, branches, sectors, managements, costCenterDepts, leaves } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<EmployeeCategory | 'Out of Sponsorship' | 'All'>(initialFilterClassification || 'Standard');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'All'>('Active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string | 'bulk', show: boolean }>({ id: '', show: false });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPrintMonth, setSelectedPrintMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isPrinting, setIsPrinting] = useState(false);

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
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const data = (statusFilter === 'Leave' ? filteredEmployees : employees).map((emp, index) => {
      const allowancesTotal = (emp.housingAllowance || 0) + 
        (emp.transportAllowance || 0) + 
        (emp.subsistenceAllowance || 0) + 
        (emp.otherAllowances || 0) + 
        (emp.mobileAllowance || 0) + 
        (emp.managementAllowance || 0) +
        (emp.allowances || []).reduce((sum, a) => sum + a.amount, 0);

      const totalSalary = (emp.basicSalary || 0) + allowancesTotal;
      
      let netSalary = totalSalary;
      let workDaysThisMonth = daysInMonth;

      if (emp.status === 'Leave') {
        const activeLeave = leaves.find(l => l.employeeId === emp.id && l.status === 'Active');
        if (activeLeave) {
          const leaveStart = new Date(activeLeave.startDate);
          if (leaveStart.getFullYear() < currentYear || (leaveStart.getFullYear() === currentYear && leaveStart.getMonth() < currentMonth)) {
            netSalary = 0;
            workDaysThisMonth = 0;
          } else if (leaveStart.getFullYear() === currentYear && leaveStart.getMonth() === currentMonth) {
            workDaysThisMonth = leaveStart.getDate() - 1;
            netSalary = (totalSalary / daysInMonth) * workDaysThisMonth;
          }
        } else {
          // If no leave record found but status is leave, assume 0 for safety or full? 
          // Usually better to assume 0 as per user request if they are on leave.
          netSalary = 0;
          workDaysThisMonth = 0;
        }
      }

      if (statusFilter === 'Leave') {
        return {
          'الموظف': emp.name,
          'الرقم الوظيفي': emp.employeeId,
          'الجنسية': emp.nationality || '',
          'صاحب العمل': emp.officialEmployer || '',
          'القطاع': emp.sectors || '',
          'مركز التكلفة/الرئيسي': emp.sectorManagement || '',
          'الحالة': 'في إجازة',
          'الأساسي': emp.basicSalary,
          'البدلات': allowancesTotal,
          'الإجمالي': totalSalary,
          'أيام العمل': workDaysThisMonth,
          'صافي الراتب': Math.round(netSalary)
        };
      }

      return {
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
        'المجموع': totalSalary,
        'أيام العمل هذا الشهر': workDaysThisMonth,
        'صافي الراتب المتوقع': Math.round(netSalary),
        'عدد ساعات العمل': emp.dailyWorkHours || 8,
        'تصنيف التوظيف': emp.classification === 'Standard' ? 'موظف عادي' : 
                         emp.classification === 'Saudi' ? 'سعودي' : 
                         emp.classification === 'Accounting' ? 'محاسبات' : 'موظف عادي',
        'نوع استلام الراتب': emp.paymentMethod === 'Bank' ? 'استلام البنك' : 'استلام الكاش',
        'حالة الموظف': emp.status === 'Active' ? 'نشط' : 
                      emp.status === 'Leave' ? 'إجازة' :
                      emp.status === 'End of Service' ? 'انهاء خدمات' :
                      emp.status === 'Out of Sponsorship' ? 'خارج الكفالة' : 'نشط'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, statusFilter === 'Leave' ? "On Leave Employees" : "Employees");
    XLSX.writeFile(wb, statusFilter === 'Leave' ? "On_Leave_Employees_Report.xlsx" : "Employees_Master.xlsx");
  };

  const handleExportUpdateTemplate = () => {
    // Sort all employees by employeeId numerically
    const sortedEmployees = [...employees].sort((a, b) => {
      const idA = parseInt(a.employeeId || '0', 10);
      const idB = parseInt(b.employeeId || '0', 10);
      if (isNaN(idA) || isNaN(idB)) {
        return (a.employeeId || '').localeCompare(b.employeeId || '');
      }
      return idA - idB;
    });

    const data = sortedEmployees.map(emp => ({
      'رقم الموظف': emp.employeeId || '',
      'اسم الموظف': emp.name,
      'طريقه استلام الراتب': emp.paymentMethod === 'Bank' ? 'بنك' : 'كاش'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees Update");
    XLSX.writeFile(wb, "Employees_Full_Update.xlsx");
  };

  const handleImportUpdatedData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataArr = evt.target?.result;
        const wb = XLSX.read(dataArr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const batch = writeBatch(db);
        let updatedCount = 0;

        data.forEach((row) => {
          const empId = String(row['رقم الموظف'] || row['الرقم الوظيفي'] || '');
          if (!empId) return;

          // Find existing employee by employeeId
          const existingEmp = employees.find(e => e.employeeId === empId);
          if (existingEmp) {
            const docRef = firestoreDoc(db, 'employees', existingEmp.id);
            
            const updates: any = {};
            if (row['اسم الموظف'] || row['الإسم']) {
              updates.name = row['اسم الموظف'] || row['الإسم'];
            }
            
            const pMethodRaw = String(row['طريقه استلام الراتب'] || '').trim();
            if (pMethodRaw === 'كاش' || pMethodRaw.toLowerCase() === 'cash') {
              updates.paymentMethod = 'Cash';
            } else if (pMethodRaw === 'بنك' || pMethodRaw.toLowerCase() === 'bank') {
              updates.paymentMethod = 'Bank';
            }

            if (Object.keys(updates).length > 0) {
              batch.update(docRef, updates);
              updatedCount++;
            }
          }
        });

        if (updatedCount > 0) {
          await batch.commit();
          alert(`تم تحديث ${updatedCount} موظف بنجاح`);
        } else {
          alert('لم يتم العثور على موظفين مطابقين للتحديث');
        }
        setIsUpdateModalOpen(false);
      } catch (error) {
        console.error('Import error:', error);
        alert('حدث خطأ أثناء استيراد البيانات');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePrintPDF = () => {
    setIsPrinting(true);
    const [year, month] = selectedPrintMonth.split('-').map(Number);
    const monthName = format(new Date(year, month - 1), 'MMMM yyyy', { locale: undefined }); // Using default is fine or manually map
    const monthLongAr = new Intl.DateTimeFormat('ar-SA', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1));
    const daysInMonth = new Date(year, month, 0).getDate();

    const printContent = document.createElement('div');
    printContent.dir = 'rtl';
    printContent.className = 'p-4 bg-white';
    
    const header = `
      <div style="background: linear-gradient(135deg, #1e3a8a, #312e81); border-radius: 24px; padding: 40px; color: white; margin-bottom: 30px; position: relative; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(30, 58, 138, 0.3);">
        <div style="position: relative; z-index: 10;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="text-align: right;">
              <h1 style="font-size: 32px; font-weight: 900; margin: 0; letter-spacing: -0.025em; color: #fff;">سجل الموظفين والرواتب</h1>
              <p style="font-size: 16px; font-weight: bold; margin-top: 8px; opacity: 0.9; color: #bfdbfe;">تقرير شامل - لشهر ${monthLongAr}</p>
            </div>
            <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2);">
              <span style="font-size: 30px; font-weight: 900;">SR</span>
            </div>
          </div>
          <div style="display: flex; gap: 20px; border-top: 1px solid rgba(255,255,255,0.1); pt-20px; margin-top: 20px; padding-top: 20px;">
            <div>
              <p style="font-size: 11px; font-weight: 900; color: rgba(255,255,255,0.5); margin: 0; margin-bottom: 4px;">إجمالي الموظفين المشمولين</p>
              <p style="font-size: 18px; font-weight: 900; margin: 0; color: white;">${filteredEmployees.length} موظف</p>
            </div>
            <div style="flex-grow: 1;"></div>
            <div style="text-align: left;">
              <p style="font-size: 11px; font-weight: 900; color: rgba(255,255,255,0.5); margin: 0; margin-bottom: 4px;">تاريخ إصدار التقرير</p>
              <p style="font-size: 14px; font-weight: bold; margin: 0; color: white;">${format(new Date(), 'yyyy-MM-dd')}</p>
            </div>
          </div>
        </div>
        <div style="position: absolute; top: -50px; left: -50px; width: 250px; height: 250px; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); border-radius: 50%;"></div>
      </div>
    `;

    const tableRows = filteredEmployees.map(emp => {
      const allowancesTotal = (emp.housingAllowance || 0) + 
        (emp.transportAllowance || 0) + 
        (emp.subsistenceAllowance || 0) + 
        (emp.managementAllowance || 0) + 
        (emp.mobileAllowance || 0) + 
        (emp.otherAllowances || 0) +
        (emp.allowances || []).reduce((sum, a) => sum + a.amount, 0);

      const totalSalary = (emp.basicSalary || 0) + allowancesTotal;
      
      let workDays = daysInMonth;
      let netSalary = totalSalary;

      if (emp.status === 'Leave') {
        const activeLeave = leaves.find(l => l.employeeId === emp.id && l.status === 'Active');
        if (activeLeave) {
          const leaveStart = new Date(activeLeave.startDate);
          const targetDate = new Date(year, month - 1, 1);
          
          if (leaveStart < targetDate) {
            workDays = 0;
            netSalary = 0;
          } else if (leaveStart.getMonth() === targetDate.getMonth() && leaveStart.getFullYear() === targetDate.getFullYear()) {
            workDays = leaveStart.getDate() - 1;
            netSalary = (totalSalary / daysInMonth) * workDays;
          }
        } else {
            workDays = 0;
            netSalary = 0;
        }
      }

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
          <td style="padding: 16px; border-right: 4px solid ${emp.status === 'Leave' ? '#3b82f6' : 'transparent'};">
            <div style="font-weight: 900; color: #1e293b; font-size: 14px;">${emp.name}</div>
            <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-top: 4px;">${emp.jobTitle}</div>
          </td>
          <td style="padding: 16px; font-weight: 800; color: #1e3a8a; text-align: center;">${emp.employeeId}</td>
          <td style="padding: 16px; font-weight: 600; color: #475569; text-align: center;">${emp.nationality || '---'}</td>
          <td style="padding: 16px; font-size: 11px; color: #475569; text-align: right;">${emp.sectorManagement || '---'}</td>
          <td style="padding: 16px; font-size: 11px; color: #475569; text-align: right;">${emp.sectors || '---'}</td>
          <td style="padding: 16px; font-size: 11px; color: #475569; text-align: right;">${emp.costCenterMain || '---'}</td>
          <td style="padding: 16px; font-size: 11px; color: #64748b; text-align: right; max-width: 100px;">${emp.costCenterDept || '---'}</td>
          <td style="padding: 16px; text-align: center;">
            <span style="padding: 6px 12px; border-radius: 10px; font-size: 10px; font-weight: 900; background: ${(emp.status === 'Active' || emp.status === 'Out of Sponsorship (Active)') ? '#f0fdf4' : (emp.status === 'Leave' || emp.status === 'Out of Sponsorship (Leave)') ? '#eff6ff' : '#fef2f2'}; color: ${(emp.status === 'Active' || emp.status === 'Out of Sponsorship (Active)') ? '#15803d' : (emp.status === 'Leave' || emp.status === 'Out of Sponsorship (Leave)') ? '#1d4ed8' : '#b91c1c'}; border: 1px solid ${(emp.status === 'Active' || emp.status === 'Out of Sponsorship (Active)') ? '#dcfce7' : (emp.status === 'Leave' || emp.status === 'Out of Sponsorship (Leave)') ? '#dbeafe' : '#fee2e2'};">
              {emp.status === 'Active' ? 'نشط' : 
               emp.status === 'Leave' ? 'إجازة' : 
               emp.status === 'Out of Sponsorship' ? 'خارج الكفالة' : 
               emp.status === 'Out of Sponsorship (Active)' ? 'خارج الكفالة (نشط)' :
               emp.status === 'Out of Sponsorship (Leave)' ? 'خارج الكفالة (إجازة)' :
               'انهاء خدمة'}
            </span>
          </td>
          <td style="padding: 16px; text-align: center; font-size: 12px; font-weight: bold; color: #475569;">${emp.lastDirectDate || '---'}</td>
          <td style="padding: 16px; text-align: center; font-weight: 600;">${emp.basicSalary}</td>
          <td style="padding: 16px; text-align: center; font-weight: 600;">${allowancesTotal}</td>
          <td style="padding: 16px; text-align: center; font-weight: 900;">${totalSalary}</td>
          <td style="padding: 16px; text-align: center; font-weight: 900; color: #1e3a8a; background: #f8fafc;">${Math.round(netSalary)}</td>
        </tr>
      `;
    }).join('');

    const table = `
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; text-align: right; direction: rtl;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: right; border-bottom: 2px solid #e2e8f0; font-size: 12px; width: 220px;">الموظف / المهنة</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 12px;">م</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 12px;">الجنسية</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 10px;">ادارة القطاع</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 10px;">القطاعات</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 10px;">مركز التكلفة / رئيسي</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 10px;">مركز التكلفة / قسم</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 12px;">الحالة</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 12px;">آخر مباشرة</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 12px;">الأطاسي</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 12px;">البدلات</th>
            <th style="padding: 20px; font-weight: 900; color: #64748b; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 12px;">الإجمالي</th>
            <th style="padding: 20px; font-weight: 900; color: #1e3a8a; text-align: center; border-bottom: 2px solid #e2e8f0; font-size: 12px; background: #f1f5f9;">صافي الراتب</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    printContent.innerHTML = header + table;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>تقرير الموظفين - ${monthLongAr}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
              body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 20px; background: white; -webkit-print-color-adjust: exact; }
              @page { size: landscape; margin: 1cm; }
              @media print {
                body { padding: 0; margin: 0; }
              }
            </style>
          </head>
          <body dir="rtl">
            ${printContent.outerHTML}
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    setIsPrinting(false);
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
        if (pMethodRaw === 'استلام الكاش' || pMethodRaw.includes('Cash')) {
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
        else if (statusRaw === 'خارج الكفالة (نشط)' || statusRaw === 'Out of Sponsorship (Active)') status = 'Out of Sponsorship (Active)';
        else if (statusRaw === 'خارج الكفالة (إجازة)' || statusRaw === 'Out of Sponsorship (Leave)') status = 'Out of Sponsorship (Leave)';

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
      if (classificationFilter === 'Standard') {
        result = result.filter(e => e.classification !== 'Saudi' && e.classification !== 'Accounting');
      } else if (classificationFilter === 'Out of Sponsorship') {
        result = result.filter(e => e.status === 'Out of Sponsorship');
      } else if (classificationFilter === 'Saudi') {
        result = result.filter(e => e.classification === 'Saudi');
      } else {
        result = result.filter(e => e.classification === (classificationFilter as EmployeeCategory));
      }
    }
    if (statusFilter !== 'All') {
      if (statusFilter === 'Out of Sponsorship') {
        result = result.filter(e => e.status?.startsWith('Out of Sponsorship'));
      } else {
        result = result.filter(e => e.status === statusFilter);
      }
    }
    
    // Sort by employeeId numerically ascending
    const sortedResult = [...result].sort((a, b) => {
      const idA = parseInt(a.employeeId || '0', 10);
      const idB = parseInt(b.employeeId || '0', 10);
      if (isNaN(idA) || isNaN(idB)) {
        return (a.employeeId || '').localeCompare(b.employeeId || '');
      }
      return idA - idB;
    });

    return sortedResult.filter(e => 
      (e.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.employeeId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.iqamaNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.jobTitle?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.sectorManagement?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm, classificationFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="ابحث بالاسم، الرقم الوظيفي، أو الإقامة..."
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
                "pr-10 pl-10 py-3 bg-white dark:bg-gray-900 border rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold shadow-sm appearance-none min-w-[220px] text-xs cursor-pointer",
                classificationFilter !== 'All' 
                  ? "border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 bg-blue-50/10 dark:bg-blue-900/20" 
                  : "border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <option value="All">تصنيف الموظف (الكل)</option>
              <option value="Standard">موظف عادي</option>
              <option value="Saudi">السعوديين</option>
              <option value="Accounting">رواتب المحاسبات</option>
              <option value="Out of Sponsorship">خارج الكفالة</option>
            </select>
            <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-gray-600" />
          </div>
          <div className="relative group">
            <User className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
              statusFilter !== 'All' ? "text-blue-600" : "text-gray-400"
            )} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={cn(
                "pr-10 pl-10 py-3 bg-white dark:bg-gray-900 border rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold shadow-sm appearance-none min-w-[140px] text-xs cursor-pointer",
                statusFilter !== 'All' 
                  ? "border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 bg-blue-50/10 dark:bg-blue-900/20" 
                  : "border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <option value="All">حالة الموظف (الكل)</option>
              <option value="Active">نشط</option>
              <option value="Leave">إجازة</option>
              <option value="End of Service">إنهاء خدمات</option>
              <option value="Out of Sponsorship">خارج الكفالة</option>
            </select>
            <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-gray-600" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button 
              onClick={() => setDeleteConfirm({ id: 'bulk', show: true })}
              className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all shadow-sm shadow-red-200/20 dark:shadow-none"
            >
              <Trash2 className="w-5 h-5" />
              <span>حذف المحدد ({selectedIds.length})</span>
            </button>
          )}
          <label className="cursor-pointer p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2 font-bold">
            <Upload className="w-5 h-5" />
            <span className="hidden md:inline">استيراد</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
          </label>
          <button 
            onClick={handleExportExcel}
            className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2 font-bold"
            title="تصدير الكل"
          >
            <Download className="w-5 h-5" />
            <span className="hidden md:inline">تصدير</span>
          </button>
          <button 
            onClick={() => setIsUpdateModalOpen(true)}
            className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors shadow-sm flex items-center gap-2 font-bold"
            title="تحديث البيانات"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="hidden md:inline">تحديث البيانات (Excel)</span>
          </button>
          <button 
            onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/20"
          >
            <UserPlus className="w-5 h-5" />
            <span>إضافة موظف</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-5 text-right w-12">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-blue-600 focus:ring-blue-500"
                    checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">اسم الموظف</th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">الجنسية</th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">القطاع</th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">رقم الإقامة</th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">تاريخ آخر مباشرة</th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">المرتب الأساسي</th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">إجمالي المرتب</th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">حالة الموظف</th>
                <th className="px-6 py-5 text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredEmployees.map((emp) => {
                const totalSalary = (emp.basicSalary || 0) + 
                                   (emp.housingAllowance || 0) + 
                                   (emp.transportAllowance || 0) + 
                                   (emp.subsistenceAllowance || 0) + 
                                   (emp.otherAllowances || 0) + 
                                   (emp.mobileAllowance || 0) + 
                                   (emp.managementAllowance || 0) +
                                   (emp.allowances || []).reduce((sum, a) => sum + a.amount, 0);

                return (
                    <tr 
                      key={emp.id} 
                      className={cn(
                        "transition-colors group text-right border-b border-gray-50 dark:border-gray-800",
                        (emp.status === 'Leave' || emp.status === 'Out of Sponsorship (Leave)')
                          ? "bg-gradient-to-br from-blue-900 to-blue-950 text-white hover:from-blue-800 hover:to-blue-900" 
                          : (emp.status === 'End of Service')
                          ? "bg-gradient-to-br from-red-900 to-red-950 text-white hover:from-red-800 hover:to-red-900"
                          : "hover:bg-gray-50/50 dark:hover:bg-gray-800/50",
                        selectedIds.includes(emp.id) && (
                          (emp.status === 'Leave' || emp.status === 'Out of Sponsorship (Leave)') ? "ring-2 ring-white/30" : 
                          emp.status === 'End of Service' ? "ring-2 ring-white/30" : 
                          "bg-blue-50/30 dark:bg-blue-900/20"
                        )
                      )}
                    >
                    <td className="px-6 py-5">
                      <input 
                        type="checkbox" 
                        className={cn(
                          "w-5 h-5 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-blue-600 focus:ring-blue-500",
                          emp.status === 'Leave' && "border-white/30 bg-blue-800/50"
                        )}
                        checked={selectedIds.includes(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3 text-right">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                          (emp.status === 'Leave' || emp.status === 'End of Service')
                            ? "bg-white/10 text-white border border-white/20" 
                            : "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                        )}>
                          {emp.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className={cn(
                            "font-black truncate max-w-[180px]",
                            (emp.status === 'Leave' || emp.status === 'End of Service') ? "text-white" : "text-gray-900 dark:text-white"
                          )}>{emp.name}</p>
                          <p className={cn(
                            "text-[10px] font-bold tracking-wider",
                            emp.status === 'Leave' ? "text-blue-300" : 
                            emp.status === 'End of Service' ? "text-red-300" : 
                            "text-gray-400 dark:text-gray-500"
                          )}>#{emp.employeeId || '---'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "font-bold text-sm",
                        emp.status === 'Leave' ? "text-blue-100" : 
                        emp.status === 'End of Service' ? "text-red-100" : 
                        "text-gray-600 dark:text-gray-400"
                      )}>{emp.nationality || '---'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-xs font-black border inline-block",
                        (emp.status === 'Leave' || emp.status === 'End of Service')
                          ? "bg-white/10 text-white border-white/20" 
                          : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/20"
                      )}>
                        {emp.sectors || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "font-bold text-sm font-mono",
                        emp.status === 'Leave' ? "text-blue-200" : 
                        emp.status === 'End of Service' ? "text-red-200" : 
                        "text-gray-600 dark:text-gray-400"
                      )}>{emp.iqamaNumber || '---'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "font-bold text-sm whitespace-nowrap",
                        emp.status === 'Leave' ? "text-blue-200" : 
                        emp.status === 'End of Service' ? "text-red-200" : 
                        "text-gray-600 dark:text-gray-400"
                      )}>{emp.lastDirectDate || '---'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "font-black text-sm",
                        (emp.status === 'Leave' || emp.status === 'End of Service') ? "text-white" : "text-gray-900 dark:text-white"
                      )}>{formatCurrency(emp.basicSalary)}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "font-black text-sm",
                        emp.status === 'Leave' ? "text-blue-200" : 
                        emp.status === 'End of Service' ? "text-red-200" : 
                        "text-blue-600 dark:text-blue-400"
                      )}>{formatCurrency(totalSalary)}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap border",
                        (emp.status === 'Active' || emp.status === 'Out of Sponsorship (Active)') ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 font-black" :
                        (emp.status === 'Leave' || emp.status === 'Out of Sponsorship (Leave)' || emp.status === 'End of Service') ? "bg-white/10 text-white border-white/30" :
                        "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-100"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", 
                          (emp.status === 'Active' || emp.status === 'Out of Sponsorship (Active)') ? "bg-emerald-500" :
                          (emp.status === 'Leave' || emp.status === 'Out of Sponsorship (Leave)' || emp.status === 'End of Service') ? "bg-white" :
                          "bg-gray-400"
                        )} />
                        {emp.status === 'Active' ? 'نشط' : 
                         emp.status === 'Leave' ? 'إجازة' : 
                         emp.status === 'Out of Sponsorship (Active)' ? 'خارج الكفالة (نشط)' :
                         emp.status === 'Out of Sponsorship (Leave)' ? 'خارج الكفالة (إجازة)' :
                         emp.status === 'Out of Sponsorship' ? 'خارج الكفالة' :
                         emp.status === 'End of Service' ? 'إنهاء خدمات' : 'غير نشط'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => setViewingEmployee(emp)}
                          className={cn(
                            "p-2 rounded-xl transition-all hover:scale-110",
                            (emp.status === 'Leave' || emp.status === 'End of Service') ? "text-white hover:bg-white/10" : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          )}
                          title="عرض"
                        >
                          <User className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEdit(emp)}
                          className={cn(
                            "p-2 rounded-xl transition-all hover:scale-110",
                            (emp.status === 'Leave' || emp.status === 'End of Service') ? "text-white hover:bg-white/10" : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          )}
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: emp.id, show: true })}
                          className={cn(
                            "p-2 rounded-xl transition-all hover:scale-110",
                            (emp.status === 'Leave' || emp.status === 'End of Service') ? "text-white hover:bg-white/10" : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          )}
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
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
              className="relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                  {editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors">
                  <CloseIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">تصنيف الموظف</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right text-gray-900 dark:text-white appearance-none"
                      value={formData.classification || 'Standard'}
                      onChange={(e) => setFormData({...formData, classification: e.target.value as any})}
                    >
                      <option value="Standard">موظف عادي</option>
                      <option value="Saudi">السعوديين</option>
                      <option value="Accounting">رواتب المحاسبات</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الرقم الوظيفي</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.employeeId || ''}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الإسم</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">رقم الإقامة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.iqamaNumber || ''}
                      onChange={(e) => setFormData({...formData, iqamaNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">تاريخ انتهاء الإقامة</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.iqamaExpiryDate || ''}
                      onChange={(e) => setFormData({...formData, iqamaExpiryDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">صاحب العمل الرسمي</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right text-gray-900 dark:text-white appearance-none"
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
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الجنسية</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.nationality || ''}
                      onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الوظيفة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.jobTitle || ''}
                      onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">المهنة حسب الاقامة</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.professionAsPerIqama || ''}
                      onChange={(e) => setFormData({...formData, professionAsPerIqama: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">بداية العمل</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.joinDate || ''}
                      onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">آخر مباشرة</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.lastDirectDate || ''}
                      onChange={(e) => setFormData({...formData, lastDirectDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">ادارة القطاع</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right text-gray-900 dark:text-white appearance-none"
                      value={formData.sectorManagement || ''}
                      onChange={(e) => setFormData({...formData, sectorManagement: e.target.value})}
                    >
                      <option value="">اختر ادارة القطاع</option>
                      {managements.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                      {!managements.some(m => m.name === formData.sectorManagement) && formData.sectorManagement && (
                        <option value={formData.sectorManagement}>{formData.sectorManagement}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">القطاعات</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right text-gray-900 dark:text-white appearance-none"
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
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">مركز التكلفة / رئيسي</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.costCenterMain || ''}
                      onChange={(e) => setFormData({...formData, costCenterMain: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">مركز التكلفة / قسم</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right text-gray-900 dark:text-white appearance-none"
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
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الموقع</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">نوع استلام الراتب</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-right text-gray-900 dark:text-white appearance-none"
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                    >
                      <option value="Bank">استلام بنك</option>
                      <option value="Cash">استلام الكاش</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">ساعات العمل اليومية</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.dailyWorkHours ?? 8}
                      onChange={(e) => setFormData({...formData, dailyWorkHours: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">كود البنك</label>
                    <input 
                      placeholder="مثال: NCBK, RJHI"
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
                      value={formData.bankCode || ''}
                      onChange={(e) => setFormData({...formData, bankCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الايبــــــــــان</label>
                    <input 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white text-left"
                      value={formData.bankAccount || ''}
                      onChange={(e) => setFormData({...formData, bankAccount: e.target.value})}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الراتب الاساسي</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.basicSalary ?? 0}
                      onChange={(e) => setFormData({...formData, basicSalary: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">بدل سكن</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
                      value={formData.housingAllowance ?? 0}
                      onChange={(e) => setFormData({...formData, housingAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل نقل</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.transportAllowance ?? 0}
                      onChange={(e) => setFormData({...formData, transportAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل إعاشه</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.subsistenceAllowance ?? 0}
                      onChange={(e) => setFormData({...formData, subsistenceAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل جوال</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.mobileAllowance ?? 0}
                      onChange={(e) => setFormData({...formData, mobileAllowance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدل ادارة</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.managementAllowance ?? 0}
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
                      <option value="Out of Sponsorship (Active)">خارج الكفالة (نشط)</option>
                      <option value="Out of Sponsorship (Leave)">خارج الكفالة (إجازة)</option>
                      <option value="Out of Sponsorship">خارج الكفالة (أخرى)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2">بدلات اخرى</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      value={formData.otherAllowances ?? 0}
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
                            value={allowance.type || ''}
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
                            value={allowance.amount ?? 0}
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
                  <DetailItem label="ادارة القطاع" value={viewingEmployee.sectorManagement} />
                  <DetailItem label="القطاعات" value={viewingEmployee.sectors} />
                  <DetailItem label="مركز التكلفة / رئيسي" value={viewingEmployee.costCenterMain} />
                  <DetailItem label="مركز التكلفة / قسم" value={viewingEmployee.costCenterDept} />
                  <DetailItem label="الموقع" value={viewingEmployee.location} />
                  <DetailItem label="طريقة الدفع" value={viewingEmployee.paymentMethod === 'Bank' ? 'بنك' : 'الكاش'} />
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

      <AnimatePresence>
        {isUpdateModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUpdateModalOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-emerald-50/30 dark:bg-emerald-900/10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">تحديث الموظفين عبر Excel</h3>
                </div>
                <button onClick={() => setIsUpdateModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors">
                  <CloseIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-bold mb-4">
                    الخطوة 1: قم بتحميل ملف البيانات الحالي للتعديل عليه
                  </p>
                  <button 
                    onClick={handleExportUpdateTemplate}
                    className="w-full py-4 bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 font-black rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-95"
                  >
                    <Download className="w-5 h-5" />
                    تصدير كافة الموظفين (للتعديل)
                  </button>
                  <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-3 text-center font-bold">
                    سيتم ترتيب الموظفين حسب الرقم الوظيفي تصاعدياً
                  </p>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 font-bold mb-4">
                    الخطوة 2: ارفع الملف بعد التعديل لتم التحديث
                  </p>
                  <label className="flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed border-emerald-200 dark:border-emerald-900/50 rounded-[2rem] bg-white dark:bg-gray-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-sm font-black text-gray-700 dark:text-gray-300">اضغط لرفع الملف المحدث</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1 font-bold">Excel (.xlsx, .xls)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".xlsx, .xls" 
                      onChange={handleImportUpdatedData} 
                    />
                  </label>
                </div>
              </div>

              <div className="p-8 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                <button 
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-12 py-4 bg-gray-900 dark:bg-black text-white font-black rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-gray-200 dark:shadow-none"
                >
                  إغلاق النافذة
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
