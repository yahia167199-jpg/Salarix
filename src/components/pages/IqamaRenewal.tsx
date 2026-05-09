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
  Printer,
  ChevronDown
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { db, doc, updateDoc } from '../../firebase';
import { cn } from '../../lib/utils';
import { format, addDays, isPast, isBefore } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

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
        // Exclude Saudis
        const nat = emp.nationality?.toLowerCase() || '';
        const isSaudi = nat.includes('saudi') || nat.includes('سعودي') || nat.includes('سعودية');
        if (isSaudi) return false;

        // Only include Active, Out of Sponsorship, or Leave (On Vacation)
        // Exclude End of Service (EOS) or any other inactive status
        const isActiveOrRelevant = emp.status === 'Active' || emp.status === 'Out of Sponsorship' || emp.status === 'Leave';
        return isActiveOrRelevant;
      })
      .map(emp => {
        const expiryDate = emp.iqamaExpiryDate ? new Date(emp.iqamaExpiryDate) : null;
      
      let status: 'Active' | 'Expiring' | 'Expired' | 'Out of Sponsorship' = 'Active';
      
      const hasNoDate = !expiryDate || isNaN(expiryDate.getTime());

      if (hasNoDate) {
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
    const name = (emp.name || '').toLowerCase();
    const id = String(emp.employeeId || '');
    const iqama = (emp.iqamaNumber || '');
    
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || 
                         id.includes(searchTerm) ||
                         iqama.includes(searchTerm);
    
    const matchesType = filterType === 'All' || 
                        (filterType === 'Out of Kingdom' ? emp.status === 'Leave' : 
                         filterType === 'Active' ? (emp.iqamaStatus === 'Active' && emp.status === 'Active') :
                         emp.iqamaStatus === filterType);

    const nat = (emp.nationality || '').toLowerCase();
    
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
    total: employeesWithIqamaStatus.filter(e => {
        const nat = (e.nationality || '').toLowerCase();
        return !(nat.includes('saudi') || nat.includes('سعودي') || nat.includes('سعودية'));
    }).length,
    active: employeesWithIqamaStatus.filter(e => e.iqamaStatus === 'Active' && e.status === 'Active').length,
    expiring: employeesWithIqamaStatus.filter(e => e.iqamaStatus === 'Expiring').length,
    expired: employeesWithIqamaStatus.filter(e => e.iqamaStatus === 'Expired').length,
    outOfSponsorship: employeesWithIqamaStatus.filter(e => e.iqamaStatus === 'Out of Sponsorship').length,
    outOfKingdom: employeesWithIqamaStatus.filter(e => e.status === 'Leave').length,
    needsSync: employeesWithIqamaStatus.filter(e => 
      e.iqamaStatus === 'Out of Sponsorship' && 
      (e.status !== 'Out of Sponsorship' || e.officialEmployer !== 'خارج الكفالة')
    ).length
  };

  const handleSyncOutOfSponsorship = async () => {
    const targets = employeesWithIqamaStatus.filter(e => 
      e.iqamaStatus === 'Out of Sponsorship' && 
      (e.status !== 'Out of Sponsorship' || e.officialEmployer !== 'خارج الكفالة')
    );

    if (targets.length === 0) return;

    if (!confirm(`سيتم تحويل حالة ${targets.length} موظف إلى "خارج الكفالة" وتحديث جهة العمل. هل أنت متأكد؟`)) {
      return;
    }

    setLoading(true);
    try {
      let count = 0;
      for (const emp of targets) {
        await updateDoc(doc(db, 'employees', emp.id), {
          status: 'Out of Sponsorship',
          officialEmployer: 'خارج الكفالة'
        });
        count++;
      }
      alert(`تم تحديث ${count} موظف بنجاح`);
    } catch (error) {
      console.error('Sync error:', error);
      alert('حدث خطأ أثناء التحديث الجماعي');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = async () => {
    setLoading(true);
    try {
      const printContent = document.createElement('div');
      printContent.style.position = 'absolute';
      printContent.style.left = '-9999px';
      printContent.style.top = '0';
      printContent.style.width = '800px';
      printContent.style.backgroundColor = 'white';
      printContent.style.color = 'black';
      printContent.style.direction = 'rtl';
      printContent.style.padding = '40px';
      printContent.style.fontFamily = 'Arial, sans-serif';

      const header = `
        <div style="margin-bottom: 30px; position: relative;">
          ${companySettings?.logoUrl ? `
            <div style="position: absolute; left: 0; top: 0;">
              <img src="${companySettings.logoUrl}" style="height: 60px; width: auto; object-fit: contain;" />
            </div>
          ` : ''}
          
          <div style="text-align: center; padding-top: 10px;">
            <h2 style="margin: 0; color: #1e293b; font-size: 20px; font-weight: 900;">${companySettings?.companyName || 'اسم المنشأة'}</h2>
            <h1 style="margin: 10px 0 0 0; color: #2563eb; font-size: 32px; font-weight: 900;">تقرير تجديد الإقامات</h1>
          </div>

          <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-weight: bold;">
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <span style="color: #64748b; font-size: 12px;">تاريخ التقرير</span>
              <span style="font-size: 14px;">${new Date().toLocaleDateString('ar-SA')}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px; text-align: center;">
              <span style="color: #64748b; font-size: 12px;">الشهر المختار</span>
              <span style="font-size: 14px;">${selectedMonth === 'All' ? 'الكل' : selectedMonth}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px; text-align: left;">
              <span style="color: #64748b; font-size: 12px;">عدد الموظفين</span>
              <span style="font-size: 14px;">${filteredEmployees.length} موظف</span>
            </div>
          </div>
        </div>
      `;

      let tableRows = filteredEmployees.map(emp => {
        const officialEmployer = emp.iqamaStatus === 'Out of Sponsorship' ? 'خارج الكفالة' : (emp.officialEmployer || '---');
        return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 5px; text-align: right; border-left: 1px solid #f1f5f9;">${emp.employeeId}</td>
          <td style="padding: 10px 5px; text-align: right; border-left: 1px solid #f1f5f9; font-weight: bold;">${emp.name}</td>
          <td style="padding: 10px 5px; text-align: center; border-left: 1px solid #f1f5f9; font-family: monospace;">${emp.iqamaNumber}</td>
          <td style="padding: 10px 5px; text-align: right; border-left: 1px solid #f1f5f9; font-size: 11px;">${officialEmployer}</td>
          <td style="padding: 10px 5px; text-align: center; border-left: 1px solid #f1f5f9;">${emp.nationality || '---'}</td>
          <td style="padding: 10px 5px; text-align: center; border-left: 1px solid #f1f5f9;">
            <span style="padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; ${emp.status === 'Leave' ? 'background-color: #2563eb; color: white;' : 'background-color: #f1f5f9; color: #64748b;'}">
              ${emp.status === 'Leave' ? 'نعم' : 'لا'}
            </span>
          </td>
          <td style="padding: 10px 5px; text-align: center; border-left: 1px solid #f1f5f9; font-family: monospace;">${emp.iqamaExpiryDate || '---'}</td>
          <td style="padding: 10px 5px; text-align: center; border-left: 1px solid #f1f5f9;">
            <span style="font-weight: 900; ${emp.daysRemaining <= 0 ? 'color: #dc2626;' : emp.daysRemaining <= alertDays ? 'color: #d97706;' : 'color: #059669;'}">
              ${emp.daysRemaining !== -1 ? emp.daysRemaining : '---'}
            </span>
          </td>
          <td style="padding: 10px 5px; text-align: center;">
            <span style="font-weight: bold; font-size: 11px; color: ${
              emp.iqamaStatus === 'Active' && emp.status === 'Active' ? '#059669' : 
              emp.iqamaStatus === 'Expiring' ? '#d97706' : 
              emp.iqamaStatus === 'Out of Sponsorship' ? '#64748b' : 
              emp.status === 'Leave' ? '#2563eb' : '#dc2626'
            }">
              ${emp.iqamaStatus === 'Active' && emp.status === 'Active' ? 'نشطة' : 
                emp.iqamaStatus === 'Expiring' ? 'تنتهي قريباً' : 
                emp.iqamaStatus === 'Out of Sponsorship' ? 'خارج الكفالة' :
                emp.status === 'Leave' ? 'خارج المملكة' : 'منتهية'}
            </span>
          </td>
        </tr>
      `}).join('');

      const table = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 12px 5px; text-align: right; border-left: 1px solid #cbd5e1;">الرقم الوظيفي</th>
              <th style="padding: 12px 5px; text-align: right; border-left: 1px solid #cbd5e1;">اسم الموظف</th>
              <th style="padding: 12px 5px; text-align: center; border-left: 1px solid #cbd5e1;">رقم الإقامة</th>
              <th style="padding: 12px 5px; text-align: right; border-left: 1px solid #cbd5e1;">صاحب العمل</th>
              <th style="padding: 12px 5px; text-align: center; border-left: 1px solid #cbd5e1;">الجنسية</th>
              <th style="padding: 12px 5px; text-align: center; border-left: 1px solid #cbd5e1;">خارج المملكة</th>
              <th style="padding: 12px 5px; text-align: center; border-left: 1px solid #cbd5e1;">تاريخ الانتهاء</th>
              <th style="padding: 12px 5px; text-align: center; border-left: 1px solid #cbd5e1;">المتبقي</th>
              <th style="padding: 12px 5px; text-align: center;">حالة الإقامة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;

      printContent.innerHTML = header + table;
      document.body.appendChild(printContent);

      // Wait for images to load before capturing
      const images = printContent.getElementsByTagName('img');
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails
        });
      });

      await Promise.all(imagePromises);

      const canvas = await html2canvas(printContent, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Remove all stylesheets that might contain unsupported color functions like oklch
          // Our printContent uses explicit inline styles with hex colors, so this is safe.
          const styleSheets = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styleSheets.forEach(s => s.remove());
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add subsequent pages if content overflows
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`تجديد_الاقامات_${selectedMonth}_${new Date().toISOString().split('T')[0]}.pdf`);

      document.body.removeChild(printContent);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      setLoading(false);
    }
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
      {/* Sync Alert Banner */}
      <AnimatePresence>
        {stats.needsSync > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[2rem] p-6 text-white shadow-xl shadow-blue-500/20 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg">تنبيه تحديث حالة الملفات</h3>
                  <p className="text-blue-100 font-bold text-sm">يوجد {stats.needsSync} موظف حالة إقامتهم "خارج الكفالة" ولكن ملفهم الوظيفي لم يتم تحديثه بعد.</p>
                </div>
              </div>
              <button 
                onClick={handleSyncOutOfSponsorship}
                disabled={loading}
                className="px-8 py-3 bg-white text-blue-600 rounded-2xl font-black text-sm hover:bg-blue-50 transition-all active:scale-95 shadow-lg shadow-black/10 flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {loading ? 'جاري التحديث...' : 'تحديث جميع الملفات الآن'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
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
          label="خارج المملكة" 
          value={stats.outOfKingdom} 
          icon={Download} 
          color="blue" 
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
          label="خارج الكفالة" 
          value={stats.outOfSponsorship} 
          icon={ShieldCheck} 
          color="gray" 
        />
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 dark:border-gray-800 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="relative group flex-1 max-w-sm">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث برقم الإقامة أو اسم الموظف..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 pr-12 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold shadow-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>

              <div className="relative group">
                <Clock className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                  selectedMonth !== 'All' ? "text-blue-600" : "text-gray-400"
                )} />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={cn(
                    "pr-10 pl-10 py-4 bg-gray-50 dark:bg-gray-800 border rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-bold shadow-sm appearance-none min-w-[200px] text-sm cursor-pointer",
                    selectedMonth !== 'All' 
                      ? "border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400" 
                      : "border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-600"
                  )}
                >
                  <option value="All">فلترة بالشهور (الكل)</option>
                  {months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
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
                onClick={handlePrintPDF}
                disabled={loading}
                className="px-6 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-2xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 border border-gray-100 dark:border-gray-700 disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                طباعة PDF
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

          <div className="flex bg-gray-50 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 h-14 overflow-x-auto w-fit">
            <FilterTab active={filterType === 'All'} onClick={() => setFilterType('All')} label="الكل" />
            <FilterTab active={filterType === 'Active'} onClick={() => setFilterType('Active')} label="نشط" color="emerald" />
            <FilterTab active={filterType === 'Expiring'} onClick={() => setFilterType('Expiring')} label="تنبيه" color="amber" />
            <FilterTab active={filterType === 'Expired'} onClick={() => setFilterType('Expired')} label="منتهي" color="red" />
            <FilterTab active={filterType === 'Out of Sponsorship'} onClick={() => setFilterType('Out of Sponsorship')} label="خارج الكفالة" color="blue" />
            <FilterTab active={filterType === 'Out of Kingdom'} onClick={() => setFilterType('Out of Kingdom')} label="خارج المملكة" color="blue" />
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
                        : emp.status === 'Leave'
                        ? "bg-gradient-to-br from-blue-800 to-blue-950 text-white hover:from-blue-700 hover:to-blue-900"
                        : "hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                    )}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm",
                          (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave')
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
                            (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave') ? "text-white" : "text-gray-900 dark:text-white"
                          )}>{emp.name}</p>
                          <p className={cn(
                            "text-xs font-bold",
                            emp.iqamaStatus === 'Expired' ? "text-red-300" :
                            emp.iqamaStatus === 'Expiring' ? "text-orange-200" :
                            emp.iqamaStatus === 'Out of Sponsorship' ? "text-gray-200" :
                            emp.status === 'Leave' ? "text-blue-200" :
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
                          (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave') ? "text-white" : "text-gray-700 dark:text-gray-300"
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
                              (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave') ? "text-white" : "text-gray-900 dark:text-white"
                            )}>{emp.iqamaExpiryDate || '---'}</span>
                            <span className={cn(
                              "text-[10px] font-bold",
                              emp.iqamaStatus === 'Expired' ? "text-red-300" :
                              emp.iqamaStatus === 'Expiring' ? "text-orange-200" :
                              emp.iqamaStatus === 'Out of Sponsorship' ? "text-gray-200" :
                              emp.status === 'Leave' ? "text-blue-200" :
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
                        (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave') ? "bg-white/10 text-white ring-white/30" :
                        "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-red-100 dark:ring-red-900/30"
                      )}>
                        {emp.iqamaStatus === 'Active' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                         emp.iqamaStatus === 'Expiring' ? <Clock className="w-3.5 h-3.5" /> :
                         emp.iqamaStatus === 'Out of Sponsorship' ? <ShieldCheck className="w-3.5 h-3.5" /> :
                         emp.status === 'Leave' ? <Download className="w-3.5 h-3.5" /> :
                         <AlertTriangle className="w-3.5 h-3.5" />}
                        {emp.iqamaStatus === 'Active' ? 'نشطة' :
                         emp.iqamaStatus === 'Expiring' ? 'تنتهي قريباً' : 
                         emp.iqamaStatus === 'Out of Sponsorship' ? 'خارج الكفالة' :
                         emp.status === 'Leave' ? 'خارج المملكة' : 'منتهية'}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "font-bold text-sm",
                        (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave') ? "text-white" : "text-gray-600 dark:text-gray-400"
                      )}>
                        {emp.iqamaStatus === 'Out of Sponsorship' ? 'خارج الكفالة' : (emp.officialEmployer || '---')}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border",
                        (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave')
                          ? "bg-white/10 text-white border-white/30"
                          : emp.status === 'Active' 
                            ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100" 
                            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100"
                      )}>
                        {emp.status === 'Leave' ? 'نعم' : 'لا'}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-bold text-sm">
                      <span className={(emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave') ? "text-white" : "text-gray-600 dark:text-gray-400"}>
                        {emp.nationality || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {emp.daysRemaining !== -1 ? (
                        <div className="flex items-center justify-center gap-2 text-center">
                          <span className={cn(
                            "text-sm font-black",
                            (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave')
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
                          (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave') ? "text-white/50" : "text-gray-300 dark:text-gray-600"
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
                                (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave')
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
                                (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave')
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
                                (emp.iqamaStatus === 'Expired' || emp.iqamaStatus === 'Expiring' || emp.iqamaStatus === 'Out of Sponsorship' || emp.status === 'Leave')
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
