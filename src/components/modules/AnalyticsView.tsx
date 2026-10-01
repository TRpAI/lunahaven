import React, { useMemo, useState } from 'react';
import {
  Banknote,
  BarChart3,
  Calendar,
  Car,
  Clock,
  Fuel,
  Gift,
  PieChart,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { LedgerFullData, MaintenanceCategory } from '../../types';
import { formatCurrency } from '../../utils/taxCalculator';
import { BarChart } from '../charts/BarChart';
import { DoughnutChart } from '../charts/DoughnutChart';
import { LineChart } from '../charts/LineChart';

interface AnalyticsViewProps {
  data: LedgerFullData;
  hidePrivacy: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ data, hidePrivacy }) => {
  const { salaries, overtimes, gifts, fuels, maintenances, vehicles, settings } = data;
  const expenses = data.expenses || [];

  // 年份选择器
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    salaries.forEach((s) => years.add(s.month.slice(0, 4)));
    overtimes.forEach((o) => years.add(o.date.slice(0, 4)));
    expenses.forEach((e) => years.add(e.date.slice(0, 4)));
    gifts.forEach((g) => years.add(g.date.slice(0, 4)));
    fuels.forEach((f) => years.add(f.date.slice(0, 4)));
    if (years.size === 0) years.add(new Date().getFullYear().toString());
    return Array.from(years).sort().reverse();
  }, [salaries, overtimes, expenses, gifts, fuels]);

  const [selectedYear, setSelectedYear] = useState<string>(availableYears[0] || '2026');

  // 0. 日常开销、医疗健康、人情随礼与专项开支月度柱状图数据
  const expensesChartData = useMemo(() => {
    const monthsMap: Record<string, { living: number; special: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      monthsMap[mStr] = { living: 0, special: 0 };
    }

    expenses
      .filter((e) => e.date.startsWith(selectedYear))
      .forEach((e) => {
        const mStr = e.date.slice(0, 7);
        if (monthsMap[mStr]) {
          if (e.type === 'living') monthsMap[mStr].living += e.amount;
          else monthsMap[mStr].special += e.amount; // 医疗 + 人情 + 教育 + 旅行
        }
      });

    return Object.entries(monthsMap)
      .map(([mStr, val]) => ({
        label: `${parseInt(mStr.slice(5))}月`,
        value1: val.living,
        value2: val.special,
        label1: '日常生活(¥)',
        label2: '医疗/人情/专项(¥)',
      }))
      .sort((a, b) => parseInt(a.label) - parseInt(b.label));
  }, [expenses, selectedYear]);

  // 0.5 生活/医疗/人情/教育/旅行开销大类占比环形图
  const expenseTypeSegments = useMemo(() => {
    const yearExpenses = expenses.filter((e) => e.date.startsWith(selectedYear));
    const living = yearExpenses.filter((e) => e.type === 'living').reduce((s, e) => s + e.amount, 0);
    const medical = yearExpenses.filter((e) => e.type === 'medical').reduce((s, e) => s + e.amount, 0);
    const gift = yearExpenses.filter((e) => e.type === 'gift').reduce((s, e) => s + e.amount, 0);
    const education = yearExpenses.filter((e) => e.type === 'education').reduce((s, e) => s + e.amount, 0);
    const travel = yearExpenses.filter((e) => e.type === 'travel').reduce((s, e) => s + e.amount, 0);

    const segments = [
      { label: '日常生活', value: living, color: '#3b82f6' },
      { label: '医疗健康', value: medical, color: '#f43f5e' },
      { label: '人情往来', value: gift, color: '#ec4899' },
      { label: '教育专项', value: education, color: '#a855f7' },
      { label: '旅行度假', value: travel, color: '#f59e0b' },
    ];
    return segments.filter((s) => s.value > 0);
  }, [expenses, selectedYear]);

  // 1. 薪资月度走势图数据
  const salaryChartData = useMemo(() => {
    const filtered = salaries
      .filter((s) => s.month.startsWith(selectedYear))
      .sort((a, b) => a.month.localeCompare(b.month));

    return filtered.map((s) => ({
      label: `${parseInt(s.month.slice(5))}月`,
      value: s.netSalary,
      secondaryValue: s.grossSalary,
      info: `应发 ¥${s.grossSalary} / 实发 ¥${s.netSalary}`,
    }));
  }, [salaries, selectedYear]);

  // 2. 加班工时月度柱状图数据
  const overtimeChartData = useMemo(() => {
    const monthsMap: Record<string, { hours: number; pay: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      monthsMap[mStr] = { hours: 0, pay: 0 };
    }

    overtimes
      .filter((o) => o.date.startsWith(selectedYear))
      .forEach((o) => {
        const mStr = o.date.slice(0, 7);
        if (monthsMap[mStr]) {
          monthsMap[mStr].hours += o.durationHours;
          monthsMap[mStr].pay += o.estimatedPay || 0;
        }
      });

    return Object.entries(monthsMap)
      .map(([mStr, val]) => ({
        label: `${parseInt(mStr.slice(5))}月`,
        value1: val.hours,
        value2: val.pay,
        label1: '加班时长(h)',
        label2: '加班费(¥)',
      }))
      .filter((d) => d.value1 > 0 || d.value2 > 0);
  }, [overtimes, selectedYear]);

  // 3. 人情随礼收支月度柱状图
  const giftsChartData = useMemo(() => {
    const monthsMap: Record<string, { out: number; in: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      monthsMap[mStr] = { out: 0, in: 0 };
    }

    gifts
      .filter((g) => g.date.startsWith(selectedYear))
      .forEach((g) => {
        const mStr = g.date.slice(0, 7);
        if (monthsMap[mStr]) {
          if (g.direction === 'out') {
            monthsMap[mStr].out += g.amount;
          } else {
            monthsMap[mStr].in += g.amount;
          }
        }
      });

    return Object.entries(monthsMap)
      .map(([mStr, val]) => ({
        label: `${parseInt(mStr.slice(5))}月`,
        value1: val.out,
        value2: val.in,
        label1: '送出支出(¥)',
        label2: '收到收入(¥)',
      }))
      .filter((d) => d.value1 > 0 || d.value2 > 0);
  }, [gifts, selectedYear]);

  // 4. 养车全费用占比环形图
  const carCostSegments = useMemo(() => {
    const yearFuels = fuels.filter((f) => f.date.startsWith(selectedYear));
    const yearMaint = maintenances.filter((m) => m.date.startsWith(selectedYear));

    const totalFuel = yearFuels.reduce((acc, f) => acc + f.totalCost, 0);
    const categoryTotals: Record<string, number> = {
      '加油/充电补能': totalFuel,
      '常规小保养': 0,
      '全车大保养': 0,
      '刹车/轮胎': 0,
      '车险/年检': 0,
      '洗车及其他': 0,
    };

    yearMaint.forEach((m) => {
      if (m.category === 'routine') categoryTotals['常规小保养'] += m.totalCost;
      else if (m.category === 'major') categoryTotals['全车大保养'] += m.totalCost;
      else if (m.category === 'brake' || m.category === 'tyre') categoryTotals['刹车/轮胎'] += m.totalCost;
      else if (m.category === 'insurance' || m.category === 'inspection') categoryTotals['车险/年检'] += m.totalCost;
      else categoryTotals['洗车及其他'] += m.totalCost;
    });

    const colors = ['#0ea5e9', '#f59e0b', '#71717a', '#a1a1aa', '#52525b', '#3f3f46'];
    return Object.entries(categoryTotals)
      .filter(([_, val]) => val > 0)
      .map(([label, value], i) => ({
        label,
        value,
        color: colors[i % colors.length],
      }));
  }, [fuels, maintenances, selectedYear]);

  // 5. 随礼人情对象分类分布
  const giftRelationSegments = useMemo(() => {
    const yearGifts = gifts.filter((g) => g.date.startsWith(selectedYear) && g.direction === 'out');
    const relationMap: Record<string, number> = {
      '亲戚长辈': 0,
      '同事朋友': 0,
      '同学好友': 0,
      '客户邻里及其他': 0,
    };

    yearGifts.forEach((g) => {
      if (g.relation === 'relative') relationMap['亲戚长辈'] += g.amount;
      else if (g.relation === 'colleague' || g.relation === 'friend') relationMap['同事朋友'] += g.amount;
      else if (g.relation === 'classmate') relationMap['同学好友'] += g.amount;
      else relationMap['客户邻里及其他'] += g.amount;
    });

    const colors = ['#18181b', '#3f3f46', '#71717a', '#a1a1aa'];
    return Object.entries(relationMap)
      .filter(([_, val]) => val > 0)
      .map(([label, value], i) => ({
        label,
        value,
        color: colors[i % colors.length],
      }));
  }, [gifts, selectedYear]);

  // 6. 油耗/电耗变化走势折线图
  const fuelEconomyData = useMemo(() => {
    return [...fuels]
      .filter((f) => f.date.startsWith(selectedYear) && f.calculatedFuelEconomy)
      .reverse()
      .map((f) => ({
        label: f.date.slice(5),
        value: f.calculatedFuelEconomy || 0,
        info: `${f.date} | 百公里能耗: ${f.calculatedFuelEconomy}`,
      }));
  }, [fuels, selectedYear]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部标题与年份选择 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            <BarChart3 className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              多维度图表分析
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              收入走势 · 加班工时分布 · 人情收支对比 · 汽车能耗结构
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">统计年度:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-hidden"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr} 年度
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. 薪资趋势图 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-zinc-500" />
            <span>{selectedYear} 年度月度薪资走势 (实发到手 vs 应发总计)</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">实线为税后实发到手现金，虚线为应发工资总额</p>
        </div>

        <div className="pt-2">
          <LineChart
            data={salaryChartData}
            valueFormatter={(v) => `¥${v}`}
            primaryLabel="税后实发到手"
            secondaryLabel="应发工资总额"
            color="#18181b"
            secondaryColor="#a1a1aa"
            height={220}
          />
        </div>
      </div>

      {/* 1.5 日常生活与教育专项开销月度柱状对比 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-zinc-500" />
              <span>{selectedYear} 年度日常生活与各项综合开支走势</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">日常生活高频开销 vs 医疗、人情、教育与旅行综合支出</p>
          </div>
        </div>

        <BarChart
          data={expensesChartData}
          legend1="日常生活(¥)"
          legend2="医疗/人情/专项(¥)"
          color1="#3b82f6"
          color2="#f59e0b"
          valueFormatter={(v) => `¥${v}`}
          height={200}
        />
      </div>

      {/* 2. 两列柱状对比：加班工时 vs 人情随礼 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 加班工时月度柱状图 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500" />
              <span>{selectedYear} 年度加班工时月度分布</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">每月累计加班时长 (小时)</p>
          </div>

          <BarChart
            data={overtimeChartData}
            legend1="加班时长(小时)"
            color1="#71717a"
            valueFormatter={(v) => `${v}h`}
            height={180}
          />
        </div>

        {/* 人情随礼支出 vs 收入对比 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Gift className="w-4 h-4 text-zinc-500" />
              <span>{selectedYear} 年度人情往来随礼对比</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">送出随礼支出 vs 收到礼金收入</p>
          </div>

          <BarChart
            data={giftsChartData}
            legend1="送出支出(¥)"
            legend2="收到收入(¥)"
            color1="#a1a1aa"
            color2="#27272a"
            valueFormatter={(v) => `¥${v}`}
            height={180}
          />
        </div>
      </div>

      {/* 3. 三列环形图：生活教育旅行结构 vs 汽车养车费用结构 vs 人情送礼关系分类 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 生活/医疗/人情/教育/旅行大类开支结构 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-zinc-500" />
              <span>{selectedYear} 综合支出大类结构</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">日常/医疗/人情/教育/旅行五大板块占比</p>
          </div>

          <div className="py-2">
            <DoughnutChart
              segments={expenseTypeSegments}
              centerTitle={formatCurrency(
                expenseTypeSegments.reduce((acc, c) => acc + c.value, 0),
                hidePrivacy
              )}
              centerSubtitle="年度开支总额"
              valueFormatter={(v) => `¥${v}`}
              size={170}
            />
          </div>
        </div>

        {/* 养车全费用占比 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Car className="w-4 h-4 text-zinc-500" />
              <span>{selectedYear} 养车总开支结构</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">补能、小保、车险及维保各项目占比</p>
          </div>

          <div className="py-2">
            <DoughnutChart
              segments={carCostSegments}
              centerTitle={formatCurrency(
                carCostSegments.reduce((acc, c) => acc + c.value, 0),
                hidePrivacy
              )}
              centerSubtitle="年度用车总计"
              valueFormatter={(v) => `¥${v}`}
              size={170}
            />
          </div>
        </div>

        {/* 随礼关系占比 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-zinc-500" />
              <span>{selectedYear} 随礼支出对象关系分布</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">随礼主要流向：亲戚、同事、同学或好友</p>
          </div>

          <div className="py-2">
            <DoughnutChart
              segments={giftRelationSegments}
              centerTitle={formatCurrency(
                giftRelationSegments.reduce((acc, g) => acc + g.value, 0),
                hidePrivacy
              )}
              centerSubtitle="年度随礼总额"
              valueFormatter={(v) => `¥${v}`}
              size={170}
            />
          </div>
        </div>
      </div>

      {/* 4. 车辆百公里油耗变动折线 */}
      {fuelEconomyData.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-zinc-500" />
              <span>{selectedYear} 车辆百公里能耗变化曲线</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">连续加满计算所得的百公里能耗 (L/100km 或 kWh/100km)</p>
          </div>

          <div className="pt-2">
            <LineChart
              data={fuelEconomyData}
              valueFormatter={(v) => `${v}`}
              primaryLabel="百公里能耗"
              color="#0ea5e9"
              height={200}
            />
          </div>
        </div>
      )}
    </div>
  );
};
