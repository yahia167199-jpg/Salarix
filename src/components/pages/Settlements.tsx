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
  Settings2
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
    sectors: 'all'
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

      return matchSearch && matchEmployer && matchNationality && matchLocation && matchSector && 
             matchStatus && matchMethod && matchJob && matchCCMain && matchCCDept && matchSectors;
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
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
              <Filter className="w-7 h-7 text-blue-600" />
              تصفية البيانات (Filtration)
            </h3>
            <p className="text-gray-400 font-medium">استخرج تقارير مخصصة بناءً على كافة بيانات الموظفين</p>
          </div>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200"
          >
            <Download className="w-5 h-5" />
            تصدير البيانات المفلترة
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Search className="w-3 h-3" /> بحث عام
            </label>
            <input 
              type="text" 
              placeholder="الاسم أو الرقم الوظيفي..."
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              value={filters.searchTerm}
              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Building2 className="w-3 h-3" /> صاحب العمل
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.officialEmployer}
              onChange={(e) => setFilters({...filters, officialEmployer: e.target.value})}
            >
              <option value="all">الكل</option>
              {filterOptions.employers.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Globe className="w-3 h-3" /> الجنسية
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.nationality}
              onChange={(e) => setFilters({...filters, nationality: e.target.value})}
            >
              <option value="all">الكل</option>
              {filterOptions.nationalities.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Building2 className="w-3 h-3" /> مركز التكلفة / رئيسي
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.costCenterMain}
              onChange={(e) => setFilters({...filters, costCenterMain: e.target.value})}
            >
              <option value="all">الكل</option>
              {filterOptions.costCenterMains.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Building2 className="w-3 h-3" /> مركز التكلفة / قسم
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.costCenterDept}
              onChange={(e) => setFilters({...filters, costCenterDept: e.target.value})}
            >
              <option value="all">الكل</option>
              {filterOptions.costCenterDepts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <MapPin className="w-3 h-3" /> الموقع
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.location}
              onChange={(e) => setFilters({...filters, location: e.target.value})}
            >
              <option value="all">الكل</option>
              {filterOptions.locations.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Briefcase className="w-3 h-3" /> القطاعات
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.sectors}
              onChange={(e) => setFilters({...filters, sectors: e.target.value})}
            >
              <option value="all">الكل</option>
              {filterOptions.sectors_multi.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Briefcase className="w-3 h-3" /> إدارة القطاع
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.sector}
              onChange={(e) => setFilters({...filters, sector: e.target.value})}
            >
              <option value="all">الكل</option>
              {filterOptions.sectors.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Briefcase className="w-3 h-3" /> الوظيفة
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.jobTitle}
              onChange={(e) => setFilters({...filters, jobTitle: e.target.value})}
            >
              <option value="all">الكل</option>
              {filterOptions.jobs.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> الحالة
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all">الكل</option>
              <option value="Active">نشط</option>
              <option value="Inactive">غير نشط</option>
              <option value="End of Service">إنهاء خدمات</option>
              <option value="Leave">إجازة</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-400 mr-2 flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> طريقة الاستلام
            </label>
            <select 
              className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
              value={filters.paymentMethod}
              onChange={(e) => setFilters({...filters, paymentMethod: e.target.value})}
            >
              <option value="all">الكل</option>
              <option value="Bank">استلام بنك</option>
              <option value="Cash">استلام راتب</option>
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
                sectors: 'all'
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
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-sm font-bold text-gray-400 mb-1 leading-none">عدد الموظفين المفلتر</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-gray-900 leading-none">{totals.count}</p>
            <Users className="w-8 h-8 text-blue-100" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-sm font-bold text-emerald-600 mb-1 leading-none">إجمالي الراتب الأساسي</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-gray-900 leading-none">{formatCurrency(totals.basic)}</p>
            <Building2 className="w-8 h-8 text-emerald-100" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-sm font-bold text-blue-600 mb-1 leading-none">إجمالي البدلات</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-gray-900 leading-none">{formatCurrency(totals.allowances + totals.housing)}</p>
            <FileSpreadsheet className="w-8 h-8 text-blue-100" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-blue-100 bg-blue-50/30 shadow-sm">
          <p className="text-sm font-bold text-blue-900 mb-1 leading-none">إجمالي الرواتب المفلترة</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-blue-900 leading-none">{formatCurrency(totals.gross)}</p>
            <Download className="w-8 h-8 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Result Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-8 py-5 text-sm font-black text-gray-500">الموظف</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500">صاحب العمل</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500">الموقع</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500">الحالة</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500">الأساسي</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500">البدلات</th>
              <th className="px-8 py-5 text-sm font-black text-gray-500 text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredData.map(e => {
              const otherAllowances = (e.allowances || []).reduce((sum, a) => sum + a.amount, 0);
              const totalAllowances = e.housingAllowance + e.transportAllowance + e.subsistenceAllowance + 
                                     e.otherAllowances + e.mobileAllowance + e.managementAllowance + otherAllowances;
              return (
                <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center font-bold text-blue-600">
                        {e.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{e.name}</p>
                        <p className="text-xs text-gray-400">#{e.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-gray-600">{e.officialEmployer}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-gray-600">{e.location}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-xs font-black",
                      e.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {e.status === 'Active' ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-gray-900">{formatCurrency(e.basicSalary)}</td>
                  <td className="px-8 py-5 text-sm font-bold text-gray-900">{formatCurrency(totalAllowances)}</td>
                  <td className="px-8 py-5 text-sm font-black text-blue-600 text-left">{formatCurrency(e.basicSalary + totalAllowances)}</td>
                </tr>
              );
            })}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-20 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-10 h-10 text-gray-200" />
                  </div>
                  <p className="text-gray-400 font-bold">لا يوجد نتائج تطابق الفلاتر المختارة</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
