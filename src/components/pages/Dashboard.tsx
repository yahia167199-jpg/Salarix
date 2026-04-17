import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { db, collection, query, where, OperationType, handleFirestoreError } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { Employee, PayrollRun, Transaction } from '../../types';
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

export const Dashboard: React.FC = () => {
  const { employees, payrollRuns, transactions } = useData();

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const lastRun = useMemo(() => [...payrollRuns].sort((a, b) => b.month.localeCompare(a.month))[0], [payrollRuns]);
  const totalPayroll = lastRun?.totalNet || 0;

  const stats = useMemo(() => [
    { label: 'إجمالي الموظفين', value: totalEmployees, icon: Users, color: 'blue', trend: '+2%' },
    { label: 'الموظفين النشطين', value: activeEmployees, icon: ShieldCheck, color: 'green', trend: 'مستقر' },
    { label: 'إجمالي رواتب الشهر', value: formatCurrency(totalPayroll), icon: Wallet, color: 'indigo', trend: '+1.5%' },
    { label: 'حركات الشهر', value: transactions.length, icon: Clock, color: 'orange', trend: 'جديد' },
  ], [totalEmployees, activeEmployees, totalPayroll, transactions.length]);

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
    </div>
  );
};
