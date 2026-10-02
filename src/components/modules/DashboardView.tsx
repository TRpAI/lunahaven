import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Fuel,
  Gauge,
  Gift,
  Plus,
  Receipt,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react';
import { FuelRecord, LedgerFullData, MaintenanceRecord, VehicleProfile } from '../../types';
import { getVehicleHealthStatus } from '../../utils/fuelCalculator';
import { formatCurrency } from '../../utils/taxCalculator';
import { DoughnutChart } from '../charts/DoughnutChart';
import { LineChart } from '../charts/LineChart';

interface DashboardViewProps {
  data: LedgerFullData;
  onOpenQuickAdd: () => void;
  onSelectTab: (tab: string) => void;
  onSaveFuel?: (fuel: FuelRecord) => void;
  onSaveMaintenance?: (maint: MaintenanceRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onOpenQuickAdd,
  onSelectTab,
}) => {
  const { vehicles, fuels, maintenances, settings, salaries, overtimes, expenses, gifts } = data;
  const hidePrivacy = settings.privacyMaskNumbers;

  // 当前选中的车辆
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    settings.activeVehicleId || (vehicles.length > 0 ? vehicles[0].id : '')
  );

  // 真实车辆（若已清空则为 null，严禁使用虚假默认数据欺骗用户）
  const currentVehicle: VehicleProfile | null = useMemo(() => {
    if (vehicles.length === 0) return null;
    return vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  }, [vehicles, selectedVehicleId]);

  // 该车辆关联的加油与维保记录
  const vehicleFuels = useMemo(() => {
    if (!currentVehicle) return [];
    return fuels.filter((f) => f.vehicleId === currentVehicle.id);
  }, [fuels, currentVehicle]);

  const vehicleMaintenances = useMemo(() => {
    if (!currentVehicle) return [];
    return maintenances.filter((m) => m.vehicleId === currentVehicle.id);
  }, [maintenances, currentVehicle]);

  // 当无车辆档案时的全局空状态视图
  if (!currentVehicle) {
    const totalSalariesCount = salaries.length;
    const totalExpensesCount = (expenses || []).length;
    const totalGiftsCount = gifts.length;
    const totalOvertimesCount = overtimes.length;

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* 车辆看板未录入 / 已清空提示卡片 */}
        <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mx-auto border border-zinc-200/50 dark:border-zinc-700/50">
            <Car className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              汽车运行看板（暂无车辆数据）
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              账本当前无车辆档案或已完成数据清空。添加爱车档案（燃油车 / 纯电动 / 插混）后，即可开启表显里程监控、加油充电百公里能耗分析及保养到期智能预警。
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onSelectTab('vehicle')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>添加第一辆爱车</span>
            </button>

            <button
              onClick={onOpenQuickAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>快捷记一笔</span>
            </button>
          </div>
        </div>

        {/* 账本其他财务模块概览卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => onSelectTab('salary')}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>薪酬工时记录</span>
              <Banknote className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight">
                {totalSalariesCount} <span className="text-xs font-normal text-zinc-400">笔薪资</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                包含 {totalOvertimesCount} 条加班工时记录
              </div>
            </div>
          </div>

          <div
            onClick={() => onSelectTab('expenses')}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>综合支出记录</span>
              <Receipt className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight">
                {totalExpensesCount} <span className="text-xs font-normal text-zinc-400">笔开销</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                日常、医疗、教育、人情与旅游专项
              </div>
            </div>
          </div>

          <div
            onClick={() => onSelectTab('gift')}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>人情往来随礼</span>
              <Gift className="w-4 h-4 text-pink-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight">
                {totalGiftsCount} <span className="text-xs font-normal text-zinc-400">笔礼单</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                礼尚往来备忘与收支核销
              </div>
            </div>
          </div>

          <div
            onClick={() => onSelectTab('settings')}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>数据与安全管理</span>
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-3">
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                系统设置与安全
              </div>
              <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                <span>备份导入 / 重置演示数据</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 最新表显里程
  const latestFuelOdo =
    vehicleFuels.length > 0
      ? vehicleFuels[0].odometer
      : currentVehicle.currentOdometer || currentVehicle.initialOdometer || 0;
  const vehicleHealth = getVehicleHealthStatus(currentVehicle, latestFuelOdo, vehicleMaintenances);

  // 1. 本月车辆开支统计
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentMonthFuelCost = vehicleFuels
    .filter((f) => f.date.startsWith(currentMonthStr))
    .reduce((sum, f) => sum + f.totalCost, 0);

  const currentMonthMaintCost = vehicleMaintenances
    .filter((m) => m.date.startsWith(currentMonthStr))
    .reduce((sum, m) => sum + m.totalCost, 0);

  const currentMonthTotalSpend = currentMonthFuelCost + currentMonthMaintCost;

  // 2. 全部历史用车开支
  const totalLifetimeFuelCost = vehicleFuels.reduce((sum, f) => sum + f.totalCost, 0);
  const totalLifetimeMaintCost = vehicleMaintenances.reduce((sum, m) => sum + m.totalCost, 0);
  const totalLifetimeCost = totalLifetimeFuelCost + totalLifetimeMaintCost;

  // 3. 平均百公里能耗计算
  const fuelsWithEconomy = vehicleFuels.filter((f) => f.calculatedFuelEconomy && f.calculatedFuelEconomy > 0);
  const avgEconomy =
    fuelsWithEconomy.length > 0
      ? (fuelsWithEconomy.reduce((acc, f) => acc + (f.calculatedFuelEconomy || 0), 0) / fuelsWithEconomy.length).toFixed(1)
      : null;

  // 4. 平均每公里成本
  const totalTripKm =
    latestFuelOdo > (currentVehicle.initialOdometer || 0)
      ? latestFuelOdo - (currentVehicle.initialOdometer || 0)
      : vehicleFuels.length > 1
      ? Math.max(0, vehicleFuels[0].odometer - vehicleFuels[vehicleFuels.length - 1].odometer)
      : 0;

  const avgCostPerKm =
    totalTripKm > 0 && totalLifetimeFuelCost > 0
      ? (totalLifetimeFuelCost / totalTripKm).toFixed(2)
      : null;

  // 5. 能耗走势图数据 (近 8 次加油/充电记录)
  const fuelTrendData = useMemo(() => {
    return [...vehicleFuels]
      .filter((f) => typeof f.calculatedFuelEconomy === 'number' && f.calculatedFuelEconomy > 0)
      .slice(0, 8)
      .reverse()
      .map((f) => ({
        label: f.date.slice(5),
        value: f.calculatedFuelEconomy || 0,
        secondaryValue: f.totalCost,
        info: `${f.date} | 能耗: ${f.calculatedFuelEconomy} ${
          currentVehicle.fuelType === 'electric' ? 'kWh' : 'L'
        }/100km | 实付: ¥${f.totalCost}`,
      }));
  }, [vehicleFuels, currentVehicle.fuelType]);

  // 6. 车辆支出构成
  const expenseBreakdown = [
    {
      label: currentVehicle.fuelType === 'electric' ? '充电能耗' : '日常燃油',
      value: totalLifetimeFuelCost,
      color: '#0ea5e9',
    },
    { label: '维保与维修', value: totalLifetimeMaintCost, color: '#f59e0b' },
  ].filter((s) => s.value > 0);

  // 7. 车险 & 年检到期预警
  const getDaysUntil = (dateStr?: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr).getTime();
    const now = Date.now();
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  };

  const insuranceDays = getDaysUntil(currentVehicle.insuranceExpiryDate);
  const inspectionDays = getDaysUntil(currentVehicle.annualInspectionDate);

  const getFuelTypeLabel = (type: string) => {
    switch (type) {
      case 'electric':
        return '纯电动 EV';
      case 'gasoline_92':
        return '92# 汽油';
      case 'gasoline_95':
        return '95# 汽油';
      case 'gasoline_98':
        return '98# 汽油';
      case 'diesel':
        return '柴油';
      case 'hybrid':
        return '插电混动 PHEV';
      default:
        return '燃油车';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 车辆看板顶部栏：车型切换 & 核心状态 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            {currentVehicle.fuelType === 'electric' ? (
              <Zap className="w-6 h-6 text-emerald-500" />
            ) : (
              <Car className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {currentVehicle.name}
              </h1>
              {currentVehicle.plateNumber && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                  {currentVehicle.plateNumber}
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                {getFuelTypeLabel(currentVehicle.fuelType)}
              </span>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              表显总里程: <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{latestFuelOdo.toLocaleString()} km</span> · 汽车专属运行状态看板
            </p>
          </div>
        </div>

        {/* 车辆快速切换与跳转管理 */}
        <div className="flex items-center gap-2">
          {vehicles.length > 1 && (
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-hidden"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.plateNumber || '未上牌'})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => onSelectTab('vehicle')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>录入与明细管理</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 核心汽车指标卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. 表显当前总里程 */}
        <div
          onClick={() => onSelectTab('vehicle')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>当前表显里程</span>
            <Gauge className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight flex items-baseline gap-1">
              <span>{latestFuelOdo.toLocaleString()}</span>
              <span className="text-xs font-normal text-zinc-400">km</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              累计行驶 {totalTripKm.toLocaleString()} km
            </div>
          </div>
        </div>

        {/* 2. 距下次保养里程 */}
        <div
          onClick={() => onSelectTab('vehicle')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>距下次保养建议</span>
            <Wrench className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold font-mono tracking-tight flex items-baseline gap-1 ${
                vehicleHealth.status === 'overdue'
                  ? 'text-rose-600 dark:text-rose-400'
                  : vehicleHealth.status === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              <span>{vehicleHealth.remainingKm.toLocaleString()}</span>
              <span className="text-xs font-normal text-zinc-400">km</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
              {vehicleHealth.status === 'overdue' ? (
                <span className="text-rose-600 font-medium">已超出保养周期</span>
              ) : vehicleHealth.status === 'warning' ? (
                <span className="text-amber-600 font-medium">即将达到保养里程</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">车况周期健康</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. 百公里综合能耗 */}
        <div
          onClick={() => onSelectTab('vehicle')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>百公里平均能耗</span>
            {currentVehicle.fuelType === 'electric' ? (
              <Zap className="w-4 h-4 text-emerald-500" />
            ) : (
              <Fuel className="w-4 h-4 text-sky-500" />
            )}
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight flex items-baseline gap-1">
              <span>{avgEconomy !== null ? avgEconomy : '--'}</span>
              <span className="text-xs font-normal text-zinc-400">
                {currentVehicle.fuelType === 'electric' ? 'kWh/100km' : 'L/100km'}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {avgCostPerKm !== null ? (
                <>
                  约合 <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">¥{avgCostPerKm}</span> / 公里
                </>
              ) : (
                '暂无连续加油能耗记录'
              )}
            </div>
          </div>
        </div>

        {/* 4. 本月用车支出 */}
        <div
          onClick={() => onSelectTab('vehicle')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>本月用车开支</span>
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tracking-tight">
              {formatCurrency(currentMonthTotalSpend, hidePrivacy)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
              <span>补能 {formatCurrency(currentMonthFuelCost, hidePrivacy)}</span>
              <span>·</span>
              <span>维保 {formatCurrency(currentMonthMaintCost, hidePrivacy)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 车况提醒与合规卡片 (车险 / 年检 / 维保告警) */}
      {(vehicleHealth.status !== 'ok' ||
        (insuranceDays !== null && insuranceDays <= 45) ||
        (inspectionDays !== null && inspectionDays <= 60)) && (
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                车辆运行提醒：{currentVehicle.name}
              </span>
              <p className="text-zinc-500 dark:text-zinc-400">
                {vehicleHealth.message}
                {insuranceDays !== null && insuranceDays <= 45 && (
                  <span> · 车险还有 {insuranceDays} 天到期</span>
                )}
                {inspectionDays !== null && inspectionDays <= 60 && (
                  <span> · 年检还有 {inspectionDays} 天到期</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('vehicle')}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium shrink-0 self-start sm:self-center hover:opacity-90 transition-opacity"
          >
            去处理
          </button>
        </div>
      )}

      {/* 图表主区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 能耗历史与加油走势折线图 */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-zinc-500" />
                <span>百公里能耗与补能花费走势</span>
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                实时监测各阶段能耗效率与单次加油/充电花费
              </p>
            </div>
            <button
              onClick={() => onSelectTab('vehicle')}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors cursor-pointer"
            >
              查看全部记录
            </button>
          </div>

          <div className="pt-2">
            {fuelTrendData.length > 0 ? (
              <LineChart
                data={fuelTrendData}
                valueFormatter={(v: number) => `${v}`}
                primaryLabel={
                  currentVehicle.fuelType === 'electric'
                    ? '电耗 (kWh/100km)'
                    : '油耗 (L/100km)'
                }
                secondaryLabel="实付金额 (元)"
                color="#0ea5e9"
                secondaryColor="#a1a1aa"
                height={220}
              />
            ) : (
              <div className="h-[220px] flex items-center justify-center text-xs text-zinc-400">
                暂无足够的加油/充电记录以绘制图表
              </div>
            )}
          </div>
        </div>

        {/* 车辆费用分布环形图 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              <span>累计用车总支出构成</span>
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              总支出 {formatCurrency(totalLifetimeCost, hidePrivacy)}
            </p>
          </div>

          <div className="my-auto py-4">
            {totalLifetimeCost > 0 && expenseBreakdown.length > 0 ? (
              <DoughnutChart
                segments={expenseBreakdown}
                centerTitle={formatCurrency(totalLifetimeCost, hidePrivacy)}
                centerSubtitle="累计花费"
                valueFormatter={(v) => `¥${v}`}
                size={160}
              />
            ) : (
              <div className="text-center py-8 text-xs text-zinc-400">暂无费用记录</div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <span>总行驶里程</span>
            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
              {totalTripKm.toLocaleString()} km
            </span>
          </div>
        </div>
      </div>

      {/* 底部两栏：近期加油补能记录 & 近期维保档案 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 近期加油与补能 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-zinc-500" />
              <span>近期加油与充电</span>
            </h3>
            <button
              onClick={() => onSelectTab('vehicle')}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors cursor-pointer"
            >
              全部 ({vehicleFuels.length})
            </button>
          </div>

          <div className="space-y-2">
            {vehicleFuels.slice(0, 4).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60 text-xs"
              >
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {f.station || '补能'} · {f.fuelAmount}{' '}
                    {currentVehicle.fuelType === 'electric' ? 'kWh' : 'L'}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                    <span>{f.date}</span>
                    <span>·</span>
                    <span>{f.odometer.toLocaleString()} km</span>
                    {f.calculatedFuelEconomy && (
                      <span className="font-mono font-medium text-sky-600 dark:text-sky-400">
                        · {f.calculatedFuelEconomy}{' '}
                        {currentVehicle.fuelType === 'electric' ? 'kWh' : 'L'}/100km
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(f.totalCost, hidePrivacy)}
                </div>
              </div>
            ))}
            {vehicleFuels.length === 0 && (
              <div className="text-center py-6 text-xs text-zinc-400">暂无加油补能记录</div>
            )}
          </div>
        </div>

        {/* 近期维保与维修档案 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-zinc-500" />
              <span>近期维保与维修记录</span>
            </h3>
            <button
              onClick={() => onSelectTab('vehicle')}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors cursor-pointer"
            >
              全部 ({vehicleMaintenances.length})
            </button>
          </div>

          <div className="space-y-2">
            {vehicleMaintenances.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60 text-xs"
              >
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {m.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                    <span>{m.date}</span>
                    <span>·</span>
                    <span>{m.odometer.toLocaleString()} km</span>
                    <span>·</span>
                    <span className="text-zinc-500">{m.shopName || '汽修门店'}</span>
                  </div>
                </div>
                <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(m.totalCost, hidePrivacy)}
                </div>
              </div>
            ))}
            {vehicleMaintenances.length === 0 && (
              <div className="text-center py-6 text-xs text-zinc-400">暂无维保与维修记录</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
