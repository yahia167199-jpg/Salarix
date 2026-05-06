import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Download,
  Filter,
  FileSpreadsheet,
  Building2,
  MapPin,
  Briefcase,
  Globe,
  Settings2,
  Printer
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Employee, EmployeeStatus, PaymentMethod } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

export const Settlements: React.FC = () => {
  const { employees } = useData();
  const [filters, setFilters] = useState({
    searchTerm: '',
    officialEmployer: 'all',
    nationality: 'all',
    location: 'all',
    sector: 'all', // Sector Management
    status: 'all',
    paymentMethod: 'all',
    jobTitle: 'all',
    costCenterMain: 'all',
    costCenterDept: 'all',
    sectors: 'all',
    classification: 'all'
  });

  const filterOptions = useMemo(() => {
    const employers = Array.from(new Set(employees.map(e => e.officialEmployer).filter(Boolean)));
    const nationalities = Array.from(new Set(employees.map(e => e.nationality).filter(Boolean)));
    const locations = Array.from(new Set(employees.map(e => e.location).filter(Boolean)));
    const sectors = Array.from(new Set(employees.map(e => e.sectorManagement).filter(Boolean)));
    const jobs = Array.from(new Set(employees.map(e => e.jobTitle).filter(Boolean)));
    const costCenterMains = Array.from(new Set(employees.map(e => e.costCenterMain).filter(Boolean)));
    const costCenterDepts = Array.from(new Set(employees.map(e => e.costCenterDept).filter(Boolean)));
    const sectors_multi = Array.from(new Set(employees.map(e => e.sectors).filter(Boolean)));
    
    return { employers, nationalities, locations, sectors, jobs, costCenterMains, costCenterDepts, sectors_multi };
  }, [employees]);

  const filteredData = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = (e.name || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) || 
                          (e.employeeId || '').includes(filters.searchTerm);
      const matchEmployer = filters.officialEmployer === 'all' || e.officialEmployer === filters.officialEmployer;
      const matchNationality = filters.nationality === 'all' || e.nationality === filters.nationality;
      const matchLocation = filters.location === 'all' || e.location === filters.location;
      const matchSector = filters.sector === 'all' || e.sectorManagement === filters.sector;
      const matchStatus = filters.status === 'all' || e.status === filters.status;
      const matchMethod = filters.paymentMethod === 'all' || e.paymentMethod === filters.paymentMethod;
      const matchJob = filters.jobTitle === 'all' || e.jobTitle === filters.jobTitle;
      const matchCCMain = filters.costCenterMain === 'all' || e.costCenterMain === filters.costCenterMain;
      const matchCCDept = filters.costCenterDept === 'all' || e.costCenterDept === filters.costCenterDept;
      const matchSectors = filters.sectors === 'all' || e.sectors === filters.sectors;
      const matchClassification = filters.classification === 'all' || e.classification === filters.classification;

      return matchSearch && matchEmployer && matchNationality && matchLocation && matchSector && 
             matchStatus && matchMethod && matchJob && matchCCMain && matchCCDept && matchSectors && matchClassification;
    });
  }, [employees, filters]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, current) => {
      const allowances = (current.allowances || []).reduce((sum, a) => sum + a.amount, 0);
      const gross = current.basicSalary + current.housingAllowance + current.transportAllowance + 
                    current.subsistenceAllowance + current.otherAllowances + 
                    current.mobileAllowance + current.managementAllowance + allowances;
      
      return {
        basic: acc.basic + (current.basicSalary || 0),
        housing: acc.housing + (current.housingAllowance || 0),
        allowances: acc.allowances + (gross - current.basicSalary - current.housingAllowance),
        gross: acc.gross + gross,
        count: acc.count + 1
      };
    }, { basic: 0, housing: 0, allowances: 0, gross: 0, count: 0 });
  }, [filteredData]);

  const handleExportExcel = () => {
    const data = filteredData.map(e => {
      const otherAllowances = (e.allowances || []).reduce((sum, a) => sum + a.amount, 0);
      const totalAllowances = e.transportAllowance + e.subsistenceAllowance + e.otherAllowances + 
                             e.mobileAllowance + e.managementAllowance + otherAllowances;
      const gross = e.basicSalary + e.housingAllowance + totalAllowances;
      
      return {
        'الرقم الوظيفي': e.employeeId,
        'الاسم': e.name,
        'صاحب العمل الرسمي': e.officialEmployer,
        'الجنسية': e.nationality,
        'الوظيفة': e.jobTitle,
        'الموقع': e.location,
        'الحالة': e.status === 'Active' ? 'نشط' : e.status === 'End of Service' ? 'إنهاء خدمات' : e.status === 'Leave' ? 'إجازة' : 'غير نشط',
        'طريقة الاستلام': e.paymentMethod === 'Bank' ? 'بنك' : 'نقدي',
        'الراتب الأساسي': e.basicSalary,
        'بدل السكن': e.housingAllowance,
        'إجمالي البدلات الأخرى': totalAllowances,
        'إجمالي الراتب': gross
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التقرير المفلتر');
    XLSX.writeFile(wb, `Report_Filtered_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Search & Main Filter Card */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              <Filter className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              تصفية البيانات (Filtration)
            </h3>
            <p className="text-gray-400 dark:text-gray-500 font-medium">استخرج تقارير مخصصة بناءً على كافة بيانات الموظفين</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={handleExportExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
            >
              <Download className="w-5 h-5" />
              تصدير المفلتر
            </button>
            <button 
              onClick={() => window.print()}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
            >
              <Printer className="w-5 h-5" />
              طباعة
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Search className="w-3 h-3" /> بحث عام
            </label>
            <input 
              type="text" 
              placeholder="الاسم أو الرقم الوظيفي..."
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
              value={filters.searchTerm}
              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Building2 className="w-3 h-3" /> صاحب العمل
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.officialEmployer}
              onChange={(e) => setFilters({...filters, officialEmployer: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              {filterOptions.employers.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Globe className="w-3 h-3" /> الجنسية
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.nationality}
              onChange={(e) => setFilters({...filters, nationality: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              {filterOptions.nationalities.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Building2 className="w-3 h-3" /> مركز التكلفة / رئيسي
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.costCenterMain}
              onChange={(e) => setFilters({...filters, costCenterMain: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              {filterOptions.costCenterMains.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Building2 className="w-3 h-3" /> مركز التكلفة / قسم
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.costCenterDept}
              onChange={(e) => setFilters({...filters, costCenterDept: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              {filterOptions.costCenterDepts.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <MapPin className="w-3 h-3" /> الموقع
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.location}
              onChange={(e) => setFilters({...filters, location: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              {filterOptions.locations.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Briefcase className="w-3 h-3" /> القطاعات
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.sectors}
              onChange={(e) => setFilters({...filters, sectors: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              {filterOptions.sectors_multi.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Briefcase className="w-3 h-3" /> إدارة القطاع
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.sector}
              onChange={(e) => setFilters({...filters, sector: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              {filterOptions.sectors.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Briefcase className="w-3 h-3" /> الوظيفة
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.jobTitle}
              onChange={(e) => setFilters({...filters, jobTitle: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              {filterOptions.jobs.map(opt => <option key={opt} value={opt} className="dark:bg-gray-900">{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> الحالة
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              <option value="Active" className="dark:bg-gray-900">نشط</option>
              <option value="Inactive" className="dark:bg-gray-900">غير نشط</option>
              <option value="End of Service" className="dark:bg-gray-900">إنهاء خدمات</option>
              <option value="Leave" className="dark:bg-gray-900">إجازة</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> طريقة الاستلام
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.paymentMethod}
              onChange={(e) => setFilters({...filters, paymentMethod: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              <option value="Bank" className="dark:bg-gray-900">استلام بنك</option>
              <option value="Cash" className="dark:bg-gray-900">استلام راتب</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 dark:text-gray-500 mr-2 flex items-center gap-2">
              <Users className="w-3 h-3" /> تصنيف الموظف
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600 dark:text-gray-400"
              value={filters.classification}
              onChange={(e) => setFilters({...filters, classification: e.target.value})}
            >
              <option value="all" className="dark:bg-gray-900">الكل</option>
              <option value="Standard" className="dark:bg-gray-900">موظف عادي</option>
              <option value="Saudi" className="dark:bg-gray-900">السعوديين</option>
              <option value="Accounting" className="dark:bg-gray-900">رواتب المحاسبات</option>
            </select>
          </div>

          <div className="flex items-end">
            <button 
              onClick={() => setFilters({
                searchTerm: '',
                officialEmployer: 'all',
                nationality: 'all',
                location: 'all',
                sector: 'all',
                status: 'all',
                paymentMethod: 'all',
                jobTitle: 'all',
                costCenterMain: 'all',
                costCenterDept: 'all',
                sectors: 'all',
                classification: 'all'
              })}
              className="text-sm font-black text-blue-600 hover:text-blue-700 p-3 h-12 flex items-center gap-2"
            >
              <Users className="w-4 h-4" /> إعادة تعيين الفلاتر
            </button>
          </div>
        </div>
      </div>

      {/* Summary Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-bold text-gray-400 dark:text-gray-500 mb-1 leading-none">عدد الموظفين المفلتر</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{totals.count}</p>
            <Users className="w-8 h-8 text-blue-100 dark:text-blue-900/40" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1 leading-none">إجمالي الراتب الأساسي</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{formatCurrency(totals.basic)}</p>
            <Building2 className="w-8 h-8 text-emerald-100 dark:text-emerald-900/40" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1 leading-none">إجمالي البدلات</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{formatCurrency(totals.allowances + totals.housing)}</p>
            <FileSpreadsheet className="w-8 h-8 text-blue-100 dark:text-blue-900/40" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/20 shadow-sm">
          <p className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1 leading-none">إجمالي الرواتب المفلترة</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-blue-900 dark:text-blue-300 leading-none">{formatCurrency(totals.gross)}</p>
            <Download className="w-8 h-8 text-blue-200 dark:text-blue-800/40" />
          </div>
        </div>
      </div>

      {/* Result Table */}
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
              <th className="px-8 py-5 text-sm font-black text-gray-500 dark:text-gray-400">الموظف</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500 dark:text-gray-400">صاحب العمل</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500 dark:text-gray-400">الموقع</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500 dark:text-gray-400">الحالة</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500 dark:text-gray-400">الأساسي</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500 dark:text-gray-400">البدلات</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500 dark:text-gray-400 text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {filteredData.map(e => {
              const otherAllowances = (e.allowances || []).reduce((sum, a) => sum + a.amount, 0);
              const totalAllowances = e.housingAllowance + e.transportAllowance + e.subsistenceAllowance + 
                                     e.otherAllowances + e.mobileAllowance + e.managementAllowance + otherAllowances;
              return (
                <tr 
                  key={e.id} 
                  className={cn(
                    "transition-colors group",
                    e.status === 'Leave' 
                      ? "bg-gradient-to-br from-blue-900 to-blue-950 text-white hover:from-blue-800 hover:to-blue-900" 
                      : e.status === 'End of Service'
                      ? "bg-gradient-to-br from-red-900 to-red-950 text-white hover:from-red-800 hover:to-red-900"
                      : "hover:bg-gray-50/50 dark:hover:bg-gray-800/50 border-b border-gray-50 dark:border-gray-800"
                  )}
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                        (e.status === 'Leave' || e.status === 'End of Service')
                          ? "bg-white/10 text-white border border-white/20"
                          : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      )}>
                        {e.name[0]}
                      </div>
                      <div>
                        <p className={cn(
                          "font-bold",
                          (e.status === 'Leave' || e.status === 'End of Service') ? "text-white" : "text-gray-900 dark:text-white"
                        )}>{e.name}</p>
                        <p className={cn(
                          "text-xs font-bold",
                          e.status === 'Leave' ? "text-blue-300" : 
                          e.status === 'End of Service' ? "text-red-300" : 
                          "text-gray-400 dark:text-gray-500"
                        )}>#{e.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "text-sm font-bold",
                      (e.status === 'Leave' || e.status === 'End of Service') ? "text-blue-50" : "text-gray-600 dark:text-gray-400"
                    )}>{e.officialEmployer}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "text-sm font-bold",
                      (e.status === 'Leave' || e.status === 'End of Service') ? "text-blue-50" : "text-gray-600 dark:text-gray-400"
                    )}>{e.location}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-black border",
                      e.status === 'Active' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100" : 
                      (e.status === 'Leave' || e.status === 'End of Service') ? "bg-white/10 text-white border-white/30" :
                      "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200"
                    )}>
                      {e.status === 'Active' ? 'نشط' : 
                       e.status === 'Leave' ? 'إجازة' : 
                       e.status === 'End of Service' ? 'إنهاء خدمات' : 
                       e.status === 'Inactive' ? 'غير نشط' : e.status}
                    </span>
                  </td>
                  <td className={cn(
                    "px-8 py-5 text-sm font-bold",
                    (e.status === 'Leave' || e.status === 'End of Service') ? "text-white" : "text-gray-900 dark:text-white"
                  )}>{formatCurrency(e.basicSalary)}</td>
                  <td className={cn(
                    "px-8 py-5 text-sm font-bold",
                    (e.status === 'Leave' || e.status === 'End of Service') ? "text-white" : "text-gray-900 dark:text-white"
                  )}>{formatCurrency(totalAllowances)}</td>
                  <td className={cn(
                    "px-8 py-5 text-sm font-black text-left",
                    e.status === 'Leave' ? "text-blue-200" : 
                    e.status === 'End of Service' ? "text-red-200" : 
                    "text-blue-600 dark:text-blue-400"
                  )}>{formatCurrency(e.basicSalary + totalAllowances)}</td>
                </tr>
              );
            })}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-20 text-center">
                  <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                  </div>
                  <p className="text-gray-400 dark:text-gray-500 font-bold">لا يوجد نتائج تطابق الفلاتر المختارة</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
