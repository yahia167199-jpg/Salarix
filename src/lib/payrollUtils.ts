import { Transaction, PaymentMethod } from '../types';

/**
 * Centralized payroll calculation utility to ensure consistency across the application.
 * All calculations follow the business logic specified for gross base, absence deductions,
 * and overtime values.
 */
export const calculatePayrollDetails = (data: Partial<Transaction> & { overtimeBaseSalary?: number; paymentMethod?: PaymentMethod }) => {
  const basicSalary = Number(data.basicSalary || 0);
  const housingAllowance = Number(data.housingAllowance || 0);
  const transportAllowance = Number(data.transportAllowance || 0);
  const subsistenceAllowance = Number(data.subsistenceAllowance || 0);
  const otherAllowances = Number(data.otherAllowances || 0);
  const mobileAllowance = Number(data.mobileAllowance || 0);
  const managementAllowance = Number(data.managementAllowance || 0);
  
  // Requirement: Overtime calculation optionally uses a fixed base salary (from employee file)
  const overtimeBase = data.overtimeBaseSalary !== undefined ? Number(data.overtimeBaseSalary) : basicSalary;

  // Default to 8 hours if not provided
  const dailyWorkHours = Number(data.dailyWorkHours || 8);
  const absenceDays = Number(data.absenceDays || 0);
  const overtimeHours = Number(data.overtimeHours || 0);

  // 1. Gross Base: Sum of all recurring monthly components
  const grossBase = basicSalary + housingAllowance + transportAllowance + 
                    subsistenceAllowance + otherAllowances + mobileAllowance + 
                    managementAllowance;

  // 2. Absence Deduction: Pro-rated reduction based on Gross Base (excluding Housing)
  // Equation: ((Gross Base - Housing Allowance) / 30) * Absence Days
  // Use passed absenceDeduction if provided (manual override), otherwise calculate
  const calculatedAbsenceDeduction = ((grossBase - housingAllowance) / 30) * absenceDays;
  const absenceDeduction = (data.absenceDeduction !== undefined && data.absenceDeduction !== 0)
    ? Number(data.absenceDeduction)
    : calculatedAbsenceDeduction;

  // 3. Overtime Value: Merit-based calculated on defined base salary and defined work hours
  // Equation: (Overtime Base / 30 / Daily Work Hours) * 1.5 * Overtime Hours
  // Use passed overtimeValue if provided (manual override), otherwise calculate
  const calculatedOvertimeValue = (overtimeBase / 30 / dailyWorkHours) * 1.5 * overtimeHours;
  const overtimeValue = (data.overtimeValue !== undefined && data.overtimeValue !== 0)
    ? Number(data.overtimeValue)
    : calculatedOvertimeValue;

  // Other dynamic income
  const otherIncome = Number(data.otherIncome || 0);
  const salaryIncrease = Number(data.salaryIncrease || 0);
  
  // Total Income: All positive earnings
  const totalIncome = grossBase + otherIncome + overtimeValue + salaryIncrease;

  // Deductions from Employee
  const socialInsurance = Number(data.socialInsurance || 0);
  const salaryReceived = Number(data.salaryReceived || 0);
  const loans = Number(data.loans || 0);
  const otherDeductions = Number(data.otherDeductions || 0);
  const deductionHours = Number(data.deductionHours || 0);
  const departureDelayDeduction = Number(data.departureDelayDeduction || 0);
  
  // Hour deduction logic (based on daily work hours)
  const hourDeductionValue = (deductionHours * (basicSalary / (30 * dailyWorkHours)));

  // Total Deductions: All negative impacts on net salary
  // delayDeduction will contain both manual delay amounts and calculated hour deductions
  const totalDelayDeduction = departureDelayDeduction + hourDeductionValue;
  
  const totalDeductions = socialInsurance + salaryReceived + loans + 
                          otherDeductions + totalDelayDeduction + 
                          absenceDeduction;

  // Net Salary: Final amount payable to employee
  const netSalary = totalIncome - totalDeductions;

  // Requirement: Final bank and cash payable calculation
  // bankExportAmount should reflect what is actually meant for the bank file
  // If the user provided a specific bankReceived amount, that's the primary target
  // If netSalary is remaining, it should be distributed based on paymentMethod
  const bankExportAmount = (data.paymentMethod === 'Bank' ? netSalary : 0);
  const cashExportAmount = salaryReceived + (data.paymentMethod === 'Cash' ? netSalary : 0);

  // Other Earnings = Total Income - Basic Salary - Housing Allowance
  const otherEarnings = totalIncome - basicSalary - housingAllowance;

  return {
    grossBase: Number(grossBase.toFixed(2)),
    basicSalary: Number(basicSalary.toFixed(2)),
    housingAllowance: Number(housingAllowance.toFixed(2)),
    transportAllowance: Number(transportAllowance.toFixed(2)),
    subsistenceAllowance: Number(subsistenceAllowance.toFixed(2)),
    otherAllowances: Number(otherAllowances.toFixed(2)),
    mobileAllowance: Number(mobileAllowance.toFixed(2)),
    managementAllowance: Number(managementAllowance.toFixed(2)),
    otherIncome: Number(otherIncome.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    overtimeValue: Number(overtimeValue.toFixed(2)),
    salaryIncrease: Number(salaryIncrease.toFixed(2)),
    totalIncome: Number(totalIncome.toFixed(2)),
    socialInsurance: Number(socialInsurance.toFixed(2)),
    salaryReceived: Number(salaryReceived.toFixed(2)),
    loans: Number(loans.toFixed(2)),
    otherDeductions: Number(otherDeductions.toFixed(2)),
    deductionHours: Number(deductionHours.toFixed(2)),
    delayDeduction: Number(totalDelayDeduction.toFixed(2)),
    absenceDays: Number(absenceDays.toFixed(2)),
    absenceDeduction: Number(absenceDeduction.toFixed(2)),
    totalDeductions: Number(totalDeductions.toFixed(2)),
    netSalary: Number(netSalary.toFixed(2)),
    bankExportAmount: Number(bankExportAmount.toFixed(2)),
    cashExportAmount: Number(cashExportAmount.toFixed(2)),
    otherEarnings: Number(otherEarnings.toFixed(2))
  };
};
