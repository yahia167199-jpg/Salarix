export type UserRole = 'HR' | 'Finance' | 'Admin' | 'Viewer';

export interface Allowance {
  id?: string;
  type: string;
  amount: number;
}

export interface AllowanceType {
  id: string;
  name: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export type EmployeeStatus = 'Active' | 'Leave' | 'End of Service' | 'Out of Sponsorship' | 'Inactive';
export type PaymentMethod = 'Bank' | 'Cash'; // Bank: استلام بنك, Cash: استلام راتب

export type EmployeeCategory = 'Standard' | 'Saudi' | 'Accounting';

export interface Employee {
  id: string;
  classification?: EmployeeCategory;
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
  paymentMethod: PaymentMethod; // نوع استلام الراتب
  basicSalary: number; // الراتب الاساسي
  housingAllowance: number; // بدل سكن
  transportAllowance: number; // بدل نقل
  subsistenceAllowance: number; // بدل إعاشه
  otherAllowances: number; // بدلات اخرى
  mobileAllowance: number; // بدل جوال
  managementAllowance: number; // بدل ادارة
  dailyWorkHours: number; // عدد ساعات يوم العمل
  status: EmployeeStatus;
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
  dailyWorkHours: number; // عدد ساعات يوم العمل
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

export interface PayrollAdjustment {
  label: string;
  amount: number;
}

export interface PayrollResult {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  iqamaNumber?: string;
  officialEmployer?: string;
  location?: string;
  paymentMethod?: PaymentMethod;
  bankAccount: string;
  bankCode?: string;

  // Financial fields
  basicSalary: number;
  housingAllowance: number;
  grossBase: number;
  totalIncome: number;
  overtimeValue: number;
  absenceDeduction: number;
  totalDeductions: number;
  salaryReceived: number;
  bankReceived: number;
  otherEarnings: number;
  bankExportAmount: number;
  cashExportAmount: number;
  netSalary: number;
  roundingDiff?: number;
  adjustments?: PayrollAdjustment[];
}

export interface Branch {
  id: string;
  name: string;
}

export interface Sector {
  id: string;
  name: string;
}

export interface Management {
  id: string;
  name: string;
}

export interface CompanySettings {
  companyName: string;
  logoUrl?: string;
  systemPassword?: string;
}
