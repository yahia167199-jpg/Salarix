import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar,
  Filter,
  Users,
  ChevronDown,
  Printer,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../contexts/DataContext';
import { formatCurrency, cn } from '../../lib/utils';
import * as XLSX from 'xlsx';
import { PayrollRun, PayrollResult } from '../../types';
import { collection, query, where, getDocs, db } from '../../firebase';

interface SummaryReportProps {
  forcedType?: 'Summary' | 'Detailed';
}

const sectorOrder = [
  'الإدارة العامة',
  'قطاع ص المقاولات والمقاولات',
  'ادارة العقار والاملاك',
  'قطاع الصناعة',
  'قطاع السلع الكماليه',
  'الورش الفنية'
];

export const SummaryReport: React.FC<SummaryReportProps> = ({ forcedType }) => {
  const { payrollRuns, employees, sectors, companySettings, costCenterDepts, transactions: allTransactions } = useData();
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PayrollResult[]>([]);

  // Use state but initialize with prop if available
  const [reportType, setReportType] = useState<'Summary' | 'Detailed'>(forcedType || 'Summary');
  const [selectedSectorDetails, setSelectedSectorDetails] = useState<string | null>(null);
  const [showSaudiInSummary, setShowSaudiInSummary] = useState(false);

  // Sync state if prop changes (though usually they are separate instances now)
  React.useEffect(() => {
    if (forcedType) setReportType(forcedType);
  }, [forcedType]);

  // Fetch results when run changes
  const handleRunChange = async (runId: string) => {
    setSelectedRunId(runId);
    if (!runId) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'payrollResults'), where('payrollRunId', '==', runId));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollResult));
      setResults(data);
    } catch (error) {
      console.error('Error fetching payroll results:', error);
    } finally {
      setLoading(false);
    }
  };

  const departmentToSectorMap: Record<string, string> = {
    // قطاع ص المقاولات والمقاولات
    'المكتب الفني': 'قطاع ص المقاولات والمقاولات',
    'مشروع السلامة المرورية': 'قطاع ص المقاولات والمقاولات',
    'مشروع سفلته قري الباحة': 'قطاع ص المقاولات والمقاولات',
    'مشاريع صيانة قري الباحة': 'قطاع ص المقاولات والمقاولات',
    'مشاريع سفلته قري الباحة': 'قطاع ص المقاولات والمقاولات',
    'مشروع سفلتة منح بلجرشى': 'قطاع ص المقاولات والمقاولات',
    'مشروع صيانة معشوقة': 'قطاع ص المقاولات والمقاولات',
    'مشروع صيانة منحدرات الباحة': 'قطاع ص المقاولات والمقاولات',
    'مشروع منح جدره': 'قطاع ص المقاولات والمقاولات',
    'مشروع سفلتة العقيق': 'قطاع ص المقاولات والمقاولات',
    'خ - الاسفلت': 'قطاع ص المقاولات والمقاولات',
    'الكسارة': 'قطاع ص المقاولات والمقاولات',
    // قطاع الصناعة
    'الخلاطة': 'قطاع الصناعة',
    'مصنع البلوك': 'قطاع الصناعة',
    'مصنع المياه': 'قطاع الصناعة',
    // قطاع السلع الكماليه
    'محل مواد البناء العقيق': 'قطاع السلع الكماليه',
    'محل مواد البناء الباحة': 'قطاع السلع الكماليه',
    'بتنا الافضل للمحروقات': 'قطاع السلع الكماليه',
    'بيتنا الافضل': 'قطاع السلع الكماليه',
    // الورش الفنية
    'ورشه الخلاطه': 'الورش الفنية',
    'الورشة الفنية': 'الورش الفنية',
    // ادارة العقار والاملاك
    'ادارة العقار': 'ادارة العقار والاملاك',
    'ادارة العقار والاملاك': 'ادارة العقار والاملاك',
    // الادارة العامة
    'ادارة الباحة': 'الإدارة العامة',
    'الإدارة العامة': 'الإدارة العامة',
    'الادارة العامة': 'الإدارة العامة'
  };

  const normalizeArabic = (text: string) => {
    if (!text) return '';
    return text
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه');
  };

  const getNormalizedSector = (sector: string, dept: string) => {
    const dTrim = (dept || '').trim();
    const dNormalized = normalizeArabic(dTrim);

    let s = (sector || '').trim();

    // Priority 1: Dynamic Mapping from Settings (costCenterDepts)
    const dynamicMapping = costCenterDepts.find(ccd => normalizeArabic(ccd.name) === dNormalized);
    if (dynamicMapping) {
      s = dynamicMapping.sectorName.trim();
    } else {
      // Priority 2: Fallback to the hardcoded mapping (normalized)
      const hardcodedMatch = Object.entries(departmentToSectorMap).find(([key]) => normalizeArabic(key) === dNormalized);
      if (hardcodedMatch) {
        s = hardcodedMatch[1].trim();
      }
    }

    const sNormalized = normalizeArabic(s);

    if (sNormalized.includes('سعودي') || sNormalized.includes('سعوديين') || sNormalized.includes('رواتب السعوديين')) {
      return 'السعوديين';
    }

    if (sNormalized.includes('اداره عامه') || sNormalized === 'اداره الباحه' || sNormalized.includes('الادارة العامة')) {
      return 'الإدارة العامة';
    }

    if (sNormalized.includes('مقاولات')) {
      return 'قطاع ص المقاولات والمقاولات';
    }

    if (sNormalized.includes('عقار')) {
      return 'ادارة العقار والاملاك';
    }

    if (sNormalized.includes('صناعه')) {
      return 'قطاع الصناعة';
    }

    if (sNormalized.includes('كماليه')) {
      return 'قطاع السلع الكماليه';
    }

    if (sNormalized.includes('ورشه') || sNormalized.includes('ورش فنيه')) {
      return 'الورش الفنية';
    }

    return s || 'غير محدد';
  };

  const selectedRun = payrollRuns.find(r => r.id === selectedRunId);
  
  // Flat employee results for details expansion
  const flatEmployeesReport = useMemo(() => {
    if (!selectedRun) return [];
    
    const combined: any[] = results.map(r => ({ ...r, source: 'Bank' }));
    const monthTransactions = allTransactions.filter(t => t.month === selectedRun.month);
    monthTransactions.forEach(t => {
      const emp = employees.find(e => e.id === t.employeeId);
      if (emp?.paymentMethod === 'Cash' || (emp?.paymentMethod as any) === 'كاش') {
        combined.push({ ...t, source: 'Cash' });
      }
    });

    return combined.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const dept = (r.costCenterDept || emp?.costCenterDept || r.department || '').trim();
      const rawSectorValue = r.sectors || emp?.sectors || r.sector || '';
      return {
        ...r,
        employeeId: emp?.employeeId || '---',
        employeeName: emp?.name || '---',
        costCenterDept: dept,
        sectorName: getNormalizedSector(rawSectorValue, dept),
        basic: Number(r.basicSalary) || 0,
        netSalary: Number(r.netSalary) || 0,
      };
    });
  }, [results, allTransactions, employees, selectedRun, costCenterDepts]);

  // Detailed report data logic
  const detailedReportData = useMemo(() => {
    if (!selectedRun) return { sectors: [], totalBasic: 0, totalNet: 0, saudiTotal: 0 };

    // Combine results (Bank) and transactions for (Cash)
    const combinedData: any[] = results.map(r => ({ ...r }));
    
    const monthTransactions = allTransactions.filter(t => t.month === selectedRun.month);
    monthTransactions.forEach(t => {
      const emp = employees.find(e => e.id === t.employeeId);
      if (emp?.paymentMethod === 'Cash') {
        combinedData.push({ ...t });
      }
    });

    const grouped: Record<string, Record<string, { basic: number; net: number; mainCC: string; dept: string; names: string[] }>> = {};
    let totalBasic = 0;
    let totalNet = 0;
    let saudiTotal = 0;

    combinedData.forEach(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      
      let dept = (r.costCenterDept || emp?.costCenterDept || r.department || 'غير محدد').trim();
      const normDept = normalizeArabic(dept);
      if (normDept.includes('اداره عامه') || normDept === 'اداره الباحه') dept = 'الإدارة العامة';
      
      let mainCC = (r.costCenterMain || emp?.costCenterMain || 'غير محدد').trim();
      if (normalizeArabic(mainCC).includes('اداره عامه') || normalizeArabic(mainCC) === 'اداره الباحه') mainCC = 'الإدارة العامة';

      const rawSector = (r.sectors || emp?.sectors || r.sector || '').trim();
      const sectorName = getNormalizedSector(rawSector, dept);
      
      // The user wants Saudis based on "Saudi Salaries" classification override
      const isSaudi = sectorName === 'السعوديين' || 
                      (emp?.classification as any) === 'رواتب السعوديين' || 
                      (emp?.classification as any) === 'Saudi Salaries' ||
                      (emp?.classification as any) === 'سعوديين';

      if (isSaudi) {
        saudiTotal += Number(r.netSalary) || 0;
      } else {
        if (!grouped[sectorName]) grouped[sectorName] = {};
        const groupKey = `${mainCC} - ${dept}`;
        if (!grouped[sectorName][groupKey]) {
          grouped[sectorName][groupKey] = { basic: 0, net: 0, mainCC, dept, names: [] };
        }
        
        grouped[sectorName][groupKey].basic += Number(r.basicSalary) || 0;
        grouped[sectorName][groupKey].net += Number(r.netSalary) || 0;
        if (emp && !grouped[sectorName][groupKey].names.includes(emp.name)) {
          grouped[sectorName][groupKey].names.push(emp.name);
        }
        
        totalBasic += Number(r.basicSalary) || 0;
        totalNet += Number(r.netSalary) || 0;
      }
    });

    const sectorsArray = Object.entries(grouped).map(([sectorName, entries]) => ({
      name: sectorName,
      branches: Object.values(entries).map((item: any) => ({
        name: item.dept,
        mainCC: item.mainCC,
        basic: item.basic,
        net: item.net,
        names: item.names
      })).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
      sectorBasic: Object.values(entries).reduce((a, b) => a + (b as any).basic, 0),
      sectorNet: Object.values(entries).reduce((a, b) => a + (b as any).net, 0)
    })).sort((a, b) => {
      const idxA = sectorOrder.indexOf(a.name);
      const idxB = sectorOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, 'ar');
    });

    return { sectors: sectorsArray, totalBasic, totalNet, saudiTotal };
  }, [results, employees, costCenterDepts, allTransactions, selectedRun]);

  const globalTotals = useMemo(() => {
    if (!selectedRun) return { bankSalaries: 0, cashSalaries: 0 };
    
    let bank = 0;
    let cash = 0;
    
    // Bank salaries come from the run results
    results.forEach(r => {
      bank += (Number(r.netSalary) || 0);
    });

    // Cash salaries come from all transactions for that month for Cash employees
    const monthTransactions = allTransactions.filter(t => t.month === selectedRun.month);
    monthTransactions.forEach(t => {
      const emp = employees.find(e => e.id === t.employeeId);
      if (emp?.paymentMethod === 'Cash' || (emp?.paymentMethod as any) === 'كاش') {
        cash += (Number(t.netSalary) || 0);
      }
    });

    return { bankSalaries: Number(bank.toFixed(2)), cashSalaries: Number(cash.toFixed(2)) };
  }, [results, employees, allTransactions, selectedRun]);

  const reportData = useMemo(() => {
    if (!selectedRun) return [];

    // Combine results (Bank) and transactions for (Cash)
    const combinedData: any[] = results.map(r => ({ ...r }));
    
    const monthTransactions = allTransactions.filter(t => t.month === selectedRun.month);
    monthTransactions.forEach(t => {
      const emp = employees.find(e => e.id === t.employeeId);
      if (emp?.paymentMethod === 'Cash' || (emp?.paymentMethod as any) === 'كاش') {
        combinedData.push({ ...t });
      }
    });

    // Group items by normalized sector name
    const groupedResults: Record<string, any[]> = {};
    combinedData.forEach(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const dept = (r.costCenterDept || emp?.costCenterDept || r.department || '').trim();
      const rawSectorValue = r.sectors || emp?.sectors || r.sector || '';
      const sectorName = getNormalizedSector(rawSectorValue, dept);

      // Filter out Saudi sector from the main list as requested
      if (sectorName === 'السعوديين' || sectorName === 'السعوديين ') return;

      if (!groupedResults[sectorName]) {
        groupedResults[sectorName] = [];
      }
      groupedResults[sectorName].push(r);
    });

    const sectorStats = Object.entries(groupedResults).map(([sectorName, sectorResults]) => {
      const sum = (field: string) => 
        sectorResults.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);

      const basic = sum('basicSalary');
      const housing = sum('housingAllowance');
      const transport = sum('transportAllowance');
      const subsistence = sum('subsistenceAllowance');
      const otherAllowances = sum('otherAllowances');
      const mobile = sum('mobileAllowance');
      const management = sum('managementAllowance');
      const otherIncome = sum('otherIncome') + sum('salaryIncrease');
      const otHours = sum('overtimeHours');
      const otAmount = sum('overtimeValue');
      const totalIncome = sum('totalIncome');

      const gosi = sum('socialInsurance');
      const cash = sum('salaryReceived');
      const loans = sum('loans');
      const otherDeductions = sum('otherDeductions');
      const delayDeduction = sum('delayDeduction');
      const absenceDeduction = sum('absenceDeduction');
      const totalDeductions = sum('totalDeductions');
      const netSalary = sum('netSalary');
      const absenceDays = sum('absenceDays');
      const deductionHours = sum('deductionHours');

      const bankSalaries = sectorResults.reduce((acc, curr) => {
        const emp = employees.find(e => e.id === curr.employeeId);
        const pm = curr.paymentMethod || emp?.paymentMethod;
        return acc + (pm === 'Bank' ? (Number(curr.netSalary) || 0) : 0);
      }, 0);

      const cashSalaries = sectorResults.reduce((acc, curr) => {
        const emp = employees.find(e => e.id === curr.employeeId);
        const pm = curr.paymentMethod || emp?.paymentMethod;
        return acc + (pm === 'Cash' || (pm as any) === 'كاش' ? (Number(curr.netSalary) || 0) : 0);
      }, 0);

      return {
        sectorName,
        basic,
        housing,
        transport,
        subsistence,
        otherAllowances,
        mobile,
        management,
        otherIncome,
        otHours,
        otAmount,
        totalIncome,
        gosi,
        cash,
        loans,
        otherDeductions,
        deductionHours,
        delayDeduction,
        absenceDays,
        absenceDeduction,
        totalDeductions,
        netSalary,
        bankSalaries,
        cashSalaries
      };
    }).filter(s => s.totalIncome > 0 || s.totalDeductions > 0)
      .sort((a, b) => {
        const idxA = sectorOrder.indexOf(a.sectorName);
        const idxB = sectorOrder.indexOf(b.sectorName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.sectorName.localeCompare(b.sectorName, 'ar');
      });

    return sectorStats;
  }, [results, employees, allTransactions, selectedRun, costCenterDepts]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      basic: acc.basic + curr.basic,
      housing: acc.housing + curr.housing,
      transport: acc.transport + curr.transport,
      subsistence: acc.subsistence + curr.subsistence,
      otherAllowances: acc.otherAllowances + curr.otherAllowances,
      mobile: acc.mobile + curr.mobile,
      management: acc.management + curr.management,
      otherIncome: acc.otherIncome + curr.otherIncome,
      otHours: acc.otHours + curr.otHours,
      otAmount: acc.otAmount + curr.otAmount,
      totalIncome: acc.totalIncome + curr.totalIncome,
      gosi: acc.gosi + curr.gosi,
      cash: acc.cash + curr.cash,
      loans: acc.loans + curr.loans,
      otherDeductions: acc.otherDeductions + curr.otherDeductions,
      deductionHours: acc.deductionHours + curr.deductionHours,
      delayDeduction: acc.delayDeduction + curr.delayDeduction,
      absenceDays: acc.absenceDays + curr.absenceDays,
      absenceDeduction: acc.absenceDeduction + curr.absenceDeduction,
      totalDeductions: acc.totalDeductions + curr.totalDeductions,
      netSalary: acc.netSalary + curr.netSalary,
      bankSalaries: acc.bankSalaries + curr.bankSalaries,
      cashSalaries: acc.cashSalaries + curr.cashSalaries,
    }), {
      basic: 0, housing: 0, transport: 0, subsistence: 0, otherAllowances: 0, mobile: 0, 
      management: 0, otherIncome: 0, otHours: 0, otAmount: 0, totalIncome: 0, gosi: 0, 
      cash: 0, loans: 0, otherDeductions: 0, deductionHours: 0, delayDeduction: 0, 
      absenceDays: 0, absenceDeduction: 0, totalDeductions: 0, netSalary: 0,
      bankSalaries: 0, cashSalaries: 0
    });
  }, [reportData]);

  const exportExcel = () => {
    if (!selectedRun) return;

    // Prepare header info
    const reportTitle = [['ملخص العام رواتب شهر ' + selectedRun.month + ' م لمجموعة شركة صالح سعيد طيشان واولاده']];
    
    // Header for the table
    const headers = [[
      'القطاع', 
      'الراتب الاساسي', 
      'بدل سكن', 
      'بدل نقل', 
      'بدل إعاشة', 
      'بدلات اخرى', 
      'بدل جوال', 
      'بدل ادارة', 
      'اضافة الشهر دخل آخر', 
      'عدد ساعات العمل الاضافي', 
      'قيمة عمل اضافي', 
      'مجموع الدخل', 
      'تأمينات اجتماعية', 
      'استلام راتب', 
      'سلف', 
      'اقتطاعات اخرى', 
      'عدد الساعات', 
      'خصم المغادرات والتاخير', 
      'عدد ايام الغياب', 
      'خصم الغياب', 
      'مجموع الاقتطاعات', 
      'صافي الراتب'
    ]];

    const rows = reportData.map(s => [
      s.sectorName, 
      s.basic, 
      s.housing, 
      s.transport, 
      s.subsistence, 
      s.otherAllowances,
      s.mobile, 
      s.management, 
      s.otherIncome, 
      s.otHours, 
      s.otAmount, 
      s.totalIncome,
      s.gosi, 
      s.cash, 
      s.loans, 
      s.otherDeductions, 
      s.deductionHours,
      s.delayDeduction, 
      s.absenceDays, 
      s.absenceDeduction, 
      s.totalDeductions, 
      s.netSalary
    ]);

    const totalRow = [[
      'الإجمالي', 
      totals.basic, 
      totals.housing, 
      totals.transport, 
      totals.subsistence,
      totals.otherAllowances, 
      totals.mobile, 
      totals.management, 
      totals.otherIncome,
      totals.otHours, 
      totals.otAmount, 
      totals.totalIncome, 
      totals.gosi, 
      totals.cash,
      totals.loans, 
      totals.otherDeductions, 
      totals.deductionHours,
      totals.delayDeduction, 
      totals.absenceDays, 
      totals.absenceDeduction,
      totals.totalDeductions, 
      totals.netSalary
    ]];

    // Summary table data
    const summaryHeader = [
      [], 
      ['ملخص التوزيع حسب القطاعات', '', ''], 
      ['القطاع', 'صافي الراتب', 'النسبة المئوية']
    ];
    const summaryRows = reportData.map(s => [
      s.sectorName, 
      s.netSalary, 
      ((s.netSalary / totals.netSalary) * 100).toFixed(2) + '%'
    ]);
    const summaryTotal = [['الإجمالي', totals.netSalary, '100.00%']];

    // Combine all
    const allData = [
      ...reportTitle,
      [],
      ...headers,
      ...rows,
      ...totalRow,
      ...summaryHeader,
      ...summaryRows,
      ...summaryTotal
    ];

    const ws = XLSX.utils.aoa_to_sheet(allData);
    
    // Set column widths
    const colWidths = [
      { wch: 25 }, // القطاع
      ...Array(21).fill({ wch: 15 }) // rest
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الرواتب");
    XLSX.writeFile(wb, `Salary_Summary_${selectedRun.month.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              {reportType === 'Summary' ? 'ملخص الرواتب حسب القطاعات' : 'التقرير التفصيلي للمجموعة'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {reportType === 'Summary' ? 'تحليل مالي مفصل لمخصصات الرواتب شهرياً' : 'عرض تفصيلي لرواتب المجموعة حسب مراكز التكلفة'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!forcedType && (
            <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-2xl border border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setReportType('Summary')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  reportType === 'Summary' ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                )}
              >
                ملخص القطاعات
              </button>
              <button
                onClick={() => setReportType('Detailed')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  reportType === 'Detailed' ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                )}
              >
                التقرير التفصيلي للمجموعة
              </button>
            </div>
          )}
          <div className="relative">
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <select
              value={selectedRunId}
              onChange={(e) => handleRunChange(e.target.value)}
              className="pr-10 pl-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm min-w-[200px] appearance-none cursor-pointer dark:text-white"
            >
              <option value="" className="dark:bg-gray-900">اختر الشهر...</option>
              {payrollRuns.map(run => (
                <option key={run.id} value={run.id} className="dark:bg-gray-900">{run.month}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={exportExcel}
            disabled={!reportData.length}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50 disabled:shadow-none"
          >
            <Download className="w-5 h-5" />
            تصدير Excel
          </button>
          <button 
            onClick={() => window.print()}
            disabled={!reportData.length}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-black hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm disabled:opacity-50"
          >
            <Printer className="w-5 h-5" />
            طباعة
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-900 p-20 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-100 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 font-bold">جاري إعداد التقرير...</p>
        </div>
      ) : !selectedRunId ? (
        <div className="bg-white dark:bg-gray-900 p-20 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600">
            <Filter className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">بدء التقرير</h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium">يرجى اختيار الشهر لعرض تقرير ملخص الرواتب</p>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 p-20 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-500 dark:text-amber-400">
            <Users className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">لا توجد بيانات</h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium">لم يتم العثور على نتائج رواتب احتساب لهذا الشهر. يرجى التأكد من احتساب الرواتب في صفحة "مسيرات الرواتب".</p>
          </div>
        </div>
      ) : reportData.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 p-20 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-500 dark:text-blue-400">
            <Filter className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">تصنيفات غير متطابقة</h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium">تم العثور على نتائج، ولكن لم يتم تصنيفها ضمن أي قطاع. يرجى مراجعة بيانات القطاعات في ملفات الموظفين.</p>
          </div>
        </div>
      ) : reportType === 'Detailed' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden print:shadow-none print:border-none"
        >
          <div className="p-12 text-center border-b-2 border-gray-50 dark:border-gray-800 flex flex-col gap-6">
            {/* Print Only Header */}
            <div className="hidden print:flex items-center justify-between w-full mb-8">
              <div className="text-right">
                <h1 className="text-xl font-black text-gray-900">شركة صالح سعيد طيشان واولاده</h1>
                <p className="text-xs font-bold text-gray-500">للتجارة والمقاولات</p>
                <div className="mt-2 text-[10px] text-gray-400 font-medium">
                  المملكة العربية السعودية - الباحة
                </div>
              </div>
              <div className="w-24 h-24 flex items-center justify-center">
                <img 
                  src="/src/assets/images/company_logo_placeholder_1778968862348.png" 
                  alt="Logo" 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">التقرير التفصيلي لرواتب المجموعة - {selectedRun.month} م</h2>
            <p className="text-gray-400 dark:text-gray-500 font-bold">مجموعة شركة صالح سعيد طيشان واولاده</p>
            <div className="w-32 h-1.5 bg-blue-600 mx-auto rounded-full mt-4 print:hidden"></div>
          </div>

          <div className="p-8 overflow-x-auto">
            <table className="w-full text-sm border-collapse border-2 border-gray-900 dark:border-gray-700 border-b-4">
              <thead>
                <tr className="bg-[#92d050] text-gray-900">
                  <th className="p-1.5 border-2 border-gray-900 dark:border-gray-700 font-extrabold text-center uppercase tracking-wider w-[20%]">القطاعات</th>
                  <th className="p-1.5 border-2 border-gray-900 dark:border-gray-700 font-extrabold text-center uppercase tracking-wider w-[20%]">مركز التكلفة الرئيسي</th>
                  <th className="p-1.5 border-2 border-gray-900 dark:border-gray-700 font-extrabold text-center uppercase tracking-wider w-[20%]">مركز التكلفة / القسم</th>
                  <th className="p-1.5 border-2 border-gray-900 dark:border-gray-700 font-extrabold text-center uppercase tracking-wider w-[20%]">الراتب الاساسي</th>
                  <th className="p-1.5 border-2 border-gray-900 dark:border-gray-700 font-extrabold text-center uppercase tracking-wider w-[20%]">صافي الرواتب</th>
                </tr>
              </thead>
              <tbody>
                {detailedReportData.sectors.map((sector, sIdx) => (
                  <React.Fragment key={sIdx}>
                    {sector.branches.map((branch, bIdx) => (
                      <tr key={bIdx} className="font-bold text-gray-900 dark:text-gray-300">
                        {bIdx === 0 && (
                          <td 
                            rowSpan={sector.branches.length < 2 ? 1 : sector.branches.length} 
                            className="p-3 border-2 border-gray-900 dark:border-gray-700 text-center align-middle bg-white dark:bg-gray-800 font-black text-sm text-gray-900 dark:text-white"
                          >
                            {sector.name}
                          </td>
                        )}
                        <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center font-black">{branch.mainCC}</td>
                        <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center font-black">
                          <div>{branch.name}</div>
                          {branch.names && branch.names.length > 0 && (
                            <div className="text-[9px] text-gray-400 font-medium mt-1 leading-tight">
                              ({branch.names.join('، ')})
                            </div>
                          )}
                        </td>
                        <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center font-black px-4">{formatCurrency(branch.basic)}</td>
                        <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center font-black px-4">{formatCurrency(branch.net)}</td>
                      </tr>
                    ))}
                    {/* Sector Sub-total row as shown in image (yellow bar) */}
                    <tr className="bg-white dark:bg-gray-800 font-black text-gray-900 dark:text-white h-10">
                      {/* Left side empty or matching layout */}
                      <td className="border-2 border-gray-900 dark:border-gray-700"></td>
                      <td className="border-2 border-gray-900 dark:border-gray-700"></td>
                      <td className="border-2 border-gray-900 dark:border-gray-700"></td>
                      <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center bg-white dark:bg-gray-800 font-black">{formatCurrency(sector.sectorBasic)}</td>
                      <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center bg-yellow-400 dark:bg-yellow-500 font-black text-gray-900">{formatCurrency(sector.sectorNet)}</td>
                    </tr>
                  </React.Fragment>
                ))}
                
                {/* Grand Total Row (Green bar as in image) */}
                <tr className="font-black text-gray-900 dark:text-white">
                  <td colSpan={3} className="p-3 border-2 border-gray-900 dark:border-gray-700 bg-[#00b050] text-center text-white text-lg">الإجمالي</td>
                  <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center font-black bg-white dark:bg-gray-800 text-lg">{formatCurrency(detailedReportData.totalBasic)}</td>
                  <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center font-black bg-[#ff0000] text-white text-lg">
                    {formatCurrency(detailedReportData.totalNet)}
                  </td>
                </tr>

                {/* Separation gap */}
                <tr className="h-4"></tr>

                {/* Saudi Salaries (Yellow bar as in image) */}
                <tr className="font-black text-gray-900 dark:text-white">
                  <td colSpan={4} className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-right pr-4 bg-white dark:bg-gray-800 font-black">رواتب السعوديين</td>
                  <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center bg-yellow-400 dark:bg-yellow-500 text-gray-900 font-black">
                    {formatCurrency(detailedReportData.saudiTotal)}
                  </td>
                </tr>

                {/* Final Total row as in image (red bar) */}
                <tr className="font-black text-gray-900 dark:text-white">
                  <td colSpan={4} className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-right pr-4 bg-white dark:bg-gray-800 font-black">اجماي رواتب شهر {selectedRun.month}</td>
                  <td className="p-1.5 border-2 border-gray-900 dark:border-gray-700 text-center bg-[#ff0000] text-white font-black">
                    {formatCurrency(detailedReportData.totalNet + detailedReportData.saudiTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures footer */}
          <div className="p-12 border-t-2 border-gray-50 dark:border-gray-800 flex items-center justify-between text-center gap-4">
             <div className="flex-1">
               <h3 className="font-black text-base text-gray-400 dark:text-gray-500 mb-8 uppercase tracking-widest">الموارد البشرية</h3>
               <div className="w-full h-0.5 bg-gray-200 dark:bg-gray-800"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-base text-gray-400 dark:text-gray-500 mb-8 uppercase tracking-widest">الإدارة المالية</h3>
               <div className="w-full h-0.5 bg-gray-200 dark:bg-gray-800"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-base text-gray-400 dark:text-gray-500 mb-8 uppercase tracking-widest">ادارة المراجعة</h3>
               <div className="w-full h-0.5 bg-gray-200 dark:bg-gray-800"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-base text-gray-400 dark:text-gray-500 mb-8 uppercase tracking-widest">الرئيس التنفيذي</h3>
               <div className="w-full h-0.5 bg-gray-200 dark:bg-gray-800"></div>
             </div>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden print:shadow-none print:border-none"
        >
          <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex flex-col gap-6">
            {/* Print Only Header */}
            <div className="hidden print:flex items-center justify-between w-full mb-8">
              <div className="text-right">
                <h1 className="text-xl font-black text-gray-900">شركة صالح سعيد طيشان واولاده</h1>
                <p className="text-xs font-bold text-gray-500">للتجارة والمقاولات</p>
                <div className="mt-2 text-[10px] text-gray-400 font-medium">
                  المملكة العربية السعودية - الباحة
                </div>
              </div>
              <div className="w-24 h-24 flex items-center justify-center">
                <img 
                  src="/src/assets/images/company_logo_placeholder_1778968862348.png" 
                  alt="Logo" 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="text-center flex-1">
               <h2 className="text-2xl font-black text-gray-900 dark:text-white">ملخص العام رواتب شهر {selectedRun.month} م لمجموعة شركة صالح سعيد طيشان واولاده</h2>
            </div>
            <div className="flex justify-end print:hidden">
              <button 
                onClick={() => window.print()}
                className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all hover:bg-blue-50 dark:hover:bg-blue-900/20" 
                title="طباعة"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-[10px] text-right border-collapse border border-gray-300 dark:border-gray-700">
              <thead>
                <tr className="bg-white dark:bg-gray-800 border-y border-gray-300 dark:border-gray-700">
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 min-w-[140px] text-center">القطاعات</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">الراتب الاساسي</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">بدل سكن</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">بدل نقل</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">بدل إعاشة</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">بدلات اخرى</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">بدل جوال</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">بدل ادارة</th>
                  <th className="p-2 font-black text-blue-700 dark:text-blue-400 border border-gray-300 dark:border-gray-700 text-center bg-blue-50/20 dark:bg-blue-900/10">اضافة الشهر دخل آخر</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center bg-orange-50/50 dark:bg-orange-900/10">عدد ساعات العمل الاضافي</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center bg-orange-50/50 dark:bg-orange-900/10">قيمة عمل اضافي</th>
                  <th className="p-2 font-black text-blue-800 dark:text-blue-300 border border-gray-300 dark:border-gray-700 text-center bg-blue-100 dark:bg-blue-900/30 font-bold">مجموع الدخل</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">تأمينات اجتماعية</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">استلام راتب</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">سلف</th>
                  <th className="p-2 font-black text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-center">اقتطاعات اخرى</th>
                  <th className="p-2 font-black text-red-700 dark:text-red-400 border border-gray-300 dark:border-gray-700 text-center bg-red-50/50 dark:bg-red-900/10">عدد الساعات</th>
                  <th className="p-2 font-black text-red-700 dark:text-red-400 border border-gray-300 dark:border-gray-700 text-center bg-red-50/50 dark:bg-red-900/10">خصم المغادرات والتاخير</th>
                  <th className="p-2 font-black text-red-700 dark:text-red-400 border border-gray-300 dark:border-gray-700 text-center bg-red-50/50 dark:bg-red-900/10">عدد ايام الغياب</th>
                  <th className="p-2 font-black text-red-700 dark:text-red-400 border border-gray-300 dark:border-gray-700 text-center bg-red-50/50 dark:bg-red-900/10">خصم الغياب</th>
                  <th className="p-2 font-black text-red-800 dark:text-red-300 border border-gray-300 dark:border-gray-700 text-center bg-red-100 dark:bg-red-900/30 font-bold">مجموع الاقتطاعات</th>
                  <th className="p-2 font-black text-emerald-800 dark:text-emerald-300 border border-gray-300 dark:border-gray-700 text-center bg-emerald-100 dark:bg-emerald-900/30 font-bold">صافي الراتب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {reportData.map((s, idx) => (
                  <React.Fragment key={idx}>
                    <tr 
                      onClick={() => setSelectedSectorDetails(selectedSectorDetails === s.sectorName ? null : s.sectorName)}
                      className={cn(
                        "hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group", 
                        idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-[#fefce8]/30 dark:bg-yellow-900/10",
                        selectedSectorDetails === s.sectorName && "bg-blue-50/50 dark:bg-blue-900/20"
                      )}
                    >
                      <td className="p-2 font-black text-gray-900 border border-gray-300 dark:border-gray-700 flex items-center justify-between">
                        <span>{s.sectorName}</span>
                        <ChevronDown className={cn("w-4 h-4 text-gray-400 transform transition-transform group-hover:text-blue-500", selectedSectorDetails === s.sectorName && "rotate-180 text-blue-500")} />
                      </td>
                      <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.basic)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.housing)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.transport)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.subsistence)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.otherAllowances)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.mobile)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.management)}</td>
                    <td className="p-2 text-center font-black text-blue-700 dark:text-blue-400 border border-gray-300 dark:border-gray-700 bg-blue-50/10 dark:bg-blue-900/5 tabular-nums">{formatCurrency(s.otherIncome)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 bg-orange-50/10 dark:bg-orange-900/5 tabular-nums">{s.otHours}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 bg-orange-50/10 dark:bg-orange-900/5 tabular-nums">{formatCurrency(s.otAmount)}</td>
                    <td className="p-2 text-center font-black text-blue-900 dark:text-blue-200 border border-gray-300 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 tabular-nums">{formatCurrency(s.totalIncome)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.gosi)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.cash)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.loans)}</td>
                    <td className="p-2 text-center font-black text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-700 tabular-nums">{formatCurrency(s.otherDeductions)}</td>
                    <td className="p-2 text-center font-black text-red-600 dark:text-red-400 border border-gray-300 dark:border-gray-700 bg-red-50/10 dark:bg-red-900/5 tabular-nums">{s.deductionHours}</td>
                    <td className="p-2 text-center font-black text-red-600 dark:text-red-400 border border-gray-300 dark:border-gray-700 bg-red-50/10 dark:bg-red-900/5 tabular-nums">{formatCurrency(s.delayDeduction)}</td>
                    <td className="p-2 text-center font-black text-red-600 dark:text-red-400 border border-gray-300 dark:border-gray-700 bg-red-50/10 dark:bg-red-900/5 tabular-nums">{s.absenceDays}</td>
                    <td className="p-2 text-center font-black text-red-600 dark:text-red-400 border border-gray-300 dark:border-gray-700 bg-red-50/10 dark:bg-red-900/5 tabular-nums">{formatCurrency(s.absenceDeduction)}</td>
                    <td className="p-2 text-center font-black text-red-900 dark:text-red-200 border border-gray-300 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 tabular-nums">{formatCurrency(s.totalDeductions)}</td>
                    <td className="p-2 text-center font-black text-emerald-900 dark:text-emerald-200 border border-gray-300 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20 tabular-nums">{formatCurrency(s.netSalary)}</td>
                  </tr>
                  
                  {/* Sector Detailed Expansion */}
                  <AnimatePresence>
                    {selectedSectorDetails === s.sectorName && (
                      <tr>
                        <td colSpan={22} className="p-0 border border-gray-300 dark:border-gray-700">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-blue-50/20 dark:bg-blue-900/5 overflow-hidden"
                          >
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-black text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  تفاصيل موظفي {s.sectorName}
                                </h4>
                              </div>
                              <div className="overflow-x-auto rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <table className="w-full text-xs text-right">
                                  <thead className="bg-blue-100/50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 font-black">
                                    <tr>
                                      <th className="p-2 border-l border-blue-200 dark:border-blue-800">الرقم</th>
                                      <th className="p-2 border-l border-blue-200 dark:border-blue-800">اسم الموظف</th>
                                      <th className="p-2 border-l border-blue-200 dark:border-blue-800">القسم / مركز التكلفة</th>
                                      <th className="p-2 border-l border-blue-200 dark:border-blue-800">المرتب الأساسي</th>
                                      <th className="p-2">صافي المستحق</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {flatEmployeesReport
                                      .filter(emp => emp.sectorName === s.sectorName)
                                      .map((emp, eIdx) => (
                                        <tr key={eIdx} className="border-t border-blue-100 dark:border-blue-900/20 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                          <td className="p-2 font-bold tabular-nums">{emp.employeeId}</td>
                                          <td className="p-2 font-black">{emp.employeeName}</td>
                                          <td className="p-2 text-gray-500">{emp.costCenterDept || '---'}</td>
                                          <td className="p-2 font-bold tabular-nums">{formatCurrency(emp.basic)}</td>
                                          <td className="p-2 font-black text-blue-700 dark:text-blue-300 tabular-nums">{formatCurrency(emp.netSalary)}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 dark:bg-gray-800 font-black text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-700">
                <tr className="bg-white dark:bg-gray-900">
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">الاجمالي</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.basic)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.housing)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.transport)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.subsistence)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.otherAllowances)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.mobile)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.management)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-blue-700 dark:text-blue-400 font-black">{formatCurrency(totals.otherIncome)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{totals.otHours}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.otAmount)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50 font-black text-lg">{formatCurrency(totals.totalIncome)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.gosi)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.cash)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.loans)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">{formatCurrency(totals.otherDeductions)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-600 dark:text-red-400 font-black">{totals.deductionHours}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-600 dark:text-red-400 font-black">{formatCurrency(totals.delayDeduction)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-600 dark:text-red-400 font-black">{totals.absenceDays}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-600 dark:text-red-400 font-black">{formatCurrency(totals.absenceDeduction)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 font-black text-lg">{formatCurrency(totals.totalDeductions)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/50 font-black text-lg">{formatCurrency(totals.netSalary)}</td>
                </tr>
                {/* Visual extra rows to match the double total lines in image */}
                <tr className="bg-white dark:bg-gray-900">
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black">الاجمالي</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black tabular-nums">{formatCurrency(totals.basic)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black tabular-nums">{formatCurrency(totals.housing)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black tabular-nums">{formatCurrency(totals.transport)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black tabular-nums">{formatCurrency(totals.subsistence)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black tabular-nums">{formatCurrency(totals.otherAllowances)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black tabular-nums">{formatCurrency(totals.mobile)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-black tabular-nums">{formatCurrency(totals.management)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-blue-700 dark:text-blue-400">{formatCurrency(totals.otherIncome)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{totals.otHours}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{formatCurrency(totals.otAmount)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50">{formatCurrency(totals.totalIncome)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{formatCurrency(totals.gosi)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{formatCurrency(totals.cash)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{formatCurrency(totals.loans)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{formatCurrency(totals.otherDeductions)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-600 dark:text-red-400">0.00</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-600 dark:text-red-400">0.00</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-600 dark:text-red-400">0.00</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-600 dark:text-red-400">0.00</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50">{formatCurrency(totals.totalDeductions)}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/50">{formatCurrency(totals.netSalary)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-12 bg-white dark:bg-gray-900 flex flex-col items-center gap-8 print:p-4">
            <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
              <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-5 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30 flex flex-col gap-1 items-center text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">إجمالي رواتب البنك</span>
                <h4 className="text-xl font-black text-gray-900 dark:text-white">
                  {formatCurrency(globalTotals.bankSalaries)}
                </h4>
              </div>
              <div className="bg-amber-50/50 dark:bg-amber-900/20 p-5 rounded-3xl border border-amber-100/50 dark:border-amber-900/30 flex flex-col gap-1 items-center text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">إجمالي رواتب الكاش</span>
                <h4 className="text-xl font-black text-gray-900 dark:text-white">
                  {formatCurrency(globalTotals.cashSalaries)}
                </h4>
              </div>
            </div>

            <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-none border-2 border-black dark:border-gray-700 overflow-hidden print:w-64">
               <table className="w-full text-xs border-collapse">
                 <thead>
                   <tr className="bg-gray-100 dark:bg-gray-800 border-b-2 border-black dark:border-gray-700 text-gray-900 dark:text-white">
                     <th className="p-2 text-right border-l-2 border-black dark:border-gray-700 font-black">القطاع</th>
                     <th className="p-2 text-center border-l-2 border-black dark:border-gray-700 font-black">القيمة</th>
                     <th className="p-2 text-center font-black">النسبة</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-300 dark:divide-gray-800">
                    {reportData.map((s, idx) => (
                      <tr key={idx} className="text-gray-700 dark:text-gray-300">
                        <td className="p-2 border-l-2 border-black dark:border-gray-700 font-bold">{s.sectorName}</td>
                        <td className="p-2 text-center border-l-2 border-black dark:border-gray-700 font-bold">{formatCurrency(s.netSalary)}</td>
                        <td className="p-2 text-center font-bold">{((s.netSalary / totals.netSalary) * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 dark:bg-gray-800/50 font-black text-gray-900 dark:text-white border-t-2 border-black dark:border-gray-700">
                      <td className="p-2 border-l-2 border-black dark:border-gray-700">الإجمالي</td>
                      <td className="p-2 text-center border-l-2 border-black dark:border-gray-700">{formatCurrency(totals.netSalary)}</td>
                      <td className="p-2 text-center">100.00%</td>
                    </tr>
                 </tbody>
               </table>
            </div>

            <div className="w-full border-t-2 border-gray-100 dark:border-gray-800 pt-12 flex flex-col md:flex-row items-start justify-between gap-12 text-center px-12">
               <div className="flex-1 w-full scale-90 opacity-60 dark:opacity-40 grayscale group hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                 <h3 className="font-black text-xs text-gray-400 dark:text-gray-500 mb-12 uppercase tracking-[0.3em]">الموارد البشرية</h3>
                 <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-800"></div>
                 <p className="mt-4 text-[10px] font-bold text-gray-300 dark:text-gray-600">ختم وتوقيع</p>
               </div>
               <div className="flex-1 w-full scale-100 flex flex-col items-center">
                 <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                   <Shield className="w-8 h-8" />
                 </div>
                 <h3 className="font-black text-xs text-blue-600 dark:text-blue-400 mb-12 uppercase tracking-[0.3em]">الإدارة المالية</h3>
                 <div className="w-full h-1 bg-blue-600 dark:bg-blue-500 rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.2)]"></div>
               </div>
               <div className="flex-1 w-full scale-90 opacity-60 dark:opacity-40 grayscale group hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                 <h3 className="font-black text-xs text-gray-400 dark:text-gray-500 mb-12 uppercase tracking-[0.3em]">الرئيس التنفيذي</h3>
                 <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-800"></div>
                 <p className="mt-4 text-[10px] font-bold text-gray-300 dark:text-gray-600">المصادقة النهائية</p>
               </div>
            </div>
          </div>
          
          {/* Signatures placeholder matching the image footer */}
          <div className="p-12 hidden md:flex items-center justify-between text-center gap-4 print:flex print:mt-12 border-t border-gray-100 dark:border-gray-800">
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8 dark:text-white">الموارد البشرية</h3>
               <div className="w-full h-px bg-gray-400 dark:bg-gray-600"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8 dark:text-white">الإدارة المالية</h3>
               <div className="w-full h-px bg-gray-400 dark:bg-gray-600"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8 dark:text-white">ادارة المراجعة</h3>
               <div className="w-full h-px bg-gray-400 dark:bg-gray-600"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8 dark:text-white">نائب الرئيس التنفيذي</h3>
               <div className="w-full h-px bg-gray-400 dark:bg-gray-600"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8 dark:text-white">الرئيس التنفيذي</h3>
               <div className="w-full h-px bg-gray-400 dark:bg-gray-600"></div>
             </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
