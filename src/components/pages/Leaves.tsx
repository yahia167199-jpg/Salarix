import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, 
  Plus, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Filter,
  ArrowLeftRight,
  MoreVertical,
  Check,
  X,
  Bell,
  Download,
  Upload,
  Printer,
  FileSpreadsheet,
  Edit2,
  User
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  orderBy,
  where,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { Employee, Leave } from '../../types';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const Leaves: React.FC = () => {
  const { employees, companySettings } = useData();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'History' | 'Balances' | 'ActiveLeaves'>('ActiveLeaves');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Completed'>('Active');
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [selectedLeaveForReturn, setSelectedLeaveForReturn] = useState<any>(null);
  const [actualReturnDate, setActualReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [dismissedAlerts, setDismissedAlerts] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
  });

  const leaveDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [formData.startDate, formData.endDate]);

  useEffect(() => {
    const q = query(collection(db, 'leaves'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leavesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Leave[];
      setLeaves(leavesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const activeEmployees = useMemo(() => 
    employees.filter(e => e.status === 'Active'), 
    [employees]
  );

  const pendingReturns = useMemo(() => {
    return leaves.filter(l => {
      if (l.status !== 'Active' || !l.endDate) return false;
      const end = new Date(l.endDate);
      if (isNaN(end.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = end.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Return true if ended, ends today, or ends in next 3 days
      return diffDays <= 3;
    });
  }, [leaves]);

  useEffect(() => {
    if (pendingReturns.length > 0 && !dismissedAlerts) {
      const timer = setTimeout(() => setShowToast(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [pendingReturns.length, dismissedAlerts]);

  const calculateActualWorkDays = (lastDirectDate?: string) => {
    if (!lastDirectDate) return 0;
    const start = new Date(lastDirectDate);
    if (isNaN(start.getTime())) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = today.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const handleExportBalances = () => {
    const data = employees.map(emp => {
      const joinDate = emp.joinDate ? new Date(emp.joinDate) : null;
      const isValidJoinDate = joinDate && !isNaN(joinDate.getTime());
      const diffTime = isValidJoinDate ? Math.abs(new Date().getTime() - joinDate.getTime()) : 0;
      const serviceDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const totalAccrued = isValidJoinDate ? (serviceDays / 365) * 21 : 0;
      
      const systemUsed = leaves
        .filter(l => l.employeeId === emp.id && l.status === 'Completed')
        .reduce((acc, curr) => {
          const start = new Date(curr.startDate);
          const end = new Date(curr.endDate);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return acc;
          const diff = Math.abs(end.getTime() - start.getTime());
          return acc + (Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
        }, 0);

      const balance = calculateActualWorkDays(emp.lastDirectDate);

      return {
        'رقم الموظف': emp.employeeId,
        'اسم الموظف': emp.name,
        'رقم الهوية': emp.iqamaNumber,
        'تاريخ التعيين': emp.joinDate,
        'أيام العمل': serviceDays,
        'الرصيد التراكمي': totalAccrued.toFixed(1),
        'مستهلك من النظام': systemUsed,
        'رصيد مستهلك سابق': emp.usedLeaveDays || 0,
        'أيام العمل الفعلية من تاريخ آخر مباشرة': balance
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'أرصدة الإجازات');
    XLSX.writeFile(wb, `أرصدة_الإجازات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleImportBalances = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      setLoading(true);
      let successCount = 0;

      for (const row of data) {
        const empId = row['رقم الموظف']?.toString();
        const iqama = row['رقم الهوية']?.toString();
        const newRemainingBalance = parseFloat(row['الرصيد المتبقي']);

        if (isNaN(newRemainingBalance)) continue;

        const employee = employees.find(e => e.employeeId === empId || e.iqamaNumber === iqama);
        if (employee) {
          // Calculate what manualUsed should be to result in this imported balance
          const joinDate = new Date(employee.joinDate);
          const serviceDays = Math.ceil(Math.abs(new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
          const accrued = (serviceDays / 365) * 21;
          
          const systemUsed = leaves
            .filter(l => l.employeeId === employee.id && l.status === 'Completed')
            .reduce((acc, curr) => {
              const start = new Date(curr.startDate);
              const end = new Date(curr.endDate);
              if (isNaN(start.getTime()) || isNaN(end.getTime())) return acc;
              const diff = Math.abs(end.getTime() - start.getTime());
              return acc + (Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
            }, 0);

          const neededManualUsed = accrued - systemUsed - newRemainingBalance;

          try {
            const empRef = doc(db, 'employees', employee.id);
            await updateDoc(empRef, {
              usedLeaveDays: Number(neededManualUsed.toFixed(1))
            });
            successCount++;
          } catch (err) {
            console.error('Error updating balance for', employee.name, err);
          }
        }
      }

      setLoading(false);
      alert(`تم تحديث أرصدة ${successCount} موظف بنجاح`);
    };
    reader.readAsBinaryString(file);
  };

  const handleExportOnLeave = () => {
    const onLeaveEmployees = employees.filter(e => e.status === 'Leave');
    const data = onLeaveEmployees.map(emp => {
      const leave = leaves.find(l => l.employeeId === emp.id && l.status === 'Active');
      return {
        'رقم الموظف': emp.employeeId,
        'اسم الموظف': emp.name,
        'تاريخ البداية': leave?.startDate || '',
        'تاريخ العودة المتوقعة': leave?.endDate || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المتواجدون في إجازة');
    XLSX.writeFile(wb, `المتواجدون_في_إجازة_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleImportOnLeave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      setLoading(true);
      let successCount = 0;

      for (const row of data) {
        const empId = row['رقم الموظف']?.toString();
        const startDate = row['تاريخ البداية']?.toString();
        const endDate = row['تاريخ العودة المتوقعة']?.toString();

        if (!empId || !startDate || !endDate) continue;

        const employee = employees.find(e => e.employeeId === empId);
        if (employee) {
          const leave = leaves.find(l => l.employeeId === employee.id && l.status === 'Active');
          if (leave) {
            try {
              const leaveRef = doc(db, 'leaves', leave.id);
              await updateDoc(leaveRef, {
                startDate: startDate,
                endDate: endDate,
                returnDate: endDate,
                updatedAt: serverTimestamp()
              });
              successCount++;
            } catch (err) {
              console.error('Error updating leave dates for', employee.name, err);
            }
          }
        }
      }

      setLoading(false);
      alert(`تم تحديث تواريخ ${successCount} موظف بنجاح`);
    };
    reader.readAsBinaryString(file);
  };

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      const emp = employees.find(e => e.id === l.employeeId);
      const matchesSearch = 
        l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp?.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp?.iqamaNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'All' || l.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [leaves, searchTerm, filterStatus, employees]);

  const stats = useMemo(() => {
    const active = leaves.filter(l => l.status === 'Active').length;
    const endingSoon = leaves.filter(l => {
      if (l.status !== 'Active' || !l.endDate) return false;
      const end = new Date(l.endDate);
      if (isNaN(end.getTime())) return false;
      const today = new Date();
      const diff = end.getTime() - today.getTime();
      const days = Math.ceil(diff / (1000 * 3600 * 24));
      return days <= 3 && days >= 0;
    }).length;

    const overdue = leaves.filter(l => {
      if (l.status !== 'Active' || !l.endDate) return false;
      const end = new Date(l.endDate);
      if (isNaN(end.getTime())) return false;
      const today = new Date();
      return end < today;
    }).length;

    return { active, endingSoon, overdue };
  }, [leaves]);

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.startDate) return;

    const employee = employees.find(emp => emp.id === formData.employeeId);
    if (!employee) return;

    try {
      if (selectedLeave) {
        // Update existing leave
        const leaveRef = doc(db, 'leaves', selectedLeave.id);
        await updateDoc(leaveRef, {
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          returnDate: formData.endDate || null,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new leave
        await addDoc(collection(db, 'leaves'), {
          employeeId: formData.employeeId,
          employeeName: employee.name,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          returnDate: formData.endDate || null,
          status: 'Active',
          createdAt: serverTimestamp()
        });

        // Update employee status
        const empRef = doc(db, 'employees', formData.employeeId);
        await updateDoc(empRef, {
          status: 'Leave'
        });
      }

      setIsModalOpen(false);
      setSelectedLeave(null);
      setFormData({ employeeId: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '' });
    } catch (error) {
      console.error('Error adding/editing leave:', error);
    }
  };

  const handleEditLeave = (leave: Leave) => {
    setSelectedLeave(leave);
    setFormData({
      employeeId: leave.employeeId,
      startDate: leave.startDate,
      endDate: leave.endDate
    });
    setIsModalOpen(true);
  };

  const handleDeleteTestLeaves = async () => {
    const testLeaves = leaves.filter(l => 
      l.employeeName.toLowerCase().includes('test') || 
      l.employeeName.includes('تجربة')
    );

    if (testLeaves.length === 0) {
      alert('لا توجد بيانات تجريبية للمسح');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من مسح السجل التجريبي (${testLeaves.length} إجازة)؟`)) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      testLeaves.forEach(leave => {
        batch.delete(doc(db, 'leaves', leave.id));
      });

      await batch.commit();
      alert(`تم مسح ${testLeaves.length} إجازة من السجل بنجاح`);
    } catch (error) {
      console.error('Error deleting test leaves:', error);
      alert('حدث خطأ أثناء مسح البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReturn = (leaveOrEmp: Leave | Employee) => {
    if ('startDate' in leaveOrEmp) {
      setSelectedLeaveForReturn(leaveOrEmp);
    } else {
      setSelectedLeaveForReturn({
        id: 'manual',
        employeeId: leaveOrEmp.id,
        employeeName: leaveOrEmp.name,
        startDate: '',
        endDate: '',
        returnDate: '',
        status: 'Active',
        createdAt: new Date().toISOString()
      });
    }
    setActualReturnDate(format(new Date(), 'yyyy-MM-dd'));
    setIsReturnModalOpen(true);
  };

  const finishReturn = async () => {
    if (!selectedLeaveForReturn) return;

    try {
      // 1. Update leave status if it's a real leave record
      if (selectedLeaveForReturn.id !== 'manual') {
        const leaveRef = doc(db, 'leaves', selectedLeaveForReturn.id);
        await updateDoc(leaveRef, {
          status: 'Completed',
          returnDate: actualReturnDate,
          updatedAt: serverTimestamp()
        });
      } else {
        // Mark any existing active leaves for this employee as completed if confirming manually
        const q = query(
          collection(db, 'leaves'), 
          where('employeeId', '==', selectedLeaveForReturn.employeeId),
          where('status', '==', 'Active')
        );
        // This is a bit complex for a simple finishReturn, but let's assume we just update status and lastDirectDate
      }

      // 2. Update employee status and last direct date
      const empRef = doc(db, 'employees', selectedLeaveForReturn.employeeId);
      await updateDoc(empRef, {
        status: 'Active',
        lastDirectDate: actualReturnDate
      });

      setIsReturnModalOpen(false);
      setSelectedLeaveForReturn(null);
    } catch (error) {
      console.error('Error confirming return:', error);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && pendingReturns.length > 0 && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed bottom-8 left-8 z-[200] max-w-sm w-full pointer-events-auto"
            dir="rtl"
          >
            <div className="bg-white/90 backdrop-blur-xl border-2 border-amber-100 rounded-[2.5rem] p-6 shadow-2xl shadow-amber-200/40 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-1 bg-amber-500 h-full" />
              <button 
                onClick={() => setShowToast(false)}
                className="absolute top-6 left-6 p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
                title="إغلاق التنبيه"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex gap-5">
                <div className="w-16 h-16 bg-amber-100 rounded-[1.5rem] flex items-center justify-center text-amber-600 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                  <Bell className="w-8 h-8" />
                </div>
                <div className="pl-6">
                  <h4 className="font-black text-gray-900 text-lg leading-tight mb-1">تنبيه المراجعة</h4>
                  <p className="text-sm font-bold text-gray-500">
                    هناك {pendingReturns.length} موظفين يقترب موعد عودتهم
                  </p>
                  
                  <div className="mt-5 space-y-2">
                    {pendingReturns.slice(0, 2).map(l => (
                      <div key={l.id} className="flex items-center justify-between bg-gray-50/50 p-2.5 rounded-2xl border border-gray-100/50">
                        <span className="text-sm font-black text-gray-700">{l.employeeName}</span>
                        <button 
                          onClick={() => {
                            handleConfirmReturn(l);
                            if (pendingReturns.length <= 1) setShowToast(false);
                          }}
                          className="text-xs font-black text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
                        >
                          تأكيد تاريخ المباشرة
                        </button>
                      </div>
                    ))}
                    {pendingReturns.length > 2 && (
                      <button 
                        onClick={() => {
                          setShowToast(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full text-center py-2 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        عرض جميع الموظفين ({pendingReturns.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Returns Alert */}
      <AnimatePresence>
        {pendingReturns.length > 0 && !dismissedAlerts && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-8 shadow-2xl shadow-amber-200/20 overflow-hidden relative"
          >
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-100 rounded-full blur-3xl opacity-50" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-amber-200 rounded-3xl flex items-center justify-center text-amber-700 shadow-inner ring-4 ring-amber-50">
                    <Bell className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-amber-900">إجراء مطلوب: متابعة عودة الموظفين</h3>
                    <p className="text-amber-700 font-bold max-w-2xl text-lg mt-1">
                      لديك {pendingReturns.length} موظفين تنتهي إجازاتهم قريباً أو انتهت بالفعل.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden lg:flex -space-x-4 space-x-reverse items-center bg-white/50 p-2 rounded-2xl border border-amber-200/50">
                    {pendingReturns.slice(0, 5).map((l, i) => (
                      <div 
                        key={i} 
                        className="w-12 h-12 rounded-2xl border-2 border-white bg-amber-600 flex items-center justify-center text-white text-sm font-black ring-2 ring-amber-100 shadow-lg group hover:-translate-y-1 transition-transform cursor-help"
                        title={l.employeeName}
                      >
                        {l.employeeName[0]}
                      </div>
                    ))}
                    {pendingReturns.length > 5 && (
                      <div className="w-12 h-12 rounded-2xl border-2 border-white bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-black ring-2 ring-amber-100 shadow-sm">
                        +{pendingReturns.length - 5}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setDismissedAlerts(true)}
                    className="p-4 text-amber-400 hover:text-amber-600 hover:bg-white rounded-3xl transition-all shadow-sm border border-transparent hover:border-amber-200"
                    title="إخفاء التنبيه"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {pendingReturns.slice(0, 4).map(l => {
                  const end = new Date(l.endDate);
                  const isOverdue = end < new Date();
                  return (
                    <div key={l.id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-amber-100 group hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]",
                          isOverdue ? "bg-red-500 animate-pulse" : "bg-amber-500"
                        )} />
                        <div>
                          <span className="font-black text-gray-800 block text-sm">{l.employeeName}</span>
                          <span className="text-[10px] font-bold text-gray-400">
                            {isOverdue ? "انتهت" : "تنتهي"} في: {l.endDate}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleConfirmReturn(l)}
                        className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-emerald-500/20 active:scale-90"
                        title="تأكيد تاريخ المباشرة"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full h-full bg-blue-600 hover:bg-blue-700 text-white rounded-3xl p-6 flex flex-col items-center justify-center gap-4 transition-all shadow-lg shadow-blue-200 group active:scale-95"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-xl font-black">إضافة إجازة</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
            <Plane className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400">إجازات نشطة</p>
            <h4 className="text-3xl font-black text-gray-900">{stats.active}</h4>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400">تنتهي قريباً</p>
            <h4 className="text-3xl font-black text-gray-900">{stats.endingSoon}</h4>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400">متأخرين</p>
            <h4 className="text-3xl font-black text-gray-900">{stats.overdue}</h4>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex bg-white p-1 rounded-[1.5rem] border border-gray-100 shadow-sm w-fit mb-4 overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveView('ActiveLeaves')}
          className={cn(
            "px-8 py-3 rounded-2xl font-black transition-all flex items-center gap-2 whitespace-nowrap",
            activeView === 'ActiveLeaves' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <Plane className="w-5 h-5" />
          المتواجدون في إجازة
        </button>
        <button
          onClick={() => setActiveView('History')}
          className={cn(
            "px-8 py-3 rounded-2xl font-black transition-all flex items-center gap-2 whitespace-nowrap",
            activeView === 'History' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <Clock className="w-5 h-5" />
          سجل الإجازات
        </button>
        <button
          onClick={() => setActiveView('Balances')}
          className={cn(
            "px-8 py-3 rounded-2xl font-black transition-all flex items-center gap-2 whitespace-nowrap",
            activeView === 'Balances' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <Users className="w-5 h-5" />
          أرصدة الموظفين
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="بحث بالاسم، الرقم الوظيفي، أو الهوية..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-right transition-all"
          />
        </div>
        
        <div className="flex bg-gray-50 p-1 rounded-2xl">
          {(['Active', 'Completed', 'All'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap",
                filterStatus === status 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              {status === 'Active' ? 'إجازات نشطة' : status === 'Completed' ? 'منتهية' : 'الكل'}
            </button>
          ))}
        </div>

        {activeView === 'Balances' && (
          <div className="flex gap-3">
            <button
              onClick={handleExportBalances}
              className="px-6 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-emerald-100"
            >
              <Download className="w-4 h-4" />
              تصدير الأرصدة
            </button>
            <label className="px-6 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-blue-100 cursor-pointer">
              <Upload className="w-4 h-4" />
              استيراد وتحديث
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleImportBalances}
              />
            </label>
          </div>
        )}

        {activeView === 'ActiveLeaves' && (
          <div className="flex gap-3">
            <button
              onClick={handleExportOnLeave}
              className="px-6 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-emerald-100"
            >
              <Download className="w-4 h-4" />
              تصدير المتواجدون
            </button>
            <label className="px-6 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-blue-100 cursor-pointer">
              <Upload className="w-4 h-4" />
              استيراد وتحديث التواريخ
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleImportOnLeave}
              />
            </label>
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-600 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-gray-100 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              طباعة القائمة
            </button>
          </div>
        )}

        {activeView === 'History' && (
          <button
            onClick={handleDeleteTestLeaves}
            disabled={loading}
            className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-red-100 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            مسح السجل
          </button>
        )}

      </div>

      {/* Main Content Areas */}
      {activeView === 'ActiveLeaves' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {employees
            .filter(e => e.status === 'Leave')
            .filter(e => {
              return e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                     (e.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                     (e.iqamaNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
            })
            .map((emp) => {
              const leave = leaves.find(l => l.employeeId === emp.id && l.status === 'Active');
              
              const end = leave ? new Date(leave.endDate) : null;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isValidDate = end && !isNaN(end.getTime());
              const diffTime = isValidDate ? end.getTime() - today.getTime() : 0;
              const diffDays = isValidDate ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

              return (
                <motion.div
                  layout
                  key={emp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[4rem] -z-0 opacity-50 transition-all group-hover:scale-110" />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 text-xl font-black border border-blue-50">
                          {emp.name[0]}
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900 text-lg">{emp.name}</h4>
                          <p className="text-sm font-bold text-gray-400">#{emp.employeeId || '---'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-emerald-100 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          أيام العمل: {calculateActualWorkDays(emp.lastDirectDate)} يوم
                        </div>
                        {leave && (
                          <div className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black",
                            diffDays < 0 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                          )}>
                            {diffDays < 0 ? 'متأخر' : diffDays === 0 ? 'اليوم' : `باقي ${diffDays} يوم`}
                          </div>
                        )}
                        {leave && leave.status === 'Active' && (
                          <button
                            onClick={() => handleEditLeave(leave)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-blue-600 rounded-xl transition-all border border-gray-100 font-black text-[10px]"
                            title="تعديل التواريخ"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            تعديل المواعيد
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-gray-400 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          تاريخ البداية
                        </span>
                        <span className="font-black text-gray-700">{leave?.startDate || '---'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-gray-400 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          العودة المتوقعة
                        </span>
                        <span className="font-black text-gray-700">{leave?.endDate || '---'}</span>
                      </div>
                      <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            diffDays < 0 ? "bg-red-500" : "bg-blue-500"
                          )}
                          style={{ width: leave ? `${Math.max(0, Math.min(100, 100 - (diffDays / 30 * 100)))}%` : '0%' }}
                        />
                      </div>
                    </div>

                    {leave ? (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleConfirmReturn(leave)}
                          className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                        >
                          <Check className="w-5 h-5" />
                          تأكيد تاريخ المباشرة
                        </button>
                        <button
                          onClick={() => handleEditLeave(leave)}
                          className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                          <Calendar className="w-5 h-5" />
                          تمديد
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirmReturn(emp)}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        <Check className="w-5 h-5" />
                        تأكيد تاريخ المباشرة
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          {employees.filter(e => e.status === 'Leave').length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400">
              <Plane className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-xl font-bold">لا يوجد موظفون في إجازة حالياً</p>
            </div>
          )}
        </div>
      ) : activeView === 'History' ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">الموظف</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">تاريخ البداية</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">تاريخ النهاية</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">الرصيد عند المباشرة</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider">عدد الأيام</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider text-center">الحالة</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLeaves.map((leave) => {
                  const start = new Date(leave.startDate);
                  const end = new Date(leave.endDate);
                  const isValidDates = !isNaN(start.getTime()) && !isNaN(end.getTime());
                  const diffTime = isValidDates ? Math.abs(end.getTime() - start.getTime()) : 0;
                  const diffDays = isValidDates ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 : 0;
                  
                  const isOverdue = leave.status === 'Active' && isValidDates && end < new Date();
                  const isEndingSoon = leave.status === 'Active' && !isOverdue && isValidDates && (end.getTime() - new Date().getTime()) <= (3 * 24 * 60 * 60 * 1000);

                  return (
                    <motion.tr 
                      layout
                      key={leave.id} 
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-black">
                            {leave.employeeName[0]}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{leave.employeeName}</span>
                            {(() => {
                              const emp = employees.find(e => e.id === leave.employeeId);
                              return emp ? (
                                <span className="text-[10px] text-gray-400 font-bold">#{emp.employeeId || 'N/A'}</span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 font-bold text-gray-600">{leave.startDate}</td>
                      <td className="px-8 py-5 font-bold text-gray-600">{leave.endDate}</td>
                      <td className="px-8 py-5">
                        {(() => {
                          const emp = employees.find(e => e.id === leave.employeeId);
                          if (!emp) return '-';
                          return (
                            <span className="font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg text-xs">
                              أيام العمل: {calculateActualWorkDays(emp.lastDirectDate)} يوم
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm font-black">
                          {diffDays} يوم
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        {leave.status === 'Completed' ? (
                          <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-black inline-flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            مكتملة
                          </span>
                        ) : isOverdue ? (
                          <span className="px-4 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-black inline-flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            متأخرة
                          </span>
                        ) : isEndingSoon ? (
                          <span className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-sm font-black inline-flex items-center gap-2 animate-pulse">
                            <Bell className="w-4 h-4" />
                            تنتهي قريباً
                          </span>
                        ) : (
                          <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-black">
                            نشطة
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {leave.status === 'Active' && (
                            <>
                              <button
                                onClick={() => handleConfirmReturn(leave)}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-500/20"
                              >
                                <Check className="w-4 h-4" />
                                تأكيد تاريخ المباشرة
                              </button>
                              <button
                                onClick={() => handleEditLeave(leave)}
                                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-blue-600 rounded-xl transition-all border border-gray-100 font-black text-sm flex items-center gap-2"
                                title="تعديل المواعيد"
                              >
                                <Calendar className="w-4 h-4" />
                                تعديل
                              </button>
                            </>
                          )}
                          {leave.status === 'Completed' && (
                            <div className="text-gray-400 text-xs font-bold">
                              تمت المباشرة بتاريخ: {leave.returnDate || leave.endDate}
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {filteredLeaves.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center text-gray-400">
                      <Plane className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-bold">لا توجد إجازات سجلتها للنظام</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider text-right">اسم الموظف</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider text-right">الرقم الوظيفي</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider text-center">أيام العمل الفعلية من تاريخ آخر مباشرة</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider text-center">تاريخ آخر مباشرة</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider text-center">الحالة</th>
                  <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-wider text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees
                  .filter(e => {
                    const matchesSearch = 
                      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (e.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (e.iqamaNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
                    return matchesSearch;
                  })
                  .map((emp) => {
                    const actualWorkDaysSinceLastDirect = calculateActualWorkDays(emp.lastDirectDate);
                    
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-5 font-bold text-gray-900">{emp.name}</td>
                        <td className="px-8 py-5 font-bold text-gray-500">{emp.employeeId || '---'}</td>
                        <td className="px-8 py-5 text-center">
                          <span className="px-6 py-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-xl border border-blue-100 shadow-inner">
                            {actualWorkDaysSinceLastDirect} يوم
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center font-bold text-gray-500">
                          {emp.lastDirectDate || 'غير مسجل'}
                        </td>
                        <td className="px-8 py-5 text-center">
                          {emp.status === 'Active' ? (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase">نشط</span>
                          ) : emp.status === 'Leave' ? (
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1">
                              <Plane className="w-3 h-3" />
                              في إجازة
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-black uppercase">{emp.status}</span>
                          )}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-center gap-2">
                             <button 
                              onClick={() => {
                                setViewingEmployee(emp);
                              }}
                              className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all border border-blue-100/50 shadow-sm"
                              title="عرض الملف"
                            >
                              <User className="w-4 h-4" />
                            </button>
                            
                            {emp.status === 'Active' ? (
                              <button 
                                onClick={() => {
                                  setFormData({
                                    employeeId: emp.id,
                                    startDate: format(new Date(), 'yyyy-MM-dd'),
                                    endDate: ''
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all border border-emerald-100/50 shadow-sm"
                                title="إضافة إجازة"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            ) : emp.status === 'Leave' ? (
                              <button 
                                onClick={() => {
                                  const activeLeave = leaves.find(l => l.employeeId === emp.id && l.status === 'Active');
                                  handleConfirmReturn(activeLeave || emp);
                                }}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2"
                              >
                                <Check className="w-4 h-4 ml-1" />
                                تأكيد تاريخ المباشرة
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Leave Modal */}
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
              className="relative w-full max-w-xl bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 bg-blue-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Plane className={cn("w-6 h-6", selectedLeave && "rotate-180")} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">{selectedLeave ? 'تعديل تواريخ الإجازة' : 'إضافة إجازة جديدة'}</h3>
                    <p className="text-blue-100 font-medium opacity-80">{selectedLeave ? 'تحديث فترة الإجازة النشطة' : 'تسجيل إجازة لموظف حالي'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedLeave(null);
                    setFormData({ employeeId: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '' });
                  }} 
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddLeave} className="p-8 space-y-6 text-right" dir="rtl">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 mr-2">الموظف</label>
                  <select
                    required
                    disabled={!!selectedLeave}
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black transition-all appearance-none disabled:opacity-50"
                  >
                    <option value="">اختر الموظف...</option>
                    {employees.filter(e => e.status === 'Active' || (selectedLeave && e.id === selectedLeave.employeeId)).map(emp => {
                      const workDays = calculateActualWorkDays(emp.lastDirectDate);
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - أيام العمل: {workDays} يوم ({emp.employeeId || 'بدون رقم'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {formData.employeeId && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-xs font-bold text-blue-400 mb-1">أيام العمل الفعلية</p>
                        <span className="text-xl font-black text-blue-600">
                          {calculateActualWorkDays(employees.find(e => e.id === formData.employeeId)?.lastDirectDate)} يوم
                        </span>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <p className="text-xs font-bold text-amber-400 mb-1">خصم الأيام</p>
                        <span className="text-xl font-black text-amber-600">
                          {leaveDays} يوم
                        </span>
                      </div>
                    </div>

                      <div className="p-4 bg-gray-900 rounded-2xl flex items-center justify-between text-white shadow-lg shadow-gray-200">
                        <div className="flex items-center gap-3">
                          <ArrowLeftRight className="w-5 h-5 text-blue-400" />
                          <span className="font-bold">أيام العمل المتوقعة بعد الإجازة:</span>
                        </div>
                        <span className="text-xl font-black text-blue-400">
                          0 يوم
                        </span>
                      </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2 text-right block">تاريخ البدء</label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 mr-2 text-right block">تاريخ العودة المتوقع (اختياري)</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {selectedLeave ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {selectedLeave ? 'حفظ التعديلات' : 'تسجيل الإجازة الآن'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedLeave(null);
                      setFormData({ employeeId: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '' });
                    }}
                    className="px-8 bg-gray-100 hover:bg-gray-200 text-gray-600 py-4 rounded-2xl font-black transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Confirmation Modal */}
      <AnimatePresence>
        {isReturnModalOpen && selectedLeaveForReturn && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReturnModalOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden"
              dir="rtl"
            >
              <div className="p-8 bg-emerald-600 text-white relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[5rem] -mr-8 -mt-8" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-3xl font-black mb-2">تأكيد المباشرة</h3>
                  <p className="text-emerald-50 text-lg font-medium opacity-90">سجل تاريخ عودة الموظف لاستلام عمله</p>
                </div>
              </div>

              <div className="p-10 space-y-8">
                <div className="flex items-center gap-5 p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-emerald-600 text-2xl font-black border border-emerald-50">
                    {selectedLeaveForReturn.employeeName[0]}
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-xl">{selectedLeaveForReturn.employeeName}</h4>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold">عائد من إجازة</span>
                      {(() => {
                        const emp = employees.find(e => e.id === selectedLeaveForReturn.employeeId);
                        return emp?.lastDirectDate ? (
                          <span className="text-[10px] font-bold text-gray-400">آخر مباشرة: {emp.lastDirectDate}</span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-gray-400 mr-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    تاريخ استلام العمل الفعلي
                  </label>
                  <input
                    type="date"
                    required
                    value={actualReturnDate}
                    onChange={(e) => setActualReturnDate(e.target.value)}
                    className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-[2rem] outline-none font-black text-xl transition-all shadow-inner"
                  />
                  <p className="text-xs font-bold text-gray-400 mr-2 mt-2 leading-relaxed">
                    ملاحظة: سيتم تحديث حالة الموظف إلى "نشط" وسيتم تسجيل هذا التاريخ كآخر تاريخ مباشرة ميدانية.
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={finishReturn}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-[2rem] font-black text-xl shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <Check className="w-6 h-6" />
                    تأكيد المباشرة الآن
                  </button>
                  <button
                    onClick={() => setIsReturnModalOpen(false)}
                    className="w-full py-4 text-gray-400 font-black hover:text-gray-600 transition-colors"
                  >
                    إلغاء العملية
                  </button>
                </div>
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
              dir="rtl"
            >
              <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-emerald-50/30">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-emerald-100 rounded-[2rem] flex items-center justify-center text-emerald-600 font-black text-3xl shadow-inner">
                    {viewingEmployee.name[0]}
                  </div>
                  <div className="text-right">
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
                  <X className="w-6 h-6 text-gray-400 group-hover:text-red-500 transition-colors" />
                </button>
              </div>
              
              <div className="p-10 max-h-[70vh] overflow-y-auto space-y-10 custom-scrollbar text-right">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                  <DetailItem label="رقم الإقامة / الهوية" value={viewingEmployee.iqamaNumber} />
                  <DetailItem label="تاريخ انتهاء الإقامة" value={viewingEmployee.iqamaExpiryDate} />
                  <DetailItem label="الجنسية" value={viewingEmployee.nationality} />
                  <DetailItem label="تاريخ التعيين" value={viewingEmployee.joinDate} />
                  <DetailItem label="آخر مباشرة" value={viewingEmployee.lastDirectDate} />
                  <DetailItem label="القطاع" value={viewingEmployee.sectors} />
                  <DetailItem label="مركز التكلفة" value={viewingEmployee.sectorManagement} />
                  <DetailItem label="الموقع" value={viewingEmployee.location} />
                  <DetailItem label="أيام العمل الفعلية من تاريخ آخر مباشرة" value={`${calculateActualWorkDays(viewingEmployee.lastDirectDate)} يوم`} />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center p-8 border-2 border-emerald-100 bg-emerald-50/20 rounded-[2.5rem] shadow-sm">
                   <div className="text-right">
                     <p className="text-gray-400 font-black uppercase text-xs tracking-widest mb-1">صافي الراتب الشهري</p>
                     <p className="text-sm font-bold text-emerald-600/60">شامل كافة البدلات الثابتة</p>
                   </div>
                   <p className="text-5xl font-black text-emerald-600 tracking-tighter">
                     {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(
                       (viewingEmployee.basicSalary || 0) + 
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
                  onClick={() => setViewingEmployee(null)}
                  className="px-10 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-gray-200"
                >
                  إغلاق
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
