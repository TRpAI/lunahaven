import { AppSettings, FuelRecord, LedgerFullData, MaintenanceRecord, OvertimeRecord, SalaryRecord, SocialGiftRecord, VehicleProfile } from '../types';
import { processFuelRecords } from './fuelCalculator';
import { calculateSalaryBreakdown, DEFAULT_INSURANCE_RATES } from './taxCalculator';

const STORAGE_KEY = 'qiyue_ledger_v1';

const DEMO_PIN_HASH = 'cWl5dWVfbWFzdGVyXzEyMzQ1Nl9hdXRoX3Yy';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  currencySymbol: '¥',
  isPinLockEnabled: true,
  pinHash: '', // 生产环境无默认密码，首次登入强制新建自定义主密码
  passwordSalt: '',
  autoLockMinutes: 15,
  privacyMaskNumbers: false,
  activeVehicleId: 'v-1',
  insuranceRates: DEFAULT_INSURANCE_RATES,
  d1Config: {
    workerUrl: '',
    apiToken: '',
    databaseName: 'qiyue_ledger_d1',
    lastSyncTime: null,
    syncStatus: 'idle',
    syncMode: 'local_only',
    autoSync: false,
  },
};

/**
 * 预置真实丰富的演示数据
 */
export function generateInitialSampleData(): LedgerFullData {
  // 1. 车辆初始数据
  const vehicles: VehicleProfile[] = [
    {
      id: 'v-1',
      name: '极氪 001 / 特斯拉 (日常代步)',
      plateNumber: '京A·8899D',
      fuelType: 'electric',
      tankCapacity: 100,
      initialOdometer: 12000,
      currentOdometer: 24680,
      maintenanceIntervalKm: 10000,
      maintenanceIntervalDays: 180,
      lastMaintenanceDate: '2026-06-15',
      lastMaintenanceOdometer: 20000,
      insuranceExpiryDate: '2027-03-20',
      annualInspectionDate: '2028-06-01',
      createdAt: '2025-01-01',
    },
    {
      id: 'v-2',
      name: '大众高尔夫 1.4T (家用备用)',
      plateNumber: '京C·66210',
      fuelType: 'gasoline_95',
      tankCapacity: 50,
      initialOdometer: 45000,
      currentOdometer: 58200,
      maintenanceIntervalKm: 7500,
      maintenanceIntervalDays: 180,
      lastMaintenanceDate: '2026-05-10',
      lastMaintenanceOdometer: 52000,
      insuranceExpiryDate: '2026-11-15',
      annualInspectionDate: '2027-05-01',
      createdAt: '2024-03-10',
    },
  ];

  // 2. 加油/充电记录
  const rawFuels: FuelRecord[] = [
    {
      id: 'f-1',
      vehicleId: 'v-1',
      date: '2026-07-02',
      odometer: 21100,
      fuelAmount: 65,
      unitPrice: 1.25,
      totalCost: 81.25,
      isFullTank: true,
      station: '国家电网超充站',
      fuelType: '快充 (kWh)',
      notes: '夜间谷电时段充电',
      createdAt: '2026-07-02T22:30:00Z',
    },
    {
      id: 'f-2',
      vehicleId: 'v-1',
      date: '2026-07-20',
      odometer: 22350,
      fuelAmount: 78,
      unitPrice: 1.4,
      totalCost: 109.2,
      isFullTank: true,
      station: '特来电快充',
      fuelType: '快充 (kWh)',
      notes: '周末自驾返程补电',
      createdAt: '2026-07-20T17:10:00Z',
    },
    {
      id: 'f-3',
      vehicleId: 'v-1',
      date: '2026-08-12',
      odometer: 23500,
      fuelAmount: 72,
      unitPrice: 1.3,
      totalCost: 93.6,
      isFullTank: true,
      station: '商场地下特斯拉超充',
      fuelType: '快充 (kWh)',
      notes: '逛街顺便充饱',
      createdAt: '2026-08-12T19:40:00Z',
    },
    {
      id: 'f-4',
      vehicleId: 'v-1',
      date: '2026-09-08',
      odometer: 24680,
      fuelAmount: 75,
      unitPrice: 1.28,
      totalCost: 96.0,
      isFullTank: true,
      station: '社区家充桩',
      fuelType: '慢充 (kWh)',
      notes: '家充定时预约充饱',
      createdAt: '2026-09-08T06:00:00Z',
    },
    // 油车油耗记录
    {
      id: 'f-5',
      vehicleId: 'v-2',
      date: '2026-07-05',
      odometer: 54100,
      fuelAmount: 42.5,
      unitPrice: 8.42,
      totalCost: 357.85,
      isFullTank: true,
      station: '中石化加油站',
      fuelType: '95# 汽油',
      notes: '油价上涨前加满',
      createdAt: '2026-07-05T08:30:00Z',
    },
    {
      id: 'f-6',
      vehicleId: 'v-2',
      date: '2026-08-01',
      odometer: 54720,
      fuelAmount: 43.8,
      unitPrice: 8.35,
      totalCost: 365.73,
      isFullTank: true,
      station: '中石油加油站',
      fuelType: '95# 汽油',
      notes: '市区上下班代步加满',
      createdAt: '2026-08-01T18:20:00Z',
    },
    {
      id: 'f-7',
      vehicleId: 'v-2',
      date: '2026-09-02',
      odometer: 55360,
      fuelAmount: 44.2,
      unitPrice: 8.28,
      totalCost: 365.98,
      isFullTank: true,
      station: '中石化加油站',
      fuelType: '95# 汽油',
      notes: '加满一箱95#油',
      createdAt: '2026-09-02T19:00:00Z',
    },
  ];

  const fuels = processFuelRecords(rawFuels);

  // 3. 汽车维保记录
  const maintenances: MaintenanceRecord[] = [
    {
      id: 'm-1',
      vehicleId: 'v-1',
      date: '2026-06-15',
      odometer: 20000,
      category: 'routine',
      title: '2万公里电车常规体检与空调滤芯更换',
      items: ['空调CN95滤芯更换', '底盘三电系统高压绝缘检测', '制动液含水量检测', '四轮动平衡校准'],
      shopName: '官方授权服务中心',
      partsCost: 280,
      laborCost: 200,
      totalCost: 480,
      nextServiceOdometer: 30000,
      nextServiceDate: '2026-12-15',
      notes: '电池健康度 98.7%，底盘无剐蹭',
      createdAt: '2026-06-15T14:30:00Z',
    },
    {
      id: 'm-2',
      vehicleId: 'v-2',
      date: '2026-05-10',
      odometer: 52000,
      category: 'routine',
      title: '高尔夫5万公里常规小保养',
      items: ['嘉实多全合成极护 0W-20 机油 4L', '马勒曼牌机油滤清器', '空气滤芯更换'],
      shopName: '途虎养车工场店',
      partsCost: 360,
      laborCost: 80,
      totalCost: 440,
      nextServiceOdometer: 59500,
      nextServiceDate: '2026-11-10',
      notes: '机油放油螺栓更换新垫片',
      createdAt: '2026-05-10T10:00:00Z',
    },
    {
      id: 'm-3',
      vehicleId: 'v-2',
      date: '2026-03-18',
      odometer: 49800,
      category: 'insurance',
      title: '人保财险车辆商业险+交强险+车船税续保',
      items: ['机动车损失险 (35万保额)', '第三者责任险 (300万保额)', '医保外用药责任附加险', '交强险 + 车船税'],
      shopName: '中国人民财产保险股份有限公司',
      partsCost: 2850,
      laborCost: 0,
      totalCost: 2850,
      nextServiceOdometer: undefined,
      nextServiceDate: '2027-03-18',
      notes: '连续三年未出险享受折扣返还加油卡 ¥300',
      createdAt: '2026-03-18T16:00:00Z',
    },
  ];

  // 4. 工资薪酬明细记录 (最近6个月完整记录)
  const salaryMonths = [
    {
      month: '2026-09',
      base: 18000,
      perf: 4500,
      ot: 1600,
      allow: 1200,
      bonus: 0,
      ded: 0,
      spec: 3000,
      payDate: '2026-09-10',
    },
    {
      month: '2026-08',
      base: 18000,
      perf: 4200,
      ot: 1250,
      allow: 1200,
      bonus: 0,
      ded: 0,
      spec: 3000,
      payDate: '2026-08-10',
    },
    {
      month: '2026-07',
      base: 18000,
      perf: 5000,
      ot: 2100,
      allow: 1200,
      bonus: 3000,
      ded: 0,
      spec: 3000,
      payDate: '2026-07-10',
    },
    {
      month: '2026-06',
      base: 18000,
      perf: 4000,
      ot: 950,
      allow: 1200,
      bonus: 0,
      ded: 300,
      spec: 3000,
      payDate: '2026-06-10',
    },
    {
      month: '2026-05',
      base: 18000,
      perf: 4600,
      ot: 1400,
      allow: 1200,
      bonus: 0,
      ded: 0,
      spec: 3000,
      payDate: '2026-05-10',
    },
    {
      month: '2026-04',
      base: 18000,
      perf: 4300,
      ot: 800,
      allow: 1200,
      bonus: 0,
      ded: 0,
      spec: 3000,
      payDate: '2026-04-10',
    },
  ];

  const salaries: SalaryRecord[] = salaryMonths.map((m, idx) => {
    const calc = calculateSalaryBreakdown({
      baseSalary: m.base,
      performancePay: m.perf,
      overtimePay: m.ot,
      allowance: m.allow,
      otherBonus: m.bonus,
      preTaxDeduction: m.ded,
      specialDeductions: m.spec,
    });

    return {
      id: `sal-${idx + 1}`,
      month: m.month,
      companyName: '科技创新互联网科技有限公司',
      baseSalary: m.base,
      performancePay: m.perf,
      overtimePay: m.ot,
      allowance: m.allow,
      otherBonus: m.bonus,
      preTaxDeduction: m.ded,
      grossSalary: calc.grossSalary,

      pensionPersonal: calc.pensionPersonal,
      medicalPersonal: calc.medicalPersonal,
      unemploymentPersonal: calc.unemploymentPersonal,
      housingFundPersonal: calc.housingFundPersonal,
      totalPersonalInsurance: calc.totalPersonalInsurance,

      pensionCompany: calc.pensionCompany,
      medicalCompany: calc.medicalCompany,
      unemploymentCompany: calc.unemploymentCompany,
      injuryCompany: calc.injuryCompany,
      maternityCompany: calc.maternityCompany,
      housingFundCompany: calc.housingFundCompany,
      totalCompanyInsurance: calc.totalCompanyInsurance,

      specialDeductions: m.spec,
      taxThreshold: calc.taxThreshold,
      taxableIncome: calc.taxableIncome,
      individualIncomeTax: calc.individualIncomeTax,

      netSalary: calc.netSalary,
      companyTotalCost: calc.companyTotalCost,
      payDate: m.payDate,
      notes: idx === 2 ? '含Q2季度优秀项目专项奖金 ¥3,000' : '正常发放',
      createdAt: `${m.month}-10T09:00:00Z`,
      updatedAt: `${m.month}-10T09:00:00Z`,
    };
  });

  // 5. 加班与工时记录
  const overtimes: OvertimeRecord[] = [
    {
      id: 'ot-1',
      date: '2026-09-22',
      type: 'workday',
      startTime: '18:30',
      endTime: '21:30',
      durationHours: 3,
      multiplier: 1.5,
      settlementType: 'paid',
      hourlyRate: 103.45,
      estimatedPay: 465.5,
      compTimeHoursUsed: 0,
      reason: 'V3.0核心系统上线冲刺联调',
      approver: '张主管',
      notes: '晚间加班并已由部门确认',
      createdAt: '2026-09-22T21:40:00Z',
    },
    {
      id: 'ot-2',
      date: '2026-09-13',
      type: 'weekend',
      startTime: '09:30',
      endTime: '17:30',
      durationHours: 7,
      multiplier: 2.0,
      settlementType: 'comp_time',
      hourlyRate: 103.45,
      estimatedPay: 1448.3,
      compTimeHoursUsed: 0,
      reason: '全国容灾机房架构迁移与演练',
      approver: '李总监',
      notes: '存入调休池备用',
      createdAt: '2026-09-13T18:00:00Z',
    },
    {
      id: 'ot-3',
      date: '2026-09-05',
      type: 'workday',
      startTime: '18:30',
      endTime: '21:00',
      durationHours: 2.5,
      multiplier: 1.5,
      settlementType: 'paid',
      hourlyRate: 103.45,
      estimatedPay: 387.9,
      compTimeHoursUsed: 0,
      reason: '线上突发高并发流量异常排查',
      approver: '张主管',
      notes: '修复故障并完成复盘',
      createdAt: '2026-09-05T21:15:00Z',
    },
    {
      id: 'ot-4',
      date: '2026-08-25',
      type: 'workday',
      startTime: '18:30',
      endTime: '22:30',
      durationHours: 4,
      multiplier: 1.5,
      settlementType: 'paid',
      hourlyRate: 103.45,
      estimatedPay: 620.7,
      compTimeHoursUsed: 0,
      reason: '月度结算报表自动同步功能开发',
      approver: '张主管',
      notes: '已计入8月薪酬发放',
      createdAt: '2026-08-25T22:35:00Z',
    },
    {
      id: 'ot-5',
      date: '2026-08-08',
      type: 'weekend',
      startTime: '10:00',
      endTime: '16:00',
      durationHours: 6,
      multiplier: 2.0,
      settlementType: 'comp_time',
      hourlyRate: 103.45,
      estimatedPay: 1241.4,
      compTimeHoursUsed: 6,
      reason: '第三方支付接口安全加固改造',
      approver: '李总监',
      notes: '已于8月28日全天调休休假使用',
      createdAt: '2026-08-08T16:30:00Z',
    },
  ];

  // 6. 人情往来随礼记录
  const gifts: SocialGiftRecord[] = [
    {
      id: 'g-1',
      date: '2026-09-18',
      direction: 'out',
      personName: '刘晓明 (大学舍友)',
      relation: 'classmate',
      eventType: 'wedding',
      amount: 1000,
      returnStatus: 'pending',
      location: '万达嘉华酒店三层宴会厅',
      notes: '结婚随礼，合送了定制摆件',
      createdAt: '2026-09-18T12:00:00Z',
    },
    {
      id: 'g-2',
      date: '2026-08-20',
      direction: 'out',
      personName: '表姐 (李欣)',
      relation: 'relative',
      eventType: 'baby',
      amount: 800,
      returnStatus: 'returned',
      returnAmount: 1000,
      location: '市妇幼保健院',
      notes: '二胎得千金，送长命锁与红包',
      createdAt: '2026-08-20T15:00:00Z',
    },
    {
      id: 'g-3',
      date: '2026-07-12',
      direction: 'in',
      personName: '陈伟 (部门同事)',
      relation: 'colleague',
      eventType: 'housewarming',
      amount: 600,
      returnStatus: 'pending',
      location: '自家新房温居',
      notes: '新家入伙聚餐随礼',
      createdAt: '2026-07-12T19:00:00Z',
    },
    {
      id: 'g-4',
      date: '2026-06-08',
      direction: 'out',
      personName: '高中班主任 (王老师)',
      relation: 'other',
      eventType: 'longevity',
      amount: 500,
      returnStatus: 'none_needed',
      location: '聚春园茶餐厅',
      notes: '老师七十大寿，同学代表集体祝寿慰问',
      createdAt: '2026-06-08T11:30:00Z',
    },
    {
      id: 'g-5',
      date: '2026-05-02',
      direction: 'out',
      personName: '赵磊 (发小)',
      relation: 'friend',
      eventType: 'wedding',
      amount: 1200,
      returnStatus: 'returned',
      returnAmount: 1200,
      location: '喜来登大酒店',
      notes: '发小结婚随礼，已互相礼尚往来平账',
      createdAt: '2026-05-02T12:30:00Z',
    },
    {
      id: 'g-6',
      date: '2026-02-10',
      direction: 'in',
      personName: '舅舅',
      relation: 'relative',
      eventType: 'holiday',
      amount: 1000,
      returnStatus: 'returned',
      returnAmount: 1000,
      location: '老家过年拜年',
      notes: '春节长辈红包',
      createdAt: '2026-02-10T10:00:00Z',
    },
  ];

  return {
    salaries,
    overtimes,
    gifts,
    vehicles,
    fuels,
    maintenances,
    settings: DEFAULT_SETTINGS,
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
  };
}

/**
 * 读取本地数据
 */
export function loadLedgerData(): LedgerFullData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = generateInitialSampleData();
      saveLedgerData(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    const mergedSettings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
    // 若原本地缓存中仍存留演示默认密码 (123456)，彻底清除并强制首次新建
    if (mergedSettings.pinHash === DEMO_PIN_HASH) {
      mergedSettings.pinHash = '';
      mergedSettings.passwordSalt = '';
    }

    return {
      salaries: parsed.salaries || [],
      overtimes: parsed.overtimes || [],
      gifts: parsed.gifts || [],
      vehicles: parsed.vehicles || [],
      fuels: parsed.fuels || [],
      maintenances: parsed.maintenances || [],
      settings: mergedSettings,
      version: parsed.version || '1.0.0',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Failed to load ledger data from localStorage, fallback to samples', err);
    return generateInitialSampleData();
  }
}

/**
 * 保存数据到本地
 */
export function saveLedgerData(data: LedgerFullData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save data to localStorage', err);
  }
}

/**
 * 清空并重置为初始演示数据
 */
export function resetToSampleData(): LedgerFullData {
  const initial = generateInitialSampleData();
  saveLedgerData(initial);
  return initial;
}

/**
 * 完全清空所有数据
 */
export function clearAllLedgerData(): LedgerFullData {
  const empty: LedgerFullData = {
    salaries: [],
    overtimes: [],
    gifts: [],
    vehicles: [],
    fuels: [],
    maintenances: [],
    settings: {
      ...DEFAULT_SETTINGS,
      activeVehicleId: '',
    },
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
  };
  saveLedgerData(empty);
  return empty;
}
