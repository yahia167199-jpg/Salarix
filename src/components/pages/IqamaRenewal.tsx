import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Search, 
  Download, 
  Upload, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  User,
  Edit2,
  Check,
  X,
  Printer
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { db, doc, updateDoc } from '../../firebase';
import { cn } from '../../lib/utils';
import { format, addDays, isPast, isBefore } from 'date-fns';
import * as XLSX from 'xlsx';

export const IqamaRenewal: React.FC = () => {
  const { employees, companySettings, leaves } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Active' | 'Expiring' | 'Expired' | 'Out of Sponsorship' | 'Out of Kingdom'>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ iqamaNumber: '', iqamaExpiryDate: '' });

  const alertDays = companySettings?.iqamaAlertDays || 3;

  const employeesWithIqamaStatus = useMemo(() => {
    const today = new Date();
    const alertThreshold = addDays(today, alertDays);

    return employees
      .filter(emp => {
        const nat = emp.nationality?.toLowerCase() || '';
        const isSaudi = nat.includes('saudi') || nat.includes('سعودي') || nat.includes('سعودية');
        return !isSaudi && emp.status !== 'End of Service';
      })
      .map(emp => {
        const expiryDate = emp.iqamaExpiryDate ? new Date(emp.iqamaExpiryDate) : null;
      
      let status: 'Active' | 'Expiring' | 'Expired' | 'Out of Sponsorship' = 'Active';
      
      const hasNoDate = !expiryDate || isNaN(expiryDate.getTime());

      if (hasNoDate || emp.officialEmployer === 'خارج الكفالة') {
        status = 'Out of Sponsorship';
      } else if (isPast(expiryDate)) {
        status = 'Expired';
      } else if (isBefore(expiryDate, alertThreshold)) {
        status = 'Expiring';
      }

      return {
        ...emp,
        iqamaStatus: status,
        expiryDateObj: expiryDate,
        daysRemaining: expiryDate && !isNaN(expiryDate.getTime()) 
          ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : -1
      };
    })
    .sort((a, b) => {
      if (!a.expiryDateObj) return 1;
      if (!b.expiryDateObj) return -1;
      return a.expiryDateObj.getTime() - b.expiryDateObj.getTime();
    });
  }, [employees, alertDays]);

  const filteredEmployees = employeesWithIqamaStatus.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         emp.employeeId.includes(searchTerm) ||
                         (emp.iqamaNumber || '').includes(searchTerm);
    
    const matchesType = filterType === 'All' || 
                        (filterType === 'Out of Kingdom' ? emp.status !== 'Active' : emp.iqamaStatus === filterType);
    
    let matchesMonth = true;
    if (selectedMonth !== 'All') {
      if (!emp.iqamaExpiryDate) {
        matchesMonth = false;
      } else {
        const month = emp.iqamaExpiryDate.substring(0, 7); // YYYY-MM
        matchesMonth = month === selectedMonth;
      }
      
      // Also exclude "Out of Sponsorship" when filtering by month as requested
      if (emp.iqamaStatus === 'Out of Sponsorship') {
        matchesMonth = false;
      }
    }

    return matchesSearch && matchesType && matchesMonth;
  });

  const months = useMemo(() => {
    const uniqueMonths = new Set<string>();
    employeesWithIqamaStatus.forEach(emp => {
      if (emp.iqamaExpiryDate) {
        uniqueMonths.add(emp.iqamaExpiryDate.substring(0, 7));
      }
    });
    return Array.from(uniqueMonths).sort();
  }, [employeesWithIqamaStatus]);

  const stats = {
    total: employeesWithIqamaStatus.length,
    active: employeesWithIqamaStatus.filter(e => e.iqamaStatus === 'Active').length,
    expiring: employeesWithIqamaStatus.filter(e => e.iqamaStatus === 'Expiring').length,
    expired: employeesWithIqamaStatus.filter(e => e.iqamaStatus === 'Expired').length,
    outOfSponsorship: employeesWithIqamaStatus.filter(e => e.iqamaStatus === 'Out of Sponsorship').length,
  };

  const handleExport = () => {
    const data = filteredEmployees.map(emp => ({
      'رقم الموظف': emp.employeeId,
      'اسم الموظف': emp.name,
      'رقم الإقامة': emp.iqamaNumber,
      'تاريخ انتهاء الإقامة': emp.iqamaExpiryDate || 'غير محدد',
      'الحالة': emp.iqamaStatus === 'Active' ? 'نشطة' : 
                emp.iqamaStatus === 'Expiring' ? 'تنتهي قريباً' : 'منتهية',
      'صاحب العمل': emp.officialEmployer || 'غير محدد'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تجديد الإقامات");
    XLSX.writeFile(wb, "تقرير_تجديد_الإقامات.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const iqamaNum = row['رقم الإقامة']?.toString();
        const expiryDate = row['تاريخ انتهاء الإقامة']?.toString();
        const name = row['اسم الموظف']?.toString();
        const officialEmployer = row['صاحب العمل']?.toString();

        if (!expiryDate && !iqamaNum && !name && !officialEmployer) continue;

        const employee = employees.find(e => e.employeeId === empId || (iqamaNum && e.iqamaNumber === iqamaNum));
        if (employee) {
          try {
            const updates: any = {};
            if (expiryDate && expiryDate !== 'غير محدد') updates.iqamaExpiryDate = expiryDate;
            if (iqamaNum) updates.iqamaNumber = iqamaNum;
            if (name) updates.name = name;
            if (officialEmployer && officialEmployer !== 'غير محدد') updates.officialEmployer = officialEmployer;

            if (Object.keys(updates).length > 0) {
              await updateDoc(doc(db, 'employees', employee.id), updates);
              successCount++;
            }
          } catch (err) {
            console.error('Error updating employee info for', employee.name, err);
          }
        }
      }

      setLoading(false);
      alert(`تم تحديث بيانات ${successCount} موظف بنجاح`);
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveRow = async (id: string) => {
    try {
      setLoading(true);
      await updateDoc(doc(db, 'employees', id), {
        iqamaNumber: editForm.iqamaNumber,
        iqamaExpiryDate: editForm.iqamaExpiryDate
      });
      setEditingId(null);
    } catch (err) {
      console.error('Error updating row:', err);
      alert('حدث خطأ أثناء التحديث');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <StatCard 
          label="إجمالي الموظفين" 
          value={stats.total} 
          icon={User} 
          color="blue" 
        />
        <StatCard 
          label="إقامات نشطة" 
          value={stats.active} 
          icon={CheckCircle2} 
          color="emerald" 
        />
        <StatCard 
          label="تنتهي قريباً" 
          value={stats.expiring} 
          icon={Clock} 
          color="amber" 
          description={`خلال ${alertDays} أيام`}
        />
        <StatCard 
          label="إقامات منتهية" 
          value={stats.expired} 
          icon={AlertTriangle} 
          color="red" 
        />
        <StatCard 
          label="خارج الإقامة" 
          value={stats.outOfSponsorship} 
          icon={ShieldCheck} 
          color="gray" 
        />
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative group w-full lg:w-96">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث برقم الإقامة أو اسم الموظف..."
                className="w-full bg-gray-50 dark:bg-gray-800 border-0 rounded-2xl p-4 pr-12 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold group-hover:bg-gray-100 dark:group-hover:bg-gray-700 shadow-inner text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>

            <div className="flex bg-gray-50 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 h-14 overflow-x-auto">
              <FilterTab active={filterType === 'All'} onClick={() => setFilterType('All')} label="الكل" />
              <FilterTab active={filterType === 'Active'} onClick={() => setFilterType('Active')} label="نشط" color="emerald" />
              <FilterTab active={filterType === 'Expiring'} onClick={() => setFilterType('Expiring')} label="تنبيه" color="amber" />
              <FilterTab active={filterType === 'Expired'} onClick={() => setFilterType('Expired')} label="منتهي" color="red" />
              <FilterTab active={filterType === 'Out of Sponsorship'} onClick={() => setFilterType('Out of Sponsorship')} label="خارج الكفالة" color="blue" />
              <FilterTab active={filterType === 'Out of Kingdom'} onClick={() => setFilterType('Out of Kingdom')} label="خارج المملكة" color="blue" />
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-14 px-6 bg-gray-50 dark:bg-gray-800 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-gray-900 dark:text-white shadow-sm appearance-none cursor-pointer min-w-[180px]"
            >
              <option value="All">فلترة بالشهور (الكل)</option>
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-emerald-100 dark:border-emerald-900/30"
            >
              <Download className="w-5 h-5" />
              تصدير البيانات
            </button>
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-gray-100 dark:border-gray-700"
            >
              <Printer className="w-5 h-5" />
              طباعة
            </button>
            <label className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-blue-100 dark:border-blue-900/30 cursor-pointer">
              <Upload className="w-5 h-5" />
              استيراد وتحديث
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleImport}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">الموظف</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">رقم الإقامة</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">تاريخ الانتهاء</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">حالة الإقامة</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">صاحب العمل</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">خارج المملكة</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">الجنسية</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">المتبقي</th>
                <th className="px-8 py-5 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              <AnimatePresence>
                {filteredEmployees.map((emp) => (
                  <motion.tr 
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "transition-colors group",
                      emp.iqamaStatus === 'Out of Sponsorship'
                        ? "bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 text-white hover:from-gray-500 hover:to-gray-700"
                        : emp.iqamaStatus === 'Expired'
                        ? "bg-gradient-to-br from-red-900 to-red-950 text-white hover:from-red-800 hover:to-red-900"
                        : emp.iqamaStatus === 'Expiring'
                        ? "bg-gradient-to-br from-orange-600 to-orange-800 text-white hover:from-orange-500 hover:to-orange-700"
                        : emp.status !== 'Active'
                        ? "bg-gradient-to-br from-blue-800 to-blue-950 text-white hover:from-blue-700 hover:to-blue-900"
                        : "hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                    )}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm",
                          (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active')
                            ? "bg-white/10 text-white border border-white/20"
                            : emp.iqamaStatus === 'Active' 
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" 
                            : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        )}>
                          {emp.name[0]}
                        </div>
                        <div>
                          <p className={cn(
                            "font-black leading-none mb-1",
                            (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active') ? "text-white" : "text-gray-900 dark:text-white"
                          )}>{emp.name}</p>
                          <p className={cn(
                            "text-xs font-bold",
                            emp.iqamaStatus === 'Expired' ? "text-red-300" :
                            emp.iqamaStatus === 'Expiring' ? "text-orange-200" :
                            emp.iqamaStatus === 'Out of Sponsorship' ? "text-gray-200" :
                            emp.status !== 'Active' ? "text-blue-200" :
                            "text-gray-400 dark:text-gray-500"
                          )}>#{emp.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {editingId === emp.id ? (
                        <input 
                          type="text"
                          value={editForm.iqamaNumber}
                          onChange={(e) => setEditForm({ ...editForm, iqamaNumber: e.target.value })}
                          className="w-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-1.5 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-right text-gray-900 dark:text-white"
                          placeholder="رقم الإقامة"
                        />
                      ) : (
                        <span className={cn(
                          "font-mono font-black tracking-wider",
                          (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active') ? "text-white" : "text-gray-700 dark:text-gray-300"
                        )}>
                          {emp.iqamaNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        {editingId === emp.id ? (
                          <input 
                            type="date"
                            value={editForm.iqamaExpiryDate}
                            onChange={(e) => setEditForm({ ...editForm, iqamaExpiryDate: e.target.value })}
                            className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-gray-900 dark:text-white"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className={cn(
                              "font-bold",
                              (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active') ? "text-white" : "text-gray-900 dark:text-white"
                            )}>{emp.iqamaExpiryDate || '---'}</span>
                            <span className={cn(
                              "text-[10px] font-bold",
                              emp.iqamaStatus === 'Expired' ? "text-red-300" :
                              emp.iqamaStatus === 'Expiring' ? "text-orange-200" :
                              emp.iqamaStatus === 'Out of Sponsorship' ? "text-gray-200" :
                              emp.status !== 'Active' ? "text-blue-200" :
                              "text-gray-400 dark:text-gray-500"
                            )}>التنسيق: YYYY-MM-DD</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black ring-1 ring-inset",
                        emp.iqamaStatus === 'Active' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-emerald-100 dark:ring-emerald-900/30" :
                        (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active') ? "bg-white/10 text-white ring-white/30" :
                        "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-red-100 dark:ring-red-900/30"
                      )}>
                        {emp.iqamaStatus === 'Active' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                         emp.iqamaStatus === 'Expiring' ? <Clock className="w-3.5 h-3.5" /> :
                         emp.iqamaStatus === 'Out of Sponsorship' ? <ShieldCheck className="w-3.5 h-3.5" /> :
                         <AlertTriangle className="w-3.5 h-3.5" />}
                        {emp.iqamaStatus === 'Active' ? 'نشطة' :
                         emp.iqamaStatus === 'Expiring' ? 'تنتهي قريباً' : 
                         emp.iqamaStatus === 'Out of Sponsorship' ? 'خارج الكفالة' : 'منتهية'}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "font-bold text-sm",
                        (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active') ? "text-white" : "text-gray-600 dark:text-gray-400"
                      )}>
                        {emp.officialEmployer || '---'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border",
                        (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active')
                          ? "bg-white/10 text-white border-white/30"
                          : emp.status === 'Active' 
                            ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100" 
                            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100"
                      )}>
                        {emp.status === 'Active' ? 'لا' : 'نعم'}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-bold text-sm">
                      <span className={(emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active') ? "text-white" : "text-gray-600 dark:text-gray-400"}>
                        {emp.nationality || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {emp.daysRemaining !== -1 ? (
                        <div className="flex items-center justify-center gap-2 text-center">
                          <span className={cn(
                            "text-sm font-black",
                            (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active')
                              ? "text-white"
                              : emp.daysRemaining <= 0 ? "text-red-500 dark:text-red-400" :
                                emp.daysRemaining <= alertDays ? "text-amber-500 dark:text-amber-400" :
                                "text-emerald-500 dark:text-emerald-400"
                          )}>
                            {emp.daysRemaining <= 0 ? 'منتهية' : `${emp.daysRemaining} يوم`}
                          </span>
                        </div>
                      ) : (
                        <span className={cn(
                          "italic text-sm text-center block",
                          (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active') ? "text-white/50" : "text-gray-300 dark:text-gray-600"
                        )}>التاريخ غير محدد</span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-2">
                        {editingId === emp.id ? (
                          <>
                            <button 
                              onClick={() => handleSaveRow(emp.id)}
                              className={cn(
                                "p-2.5 rounded-xl transition-all border shadow-sm",
                                (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active')
                                  ? "bg-white/10 text-white border-white/30 hover:bg-white/20"
                                  : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100"
                              )}
                              title="حفظ"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setEditingId(null)}
                              className={cn(
                                "p-2.5 rounded-xl transition-all border shadow-sm",
                                (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active')
                                  ? "bg-white/10 text-white border-white/30 hover:bg-white/20"
                                  : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30 hover:bg-red-100"
                              )}
                              title="إلغاء"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                setEditingId(emp.id);
                                setEditForm({
                                  iqamaNumber: emp.iqamaNumber,
                                  iqamaExpiryDate: emp.iqamaExpiryDate || ''
                                });
                              }}
                              className={cn(
                                "p-2.5 rounded-xl transition-all shadow-sm border",
                                (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status !== 'Active')
                                  ? "bg-white/10 text-white border-white/30 hover:bg-white/20"
                                  : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 hover:bg-blue-100"
                              )}
                              title="تعديل سريع"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredEmployees.length === 0 && (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">لا توجد نتائج</h3>
              <p className="text-gray-400 dark:text-gray-500 font-bold">جرب تغيير معايير البحث أو التصفية</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  label: string; 
  value: number; 
  icon: any; 
  color: 'blue' | 'emerald' | 'amber' | 'red' | 'gray';
  description?: string;
}> = ({ label, value, icon: Icon, color, description }) => (
  <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
    <div className={cn(
      "absolute -right-4 -top-4 w-24 h-24 rounded-full transition-transform duration-500 group-hover:scale-110 opacity-5",
      color === 'blue' ? "bg-blue-600" :
      color === 'emerald' ? "bg-emerald-600" :
      color === 'amber' ? "bg-amber-600" :
      color === 'red' ? "bg-red-600" :
      "bg-gray-600"
    )} />
    
    <div className="relative z-10 flex items-center justify-between mb-4">
      <div className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center",
        color === 'blue' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" :
        color === 'emerald' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
        color === 'amber' ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
        color === 'red' ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
        "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      {description && (
        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg uppercase tracking-tight">
          {description}
        </span>
      )}
    </div>
    
    <div className="relative z-10">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
    </div>
  </div>
);

const FilterTab: React.FC<{ active: boolean; onClick: () => void; label: string; color?: 'emerald' | 'amber' | 'red' | 'blue' }> = ({ 
  active, onClick, label, color 
}) => (
  <button
    onClick={onClick}
    className={cn(
      "px-6 h-full rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2",
      active 
        ? color === 'emerald' ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-100 dark:border-emerald-900/30" :
          color === 'amber' ? "bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-100 dark:border-amber-900/30" :
          color === 'red' ? "bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm border border-red-100 dark:border-red-900/30" :
          color === 'blue' ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/30" :
          "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-800"
        : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
    )}
  >
    {label}
  </button>
);
