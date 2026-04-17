import { Transaction } from '../types';

/**
 * Centralized payroll calculation utility to ensure consistency across the application.
 * All calculations follow the business logic specified for gross base, absence deductions,
 * and overtime values.
 */
export const calculatePayrollDetails = (data: Partial<Transaction> & { overtimeBaseSalary?: number }) => {
  const basicSalary = data.basicSalary || 0;
  const housingAllowance = data.housingAllowance || 0;
  const transportAllowance = data.transportAllowance || 0;
  const subsistenceAllowance = data.subsistenceAllowance || 0;
  const otherAllowances = data.otherAllowances || 0;
  const mobileAllowance = data.mobileAllowance || 0;
  const managementAllowance = data.managementAllowance || 0;
  
  // Requirement: Overtime calculation optionally uses a fixed base salary (from employee file)
  const overtimeBase = data.overtimeBaseSalary !== undefined ? data.overtimeBaseSalary : basicSalary;

  // Default to 8 hours if not provided
  const dailyWorkHours = data.dailyWorkHours || 8;
  const absenceDays = data.absenceDays || 0;
  const overtimeHours = data.overtimeHours || 0;

  // 1. Gross Base: Sum of all recurring monthly components
  const grossBase = basicSalary + housingAllowance + transportAllowance + 
                    subsistenceAllowance + otherAllowances + mobileAllowance + 
                    managementAllowance;

  // 2. Absence Deduction: Pro-rated reduction based on Gross Base (excluding Housing)
  // Equation: ((Gross Base - Housing Allowance) / 30) * Absence Days
  const absenceDeduction = ((grossBase - housingAllowance) / 30) * absenceDays;

  // 3. Overtime Value: Merit-based calculated on defined base salary and defined work hours
  // Equation: (Overtime Base / 30 / Daily Work Hours) * 1.5 * Overtime Hours
  const overtimeValue = (overtimeBase / 30 / dailyWorkHours) * 1.5 * overtimeHours;

  // Other dynamic income
  const otherIncome = data.otherIncome || 0;
  const salaryIncrease = data.salaryIncrease || 0;
  
  // Total Income: All positive earnings
  const totalIncome = grossBase + otherIncome + overtimeValue + salaryIncrease;

  // Deductions from Employee
  const socialInsurance = data.socialInsurance || 0;
  const salaryReceived = data.salaryReceived || 0;
  const bankReceived = data.bankReceived || 0;
  const loans = data.loans || 0;
  const otherDeductions = data.otherDeductions || 0;
  const deductionHours = data.deductionHours || 0;
  const departureDelayDeduction = data.departureDelayDeduction || 0;
  
  // Hour deduction logic (based on daily work hours)
  const hourDeductionValue = (deductionHours * (basicSalary / (30 * dailyWorkHours)));

  // Total Deductions: All negative impacts on net salary
  const totalDeductions = socialInsurance + salaryReceived + bankReceived + loans + 
                          otherDeductions + departureDelayDeduction + 
                          absenceDeduction + hourDeductionValue;

  // Net Salary: Final amount payable to employee
  const netSalary = totalIncome - totalDeductions;

  // Bank Export Specialized Fields (Requested in Requirement 3)
  // Total Salary = bankReceived
  const bankExportAmount = bankReceived;
  // Deductions = Total Income - Bank Received
  const bankDeductions = totalIncome - bankReceived;
  // Other Earnings = Total Income - Basic Salary - Housing Allowance
  const otherEarnings = totalIncome - basicSalary - housingAllowance;

  return {
    grossBase: Number(grossBase.toFixed(2)),
    absenceDeduction: Number(absenceDeduction.toFixed(2)),
    overtimeValue: Number(overtimeValue.toFixed(2)),
    totalIncome: Number(totalIncome.toFixed(2)),
    totalDeductions: Number(totalDeductions.toFixed(2)),
    netSalary: Number(netSalary.toFixed(2)),
    bankExportAmount: Number(bankExportAmount.toFixed(2)),
    bankDeductions: Number(bankDeductions.toFixed(2)),
    otherEarnings: Number(otherEarnings.toFixed(2)),
    salaryReceived: Number(salaryReceived.toFixed(2)),
    bankReceived: Number(bankReceived.toFixed(2)),
    basicSalary: Number(basicSalary.toFixed(2)),
    housingAllowance: Number(housingAllowance.toFixed(2)),
  };
};
