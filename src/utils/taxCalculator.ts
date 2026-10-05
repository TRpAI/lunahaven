import { FiveInsuranceRates, SalaryRecord } from '../types';

export const DEFAULT_INSURANCE_RATES: FiveInsuranceRates = {
  baseSalaryFloor: 4000,
  baseSalaryCap: 35000,
  pensionPersonalRate: 8,
  medicalPersonalRate: 2,
  medicalPersonalExtra: 3, // 大病医保附加
  unemploymentPersonalRate: 0.5,
  housingFundPersonalRate: 12, // 默认 12%

  pensionCompanyRate: 16,
  medicalCompanyRate: 8,
  unemploymentCompanyRate: 0.5,
  injuryCompanyRate: 0.4,
  maternityCompanyRate: 0.8,
  housingFundCompanyRate: 12,

  defaultSpecialDeduction: 3000, // 房贷/租金/子女教育等专项附加扣除
};

/**
 * 计算中国个人所得税（月度标准预扣预缴税率速算表）
 * 适用应纳税所得额 = 应发工资 - 个人五险一金 - 专项附加扣除 - 5000免征额
 */
export function calculatePersonalIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  // 月度累进档次
  if (taxableIncome <= 3000) {
    return taxableIncome * 0.03;
  } else if (taxableIncome <= 12000) {
    return taxableIncome * 0.1 - 210;
  } else if (taxableIncome <= 25000) {
    return taxableIncome * 0.2 - 1410;
  } else if (taxableIncome <= 35000) {
    return taxableIncome * 0.25 - 2660;
  } else if (taxableIncome <= 55000) {
    return taxableIncome * 0.3 - 4410;
  } else if (taxableIncome <= 80000) {
    return taxableIncome * 0.35 - 7160;
  } else {
    return taxableIncome * 0.45 - 15160;
  }
}

/**
 * 自动根据各项工资输入与五险一金费率计算明细
 */
export function calculateSalaryBreakdown(params: {
  baseSalary: number;
  performancePay: number;
  overtimePay: number;
  allowance: number;
  otherBonus: number;
  preTaxDeduction: number;
  specialDeductions: number;
  rates?: FiveInsuranceRates;
  customInsuranceBase?: number; // 自定义社保公积金缴纳基数
  isCustomInsurance?: boolean; // 是否启用五险一金自定义微调金额
  customPersonalInsurance?: {
    pensionPersonal?: number;
    medicalPersonal?: number;
    unemploymentPersonal?: number;
    housingFundPersonal?: number;
  };
  customCompanyInsurance?: {
    pensionCompany?: number;
    medicalCompany?: number;
    unemploymentCompany?: number;
    injuryCompany?: number;
    maternityCompany?: number;
    housingFundCompany?: number;
  };
  otherDeductionsTotal?: number; // 其它扣除项合计 (如企业年金、工会会费、水电房租、考勤扣款等)
}) {
  const rates = params.rates || DEFAULT_INSURANCE_RATES;
  const grossSalary =
    Number(params.baseSalary || 0) +
    Number(params.performancePay || 0) +
    Number(params.overtimePay || 0) +
    Number(params.allowance || 0) +
    Number(params.otherBonus || 0) -
    Number(params.preTaxDeduction || 0);

  // 确定社保公积金缴费基数 (受上下限约束)
  const rawBase = params.customInsuranceBase !== undefined ? params.customInsuranceBase : params.baseSalary;
  const insBase = Math.min(Math.max(rawBase, rates.baseSalaryFloor), rates.baseSalaryCap);

  // 个人五险一金计算 (若开启自定义，则优先采用自定义数值)
  let pensionPersonal = Math.round(insBase * (rates.pensionPersonalRate / 100) * 100) / 100;
  let medicalPersonal = Math.round((insBase * (rates.medicalPersonalRate / 100) + rates.medicalPersonalExtra) * 100) / 100;
  let unemploymentPersonal = Math.round(insBase * (rates.unemploymentPersonalRate / 100) * 100) / 100;
  let housingFundPersonal = Math.round(insBase * (rates.housingFundPersonalRate / 100) * 100) / 100;

  if (params.isCustomInsurance && params.customPersonalInsurance) {
    if (params.customPersonalInsurance.pensionPersonal !== undefined) {
      pensionPersonal = Number(params.customPersonalInsurance.pensionPersonal) || 0;
    }
    if (params.customPersonalInsurance.medicalPersonal !== undefined) {
      medicalPersonal = Number(params.customPersonalInsurance.medicalPersonal) || 0;
    }
    if (params.customPersonalInsurance.unemploymentPersonal !== undefined) {
      unemploymentPersonal = Number(params.customPersonalInsurance.unemploymentPersonal) || 0;
    }
    if (params.customPersonalInsurance.housingFundPersonal !== undefined) {
      housingFundPersonal = Number(params.customPersonalInsurance.housingFundPersonal) || 0;
    }
  }

  const totalPersonalInsurance = Math.round((pensionPersonal + medicalPersonal + unemploymentPersonal + housingFundPersonal) * 100) / 100;

  // 公司五险一金计算
  let pensionCompany = Math.round(insBase * (rates.pensionCompanyRate / 100) * 100) / 100;
  let medicalCompany = Math.round(insBase * (rates.medicalCompanyRate / 100) * 100) / 100;
  let unemploymentCompany = Math.round(insBase * (rates.unemploymentCompanyRate / 100) * 100) / 100;
  let injuryCompany = Math.round(insBase * (rates.injuryCompanyRate / 100) * 100) / 100;
  let maternityCompany = Math.round(insBase * (rates.maternityCompanyRate / 100) * 100) / 100;
  let housingFundCompany = Math.round(insBase * (rates.housingFundCompanyRate / 100) * 100) / 100;

  if (params.isCustomInsurance && params.customCompanyInsurance) {
    if (params.customCompanyInsurance.pensionCompany !== undefined) {
      pensionCompany = Number(params.customCompanyInsurance.pensionCompany) || 0;
    }
    if (params.customCompanyInsurance.medicalCompany !== undefined) {
      medicalCompany = Number(params.customCompanyInsurance.medicalCompany) || 0;
    }
    if (params.customCompanyInsurance.unemploymentCompany !== undefined) {
      unemploymentCompany = Number(params.customCompanyInsurance.unemploymentCompany) || 0;
    }
    if (params.customCompanyInsurance.injuryCompany !== undefined) {
      injuryCompany = Number(params.customCompanyInsurance.injuryCompany) || 0;
    }
    if (params.customCompanyInsurance.maternityCompany !== undefined) {
      maternityCompany = Number(params.customCompanyInsurance.maternityCompany) || 0;
    }
    if (params.customCompanyInsurance.housingFundCompany !== undefined) {
      housingFundCompany = Number(params.customCompanyInsurance.housingFundCompany) || 0;
    }
  }

  const totalCompanyInsurance =
    Math.round((pensionCompany + medicalCompany + unemploymentCompany + injuryCompany + maternityCompany + housingFundCompany) * 100) / 100;

  // 个税计算 (应纳税所得额 = 应发合计 - 个人五险一金 - 专项附加扣除 - 5000起征点)
  const taxThreshold = 5000;
  const specialDeductions = Number(params.specialDeductions || 0);
  const taxableIncome = Math.max(0, grossSalary - totalPersonalInsurance - specialDeductions - taxThreshold);
  const individualIncomeTax = Math.round(calculatePersonalIncomeTax(taxableIncome) * 100) / 100;

  // 实发工资与用人成本 (扣除项: 个人五险一金 + 个税 + 其它自定义扣除项)
  const otherDeductionsTotal = Number(params.otherDeductionsTotal || 0);
  const netSalary = Math.round((grossSalary - totalPersonalInsurance - individualIncomeTax - otherDeductionsTotal) * 100) / 100;
  const companyTotalCost = Math.round((grossSalary + totalCompanyInsurance) * 100) / 100;

  return {
    grossSalary,
    insBase,
    pensionPersonal,
    medicalPersonal,
    unemploymentPersonal,
    housingFundPersonal,
    totalPersonalInsurance,
    pensionCompany,
    medicalCompany,
    unemploymentCompany,
    injuryCompany,
    maternityCompany,
    housingFundCompany,
    totalCompanyInsurance,
    taxThreshold,
    specialDeductions,
    taxableIncome,
    individualIncomeTax,
    netSalary,
    companyTotalCost,
  };
}

/**
 * 格式化金额为 ¥12,345.67
 */
export function formatCurrency(amount: number, hidePrivacy = false): string {
  if (hidePrivacy) return '****';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}
