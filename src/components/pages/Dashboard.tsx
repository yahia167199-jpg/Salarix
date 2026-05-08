import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  Wallet, 
  Clock,
  ShieldCheck,
  Plane,
  Bell,
  AlertTriangle,
  History,
  ArrowRight
} from 'lucide-react';
import { db } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Employee, PayrollResult } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useMemo } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { getDocs, query, collection, where, writeBatch, doc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { addDays, isBefore, isPast } from 'date-fns';

interface DashboardProps {
  onNavigate?: (tabId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const { employees, payrollRuns, transactions, leaves, companySettings } = useData();
  const [lastResults, setLastResults] = useState<PayrollResult[]>([]);
  const [isFetchingResults, setIsFetchingResults] = useState(false);

  const alertDays = companySettings?.iqamaAlertDays || 60;

  const lastRun = useMemo(() => [...payrollRuns].sort((a, b) => b.month.localeCompare(a.month))[0], [payrollRuns]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!lastRun) return;
      setIsFetchingResults(true);
      try {
        const q = query(collection(db, 'payrollResults'), where('payrollRunId', '==', lastRun.id));
        const snap = await getDocs(q);
        setLastResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollResult)));
      } catch (err) {
        console.error("Error fetching payroll results:", err);
      } finally {
        setIsFetchingResults(false);
      }
    };
    fetchResults();
  }, [lastRun]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.status === 'Active').length;
    const onLeave = employees.filter(e => e.status === 'Leave').length;
    
    const iqamaStats = employees.reduce((acc, emp) => {
      if (emp.nationality?.toLowerCase().includes('saudi')) return acc;
      
      const expiryDate = emp.iqamaExpiryDate ? new Date(emp.iqamaExpiryDate) : null;
      if (!expiryDate || isNaN(expiryDate.getTime())) {
        acc.outOfSponsorship++;
        return acc;
      }

      const today = new Date();
      const alertThreshold = addDays(today, alertDays);

      if (isPast(expiryDate)) {
        acc.expired++;
      } else if (isBefore(expiryDate, alertThreshold)) {
        acc.expiring++;
      }
      return acc;
    }, { expiring: 0, expired: 0, outOfSponsorship: 0 });

    return [
      { id: 'employees', label: 'إجمالي الموظفين', value: total, icon: Users, color: 'blue' },
      { id: 'employees', label: 'موظفين على رأس العمل', value: active, icon: ShieldCheck, color: 'emerald' },
      { id: 'leaves', label: 'خارج المملكة (إجازة)', value: onLeave, icon: Plane, color: 'indigo' },
      { id: 'iqama-renewal', label: 'إقامات تنتهي قريباً', value: iqamaStats.expiring, icon: Clock, color: 'orange' },
      { id: 'iqama-renewal', label: 'إقامات منتهية', value: iqamaStats.expired, icon: AlertTriangle, color: 'red' },
    ];
  }, [employees, alertDays]);

  const chartData = useMemo(() => payrollRuns.slice(-6).map(run => ({
    name: run.month,
    amount: run.totalNet
  })).sort((a, b) => a.name.localeCompare(b.name)), [payrollRuns]);

  const pendingReturns = useMemo(() => {
    return leaves.filter(l => {
      if (l.status !== 'Active') return false;
      const end = new Date(l.endDate);
      if (isNaN(end.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = end.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays <= 3;
    });
  }, [leaves]);

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">لوحة التحكم</h1>
          <p className="text-gray-500 dark:text-gray-400 font-bold">مرحباً بك في نظام إدارة الموارد البشرية والرواتب</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl font-bold text-sm border border-blue-100 dark:border-blue-900/30">
            تاريخ اليوم: {new Date().toLocaleDateString('ar-SA')}
          </div>
        </div>
      </div>

      {/* Alerts for Pending Returns */}
      {pendingReturns.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-orange-200 dark:shadow-none flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
          
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white ring-4 ring-white/10">
              <Bell className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <h3 className="text-2xl font-black mb-2">تنبيه: عودة من الإجازة</h3>
              <p className="text-orange-50 font-bold text-lg opacity-90 max-w-2xl">
                هناك {pendingReturns.length} موظفاً تنتهي إجازاتهم خلال 3 أيام أو انتهت بالفعل. يرجى مراجعة حالاتهم وتأكيد المباشرة.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 relative z-10 w-full lg:w-auto">
            <button 
              onClick={async () => {
                if (!confirm('هل تريد تأكيد عودة جميع الموظفين المباشرين؟')) return;
                try {
                  const batch = writeBatch(db);
                  pendingReturns.forEach(l => {
                    batch.update(doc(db, 'leaves', l.id), { status: 'Completed', returnDate: l.endDate });
                    batch.update(doc(db, 'employees', l.employeeId), { status: 'Active', lastDirectDate: l.endDate });
                  });
                  await batch.commit();
                } catch (err) {
                  console.error("Bulk return error:", err);
                }
              }}
              className="w-full lg:w-auto px-8 py-4 bg-white text-orange-600 rounded-2xl font-black text-lg shadow-xl hover:bg-orange-50 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <Check className="w-6 h-6" />
              تأكيد عودة الجميع
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {stats.map((stat, i) => (
          <button 
            key={i} 
            onClick={() => onNavigate?.(stat.id)}
            className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 group hover:border-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/5 text-right w-full relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500" />
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
              stat.color === 'blue' ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" :
              stat.color === 'emerald' ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" :
              stat.color === 'indigo' ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" :
              stat.color === 'orange' ? "bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400" :
              "bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400"
            )}>
              <stat.icon className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">{stat.label}</p>
            <div className="flex items-end justify-between gap-2">
              <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tighter">{stat.value}</h3>
              <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all transform translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100">
                <ArrowRight className="w-4 h-4 rotate-180" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payroll Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white">نمو الرواتب</h3>
              <p className="text-gray-400 dark:text-gray-500 font-bold">مقارنة إجمالي الرواتب لآخر 6 أشهر</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#2563eb'} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#3b82f6' : '#2563eb'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1f2937' : '#f1f5f9'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: theme === 'dark' ? '#6b7280' : '#94a3b8', fontSize: 13, fontWeight: 700}} 
                  dy={15} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: theme === 'dark' ? '#6b7280' : '#94a3b8', fontSize: 11, fontWeight: 700}} 
                  tickFormatter={(v) => `${v/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)',
                    backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
                    padding: '16px'
                  }}
                  itemStyle={{ 
                    color: theme === 'dark' ? '#ffffff' : '#1e293b',
                    fontSize: '14px',
                    fontWeight: 900
                  }}
                  labelStyle={{
                    color: '#64748b',
                    marginBottom: '8px',
                    fontWeight: 700
                  }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke={theme === 'dark' ? '#3b82f6' : '#2563eb'} 
                  strokeWidth={5} 
                  fillOpacity={1} 
                  fill="url(#colorAmount)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">آخر الحركات</h3>
            <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400">
              <History className="w-5 h-5" />
            </div>
          </div>
          
          <div className="flex-1 space-y-5 overflow-y-auto custom-scrollbar pr-2">
            {transactions.slice(0, 7).map((t) => (
              <div key={t.id} className="p-4 rounded-[1.5rem] bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 dark:text-white mb-0.5 truncate max-w-[120px]">
                      {employees.find(e => e.id === t.employeeId)?.name || 'موظف'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.month}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400">{formatCurrency(t.netSalary)}</p>
                  <p className="text-[10px] text-gray-400 font-bold">صافي الراتب</p>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                <History className="w-12 h-12 mb-4" />
                <p className="font-bold">لا توجد حركات مؤخراً</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => onNavigate?.('transactions')}
            className="mt-8 w-full py-4 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all group"
          >
            عرض كل الحركات
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 rotate-180" />
          </button>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* On Leave Stats */}
        <button 
          onClick={() => onNavigate?.('leaves')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-sm border border-gray-100 dark:border-gray-800 text-right w-full group hover:border-indigo-500/30 transition-all"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">خارج المملكة</h3>
            <span className="px-5 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-2xl text-xs font-black">
              {employees.filter(e => e.status === 'Leave').length} موظفاً حالياً
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {employees.filter(e => e.status === 'Leave').slice(0, 4).map((emp) => (
              <div key={emp.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center gap-4 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Plane className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 dark:text-white truncate">{emp.name}</p>
                  <p className="text-xs text-gray-400 font-bold">{emp.location || 'غير محدد'}</p>
                </div>
              </div>
            ))}
            {employees.filter(e => e.status === 'Leave').length === 0 && (
              <div className="col-span-2 py-8 text-center opacity-40">
                <p className="font-bold text-gray-500">جميع الموظفين على رأس العمل</p>
              </div>
            )}
          </div>
        </button>

        {/* Expiring Iqamas Highlight */}
        <button 
          onClick={() => onNavigate?.('iqama-renewal')}
          className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-sm border border-gray-100 dark:border-gray-800 text-right w-full group hover:border-orange-500/30 transition-all"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">تجديد الإقامات</h3>
            <span className="px-5 py-2 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-2xl text-xs font-black">
              يتطلب إجراء
            </span>
          </div>
          <div className="space-y-4">
            {employees
              .filter(e => {
                if (!e.iqamaExpiryDate || e.nationality?.toLowerCase().includes('saudi')) return false;
                const expiry = new Date(e.iqamaExpiryDate);
                const threshold = addDays(new Date(), alertDays);
                return isBefore(expiry, threshold);
              })
              .slice(0, 3)
              .map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/30 dark:bg-gray-800/20 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 transition-colors">
                  <div className="flex items-center gap-3 text-right">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                      isPast(new Date(emp.iqamaExpiryDate!)) ? "bg-red-100 text-red-600 group-hover:bg-red-600 group-hover:text-white" : "bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white"
                    )}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900 dark:text-white">{emp.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold">ينتهي في: {emp.iqamaExpiryDate}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-black",
                    isPast(new Date(emp.iqamaExpiryDate!)) ? "bg-red-500 text-white" : "bg-orange-500 text-white"
                  )}>
                    {isPast(new Date(emp.iqamaExpiryDate!)) ? 'منتهية' : 'تنتهي قريباً'}
                  </div>
                </div>
              ))}
            {employees.length > 0 && employees.filter(e => {
                if (!e.iqamaExpiryDate || e.nationality?.toLowerCase().includes('saudi')) return false;
                const expiry = new Date(e.iqamaExpiryDate);
                const threshold = addDays(new Date(), alertDays);
                return isBefore(expiry, threshold);
              }).length === 0 && (
              <div className="py-8 text-center opacity-40">
                <p className="font-bold text-gray-500">جميع الإقامات سارية المفعول</p>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};

