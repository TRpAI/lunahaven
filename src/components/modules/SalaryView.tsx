import React, { useState } from 'react';
import {
  Banknote,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { FiveInsuranceRates, SalaryRecord } from '../../types';
import { exportSalariesToCsv, triggerFileDownload } from '../../utils/exportImport';
import {
  calculateSalaryBreakdown,
  formatCurrency,
} from '../../utils/taxCalculator';

interface SalaryViewProps {
  salaries: SalaryRecord[];
  onSaveSalary: (record: SalaryRecord) => void;
  onDeleteSalary: (id: string) => void;
  hidePrivacy: boolean;
  defaultRates: FiveInsuranceRates;
}

export const SalaryView: React.FC<SalaryViewProps> = ({
  salaries,
  onSaveSalary,
  onDeleteSalary,
  hidePrivacy,
  defaultRates,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(salaries.length > 0 ? salaries[0].id : null);

  // Form State
  const [formData, setFormData] = useState({
    month: new Date().toISOString().slice(0, 7),
    companyName: '科技创新互联网科技有限公司',
    baseSalary: 18000,
    performancePay: 4500,
    overtimePay: 1500,
    allowance: 1200,
    otherBonus: 0,
    preTaxDeduction: 0,
    specialDeductions: 3000,
    customInsuranceBase: 18000,
    payDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      month: new Date().toISOString().slice(0, 7),
      companyName: salaries.length > 0 ? salaries[0].companyName : '我的公司',
      baseSalary: 18000,
      performancePay: 4500,
      overtimePay: 1500,
      allowance: 1200,
      otherBonus: 0,
      preTaxDeduction: 0,
      specialDeductions: 3000,
      customInsuranceBase: 18000,
      payDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: SalaryRecord) => {
    setEditingId(s.id);
    setFormData({
      month: s.month,
      companyName: s.companyName,
      baseSalary: s.baseSalary,
      performancePay: s.performancePay,
      overtimePay: s.overtimePay,
      allowance: s.allowance,
      otherBonus: s.otherBonus,
      preTaxDeduction: s.preTaxDeduction,
      specialDeductions: s.specialDeductions,
      customInsuranceBase: s.baseSalary,
      payDate: s.payDate,
      notes: s.notes,
    });
    setIsModalOpen(true);
  };

  // 实时预览计算结果
  const previewCalc = calculateSalaryBreakdown({
    baseSalary: Number(formData.baseSalary) || 0,
    performancePay: Number(formData.performancePay) || 0,
    overtimePay: Number(formData.overtimePay) || 0,
    allowance: Number(formData.allowance) || 0,
    otherBonus: Number(formData.otherBonus) || 0,
    preTaxDeduction: Number(formData.preTaxDeduction) || 0,
    specialDeductions: Number(formData.specialDeductions) || 0,
    customInsuranceBase: Number(formData.customInsuranceBase) || Number(formData.baseSalary) || 0,
    rates: defaultRates,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: SalaryRecord = {
      id: editingId || `sal-${Date.now()}`,
      month: formData.month,
      companyName: formData.companyName,
      baseSalary: Number(formData.baseSalary) || 0,
      performancePay: Number(formData.performancePay) || 0,
      overtimePay: Number(formData.overtimePay) || 0,
      allowance: Number(formData.allowance) || 0,
      otherBonus: Number(formData.otherBonus) || 0,
      preTaxDeduction: Number(formData.preTaxDeduction) || 0,
      grossSalary: previewCalc.grossSalary,

      pensionPersonal: previewCalc.pensionPersonal,
      medicalPersonal: previewCalc.medicalPersonal,
      unemploymentPersonal: previewCalc.unemploymentPersonal,
      housingFundPersonal: previewCalc.housingFundPersonal,
      totalPersonalInsurance: previewCalc.totalPersonalInsurance,

      pensionCompany: previewCalc.pensionCompany,
      medicalCompany: previewCalc.medicalCompany,
      unemploymentCompany: previewCalc.unemploymentCompany,
      injuryCompany: previewCalc.injuryCompany,
      maternityCompany: previewCalc.maternityCompany,
      housingFundCompany: previewCalc.housingFundCompany,
      totalCompanyInsurance: previewCalc.totalCompanyInsurance,

      specialDeductions: previewCalc.specialDeductions,
      taxThreshold: previewCalc.taxThreshold,
      taxableIncome: previewCalc.taxableIncome,
      individualIncomeTax: previewCalc.individualIncomeTax,

      netSalary: previewCalc.netSalary,
      companyTotalCost: previewCalc.companyTotalCost,
      payDate: formData.payDate,
      notes: formData.notes,
      createdAt: editingId ? (salaries.find((s) => s.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveSalary(newRecord);
    setIsModalOpen(false);
  };

  const handleExportCsv = () => {
    const csv = exportSalariesToCsv(salaries);
    triggerFileDownload(csv, `个人薪酬与五险一金记录_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  };

  // 统计数据
  const totalNetAll = salaries.reduce((acc, s) => acc + s.netSalary, 0);
  const totalPersonalFundAll = salaries.reduce((acc, s) => acc + s.housingFundPersonal, 0);
  const totalCompanyFundAll = salaries.reduce((acc, s) => acc + s.housingFundCompany, 0);
  const totalTaxAll = salaries.reduce((acc, s) => acc + s.individualIncomeTax, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部标题与操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            <Banknote className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              工资与五险一金账本
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              智能预扣个税 · 个人与企业五险一金比例明细 · 实发到手
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 CSV</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>录入工资条</span>
          </button>
        </div>
      </div>

      {/* 4 核心指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">累计税后实发到手</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {formatCurrency(totalNetAll, hidePrivacy)}
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">公积金累计存缴 (个人+公司)</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {formatCurrency(totalPersonalFundAll + totalCompanyFundAll, hidePrivacy)}
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">累计已缴纳个税</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {formatCurrency(totalTaxAll, hidePrivacy)}
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">已录入薪资月份</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {salaries.length} <span className="text-xs font-normal text-zinc-400">个月</span>
          </div>
        </div>
      </div>

      {/* 工资记录列表卡片 */}
      <div className="space-y-3">
        {salaries.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
            <Banknote className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium">暂无薪资记录</p>
            <button
              onClick={handleOpenAdd}
              className="mt-3 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs"
            >
              录入第一张工资条
            </button>
          </div>
        ) : (
          salaries.map((s) => {
            const isExpanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden transition-all hover:border-zinc-400 dark:hover:border-zinc-600"
              >
                {/* 顶部主卡片行 */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex flex-col items-center justify-center font-mono font-black shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-[10px] text-zinc-400">{s.month.slice(0, 4)}</span>
                      <span className="text-sm font-bold">{s.month.slice(5)}月</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{s.companyName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                          实发
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
                        <span>应发 {formatCurrency(s.grossSalary, hidePrivacy)}</span>
                        <span>·</span>
                        <span>个税 {formatCurrency(s.individualIncomeTax, hidePrivacy)}</span>
                        <span>·</span>
                        <span>个人五险一金 {formatCurrency(s.totalPersonalInsurance, hidePrivacy)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block">税后实发到手</span>
                      <span className="text-lg sm:text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(s.netSalary, hidePrivacy)}
                      </span>
                    </div>
                    <div className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* 折叠展开详情 */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 bg-zinc-50/70 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800/80 space-y-4 text-xs">
                    {/* 应发薪酬构成 */}
                    <div>
                      <h4 className="font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span>应发工资明细构成</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">基本工资</span>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {formatCurrency(s.baseSalary, hidePrivacy)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">绩效/奖金</span>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {formatCurrency(s.performancePay, hidePrivacy)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">加班费补贴</span>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {formatCurrency(s.overtimePay, hidePrivacy)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">津补贴合计</span>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {formatCurrency(s.allowance, hidePrivacy)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-zinc-400">其他奖金/提成</span>
                          <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {formatCurrency(s.otherBonus, hidePrivacy)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                          <span className="text-[10px] text-rose-500">税前缺勤扣款</span>
                          <div className="font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                            -{formatCurrency(s.preTaxDeduction, hidePrivacy)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 五险一金明细 (个人承担 vs 企业承担 对比) */}
                    <div>
                      <h4 className="font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                        <span>五险一金扣除明细 (个人承担 vs 企业承担)</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 个人部分 */}
                        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">个人承担扣除</span>
                            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                              {formatCurrency(s.totalPersonalInsurance, hidePrivacy)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-zinc-400">养老 (8%):</span>
                              <span className="font-mono font-medium">{formatCurrency(s.pensionPersonal, hidePrivacy)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-400">医疗 (2%+大病):</span>
                              <span className="font-mono font-medium">{formatCurrency(s.medicalPersonal, hidePrivacy)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-400">失业 (0.5%):</span>
                              <span className="font-mono font-medium">{formatCurrency(s.unemploymentPersonal, hidePrivacy)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-400">住房公积金:</span>
                              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(s.housingFundPersonal, hidePrivacy)}</span>
                            </div>
                          </div>
                        </div>

                        {/* 企业部分 */}
                        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">企业承担缴纳</span>
                            <span className="font-mono font-bold text-zinc-500">
                              {formatCurrency(s.totalCompanyInsurance, hidePrivacy)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div className="flex flex-col">
                              <span className="text-zinc-400">养老(16%):</span>
                              <span className="font-mono font-medium">{formatCurrency(s.pensionCompany, hidePrivacy)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-400">医疗(8%):</span>
                              <span className="font-mono font-medium">{formatCurrency(s.medicalCompany, hidePrivacy)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-400">失业(0.5%):</span>
                              <span className="font-mono font-medium">{formatCurrency(s.unemploymentCompany, hidePrivacy)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-400">工伤(~0.4%):</span>
                              <span className="font-mono font-medium">{formatCurrency(s.injuryCompany, hidePrivacy)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-400">生育(~0.8%):</span>
                              <span className="font-mono font-medium">{formatCurrency(s.maternityCompany, hidePrivacy)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-400">公积金:</span>
                              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(s.housingFundCompany, hidePrivacy)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 个税及总用人成本 */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <span className="text-zinc-400 block text-[10px]">专项附加扣除</span>
                          <span className="font-mono font-semibold">{formatCurrency(s.specialDeductions, hidePrivacy)}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[10px]">应纳税所得额</span>
                          <span className="font-mono font-semibold">{formatCurrency(s.taxableIncome, hidePrivacy)}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[10px]">代扣个人所得税</span>
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(s.individualIncomeTax, hidePrivacy)}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[10px]">公司用人总成本</span>
                          <span className="font-mono font-bold">{formatCurrency(s.companyTotalCost, hidePrivacy)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                          title="编辑修改"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`确定删除 ${s.month} 月工资记录吗？`)) {
                              onDeleteSalary(s.id);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                          title="删除记录"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 录入/编辑薪资弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-zinc-500" />
                <span>{editingId ? '编辑工资条记录' : '录入新月份工资条'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">薪资归属月份</label>
                  <input
                    type="month"
                    required
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">公司/用人单位</label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">发薪到账日期</label>
                  <input
                    type="date"
                    required
                    value={formData.payDate}
                    onChange={(e) => setFormData({ ...formData, payDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              {/* 应发各项目 */}
              <div>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-2">应发薪酬各项 (元)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">基本工资</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">绩效/岗位/奖金</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.performancePay}
                      onChange={(e) => setFormData({ ...formData, performancePay: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">加班工资补贴</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.overtimePay}
                      onChange={(e) => setFormData({ ...formData, overtimePay: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">餐补/房补/交通通讯</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.allowance}
                      onChange={(e) => setFormData({ ...formData, allowance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">其他奖金/提成</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.otherBonus}
                      onChange={(e) => setFormData({ ...formData, otherBonus: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-rose-500 mb-1">税前扣款 (请假/缺勤)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.preTaxDeduction}
                      onChange={(e) => setFormData({ ...formData, preTaxDeduction: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-rose-300 dark:border-rose-900/50 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 专项扣除与社保基数 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    个税专项附加扣除 (子女/房贷/租金/赡养等)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={formData.specialDeductions}
                    onChange={(e) => setFormData({ ...formData, specialDeductions: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    社保公积金核定基数 (元)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={formData.customInsuranceBase}
                    onChange={(e) => setFormData({ ...formData, customInsuranceBase: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {/* 实时智能计算预览卡片 */}
              <div className="p-4 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80">
                <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-zinc-100 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span>实时自动核算结果</span>
                  <span className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    实发到手: ¥{previewCalc.netSalary.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <div>应发总额: ¥{previewCalc.grossSalary.toFixed(2)}</div>
                  <div>个人五险一金: ¥{previewCalc.totalPersonalInsurance.toFixed(2)}</div>
                  <div>预扣个税: ¥{previewCalc.individualIncomeTax.toFixed(2)}</div>
                  <div>企业用人成本: ¥{previewCalc.companyTotalCost.toFixed(2)}</div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">备注说明</label>
                <input
                  type="text"
                  placeholder="如: 含季度项目奖金或请假扣款说明"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold shadow-xs cursor-pointer"
                >
                  确认保存工资条
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
