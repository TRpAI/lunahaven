import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Car,
  Check,
  CheckCircle2,
  Download,
  Edit2,
  Fuel,
  Plus,
  Settings2,
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

export const FUEL_TYPE_OPTIONS = [
  {
    group: '汽油标号',
    options: ['92# 汽油', '95# 汽油', '98# 汽油', '101# 顶级汽油', '乙醇汽油 E92', '乙醇汽油 E95'],
  },
  {
    group: '柴油标号',
    options: ['0# 柴油', '-10# 柴油', '-20# 柴油', '-35# 柴油'],
  },
  {
    group: '电力补能',
    options: [
      '快充直流电 (kWh)',
      '慢充交流电 (kWh)',
      '家用充电桩 (谷电)',
      '家用充电桩 (平峰电)',
      '品牌自建超充 (特斯拉/小鹏/蔚来)',
      '第三方公共快充 (特来电/星星/快电)',
    ],
  },
  {
    group: '其他能源',
    options: ['换电服务', 'CNG 压缩天然气', 'LNG 液化天然气', '氢燃料 (kg)', '其他自定义'],
  },
];

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

  // 车辆档案管理与编辑/添加 Modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [isVehicleListModalOpen, setIsVehicleListModalOpen] = useState(false);

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
    isWarningLightOn: false,
    isMissedPrevious: false,
    station: currentVehicle?.fuelType === 'electric' ? '特来电超充站' : '中国石化',
    fuelType: currentVehicle?.fuelType === 'electric' ? '快充直流电 (kWh)' : '95# 汽油',
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

  // 车辆档案表单
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
      handleOpenAddVehicle();
      return;
    }
    setEditingFuelId(null);
    let defaultFuel = '95# 汽油';
    let defaultPrice = 8.35;
    let defaultAmount = 40;
    let defaultStation = '中国石化';

    if (currentVehicle?.fuelType === 'electric') {
      defaultFuel = '快充直流电 (kWh)';
      defaultPrice = 1.35;
      defaultAmount = 50;
      defaultStation = '特来电超充站';
    } else if (currentVehicle?.fuelType === 'gasoline_92') {
      defaultFuel = '92# 汽油';
      defaultPrice = 7.85;
      defaultAmount = 42;
    } else if (currentVehicle?.fuelType === 'gasoline_98') {
      defaultFuel = '98# 汽油';
      defaultPrice = 9.45;
      defaultAmount = 45;
    } else if (currentVehicle?.fuelType === 'diesel') {
      defaultFuel = '0# 柴油';
      defaultPrice = 7.55;
      defaultAmount = 48;
    }

    setFuelForm({
      date: new Date().toISOString().slice(0, 10),
      odometer: latestFuelOdo > 0 ? latestFuelOdo + 350 : (currentVehicle?.initialOdometer || 0),
      fuelAmount: defaultAmount,
      unitPrice: defaultPrice,
      totalCost: Number((defaultAmount * defaultPrice).toFixed(2)),
      isFullTank: true,
      isWarningLightOn: false,
      isMissedPrevious: false,
      station: defaultStation,
      fuelType: defaultFuel,
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
      isFullTank: f.isFullTank ?? true,
      isWarningLightOn: Boolean(f.isWarningLightOn),
      isMissedPrevious: Boolean(f.isMissedPrevious),
      station: f.station || '',
      fuelType: f.fuelType || '',
      notes: f.notes || '',
    });
    setIsFuelModalOpen(true);
  };

  const handleOpenAddMaint = () => {
    if (!currentVehicle) {
      handleOpenAddVehicle();
      return;
    }
    setEditingMaintId(null);
    setMaintForm({
      date: new Date().toISOString().slice(0, 10),
      odometer: latestFuelOdo || 0,
      category: 'routine',
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
    setIsMaintModalOpen(true);
  };

  const handleOpenEditMaint = (m: MaintenanceRecord) => {
    setEditingMaintId(m.id);
    setMaintForm({
      date: m.date,
      odometer: m.odometer,
      category: m.category,
      title: m.title,
      itemsStr: (m.items || []).join(', '),
      shopName: m.shopName || '',
      partsCost: m.partsCost || 0,
      laborCost: m.laborCost || 0,
      totalCost: m.totalCost,
      nextServiceOdometer: m.nextServiceOdometer || 0,
      nextServiceDate: m.nextServiceDate || '',
      notes: m.notes || '',
    });
    setIsMaintModalOpen(true);
  };

  // 打开添加车型弹窗
  const handleOpenAddVehicle = () => {
    setEditingVehicleId(null);
    setVehicleForm({
      name: '',
      plateNumber: '',
      fuelType: 'gasoline_95',
      tankCapacity: 50,
      initialOdometer: 0,
      maintenanceIntervalKm: 10000,
      maintenanceIntervalDays: 180,
    });
    setIsVehicleModalOpen(true);
  };

  // 打开编辑车型弹窗
  const handleOpenEditVehicle = (v: VehicleProfile) => {
    setEditingVehicleId(v.id);
    setVehicleForm({
      name: v.name,
      plateNumber: v.plateNumber || '',
      fuelType: v.fuelType,
      tankCapacity: v.tankCapacity || 50,
      initialOdometer: v.initialOdometer || 0,
      maintenanceIntervalKm: v.maintenanceIntervalKm || 10000,
      maintenanceIntervalDays: v.maintenanceIntervalDays || 180,
    });
    setIsVehicleModalOpen(true);
  };

  // 保存车型 (新建或修改)
  const handleSaveVehicleProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = Boolean(editingVehicleId);

    if (isEdit && editingVehicleId) {
      const existing = vehicles.find((v) => v.id === editingVehicleId);
      if (!existing) return;

      const updatedVehicle: VehicleProfile = {
        ...existing,
        name: vehicleForm.name.trim() || '未命名车辆',
        plateNumber: vehicleForm.plateNumber.trim(),
        fuelType: vehicleForm.fuelType,
        tankCapacity: Number(vehicleForm.tankCapacity) || 50,
        initialOdometer: Number(vehicleForm.initialOdometer) || 0,
        maintenanceIntervalKm: Number(vehicleForm.maintenanceIntervalKm) || 10000,
        maintenanceIntervalDays: Number(vehicleForm.maintenanceIntervalDays) || 180,
        updatedAt: new Date().toISOString(),
      };
      onSaveVehicle(updatedVehicle);
    } else {
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
    }

    setIsVehicleModalOpen(false);
  };

  // 删除车型 (带安全确认与关联记录提示)
  const handleDeleteVehicleAction = (vId: string, vName: string) => {
    const fCount = fuels.filter((f) => f.vehicleId === vId).length;
    const mCount = maintenances.filter((m) => m.vehicleId === vId).length;

    const warningDetail =
      fCount > 0 || mCount > 0
        ? `\n⚠️ 该车型下包含 ${fCount} 笔补能记录与 ${mCount} 笔维保记录，删除车型将一并清除相关记录！`
        : '';

    const confirmed = window.confirm(
      `确定要删除车型「${vName}」吗？${warningDetail}\n\n此操作不可撤销，是否确认删除？`
    );

    if (!confirmed) return;

    onDeleteVehicle(vId);

    // 如果删除的是当前激活车型，自动切换到剩余的第一辆车
    const remaining = vehicles.filter((v) => v.id !== vId);
    if (remaining.length > 0) {
      onChangeActiveVehicle(remaining[0].id);
    } else {
      onChangeActiveVehicle('');
    }

    setIsVehicleModalOpen(false);
  };

  const handleSaveFuel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVehicle) return;

    const newRecord: FuelRecord = {
      id: editingFuelId || `f-${Date.now()}`,
      vehicleId: currentVehicle.id,
      date: fuelForm.date,
      odometer: Number(fuelForm.odometer) || 0,
      fuelAmount: Number(fuelForm.fuelAmount) || 0,
      unitPrice: Number(fuelForm.unitPrice) || 0,
      totalCost: Number(fuelForm.totalCost) || Number(fuelForm.fuelAmount) * Number(fuelForm.unitPrice),
      isFullTank: fuelForm.isFullTank,
      isWarningLightOn: fuelForm.isWarningLightOn,
      isMissedPrevious: fuelForm.isMissedPrevious,
      station: fuelForm.station,
      fuelType: fuelForm.fuelType,
      notes: fuelForm.notes,
      createdAt: editingFuelId ? (fuels.find((f) => f.id === editingFuelId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    onSaveFuel(newRecord);
    setIsFuelModalOpen(false);
  };

  const handleSaveMaint = (e: React.FormEvent) => {
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
            onClick={handleOpenAddVehicle}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>添加爱车</span>
          </button>
        </div>

        {/* 渲染添加车辆 Modal */}
        {isVehicleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Car className="w-5 h-5 text-zinc-500" />
                  <span>{editingVehicleId ? '编辑车型档案' : '添加爱车档案'}</span>
                </h3>
                <button
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveVehicleProfile} className="space-y-3.5">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">车牌号码</label>
                    <input
                      type="text"
                      placeholder="如: 京A·8899D"
                      value={vehicleForm.plateNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">能源类型</label>
                    <select
                      value={vehicleForm.fuelType}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, fuelType: e.target.value as VehicleFuelType })}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                      {vehicleForm.fuelType === 'electric' ? '电池容量 (kWh)' : '油箱容积 (L)'}
                    </label>
                    <input
                      type="number"
                      value={vehicleForm.tankCapacity}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, tankCapacity: parseFloat(e.target.value) || 50 })}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">初始里程 (km)</label>
                    <input
                      type="number"
                      value={vehicleForm.initialOdometer}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, initialOdometer: parseFloat(e.target.value) || 0 })}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                    />
                  </div>
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
                    {editingVehicleId ? '保存修改' : '创建车辆'}
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
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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

              {/* 编辑当前车型按钮 */}
              <button
                onClick={() => handleOpenEditVehicle(currentVehicle)}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs transition-colors cursor-pointer"
                title="编辑当前车型档案"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              {/* 删除当前车型按钮 */}
              <button
                onClick={() => handleDeleteVehicleAction(currentVehicle.id, currentVehicle.name)}
                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs transition-colors cursor-pointer"
                title="删除当前车型档案"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* 车型管理列表按钮 */}
              <button
                onClick={() => setIsVehicleListModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                title="车型管理"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>车型管理</span>
              </button>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-0.5">
              自动核算百公里油耗/电耗 · 维修保养项目档案 · 下次维保智能提醒
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddVehicle}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">当前表显总里程</span>
          <div className="text-lg sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1.5 sm:mt-2">
            {healthStatus.currentOdometer.toLocaleString()} <span className="text-xs font-normal text-zinc-400">km</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">保养健康状况预警</span>
          <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5">
            {healthStatus.status === 'overdue' ? (
              <span className="text-rose-600 font-bold text-xs sm:text-sm flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 超期超程
              </span>
            ) : healthStatus.status === 'warning' ? (
              <span className="text-amber-600 font-bold text-xs sm:text-sm flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 临近保养
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 状态良好
              </span>
            )}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1 truncate">
            {healthStatus.message}
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {currentVehicle.fuelType === 'electric' ? '综合百公里电耗' : '综合百公里油耗'}
          </span>
          <div className="text-lg sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1.5 sm:mt-2">
            {avgFuelEconomy.toFixed(1)} <span className="text-xs font-normal text-zinc-400">{currentVehicle.fuelType === 'electric' ? 'kWh/100km' : 'L/100km'}</span>
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            累计 {vehicleFuels.length} 笔补能记录
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">累计用车支出</span>
          <div className="text-lg sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1.5 sm:mt-2">
            {formatCurrency(totalFuelCost + totalMaintCost, hidePrivacy)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            补能 {formatCurrency(totalFuelCost, hidePrivacy)} · 维保 {formatCurrency(totalMaintCost, hidePrivacy)}
          </div>
        </div>
      </div>

      {/* 子模块切换 */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab('fuel')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'fuel'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>加油/充电明细 ({vehicleFuels.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('maintenance')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'maintenance'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>保养与维修档案 ({vehicleMaintenances.length})</span>
          </button>
        </div>

        <div>
          {activeSubTab === 'fuel' ? (
            <button
              onClick={() => {
                const csv = exportFuelsToCsv(vehicleFuels);
                triggerFileDownload(csv, `qiyue_fuel_${currentVehicle.name}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
              }}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出补能 CSV</span>
            </button>
          ) : (
            <button
              onClick={() => {
                const csv = exportMaintenancesToCsv(vehicleMaintenances);
                triggerFileDownload(csv, `qiyue_maintenance_${currentVehicle.name}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
              }}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出维保 CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. 加油/充电明细表 */}
      {activeSubTab === 'fuel' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden">
          {vehicleFuels.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-600 text-xs">
              暂无该车辆的补能记录，点击右上角「记一笔补能」开始记录
            </div>
          ) : (
            <>
              {/* 移动端窄屏精简卡片流 */}
              <div className="block lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {vehicleFuels.map((f) => {
                  const isElectric = currentVehicle.fuelType === 'electric' || f.fuelType?.includes('电');
                  return (
                    <div
                      key={f.id}
                      className="p-3.5 sm:p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors space-y-2.5"
                    >
                      {/* 顶部行：日期、站点、加满标识与实付总额 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isElectric
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                            }`}
                          >
                            {isElectric ? <Zap className="w-4 h-4" /> : <Fuel className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                                {f.date}
                              </span>
                              {f.station && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 truncate max-w-[120px]">
                                  {f.station}
                                </span>
                              )}
                              {f.isFullTank ? (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                                  {isElectric ? '充满' : '加满'}
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                  未加满
                                </span>
                              )}
                              {f.isWarningLightOn && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/50 flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>{isElectric ? '低电' : '亮灯'}</span>
                                </span>
                              )}
                              {f.isMissedPrevious && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/50">
                                  漏记
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                              {f.fuelType || (isElectric ? '快充直流电' : '95# 汽油')}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                            {formatCurrency(f.totalCost, hidePrivacy)}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            ¥{f.unitPrice.toFixed(2)}/{isElectric ? 'kWh' : 'L'}
                          </div>
                        </div>
                      </div>

                      {/* 核心指标网格：表显里程、充加量、百公里能耗 */}
                      <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-[11px]">
                        <div>
                          <span className="text-zinc-400 text-[10px] block">表显里程</span>
                          <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                            {f.odometer.toLocaleString()} <span className="text-[9px] font-normal text-zinc-400">km</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400 text-[10px] block">{isElectric ? '充电量' : '加油量'}</span>
                          <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                            {f.fuelAmount} <span className="text-[9px] font-normal text-zinc-400">{isElectric ? 'kWh' : 'L'}</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400 text-[10px] block">百公里能耗</span>
                          {f.calculatedFuelEconomy ? (
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {f.calculatedFuelEconomy.toFixed(1)} <span className="text-[9px] font-normal">{isElectric ? 'kWh' : 'L'}</span>
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[10px]">累计中</span>
                          )}
                        </div>
                      </div>

                      {/* 底部备注与快捷操作 */}
                      <div className="flex items-center justify-between pt-0.5 text-xs">
                        <div className="text-[11px] text-zinc-400 truncate pr-2">
                          {f.notes ? (
                            <span className="text-zinc-600 dark:text-zinc-400">“{f.notes}”</span>
                          ) : f.costPerKm ? (
                            `约 ¥${f.costPerKm.toFixed(2)}/km`
                          ) : (
                            ''
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditFuel(f)}
                            className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>编辑</span>
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`确定删除 ${f.date} 的这笔补能记录吗？`)) {
                                onDeleteFuel(f.id);
                              }
                            }}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 桌面/宽屏端完整数据表格 */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50/80 dark:bg-zinc-800/40 text-zinc-400 border-b border-zinc-200/80 dark:border-zinc-800/80 font-medium">
                    <tr>
                      <th className="py-3 px-4">日期</th>
                      <th className="py-3 px-4">表显里程</th>
                      <th className="py-3 px-4">充/加油量</th>
                      <th className="py-3 px-4">单价</th>
                      <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">实付金额</th>
                      <th className="py-3 px-4">能耗核算</th>
                      <th className="py-3 px-4">站点/类型</th>
                      <th className="py-3 px-4">备注</th>
                      <th className="py-3 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {vehicleFuels.map((f) => (
                      <tr key={f.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-zinc-700 dark:text-zinc-300">
                          <div>{f.date}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {f.isFullTank ? (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                                {currentVehicle.fuelType === 'electric' ? '充满' : '加满'}
                              </span>
                            ) : (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                未加满
                              </span>
                            )}
                            {f.isWarningLightOn && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/50 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>{currentVehicle.fuelType === 'electric' ? '低电' : '亮灯'}</span>
                              </span>
                            )}
                            {f.isMissedPrevious && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                                漏记
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                          {f.odometer.toLocaleString()} km
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                          {f.fuelAmount} {currentVehicle.fuelType === 'electric' ? 'kWh' : 'L'}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-500">
                          ¥{f.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(f.totalCost, hidePrivacy)}
                        </td>
                        <td className="py-3 px-4">
                          {f.calculatedFuelEconomy ? (
                            <div className="space-y-0.5">
                              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {f.calculatedFuelEconomy.toFixed(1)} {currentVehicle.fuelType === 'electric' ? 'kWh/100km' : 'L/100km'}
                              </span>
                              {f.costPerKm && (
                                <div className="text-[10px] text-zinc-400">
                                  约 ¥{f.costPerKm.toFixed(2)}/km
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">- (首笔/累计中)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                          <div className="font-medium">{f.station || '-'}</div>
                          <div className="text-[10px] text-zinc-400">{f.fuelType}</div>
                        </td>
                        <td className="py-3 px-4 text-zinc-500 max-w-xs truncate">
                          {f.notes || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditFuel(f)}
                              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                              title="编辑"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`确定删除 ${f.date} 的这笔补能记录吗？`)) {
                                  onDeleteFuel(f.id);
                                }
                              }}
                              className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 cursor-pointer"
                              title="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. 保养与维修档案明细表 */}
      {activeSubTab === 'maintenance' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden">
          {vehicleMaintenances.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-600 text-xs">
              暂无该车辆的维保记录，点击右上角「记一笔维保」开始记录
            </div>
          ) : (
            <>
              {/* 移动端窄屏精简维保卡片流 */}
              <div className="block lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {vehicleMaintenances.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 sm:p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                          {categoryLabels[m.category] || m.category}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate">
                            {m.title}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {m.date} · {m.shopName || '维保门店'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(m.totalCost, hidePrivacy)}
                        </div>
                      </div>
                    </div>

                    {m.items && m.items.length > 0 && (
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        {m.items.join(' / ')}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-0.5 text-xs">
                      <div className="text-[10px] text-zinc-400 truncate pr-2">
                        {m.odometer ? `表显: ${m.odometer.toLocaleString()} km` : ''}
                        {m.nextServiceOdometer ? ` · 下次: ${m.nextServiceOdometer.toLocaleString()} km` : ''}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditMaint(m)}
                          className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>编辑</span>
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`确定删除 ${m.date} 的这笔维保记录吗？`)) {
                              onDeleteMaintenance(m.id);
                            }
                          }}
                          className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 桌面/宽屏端完整数据表格 */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50/80 dark:bg-zinc-800/40 text-zinc-400 border-b border-zinc-200/80 dark:border-zinc-800/80 font-medium">
                    <tr>
                      <th className="py-3 px-4">维保日期</th>
                      <th className="py-3 px-4">分类</th>
                      <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">维保项目</th>
                      <th className="py-3 px-4">服务门店</th>
                      <th className="py-3 px-4">表显里程</th>
                      <th className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">总费用</th>
                      <th className="py-3 px-4">下次建议</th>
                      <th className="py-3 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {vehicleMaintenances.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-zinc-700 dark:text-zinc-300">
                          {m.date}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                            {categoryLabels[m.category] || m.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 font-medium">
                          <div>{m.title}</div>
                          {m.items && m.items.length > 0 && (
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                              {m.items.join(' / ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                          {m.shopName || '-'}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                          {m.odometer.toLocaleString()} km
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(m.totalCost, hidePrivacy)}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-zinc-500">
                          {m.nextServiceOdometer ? (
                            <div>{m.nextServiceOdometer.toLocaleString()} km</div>
                          ) : null}
                          {m.nextServiceDate ? (
                            <div className="text-zinc-400">{m.nextServiceDate}</div>
                          ) : null}
                          {!m.nextServiceOdometer && !m.nextServiceDate && '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditMaint(m)}
                              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                              title="编辑"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`确定删除 ${m.date} 的这笔维保记录吗？`)) {
                                  onDeleteMaintenance(m.id);
                                }
                              }}
                              className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 cursor-pointer"
                              title="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 加油/充电 Modal */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs my-auto max-h-[calc(100vh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Fuel className="w-5 h-5 text-zinc-500" />
                <span>{editingFuelId ? '编辑补能记录' : '记一笔补能'}</span>
              </h3>
              <button
                onClick={() => setIsFuelModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFuel} className="space-y-3.5 flex-1">
              {/* 补能日期与当前里程 (响应式栅格，规避 iOS 日期组件宽度溢出产生重叠) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">补能日期</label>
                  <input
                    type="date"
                    required
                    value={fuelForm.date}
                    onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">当前表显里程 (km)</label>
                  <input
                    type="number"
                    required
                    value={fuelForm.odometer}
                    onChange={(e) => setFuelForm({ ...fuelForm, odometer: parseFloat(e.target.value) || 0 })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    {currentVehicle.fuelType === 'electric' ? '充电量 (kWh)' : '加油升数 (L)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelForm.fuelAmount}
                    onChange={(e) => {
                      const amt = parseFloat(e.target.value) || 0;
                      setFuelForm({
                        ...fuelForm,
                        fuelAmount: amt,
                        totalCost: Number((amt * fuelForm.unitPrice).toFixed(2)),
                      });
                    }}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    {currentVehicle.fuelType === 'electric' ? '电价 (元/度)' : '油价 (元/L)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelForm.unitPrice}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value) || 0;
                      setFuelForm({
                        ...fuelForm,
                        unitPrice: price,
                        totalCost: Number((fuelForm.fuelAmount * price).toFixed(2)),
                      });
                    }}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">实付总金额 (元)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelForm.totalCost}
                    onChange={(e) => setFuelForm({ ...fuelForm, totalCost: parseFloat(e.target.value) || 0 })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">站点名称</label>
                  <input
                    type="text"
                    placeholder="如: 特来电 / 中国石化"
                    value={fuelForm.station}
                    onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium">
                      补能标号类型
                    </label>
                    <span className="text-[10px] text-zinc-400">
                      支持下拉切换 / 自定义
                    </span>
                  </div>
                  <select
                    value={
                      FUEL_TYPE_OPTIONS.some((g) => g.options.includes(fuelForm.fuelType))
                        ? fuelForm.fuelType
                        : '其他自定义'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '其他自定义') {
                        setFuelForm({ ...fuelForm, fuelType: '' });
                      } else {
                        let newPrice = fuelForm.unitPrice;
                        let newStation = fuelForm.station;
                        if (val.includes('92#')) {
                          newPrice = 7.85;
                          if (!newStation || newStation.includes('电')) newStation = '中国石化';
                        } else if (val.includes('95#')) {
                          newPrice = 8.35;
                          if (!newStation || newStation.includes('电')) newStation = '中国石化';
                        } else if (val.includes('98#')) {
                          newPrice = 9.45;
                          if (!newStation || newStation.includes('电')) newStation = '中国石化';
                        } else if (val.includes('柴油')) {
                          newPrice = 7.55;
                          if (!newStation || newStation.includes('电')) newStation = '中国石化';
                        } else if (val.includes('谷电')) {
                          newPrice = 0.38;
                          newStation = '家用充电桩';
                        } else if (val.includes('快充') || val.includes('超充')) {
                          newPrice = 1.35;
                          if (!newStation || newStation.includes('石化') || newStation.includes('石油')) {
                            newStation = '特来电超充站';
                          }
                        } else if (val.includes('慢充')) {
                          newPrice = 1.10;
                        }
                        const total = Number((fuelForm.fuelAmount * newPrice).toFixed(2));
                        setFuelForm({
                          ...fuelForm,
                          fuelType: val,
                          unitPrice: newPrice,
                          totalCost: total > 0 ? total : fuelForm.totalCost,
                          station: newStation,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium cursor-pointer"
                  >
                    {FUEL_TYPE_OPTIONS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {(!FUEL_TYPE_OPTIONS.some((g) => g.options.includes(fuelForm.fuelType)) ||
                    fuelForm.fuelType === '其他自定义' ||
                    fuelForm.fuelType === '') && (
                    <div className="mt-1.5">
                      <input
                        type="text"
                        placeholder="输入自定义标号或规格 (如: 100# 赛车油 / 氢能)..."
                        value={fuelForm.fuelType === '其他自定义' ? '' : fuelForm.fuelType}
                        onChange={(e) => setFuelForm({ ...fuelForm, fuelType: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(currentVehicle?.fuelType === 'electric'
                      ? ['快充直流电 (kWh)', '慢充交流电 (kWh)', '家用充电桩 (谷电)']
                      : currentVehicle?.fuelType === 'diesel'
                      ? ['0# 柴油', '-10# 柴油']
                      : ['92# 汽油', '95# 汽油', '98# 汽油', '快充直流电 (kWh)']
                    ).map((quickOpt) => (
                      <button
                        key={quickOpt}
                        type="button"
                        onClick={() => {
                          let newPrice = fuelForm.unitPrice;
                          if (quickOpt.includes('92#')) newPrice = 7.85;
                          else if (quickOpt.includes('95#')) newPrice = 8.35;
                          else if (quickOpt.includes('98#')) newPrice = 9.45;
                          else if (quickOpt.includes('柴油')) newPrice = 7.55;
                          else if (quickOpt.includes('谷电')) newPrice = 0.38;
                          else if (quickOpt.includes('快充')) newPrice = 1.35;
                          const total = Number((fuelForm.fuelAmount * newPrice).toFixed(2));
                          setFuelForm({
                            ...fuelForm,
                            fuelType: quickOpt,
                            unitPrice: newPrice,
                            totalCost: total > 0 ? total : fuelForm.totalCost,
                          });
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          fuelForm.fuelType === quickOpt
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-medium shadow-xs'
                            : 'bg-zinc-100/80 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        {quickOpt.replace(' (kWh)', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 补能状态选择：加满/充满、油表亮灯、漏记保护 */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1.5">
                    {currentVehicle?.fuelType === 'electric' ? '充电状态' : '加油状态'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFuelForm({ ...fuelForm, isFullTank: true })}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        fuelForm.isFullTank
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{currentVehicle?.fuelType === 'electric' ? '充满 (100% 满电)' : '加满 (跳枪)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFuelForm({ ...fuelForm, isFullTank: false })}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        !fuelForm.isFullTank
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs'
                          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <span>未加满 (部分补能)</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {fuelForm.isFullTank
                      ? '💡 连续两次加满即可精确核算该区间真实的百公里油耗/电耗。'
                      : '💡 未加满时系统将暂不计算本笔单次油耗，待下次加满时合并累积计算。'}
                  </p>
                </div>

                {/* 状态复选标签：油表亮灯 / 遗漏上次 */}
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFuelForm({ ...fuelForm, isWarningLightOn: !fuelForm.isWarningLightOn })}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      fuelForm.isWarningLightOn
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{currentVehicle?.fuelType === 'electric' ? '低电告警 (电量<10%)' : '油表黄灯亮 (已亮灯)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFuelForm({ ...fuelForm, isMissedPrevious: !fuelForm.isMissedPrevious })}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      fuelForm.isMissedPrevious
                        ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-rose-400'
                    }`}
                    title="若中间有一次借车或忘记记账，开启后重新作为起始点计算能耗"
                  >
                    <span>遗漏上次记录</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">备注信息</label>
                <input
                  type="text"
                  placeholder="其他补充..."
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

      {/* 维修保养 Modal */}
      {isMaintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs my-auto max-h-[calc(100vh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-zinc-500" />
                <span>{editingMaintId ? '编辑维保记录' : '记一笔维保'}</span>
              </h3>
              <button
                onClick={() => setIsMaintModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaint} className="space-y-3.5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">维保日期</label>
                  <input
                    type="date"
                    required
                    value={maintForm.date}
                    onChange={(e) => setMaintForm({ ...maintForm, date: e.target.value })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">维保分类</label>
                  <select
                    value={maintForm.category}
                    onChange={(e) => setMaintForm({ ...maintForm, category: e.target.value as MaintenanceCategory })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    {Object.entries(categoryLabels).map(([cat, label]) => (
                      <option key={cat} value={cat}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">项目标题</label>
                  <input
                    type="text"
                    required
                    placeholder="如: 4万公里常规保养"
                    value={maintForm.title}
                    onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">表显里程 (km)</label>
                  <input
                    type="number"
                    required
                    value={maintForm.odometer}
                    onChange={(e) => setMaintForm({ ...maintForm, odometer: parseFloat(e.target.value) || 0 })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">维保明细项 (逗号分隔)</label>
                <input
                  type="text"
                  placeholder="如: 机油, 机滤, 空气滤清器, 刹车油"
                  value={maintForm.itemsStr}
                  onChange={(e) => setMaintForm({ ...maintForm, itemsStr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">配件费用 (元)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maintForm.partsCost}
                    onChange={(e) => {
                      const parts = parseFloat(e.target.value) || 0;
                      setMaintForm({
                        ...maintForm,
                        partsCost: parts,
                        totalCost: Number((parts + maintForm.laborCost).toFixed(2)),
                      });
                    }}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">工时费用 (元)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maintForm.laborCost}
                    onChange={(e) => {
                      const labor = parseFloat(e.target.value) || 0;
                      setMaintForm({
                        ...maintForm,
                        laborCost: labor,
                        totalCost: Number((maintForm.partsCost + labor).toFixed(2)),
                      });
                    }}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">实付总计 (元)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={maintForm.totalCost}
                    onChange={(e) => setMaintForm({ ...maintForm, totalCost: parseFloat(e.target.value) || 0 })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">服务门店/4S店</label>
                  <input
                    type="text"
                    placeholder="如: 途虎养车 / 特斯拉服务中心"
                    value={maintForm.shopName}
                    onChange={(e) => setMaintForm({ ...maintForm, shopName: e.target.value })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">下次建议里程 (km)</label>
                  <input
                    type="number"
                    placeholder="如: 30000"
                    value={maintForm.nextServiceOdometer || ''}
                    onChange={(e) => setMaintForm({ ...maintForm, nextServiceOdometer: parseFloat(e.target.value) || 0 })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
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
                  保存记录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 车辆档案创建与修改 Modal */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Car className="w-5 h-5 text-zinc-500" />
                <span>{editingVehicleId ? '编辑爱车档案' : '添加爱车档案'}</span>
              </h3>
              <button
                onClick={() => setIsVehicleModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicleProfile} className="space-y-3.5">
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
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">
                    {vehicleForm.fuelType === 'electric' ? '电池容量 (kWh)' : '油箱容积 (L)'}
                  </label>
                  <input
                    type="number"
                    value={vehicleForm.tankCapacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, tankCapacity: parseFloat(e.target.value) || 50 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">初始里程 (km)</label>
                  <input
                    type="number"
                    value={vehicleForm.initialOdometer}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, initialOdometer: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
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

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                {editingVehicleId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteVehicleAction(editingVehicleId, vehicleForm.name)}
                    className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除此车型</span>
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
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
                    {editingVehicleId ? '保存修改' : '创建车辆'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 车型管理列表 Modal */}
      {isVehicleListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-zinc-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">车型档案管理</h3>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-semibold">
                  共 {vehicles.length} 辆车
                </span>
              </div>
              <button
                onClick={() => setIsVehicleListModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {vehicles.map((v) => {
                const isActive = v.id === currentVehicle.id;
                const vFuelsCount = fuels.filter((f) => f.vehicleId === v.id).length;
                const vMaintsCount = maintenances.filter((m) => m.vehicleId === v.id).length;

                return (
                  <div
                    key={v.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-zinc-50/80 dark:bg-zinc-800/40 border-zinc-900/30 dark:border-zinc-100/30 shadow-xs'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{v.name}</span>
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono font-medium text-zinc-700 dark:text-zinc-300">
                            {v.plateNumber || '未填写车牌'}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-200/60 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              当前使用中
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-3">
                          <span>类型: {v.fuelType === 'electric' ? '纯电' : v.fuelType === 'hybrid' ? '插混' : '燃油'}</span>
                          <span>初始: {v.initialOdometer.toLocaleString()} km</span>
                          <span>补能: {vFuelsCount} 笔</span>
                          <span>维保: {vMaintsCount} 笔</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isActive && (
                          <button
                            onClick={() => {
                              onChangeActiveVehicle(v.id);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                          >
                            设为当前
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsVehicleListModalOpen(false);
                            handleOpenEditVehicle(v);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>编辑</span>
                        </button>
                        <button
                          onClick={() => handleDeleteVehicleAction(v.id, v.name)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => {
                  setIsVehicleListModalOpen(false);
                  handleOpenAddVehicle();
                }}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>添加新车型</span>
              </button>

              <button
                onClick={() => setIsVehicleListModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
