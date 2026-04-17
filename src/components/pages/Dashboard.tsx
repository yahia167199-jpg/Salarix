import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  ShieldCheck,
  Plane
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { Employee, PayrollRun, Transaction, PayrollResult } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { getDocs, query, collection, where } from 'firebase/firestore';

export const Dashboard: React.FC = () => {
  const { employees, payrollRuns, transactions } = useData();
  const [lastResults, setLastResults] = useState<PayrollResult[]>([]);
  const [isFetchingResults, setIsFetchingResults] = useState(false);

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

  const payrollStats = useMemo(() => {
    if (!lastRun || lastResults.length === 0) return null;

    // Branches
    const branchesMap = lastResults.reduce((acc: any, curr) => {
      const b = curr.officialEmployer || 'غير محدد';
      acc[b] = (acc[b] || 0) + curr.netSalary;
      return acc;
    }, {});

    const bankTotal = lastResults.filter(r => r.paymentMethod === 'Bank').reduce((sum, r) => sum + r.netSalary, 0);
    const cashTotal = lastResults.filter(r => r.paymentMethod === 'Cash').reduce((sum, r) => sum + r.netSalary, 0);
    const totalNet = bankTotal + cashTotal;

    // Reconciliation (Standard only)
    const certifiedBank = lastResults
      .filter(r => r.paymentMethod === 'Bank')
      .filter(r => {
        const emp = employees.find(e => e.employeeId === r.employeeId || e.id === r.employeeId);
        return !emp?.classification || emp.classification === 'Standard';
      })
      .reduce((sum, r) => sum + r.netSalary, 0);

    const accountingTotal = lastResults.reduce((sum, r) => {
      const emp = employees.find(e => e.employeeId === r.employeeId || e.id === r.employeeId);
      return emp?.classification === 'Accounting' ? sum + r.netSalary : sum;
    }, 0);

    const saudiTotal = lastResults.reduce((sum, r) => {
      const emp = employees.find(e => e.employeeId === r.employeeId || e.id === r.employeeId);
      return emp?.classification === 'Saudi' ? sum + r.netSalary : sum;
    }, 0);

    const breakdownSum = accountingTotal + saudiTotal;
    const excessDiff = bankTotal - certifiedBank;
    const roundingDiff = Number((excessDiff - breakdownSum).toFixed(2));

    return {
      branches: Object.entries(branchesMap).map(([name, amount]) => ({ name, amount: amount as number })),
      bankTotal,
      cashTotal,
      totalNet,
      certifiedBank,
      accountingTotal,
      saudiTotal,
      breakdownSum,
      excessDiff,
      roundingDiff,
      month: lastRun.month
    };
  }, [lastRun, lastResults, employees]);

  const totalEmployeesCount = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const totalPayroll = lastRun?.totalNet || 0;

  const stats = useMemo(() => [
    { label: 'إجمالي الموظفين', value: totalEmployeesCount, icon: Users, color: 'blue', trend: '+2%' },
    { label: 'الموظفين النشطين', value: activeEmployees, icon: ShieldCheck, color: 'green', trend: 'مستقر' },
    { label: 'إجمالي رواتب الشهر', value: formatCurrency(totalPayroll), icon: Wallet, color: 'indigo', trend: '+1.5%' },
    { label: 'حركات الشهر', value: transactions.length, icon: Clock, color: 'orange', trend: 'جديد' },
  ], [totalEmployeesCount, activeEmployees, totalPayroll, transactions.length]);

  const chartData = useMemo(() => payrollRuns.slice(-6).map(run => ({
    name: run.month,
    amount: run.totalNet
  })), [payrollRuns]);

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                stat.color === 'green' ? "bg-emerald-50 text-emerald-600" :
                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                "bg-orange-50 text-orange-600"
              )}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-gray-50 text-gray-500 rounded-lg">{stat.trend}</span>
            </div>
            <p className="text-sm font-bold text-gray-500 mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-gray-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Detailed Payroll Stats Section */}
      {payrollStats && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">إحصائية رواتب {payrollStats.month}</h3>
                <p className="text-sm text-gray-400 font-medium">تحليل شامل للتوزيع المالي</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Branch Summary Table */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
                <h4 className="text-sm font-black text-amber-900 mb-4 opacity-70">إجمالي الفروع (صاحب العمل)</h4>
                <div className="space-y-3">
                  {payrollStats.branches.map((b, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-800">{b.name}</span>
                      <span className="font-black text-amber-900">{formatCurrency(b.amount)}</span>
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-t border-amber-200 flex items-center justify-between">
                    <span className="text-sm font-black text-amber-900">المجموع الكلي</span>
                    <span className="text-lg font-black text-amber-900">{formatCurrency(payrollStats.totalNet)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reconciliation and Differences */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Main Payroll Totals */}
              <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="relative z-10 space-y-5">
                  <div className="flex justify-between items-center text-blue-100 text-xs font-black uppercase">
                    <span>رواتب موظفين البنك</span>
                    <span className="font-mono text-sm">{formatCurrency(payrollStats.bankTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-blue-100 text-xs font-black uppercase">
                    <span>رواتب موظفين الكاش</span>
                    <span className="font-mono text-sm">{formatCurrency(payrollStats.cashTotal)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/20 flex justify-between items-center">
                    <span className="text-sm font-black">إجمالي الموظفين</span>
                    <span className="text-2xl font-black">{formatCurrency(payrollStats.totalNet)}</span>
                  </div>
                  <div className={cn(
                    "mt-4 p-3 rounded-xl flex items-center justify-between text-xs font-black",
                    Math.abs(payrollStats.totalNet - (payrollStats.bankTotal + payrollStats.cashTotal)) > 0.1 
                      ? "bg-red-500/20 text-red-100" 
                      : "bg-white/10 text-white"
                  )}>
                    <span>الفرق</span>
                    <span>{formatCurrency(payrollStats.totalNet - (payrollStats.bankTotal + payrollStats.cashTotal))}</span>
                  </div>
                </div>
              </div>

              {/* Special Categories and Rounding */}
              <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-500">رواتب المحاسبات</span>
                    <span className="font-black text-gray-900">{formatCurrency(payrollStats.accountingTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-500">رواتب السعوديين</span>
                    <span className="font-black text-gray-900">{formatCurrency(payrollStats.saudiTotal)}</span>
                  </div>
                  <div className="pt-4 mt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-blue-600 uppercase">إجمالي الفرق بالزيادة</span>
                      <span className="text-lg font-black text-blue-600">{formatCurrency(payrollStats.breakdownSum)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                      <span className="text-xs font-bold text-gray-400">فرق جبر الكسور</span>
                      <span className="text-sm font-black text-gray-900">{formatCurrency(payrollStats.roundingDiff)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-gray-900">تحليل الرواتب</h3>
              <p className="text-sm text-gray-400 font-medium">آخر 6 أشهر</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-gray-900 mb-6">آخر الحركات</h3>
          <div className="space-y-6">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{employees.find(e => e.id === t.employeeId)?.name || 'موظف'}</p>
                  <p className="text-xs text-gray-400 font-medium">صافي الراتب - {t.month}</p>
                </div>
                <span className="text-sm font-black text-blue-600">
                  {formatCurrency(t.netSalary)}
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400 font-medium">لا توجد حركات مؤخراً</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Employees on Leave */}
        <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-gray-900">موظفون في إجازة</h3>
            <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-black">
              {employees.filter(e => e.status === 'Leave').length} حالياً
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {employees.filter(e => e.status === 'Leave').map((emp) => (
              <div key={emp.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl transition-colors group">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 shadow-sm shadow-orange-200/50">
                  <Plane className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{emp.name}</p>
                  <p className="text-xs text-gray-500 font-medium">{emp.jobTitle}</p>
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">الموقع</span>
                  <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg">{emp.location || 'غير محدد'}</span>
                </div>
              </div>
            ))}
            {employees.filter(e => e.status === 'Leave').length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40">
                <Plane className="w-12 h-12 text-gray-300" />
                <p className="font-bold text-gray-400">لا يوجد موظفين في إجازة حالياً</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
