import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  Link,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { FiveInsuranceRates, OvertimeRecord, SalaryRecord } from '../../types';
import { formatCurrency } from '../../utils/taxCalculator';
import { OvertimeView } from './OvertimeView';
import { SalaryView } from './SalaryView';

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

  // 综合数据指标统计
  const stats = useMemo(() => {
    const totalNetSalary = salaries.reduce((sum, s) => sum + s.netSalary, 0);
    const totalPersonalInsurance = salaries.reduce((sum, s) => sum + s.totalPersonalInsurance, 0);
    const totalOvertimeHours = overtimes.reduce((sum, o) => sum + o.durationHours, 0);

    // 调休池统计 (转调休的总工时 - 已使用的调休工时)
    const compTimeOvertimes = overtimes.filter((o) => o.settlementType === 'comp_time');
    const totalCompTimeEarned = compTimeOvertimes.reduce((sum, o) => sum + o.durationHours, 0);
    const totalCompTimeUsed = compTimeOvertimes.reduce((sum, o) => sum + (o.compTimeHoursUsed || 0), 0);
    const remainingCompTime = Math.max(0, totalCompTimeEarned - totalCompTimeUsed);

    // 预估累计加班费
    const paidOvertimes = overtimes.filter((o) => o.settlementType === 'paid');
    const totalPaidOvertimeAmount = paidOvertimes.reduce((sum, o) => sum + o.estimatedPay, 0);

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
        const estimatedOvertimePay = paidOvertimes.reduce((sum, o) => sum + o.estimatedPay, 0);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部综合资产与工时聚合统计看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">累计税后薪资</span>
            <Banknote className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {hidePrivacy ? '••••••' : formatCurrency(stats.totalNetSalary)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">共 {salaries.length} 个月份发薪记录</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">个人五险一金</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {hidePrivacy ? '••••••' : formatCurrency(stats.totalPersonalInsurance)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">养老/医疗/失业/公积金代缴</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">累计加班工时</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {stats.totalOvertimeHours} <span className="text-xs font-normal text-zinc-500">小时</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            预估加班费: {hidePrivacy ? '••••' : formatCurrency(stats.totalPaidOvertimeAmount)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">剩余可用调休</span>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {stats.remainingCompTime} <span className="text-xs font-normal text-zinc-500">小时</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            ≈ {(stats.remainingCompTime / 8).toFixed(1)} 个法定工作日
          </p>
        </div>
      </div>

      {/* 模块聚合导航子标签 */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('salary')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'salary'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>工资薪酬与五险一金</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-700/30 text-current ml-0.5">
              {salaries.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('overtime')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'overtime'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>加班工时与调休台账</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-700/30 text-current ml-0.5">
              {overtimes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('linkage')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'linkage'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>工时与薪酬联动核对</span>
          </button>
        </div>
      </div>

      {/* 1. 薪酬与五险一金子面板 */}
      {activeSubTab === 'salary' && (
        <SalaryView
          salaries={salaries}
          onSaveSalary={onSaveSalary}
          onDeleteSalary={onDeleteSalary}
          hidePrivacy={hidePrivacy}
          defaultRates={defaultRates}
        />
      )}

      {/* 2. 加班工时与调休子面板 */}
      {activeSubTab === 'overtime' && (
        <OvertimeView
          overtimes={overtimes}
          onSaveOvertime={onSaveOvertime}
          onDeleteOvertime={onDeleteOvertime}
          hidePrivacy={hidePrivacy}
          defaultBaseSalary={defaultBaseSalary}
        />
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
    </div>
  );
};
