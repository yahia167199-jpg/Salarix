export type UserRole = 'HR' | 'Finance' | 'Admin' | 'Viewer';

export interface Allowance {
  type: string;
  amount: number;
}

export interface AllowanceType {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  employeeId: string; // الرقم الوظيفي
  name: string; // الإسم
  iqamaNumber: string; // رقم الإقامة
  officialEmployer: string; // صاحب العمل الرسمي
  professionAsPerIqama: string; // المهنة حسب الاقامة
  nationality: string; // الجنسية
  jobTitle: string; // الوظيفة
  joinDate: string; // بداية العمل
  lastDirectDate: string; // آخر مباشرة
  sectorManagement: string; // ادارة القطاع
  sectors: string; // القطاعات
  costCenterMain: string; // مركز التكلفة / رئيسي
  costCenterDept: string; // مركز التكلفة / قسم
  location: string; // الموقع
  bankAccount: string; // الايبــــــــــان
  bankCode: string; // كود البنك
  basicSalary: number; // الراتب الاساسي
  housingAllowance: number; // بدل سكن
  transportAllowance: number; // بدل نقل
  subsistenceAllowance: number; // بدل إعاشه
  otherAllowances: number; // بدلات اخرى
  mobileAllowance: number; // بدل جوال
  managementAllowance: number; // بدل ادارة
  status: 'Active' | 'Inactive';
  allowances: Allowance[]; // Dynamic allowances from DDL
  role?: UserRole;
  email?: string;
}

export interface Transaction {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  actualWorkDays: number; // عدد الايام العمل الفعلي
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  subsistenceAllowance: number;
  otherAllowances: number;
  mobileAllowance: number;
  managementAllowance: number;
  otherIncome: number; // اضافة الشهر دخل آخر
  overtimeHours: number; // عدد ساعات العمل الاضافي
  overtimeValue: number; // قيمة عمل اضافي
  totalIncome: number; // مجموع الدخل
  socialInsurance: number; // تامينات اجتماعية
  salaryReceived: number; // استلام راتب
  loans: number; // سلف
  bankReceived: number; // استلام بنك
  otherDeductions: number; // اقتطاعات اخرى
  deductionHours: number; // عدد الساعات
  departureDelayDeduction: number; // خصم المغادرات والتاخير
  absenceDays: number; // عدد ايام الغياب
  absenceDeduction: number; // خصم الغياب
  totalDeductions: number; // مجموع الاقتطاعات
  netSalary: number; // صافي الراتب
  status: string; // الحالة
  salaryIncrease: number; // زيادة راتب
  notes: string; // ملاحظات
  createdAt: any;
}

export interface PayrollRun {
  id: string;
  month: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Locked';
  totalNet: number;
  employeeCount: number;
  updatedAt: any;
}

export interface PayrollResult {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  basicSalary: number;
  allowances: number;
  overtime: number;
  deductions: number;
  netSalary: number;
  bankAccount: string;
  bankCode?: string;
}
