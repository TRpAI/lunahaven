import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Download,
  Edit2,
  FileSpreadsheet,
  Link,
  Moon,
  Plus,
  Receipt,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { FiveInsuranceRates, OvertimeRecord, SalaryCustomItem, SalaryRecord } from '../../types';
import { exportOvertimesToCsv, exportSalariesToCsv, triggerFileDownload } from '../../utils/exportImport';
import { loadCustomSalaryPreferences, saveCustomSalaryPreferences } from '../../utils/storage';
import { calculateSalaryBreakdown, formatCurrency } from '../../utils/taxCalculator';
import { Pagination } from '../Pagination';

/**
 * 根据开始时间和结束时间自动计算加班工时 (小时)
 * 支持跨午夜 (例如 21:00 ~ 01:30 为 4.5小时)
 */
export interface OvertimeTimeDetails {
  hours: number;
  minutes: number;
  formattedSpan: string;
  isOvernight: boolean;
  isDeepNight?: boolean;
}

export function getOvertimeTimeDetails(startTime: string, endTime: string): OvertimeTimeDetails {
  if (!startTime || !endTime) {
    return { hours: 0, minutes: 0, formattedSpan: '0 小时', isOvernight: false };
  }
  const [shStr, smStr] = startTime.split(':');
  const [ehStr, emStr] = endTime.split(':');
  const sh = parseInt(shStr, 10);
  const sm = parseInt(smStr, 10);
  const eh = parseInt(ehStr, 10);
  const em = parseInt(emStr, 10);

  const isDeepNight = isDeepNightShift(startTime, endTime);

  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) {
    return { hours: 0, minutes: 0, formattedSpan: '0 小时', isOvernight: false, isDeepNight: false };
  }

  const startTotalMinutes = sh * 60 + sm;
  let endTotalMinutes = eh * 60 + em;

  // 跨午夜处理 (例如从 22:00 加班到次日 02:00)
  const isOvernight = endTotalMinutes < startTotalMinutes;
  if (isOvernight) {
    endTotalMinutes += 24 * 60;
  }

  const diffMinutes = endTotalMinutes - startTotalMinutes;
  if (diffMinutes <= 0) {
    return { hours: 0, minutes: 0, formattedSpan: '0 分钟', isOvernight: false, isDeepNight: false };
  }

  const h = Math.floor(diffMinutes / 60);
  const m = diffMinutes % 60;
  const hours = Math.round((diffMinutes / 60) * 10) / 10;
  const formattedSpan = m > 0 ? `${h}小时${m}分` : `${h}小时`;

  return { hours, minutes: diffMinutes, formattedSpan, isOvernight, isDeepNight };
}

/**
 * 判断班次是否属于晚间深加班 / 长夜班：
 * 1. 跨午夜班次 (例如 22:00~02:00, 20:00~08:00, 20:00~00:00)
 * 2. 晚间深加班：工作至 22:00、23:00、00:00 或更晚 (如 20:00~00:00, 19:00~23:00, 18:00~22:30)
 * 3. 晚间 19:00 之后开始且持续至深夜 (>=22:00)
 */
export function isDeepNightShift(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const [shStr, smStr] = startTime.split(':');
  const [ehStr, emStr] = endTime.split(':');
  const sh = parseInt(shStr, 10);
  const sm = parseInt(smStr, 10);
  const eh = parseInt(ehStr, 10);
  const em = parseInt(emStr, 10);

  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return false;

  const startTotalMinutes = sh * 60 + sm;
  let endTotalMinutes = eh * 60 + em;

  // 1. 跨午夜班次 (例如 22:00~02:00, 20:00~08:00, 20:00~00:00) 必然属于长夜班
  const isOvernight = endTotalMinutes <= startTotalMinutes;
  if (isOvernight && (endTotalMinutes > 0 || eh === 0)) return true;

  // 2. 晚间深加班：晚上开始 (>=18:00) 且工作至 22:00 及以后或次日 00:00
  if (sh >= 18 && (endTotalMinutes >= 22 * 60 || eh === 0)) return true;

  // 3. 任何工作至 22:30 或 23:00 之后的深晚加班
  if (endTotalMinutes >= 22 * 60 + 30 || (eh === 0 && em === 0)) return true;

  return false;
}

/**
 * 判断加班记录是否属于长夜班（晚间深加班也属于长夜班，享受长夜班每日补贴）
 */
export function isNightShiftRecord(o: Partial<OvertimeRecord> | null | undefined): boolean {
  if (!o) return false;
  if (o.isNightShift) return true;
  if (o.startTime && o.endTime && isDeepNightShift(o.startTime, o.endTime)) return true;
  if (
    o.reason &&
    (o.reason.includes('晚间深加班') ||
      o.reason.includes('深加班') ||
      o.reason.includes('长夜班') ||
      o.reason.includes('夜班'))
  ) {
    return true;
  }
  return false;
}

export function calculateOvertimeDuration(startTime: string, endTime: string): number {
  return getOvertimeTimeDetails(startTime, endTime).hours;
}

export const OVERTIME_SHIFT_PRESETS = [
  {
    label: '平日延时',
    span: '17:00~20:00',
    start: '17:00',
    end: '20:00',
    hours: 3,
    type: 'workday' as const,
    multiplier: 1.5,
    isNightShift: false,
  },
  {
    label: '晚间深加班',
    span: '20:00~00:00',
    start: '20:00',
    end: '00:00',
    hours: 4,
    type: 'workday' as const,
    multiplier: 1.5,
    isNightShift: true, // 晚间深加班属于长夜班，享受长夜班补贴
  },
  {
    label: '周末全天(8h)',
    span: '08:00~17:00 (休1h)',
    start: '08:00',
    end: '17:00',
    hours: 8,
    type: 'weekend' as const,
    multiplier: 2.0,
    isNightShift: false,
  },
  {
    label: '周末全天(11h)',
    span: '08:00~20:00 (休1h)',
    start: '08:00',
    end: '20:00',
    hours: 11,
    type: 'weekend' as const,
    multiplier: 2.0,
    isNightShift: false,
  },
  {
    label: '周末全天(夜12h)',
    span: '20:00~08:00',
    start: '20:00',
    end: '08:00',
    hours: 12,
    type: 'weekend' as const,
    multiplier: 2.0,
    isNightShift: true,
  },
  {
    label: '国定假日(8h)',
    span: '08:00~17:00 (休1h)',
    start: '08:00',
    end: '17:00',
    hours: 8,
    type: 'holiday' as const,
    multiplier: 3.0,
    isNightShift: false,
  },
  {
    label: '国定假日(11h)',
    span: '08:00~20:00 (休1h)',
    start: '08:00',
    end: '20:00',
    hours: 11,
    type: 'holiday' as const,
    multiplier: 3.0,
    isNightShift: false,
  },
  {
    label: '国定假日(夜12h)',
    span: '20:00~08:00',
    start: '20:00',
    end: '08:00',
    hours: 12,
    type: 'holiday' as const,
    multiplier: 3.0,
    isNightShift: true,
  },
];

interface SalaryOvertimeViewProps {
  salaries: SalaryRecord[];
  onSaveSalary: (record: SalaryRecord) => void;
  onDeleteSalary: (id: string) => void;
  overtimes: OvertimeRecord[];
  onSaveOvertime: (record: OvertimeRecord) => void;
  onDeleteOvertime: (id: string) => void;
  hidePrivacy: boolean;
  defaultRates: FiveInsuranceRates;
  defaultBaseSalary?: number;
}

export const SalaryOvertimeView: React.FC<SalaryOvertimeViewProps> = ({
  salaries,
  onSaveSalary,
  onDeleteSalary,
  overtimes,
  onSaveOvertime,
  onDeleteOvertime,
  hidePrivacy,
  defaultRates,
  defaultBaseSalary = 18000,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'salary' | 'overtime' | 'linkage'>('salary');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'salary' | 'overtime'; id: string; label: string } | null>(null);

  // --- Salary Modal State ---
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null);
  // 默认全部折叠仅显示概要信息，点击卡片展开详细信息
  const [expandedSalaryIds, setExpandedSalaryIds] = useState<Set<string>>(new Set());

  const toggleExpandSalary = (id: string) => {
    setExpandedSalaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAllSalaries = () => {
    if (expandedSalaryIds.size === paginatedSalaries.length && paginatedSalaries.length > 0) {
      setExpandedSalaryIds(new Set());
    } else {
      setExpandedSalaryIds(new Set(paginatedSalaries.map((s) => s.id)));
    }
  };

  const [salaryForm, setSalaryForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    companyName: '科技创新互联网科技有限公司',
    baseSalary: 18000,
    performancePay: 4500,

    // 加班费拆解 (1.5倍、2倍、3倍加班工资)
    overtime15Hours: 0,
    overtime15Pay: 0,
    overtime20Hours: 0,
    overtime20Pay: 0,
    overtime30Hours: 0,
    overtime30Pay: 0,
    overtimePay: 0, // 合计自动计算

    // 补贴拆解 (长夜班天数/补贴、全勤补贴、基础津贴、其它自定义补贴)
    nightShiftDays: 0,
    nightShiftRate: 50,
    nightShiftPay: 0,
    fullAttendancePay: 0,
    baseAllowance: 0,
    customAllowances: [] as SalaryCustomItem[],
    allowance: 0, // 合计自动计算

    // 五险一金自定义微调设置
    isCustomInsurance: false,
    customPersonalPension: 0,
    customPersonalMedical: 0,
    customPersonalUnemployment: 0,
    customPersonalHousingFund: 0,
    customCompanyPension: 0,
    customCompanyMedical: 0,
    customCompanyUnemployment: 0,
    customCompanyInjury: 0,
    customCompanyMaternity: 0,
    customCompanyHousingFund: 0,

    // 其它可自定义扣除项 (企业年金/工会经费/水电住宿/缺勤扣款等)
    customDeductions: [] as SalaryCustomItem[],

    otherBonus: 0,
    preTaxDeduction: 0,
    specialDeductions: 3000,
    payDate: `${new Date().toISOString().slice(0, 7)}-10`,
    notes: '',
  });

  // 其它扣除项金额合计
  const otherDeductionsTotal = useMemo(() => {
    return salaryForm.customDeductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [salaryForm.customDeductions]);

  // 自定义补贴金额合计
  const customAllowancesTotal = useMemo(() => {
    return salaryForm.customAllowances.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [salaryForm.customAllowances]);

  // 计算当前薪资表单的实时预演
  const salaryCalc = useMemo(() => {
    return calculateSalaryBreakdown({
      baseSalary: Number(salaryForm.baseSalary) || 0,
      performancePay: Number(salaryForm.performancePay) || 0,
      overtimePay: Number(salaryForm.overtimePay) || 0,
      allowance: Number(salaryForm.allowance) || 0,
      otherBonus: Number(salaryForm.otherBonus) || 0,
      preTaxDeduction: Number(salaryForm.preTaxDeduction) || 0,
      specialDeductions: Number(salaryForm.specialDeductions) || 0,
      rates: defaultRates,
      isCustomInsurance: salaryForm.isCustomInsurance,
      customPersonalInsurance: {
        pensionPersonal: Number(salaryForm.customPersonalPension) || 0,
        medicalPersonal: Number(salaryForm.customPersonalMedical) || 0,
        unemploymentPersonal: Number(salaryForm.customPersonalUnemployment) || 0,
        housingFundPersonal: Number(salaryForm.customPersonalHousingFund) || 0,
      },
      customCompanyInsurance: {
        pensionCompany: Number(salaryForm.customCompanyPension) || 0,
        medicalCompany: Number(salaryForm.customCompanyMedical) || 0,
        unemploymentCompany: Number(salaryForm.customCompanyUnemployment) || 0,
        injuryCompany: Number(salaryForm.customCompanyInjury) || 0,
        maternityCompany: Number(salaryForm.customCompanyMaternity) || 0,
        housingFundCompany: Number(salaryForm.customCompanyHousingFund) || 0,
      },
      otherDeductionsTotal,
    });
  }, [salaryForm, defaultRates, otherDeductionsTotal]);

  // --- Overtime Modal State ---
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [editingOvertimeId, setEditingOvertimeId] = useState<string | null>(null);
  const [expandedOvertimeId, setExpandedOvertimeId] = useState<string | null>(null);

  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'workday' as 'workday' | 'weekend' | 'holiday',
    startTime: '17:00',
    endTime: '20:00',
    durationHours: 3,
    multiplier: 1.5,
    settlementType: 'paid' as 'paid' | 'comp_time' | 'pending',
    hourlyRate: Number((defaultBaseSalary / 21.75 / 8).toFixed(2)) || 103.45,
    isNightShift: false, // 是否是长夜班
    nightShiftSubsidy: 50, // 长夜班补贴 (元/天)
    reason: '',
    approver: '',
    notes: '',
  });

  // 综合数据指标统计
  const stats = useMemo(() => {
    const totalNetSalary = salaries.reduce((sum, s) => sum + s.netSalary, 0);
    const totalPersonalInsurance = salaries.reduce((sum, s) => sum + s.totalPersonalInsurance, 0);
    const totalOvertimeHours = overtimes.reduce((sum, o) => sum + o.durationHours, 0);

    const compTimeOvertimes = overtimes.filter((o) => o.settlementType === 'comp_time');
    const totalCompTimeEarned = compTimeOvertimes.reduce((sum, o) => sum + o.durationHours, 0);
    const totalCompTimeUsed = compTimeOvertimes.reduce((sum, o) => sum + (o.compTimeHoursUsed || 0), 0);
    const remainingCompTime = Math.max(0, totalCompTimeEarned - totalCompTimeUsed);

    const paidOvertimes = overtimes.filter((o) => o.settlementType === 'paid');
    const totalPaidOvertimeAmount = paidOvertimes.reduce((sum, o) => sum + (o.estimatedPay || 0), 0);

    const nightShiftOvertimes = overtimes.filter(isNightShiftRecord);
    const totalNightShiftDays = nightShiftOvertimes.length;
    const totalNightShiftSubsidy = nightShiftOvertimes.reduce((sum, o) => sum + (Number(o.nightShiftSubsidy) || 50), 0);

    return {
      totalNetSalary,
      totalPersonalInsurance,
      totalOvertimeHours,
      remainingCompTime,
      totalPaidOvertimeAmount,
      totalNightShiftDays,
      totalNightShiftSubsidy,
    };
  }, [salaries, overtimes]);

  // 月度工时与薪酬联动对比数据
  const monthlyLinkageData = useMemo(() => {
    const allMonths = new Set<string>();
    salaries.forEach((s) => allMonths.add(s.month));
    overtimes.forEach((o) => allMonths.add(o.date.slice(0, 7)));

    return Array.from(allMonths)
      .sort()
      .reverse()
      .map((month) => {
        const salaryRecord = salaries.find((s) => s.month === month);
        const monthOvertimes = overtimes.filter((o) => o.date.startsWith(month));

        const paidOvertimes = monthOvertimes.filter((o) => o.settlementType === 'paid');
        const compOvertimes = monthOvertimes.filter((o) => o.settlementType === 'comp_time');

        const paidHours = paidOvertimes.reduce((sum, o) => sum + o.durationHours, 0);
        const estimatedOvertimePay = paidOvertimes.reduce((sum, o) => sum + (o.estimatedPay || 0), 0);
        const compHours = compOvertimes.reduce((sum, o) => sum + o.durationHours, 0);
        const actualOvertimePay = salaryRecord ? salaryRecord.overtimePay : 0;
        const diff = actualOvertimePay - estimatedOvertimePay;

        return {
          month,
          salaryRecord,
          overtimeCount: monthOvertimes.length,
          totalHours: monthOvertimes.reduce((sum, o) => sum + o.durationHours, 0),
          paidHours,
          compHours,
          estimatedOvertimePay,
          actualOvertimePay,
          diff,
        };
      });
  }, [salaries, overtimes]);

  // --- Pagination States ---
  const [salaryPage, setSalaryPage] = useState(1);
  const [salaryPageSize, setSalaryPageSize] = useState(10);

  const [overtimePage, setOvertimePage] = useState(1);
  const [overtimePageSize, setOvertimePageSize] = useState(15);

  const [linkagePage, setLinkagePage] = useState(1);
  const [linkagePageSize, setLinkagePageSize] = useState(12);

  // Paginated data
  const paginatedSalaries = useMemo(() => {
    const start = (salaryPage - 1) * salaryPageSize;
    return salaries.slice(start, start + salaryPageSize);
  }, [salaries, salaryPage, salaryPageSize]);

  const paginatedOvertimes = useMemo(() => {
    const start = (overtimePage - 1) * overtimePageSize;
    return overtimes.slice(start, start + overtimePageSize);
  }, [overtimes, overtimePage, overtimePageSize]);

  const paginatedLinkageData = useMemo(() => {
    const start = (linkagePage - 1) * linkagePageSize;
    return monthlyLinkageData.slice(start, start + linkagePageSize);
  }, [monthlyLinkageData, linkagePage, linkagePageSize]);

  // --- Handlers: Salary Calculations & Helpers ---
  const handleOvertimePayChange = (type: '15' | '20' | '30', value: number) => {
    const p15 = type === '15' ? value : Number(salaryForm.overtime15Pay) || 0;
    const p20 = type === '20' ? value : Number(salaryForm.overtime20Pay) || 0;
    const p30 = type === '30' ? value : Number(salaryForm.overtime30Pay) || 0;
    const total = Math.round((p15 + p20 + p30) * 100) / 100;
    setSalaryForm({
      ...salaryForm,
      overtime15Pay: p15,
      overtime20Pay: p20,
      overtime30Pay: p30,
      overtimePay: total,
    });
  };

  const handleOvertimeHoursChange = (type: '15' | '20' | '30', hours: number) => {
    const mult = type === '15' ? 1.5 : type === '20' ? 2.0 : 3.0;
    const hourly = Number((salaryForm.baseSalary / 21.75 / 8).toFixed(2));
    const pay = Math.round(hours * hourly * mult * 100) / 100;

    const p15 = type === '15' ? pay : Number(salaryForm.overtime15Pay) || 0;
    const p20 = type === '20' ? pay : Number(salaryForm.overtime20Pay) || 0;
    const p30 = type === '30' ? pay : Number(salaryForm.overtime30Pay) || 0;
    const total = Math.round((p15 + p20 + p30) * 100) / 100;

    setSalaryForm({
      ...salaryForm,
      ...(type === '15' ? { overtime15Hours: hours, overtime15Pay: pay } : {}),
      ...(type === '20' ? { overtime20Hours: hours, overtime20Pay: pay } : {}),
      ...(type === '30' ? { overtime30Hours: hours, overtime30Pay: pay } : {}),
      overtimePay: total,
    });
  };

  const handleImportMonthOvertimes = () => {
    const month = salaryForm.month;
    const monthPaidOts = overtimes.filter((o) => o.date.startsWith(month) && o.settlementType === 'paid');
    let h15 = 0, p15 = 0;
    let h20 = 0, p20 = 0;
    let h30 = 0, p30 = 0;

    for (const o of monthPaidOts) {
      if (o.type === 'workday' || o.multiplier <= 1.5) {
        h15 += o.durationHours;
        p15 += o.estimatedPay || 0;
      } else if (o.type === 'holiday' || o.multiplier >= 3.0) {
        h30 += o.durationHours;
        p30 += o.estimatedPay || 0;
      } else {
        h20 += o.durationHours;
        p20 += o.estimatedPay || 0;
      }
    }
    p15 = Math.round(p15 * 100) / 100;
    p20 = Math.round(p20 * 100) / 100;
    p30 = Math.round(p30 * 100) / 100;
    const total = Math.round((p15 + p20 + p30) * 100) / 100;

    const nightShiftOts = monthPaidOts.filter(isNightShiftRecord);
    const nightDays = nightShiftOts.length;
    const nightSubsidyTotal = nightShiftOts.reduce((sum, o) => sum + (Number(o.nightShiftSubsidy) || 50), 0);

    const customTotal = salaryForm.customAllowances.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const newAllowance = Math.round(
      (nightSubsidyTotal + Number(salaryForm.fullAttendancePay || 0) + Number(salaryForm.baseAllowance || 0) + customTotal) * 100
    ) / 100;

    setSalaryForm({
      ...salaryForm,
      overtime15Hours: Math.round(h15 * 10) / 10,
      overtime15Pay: p15,
      overtime20Hours: Math.round(h20 * 10) / 10,
      overtime20Pay: p20,
      overtime30Hours: Math.round(h30 * 10) / 10,
      overtime30Pay: p30,
      overtimePay: total,
      ...(nightDays > 0
        ? {
            nightShiftDays: nightDays,
            nightShiftRate: nightDays > 0 ? Math.round(nightSubsidyTotal / nightDays) : 50,
            nightShiftPay: nightSubsidyTotal,
            allowance: newAllowance,
          }
        : {}),
    });
  };

  const handleNightShiftChange = (days: number, rate: number) => {
    const nightPay = Math.round(days * rate * 100) / 100;
    const customTotal = salaryForm.customAllowances.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const total = Math.round((nightPay + Number(salaryForm.fullAttendancePay || 0) + Number(salaryForm.baseAllowance || 0) + customTotal) * 100) / 100;

    setSalaryForm({
      ...salaryForm,
      nightShiftDays: days,
      nightShiftRate: rate,
      nightShiftPay: nightPay,
      allowance: total,
    });
  };

  const handleNightShiftPayDirectChange = (nightPay: number) => {
    const customTotal = salaryForm.customAllowances.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const total = Math.round((nightPay + Number(salaryForm.fullAttendancePay || 0) + Number(salaryForm.baseAllowance || 0) + customTotal) * 100) / 100;
    setSalaryForm({
      ...salaryForm,
      nightShiftPay: nightPay,
      allowance: total,
    });
  };

  const handleFullAttendanceChange = (amount: number) => {
    const customTotal = salaryForm.customAllowances.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const total = Math.round((Number(salaryForm.nightShiftPay || 0) + amount + Number(salaryForm.baseAllowance || 0) + customTotal) * 100) / 100;
    setSalaryForm({
      ...salaryForm,
      fullAttendancePay: amount,
      allowance: total,
    });
  };

  const handleBaseAllowanceChange = (amount: number) => {
    const customTotal = salaryForm.customAllowances.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const total = Math.round((Number(salaryForm.nightShiftPay || 0) + Number(salaryForm.fullAttendancePay || 0) + amount + customTotal) * 100) / 100;
    setSalaryForm({
      ...salaryForm,
      baseAllowance: amount,
      allowance: total,
    });
  };

  const handleAddCustomAllowance = (name = '岗位津贴', amount = 0) => {
    const newItem: SalaryCustomItem = {
      id: `allow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      amount,
    };
    const updated = [...salaryForm.customAllowances, newItem];
    const customTotal = updated.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const total = Math.round((Number(salaryForm.nightShiftPay || 0) + Number(salaryForm.fullAttendancePay || 0) + Number(salaryForm.baseAllowance || 0) + customTotal) * 100) / 100;
    setSalaryForm({
      ...salaryForm,
      customAllowances: updated,
      allowance: total,
    });
  };

  const handleUpdateCustomAllowance = (id: string, name: string, amount: number) => {
    const updated = salaryForm.customAllowances.map((item) => (item.id === id ? { ...item, name, amount } : item));
    const customTotal = updated.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const total = Math.round((Number(salaryForm.nightShiftPay || 0) + Number(salaryForm.fullAttendancePay || 0) + Number(salaryForm.baseAllowance || 0) + customTotal) * 100) / 100;
    setSalaryForm({
      ...salaryForm,
      customAllowances: updated,
      allowance: total,
    });
  };

  const handleRemoveCustomAllowance = (id: string) => {
    const updated = salaryForm.customAllowances.filter((item) => item.id !== id);
    const customTotal = updated.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const total = Math.round((Number(salaryForm.nightShiftPay || 0) + Number(salaryForm.fullAttendancePay || 0) + Number(salaryForm.baseAllowance || 0) + customTotal) * 100) / 100;
    setSalaryForm({
      ...salaryForm,
      customAllowances: updated,
      allowance: total,
    });
  };

  const handleAddCustomDeduction = (name = '工会会费', amount = 0) => {
    const newItem: SalaryCustomItem = {
      id: `ded-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      amount,
    };
    setSalaryForm({
      ...salaryForm,
      customDeductions: [...salaryForm.customDeductions, newItem],
    });
  };

  const handleUpdateCustomDeduction = (id: string, name: string, amount: number) => {
    setSalaryForm({
      ...salaryForm,
      customDeductions: salaryForm.customDeductions.map((item) =>
        item.id === id ? { ...item, name, amount } : item
      ),
    });
  };

  const handleRemoveCustomDeduction = (id: string) => {
    setSalaryForm({
      ...salaryForm,
      customDeductions: salaryForm.customDeductions.filter((item) => item.id !== id),
    });
  };

  const handleToggleCustomInsurance = (enable: boolean) => {
    if (enable && salaryForm.customPersonalPension === 0) {
      // 预先填入标准测算值方便微调
      setSalaryForm({
        ...salaryForm,
        isCustomInsurance: true,
        customPersonalPension: salaryCalc.pensionPersonal,
        customPersonalMedical: salaryCalc.medicalPersonal,
        customPersonalUnemployment: salaryCalc.unemploymentPersonal,
        customPersonalHousingFund: salaryCalc.housingFundPersonal,
        customCompanyPension: salaryCalc.pensionCompany,
        customCompanyMedical: salaryCalc.medicalCompany,
        customCompanyUnemployment: salaryCalc.unemploymentCompany,
        customCompanyInjury: salaryCalc.injuryCompany,
        customCompanyMaternity: salaryCalc.maternityCompany,
        customCompanyHousingFund: salaryCalc.housingFundCompany,
      });
    } else {
      setSalaryForm({
        ...salaryForm,
        isCustomInsurance: enable,
      });
    }
  };

  const handleResetStandardInsurance = () => {
    const stdCalc = calculateSalaryBreakdown({
      baseSalary: Number(salaryForm.baseSalary) || 0,
      performancePay: Number(salaryForm.performancePay) || 0,
      overtimePay: Number(salaryForm.overtimePay) || 0,
      allowance: Number(salaryForm.allowance) || 0,
      otherBonus: Number(salaryForm.otherBonus) || 0,
      preTaxDeduction: Number(salaryForm.preTaxDeduction) || 0,
      specialDeductions: Number(salaryForm.specialDeductions) || 0,
      rates: defaultRates,
      isCustomInsurance: false,
    });
    setSalaryForm({
      ...salaryForm,
      customPersonalPension: stdCalc.pensionPersonal,
      customPersonalMedical: stdCalc.medicalPersonal,
      customPersonalUnemployment: stdCalc.unemploymentPersonal,
      customPersonalHousingFund: stdCalc.housingFundPersonal,
      customCompanyPension: stdCalc.pensionCompany,
      customCompanyMedical: stdCalc.medicalCompany,
      customCompanyUnemployment: stdCalc.unemploymentCompany,
      customCompanyInjury: stdCalc.injuryCompany,
      customCompanyMaternity: stdCalc.maternityCompany,
      customCompanyHousingFund: stdCalc.housingFundCompany,
    });
  };

  // --- Handlers: Salary Modal Open / Save ---
  const handleOpenAddSalary = () => {
    setEditingSalaryId(null);
    const month = new Date().toISOString().slice(0, 7);

    // 自动检测当月是否有已登记的加班工时记录
    const monthPaidOts = overtimes.filter((o) => o.date.startsWith(month) && o.settlementType === 'paid');
    let h15 = 0, p15 = 0;
    let h20 = 0, p20 = 0;
    let h30 = 0, p30 = 0;

    for (const o of monthPaidOts) {
      if (o.type === 'workday' || o.multiplier <= 1.5) {
        h15 += o.durationHours;
        p15 += o.estimatedPay || 0;
      } else if (o.type === 'holiday' || o.multiplier >= 3.0) {
        h30 += o.durationHours;
        p30 += o.estimatedPay || 0;
      } else {
        h20 += o.durationHours;
        p20 += o.estimatedPay || 0;
      }
    }
    const otPay = Math.round((p15 + p20 + p30) * 100) / 100;

    const nightShiftOts = monthPaidOts.filter(isNightShiftRecord);
    const nightDays = nightShiftOts.length;
    const nightSubsidyTotal = nightShiftOts.reduce((sum, o) => sum + (Number(o.nightShiftSubsidy) || 50), 0);

    // 读取上次记忆的五险一金自定义设置与其它扣除项（自动带入，直到再次自定义设置）
    const rememberedPref = loadCustomSalaryPreferences(salaries);
    const useRememberedInsurance = Boolean(rememberedPref?.isCustomInsurance);
    const initialCustomDeductions: SalaryCustomItem[] = (rememberedPref?.customDeductions || []).map((d, i) => ({
      id: `ded-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: d.name,
      amount: d.amount,
    }));

    setSalaryForm({
      month,
      companyName: salaries.length > 0 ? salaries[0].companyName || '' : '科技创新互联网科技有限公司',
      baseSalary: defaultBaseSalary,
      performancePay: 4500,

      overtime15Hours: Math.round(h15 * 10) / 10,
      overtime15Pay: Math.round(p15 * 100) / 100,
      overtime20Hours: Math.round(h20 * 10) / 10,
      overtime20Pay: Math.round(p20 * 100) / 100,
      overtime30Hours: Math.round(h30 * 10) / 10,
      overtime30Pay: Math.round(p30 * 100) / 100,
      overtimePay: otPay,

      nightShiftDays: nightDays,
      nightShiftRate: 50,
      nightShiftPay: nightSubsidyTotal,
      fullAttendancePay: 0,
      baseAllowance: 0,
      customAllowances: [],
      allowance: nightSubsidyTotal,

      isCustomInsurance: useRememberedInsurance,
      customPersonalPension: useRememberedInsurance ? Number(rememberedPref?.customPersonalPension || 0) : 0,
      customPersonalMedical: useRememberedInsurance ? Number(rememberedPref?.customPersonalMedical || 0) : 0,
      customPersonalUnemployment: useRememberedInsurance ? Number(rememberedPref?.customPersonalUnemployment || 0) : 0,
      customPersonalHousingFund: useRememberedInsurance ? Number(rememberedPref?.customPersonalHousingFund || 0) : 0,
      customCompanyPension: useRememberedInsurance ? Number(rememberedPref?.customCompanyPension || 0) : 0,
      customCompanyMedical: useRememberedInsurance ? Number(rememberedPref?.customCompanyMedical || 0) : 0,
      customCompanyUnemployment: useRememberedInsurance ? Number(rememberedPref?.customCompanyUnemployment || 0) : 0,
      customCompanyInjury: useRememberedInsurance ? Number(rememberedPref?.customCompanyInjury || 0) : 0,
      customCompanyMaternity: useRememberedInsurance ? Number(rememberedPref?.customCompanyMaternity || 0) : 0,
      customCompanyHousingFund: useRememberedInsurance ? Number(rememberedPref?.customCompanyHousingFund || 0) : 0,

      customDeductions: initialCustomDeductions,

      otherBonus: 0,
      preTaxDeduction: 0,
      specialDeductions: 3000,
      payDate: `${month}-10`,
      notes: '',
    });
    setIsSalaryModalOpen(true);
  };

  const handleOpenEditSalary = (s: SalaryRecord) => {
    setEditingSalaryId(s.id);

    const hasSplit = (s.overtime15Pay || 0) + (s.overtime20Pay || 0) + (s.overtime30Pay || 0) > 0;
    const p15 = s.overtime15Pay || 0;
    const p20 = hasSplit ? (s.overtime20Pay || 0) : (s.overtimePay || 0);
    const p30 = s.overtime30Pay || 0;

    const customAllowances = s.customAllowances || [];
    const customDeductions = s.customDeductions || [];

    setSalaryForm({
      month: s.month,
      companyName: s.companyName || '',
      baseSalary: s.baseSalary,
      performancePay: s.performancePay,

      overtime15Hours: s.overtime15Hours || 0,
      overtime15Pay: p15,
      overtime20Hours: s.overtime20Hours || 0,
      overtime20Pay: p20,
      overtime30Hours: s.overtime30Hours || 0,
      overtime30Pay: p30,
      overtimePay: s.overtimePay,

      nightShiftDays: s.nightShiftDays || 0,
      nightShiftRate: s.nightShiftRate || 50,
      nightShiftPay: s.nightShiftPay || 0,
      fullAttendancePay: s.fullAttendancePay || 0,
      baseAllowance: s.baseAllowance !== undefined ? s.baseAllowance : (s.allowance || 0),
      customAllowances,
      allowance: s.allowance,

      isCustomInsurance: Boolean(s.isCustomInsurance),
      customPersonalPension: s.pensionPersonal || 0,
      customPersonalMedical: s.medicalPersonal || 0,
      customPersonalUnemployment: s.unemploymentPersonal || 0,
      customPersonalHousingFund: s.housingFundPersonal || 0,
      customCompanyPension: s.pensionCompany || 0,
      customCompanyMedical: s.medicalCompany || 0,
      customCompanyUnemployment: s.unemploymentCompany || 0,
      customCompanyInjury: s.injuryCompany || 0,
      customCompanyMaternity: s.maternityCompany || 0,
      customCompanyHousingFund: s.housingFundCompany || 0,

      customDeductions,

      otherBonus: s.otherBonus,
      preTaxDeduction: s.preTaxDeduction,
      specialDeductions: s.specialDeductions,
      payDate: s.payDate || '',
      notes: s.notes || '',
    });
    setIsSalaryModalOpen(true);
  };

  const handleSaveSalarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: SalaryRecord = {
      id: editingSalaryId || `sal-${Date.now()}`,
      month: salaryForm.month,
      companyName: salaryForm.companyName,
      baseSalary: Number(salaryForm.baseSalary) || 0,
      performancePay: Number(salaryForm.performancePay) || 0,

      // 加班费拆解 (1.5倍、2倍、3倍)
      overtime15Hours: Number(salaryForm.overtime15Hours) || 0,
      overtime15Pay: Number(salaryForm.overtime15Pay) || 0,
      overtime20Hours: Number(salaryForm.overtime20Hours) || 0,
      overtime20Pay: Number(salaryForm.overtime20Pay) || 0,
      overtime30Hours: Number(salaryForm.overtime30Hours) || 0,
      overtime30Pay: Number(salaryForm.overtime30Pay) || 0,
      overtimePay: Number(salaryForm.overtimePay) || 0,

      // 补贴拆解 (长夜班、全勤、自定义补贴)
      nightShiftDays: Number(salaryForm.nightShiftDays) || 0,
      nightShiftRate: Number(salaryForm.nightShiftRate) || 0,
      nightShiftPay: Number(salaryForm.nightShiftPay) || 0,
      fullAttendancePay: Number(salaryForm.fullAttendancePay) || 0,
      baseAllowance: Number(salaryForm.baseAllowance) || 0,
      customAllowances: salaryForm.customAllowances,
      allowance: Number(salaryForm.allowance) || 0,

      otherBonus: Number(salaryForm.otherBonus) || 0,
      preTaxDeduction: Number(salaryForm.preTaxDeduction) || 0,
      grossSalary: salaryCalc.grossSalary,

      // 五险一金
      isCustomInsurance: salaryForm.isCustomInsurance,
      pensionPersonal: salaryCalc.pensionPersonal,
      medicalPersonal: salaryCalc.medicalPersonal,
      unemploymentPersonal: salaryCalc.unemploymentPersonal,
      housingFundPersonal: salaryCalc.housingFundPersonal,
      totalPersonalInsurance: salaryCalc.totalPersonalInsurance,

      // 其它扣除项
      customDeductions: salaryForm.customDeductions,
      otherDeductionsTotal,

      pensionCompany: salaryCalc.pensionCompany,
      medicalCompany: salaryCalc.medicalCompany,
      unemploymentCompany: salaryCalc.unemploymentCompany,
      injuryCompany: salaryCalc.injuryCompany,
      maternityCompany: salaryCalc.maternityCompany,
      housingFundCompany: salaryCalc.housingFundCompany,
      totalCompanyInsurance: salaryCalc.totalCompanyInsurance,

      specialDeductions: Number(salaryForm.specialDeductions) || 0,
      taxThreshold: salaryCalc.taxThreshold,
      taxableIncome: salaryCalc.taxableIncome,
      individualIncomeTax: salaryCalc.individualIncomeTax,
      netSalary: salaryCalc.netSalary,
      companyTotalCost: salaryCalc.companyTotalCost,
      payDate: salaryForm.payDate,
      notes: salaryForm.notes,
      createdAt: editingSalaryId
        ? salaries.find((s) => s.id === editingSalaryId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveSalary(newRecord);

    // 记忆用户的五险一金自定义设置与其它扣除项，下次新建自动带入，直到再次自定义设置
    saveCustomSalaryPreferences({
      isCustomInsurance: salaryForm.isCustomInsurance,
      customPersonalPension: salaryForm.isCustomInsurance ? Number(salaryForm.customPersonalPension) || 0 : 0,
      customPersonalMedical: salaryForm.isCustomInsurance ? Number(salaryForm.customPersonalMedical) || 0 : 0,
      customPersonalUnemployment: salaryForm.isCustomInsurance ? Number(salaryForm.customPersonalUnemployment) || 0 : 0,
      customPersonalHousingFund: salaryForm.isCustomInsurance ? Number(salaryForm.customPersonalHousingFund) || 0 : 0,
      customCompanyPension: salaryForm.isCustomInsurance ? Number(salaryForm.customCompanyPension) || 0 : 0,
      customCompanyMedical: salaryForm.isCustomInsurance ? Number(salaryForm.customCompanyMedical) || 0 : 0,
      customCompanyUnemployment: salaryForm.isCustomInsurance ? Number(salaryForm.customCompanyUnemployment) || 0 : 0,
      customCompanyInjury: salaryForm.isCustomInsurance ? Number(salaryForm.customCompanyInjury) || 0 : 0,
      customCompanyMaternity: salaryForm.isCustomInsurance ? Number(salaryForm.customCompanyMaternity) || 0 : 0,
      customCompanyHousingFund: salaryForm.isCustomInsurance ? Number(salaryForm.customCompanyHousingFund) || 0 : 0,
      customDeductions: salaryForm.customDeductions.map((d) => ({
        name: d.name,
        amount: Number(d.amount) || 0,
      })),
    });

    setIsSalaryModalOpen(false);
  };

  // --- Handlers: Overtime ---
  const handleOpenAddOvertime = () => {
    setEditingOvertimeId(null);
    const hourly = Number((defaultBaseSalary / 21.75 / 8).toFixed(2));
    setOvertimeForm({
      date: new Date().toISOString().slice(0, 10),
      type: 'workday',
      startTime: '17:00',
      endTime: '20:00',
      durationHours: 3,
      multiplier: 1.5,
      settlementType: 'paid',
      hourlyRate: hourly || 103.45,
      isNightShift: false,
      nightShiftSubsidy: 50,
      reason: '',
      approver: '',
      notes: '',
    });
    setIsOvertimeModalOpen(true);
  };

  const handleOpenEditOvertime = (o: OvertimeRecord) => {
    setEditingOvertimeId(o.id);
    const isNight = isNightShiftRecord(o);
    setOvertimeForm({
      date: o.date,
      type: o.type,
      startTime: o.startTime || '',
      endTime: o.endTime || '',
      durationHours: o.durationHours,
      multiplier: o.multiplier,
      settlementType: o.settlementType,
      hourlyRate: o.hourlyRate || Number((defaultBaseSalary / 21.75 / 8).toFixed(2)),
      isNightShift: isNight,
      nightShiftSubsidy: o.nightShiftSubsidy !== undefined && o.nightShiftSubsidy > 0 ? o.nightShiftSubsidy : (isNight ? 50 : 0),
      reason: o.reason || '',
      approver: o.approver || '',
      notes: o.notes || '',
    });
    setIsOvertimeModalOpen(true);
  };

  const handleSaveOvertimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = Number(overtimeForm.durationHours) || 0;
    const rate = Number(overtimeForm.hourlyRate) || 0;
    const mult = Number(overtimeForm.multiplier) || 1.5;
    const estPay = Number((duration * rate * mult).toFixed(2));

    const isNight = Boolean(
      overtimeForm.isNightShift ||
      isDeepNightShift(overtimeForm.startTime, overtimeForm.endTime) ||
      (overtimeForm.reason && (overtimeForm.reason.includes('晚间深加班') || overtimeForm.reason.includes('深加班') || overtimeForm.reason.includes('长夜班')))
    );

    const newRecord: OvertimeRecord = {
      id: editingOvertimeId || `ot-${Date.now()}`,
      date: overtimeForm.date,
      type: overtimeForm.type,
      startTime: overtimeForm.startTime,
      endTime: overtimeForm.endTime,
      durationHours: duration,
      multiplier: mult,
      settlementType: overtimeForm.settlementType,
      hourlyRate: rate,
      estimatedPay: estPay,
      isNightShift: isNight,
      nightShiftSubsidy: isNight ? (Number(overtimeForm.nightShiftSubsidy) || 50) : 0,
      compTimeHoursUsed: editingOvertimeId
        ? overtimes.find((o) => o.id === editingOvertimeId)?.compTimeHoursUsed || 0
        : 0,
      reason: overtimeForm.reason,
      approver: overtimeForm.approver,
      notes: overtimeForm.notes,
      createdAt: editingOvertimeId
        ? overtimes.find((o) => o.id === editingOvertimeId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveOvertime(newRecord);
    setIsOvertimeModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部统计卡片与模块标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            <Banknote className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <span>薪资与加班工时中心</span>
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              五险一金精算 · 个税专项扣除 · 加班调休池 · 自动勾稽核对
            </p>
          </div>
        </div>

        {/* 顶部操作区 */}
        <div className="flex items-center gap-2">
          {activeSubTab === 'salary' ? (
            <button
              onClick={handleOpenAddSalary}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>录入薪资工资条</span>
            </button>
          ) : activeSubTab === 'overtime' ? (
            <button
              onClick={handleOpenAddOvertime}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>记录加班工时</span>
            </button>
          ) : (
            <button
              onClick={() => {
                const dateStr = new Date().toISOString().slice(0, 10);
                triggerFileDownload(exportSalariesToCsv(salaries), `薪资明细_${dateStr}.csv`, 'text/csv;charset=utf-8');
                triggerFileDownload(exportOvertimesToCsv(overtimes), `加班工时_${dateStr}.csv`, 'text/csv;charset=utf-8');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>导出双表 CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 统计指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="text-xs text-zinc-400">累计税后实发到手</div>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {formatCurrency(stats.totalNetSalary, hidePrivacy)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">共 {salaries.length} 个月发放记录</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="text-xs text-zinc-400">个人五险一金缴存</div>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {formatCurrency(stats.totalPersonalInsurance, hidePrivacy)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">已沉淀为个人社保公积金资产</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="text-xs text-zinc-400">调休池剩余额度</div>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
            {stats.remainingCompTime} <span className="text-xs font-normal">小时</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">随时用于假期抵扣调休</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="text-xs text-zinc-400">累计加班工时</div>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {stats.totalOvertimeHours} <span className="text-xs font-normal">小时</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">折算加班费 {formatCurrency(stats.totalPaidOvertimeAmount, hidePrivacy)}</div>
        </div>
      </div>

      {/* 子功能标签切换栏 */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 w-fit text-xs font-medium">
        <button
          onClick={() => setActiveSubTab('salary')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'salary'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Banknote className="w-3.5 h-3.5" />
          <span>薪酬五险一金 ({salaries.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('overtime')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'overtime'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>加班工时调休 ({overtimes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('linkage')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'linkage'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Link className="w-3.5 h-3.5" />
          <span>工时与薪酬联动核对</span>
        </button>
      </div>

      {/* 1. 薪酬与五险一金明细 */}
      {activeSubTab === 'salary' && (
        <div className="space-y-3">
          {salaries.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Banknote className="w-6 h-6" />
              </div>
              <div className="text-xs text-zinc-400">暂无薪资发放记录，点击上方按钮录入您的第一份工资条</div>
            </div>
          ) : (
            <>
              {/* 薪酬五险一金概览与批量展开/折叠栏 */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    发放记录: <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{salaries.length} 个月</strong>
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    累计税后实发: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{formatCurrency(stats.totalNetSalary, hidePrivacy)}</strong>
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    累计个人五险一金: <strong className="text-blue-600 dark:text-blue-400 font-mono font-bold">{formatCurrency(stats.totalPersonalInsurance, hidePrivacy)}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleAllSalaries}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer text-xs font-medium"
                    title={expandedSalaryIds.size === paginatedSalaries.length ? '全部收起为概要列表' : '一键展开所有月份的详细信息'}
                  >
                    {expandedSalaryIds.size === paginatedSalaries.length && paginatedSalaries.length > 0 ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>全部收起为概要</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>全部展开详细信息</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {paginatedSalaries.map((s) => {
                const isExpanded = expandedSalaryIds.has(s.id);
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                  >
                    {/* 概要信息行 (点击展开/折叠详细信息) */}
                    <div
                      onClick={() => toggleExpandSalary(s.id)}
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold flex flex-col items-center justify-center text-xs shrink-0 border border-blue-500/20">
                          <span className="text-[10px] text-blue-400 font-normal leading-none">{s.month.slice(0, 4)}</span>
                          <span className="text-sm font-black leading-none mt-0.5">{s.month.slice(5)}月</span>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">{s.month}</span>
                            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium truncate max-w-[200px]">{s.companyName}</span>
                            {s.isCustomInsurance && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50">
                                🛡️ 微调五险一金
                              </span>
                            )}
                            {(s.nightShiftDays || 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/50">
                                🌙 长夜班 {s.nightShiftDays}天
                              </span>
                            )}
                            {s.payDate && (
                              <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline-block">
                                发放: {s.payDate}
                              </span>
                            )}
                          </div>

                          {/* 概要核心数据指标胶囊栏 */}
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono">
                            <span>底薪: <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">{formatCurrency(s.baseSalary, hidePrivacy)}</strong></span>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span>应发: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{formatCurrency(s.grossSalary, hidePrivacy)}</strong></span>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span>五险一金: <strong className="text-blue-600 dark:text-blue-400 font-semibold">-{formatCurrency(s.totalPersonalInsurance, hidePrivacy)}</strong></span>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span>个税: <strong className="text-amber-600 dark:text-amber-400 font-semibold">-{formatCurrency(s.individualIncomeTax, hidePrivacy)}</strong></span>
                            {(s.otherDeductionsTotal || 0) > 0 && (
                              <>
                                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                                <span>其它扣除: <strong className="text-rose-500 font-semibold">-{formatCurrency(s.otherDeductionsTotal || 0, hidePrivacy)}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800/80">
                        <div className="text-left md:text-right">
                          <div className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(s.netSalary, hidePrivacy)}
                          </div>
                          <div className="text-[10px] text-zinc-400">税后实发到手</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl font-medium transition-colors ${
                            isExpanded
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                              : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                          }`}>
                            {isExpanded ? '收起详情' : '展开详情'}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditSalary(s);
                            }}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            title="编辑此薪资条"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({
                                type: 'salary',
                                id: s.id,
                                label: `${s.month} 月薪资条`,
                              });
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500 cursor-pointer"
                            title="删除此薪资条"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 sm:p-5 pt-0 border-t border-zinc-100 dark:border-zinc-800 text-xs space-y-3.5 bg-zinc-50/50 dark:bg-zinc-800/20">
                        {/* 基础汇总四宫格 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400">基本工资 (底薪)</span>
                            <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(s.baseSalary, hidePrivacy)}</div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400">绩效/奖金</span>
                            <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(s.performancePay, hidePrivacy)}</div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400">加班费合计</span>
                            <div className="font-mono font-bold text-amber-600 dark:text-amber-400">{formatCurrency(s.overtimePay, hidePrivacy)}</div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400">津补贴合计</span>
                            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(s.allowance, hidePrivacy)}</div>
                          </div>
                        </div>

                        {/* 加班费倍率拆解明细 */}
                        {((s.overtime15Pay || 0) + (s.overtime20Pay || 0) + (s.overtime30Pay || 0) > 0 || (s.overtimePay || 0) > 0) && (
                          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                <span>加班费分项明细 (1.5倍 / 2倍 / 3倍)</span>
                              </span>
                              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                                合计: {formatCurrency(s.overtimePay, hidePrivacy)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                              <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 text-zinc-700 dark:text-zinc-300">
                                <span className="text-[10px] text-zinc-400 block">平日延时 (1.5倍)</span>
                                <div className="font-bold text-amber-800 dark:text-amber-300">
                                  {formatCurrency(s.overtime15Pay || 0, hidePrivacy)}
                                  {s.overtime15Hours ? <span className="text-[10px] font-normal text-zinc-400 ml-1">({s.overtime15Hours}h)</span> : null}
                                </div>
                              </div>
                              <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 text-zinc-700 dark:text-zinc-300">
                                <span className="text-[10px] text-zinc-400 block">周末加班 (2.0倍)</span>
                                <div className="font-bold text-amber-800 dark:text-amber-300">
                                  {formatCurrency(s.overtime20Pay || 0, hidePrivacy)}
                                  {s.overtime20Hours ? <span className="text-[10px] font-normal text-zinc-400 ml-1">({s.overtime20Hours}h)</span> : null}
                                </div>
                              </div>
                              <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 text-zinc-700 dark:text-zinc-300">
                                <span className="text-[10px] text-zinc-400 block">法定节假日 (3.0倍)</span>
                                <div className="font-bold text-amber-800 dark:text-amber-300">
                                  {formatCurrency(s.overtime30Pay || 0, hidePrivacy)}
                                  {s.overtime30Hours ? <span className="text-[10px] font-normal text-zinc-400 ml-1">({s.overtime30Hours}h)</span> : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 津补贴拆解明细 (长夜班、全勤、自定义补贴) */}
                        {((s.nightShiftPay || 0) > 0 || (s.fullAttendancePay || 0) > 0 || (s.customAllowances && s.customAllowances.length > 0) || (s.allowance || 0) > 0) && (
                          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200/60 dark:border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                              <span className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                <span>津补贴构成 (长夜班 / 全勤 / 其它自定义补贴)</span>
                              </span>
                              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                合计: {formatCurrency(s.allowance, hidePrivacy)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                              {(s.nightShiftDays || 0) > 0 && (
                                <div className="p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                                  <span className="text-[10px] text-zinc-400 block">🌙 长夜班补贴</span>
                                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                    {formatCurrency(s.nightShiftPay || 0, hidePrivacy)}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 ml-1">
                                    ({s.nightShiftDays}天 × ¥{s.nightShiftRate || 0}/天)
                                  </span>
                                </div>
                              )}
                              {(s.fullAttendancePay || 0) > 0 && (
                                <div className="p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                                  <span className="text-[10px] text-zinc-400 block">🌟 全勤补贴</span>
                                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                    {formatCurrency(s.fullAttendancePay || 0, hidePrivacy)}
                                  </span>
                                </div>
                              )}
                              {(s.baseAllowance || 0) > 0 && (
                                <div className="p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                                  <span className="text-[10px] text-zinc-400 block">常规津贴(餐补/交通)</span>
                                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                                    {formatCurrency(s.baseAllowance || 0, hidePrivacy)}
                                  </span>
                                </div>
                              )}
                              {s.customAllowances?.map((item) => (
                                <div
                                  key={item.id}
                                  className="p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40"
                                >
                                  <span className="text-[10px] text-zinc-400 block">{item.name}</span>
                                  <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                    {formatCurrency(item.amount, hidePrivacy)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 五险一金明细列表 */}
                        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                              <span>个人与企业五险一金明细</span>
                            </span>
                            {s.isCustomInsurance && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                自定义扣缴设置
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                            <div>养老保险 (个人): ¥{s.pensionPersonal}</div>
                            <div>医疗保险 (个人): ¥{s.medicalPersonal}</div>
                            <div>失业保险 (个人): ¥{s.unemploymentPersonal}</div>
                            <div>住房公积金 (个人): ¥{s.housingFundPersonal}</div>
                            <div>养老 (企业): ¥{s.pensionCompany}</div>
                            <div>医疗 (企业): ¥{s.medicalCompany}</div>
                            <div>工伤/生育: ¥{(s.injuryCompany || 0) + (s.maternityCompany || 0)}</div>
                            <div>公积金 (企业): ¥{s.housingFundCompany}</div>
                          </div>
                        </div>

                        {/* 其它自定义扣除项明细 */}
                        {s.customDeductions && s.customDeductions.length > 0 && (
                          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-rose-200/60 dark:border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
                              <span className="flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5 text-rose-500" />
                                <span>其它扣除项目明细</span>
                              </span>
                              <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                                合计: -{formatCurrency(s.otherDeductionsTotal || 0, hidePrivacy)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                              {s.customDeductions.map((d) => (
                                <div key={d.id} className="p-1.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20">
                                  <span className="text-[10px] text-zinc-400 block">{d.name}</span>
                                  <span className="font-bold text-rose-600 dark:text-rose-400">
                                    -{formatCurrency(d.amount, hidePrivacy)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 底部备注与税前扣除说明 */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                          <div>企业总用人成本: <strong className="text-zinc-800 dark:text-zinc-200">{formatCurrency(s.companyTotalCost, hidePrivacy)}</strong></div>
                          {s.specialDeductions > 0 && <div>专项附加扣除: ¥{s.specialDeductions}</div>}
                          {s.preTaxDeduction > 0 && <div>税前缺勤扣除: -¥{s.preTaxDeduction}</div>}
                          {s.notes && <div className="w-full text-zinc-400">备注: {s.notes}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <Pagination
                currentPage={salaryPage}
                totalItems={salaries.length}
                pageSize={salaryPageSize}
                onPageChange={setSalaryPage}
                onPageSizeChange={setSalaryPageSize}
                pageSizeOptions={[6, 12, 24, 36]}
              />
            </>
          )}
        </div>
      )}

      {/* 2. 加班工时与调休明细 */}
      {activeSubTab === 'overtime' && (
        <div className="space-y-3">
          {overtimes.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Clock className="w-6 h-6" />
              </div>
              <div className="text-xs text-zinc-400">暂无加班工时记录，点击上方按钮添加您的第一笔加班</div>
            </div>
          ) : (
            <>
              {/* 加班工时与长夜班总体概览栏 */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    记录总数: <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{overtimes.length} 笔</strong>
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    累计总工时: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">{stats.totalOvertimeHours} 小时</strong>
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    预估加班费: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">{formatCurrency(stats.totalPaidOvertimeAmount, hidePrivacy)}</strong>
                  </span>
                </div>
                {stats.totalNightShiftDays > 0 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/70 text-indigo-700 dark:text-indigo-300">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-medium">
                      长夜班: <strong className="font-mono">{stats.totalNightShiftDays}</strong> 天 · 累计补贴: <strong className="font-mono font-bold">¥{stats.totalNightShiftSubsidy}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>支持记录长夜班并自动核算夜班津贴</span>
                  </div>
                )}
              </div>

              {paginatedOvertimes.map((o) => {
                const isExpanded = expandedOvertimeId === o.id;

                return (
                  <div
                    key={o.id}
                    className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                  >
                    {/* 概要行 (点击展开/折叠明细) */}
                    <div
                      onClick={() => setExpandedOvertimeId(isExpanded ? null : o.id)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 text-xs cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                          {o.durationHours}h
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">{o.date}</span>
                            <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px]">
                              {o.type === 'workday' ? '工作日延时 (1.5x)' : o.type === 'weekend' ? '周末加班 (2.0x)' : '法定节假日 (3.0x)'}
                            </span>
                            {isNightShiftRecord(o) && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1">
                                <Moon className="w-3 h-3 text-indigo-500" />
                                <span>长夜班 (+¥{o.nightShiftSubsidy !== undefined && o.nightShiftSubsidy > 0 ? o.nightShiftSubsidy : 50}补贴)</span>
                              </span>
                            )}
                            {o.settlementType === 'comp_time' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-medium">
                                调休结算
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                            {o.startTime && o.endTime ? <span>{o.startTime} ~ {o.endTime}</span> : null}
                            {o.reason && !isExpanded && <span>· {o.reason}</span>}
                            {o.approver && <span>· 审批: {o.approver}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right shrink-0">
                          <div className="font-bold font-mono text-zinc-900 dark:text-zinc-100 text-sm">
                            {o.settlementType === 'comp_time' ? (
                              <span className="text-purple-600 dark:text-purple-400">转调休 {o.durationHours}h</span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">{formatCurrency(o.estimatedPay, hidePrivacy)}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {o.settlementType === 'comp_time' ? `已使用 ${o.compTimeHoursUsed || 0}h` : '折算加班费'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditOvertime(o);
                            }}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                            title="编辑"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({
                                type: 'overtime',
                                id: o.id,
                                label: `${o.date} 加班记录`,
                              });
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500 cursor-pointer"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 展开的完整加班明细面板 */}
                    {isExpanded && (
                      <div className="p-4 pt-0 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/20 text-xs space-y-3 animate-in fade-in duration-150">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block">加班日期</span>
                            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{o.date}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block">加班类型与倍率</span>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">
                              {o.type === 'workday' ? '工作日延时 (1.5倍)' : o.type === 'weekend' ? '周末加班 (2.0倍)' : '法定节假日 (3.0倍)'}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block">起止时间与时长</span>
                            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                              {o.startTime && o.endTime ? `${o.startTime} ~ ${o.endTime} (${o.durationHours}h)` : `${o.durationHours} 小时`}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block">结算方式</span>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">
                              {o.settlementType === 'paid' ? '支付加班费' : o.settlementType === 'comp_time' ? '转调休假' : '待定'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {isNightShiftRecord(o) ? (
                            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between">
                              <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                                <Moon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>长夜班补贴标准</span>
                              </span>
                              <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                                +¥{Number(o.nightShiftSubsidy !== undefined && o.nightShiftSubsidy > 0 ? o.nightShiftSubsidy : 50).toFixed(2)}/天
                              </span>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                              <span className="text-zinc-400">长夜班状态</span>
                              <span className="text-zinc-500 font-medium">常规日班/延时 (无夜班补贴)</span>
                            </div>
                          )}
                          {o.approver ? (
                            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                              <span className="text-zinc-500 dark:text-zinc-400">审批负责人</span>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{o.approver}</span>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                              <span className="text-zinc-400">基准时薪</span>
                              <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">¥{Number(o.hourlyRate || 0).toFixed(2)}/h</span>
                            </div>
                          )}
                          {o.settlementType === 'comp_time' && (
                            <div className="sm:col-span-2 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
                              <span className="text-zinc-500 dark:text-zinc-400">调休消耗情况</span>
                              <span className="font-semibold text-purple-600 dark:text-purple-400">
                                累计 {o.durationHours}h · 已用 {o.compTimeHoursUsed || 0}h · 剩余 {Math.max(0, o.durationHours - (o.compTimeHoursUsed || 0))}h
                              </span>
                            </div>
                          )}
                        </div>

                        {o.reason && (
                          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 space-y-1">
                            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">加班事由与工作成果</span>
                            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed break-words">{o.reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <Pagination
                currentPage={overtimePage}
                totalItems={overtimes.length}
                pageSize={overtimePageSize}
                onPageChange={setOvertimePage}
                onPageSizeChange={setOvertimePageSize}
                pageSizeOptions={[10, 15, 30, 50]}
              />
            </>
          )}
        </div>
      )}

      {/* 3. 工时与薪酬月度联动核对子面板 */}
      {activeSubTab === 'linkage' && (
        <div className="space-y-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 flex items-start gap-3">
            <Compass className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block sm:inline">
                加班工时与实发工资自动勾稽核对：
              </span>
              系统自动将当月登记的加班工时（转加班费）折算的预估费用，与工资条「加班费」进行比对，核实是否足额发放或调休准确。
            </div>
          </div>

          {/* 移动端窄屏自适应卡片流 (优化字数与排版布局) */}
          <div className="block md:hidden space-y-3">
            {monthlyLinkageData.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 dark:text-zinc-600 text-xs bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80">
                暂无对应月份的薪资或工时记录
              </div>
            ) : (
              paginatedLinkageData.map((row) => {
                const isMatched = row.salaryRecord && Math.abs(row.diff) < 1;
                const isOver = row.salaryRecord && row.diff > 0;
                const isUnder = row.salaryRecord && row.diff < 0;

                return (
                  <div
                    key={row.month}
                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-3 text-xs"
                  >
                    {/* 顶部月份与差额状态 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                          {row.month}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          {row.overtimeCount}次加班 / 共{row.totalHours}h
                        </span>
                      </div>

                      <div>
                        {!row.salaryRecord ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-medium">
                            待发工资条
                          </span>
                        ) : isMatched ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200/50">
                            <CheckCircle2 className="w-3 h-3" /> 金额吻合
                          </span>
                        ) : isOver ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200/50">
                            实发多 +{formatCurrency(row.diff)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold border border-rose-200/50">
                            实发少 {formatCurrency(Math.abs(row.diff))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3列精简对比指标 */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-[11px]">
                      <div>
                        <span className="text-zinc-400 text-[10px] block">预估加班费</span>
                        <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {hidePrivacy ? '••••' : formatCurrency(row.estimatedOvertimePay)}
                        </span>
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 block mt-0.5">
                          转薪 {row.paidHours}h
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 text-[10px] block">实发加班费</span>
                        <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {row.salaryRecord
                            ? hidePrivacy
                              ? '••••'
                              : formatCurrency(row.actualOvertimePay)
                            : '-'}
                        </span>
                        <span className="text-[9px] text-zinc-400 block mt-0.5">
                          {row.salaryRecord ? '工资条实发' : '未发放'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 text-[10px] block">调休工时</span>
                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                          {row.compHours} <span className="text-[9px] font-normal">h</span>
                        </span>
                        <span className="text-[9px] text-zinc-400 block mt-0.5">
                          调休池累积
                        </span>
                      </div>
                    </div>

                    {/* 差异说明 (如果有差异) */}
                    {row.salaryRecord && !isMatched && (
                      <div className="text-[11px] p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                        <span>核对差额比对:</span>
                        <span className={`font-mono font-bold ${isOver ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isOver ? `多发 ¥${row.diff.toFixed(2)}` : `少发 ¥${Math.abs(row.diff).toFixed(2)}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 桌面/平板端完整数据表格 */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-200/80 dark:border-zinc-800/80">
                <tr>
                  <th className="p-3.5">核算月份</th>
                  <th className="p-3.5">总加班工时</th>
                  <th className="p-3.5">转薪工时</th>
                  <th className="p-3.5">转调休工时</th>
                  <th className="p-3.5">预估加班费</th>
                  <th className="p-3.5">工资条实发</th>
                  <th className="p-3.5">核对差额状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 font-mono">
                {monthlyLinkageData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-400 font-sans">
                      暂无对应月份的薪资或工时记录
                    </td>
                  </tr>
                ) : (
                  paginatedLinkageData.map((row) => (
                    <tr key={row.month} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="p-3.5 font-bold text-zinc-900 dark:text-zinc-100 font-sans">
                        {row.month}
                      </td>
                      <td className="p-3.5 text-zinc-700 dark:text-zinc-300">
                        {row.totalHours} 小时 ({row.overtimeCount}次)
                      </td>
                      <td className="p-3.5 text-amber-600 dark:text-amber-400">
                        {row.paidHours} 小时
                      </td>
                      <td className="p-3.5 text-purple-600 dark:text-purple-400">
                        {row.compHours} 小时
                      </td>
                      <td className="p-3.5 text-zinc-800 dark:text-zinc-200 font-semibold">
                        {hidePrivacy ? '••••' : formatCurrency(row.estimatedOvertimePay)}
                      </td>
                      <td className="p-3.5 text-zinc-800 dark:text-zinc-200 font-semibold">
                        {row.salaryRecord ? (
                          hidePrivacy ? (
                            '••••'
                          ) : (
                            formatCurrency(row.actualOvertimePay)
                          )
                        ) : (
                          <span className="text-zinc-400 font-sans text-[11px]">未录入工资条</span>
                        )}
                      </td>
                      <td className="p-3.5 font-sans">
                        {!row.salaryRecord ? (
                          <span className="text-[11px] text-zinc-400">待工资发放</span>
                        ) : Math.abs(row.diff) < 1 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3" /> 金额吻合
                          </span>
                        ) : row.diff > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                            实发多 +{formatCurrency(row.diff)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                            实发少 {formatCurrency(Math.abs(row.diff))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={linkagePage}
            totalItems={monthlyLinkageData.length}
            pageSize={linkagePageSize}
            onPageChange={setLinkagePage}
            onPageSizeChange={setLinkagePageSize}
            pageSizeOptions={[6, 12, 24, 36]}
          />
        </div>
      )}

      {/* 录入 / 编辑薪资 Modal */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs my-auto max-h-[calc(100vh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {editingSalaryId ? '编辑薪资记录' : '录入薪资工资条'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    支持加班费倍率拆解、长夜班补贴、全勤奖、自定义补贴与扣除项自动计算
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSalaryModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSalarySubmit} className="space-y-4 flex-1">
              {/* 1. 基础薪资信息 */}
              <div className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <span>基本信息与固定薪资</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">薪酬月份 *</label>
                    <input
                      type="month"
                      required
                      value={salaryForm.month}
                      onChange={(e) => setSalaryForm({ ...salaryForm, month: e.target.value })}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">公司/单位名称</label>
                    <input
                      type="text"
                      value={salaryForm.companyName}
                      onChange={(e) => setSalaryForm({ ...salaryForm, companyName: e.target.value })}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">发放日期</label>
                    <input
                      type="date"
                      value={salaryForm.payDate}
                      onChange={(e) => setSalaryForm({ ...salaryForm, payDate: e.target.value })}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-zinc-600 dark:text-zinc-400 font-medium">基本工资 (月薪基数) *</label>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        折算时薪: ¥{(Number(salaryForm.baseSalary || 0) / 21.75 / 8).toFixed(2)}/h
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs">¥</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={salaryForm.baseSalary}
                        onChange={(e) => setSalaryForm({ ...salaryForm, baseSalary: Number(e.target.value) })}
                        className="w-full min-w-0 block pl-7 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">绩效/岗位奖金</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs">¥</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={salaryForm.performancePay}
                        onChange={(e) => setSalaryForm({ ...salaryForm, performancePay: Number(e.target.value) })}
                        className="w-full min-w-0 block pl-7 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 加班工资分项核算 (1.5倍 / 2倍 / 3倍 与自动计算) */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>加班工资分项核算 (1.5倍 / 2倍 / 3倍)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleImportMonthOvertimes}
                    className="text-[11px] px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 font-medium transition-colors cursor-pointer flex items-center gap-1"
                    title="根据本月已在系统中登记并选择折现结算的加班工时一键填入"
                  >
                    <span>⚡ 从本月已登记加班工时导入</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1.5倍 */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-800 dark:text-amber-300 text-[11px]">平日延时 (1.5倍)</span>
                      <span className="text-[10px] text-zinc-400">1.5x</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">工时(小时)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={salaryForm.overtime15Hours || ''}
                          placeholder="0"
                          onChange={(e) => handleOvertimeHoursChange('15', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">加班工资(元)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={salaryForm.overtime15Pay || ''}
                          placeholder="0.00"
                          onChange={(e) => handleOvertimePayChange('15', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs font-bold text-amber-700 dark:text-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2.0倍 */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-800 dark:text-amber-300 text-[11px]">周末加班 (2.0倍)</span>
                      <span className="text-[10px] text-zinc-400">2.0x</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">工时(小时)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={salaryForm.overtime20Hours || ''}
                          placeholder="0"
                          onChange={(e) => handleOvertimeHoursChange('20', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">加班工资(元)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={salaryForm.overtime20Pay || ''}
                          placeholder="0.00"
                          onChange={(e) => handleOvertimePayChange('20', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs font-bold text-amber-700 dark:text-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3.0倍 */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-800 dark:text-amber-300 text-[11px]">法定节假日 (3.0倍)</span>
                      <span className="text-[10px] text-zinc-400">3.0x</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">工时(小时)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={salaryForm.overtime30Hours || ''}
                          placeholder="0"
                          onChange={(e) => handleOvertimeHoursChange('30', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">加班工资(元)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={salaryForm.overtime30Pay || ''}
                          placeholder="0.00"
                          onChange={(e) => handleOvertimePayChange('30', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs font-bold text-amber-700 dark:text-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 加班费合计栏 */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-mono text-[11px]">
                  <span>
                    1.5倍(¥{salaryForm.overtime15Pay || 0}) + 2.0倍(¥{salaryForm.overtime20Pay || 0}) + 3.0倍(¥{salaryForm.overtime30Pay || 0})
                  </span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>加班费合计:</span>
                    <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
                      ¥{Number(salaryForm.overtimePay || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. 津补贴明细 (长夜班天数/补贴、全勤奖、其它自定义补贴) */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>津补贴明细 (长夜班 / 全勤 / 自定义补贴)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddCustomAllowance('岗位津贴', 300)}
                    className="text-[11px] px-2.5 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 font-medium transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加自定义补贴</span>
                  </button>
                </div>

                {/* 长夜班天数、单价与补贴小计 */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200/60 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 dark:text-indigo-300 text-[11px] flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>长夜班补贴核算</span>
                    </span>
                    <span className="text-[10px] text-zinc-400">自动联动计算: 天数 × 补贴单价</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-0.5">长夜班天数 (天)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={salaryForm.nightShiftDays || ''}
                        placeholder="如: 8"
                        onChange={(e) =>
                          handleNightShiftChange(Number(e.target.value), Number(salaryForm.nightShiftRate || 0))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-0.5">每日补贴标准 (元/天)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={salaryForm.nightShiftRate || ''}
                        placeholder="如: 50"
                        onChange={(e) =>
                          handleNightShiftChange(Number(salaryForm.nightShiftDays || 0), Number(e.target.value))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 mb-0.5">长夜班补贴金额 (元)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={salaryForm.nightShiftPay || ''}
                        placeholder="0.00"
                        onChange={(e) => handleNightShiftPayDirectChange(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-indigo-700 dark:text-indigo-400 font-mono text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* 全勤补贴与常规基础津贴 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200/60 dark:border-zinc-800">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      全勤补贴 (元)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={salaryForm.fullAttendancePay || ''}
                      placeholder="如: 200 / 300"
                      onChange={(e) => handleFullAttendanceChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs font-semibold"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200/60 dark:border-zinc-800">
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      常规基础津贴 (餐补/交通等)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={salaryForm.baseAllowance || ''}
                      placeholder="如: 500"
                      onChange={(e) => handleBaseAllowanceChange(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* 其它自定义补贴列表 */}
                {salaryForm.customAllowances.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">其它自定义补贴项目:</div>
                    <div className="space-y-1.5">
                      {salaryForm.customAllowances.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800"
                        >
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              handleUpdateCustomAllowance(item.id, e.target.value, Number(item.amount) || 0)
                            }
                            placeholder="补贴名称 (如: 高温补贴)"
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs"
                          />
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-mono">¥</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.amount || ''}
                              onChange={(e) =>
                                handleUpdateCustomAllowance(item.id, item.name, Number(e.target.value))
                              }
                              placeholder="0.00"
                              className="w-full pl-5 pr-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomAllowance(item.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 快捷添加常见预设补贴 */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400 pt-0.5">
                  <span>常用补贴预设:</span>
                  {['高温补贴', '住房补贴', '通讯补贴', '外派津贴'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddCustomAllowance(preset, 200)}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {/* 津补贴合计栏 */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-mono text-[11px]">
                  <span>
                    夜班(¥{salaryForm.nightShiftPay || 0}) + 全勤(¥{salaryForm.fullAttendancePay || 0}) + 基础(¥{salaryForm.baseAllowance || 0}) + 自定义(¥{customAllowancesTotal})
                  </span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>津补贴合计:</span>
                    <span className="text-sm font-extrabold text-indigo-700 dark:text-indigo-400">
                      ¥{Number(salaryForm.allowance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. 五险一金扣除设置与其它自定义扣除项 */}
              <div className="p-3.5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>五险一金扣除与其它扣除项 (自动计算)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={salaryForm.isCustomInsurance}
                        onChange={(e) => handleToggleCustomInsurance(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>自定义微调五险一金</span>
                    </label>

                    {salaryForm.isCustomInsurance && (
                      <>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 font-medium hidden sm:inline-block">
                          ✨ 自动记忆带入下次新建
                        </span>
                        <button
                          type="button"
                          onClick={handleResetStandardInsurance}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          ⚡ 恢复标准费率测算
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 五险一金个人承担明细 */}
                {salaryForm.isCustomInsurance ? (
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
                    <div className="text-[11px] text-zinc-500 font-medium">个人承担五险一金 (允许自由修改扣款金额):</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">养老保险 (个人)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={salaryForm.customPersonalPension}
                          onChange={(e) =>
                            setSalaryForm({ ...salaryForm, customPersonalPension: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">医疗保险 (个人)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={salaryForm.customPersonalMedical}
                          onChange={(e) =>
                            setSalaryForm({ ...salaryForm, customPersonalMedical: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">失业保险 (个人)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={salaryForm.customPersonalUnemployment}
                          onChange={(e) =>
                            setSalaryForm({ ...salaryForm, customPersonalUnemployment: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-0.5">住房公积金 (个人)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={salaryForm.customPersonalHousingFund}
                          onChange={(e) =>
                            setSalaryForm({ ...salaryForm, customPersonalHousingFund: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">养老 (8%)</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">¥{salaryCalc.pensionPersonal}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">医疗 (2%+3)</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">¥{salaryCalc.medicalPersonal}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">失业 (0.5%)</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">¥{salaryCalc.unemploymentPersonal}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">公积金 (12%)</span>
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">¥{salaryCalc.housingFundPersonal}</span>
                    </div>
                  </div>
                )}

                {/* 其它可自定义扣除项 */}
                <div className="space-y-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        其它扣除项 (企业年金 / 工会会费 / 水电房租 / 考勤扣款等)
                      </span>
                      {salaryForm.customDeductions.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 font-medium">
                          ✨ 自动记忆带入
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddCustomDeduction('工会会费', 50)}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>添加扣除项</span>
                    </button>
                  </div>

                  {salaryForm.customDeductions.length > 0 ? (
                    <div className="space-y-1.5">
                      {salaryForm.customDeductions.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800"
                        >
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) =>
                              handleUpdateCustomDeduction(item.id, e.target.value, Number(item.amount) || 0)
                            }
                            placeholder="扣除项名称 (如: 工会会费 / 水电费)"
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs"
                          />
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-rose-400 text-xs font-mono">-¥</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.amount || ''}
                              onChange={(e) =>
                                handleUpdateCustomDeduction(item.id, item.name, Number(e.target.value))
                              }
                              placeholder="0.00"
                              className="w-full pl-6 pr-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-rose-600 dark:text-rose-400 font-mono text-xs font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomDeduction(item.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-400">暂无其它扣除项，如有企业年金、工会费或水电费扣款可点击右侧添加</div>
                  )}

                  {/* 快捷扣除项标签 */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                    <span>常见扣除预设:</span>
                    {['工会会费', '企业年金', '水电住宿费', '迟到缺勤扣款'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAddCustomDeduction(preset, preset.includes('会费') ? 50 : 100)}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>

                  {/* 扣除汇总卡片 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
                    <span>
                      个人五险一金(-¥{salaryCalc.totalPersonalInsurance}) + 其它扣除(-¥{otherDeductionsTotal})
                    </span>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>个人扣除总计:</span>
                      <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                        -¥{(salaryCalc.totalPersonalInsurance + otherDeductionsTotal).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. 专项附加扣除与其他税前扣除 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    专项附加扣除 (赡养/子女/房贷)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={salaryForm.specialDeductions}
                    onChange={(e) => setSalaryForm({ ...salaryForm, specialDeductions: Number(e.target.value) })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    税前缺勤扣除 (事假/病假)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={salaryForm.preTaxDeduction}
                    onChange={(e) => setSalaryForm({ ...salaryForm, preTaxDeduction: Number(e.target.value) })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">其他奖金/提成</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={salaryForm.otherBonus}
                    onChange={(e) => setSalaryForm({ ...salaryForm, otherBonus: Number(e.target.value) })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {/* 6. 实时税费与实发核算看板 */}
              <div className="p-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-950 dark:border dark:border-zinc-800 space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-2">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    <span>薪资实时联动测算结果</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">起征点 ¥5000 / 月度预扣税率</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">应发合计 (税前)</span>
                    <span className="font-bold text-sm text-zinc-100">¥{salaryCalc.grossSalary}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">个人五险一金</span>
                    <span className="font-bold text-sm text-rose-400">-¥{salaryCalc.totalPersonalInsurance}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">其它扣除项</span>
                    <span className="font-bold text-sm text-rose-400">-¥{otherDeductionsTotal}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">代扣个人所得税</span>
                    <span className="font-bold text-sm text-amber-400">-¥{salaryCalc.individualIncomeTax}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                  <div>
                    <span className="text-zinc-400 text-[10px] block">预计税后实发金额 (到手工资)</span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                      ¥{salaryCalc.netSalary.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-left sm:text-right text-[11px] text-zinc-400">
                    <div>企业用工总成本: <strong className="text-zinc-200">¥{salaryCalc.companyTotalCost}</strong></div>
                    <div className="text-[10px] text-zinc-500">包含企业五险一金 ¥{salaryCalc.totalCompanyInsurance}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">备注说明</label>
                <input
                  type="text"
                  placeholder="如: Q3 季度评优奖金 / 补发津贴 / 特殊考勤说明..."
                  value={salaryForm.notes}
                  onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold cursor-pointer shadow-sm"
                >
                  保存薪资记录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 录入 / 编辑加班 Modal */}
      {isOvertimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs my-auto max-h-[calc(100vh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <span>{editingOvertimeId ? '编辑加班记录' : '记录加班工时'}</span>
              </h3>
              <button
                onClick={() => setIsOvertimeModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOvertimeSubmit} className="space-y-3.5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班日期</label>
                  <input
                    type="date"
                    required
                    value={overtimeForm.date}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班类型</label>
                  <select
                    value={overtimeForm.type}
                    onChange={(e) => {
                      const t = e.target.value as 'workday' | 'weekend' | 'holiday';
                      const mult = t === 'workday' ? 1.5 : t === 'weekend' ? 2.0 : 3.0;
                      setOvertimeForm({ ...overtimeForm, type: t, multiplier: mult });
                    }}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="workday">工作日延时 (1.5x)</option>
                    <option value="weekend">周末加班 (2.0x)</option>
                    <option value="holiday">法定节假日 (3.0x)</option>
                  </select>
                </div>
              </div>

              {/* 开始与结束时间 (由开始时间和结束时间自动计算工时) */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                      开始时间
                    </label>
                    <input
                      type="time"
                      required
                      value={overtimeForm.startTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const details = getOvertimeTimeDetails(newStart, overtimeForm.endTime);
                        const isDeep = isDeepNightShift(newStart, overtimeForm.endTime);
                        setOvertimeForm({
                          ...overtimeForm,
                          startTime: newStart,
                          durationHours: details.hours,
                          ...(isDeep
                            ? {
                                isNightShift: true,
                                nightShiftSubsidy:
                                  overtimeForm.nightShiftSubsidy && overtimeForm.nightShiftSubsidy > 0
                                    ? overtimeForm.nightShiftSubsidy
                                    : 50,
                              }
                            : {}),
                        });
                      }}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                      结束时间
                    </label>
                    <input
                      type="time"
                      required
                      value={overtimeForm.endTime}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        const details = getOvertimeTimeDetails(overtimeForm.startTime, newEnd);
                        const isDeep = isDeepNightShift(overtimeForm.startTime, newEnd);
                        setOvertimeForm({
                          ...overtimeForm,
                          endTime: newEnd,
                          durationHours: details.hours,
                          ...(isDeep
                            ? {
                                isNightShift: true,
                                nightShiftSubsidy:
                                  overtimeForm.nightShiftSubsidy && overtimeForm.nightShiftSubsidy > 0
                                    ? overtimeForm.nightShiftSubsidy
                                    : 50,
                              }
                            : {}),
                        });
                      }}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                </div>

                {/* 常用加班班次快捷预设 (一键填入起止时间并自动计算工时与倍率) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">常用班次快捷填入:</span>
                    <span className="text-[10px] text-zinc-400">点击自动设置时间、工时与倍率</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {OVERTIME_SHIFT_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setOvertimeForm({
                            ...overtimeForm,
                            startTime: preset.start,
                            endTime: preset.end,
                            durationHours: preset.hours,
                            type: preset.type,
                            multiplier: preset.multiplier,
                            isNightShift: Boolean(preset.isNightShift),
                            nightShiftSubsidy: preset.isNightShift
                              ? (overtimeForm.nightShiftSubsidy || 50)
                              : overtimeForm.nightShiftSubsidy,
                          });
                        }}
                        className={`text-[11px] p-2 rounded-xl transition-all cursor-pointer text-left flex flex-col justify-between ${
                          preset.isNightShift
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400'
                            : 'bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-950/40 dark:hover:border-amber-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{preset.label}</span>
                          {preset.isNightShift && (
                            <Moon className="w-3 h-3 text-indigo-500" />
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{preset.span} ({preset.hours}h)</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 实时工时计算与跨夜检测卡片 */}
                {(() => {
                  const details = getOvertimeTimeDetails(overtimeForm.startTime, overtimeForm.endTime);
                  const est = (Number(overtimeForm.durationHours) * Number(overtimeForm.hourlyRate) * Number(overtimeForm.multiplier)).toFixed(2);
                  return (
                    <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>
                            时间跨度: {overtimeForm.startTime || '--:--'} 至 {overtimeForm.endTime || '--:--'} ({details.formattedSpan})
                          </span>
                        </span>
                        {details.isOvernight && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                            🌙 次日跨午夜
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                        <span>
                          系统工时: <strong className="text-amber-700 dark:text-amber-400 font-bold">{details.hours} 小时</strong>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          预计加班费: {overtimeForm.durationHours}h × ¥{Number(overtimeForm.hourlyRate).toFixed(2)} × {overtimeForm.multiplier}x = ¥{est}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 加班基准时薪 (自定义设置) 与倍率设置 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium">
                      加班基准时薪 (元/小时)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const auto = Number((defaultBaseSalary / 21.75 / 8).toFixed(2));
                        setOvertimeForm({ ...overtimeForm, hourlyRate: auto });
                      }}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      title={`按基准月薪 ¥${defaultBaseSalary} 自动推算: ¥${(defaultBaseSalary / 21.75 / 8).toFixed(2)}/h`}
                    >
                      ⚡ 按月薪基数推算
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">¥</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={overtimeForm.hourlyRate}
                      onChange={(e) =>
                        setOvertimeForm({ ...overtimeForm, hourlyRate: Number(e.target.value) })
                      }
                      className="w-full min-w-0 block pl-7 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-sm"
                      placeholder="如: 103.45"
                    />
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    支持自由修改输入，用于折算加班费
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    结算方式
                  </label>
                  <select
                    value={overtimeForm.settlementType}
                    onChange={(e) =>
                      setOvertimeForm({ ...overtimeForm, settlementType: e.target.value as any })
                    }
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm"
                  >
                    <option value="paid">发放加班费 (计入应发工资)</option>
                    <option value="comp_time">计入调休池 (折算调休假期)</option>
                    <option value="pending">待定结算</option>
                  </select>
                </div>
              </div>

              {/* 加班时长 (自动计算，支持手动微调) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium">
                    加班结算工时 (小时)
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    ⚡ 支持快捷扣除就餐休息
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={overtimeForm.durationHours}
                    onChange={(e) =>
                      setOvertimeForm({ ...overtimeForm, durationHours: Number(e.target.value) })
                    }
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-sm"
                  />
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setOvertimeForm({
                          ...overtimeForm,
                          durationHours: Math.max(
                            0,
                            Number((overtimeForm.durationHours - 0.5).toFixed(1))
                          ),
                        })
                      }
                      className="text-[10px] px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      -0.5h 晚餐
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOvertimeForm({
                          ...overtimeForm,
                          durationHours: Math.max(
                            0,
                            Number((overtimeForm.durationHours - 1.0).toFixed(1))
                          ),
                        })
                      }
                      className="text-[10px] px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      -1h 休息
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const auto = calculateOvertimeDuration(
                          overtimeForm.startTime,
                          overtimeForm.endTime
                        );
                        setOvertimeForm({ ...overtimeForm, durationHours: auto });
                      }}
                      className="text-[10px] px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 cursor-pointer"
                    >
                      ⚡ 重新按起止计算
                    </button>
                  </div>
                </div>
              </div>

              {/* 是否是长夜班及长夜班补贴设置 */}
              <div
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                  overtimeForm.isNightShift
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overtimeForm.isNightShift}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOvertimeForm({
                          ...overtimeForm,
                          isNightShift: checked,
                          nightShiftSubsidy: checked ? (overtimeForm.nightShiftSubsidy || 50) : 0,
                        });
                      }}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 text-xs">
                      <Moon className={`w-4 h-4 ${overtimeForm.isNightShift ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'}`} />
                      <span>是否是长夜班（长夜班有补贴）</span>
                    </div>
                  </label>
                  {overtimeForm.isNightShift && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {isDeepNightShift(overtimeForm.startTime, overtimeForm.endTime) ||
                      (overtimeForm.reason &&
                        (overtimeForm.reason.includes('晚间深加班') || overtimeForm.reason.includes('深加班')))
                        ? '🌙 晚间深加班已自动识别为长夜班'
                        : '已启用长夜班补贴'}
                    </span>
                  )}
                </div>

                {overtimeForm.isNightShift && (
                  <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/50 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                        长夜班单日补贴 (元/天)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs">¥</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={overtimeForm.nightShiftSubsidy}
                          onChange={(e) =>
                            setOvertimeForm({
                              ...overtimeForm,
                              nightShiftSubsidy: Number(e.target.value),
                            })
                          }
                          className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-xs"
                          placeholder="50"
                        />
                      </div>
                    </div>
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-white/70 dark:bg-zinc-900/70 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                      💡 晚间深加班属于长夜班，单班补贴金额可自由输入（当前单班补贴: +¥{Number(overtimeForm.nightShiftSubsidy) || 0}）。在工资条中可<strong>一键导入当月长夜班天数与总补贴</strong>。
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班事由/项目</label>
                <input
                  type="text"
                  placeholder="如: V3.0核心系统上线冲刺联调"
                  value={overtimeForm.reason}
                  onChange={(e) => {
                    const r = e.target.value;
                    const isDeep = r.includes('晚间深加班') || r.includes('深加班') || r.includes('长夜班');
                    setOvertimeForm({
                      ...overtimeForm,
                      reason: r,
                      ...(isDeep
                        ? {
                            isNightShift: true,
                            nightShiftSubsidy:
                              overtimeForm.nightShiftSubsidy && overtimeForm.nightShiftSubsidy > 0
                                ? overtimeForm.nightShiftSubsidy
                                : 50,
                          }
                        : {}),
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsOvertimeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold cursor-pointer"
                >
                  保存工时记录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 确认删除薪资/工时记录弹窗 (无 window.confirm) */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  确认删除此条{deleteConfirm.type === 'salary' ? '薪资' : '工时'}记录？
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  将永久删除「{deleteConfirm.label}」，此操作不可撤销。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.type === 'salary') {
                    onDeleteSalary(deleteConfirm.id);
                  } else {
                    onDeleteOvertime(deleteConfirm.id);
                  }
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
