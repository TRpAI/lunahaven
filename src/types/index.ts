/**
 * Types definition for Qiyue Ledger (栖月账本)
 * Cloudflare D1 + Local-First Personal Life & Financial Ledger
 */

export interface SalaryCustomItem {
  id: string;
  name: string;
  amount: number;
}

export interface SalaryRecord {
  id: string;
  month: string; // YYYY-MM
  companyName: string;
  baseSalary: number; // 基本工资
  performancePay: number; // 绩效/岗位/奖金
  overtimePay: number; // 加班费
  allowance: number; // 津补贴(餐补/房补/交通/通讯)
  otherBonus: number; // 其他奖金/提成
  preTaxDeduction: number; // 税前扣除(事假/缺勤)
  grossSalary: number; // 应发工资合计

  // 加班费明细拆解 (1.5倍 / 2倍 / 3倍)
  overtime15Hours?: number;
  overtime15Pay?: number;
  overtime20Hours?: number;
  overtime20Pay?: number;
  overtime30Hours?: number;
  overtime30Pay?: number;

  // 补贴明细拆解 (长夜班 / 全勤 / 自定义补贴)
  nightShiftDays?: number; // 长夜班天数
  nightShiftRate?: number; // 长夜班每日补贴标准 (元/天)
  nightShiftPay?: number; // 长夜班补贴金额 (天数 × 单价)
  fullAttendancePay?: number; // 全勤补贴
  baseAllowance?: number; // 基础常规津贴(餐饮/交通等)
  customAllowances?: SalaryCustomItem[]; // 其它可自定义补贴

  // 个人承担五险一金
  pensionPersonal: number; // 养老 8%
  medicalPersonal: number; // 医疗 2% (+大病)
  unemploymentPersonal: number; // 失业 0.5%
  housingFundPersonal: number; // 公积金 5%~12%
  totalPersonalInsurance: number; // 个人五险一金合计

  // 扣除项扩展 (五险一金自定义与其它扣除项)
  isCustomInsurance?: boolean; // 是否启用五险一金自定义微调
  customDeductions?: SalaryCustomItem[]; // 其它自定义扣除项(企业年金/工会会费/水电宿舍/考勤扣款等)
  otherDeductionsTotal?: number; // 其它扣除项合计金额

  // 企业承担五险一金
  pensionCompany: number; // 养老 16%
  medicalCompany: number; // 医疗 8%
  unemploymentCompany: number; // 失业 0.5%
  injuryCompany: number; // 工伤 0.4%
  maternityCompany: number; // 生育 0.8%
  housingFundCompany: number; // 公积金 5%~12%
  totalCompanyInsurance: number; // 企业五险一金合计

  // 专项附加扣除与个税
  specialDeductions: number; // 专项附加扣除合计(子女/房贷/租金/赡养等)
  taxThreshold: number; // 起征点 (默认 5000)
  taxableIncome: number; // 应纳税所得额
  individualIncomeTax: number; // 个人所得税

  // 实际到手
  netSalary: number; // 税后实发金额
  companyTotalCost: number; // 企业用人总成本 = 应发 + 企业五险一金
  payDate: string; // 发放日期
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type OvertimeType = 'workday' | 'weekend' | 'holiday';
export type OvertimeSettlement = 'paid' | 'comp_time' | 'pending';

export interface OvertimeRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: OvertimeType; // workday: 1.5x, weekend: 2.0x, holiday: 3.0x
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationHours: number; // 加班工时
  multiplier: number; // 1.5 | 2.0 | 3.0
  settlementType: OvertimeSettlement; // 转加班费 / 转调休 / 待结算
  hourlyRate: number; // 计算基准时薪
  estimatedPay: number; // 预估加班费
  compTimeHoursUsed?: number; // 已消耗调休时长
  reason: string; // 加班事项/项目
  approver?: string; // 审批人/领导
  isNightShift?: boolean; // 是否是长夜班 (享受长夜班补贴)
  nightShiftSubsidy?: number; // 长夜班补贴金额 (如 50 元/天)
  notes: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export type GiftDirection = 'out' | 'in'; // 送出 (支出) / 收到 (收入)
export type GiftRelation = 'relative' | 'friend' | 'colleague' | 'leader' | 'classmate' | 'client' | 'neighbor' | 'other';
export type GiftOccasion = 'wedding' | 'baby' | 'housewarming' | 'birthday' | 'longevity' | 'funeral' | 'illness' | 'holiday' | 'education' | 'other';
export type ReturnStatus = 'pending' | 'returned' | 'none_needed';

export interface SocialGiftRecord {
  id: string;
  date: string; // YYYY-MM-DD
  direction: GiftDirection; // out (送出) / in (收到)
  personName: string; // 对方姓名
  relation: GiftRelation; // 关系
  eventType: GiftOccasion; // 事由/场合
  amount: number; // 礼金金额
  returnStatus: ReturnStatus; // 待回礼 / 已回礼 / 无需回礼
  returnAmount?: number; // 回礼金额
  location?: string; // 地点/酒店
  notes: string; // 备注/随礼详情
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

// 7. 日常生活开销、医疗健康、人情往来、教育专项与旅行支出
export type ExpenseType = 'living' | 'medical' | 'gift' | 'education' | 'travel';

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: ExpenseType; // living: 日常生活 | medical: 医疗健康 | gift: 人情往来 | education: 教育专项 | travel: 旅行度假
  category: string; // 细分分类
  amount: number; // 交易金额 (支出或收礼收入)
  direction?: 'out' | 'in'; // 资金往来方向：'out' (支出/随礼送出，默认) | 'in' (收入/收受礼金)
  payer?: string; // 支出人/收款人: 本人 / 配偶 / 家庭共同
  paymentMethod?: string; // 微信支付 / 支付宝 / 银行卡 / 现金
  beneficiary?: string; // 受益对象 / 患者姓名 / 关系人 / 随礼对象 / 旅行目的地
  remarks: string; // 明细备注
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export type VehicleFuelType = 'gasoline_92' | 'gasoline_95' | 'gasoline_98' | 'diesel' | 'electric' | 'hybrid';

export interface VehicleProfile {
  id: string;
  name: string; // 车辆名称 e.g. "卡罗拉 1.2T" / "Model Y"
  plateNumber: string; // 车牌号
  fuelType: VehicleFuelType;
  tankCapacity: number; // 油箱容积 L 或 电池 kWh
  initialOdometer: number; // 初始里程
  currentOdometer: number; // 当前最新里程
  maintenanceIntervalKm: number; // 推荐保养间隔里程 (km)
  maintenanceIntervalDays: number; // 推荐保养间隔天数 (天)
  lastMaintenanceDate?: string;
  lastMaintenanceOdometer?: number;
  insuranceExpiryDate?: string; // 保险到期日
  annualInspectionDate?: string; // 年检到期日
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  date: string; // YYYY-MM-DD
  odometer: number; // 加油时里程表读数 (km)
  fuelAmount: number; // 加油升数 (L) 或 充入电量 (kWh)
  unitPrice: number; // 单价 (元/L 或 元/kWh)
  totalCost: number; // 实付总金额
  isFullTank: boolean; // 是否加满 / 充满 (跳枪/100%满电)
  isWarningLightOn?: boolean; // 加油前是否已亮灯 / 低电报警 (油表黄灯/低电提示)
  isMissedPrevious?: boolean; // 是否遗漏了上一次补能记录 (漏记保护，防止能耗异常)
  station: string; // 加油站 / 充电站品牌
  fuelType: string;
  calculatedFuelEconomy?: number; // 百公里油耗 (L/100km 或 kWh/100km)
  costPerKm?: number; // 每公里花费 (元/km)
  tripDistance?: number; // 距上一次加油行驶里程 (km)
  notes: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export type MaintenanceCategory =
  | 'routine' // 常规小保养 (机油机滤)
  | 'major' // 大保养 (全车油水/火花塞)
  | 'brake' // 刹车系统 (刹车油/片/盘)
  | 'tyre' // 轮胎更换/动平衡/补胎
  | 'battery' // 蓄电池/小电池更换
  | 'air_filter' // 空调滤芯/空气滤芯
  | 'inspection' // 车辆年检
  | 'insurance' // 车险续保
  | 'paint_body' // 钣金喷漆/凹陷修复
  | 'washing' // 精致洗车/打蜡/镀膜
  | 'repair' // 故障机械维修
  | 'other'; // 其他项目

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string; // YYYY-MM-DD
  odometer: number; // 保养里程
  category: MaintenanceCategory;
  title: string; // 项目名称
  items: string[]; // 更换配件/服务细项
  shopName: string; // 维修保养门店 (4S店/途虎/汽修厂)
  partsCost: number; // 材料配件费
  laborCost: number; // 工时费
  totalCost: number; // 总费用
  nextServiceOdometer?: number; // 下次保养建议里程
  nextServiceDate?: string; // 下次保养建议日期
  notes: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface FiveInsuranceRates {
  // 基数上下限
  baseSalaryFloor: number;
  baseSalaryCap: number;
  // 个人费率 %
  pensionPersonalRate: number; // 8%
  medicalPersonalRate: number; // 2%
  medicalPersonalExtra: number; // 大病/互助固定金额 如 3元
  unemploymentPersonalRate: number; // 0.5%
  housingFundPersonalRate: number; // 12%
  // 公司费率 %
  pensionCompanyRate: number; // 16%
  medicalCompanyRate: number; // 8%
  unemploymentCompanyRate: number; // 0.5%
  injuryCompanyRate: number; // 0.4%
  maternityCompanyRate: number; // 0.8%
  housingFundCompanyRate: number; // 12%
  // 专项附加扣除默认值
  defaultSpecialDeduction: number;
}

export interface CloudflareD1Config {
  workerUrl: string; // e.g. https://my-ledger-api.workers.dev
  apiToken: string;
  databaseName: string;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncMode: 'local_only' | 'cloudflare_d1';
  autoSync: boolean; // 用户操作后自动推送同步
  autoSyncDelaySeconds?: number; // 操作后延迟推送秒数，例如 5, 15, 30, 60, 300
  errorMessage?: string;
}

export interface OneDriveConfig {
  clientId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  userAccountEmail?: string;
  userName?: string;
  backupFolder: string; // 默认 'QiyueLedger'
  autoBackup: boolean;
  backupIntervalHours: number; // 6 | 12 | 24 | 168
  lastBackupTime: string | null;
  lastBackupRevision?: number;
  backupStatus: 'idle' | 'backing_up' | 'success' | 'error';
  errorMessage?: string;
  maxRetentionCount: number; // 历史保留份数，默认 20
}

export interface SyncMeta {
  id: string; // 'global'
  revision: number;
  schemaVersion: number;
  lastSyncedAt: string | null;
  updatedAt: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  currencySymbol: string;
  isPinLockEnabled: boolean;
  pinHash: string;
  passwordSalt?: string; // PBKDF2 随机盐
  isTwoFactorEnabled?: boolean; // 是否启用双重验证 (2FA / TOTP)
  twoFactorSecret?: string; // 2FA Base32 密钥
  twoFactorBackupCodes?: string[]; // 2FA 备用应急恢复码
  isBiometricEnabled?: boolean; // 是否启用生物识别解锁 (WebAuthn / Touch ID / Face ID)
  biometricCredentialId?: string; // 生物识别凭据 ID
  biometricDeviceName?: string; // 绑定的生物识别设备名称
  autoLockMinutes: number;
  privacyMaskNumbers: boolean; // 是否一键隐藏数字 (防偷看模式)
  activeVehicleId: string;
  insuranceRates: FiveInsuranceRates;
  d1Config: CloudflareD1Config;
  oneDriveConfig?: OneDriveConfig;
}

export interface LedgerFullData {
  salaries: SalaryRecord[];
  overtimes: OvertimeRecord[];
  expenses: ExpenseRecord[]; // 日常生活开销与教育支出
  gifts: SocialGiftRecord[];
  vehicles: VehicleProfile[];
  fuels: FuelRecord[];
  maintenances: MaintenanceRecord[];
  settings: AppSettings;
  syncMeta?: SyncMeta;
  version: string;
  exportedAt: string;
}

export interface VersionedBackupData {
  format: 'qiyue-ledger';
  version: number;
  exportedAt: string;
  appVersion: string;
  data: {
    salaries: SalaryRecord[];
    overtimes: OvertimeRecord[];
    expenses: ExpenseRecord[];
    gifts: SocialGiftRecord[];
    vehicles: VehicleProfile[];
    fuels: FuelRecord[];
    maintenances: MaintenanceRecord[];
    settings: AppSettings;
    syncMeta?: SyncMeta;
  };
}
