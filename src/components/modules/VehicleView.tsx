import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Download,
  Edit2,
  Fuel,
  Plus,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  FuelRecord,
  MaintenanceCategory,
  MaintenanceRecord,
  VehicleFuelType,
  VehicleProfile,
} from '../../types';
import { exportFuelsToCsv, exportMaintenancesToCsv, triggerFileDownload } from '../../utils/exportImport';
import { getVehicleHealthStatus } from '../../utils/fuelCalculator';
import { formatCurrency } from '../../utils/taxCalculator';

interface VehicleViewProps {
  vehicles: VehicleProfile[];
  fuels: FuelRecord[];
  maintenances: MaintenanceRecord[];
  activeVehicleId: string;
  onChangeActiveVehicle: (id: string) => void;
  onSaveVehicle: (record: VehicleProfile) => void;
  onDeleteVehicle: (id: string) => void;
  onSaveFuel: (record: FuelRecord) => void;
  onDeleteFuel: (id: string) => void;
  onSaveMaintenance: (record: MaintenanceRecord) => void;
  onDeleteMaintenance: (id: string) => void;
  hidePrivacy: boolean;
}

export const VehicleView: React.FC<VehicleViewProps> = ({
  vehicles,
  fuels,
  maintenances,
  activeVehicleId,
  onChangeActiveVehicle,
  onSaveVehicle,
  onDeleteVehicle,
  onSaveFuel,
  onDeleteFuel,
  onSaveMaintenance,
  onDeleteMaintenance,
  hidePrivacy,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'fuel' | 'maintenance'>('fuel');

  // Modals
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [editingFuelId, setEditingFuelId] = useState<string | null>(null);

  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [editingMaintId, setEditingMaintId] = useState<string | null>(null);

  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);

  // Active Vehicle (若已清空则为 null，杜绝虚假默认车辆与假里程)
  const currentVehicle: VehicleProfile | null = useMemo(() => {
    if (vehicles.length === 0) return null;
    return vehicles.find((v) => v.id === activeVehicleId) || vehicles[0];
  }, [vehicles, activeVehicleId]);

  // 车辆关联加油与维保记录
  const vehicleFuels = useMemo(() => {
    if (!currentVehicle) return [];
    return fuels.filter((f) => f.vehicleId === currentVehicle.id);
  }, [fuels, currentVehicle]);

  const vehicleMaintenances = useMemo(() => {
    if (!currentVehicle) return [];
    return maintenances.filter((m) => m.vehicleId === currentVehicle.id);
  }, [maintenances, currentVehicle]);

  // 最新表显里程
  const latestFuelOdo = currentVehicle
    ? (vehicleFuels.length > 0 ? vehicleFuels[0].odometer : currentVehicle.currentOdometer)
    : 0;
  const healthStatus = currentVehicle
    ? getVehicleHealthStatus(currentVehicle, latestFuelOdo, vehicleMaintenances)
    : null;

  // 加油表单
  const [fuelForm, setFuelForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    odometer: latestFuelOdo > 0 ? latestFuelOdo + 350 : 0,
    fuelAmount: currentVehicle?.fuelType === 'electric' ? 50 : 40,
    unitPrice: currentVehicle?.fuelType === 'electric' ? 1.35 : 8.35,
    totalCost: currentVehicle?.fuelType === 'electric' ? 67.5 : 334.0,
    isFullTank: true,
    station: currentVehicle?.fuelType === 'electric' ? '特来电超充站' : '中国石化',
    fuelType: currentVehicle?.fuelType === 'electric' ? '快充 (kWh)' : '95# 汽油',
    notes: '',
  });

  // 维保表单
  const [maintForm, setMaintForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    odometer: latestFuelOdo || 0,
    category: 'routine' as MaintenanceCategory,
    title: '常规小保养 (机油机滤)',
    itemsStr: '全合成机油4L, 品牌机油滤清器',
    shopName: '途虎养车工场店',
    partsCost: 360,
    laborCost: 80,
    totalCost: 440,
    nextServiceOdometer: (latestFuelOdo || 0) + 10000,
    nextServiceDate: '',
    notes: '',
  });

  // 新增车辆表单
  const [vehicleForm, setVehicleForm] = useState({
    name: '',
    plateNumber: '',
    fuelType: 'gasoline_95' as VehicleFuelType,
    tankCapacity: 50,
    initialOdometer: 0,
    maintenanceIntervalKm: 10000,
    maintenanceIntervalDays: 180,
  });

  const categoryLabels: Record<MaintenanceCategory, string> = {
    routine: '常规小保',
    major: '全车大保',
    brake: '刹车制动',
    tyre: '轮胎动平衡',
    battery: '蓄电池',
    air_filter: '空调/空气滤',
    inspection: '年检验车',
    insurance: '车险续保',
    paint_body: '钣金喷漆',
    washing: '精洗美容',
    repair: '故障机械维修',
    other: '其他服务',
  };

  const handleOpenAddFuel = () => {
    if (!currentVehicle) {
      setIsVehicleModalOpen(true);
      return;
    }
    setEditingFuelId(null);
    setFuelForm({
      date: new Date().toISOString().slice(0, 10),
      odometer: latestFuelOdo > 0 ? latestFuelOdo + 350 : 25000,
      fuelAmount: currentVehicle.fuelType === 'electric' ? 60 : 45,
      unitPrice: currentVehicle.fuelType === 'electric' ? 1.35 : 8.35,
      totalCost: currentVehicle.fuelType === 'electric' ? 81 : 375.75,
      isFullTank: true,
      station: currentVehicle.fuelType === 'electric' ? '国家电网超充站' : '中国石化',
      fuelType: currentVehicle.fuelType === 'electric' ? '快充 (kWh)' : '95# 汽油',
      notes: '',
    });
    setIsFuelModalOpen(true);
  };

  const handleOpenEditFuel = (f: FuelRecord) => {
    setEditingFuelId(f.id);
    setFuelForm({
      date: f.date,
      odometer: f.odometer,
      fuelAmount: f.fuelAmount,
      unitPrice: f.unitPrice,
      totalCost: f.totalCost,
      isFullTank: f.isFullTank,
      station: f.station,
      fuelType: f.fuelType,
      notes: f.notes,
    });
    setIsFuelModalOpen(true);
  };

  const handleFuelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVehicle) return;
    const newRecord: FuelRecord = {
      id: editingFuelId || `fuel-${Date.now()}`,
      vehicleId: currentVehicle.id,
      date: fuelForm.date,
      odometer: Number(fuelForm.odometer) || 0,
      fuelAmount: Number(fuelForm.fuelAmount) || 0,
      unitPrice: Number(fuelForm.unitPrice) || 0,
      totalCost: Number(fuelForm.totalCost) || Number(fuelForm.fuelAmount) * Number(fuelForm.unitPrice),
      isFullTank: fuelForm.isFullTank,
      station: fuelForm.station,
      fuelType: fuelForm.fuelType,
      notes: fuelForm.notes,
      createdAt: editingFuelId ? (fuels.find((f) => f.id === editingFuelId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    onSaveFuel(newRecord);
    setIsFuelModalOpen(false);
  };

  const handleOpenAddMaint = () => {
    if (!currentVehicle) {
      setIsVehicleModalOpen(true);
      return;
    }
    setEditingMaintId(null);
    setMaintForm({
      date: new Date().toISOString().slice(0, 10),
      odometer: latestFuelOdo || 25000,
      category: 'routine',
      title: '常规小保养 (机油机滤)',
      itemsStr: '全合成机油, 机油滤清器',
      shopName: '途虎养车工场店',
      partsCost: 360,
      laborCost: 80,
      totalCost: 440,
      nextServiceOdometer: (latestFuelOdo || 25000) + 10000,
      nextServiceDate: '',
      notes: '',
    });
    setIsMaintModalOpen(true);
  };

  const handleOpenEditMaint = (m: MaintenanceRecord) => {
    setEditingMaintId(m.id);
    setMaintForm({
      date: m.date,
      odometer: m.odometer,
      category: m.category,
      title: m.title,
      itemsStr: m.items ? m.items.join(', ') : '',
      shopName: m.shopName,
      partsCost: m.partsCost,
      laborCost: m.laborCost,
      totalCost: m.totalCost,
      nextServiceOdometer: m.nextServiceOdometer || (m.odometer + 10000),
      nextServiceDate: m.nextServiceDate || '',
      notes: m.notes,
    });
    setIsMaintModalOpen(true);
  };

  const handleMaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVehicle) return;
    const items = maintForm.itemsStr
      ? maintForm.itemsStr.split(/[,，\n]/).map((i) => i.trim()).filter(Boolean)
      : [];

    const newRecord: MaintenanceRecord = {
      id: editingMaintId || `m-${Date.now()}`,
      vehicleId: currentVehicle.id,
      date: maintForm.date,
      odometer: Number(maintForm.odometer) || 0,
      category: maintForm.category,
      title: maintForm.title,
      items,
      shopName: maintForm.shopName,
      partsCost: Number(maintForm.partsCost) || 0,
      laborCost: Number(maintForm.laborCost) || 0,
      totalCost: Number(maintForm.totalCost) || Number(maintForm.partsCost) + Number(maintForm.laborCost),
      nextServiceOdometer: Number(maintForm.nextServiceOdometer) || undefined,
      nextServiceDate: maintForm.nextServiceDate || undefined,
      notes: maintForm.notes,
      createdAt: editingMaintId ? (maintenances.find((m) => m.id === editingMaintId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    onSaveMaintenance(newRecord);
    setIsMaintModalOpen(false);
  };

  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const newV: VehicleProfile = {
      id: `v-${Date.now()}`,
      name: vehicleForm.name.trim() || '新车',
      plateNumber: vehicleForm.plateNumber.trim(),
      fuelType: vehicleForm.fuelType,
      tankCapacity: Number(vehicleForm.tankCapacity) || 50,
      initialOdometer: Number(vehicleForm.initialOdometer) || 0,
      currentOdometer: Number(vehicleForm.initialOdometer) || 0,
      maintenanceIntervalKm: Number(vehicleForm.maintenanceIntervalKm) || 10000,
      maintenanceIntervalDays: Number(vehicleForm.maintenanceIntervalDays) || 180,
      createdAt: new Date().toISOString(),
    };
    onSaveVehicle(newV);
    onChangeActiveVehicle(newV.id);
    setIsVehicleModalOpen(false);
  };

  if (!currentVehicle || !healthStatus) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="p-8 sm:p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
            <Car className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">暂无车辆档案</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              添加您的第一辆爱车（燃油车 / 纯电动 / 混动），开始记录加油充电、能耗分析与维保预警
            </p>
          </div>
          <button
            onClick={() => setIsVehicleModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>添加爱车</span>
          </button>
        </div>

        {/* 渲染添加车辆 Modal */}
        {isVehicleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Car className="w-5 h-5 text-zinc-500" />
                  <span>添加爱车档案</span>
                </h3>
                <button
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateVehicle} className="space-y-3.5">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">车辆名称/型号</label>
                  <input
                    type="text"
                    required
                    placeholder="如: 极氪 001 / 特斯拉 Model Y"
                    value={vehicleForm.name}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">车牌号码</label>
                    <input
                      type="text"
                      placeholder="如: 京A·8899D"
                      value={vehicleForm.plateNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">能源类型</label>
                    <select
                      value={vehicleForm.fuelType}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, fuelType: e.target.value as VehicleFuelType })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="electric">纯电动 (kWh)</option>
                      <option value="gasoline_92">92# 汽油</option>
                      <option value="gasoline_95">95# 汽油</option>
                      <option value="gasoline_98">98# 汽油</option>
                      <option value="hybrid">插电混动 / 增程</option>
                      <option value="diesel">柴油</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">初始里程 (km)</label>
                    <input
                      type="number"
                      value={vehicleForm.initialOdometer}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, initialOdometer: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">保养周期里程 (km)</label>
                    <input
                      type="number"
                      value={vehicleForm.maintenanceIntervalKm}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, maintenanceIntervalKm: parseFloat(e.target.value) || 10000 })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsVehicleModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold shadow-xs cursor-pointer"
                  >
                    创建车辆
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 统计指标
  const totalFuelCost = vehicleFuels.reduce((acc, f) => acc + f.totalCost, 0);
  const totalFuelLitres = vehicleFuels.reduce((acc, f) => acc + f.fuelAmount, 0);
  const fuelsWithEcon = vehicleFuels.filter((f) => f.calculatedFuelEconomy);
  const avgFuelEconomy = fuelsWithEcon.length > 0
    ? fuelsWithEcon.reduce((acc, f) => acc + (f.calculatedFuelEconomy || 0), 0) / fuelsWithEcon.length
    : (currentVehicle.fuelType === 'electric' ? 15.4 : 7.6);
  const totalMaintCost = vehicleMaintenances.reduce((acc, m) => acc + m.totalCost, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部车辆切换与标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            {currentVehicle.fuelType === 'electric' ? (
              <Zap className="w-6 h-6 text-emerald-500" />
            ) : (
              <Car className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              汽车账本明细
            </h1>
            <div className="flex items-center gap-2">
              <select
                value={currentVehicle.id}
                onChange={(e) => onChangeActiveVehicle(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plateNumber || '未上牌'})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-0.5">
              自动核算百公里油耗/电耗 · 维修保养项目档案 · 下次维保智能提醒
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsVehicleModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加爱车</span>
          </button>
          {activeSubTab === 'fuel' ? (
            <button
              onClick={handleOpenAddFuel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>记一笔补能</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAddMaint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>记一笔维保</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 核心车辆状态卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">当前表显总里程</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {healthStatus.currentOdometer.toLocaleString()} <span className="text-xs font-normal text-zinc-400">km</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">保养健康状况预警</span>
          <div className="mt-2 flex items-center gap-1.5">
            {healthStatus.status === 'overdue' ? (
              <span className="text-rose-600 font-bold text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> 超期超程
              </span>
            ) : healthStatus.status === 'warning' ? (
              <span className="text-amber-600 font-bold text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> 临近保养
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> 状态良好
              </span>
            )}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1 truncate">
            {healthStatus.message}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">百公里平均能耗</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {avgFuelEconomy.toFixed(1)}
            <span className="text-xs font-normal text-zinc-400"> {currentVehicle.fuelType === 'electric' ? 'kWh/100km' : 'L/100km'}</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">养车总支出 (补能+维保)</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {formatCurrency(totalFuelCost + totalMaintCost, hidePrivacy)}
          </div>
        </div>
      </div>

      {/* 子标签切换 (加油 vs 维保) */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('fuel')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeSubTab === 'fuel'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs font-semibold'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>加油与充电流水 ({vehicleFuels.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('maintenance')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeSubTab === 'maintenance'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs font-semibold'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>维修与保养记录 ({vehicleMaintenances.length})</span>
          </button>
        </div>

        <button
          onClick={() => {
            if (activeSubTab === 'fuel') {
              const csv = exportFuelsToCsv(vehicleFuels);
              triggerFileDownload(csv, `${currentVehicle.name}_加油补能明细.csv`, 'text/csv;charset=utf-8');
            } else {
              const csv = exportMaintenancesToCsv(vehicleMaintenances);
              triggerFileDownload(csv, `${currentVehicle.name}_维保档案明细.csv`, 'text/csv;charset=utf-8');
            }
          }}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出 CSV</span>
        </button>
      </div>

      {/* 1. 加油/充电记录列表 */}
      {activeSubTab === 'fuel' && (
        <div className="space-y-3">
          {vehicleFuels.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
              <Fuel className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-medium">暂无加油/充电补能记录</p>
              <button
                onClick={handleOpenAddFuel}
                className="mt-3 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs"
              >
                录入第一次补能
              </button>
            </div>
          ) : (
            vehicleFuels.map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{f.station || '补能站点'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {f.fuelType}
                      </span>
                      {f.isFullTank && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                          加满/充满
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-400 dark:text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>{f.date}</span>
                      <span>·</span>
                      <span>表显 {f.odometer.toLocaleString()} km</span>
                      {f.tripDistance ? <span>· 区间行驶 +{f.tripDistance} km</span> : null}
                      <span>·</span>
                      <span>{f.fuelAmount} {currentVehicle.fuelType === 'electric' ? 'kWh' : 'L'} @ ¥{f.unitPrice}</span>
                    </div>
                    {f.notes && <p className="text-[11px] text-zinc-400 mt-0.5">{f.notes}</p>}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block">实付金额</span>
                    <span className="font-bold font-mono text-base text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(f.totalCost, hidePrivacy)}
                    </span>
                    {f.calculatedFuelEconomy && (
                      <span className="text-[10px] text-zinc-500 block font-mono font-medium">
                        {f.calculatedFuelEconomy} {currentVehicle.fuelType === 'electric' ? 'kWh' : 'L'}/100km
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditFuel(f)}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      title="编辑"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('确认删除该笔补能记录？')) {
                          onDeleteFuel(f.id);
                        }
                      }}
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 cursor-pointer"
                      title="删除"
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

      {/* 2. 维修保养记录列表 */}
      {activeSubTab === 'maintenance' && (
        <div className="space-y-3">
          {vehicleMaintenances.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
              <Wrench className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-medium">暂无维修保养记录</p>
              <button
                onClick={handleOpenAddMaint}
                className="mt-3 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs"
              >
                录入第一次保养
              </button>
            </div>
          ) : (
            vehicleMaintenances.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{m.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                        {categoryLabels[m.category] || m.category}
                      </span>
                      {m.shopName && (
                        <span className="text-[10px] text-zinc-400">@{m.shopName}</span>
                      )}
                    </div>
                    <div className="text-zinc-400 dark:text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>{m.date}</span>
                      <span>·</span>
                      <span>表显 {m.odometer.toLocaleString()} km</span>
                      {m.partsCost > 0 && <span>· 配件 ¥{m.partsCost}</span>}
                      {m.laborCost > 0 && <span>· 工时 ¥{m.laborCost}</span>}
                    </div>
                    {m.items && m.items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {m.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                          >
                            {it}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block">维保总计</span>
                    <span className="font-bold font-mono text-base text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(m.totalCost, hidePrivacy)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditMaint(m)}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      title="编辑"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('确认删除该笔维保记录？')) {
                          onDeleteMaintenance(m.id);
                        }
                      }}
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 cursor-pointer"
                      title="删除"
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

      {/* 模态框：录入/编辑加油 */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Fuel className="w-5 h-5 text-zinc-500" />
                <span>{editingFuelId ? '编辑补能记录' : `为 ${currentVehicle.name} 记一笔补能`}</span>
              </h3>
              <button
                onClick={() => setIsFuelModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFuelSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">日期</label>
                  <input
                    type="date"
                    required
                    value={fuelForm.date}
                    onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加油/充电时表显里程 (km)</label>
                  <input
                    type="number"
                    required
                    value={fuelForm.odometer}
                    onChange={(e) => setFuelForm({ ...fuelForm, odometer: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">补能量 (L/kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelForm.fuelAmount}
                    onChange={(e) => {
                      const amt = parseFloat(e.target.value) || 0;
                      setFuelForm({ ...fuelForm, fuelAmount: amt, totalCost: Math.round(amt * fuelForm.unitPrice * 100) / 100 });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">单价 (元)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelForm.unitPrice}
                    onChange={(e) => {
                      const up = parseFloat(e.target.value) || 0;
                      setFuelForm({ ...fuelForm, unitPrice: up, totalCost: Math.round(fuelForm.fuelAmount * up * 100) / 100 });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">实付总金额 (元)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelForm.totalCost}
                    onChange={(e) => setFuelForm({ ...fuelForm, totalCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加油站 / 充电站品牌</label>
                  <input
                    type="text"
                    value={fuelForm.station}
                    onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">燃油/充电规格</label>
                  <input
                    type="text"
                    value={fuelForm.fuelType}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuelType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isFullTank"
                  checked={fuelForm.isFullTank}
                  onChange={(e) => setFuelForm({ ...fuelForm, isFullTank: e.target.checked })}
                  className="rounded text-zinc-900 focus:ring-0"
                />
                <label htmlFor="isFullTank" className="text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                  是否加满油箱 / 充满电池（加满可精准计算区间百公里油耗）
                </label>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">备注说明</label>
                <input
                  type="text"
                  placeholder="如: 高速服务区补能 / 谷电时段充电"
                  value={fuelForm.notes}
                  onChange={(e) => setFuelForm({ ...fuelForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsFuelModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold shadow-xs cursor-pointer"
                >
                  保存记录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 模态框：录入/编辑维保 */}
      {isMaintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-zinc-500" />
                <span>{editingMaintId ? '编辑维保记录' : `为 ${currentVehicle.name} 记录维保项目`}</span>
              </h3>
              <button
                onClick={() => setIsMaintModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMaintSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">日期</label>
                  <input
                    type="date"
                    required
                    value={maintForm.date}
                    onChange={(e) => setMaintForm({ ...maintForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">维保时表显里程 (km)</label>
                  <input
                    type="number"
                    required
                    value={maintForm.odometer}
                    onChange={(e) => setMaintForm({ ...maintForm, odometer: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">维保分类</label>
                  <select
                    value={maintForm.category}
                    onChange={(e) => setMaintForm({ ...maintForm, category: e.target.value as MaintenanceCategory })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    {Object.entries(categoryLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">门店/汽修厂</label>
                  <input
                    type="text"
                    value={maintForm.shopName}
                    onChange={(e) => setMaintForm({ ...maintForm, shopName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">保养项目标题</label>
                <input
                  type="text"
                  required
                  placeholder="如: 常规小保养 (机油机滤)"
                  value={maintForm.title}
                  onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                  更换配件与服务细项 (逗号分隔)
                </label>
                <textarea
                  rows={2}
                  placeholder="如: 全合成机油4L, 品牌机油滤芯"
                  value={maintForm.itemsStr}
                  onChange={(e) => setMaintForm({ ...maintForm, itemsStr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">配件材料费</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maintForm.partsCost}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0;
                      setMaintForm({ ...maintForm, partsCost: p, totalCost: p + maintForm.laborCost });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">工时费</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maintForm.laborCost}
                    onChange={(e) => {
                      const l = parseFloat(e.target.value) || 0;
                      setMaintForm({ ...maintForm, laborCost: l, totalCost: maintForm.partsCost + l });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">实付总费用</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={maintForm.totalCost}
                    onChange={(e) => setMaintForm({ ...maintForm, totalCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">下次建议保养里程 (km)</label>
                  <input
                    type="number"
                    value={maintForm.nextServiceOdometer}
                    onChange={(e) => setMaintForm({ ...maintForm, nextServiceOdometer: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">下次建议保养日期</label>
                  <input
                    type="date"
                    value={maintForm.nextServiceDate}
                    onChange={(e) => setMaintForm({ ...maintForm, nextServiceDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsMaintModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold shadow-xs cursor-pointer"
                >
                  保存维保记录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 新增爱车 Profile 弹窗 */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Car className="w-5 h-5 text-zinc-500" />
                <span>添加爱车档案</span>
              </h3>
              <button
                onClick={() => setIsVehicleModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-3.5">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">车辆名称/型号</label>
                <input
                  type="text"
                  required
                  placeholder="如: 极氪 001 / 特斯拉 Model Y"
                  value={vehicleForm.name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">车牌号码</label>
                  <input
                    type="text"
                    placeholder="如: 京A·8899D"
                    value={vehicleForm.plateNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">能源类型</label>
                  <select
                    value={vehicleForm.fuelType}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, fuelType: e.target.value as VehicleFuelType })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="electric">纯电动 (kWh)</option>
                    <option value="gasoline_92">92# 汽油</option>
                    <option value="gasoline_95">95# 汽油</option>
                    <option value="gasoline_98">98# 汽油</option>
                    <option value="hybrid">插电混动 / 增程</option>
                    <option value="diesel">柴油</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">初始里程 (km)</label>
                  <input
                    type="number"
                    value={vehicleForm.initialOdometer}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, initialOdometer: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">保养周期里程 (km)</label>
                  <input
                    type="number"
                    value={vehicleForm.maintenanceIntervalKm}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, maintenanceIntervalKm: parseFloat(e.target.value) || 10000 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold shadow-xs cursor-pointer"
                >
                  创建车辆
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
