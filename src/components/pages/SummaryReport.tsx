import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar,
  Filter,
  Users,
  ChevronDown,
  Printer
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '../../contexts/DataContext';
import { formatCurrency, cn } from '../../lib/utils';
import * as XLSX from 'xlsx';
import { PayrollRun, PayrollResult } from '../../types';
import { collection, query, where, getDocs, db } from '../../firebase';

interface SummaryReportProps {
  forcedType?: 'Summary' | 'Detailed';
}

const sectorOrder = [
  'الادارة العامة',
  'قطاع ص المقاولات والمقاولات',
  'ادارة العقار والاملاك',
  'قطاع الصناعة',
  'قطاع السلع الكماليه',
  'قطاع ورش الصيانه و التصنيع'
];

export const SummaryReport: React.FC<SummaryReportProps> = ({ forcedType }) => {
  const { payrollRuns, employees, sectors, companySettings, costCenterDepts } = useData();
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PayrollResult[]>([]);

  // Use state but initialize with prop if available
  const [reportType, setReportType] = useState<'Summary' | 'Detailed'>(forcedType || 'Summary');

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
    // قطاع ورش الصيانه و التصنيع
    'ورشه الخلاطه': 'قطاع ورش الصيانه و التصنيع',
    // ادارة العقار والاملاك
    'ادارة العقار': 'ادارة العقار والاملاك',
    'ادارة العقار والاملاك': 'ادارة العقار والاملاك',
    // الادارة العامة
    'ادارة الباحة': 'الادارة العامة',
    'الإدارة العامة': 'الادارة العامة',
    'الادارة العامة': 'الادارة العامة'
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

    // Priority 1: Dynamic Mapping from Settings (costCenterDepts)
    const dynamicMapping = costCenterDepts.find(ccd => normalizeArabic(ccd.name) === dNormalized);
    if (dynamicMapping) {
      return dynamicMapping.sectorName;
    }

    // Priority 2: Fallback to the hardcoded mapping (normalized)
    const hardcodedMatch = Object.entries(departmentToSectorMap).find(([key]) => normalizeArabic(key) === dNormalized);
    if (hardcodedMatch) {
      return hardcodedMatch[1];
    }

    // Priority 3: Normalize Sector Name if provided directly
    const s = (sector || '').trim();
    if (!s) return 'غير محدد';
    
    if (s === 'السعوديين' || s.includes('سعودي') || s.includes('سعودي') || s === 'سعوديين') {
      return 'السعوديين';
    }

    if (
      s.includes('مقاولات') || 
      s.includes('ص مقاولات') || 
      normalizeArabic(s).includes('مقاولات') ||
      s === 'قطاع ص المقاولات والمقاولات'
    ) {
      return 'قطاع ص المقاولات والمقاولات';
    }
    
    return s;
  };

  // Detailed report data logic
  const detailedReportData = useMemo(() => {
    if (!results.length) return { sectors: [], totalBasic: 0, totalNet: 0, saudiTotal: 0 };

    const grouped: Record<string, Record<string, { basic: number; net: number; mainCC: string; dept: string }>> = {};
    let totalBasic = 0;
    let totalNet = 0;
    let saudiTotal = 0;

    results.forEach(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      
      // Use the actual current employee department if available, otherwise fallback to stored one
      const dept = (emp?.costCenterDept || r.costCenterDept || (r as any).department || 'غير محدد').trim();
      const mainCC = (emp?.costCenterMain || r.costCenterMain || 'غير محدد').trim();
      
      // Get the sector - prioritize the dynamic mapping from the department
      const rawSector = (emp?.sectors || r.sectors || (r as any).sector || '').trim();
      const sectorName = getNormalizedSector(rawSector, dept);
      
      const isSaudi = sectorName === 'السعوديين' || emp?.nationality === 'سعودي' || emp?.nationality === 'Saudi' || emp?.classification === 'Saudi';

      if (isSaudi) {
        saudiTotal += Number(r.netSalary) || 0;
      } else {
        if (!grouped[sectorName]) grouped[sectorName] = {};
        // Use a composite key for grouping to include mainCC
        const groupKey = `${mainCC} - ${dept}`;
        if (!grouped[sectorName][groupKey]) grouped[sectorName][groupKey] = { basic: 0, net: 0, mainCC, dept };
        
        grouped[sectorName][groupKey].basic += Number(r.basicSalary) || 0;
        grouped[sectorName][groupKey].net += Number(r.netSalary) || 0;
        
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
        net: item.net
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
  }, [results, employees, costCenterDepts]);

  const selectedRun = payrollRuns.find(r => r.id === selectedRunId);

  const reportData = useMemo(() => {
    if (!results.length) return [];

    // Group results by normalized sector name
    const groupedResults: Record<string, PayrollResult[]> = {};
    results.forEach(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const dept = (emp?.costCenterDept || (r as any).department || '').trim();
      const rawSectorValue = emp?.sectors || r.sectors || (r as any).sector || '';
      const sectorName = getNormalizedSector(rawSectorValue, dept);

      // Filter out Saudi sector from the main list as requested
      if (sectorName === 'السعوديين' || sectorName === 'السعوديين ') return;

      if (!groupedResults[sectorName]) {
        groupedResults[sectorName] = [];
      }
      groupedResults[sectorName].push(r);
    });

    const sectorStats = Object.entries(groupedResults).map(([sectorName, sectorResults]) => {
      const sum = (field: keyof PayrollResult) => 
        sectorResults.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);

      const basic = sum('basicSalary');
      const housing = sum('housingAllowance');
      const transport = sum('transportAllowance');
      const subsistence = sum('subsistenceAllowance');
      const otherAllowances = sum('otherAllowances');
      const mobile = sum('mobileAllowance');
      const management = sum('managementAllowance');
      const otherIncome = sum('otherIncome');
      const otHours = sum('overtimeHours');
      const otAmount = sum('overtimeValue');
      const totalIncome = sum('totalIncome');

      const gosi = sum('socialInsurance');
      const cash = sum('salaryReceived');
      const loans = sum('loans');
      const bank = sum('bankReceived');
      const otherDeductions = sum('otherDeductions');
      const delayDeduction = sum('delayDeduction');
      const absenceDeduction = sum('absenceDeduction');
      const totalDeductions = sum('totalDeductions');
      const netSalary = sum('netSalary');
      const absenceDays = sum('absenceDays');
      const deductionHours = sum('deductionHours');

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
        bank,
        otherDeductions,
        deductionHours,
        delayDeduction,
        absenceDays,
        absenceDeduction,
        totalDeductions,
        netSalary
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
  }, [results, employees, costCenterDepts]);

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
      bank: acc.bank + curr.bank,
      otherDeductions: acc.otherDeductions + curr.otherDeductions,
      deductionHours: acc.deductionHours + curr.deductionHours,
      delayDeduction: acc.delayDeduction + curr.delayDeduction,
      absenceDays: acc.absenceDays + curr.absenceDays,
      absenceDeduction: acc.absenceDeduction + curr.absenceDeduction,
      totalDeductions: acc.totalDeductions + curr.totalDeductions,
      netSalary: acc.netSalary + curr.netSalary,
    }), {
      basic: 0, housing: 0, transport: 0, subsistence: 0, otherAllowances: 0, mobile: 0, 
      management: 0, otherIncome: 0, otHours: 0, otAmount: 0, totalIncome: 0, gosi: 0, 
      cash: 0, loans: 0, bank: 0, otherDeductions: 0, deductionHours: 0, delayDeduction: 0, 
      absenceDays: 0, absenceDeduction: 0, totalDeductions: 0, netSalary: 0
    });
  }, [reportData]);

  const exportExcel = () => {
    if (!selectedRun) return;

    // Prepare header info
    const reportTitle = [['ملخص رواتب شهر ' + selectedRun.month + ' م لمجموعة ' + (companySettings?.companyName || '')]];
    
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
      'استلام راتب (كاش)', 
      'سلف', 
      'استلام بنك', 
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
      s.bank, 
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
      totals.bank, 
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
      ...Array(22).fill({ wch: 15 }) // rest
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الرواتب");
    XLSX.writeFile(wb, `Salary_Summary_${selectedRun.month.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              {reportType === 'Summary' ? 'ملخص الرواتب حسب القطاعات' : 'التقرير التفصيلي للمجموعة'}
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {reportType === 'Summary' ? 'تحليل مالي مفصل لمخصصات الرواتب شهرياً' : 'عرض تفصيلي لرواتب المجموعة حسب مراكز التكلفة'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!forcedType && (
            <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
              <button
                onClick={() => setReportType('Summary')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  reportType === 'Summary' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                ملخص القطاعات
              </button>
              <button
                onClick={() => setReportType('Detailed')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all",
                  reportType === 'Detailed' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                التقرير التفصيلي للمجموعة
              </button>
            </div>
          )}
          <div className="relative">
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={selectedRunId}
              onChange={(e) => handleRunChange(e.target.value)}
              className="pr-10 pl-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm min-w-[200px] appearance-none cursor-pointer"
            >
              <option value="">اختر الشهر...</option>
              {payrollRuns.map(run => (
                <option key={run.id} value={run.id}>{run.month}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={exportExcel}
            disabled={!reportData.length}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none"
          >
            <Download className="w-5 h-5" />
            تصدير Excel
          </button>
          <button 
            onClick={() => window.print()}
            disabled={!reportData.length}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
          >
            <Printer className="w-5 h-5" />
            طباعة
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-20 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 font-bold">جاري إعداد التقرير...</p>
        </div>
      ) : !selectedRunId ? (
        <div className="bg-white p-20 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
            <Filter className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">بدء التقرير</h3>
            <p className="text-gray-500 font-medium">يرجى اختيار الشهر لعرض تقرير ملخص الرواتب</p>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
            <Users className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">لا توجد بيانات</h3>
            <p className="text-gray-500 font-medium">لم يتم العثور على نتائج رواتب احتساب لهذا الشهر. يرجى التأكد من احتساب الرواتب في صفحة "مسيرات الرواتب".</p>
          </div>
        </div>
      ) : reportData.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
            <Filter className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">تصنيفات غير متطابقة</h3>
            <p className="text-gray-500 font-medium">تم العثور على نتائج، ولكن لم يتم تصنيفها ضمن أي قطاع. يرجى مراجعة بيانات القطاعات في ملفات الموظفين.</p>
          </div>
        </div>
      ) : reportType === 'Detailed' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden print:shadow-none print:border-none"
        >
          <div className="p-12 text-center border-b-2 border-gray-50">
            <h2 className="text-3xl font-black text-gray-900 mb-2">التقرير التفصيلي لرواتب المجموعة - {selectedRun.month} م</h2>
            <p className="text-gray-400 font-bold">مجموعة {companySettings?.companyName}</p>
            <div className="w-32 h-1.5 bg-blue-600 mx-auto rounded-full mt-4"></div>
          </div>

          <div className="p-8 overflow-x-auto">
            <table className="w-full text-sm border-collapse border-2 border-gray-900 border-b-4">
              <thead>
                <tr className="bg-[#92d050] text-gray-900">
                  <th className="p-1.5 border-2 border-gray-900 font-extrabold text-center uppercase tracking-wider w-[20%]">القطاعات</th>
                  <th className="p-1.5 border-2 border-gray-900 font-extrabold text-center uppercase tracking-wider w-[20%]">مركز التكلفة الرئيسي</th>
                  <th className="p-1.5 border-2 border-gray-900 font-extrabold text-center uppercase tracking-wider w-[20%]">مركز التكلفة / القسم</th>
                  <th className="p-1.5 border-2 border-gray-900 font-extrabold text-center uppercase tracking-wider w-[20%]">الراتب الاساسي</th>
                  <th className="p-1.5 border-2 border-gray-900 font-extrabold text-center uppercase tracking-wider w-[20%]">صافي الرواتب</th>
                </tr>
              </thead>
              <tbody>
                {detailedReportData.sectors.map((sector, sIdx) => (
                  <React.Fragment key={sIdx}>
                    {sector.branches.map((branch, bIdx) => (
                      <tr key={bIdx} className="font-bold text-gray-900">
                        {bIdx === 0 && (
                          <td 
                            rowSpan={sector.branches.length < 2 ? 1 : sector.branches.length} 
                            className="p-3 border-2 border-gray-900 text-center align-middle bg-white font-black text-sm"
                          >
                            {sector.name}
                          </td>
                        )}
                        <td className="p-1.5 border-2 border-gray-900 text-center font-bold">{branch.mainCC}</td>
                        <td className="p-1.5 border-2 border-gray-900 text-center font-bold">{branch.name}</td>
                        <td className="p-1.5 border-2 border-gray-900 text-center font-bold px-4">{formatCurrency(branch.basic)}</td>
                        <td className="p-1.5 border-2 border-gray-900 text-center font-bold px-4">{formatCurrency(branch.net)}</td>
                      </tr>
                    ))}
                    {/* Sector Sub-total row as shown in image (yellow bar) */}
                    <tr className="bg-white font-black text-gray-900 h-10">
                      {/* Left side empty or matching layout */}
                      <td className="border-2 border-gray-900"></td>
                      <td className="border-2 border-gray-900"></td>
                      <td className="border-2 border-gray-900"></td>
                      <td className="p-1.5 border-2 border-gray-900 text-center bg-white font-black">{formatCurrency(sector.sectorBasic)}</td>
                      <td className="p-1.5 border-2 border-gray-900 text-center bg-yellow-400 font-black">{formatCurrency(sector.sectorNet)}</td>
                    </tr>
                  </React.Fragment>
                ))}
                
                {/* Grand Total Row (Green bar as in image) */}
                <tr className="font-black text-gray-900">
                  <td colSpan={3} className="p-3 border-2 border-gray-900 bg-[#00b050] text-center text-white text-lg">الإجمالي</td>
                  <td className="p-1.5 border-2 border-gray-900 text-center font-bold bg-white text-lg">{formatCurrency(detailedReportData.totalBasic)}</td>
                  <td className="p-1.5 border-2 border-gray-900 text-center font-bold bg-[#ff0000] text-white text-lg">
                    {formatCurrency(detailedReportData.totalNet)}
                  </td>
                </tr>

                {/* Separation gap */}
                <tr className="h-4"></tr>

                {/* Saudi Salaries (Yellow bar as in image) */}
                <tr className="font-black text-gray-900">
                  <td colSpan={4} className="p-1.5 border-2 border-gray-900 text-right pr-4 bg-white">رواتب السعوديين</td>
                  <td className="p-1.5 border-2 border-gray-900 text-center bg-yellow-400">
                    {formatCurrency(detailedReportData.saudiTotal)}
                  </td>
                </tr>

                {/* Final Total row as in image (red bar) */}
                <tr className="font-black text-gray-900">
                  <td colSpan={4} className="p-1.5 border-2 border-gray-900 text-right pr-4 bg-white">اجماي رواتب شهر {selectedRun.month}</td>
                  <td className="p-1.5 border-2 border-gray-900 text-center bg-[#ff0000] text-white">
                    {formatCurrency(detailedReportData.totalNet + detailedReportData.saudiTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures footer */}
          <div className="p-12 border-t-2 border-gray-50 flex items-center justify-between text-center gap-4">
             <div className="flex-1">
               <h3 className="font-black text-base text-gray-400 mb-8 uppercase tracking-widest">الموارد البشرية</h3>
               <div className="w-full h-0.5 bg-gray-200"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-base text-gray-400 mb-8 uppercase tracking-widest">الإدارة المالية</h3>
               <div className="w-full h-0.5 bg-gray-200"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-base text-gray-400 mb-8 uppercase tracking-widest">ادارة المراجعة</h3>
               <div className="w-full h-0.5 bg-gray-200"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-base text-gray-400 mb-8 uppercase tracking-widest">الرئيس التنفيذي</h3>
               <div className="w-full h-0.5 bg-gray-200"></div>
             </div>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden print:shadow-none print:border-none"
        >
          <div className="p-8 border-b border-gray-50 flex items-center justify-between">
            <div className="text-center flex-1">
               <h2 className="text-2xl font-black text-gray-900">ملخص رواتب شهر {selectedRun.month} م لمجموعة {companySettings?.companyName}</h2>
            </div>
            <button 
              onClick={() => window.print()}
              className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all hover:bg-blue-50 print:hidden" 
              title="طباعة"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-[10px] text-right border-collapse border border-gray-300">
              <thead>
                <tr className="bg-white border-y border-gray-300">
                  <th className="p-2 font-black text-gray-800 border border-gray-300 min-w-[140px] text-center">القطاعات</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">الراتب الاساسي</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">بدل سكن</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">بدل نقل</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">بدل إعاشة</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">بدلات اخرى</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">بدل جوال</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">بدل ادارة</th>
                  <th className="p-2 font-black text-blue-700 border border-gray-300 text-center bg-blue-50/20">اضافة الشهر دخل آخر</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center bg-orange-50/50">عدد ساعات العمل الاضافي</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center bg-orange-50/50">قيمة عمل اضافي</th>
                  <th className="p-2 font-black text-blue-800 border border-gray-300 text-center bg-blue-100 font-bold">مجموع الدخل</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">تأمينات اجتماعية</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">استلام راتب (كاش)</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">سلف</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">استلام بنك</th>
                  <th className="p-2 font-black text-gray-800 border border-gray-300 text-center">اقتطاعات اخرى</th>
                  <th className="p-2 font-black text-red-700 border border-gray-300 text-center bg-red-50/50">عدد الساعات</th>
                  <th className="p-2 font-black text-red-700 border border-gray-300 text-center bg-red-50/50">خصم المغادرات والتاخير</th>
                  <th className="p-2 font-black text-red-700 border border-gray-300 text-center bg-red-50/50">عدد ايام الغياب</th>
                  <th className="p-2 font-black text-red-700 border border-gray-300 text-center bg-red-50/50">خصم الغياب</th>
                  <th className="p-2 font-black text-red-800 border border-gray-300 text-center bg-red-100 font-bold">مجموع الاقتطاعات</th>
                  <th className="p-2 font-black text-emerald-800 border border-gray-300 text-center bg-emerald-100 font-bold">صافي الراتب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportData.map((s, idx) => (
                  <tr key={idx} className={cn("hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-[#fefce8]/30")}>
                    <td className="p-2 font-bold text-gray-800 border border-gray-300">{s.sectorName}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.basic)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.housing)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.transport)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.subsistence)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.otherAllowances)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.mobile)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.management)}</td>
                    <td className="p-2 text-center font-bold text-blue-600 border border-gray-300 bg-blue-50/10">{formatCurrency(s.otherIncome)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300 bg-orange-50/10">{s.otHours}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300 bg-orange-50/10">{formatCurrency(s.otAmount)}</td>
                    <td className="p-2 text-center font-black text-blue-800 border border-gray-300 bg-blue-50">{formatCurrency(s.totalIncome)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.gosi)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.cash)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.loans)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.bank)}</td>
                    <td className="p-2 text-center text-gray-700 border border-gray-300">{formatCurrency(s.otherDeductions)}</td>
                    <td className="p-2 text-center text-red-500 border border-gray-300 bg-red-50/10">{s.deductionHours}</td>
                    <td className="p-2 text-center text-red-500 border border-gray-300 bg-red-50/10">{formatCurrency(s.delayDeduction)}</td>
                    <td className="p-2 text-center text-red-500 border border-gray-300 bg-red-50/10">{s.absenceDays}</td>
                    <td className="p-2 text-center text-red-500 border border-gray-300 bg-red-50/10">{formatCurrency(s.absenceDeduction)}</td>
                    <td className="p-2 text-center font-black text-red-800 border border-gray-300 bg-red-50">{formatCurrency(s.totalDeductions)}</td>
                    <td className="p-2 text-center font-black text-emerald-800 border border-gray-300 bg-emerald-50">{formatCurrency(s.netSalary)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
                <tr className="bg-white">
                  <td className="p-2 border border-gray-300 text-center font-black">الاجمالي</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.basic)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.housing)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.transport)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.subsistence)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.otherAllowances)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.mobile)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.management)}</td>
                  <td className="p-2 border border-gray-300 text-center text-blue-700">{formatCurrency(totals.otherIncome)}</td>
                  <td className="p-2 border border-gray-300 text-center">{totals.otHours}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.otAmount)}</td>
                  <td className="p-2 border border-gray-300 text-center text-blue-800 bg-blue-100">{formatCurrency(totals.totalIncome)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.gosi)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.cash)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.loans)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.bank)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.otherDeductions)}</td>
                  <td className="p-2 border border-gray-300 text-center text-red-600">{totals.deductionHours}</td>
                  <td className="p-2 border border-gray-300 text-center text-red-600">{formatCurrency(totals.delayDeduction)}</td>
                  <td className="p-2 border border-gray-300 text-center text-red-600">{totals.absenceDays}</td>
                  <td className="p-2 border border-gray-300 text-center text-red-600">{formatCurrency(totals.absenceDeduction)}</td>
                  <td className="p-2 border border-gray-300 text-center text-red-800 bg-red-100">{formatCurrency(totals.totalDeductions)}</td>
                  <td className="p-2 border border-gray-300 text-center text-emerald-800 bg-emerald-100">{formatCurrency(totals.netSalary)}</td>
                </tr>
                {/* Visual extra rows to match the double total lines in image */}
                <tr className="bg-white">
                  <td className="p-2 border border-gray-300 text-center font-black">الاجمالي</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.basic)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.housing)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.transport)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.subsistence)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.otherAllowances)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.mobile)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.management)}</td>
                  <td className="p-2 border border-gray-300 text-center text-blue-700">{formatCurrency(totals.otherIncome)}</td>
                  <td className="p-2 border border-gray-300 text-center">{totals.otHours}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.otAmount)}</td>
                  <td className="p-2 border border-gray-300 text-center text-blue-800 bg-blue-100">{formatCurrency(totals.totalIncome)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.gosi)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.cash)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.loans)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.bank)}</td>
                  <td className="p-2 border border-gray-300 text-center">{formatCurrency(totals.otherDeductions)}</td>
                  <td className="p-2 border border-gray-300 text-center text-red-600">0.00</td>
                  <td className="p-2 border border-gray-300 text-center text-red-600">0.00</td>
                  <td className="p-2 border border-gray-300 text-center text-red-600">0.00</td>
                  <td className="p-2 border border-gray-300 text-center text-red-600">0.00</td>
                  <td className="p-2 border border-gray-300 text-center text-red-800 bg-red-100">{formatCurrency(totals.totalDeductions)}</td>
                  <td className="p-2 border border-gray-300 text-center text-emerald-800 bg-emerald-100">{formatCurrency(totals.netSalary)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-12 bg-white flex flex-col items-center gap-8 print:p-4">
            <div className="w-full max-w-sm bg-white rounded-none border-2 border-black overflow-hidden print:w-64">
               <table className="w-full text-xs border-collapse">
                 <thead>
                   <tr className="bg-gray-100 border-b-2 border-black">
                     <th className="p-2 text-right border-l-2 border-black font-black">القطاع</th>
                     <th className="p-2 text-center border-l-2 border-black font-black">القيمة</th>
                     <th className="p-2 text-center font-black">النسبة</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-300 font-bold">
                   {reportData.map((s, idx) => (
                     <tr key={idx}>
                       <td className="p-2 text-gray-800 border-l-2 border-black text-right">{s.sectorName}</td>
                       <td className="p-2 text-center text-gray-700 border-l-2 border-black">{formatCurrency(s.netSalary)}</td>
                       <td className="p-2 text-center text-blue-700">
                         {((s.netSalary / totals.netSalary) * 100).toFixed(2)}%
                       </td>
                     </tr>
                   ))}
                   <tr className="bg-gray-100 text-black font-black border-t-2 border-black">
                     <td className="p-2 border-l-2 border-black text-right">الإجمالي</td>
                     <td className="p-2 text-center border-l-2 border-black">{formatCurrency(totals.netSalary)}</td>
                     <td className="p-2 text-center">100.00%</td>
                   </tr>
                 </tbody>
               </table>
            </div>
          </div>

          {/* Signatures placeholder matching the image footer */}
          <div className="p-12 hidden md:flex items-center justify-between text-center gap-4 print:flex print:mt-12">
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8">الموارد البشرية</h3>
               <div className="w-full h-px bg-gray-400"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8">الإدارة المالية</h3>
               <div className="w-full h-px bg-gray-400"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8">ادارة المراجعة</h3>
               <div className="w-full h-px bg-gray-400"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8">نائب الرئيس التنفيذي</h3>
               <div className="w-full h-px bg-gray-400"></div>
             </div>
             <div className="flex-1">
               <h3 className="font-black text-xl mb-8">الرئيس التنفيذي</h3>
               <div className="w-full h-px bg-gray-400"></div>
             </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
