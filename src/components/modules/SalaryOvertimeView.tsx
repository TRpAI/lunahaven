import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Building2,
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
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { FiveInsuranceRates, OvertimeRecord, SalaryRecord } from '../../types';
import { exportOvertimesToCsv, exportSalariesToCsv, triggerFileDownload } from '../../utils/exportImport';
import { calculateSalaryBreakdown, formatCurrency } from '../../utils/taxCalculator';

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

  // --- Salary Modal State ---
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null);
  const [expandedSalaryId, setExpandedSalaryId] = useState<string | null>(
    salaries.length > 0 ? salaries[0].id : null
  );

  const [salaryForm, setSalaryForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    companyName: '科技创新互联网科技有限公司',
    baseSalary: 18000,
    performancePay: 4500,
    overtimePay: 1500,
    allowance: 1200,
    otherBonus: 0,
    preTaxDeduction: 0,
    specialDeductions: 3000,
    payDate: `${new Date().toISOString().slice(0, 7)}-10`,
    notes: '',
  });

  // --- Overtime Modal State ---
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [editingOvertimeId, setEditingOvertimeId] = useState<string | null>(null);

  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'workday' as 'workday' | 'weekend' | 'holiday',
    startTime: '18:30',
    endTime: '21:30',
    durationHours: 3,
    multiplier: 1.5,
    settlementType: 'paid' as 'paid' | 'comp_time' | 'pending',
    hourlyRate: 103.45,
    reason: '',
    approver: '',
    notes: '',
  });

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
    });
  }, [salaryForm, defaultRates]);

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

    return {
      totalNetSalary,
      totalPersonalInsurance,
      totalOvertimeHours,
      remainingCompTime,
      totalPaidOvertimeAmount,
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

  // --- Handlers: Salary ---
  const handleOpenAddSalary = () => {
    setEditingSalaryId(null);
    setSalaryForm({
      month: new Date().toISOString().slice(0, 7),
      companyName: salaries.length > 0 ? salaries[0].companyName || '' : '科技创新互联网科技有限公司',
      baseSalary: defaultBaseSalary,
      performancePay: 4500,
      overtimePay: 1500,
      allowance: 1200,
      otherBonus: 0,
      preTaxDeduction: 0,
      specialDeductions: 3000,
      payDate: `${new Date().toISOString().slice(0, 7)}-10`,
      notes: '',
    });
    setIsSalaryModalOpen(true);
  };

  const handleOpenEditSalary = (s: SalaryRecord) => {
    setEditingSalaryId(s.id);
    setSalaryForm({
      month: s.month,
      companyName: s.companyName || '',
      baseSalary: s.baseSalary,
      performancePay: s.performancePay,
      overtimePay: s.overtimePay,
      allowance: s.allowance,
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
      overtimePay: Number(salaryForm.overtimePay) || 0,
      allowance: Number(salaryForm.allowance) || 0,
      otherBonus: Number(salaryForm.otherBonus) || 0,
      preTaxDeduction: Number(salaryForm.preTaxDeduction) || 0,
      grossSalary: salaryCalc.grossSalary,
      pensionPersonal: salaryCalc.pensionPersonal,
      medicalPersonal: salaryCalc.medicalPersonal,
      unemploymentPersonal: salaryCalc.unemploymentPersonal,
      housingFundPersonal: salaryCalc.housingFundPersonal,
      totalPersonalInsurance: salaryCalc.totalPersonalInsurance,
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
    setIsSalaryModalOpen(false);
  };

  // --- Handlers: Overtime ---
  const handleOpenAddOvertime = () => {
    setEditingOvertimeId(null);
    const hourly = Number((defaultBaseSalary / 21.75 / 8).toFixed(2));
    setOvertimeForm({
      date: new Date().toISOString().slice(0, 10),
      type: 'workday',
      startTime: '18:30',
      endTime: '21:30',
      durationHours: 3,
      multiplier: 1.5,
      settlementType: 'paid',
      hourlyRate: hourly || 103.45,
      reason: '',
      approver: '',
      notes: '',
    });
    setIsOvertimeModalOpen(true);
  };

  const handleOpenEditOvertime = (o: OvertimeRecord) => {
    setEditingOvertimeId(o.id);
    setOvertimeForm({
      date: o.date,
      type: o.type,
      startTime: o.startTime || '',
      endTime: o.endTime || '',
      durationHours: o.durationHours,
      multiplier: o.multiplier,
      settlementType: o.settlementType,
      hourlyRate: o.hourlyRate || Number((defaultBaseSalary / 21.75 / 8).toFixed(2)),
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
            salaries.map((s) => {
              const isExpanded = expandedSalaryId === s.id;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedSalaryId(isExpanded ? null : s.id)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold flex items-center justify-center text-xs">
                        {s.month.slice(5)}月
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">{s.month}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.companyName}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                          <span>应发: {formatCurrency(s.grossSalary, hidePrivacy)}</span>
                          <span>·</span>
                          <span>个税: {formatCurrency(s.individualIncomeTax, hidePrivacy)}</span>
                          <span>·</span>
                          <span>个人社保公积金: {formatCurrency(s.totalPersonalInsurance, hidePrivacy)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(s.netSalary, hidePrivacy)}
                        </div>
                        <div className="text-[10px] text-zinc-400">税后实发到手</div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditSalary(s);
                          }}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定删除 ${s.month} 月的薪资条记录吗？`)) {
                              onDeleteSalary(s.id);
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 sm:p-5 pt-0 border-t border-zinc-100 dark:border-zinc-800 text-xs space-y-3.5 bg-zinc-50/50 dark:bg-zinc-800/20">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">基本工资</span>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(s.baseSalary, hidePrivacy)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">绩效/奖金</span>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(s.performancePay, hidePrivacy)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">加班费</span>
                          <div className="font-mono font-bold text-amber-600 dark:text-amber-400">{formatCurrency(s.overtimePay, hidePrivacy)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">企业总用人成本</span>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(s.companyTotalCost, hidePrivacy)}</div>
                        </div>
                      </div>

                      {/* 五险一金明细列表 */}
                      <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 space-y-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                          <span>个人与企业五险一金明细</span>
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                          <div>养老保险 (个人): ¥{s.pensionPersonal}</div>
                          <div>医疗保险 (个人): ¥{s.medicalPersonal}</div>
                          <div>失业保险 (个人): ¥{s.unemploymentPersonal}</div>
                          <div>住房公积金 (个人): ¥{s.housingFundPersonal}</div>
                          <div>养老 (企业): ¥{s.pensionCompany}</div>
                          <div>医疗 (企业): ¥{s.medicalCompany}</div>
                          <div>工伤/生育: ¥{s.injuryCompany + s.maternityCompany}</div>
                          <div>公积金 (企业): ¥{s.housingFundCompany}</div>
                        </div>
                      </div>

                      {s.notes && (
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          备注: {s.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
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
            overtimes.map((o) => (
              <div
                key={o.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold flex items-center justify-center text-xs">
                    {o.durationHours}h
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">{o.date}</span>
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px]">
                        {o.type === 'workday' ? '工作日延时 (1.5x)' : o.type === 'weekend' ? '周末加班 (2.0x)' : '法定节假日 (3.0x)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {o.startTime && o.endTime ? `${o.startTime} ~ ${o.endTime} · ` : ''}
                      {o.reason || '日常加班'}
                      {o.approver ? ` · 审批人: ${o.approver}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
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
                      onClick={() => handleOpenEditOvertime(o)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`确定删除 ${o.date} 的加班记录吗？`)) {
                          onDeleteOvertime(o.id);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. 工时与薪酬月度联动核对子面板 */}
      {activeSubTab === 'linkage' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 flex items-start gap-3">
            <Compass className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                加班工时与实发工资自动勾稽核对：
              </span>
              系统自动将当月登记的加班工时（结算类型为「转加班费」）折算出的预估加班费，与当月工资条中的「加班费」项目进行自动比对，帮助您清楚核对薪资发放是否足额、调休是否准确入账。
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-200/80 dark:border-zinc-800/80">
                <tr>
                  <th className="p-3.5">核算月份</th>
                  <th className="p-3.5">总加班工时</th>
                  <th className="p-3.5">转薪工时</th>
                  <th className="p-3.5">转调休工时</th>
                  <th className="p-3.5">系统预估加班费</th>
                  <th className="p-3.5">工资条实发加班费</th>
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
                  monthlyLinkageData.map((row) => (
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
                          <span className="text-zinc-400 font-sans text-[11px]">未录入该月工资条</span>
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
        </div>
      )}

      {/* 录入 / 编辑薪资 Modal */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-blue-500" />
                <span>{editingSalaryId ? '编辑薪资记录' : '录入薪资工资条'}</span>
              </h3>
              <button
                onClick={() => setIsSalaryModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSalarySubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">薪酬月份</label>
                  <input
                    type="month"
                    required
                    value={salaryForm.month}
                    onChange={(e) => setSalaryForm({ ...salaryForm, month: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">公司/单位名称</label>
                  <input
                    type="text"
                    value={salaryForm.companyName}
                    onChange={(e) => setSalaryForm({ ...salaryForm, companyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">基本工资</label>
                  <input
                    type="number"
                    value={salaryForm.baseSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, baseSalary: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">绩效/奖金</label>
                  <input
                    type="number"
                    value={salaryForm.performancePay}
                    onChange={(e) => setSalaryForm({ ...salaryForm, performancePay: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班费</label>
                  <input
                    type="number"
                    value={salaryForm.overtimePay}
                    onChange={(e) => setSalaryForm({ ...salaryForm, overtimePay: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">津补贴</label>
                  <input
                    type="number"
                    value={salaryForm.allowance}
                    onChange={(e) => setSalaryForm({ ...salaryForm, allowance: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">专项附加扣除 (赡养/子女/住房)</label>
                  <input
                    type="number"
                    value={salaryForm.specialDeductions}
                    onChange={(e) => setSalaryForm({ ...salaryForm, specialDeductions: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {/* 实时税费计算结果预览 */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>应发合计 (税前):</span>
                  <span>¥{salaryCalc.grossSalary}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>个人五险一金代扣:</span>
                  <span>-¥{salaryCalc.totalPersonalInsurance}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>个人所得税:</span>
                  <span>-¥{salaryCalc.individualIncomeTax}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 text-xs pt-1 border-t border-zinc-200 dark:border-zinc-700">
                  <span>预计税后实发到手:</span>
                  <span>¥{salaryCalc.netSalary}</span>
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">备注说明</label>
                <input
                  type="text"
                  placeholder="如: Q3 季度评优奖金 / 补发津贴..."
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
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <span>{editingOvertimeId ? '编辑加班记录' : '记录加班工时'}</span>
              </h3>
              <button
                onClick={() => setIsOvertimeModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOvertimeSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班日期</label>
                  <input
                    type="date"
                    required
                    value={overtimeForm.date}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班类型</label>
                  <select
                    value={overtimeForm.type}
                    onChange={(e) => {
                      const t = e.target.value as 'workday' | 'weekend' | 'holiday';
                      const mult = t === 'workday' ? 1.5 : t === 'weekend' ? 2.0 : 3.0;
                      setOvertimeForm({ ...overtimeForm, type: t, multiplier: mult });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="workday">工作日延时 (1.5x)</option>
                    <option value="weekend">周末加班 (2.0x)</option>
                    <option value="holiday">法定节假日 (3.0x)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班时长 (小时)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={overtimeForm.durationHours}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, durationHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">结算方式</label>
                  <select
                    value={overtimeForm.settlementType}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, settlementType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="paid">发放加班费</option>
                    <option value="comp_time">计入调休池</option>
                    <option value="pending">待结算</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">开始时间</label>
                  <input
                    type="time"
                    value={overtimeForm.startTime}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">结束时间</label>
                  <input
                    type="time"
                    value={overtimeForm.endTime}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班事由/项目</label>
                <input
                  type="text"
                  placeholder="如: V3.0核心系统上线冲刺联调"
                  value={overtimeForm.reason}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, reason: e.target.value })}
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
    </div>
  );
};
