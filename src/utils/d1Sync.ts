import { FuelRecord, LedgerFullData } from '../types';
import { sanitizeSettingsForExport } from './exportImport';
import { processFuelRecords } from './fuelCalculator';

export const CLOUDFLARE_D1_SCHEMA_SQL = `-- ==========================================
-- 栖月账本 (Qiyue Ledger) Cloudflare D1 生产 Schema
-- SQLite Dialect for Cloudflare D1 Database
-- ==========================================

-- 1. 工资与五险一金明细表
CREATE TABLE IF NOT EXISTS salaries (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,                -- YYYY-MM
    company_name TEXT,
    base_salary REAL DEFAULT 0,         -- 基本工资
    performance_pay REAL DEFAULT 0,     -- 绩效/奖金
    overtime_pay REAL DEFAULT 0,        -- 加班费
    allowance REAL DEFAULT 0,           -- 津补贴
    other_bonus REAL DEFAULT 0,         -- 其他奖金
    pre_tax_deduction REAL DEFAULT 0,   -- 税前扣减
    gross_salary REAL DEFAULT 0,        -- 应发合计
    
    -- 加班明细拆解 (1.5x / 2.0x / 3.0x)
    overtime_15_hours REAL DEFAULT 0,
    overtime_15_pay REAL DEFAULT 0,
    overtime_20_hours REAL DEFAULT 0,
    overtime_20_pay REAL DEFAULT 0,
    overtime_30_hours REAL DEFAULT 0,
    overtime_30_pay REAL DEFAULT 0,
    
    -- 补贴明细拆解 (长夜班 / 全勤 / 自定义补贴)
    night_shift_days REAL DEFAULT 0,
    night_shift_rate REAL DEFAULT 0,
    night_shift_pay REAL DEFAULT 0,
    full_attendance_pay REAL DEFAULT 0,
    base_allowance REAL DEFAULT 0,
    custom_allowances_json TEXT,        -- 自定义补贴 JSON
    
    -- 个人五险一金
    pension_personal REAL DEFAULT 0,    -- 养老保险(个人)
    medical_personal REAL DEFAULT 0,    -- 医疗保险(个人)
    unemployment_personal REAL DEFAULT 0, -- 失业保险(个人)
    housing_fund_personal REAL DEFAULT 0, -- 住房公积金(个人)
    total_personal_insurance REAL DEFAULT 0,
    
    -- 扣除项扩展 (五险一金微调与其它扣除)
    is_custom_insurance INTEGER DEFAULT 0,
    custom_deductions_json TEXT,        -- 其它自定义扣除项 JSON
    other_deductions_total REAL DEFAULT 0,
    
    -- 企业五险一金
    pension_company REAL DEFAULT 0,     -- 养老保险(企业)
    medical_company REAL DEFAULT 0,     -- 医疗保险(企业)
    unemployment_company REAL DEFAULT 0,-- 失业保险(企业)
    injury_company REAL DEFAULT 0,      -- 工伤保险(企业)
    maternity_company REAL DEFAULT 0,   -- 生育保险(企业)
    housing_fund_company REAL DEFAULT 0,-- 住房公积金(企业)
    total_company_insurance REAL DEFAULT 0,
    
    -- 专项附加扣除与个税
    special_deductions REAL DEFAULT 0,  -- 专项附加扣除
    tax_threshold REAL DEFAULT 5000,    -- 起征点
    taxable_income REAL DEFAULT 0,      -- 应纳税所得额
    individual_income_tax REAL DEFAULT 0, -- 代扣个税
    
    -- 实际到手
    net_salary REAL DEFAULT 0,          -- 税后实发
    company_total_cost REAL DEFAULT 0,  -- 用人总成本
    pay_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

-- 2. 加班工时与调休表
CREATE TABLE IF NOT EXISTS overtimes (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    type TEXT NOT NULL,                 -- workday / weekend / holiday
    start_time TEXT,
    end_time TEXT,
    duration_hours REAL NOT NULL,       -- 加班时长(小时)
    multiplier REAL DEFAULT 1.5,        -- 1.5 / 2.0 / 3.0
    settlement_type TEXT NOT NULL,      -- paid / comp_time / pending
    hourly_rate REAL DEFAULT 0,         -- 基准时薪
    estimated_pay REAL DEFAULT 0,       -- 预估加班费
    comp_time_hours_used REAL DEFAULT 0,-- 已调休时长
    reason TEXT,                        -- 事由/项目
    approver TEXT,
    is_night_shift INTEGER DEFAULT 0,   -- 1:长夜班, 0:常规
    night_shift_subsidy REAL DEFAULT 0, -- 长夜班每日补贴标准
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

-- 3. 人情往来与礼金随礼表
CREATE TABLE IF NOT EXISTS social_gifts (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    direction TEXT NOT NULL,            -- out(送出) / in(收到)
    person_name TEXT NOT NULL,          -- 对象姓名
    relation TEXT NOT NULL,             -- relative/friend/colleague/etc
    event_type TEXT NOT NULL,           -- wedding/baby/housewarming/etc
    amount REAL NOT NULL,               -- 金额
    return_status TEXT NOT NULL,        -- pending / returned / none_needed
    return_amount REAL DEFAULT 0,       -- 回礼金额
    location TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

-- 4. 车辆档案表
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                 -- 车辆名称
    plate_number TEXT,                  -- 车牌
    fuel_type TEXT NOT NULL,            -- gasoline_92/95/98/electric/etc
    tank_capacity REAL DEFAULT 50,
    initial_odometer REAL DEFAULT 0,
    current_odometer REAL DEFAULT 0,
    maintenance_interval_km REAL DEFAULT 10000,
    maintenance_interval_days INTEGER DEFAULT 180,
    last_maintenance_date TEXT,
    last_maintenance_odometer REAL,
    insurance_expiry_date TEXT,
    annual_inspection_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

-- 5. 加油与充电记录表
CREATE TABLE IF NOT EXISTS fuel_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    odometer REAL NOT NULL,             -- 里程表读数
    fuel_amount REAL NOT NULL,          -- 加油升数 / 充电度数
    unit_price REAL NOT NULL,           -- 单价
    total_cost REAL NOT NULL,           -- 总金额
    is_full_tank INTEGER DEFAULT 1,     -- 1:加满, 0:未加满
    is_warning_light_on INTEGER DEFAULT 0, -- 1:亮灯报警, 0:正常
    is_missed_previous INTEGER DEFAULT 0,  -- 1:漏记, 0:正常
    station TEXT,
    fuel_type TEXT,
    calculated_fuel_economy REAL,       -- 百公里油耗
    cost_per_km REAL,                   -- 每公里成本
    trip_distance REAL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 6. 汽车保养与维修记录表
CREATE TABLE IF NOT EXISTS maintenance_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    odometer REAL NOT NULL,             -- 保养时里程
    category TEXT NOT NULL,             -- routine/major/brake/repair/etc
    title TEXT NOT NULL,                -- 保养项目
    items_json TEXT,                    -- 配件明细 JSON 字符串
    shop_name TEXT,                     -- 汽修门店/4S店
    parts_cost REAL DEFAULT 0,          -- 材料配件费
    labor_cost REAL DEFAULT 0,          -- 工时费
    total_cost REAL NOT NULL,           -- 总计费用
    next_service_odometer REAL,         -- 建议下次保养里程
    next_service_date TEXT,             -- 建议下次保养日期
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 7. 日常生活开销与教育支出表
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    type TEXT NOT NULL,                 -- living (日常生活) / medical / gift / education / travel
    category TEXT NOT NULL,             -- 餐饮美食/居家物业/门诊就医/课外培优等
    amount REAL NOT NULL,               -- 支出金额
    payer TEXT,                         -- 出资人
    payment_method TEXT,                -- 支付渠道
    beneficiary TEXT,                   -- 受益对象
    remarks TEXT,                       -- 备注说明
    direction TEXT DEFAULT 'out',       -- out / in (人情往来扩展)
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT
);

-- 8. 用户隐私与偏好配置表
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 9. 边缘同步元信息表 (sync_meta)
CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,               -- 'global'
    revision INTEGER DEFAULT 1,         -- 数据版本号
    schema_version INTEGER DEFAULT 2,   -- D1 结构版本
    last_synced_at TEXT,
    updated_at TEXT NOT NULL
);

-- 10. 生产操作审计日志表 (audit_logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    record_count INTEGER DEFAULT 0,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
);

-- 索引与复合索引加速
CREATE INDEX IF NOT EXISTS idx_salaries_month_del ON salaries(month, deleted_at);
CREATE INDEX IF NOT EXISTS idx_salaries_updated ON salaries(updated_at);

CREATE INDEX IF NOT EXISTS idx_overtimes_date_del ON overtimes(date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_overtimes_updated ON overtimes(updated_at);

CREATE INDEX IF NOT EXISTS idx_social_gifts_date_del ON social_gifts(date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_social_gifts_updated ON social_gifts(updated_at);

CREATE INDEX IF NOT EXISTS idx_fuel_veh_date_del ON fuel_records(vehicle_id, date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_fuel_updated ON fuel_records(updated_at);

CREATE INDEX IF NOT EXISTS idx_maint_veh_date_del ON maintenance_records(vehicle_id, date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_maint_updated ON maintenance_records(updated_at);

CREATE INDEX IF NOT EXISTS idx_expenses_date_del ON expenses(date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 默认全局元数据记录
INSERT OR IGNORE INTO sync_meta (key, revision, schema_version, last_synced_at, updated_at)
VALUES ('global', 1, 2, NULL, datetime('now'));
`;

/**
 * 安全校验并格式化 Cloudflare Worker API 地址
 */
export function sanitizeWorkerUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    throw new Error('Cloudflare Worker URL 不能为空');
  }

  // 严格协议安全性校验 (仅允许 http:// 或 https://)
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('URL 必须以 https:// 或 http:// 开头');
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) {
      throw new Error('URL 域名格式无效');
    }
    return trimmed.replace(/\/+$/, '');
  } catch {
    throw new Error('无效的 URL 地址格式');
  }
}

/**
 * 带超时保护与指数退避重试的 fetch 封装
 */
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12000,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 如果是 502 / 503 / 504 / 429 且仍有重试机会，则等待后重试
      if ([502, 503, 504, 429].includes(response.status) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') {
        lastError = new Error(`网络请求超时 (${Math.round(timeoutMs / 1000)}秒)，请检查 Cloudflare Worker 服务连通性`);
      } else if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
        const originStr = typeof window !== 'undefined' ? window.location.origin : '';
        lastError = new Error(
          `网络连接或跨域受阻 (Failed to fetch)。请排查：\n1. 跨域策略 (CORS)：请检查 Cloudflare Worker 的 ALLOWED_ORIGIN 变量是否已包含当前前端域名 (${originStr})；\n2. Worker 服务地址是否准确、已发布上线并支持 HTTPS；\n3. 若在本地调试请确保端口匹配。`
        );
      } else {
        lastError = new Error(err?.message || '网络连接失败');
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('网络请求重试失败');
}

/**
 * 生产级健康检查接口探测 (带真实延迟与网络容错)
 */
export async function checkCloudflareHealth(workerUrl: string): Promise<{
  ok: boolean;
  status: string;
  database: string;
  schemaVersion?: number;
  revision?: number;
  latencyMs?: number;
  message?: string;
}> {
  const startTime = performance.now();
  let cleanUrl = '';
  try {
    cleanUrl = sanitizeWorkerUrl(workerUrl);
  } catch (err: any) {
    return {
      ok: false,
      status: 'INVALID_URL',
      database: 'disconnected',
      message: err.message,
    };
  }

  const targetUrl = `${cleanUrl}/api/health`;

  try {
    const res = await fetchWithTimeoutAndRetry(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }, 8000, 1);

    const latencyMs = Math.round(performance.now() - startTime);
    const json = await res.json().catch(() => null);

    if (res.ok && json?.success) {
      return {
        ok: true,
        status: json.data?.status || 'healthy',
        database: json.data?.database || 'connected',
        schemaVersion: json.data?.schemaVersion,
        revision: json.data?.revision,
        latencyMs,
      };
    } else {
      return {
        ok: false,
        status: json?.error?.code || 'ERROR',
        database: 'disconnected',
        latencyMs,
        message: json?.error?.message || `HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      status: 'UNREACHABLE',
      database: 'unknown',
      latencyMs,
      message: err.message || '网络无法连接到 Worker 节点',
    };
  }
}

export class SyncConflictError extends Error {
  code = 'VERSION_CONFLICT';
  serverRevision?: number;
  expectedRevision?: number;
  lastSyncedAt?: string | null;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'SyncConflictError';
    if (details) {
      this.serverRevision = details.serverRevision;
      this.expectedRevision = details.expectedRevision;
      this.lastSyncedAt = details.lastSyncedAt;
    }
  }
}

export interface D1DatabaseStatusResult {
  ok: boolean;
  status: string;
  database: string;
  migrationReady: boolean;
  currentRevision: number;
  schemaVersion: number;
  lastSyncedAt: string | null;
  tablesCount: number;
  tables: string[];
  message: string;
}

/**
 * 宽松安全的布尔值解析器 (兼容 SQLite 0/1, 字符串 "0"/"1"/"true"/"false", 真实布尔及空缺处理)
 */
export function toBoolean(val: any, defaultVal = false): boolean {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
    if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  }
  return Boolean(val);
}

/**
 * 远程探测 D1 数据库迁移及表结构只读状态 (不执行动态 DDL)
 */
export async function inspectCloudflareD1Database(
  workerUrl: string,
  apiToken: string
): Promise<D1DatabaseStatusResult> {
  const cleanUrl = sanitizeWorkerUrl(workerUrl);
  const targetUrl = `${cleanUrl}/api/schema/status`;

  const headers: Record<string, string> = {
    'X-Client-Version': '2.3.0',
  };
  if (apiToken && apiToken.trim()) {
    headers['Authorization'] = `Bearer ${apiToken.trim()}`;
  }

  const res = await fetchWithTimeoutAndRetry(targetUrl, {
    method: 'GET',
    headers,
  }, 12000, 1);

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const errorMsg = json?.error?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const data = json.data || {};
  return {
    ok: true,
    status: data.migrationReady ? 'healthy' : 'pending_migration',
    database: data.database || 'connected',
    migrationReady: Boolean(data.migrationReady),
    currentRevision: data.currentRevision ?? 1,
    schemaVersion: data.schemaVersion ?? 2,
    lastSyncedAt: data.lastSyncedAt ?? null,
    tablesCount: data.tablesCount ?? (data.tables || []).length,
    tables: data.tables || [],
    message: data.migrationReady
      ? `D1 数据库结构就绪：共核查到 ${data.tablesCount ?? 10} 张业务表，当前版本 r${data.currentRevision ?? 1}`
      : 'D1 数据库已连接，但尚未运行迁移。可点击【初始化表结构】或在终端执行 wrangler d1 migrations apply。',
  };
}

/**
 * 显式远程一键初始化 D1 数据库表结构与索引 (POST /api/schema/init)
 */
export async function initializeCloudflareD1Database(
  workerUrl: string,
  apiToken: string
): Promise<{ ok: boolean; message: string; tablesCount?: number }> {
  const cleanUrl = sanitizeWorkerUrl(workerUrl);
  const targetUrl = `${cleanUrl}/api/schema/init`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Version': '2.3.0',
  };
  if (apiToken && apiToken.trim()) {
    headers['Authorization'] = `Bearer ${apiToken.trim()}`;
  }

  const res = await fetchWithTimeoutAndRetry(targetUrl, {
    method: 'POST',
    headers,
  }, 15000, 1);

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const errorMsg = json?.error?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  return {
    ok: true,
    message: json?.data?.message || 'D1 数据库 10 张核心业务表与索引已初始化就绪！',
    tablesCount: json?.data?.tablesCount ?? 10,
  };
}

/**
 * 客户端与云端双向智能合并算法 (基于 updatedAt 时间戳的 Last-Write-Wins 乐观并发解决，并智能保全本地关键标记)
 */
export function mergeLedgerDatasets(
  local: LedgerFullData,
  remote: Partial<LedgerFullData>
): LedgerFullData {
  const mergeEntities = <T extends { id: string; updatedAt?: string; createdAt?: string }>(
    localList: T[] = [],
    remoteList: T[] = []
  ): T[] => {
    const localMap = new Map(localList.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const result: T[] = [];

    for (const remoteItem of remoteList) {
      seen.add(remoteItem.id);
      const localItem = localMap.get(remoteItem.id);
      if (!localItem) {
        result.push(remoteItem);
      } else {
        const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
        const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();
        result.push(localTime >= remoteTime ? { ...remoteItem, ...localItem } : { ...localItem, ...remoteItem });
      }
    }

    for (const localItem of localList) {
      if (!seen.has(localItem.id)) {
        result.push(localItem);
      }
    }

    return result;
  };

  // 1. 合并 Fuels：优先保全本地真实的黄灯报警与漏记标志
  const localFuelMap = new Map((local.fuels || []).map((f) => [f.id, f]));
  const seenFuelIds = new Set<string>();
  const mergedFuels: FuelRecord[] = ((remote.fuels || []) as FuelRecord[]).map((rf) => {
    seenFuelIds.add(rf.id);
    const lf = localFuelMap.get(rf.id);
    if (lf) {
      const localTime = new Date(lf.updatedAt || lf.createdAt || 0).getTime();
      const remoteTime = new Date(rf.updatedAt || rf.createdAt || 0).getTime();
      const base = localTime >= remoteTime ? { ...rf, ...lf } : { ...lf, ...rf };
      return {
        ...base,
        isWarningLightOn: Boolean(base.isWarningLightOn || lf.isWarningLightOn),
        isMissedPrevious: Boolean(base.isMissedPrevious || lf.isMissedPrevious),
        isFullTank: base.isFullTank !== undefined ? base.isFullTank : (lf.isFullTank ?? true),
      };
    }
    return rf;
  });
  for (const lf of local.fuels || []) {
    if (!seenFuelIds.has(lf.id)) {
      mergedFuels.push(lf);
    }
  }
  const processedFuels = processFuelRecords(mergedFuels);

  // 2. 合并 Expenses：保全 direction (资金流向)
  const localExpMap = new Map((local.expenses || []).map((e) => [e.id, e]));
  const seenExpIds = new Set<string>();
  const mergedExpenses = ((remote.expenses || []) as any[]).map((re) => {
    seenExpIds.add(re.id);
    const le = localExpMap.get(re.id);
    if (le) {
      const localTime = new Date(le.updatedAt || le.createdAt || 0).getTime();
      const remoteTime = new Date(re.updatedAt || re.createdAt || 0).getTime();
      const base = localTime >= remoteTime ? { ...re, ...le } : { ...le, ...re };
      return {
        ...base,
        direction: base.direction || le.direction || 'out',
      };
    }
    return re;
  });
  for (const le of local.expenses || []) {
    if (!seenExpIds.has(le.id)) {
      mergedExpenses.push(le);
    }
  }

  // 3. 合并 Vehicles
  const localVehMap = new Map((local.vehicles || []).map((v) => [v.id, v]));
  const seenVehIds = new Set<string>();
  const mergedVehicles = ((remote.vehicles || []) as any[]).map((rv) => {
    seenVehIds.add(rv.id);
    const lv = localVehMap.get(rv.id);
    if (lv) {
      const localTime = new Date(lv.updatedAt || lv.createdAt || 0).getTime();
      const remoteTime = new Date(rv.updatedAt || rv.createdAt || 0).getTime();
      const base = localTime >= remoteTime ? { ...rv, ...lv } : { ...lv, ...rv };
      return {
        ...base,
        currentOdometer: Math.max(base.currentOdometer || 0, lv.currentOdometer || 0, rv.currentOdometer || 0),
      };
    }
    return rv;
  });
  for (const lv of local.vehicles || []) {
    if (!seenVehIds.has(lv.id)) {
      mergedVehicles.push(lv);
    }
  }

  // 4. 通用实体合并 (Salaries, Overtimes, Gifts, Maintenances)
  const mergedSalaries = mergeEntities(local.salaries || [], remote.salaries || []);
  const mergedOvertimes = mergeEntities(local.overtimes || [], remote.overtimes || []);
  const mergedGifts = mergeEntities(local.gifts || [], remote.gifts || []);
  const mergedMaintenances = mergeEntities(local.maintenances || [], remote.maintenances || []);

  const mergedSettings = {
    ...local.settings,
    ...(remote.settings || {}),
    // 保护本地敏感配置不被云端空值覆盖
    d1Config: {
      ...local.settings.d1Config,
      ...(remote.settings?.d1Config || {}),
      workerUrl: local.settings.d1Config.workerUrl || remote.settings?.d1Config?.workerUrl || '',
      apiToken: local.settings.d1Config.apiToken || remote.settings?.d1Config?.apiToken || '',
    },
  };

  return {
    ...local,
    salaries: mergedSalaries,
    overtimes: mergedOvertimes,
    expenses: mergedExpenses,
    gifts: mergedGifts,
    vehicles: mergedVehicles,
    fuels: processedFuels,
    maintenances: mergedMaintenances,
    settings: mergedSettings,
    syncMeta: remote.syncMeta || local.syncMeta,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * SQLite 字段参数安全转义 (防注入、控制字符清洗与类型安全)
 */
function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return '0';
    return String(val);
  }
  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }

  // 清洗空字节 \0 及危险二进制控制字符，并将单引号转义为 ''
  const str = String(val)
    .replace(/\0/g, '')
    .replace(/'/g, "''");

  return `'${str}'`;
}

/**
 * 将前端完整数据生成 Cloudflare D1 SQLite 离线导入脚本 (.sql)
 */
export function generateCloudflareD1SqlDump(data: LedgerFullData): string {
  const lines: string[] = [
    '-- ========================================================',
    '-- 栖月账本 (Qiyue Ledger) Cloudflare D1 SQL Data Dump',
    `-- Exported At: ${new Date().toISOString()}`,
    '-- Command: wrangler d1 execute <YOUR_DB_NAME> --file=./backup.sql',
    '-- ========================================================',
    '',
    CLOUDFLARE_D1_SCHEMA_SQL,
    '',
    '-- BEGIN DATA TRANSACTION',
    'BEGIN TRANSACTION;',
    '',
  ];

  const esc = escapeSqlValue;

  // 1. Salaries
  for (const s of data.salaries) {
    const customAllowancesJson = Array.isArray(s.customAllowances) ? JSON.stringify(s.customAllowances) : null;
    const customDeductionsJson = Array.isArray(s.customDeductions) ? JSON.stringify(s.customDeductions) : null;

    lines.push(
      `INSERT OR REPLACE INTO salaries (
        id, month, company_name, base_salary, performance_pay, overtime_pay, allowance, other_bonus,
        pre_tax_deduction, gross_salary,
        overtime_15_hours, overtime_15_pay, overtime_20_hours, overtime_20_pay, overtime_30_hours, overtime_30_pay,
        night_shift_days, night_shift_rate, night_shift_pay, full_attendance_pay, base_allowance, custom_allowances_json,
        pension_personal, medical_personal, unemployment_personal,
        housing_fund_personal, total_personal_insurance,
        is_custom_insurance, custom_deductions_json, other_deductions_total,
        pension_company, medical_company, unemployment_company,
        injury_company, maternity_company, housing_fund_company, total_company_insurance, special_deductions,
        tax_threshold, taxable_income, individual_income_tax, net_salary, company_total_cost, pay_date, notes,
        created_at, updated_at, deleted_at
      ) VALUES (${esc(s.id)}, ${esc(s.month)}, ${esc(s.companyName)}, ${esc(s.baseSalary)}, ${esc(s.performancePay)}, ${esc(s.overtimePay)}, ${esc(s.allowance)}, ${esc(s.otherBonus)}, ${esc(s.preTaxDeduction)}, ${esc(s.grossSalary)}, ${esc(s.overtime15Hours || 0)}, ${esc(s.overtime15Pay || 0)}, ${esc(s.overtime20Hours || 0)}, ${esc(s.overtime20Pay || 0)}, ${esc(s.overtime30Hours || 0)}, ${esc(s.overtime30Pay || 0)}, ${esc(s.nightShiftDays || 0)}, ${esc(s.nightShiftRate || 0)}, ${esc(s.nightShiftPay || 0)}, ${esc(s.fullAttendancePay || 0)}, ${esc(s.baseAllowance || 0)}, ${esc(customAllowancesJson)}, ${esc(s.pensionPersonal)}, ${esc(s.medicalPersonal)}, ${esc(s.unemploymentPersonal)}, ${esc(s.housingFundPersonal)}, ${esc(s.totalPersonalInsurance)}, ${s.isCustomInsurance ? 1 : 0}, ${esc(customDeductionsJson)}, ${esc(s.otherDeductionsTotal || 0)}, ${esc(s.pensionCompany)}, ${esc(s.medicalCompany)}, ${esc(s.unemploymentCompany)}, ${esc(s.injuryCompany)}, ${esc(s.maternityCompany)}, ${esc(s.housingFundCompany)}, ${esc(s.totalCompanyInsurance)}, ${esc(s.specialDeductions)}, ${esc(s.taxThreshold)}, ${esc(s.taxableIncome)}, ${esc(s.individualIncomeTax)}, ${esc(s.netSalary)}, ${esc(s.companyTotalCost)}, ${esc(s.payDate)}, ${esc(s.notes)}, ${esc(s.createdAt)}, ${esc(s.updatedAt || s.createdAt)}, ${esc(s.deletedAt || null)});`
    );
  }

  // 2. Overtimes
  for (const o of data.overtimes) {
    lines.push(
      `INSERT OR REPLACE INTO overtimes (
        id, date, type, start_time, end_time, duration_hours, multiplier, settlement_type,
        hourly_rate, estimated_pay, comp_time_hours_used, reason, approver,
        is_night_shift, night_shift_subsidy, notes,
        created_at, updated_at, deleted_at
      ) VALUES (${esc(o.id)}, ${esc(o.date)}, ${esc(o.type)}, ${esc(o.startTime)}, ${esc(o.endTime)}, ${esc(o.durationHours)}, ${esc(o.multiplier)}, ${esc(o.settlementType)}, ${esc(o.hourlyRate)}, ${esc(o.estimatedPay)}, ${esc(o.compTimeHoursUsed || 0)}, ${esc(o.reason)}, ${esc(o.approver || '')}, ${o.isNightShift ? 1 : 0}, ${esc(o.nightShiftSubsidy || 0)}, ${esc(o.notes || '')}, ${esc(o.createdAt)}, ${esc(o.updatedAt || o.createdAt)}, ${esc(o.deletedAt || null)});`
    );
  }

  // 3. Gifts
  for (const g of data.gifts) {
    lines.push(
      `INSERT OR REPLACE INTO social_gifts (
        id, date, direction, person_name, relation, event_type, amount,
        return_status, return_amount, location, notes, created_at, updated_at, deleted_at
      ) VALUES (${esc(g.id)}, ${esc(g.date)}, ${esc(g.direction)}, ${esc(g.personName)}, ${esc(g.relation)}, ${esc(g.eventType)}, ${esc(g.amount)}, ${esc(g.returnStatus)}, ${esc(g.returnAmount || 0)}, ${esc(g.location || '')}, ${esc(g.notes || '')}, ${esc(g.createdAt)}, ${esc(g.updatedAt || g.createdAt)}, ${esc(g.deletedAt || null)});`
    );
  }

  // 4. Vehicles
  for (const v of data.vehicles) {
    lines.push(
      `INSERT OR REPLACE INTO vehicles (
        id, name, plate_number, fuel_type, tank_capacity, initial_odometer, current_odometer,
        maintenance_interval_km, maintenance_interval_days, last_maintenance_date,
        last_maintenance_odometer, insurance_expiry_date, annual_inspection_date,
        created_at, updated_at, deleted_at
      ) VALUES (${esc(v.id)}, ${esc(v.name)}, ${esc(v.plateNumber || '')}, ${esc(v.fuelType)}, ${esc(v.tankCapacity || 50)}, ${esc(v.initialOdometer || 0)}, ${esc(v.currentOdometer || 0)}, ${esc(v.maintenanceIntervalKm || 10000)}, ${esc(v.maintenanceIntervalDays || 180)}, ${esc(v.lastMaintenanceDate || '')}, ${esc(v.lastMaintenanceOdometer || 0)}, ${esc(v.insuranceExpiryDate || '')}, ${esc(v.annualInspectionDate || '')}, ${esc(v.createdAt)}, ${esc(v.updatedAt || v.createdAt)}, ${esc(v.deletedAt || null)});`
    );
  }

  // 5. Fuels
  for (const f of data.fuels) {
    lines.push(
      `INSERT OR REPLACE INTO fuel_records (
        id, vehicle_id, date, odometer, fuel_amount, unit_price, total_cost,
        is_full_tank, is_warning_light_on, is_missed_previous, station, fuel_type,
        calculated_fuel_economy, cost_per_km, trip_distance, notes,
        created_at, updated_at, deleted_at
      ) VALUES (${esc(f.id)}, ${esc(f.vehicleId)}, ${esc(f.date)}, ${esc(f.odometer)}, ${esc(f.fuelAmount)}, ${esc(f.unitPrice)}, ${esc(f.totalCost)}, ${f.isFullTank ? 1 : 0}, ${f.isWarningLightOn ? 1 : 0}, ${f.isMissedPrevious ? 1 : 0}, ${esc(f.station || '')}, ${esc(f.fuelType || '')}, ${esc(f.calculatedFuelEconomy)}, ${esc(f.costPerKm)}, ${esc(f.tripDistance)}, ${esc(f.notes || '')}, ${esc(f.createdAt)}, ${esc(f.updatedAt || f.createdAt)}, ${esc(f.deletedAt || null)});`
    );
  }

  // 6. Maintenances
  for (const m of data.maintenances) {
    lines.push(
      `INSERT OR REPLACE INTO maintenance_records (
        id, vehicle_id, date, odometer, category, title, items_json, shop_name,
        parts_cost, labor_cost, total_cost, next_service_odometer, next_service_date,
        notes, created_at, updated_at, deleted_at
      ) VALUES (${esc(m.id)}, ${esc(m.vehicleId)}, ${esc(m.date)}, ${esc(m.odometer)}, ${esc(m.category)}, ${esc(m.title)}, ${esc(JSON.stringify(m.items || []))}, ${esc(m.shopName || '')}, ${esc(m.partsCost || 0)}, ${esc(m.laborCost || 0)}, ${esc(m.totalCost || 0)}, ${esc(m.nextServiceOdometer)}, ${esc(m.nextServiceDate)}, ${esc(m.notes || '')}, ${esc(m.createdAt)}, ${esc(m.updatedAt || m.createdAt)}, ${esc(m.deletedAt || null)});`
    );
  }

  // 7. Expenses (日常生活与教育支出)
  for (const exp of data.expenses || []) {
    lines.push(
      `INSERT OR REPLACE INTO expenses (
        id, date, type, category, amount, payer, payment_method, beneficiary, remarks,
        direction, created_at, updated_at, deleted_at
      ) VALUES (${esc(exp.id)}, ${esc(exp.date)}, ${esc(exp.type)}, ${esc(exp.category)}, ${esc(exp.amount)}, ${esc(exp.payer || '')}, ${esc(exp.paymentMethod || '')}, ${esc(exp.beneficiary || '')}, ${esc(exp.remarks || '')}, ${esc(exp.direction || 'out')}, ${esc(exp.createdAt)}, ${esc(exp.updatedAt || exp.createdAt)}, ${esc(exp.deletedAt || null)});`
    );
  }

  // 8. App Settings (安全脱敏：自动剥离 API Token、第三方授权 Token 及 2FA 凭据，严禁明文导出)
  if (data.settings) {
    const sanitizedSettings = sanitizeSettingsForExport(data.settings);
    lines.push(
      `INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES ('app_settings', ${esc(JSON.stringify(sanitizedSettings))}, ${esc(new Date().toISOString())});`
    );
  }

  // 9. Sync Meta
  const revision = data.syncMeta?.revision || 1;
  const schemaVersion = data.syncMeta?.schemaVersion || 2;
  lines.push(
    `INSERT OR REPLACE INTO sync_meta (key, revision, schema_version, last_synced_at, updated_at) VALUES ('global', ${revision}, ${schemaVersion}, ${esc(data.syncMeta?.lastSyncedAt || null)}, ${esc(new Date().toISOString())});`
  );

  lines.push('', 'COMMIT;', '-- D1 SQL Dump Finished.');
  return lines.join('\n');
}

/**
 * 向 Cloudflare Worker 生产端点推送同步数据 (带超时保护与重试机制)
 */
export async function syncToCloudflareWorker(
  workerUrl: string,
  apiToken: string,
  data: LedgerFullData
): Promise<{ success: boolean; data?: any }> {
  const cleanUrl = sanitizeWorkerUrl(workerUrl);
  const targetUrl = `${cleanUrl}/api/sync`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Version': '2.2.0',
  };

  if (apiToken && apiToken.trim()) {
    headers['Authorization'] = `Bearer ${apiToken.trim()}`;
  }

  const currentRevision = data.syncMeta?.revision ?? 1;

  const payload = {
    version: 2,
    expectedRevision: currentRevision,
    salaries: data.salaries || [],
    overtimes: data.overtimes || [],
    gifts: data.gifts || [],
    vehicles: data.vehicles || [],
    fuels: data.fuels || [],
    maintenances: data.maintenances || [],
    expenses: data.expenses || [],
    settings: data.settings,
    syncMeta: data.syncMeta,
  };

  const res = await fetchWithTimeoutAndRetry(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  }, 15000, 1);

  const json = await res.json().catch(() => null);

  if (res.status === 409 || json?.error?.code === 'VERSION_CONFLICT') {
    const conflictMsg = json?.error?.message || '云端存在较新版本的数据，已触发乐观并发冲突保护。';
    throw new SyncConflictError(conflictMsg, json?.error?.details);
  }

  if (!res.ok || !json?.success) {
    const errorMsg = json?.error?.message || json?.error || `HTTP ${res.status}`;
    const requestId = json?.requestId ? ` (ReqId: ${json.requestId.slice(0, 8)})` : '';
    throw new Error(`${errorMsg}${requestId}`);
  }

  return json;
}

/**
 * 从 Cloudflare Worker 拉取最新数据（支持增量 since 参数）
 */
export async function pullFromCloudflareWorker(
  workerUrl: string,
  apiToken: string,
  since?: string
): Promise<{ data: Partial<LedgerFullData>; isIncremental: boolean }> {
  const cleanUrl = sanitizeWorkerUrl(workerUrl);
  const queryParam = since ? `?since=${encodeURIComponent(since)}` : '';
  const targetUrl = `${cleanUrl}/api/sync${queryParam}`;

  const headers: Record<string, string> = {
    'X-Client-Version': '2.2.0',
  };
  if (apiToken && apiToken.trim()) {
    headers['Authorization'] = `Bearer ${apiToken.trim()}`;
  }

  const res = await fetchWithTimeoutAndRetry(targetUrl, {
    method: 'GET',
    headers,
  }, 15000, 1);

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success || !json.data) {
    const errorMsg = json?.error?.message || json?.error || `HTTP ${res.status}`;
    const requestId = json?.requestId ? ` (ReqId: ${json.requestId.slice(0, 8)})` : '';
    throw new Error(`${errorMsg}${requestId}`);
  }

  const d = json.data;
  return {
    isIncremental: Boolean(json.isIncremental),
    data: {
      salaries: (d.salaries || []).map((s: any) => ({
        id: s.id,
        month: s.month,
        companyName: s.company_name || s.companyName || '',
        baseSalary: Number(s.base_salary ?? s.baseSalary ?? 0),
        performancePay: Number(s.performance_pay ?? s.performancePay ?? 0),
        overtimePay: Number(s.overtime_pay ?? s.overtimePay ?? 0),
        allowance: Number(s.allowance ?? 0),
        otherBonus: Number(s.other_bonus ?? s.otherBonus ?? 0),
        preTaxDeduction: Number(s.pre_tax_deduction ?? s.preTaxDeduction ?? 0),
        grossSalary: Number(s.gross_salary ?? s.grossSalary ?? 0),
        overtime15Hours: Number(s.overtime_15_hours ?? s.overtime15Hours ?? 0),
        overtime15Pay: Number(s.overtime_15_pay ?? s.overtime15Pay ?? 0),
        overtime20Hours: Number(s.overtime_20_hours ?? s.overtime20Hours ?? 0),
        overtime20Pay: Number(s.overtime_20_pay ?? s.overtime20Pay ?? 0),
        overtime30Hours: Number(s.overtime_30_hours ?? s.overtime30Hours ?? 0),
        overtime30Pay: Number(s.overtime_30_pay ?? s.overtime30Pay ?? 0),
        nightShiftDays: Number(s.night_shift_days ?? s.nightShiftDays ?? 0),
        nightShiftRate: Number(s.night_shift_rate ?? s.nightShiftRate ?? 0),
        nightShiftPay: Number(s.night_shift_pay ?? s.nightShiftPay ?? 0),
        fullAttendancePay: Number(s.full_attendance_pay ?? s.fullAttendancePay ?? 0),
        baseAllowance: Number(s.base_allowance ?? s.baseAllowance ?? 0),
        customAllowances: (() => {
          if (Array.isArray(s.customAllowances)) return s.customAllowances;
          if (typeof s.custom_allowances_json === 'string') {
            try {
              return JSON.parse(s.custom_allowances_json);
            } catch {
              return [];
            }
          }
          return [];
        })(),
        pensionPersonal: Number(s.pension_personal ?? s.pensionPersonal ?? 0),
        medicalPersonal: Number(s.medical_personal ?? s.medicalPersonal ?? 0),
        unemploymentPersonal: Number(s.unemployment_personal ?? s.unemploymentPersonal ?? 0),
        housingFundPersonal: Number(s.housing_fund_personal ?? s.housingFundPersonal ?? 0),
        totalPersonalInsurance: Number(s.total_personal_insurance ?? s.totalPersonalInsurance ?? 0),
        isCustomInsurance: toBoolean(s.is_custom_insurance ?? s.isCustomInsurance, false),
        customDeductions: (() => {
          if (Array.isArray(s.customDeductions)) return s.customDeductions;
          if (typeof s.custom_deductions_json === 'string') {
            try {
              return JSON.parse(s.custom_deductions_json);
            } catch {
              return [];
            }
          }
          return [];
        })(),
        otherDeductionsTotal: Number(s.other_deductions_total ?? s.otherDeductionsTotal ?? 0),
        pensionCompany: Number(s.pension_company ?? s.pensionCompany ?? 0),
        medicalCompany: Number(s.medical_company ?? s.medicalCompany ?? 0),
        unemploymentCompany: Number(s.unemployment_company ?? s.unemploymentCompany ?? 0),
        injuryCompany: Number(s.injury_company ?? s.injuryCompany ?? 0),
        maternityCompany: Number(s.maternity_company ?? s.maternityCompany ?? 0),
        housingFundCompany: Number(s.housing_fund_company ?? s.housingFundCompany ?? 0),
        totalCompanyInsurance: Number(s.total_company_insurance ?? s.totalCompanyInsurance ?? 0),
        specialDeductions: Number(s.special_deductions ?? s.specialDeductions ?? 0),
        taxThreshold: Number(s.tax_threshold ?? s.taxThreshold ?? 5000),
        taxableIncome: Number(s.taxable_income ?? s.taxableIncome ?? 0),
        individualIncomeTax: Number(s.individual_income_tax ?? s.individualIncomeTax ?? 0),
        netSalary: Number(s.net_salary ?? s.netSalary ?? 0),
        companyTotalCost: Number(s.company_total_cost ?? s.companyTotalCost ?? 0),
        payDate: s.pay_date || s.payDate,
        notes: s.notes || '',
        createdAt: s.created_at || s.createdAt || new Date().toISOString(),
        updatedAt: s.updated_at || s.updatedAt || s.created_at || new Date().toISOString(),
        deletedAt: s.deleted_at || s.deletedAt || undefined,
      })),
      overtimes: (d.overtimes || []).map((o: any) => ({
        id: o.id,
        date: o.date,
        type: o.type || 'workday',
        startTime: o.start_time || o.startTime || '',
        endTime: o.end_time || o.endTime || '',
        durationHours: Number(o.duration_hours ?? o.durationHours ?? 0),
        multiplier: Number(o.multiplier ?? 1.5),
        settlementType: o.settlement_type || o.settlementType || 'paid',
        hourlyRate: Number(o.hourly_rate ?? o.hourlyRate ?? 0),
        estimatedPay: Number(o.estimated_pay ?? o.estimatedPay ?? 0),
        compTimeHoursUsed: Number(o.comp_time_hours_used ?? o.compTimeHoursUsed ?? 0),
        reason: o.reason || '',
        approver: o.approver || '',
        isNightShift: toBoolean(o.is_night_shift ?? o.isNightShift, false),
        nightShiftSubsidy: Number(o.night_shift_subsidy ?? o.nightShiftSubsidy ?? 0),
        notes: o.notes || '',
        createdAt: o.created_at || o.createdAt || new Date().toISOString(),
        updatedAt: o.updated_at || o.updatedAt || o.created_at || new Date().toISOString(),
        deletedAt: o.deleted_at || o.deletedAt || undefined,
      })),
      gifts: (d.gifts || []).map((g: any) => ({
        id: g.id,
        date: g.date,
        direction: g.direction || 'out',
        personName: g.person_name || g.personName || '',
        relation: g.relation || 'friend',
        eventType: g.event_type || g.eventType || 'wedding',
        amount: Number(g.amount ?? 0),
        returnStatus: g.return_status || g.returnStatus || 'pending',
        returnAmount: Number(g.return_amount ?? g.returnAmount ?? 0),
        location: g.location || '',
        notes: g.notes || '',
        createdAt: g.created_at || g.createdAt || new Date().toISOString(),
        updatedAt: g.updated_at || g.updatedAt || g.created_at || new Date().toISOString(),
        deletedAt: g.deleted_at || g.deletedAt || undefined,
      })),
      vehicles: (d.vehicles || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        plateNumber: v.plate_number || v.plateNumber || '',
        fuelType: v.fuel_type || v.fuelType || 'gasoline_92',
        tankCapacity: Number(v.tank_capacity ?? v.tankCapacity ?? 50),
        initialOdometer: Number(v.initial_odometer ?? v.initialOdometer ?? 0),
        currentOdometer: Number(v.current_odometer ?? v.currentOdometer ?? 0),
        maintenanceIntervalKm: Number(v.maintenance_interval_km ?? v.maintenanceIntervalKm ?? 10000),
        maintenanceIntervalDays: Number(v.maintenance_interval_days ?? v.maintenanceIntervalDays ?? 180),
        lastMaintenanceDate: v.last_maintenance_date || v.lastMaintenanceDate || '',
        lastMaintenanceOdometer: v.last_maintenance_odometer ?? v.lastMaintenanceOdometer,
        insuranceExpiryDate: v.insurance_expiry_date || v.insuranceExpiryDate || '',
        annualInspectionDate: v.annual_inspection_date || v.annualInspectionDate || '',
        createdAt: v.created_at || v.createdAt || new Date().toISOString(),
        updatedAt: v.updated_at || v.updatedAt || v.created_at || new Date().toISOString(),
        deletedAt: v.deleted_at || v.deletedAt || undefined,
      })),
      fuels: (d.fuels || []).map((f: any) => ({
        id: f.id,
        vehicleId: f.vehicle_id || f.vehicleId,
        date: f.date,
        odometer: Number(f.odometer ?? 0),
        fuelAmount: Number(f.fuel_amount ?? f.fuelAmount ?? 0),
        unitPrice: Number(f.unit_price ?? f.unitPrice ?? 0),
        totalCost: Number(f.total_cost ?? f.totalCost ?? 0),
        isFullTank: toBoolean(f.is_full_tank ?? f.isFullTank, true),
        isWarningLightOn: toBoolean(f.is_warning_light_on ?? f.isWarningLightOn ?? f.warning_light, false),
        isMissedPrevious: toBoolean(f.is_missed_previous ?? f.isMissedPrevious, false),
        station: f.station || '',
        fuelType: f.fuel_type || f.fuelType || '',
        calculatedFuelEconomy: f.calculated_fuel_economy ?? f.calculatedFuelEconomy,
        costPerKm: f.cost_per_km ?? f.costPerKm,
        tripDistance: f.trip_distance ?? f.tripDistance,
        notes: f.notes || '',
        createdAt: f.created_at || f.createdAt || new Date().toISOString(),
        updatedAt: f.updated_at || f.updatedAt || f.created_at || new Date().toISOString(),
        deletedAt: f.deleted_at || f.deletedAt || undefined,
      })),
      maintenances: (d.maintenances || []).map((m: any) => ({
        id: m.id,
        vehicleId: m.vehicle_id || m.vehicleId,
        date: m.date,
        odometer: Number(m.odometer ?? 0),
        category: m.category || 'routine',
        title: m.title || '',
        items: (() => {
          if (Array.isArray(m.items)) return m.items;
          if (typeof m.items_json === 'string') {
            try {
              return JSON.parse(m.items_json);
            } catch {
              return [];
            }
          }
          return [];
        })(),
        shopName: m.shop_name || m.shopName || '',
        partsCost: Number(m.parts_cost ?? m.partsCost ?? 0),
        laborCost: Number(m.labor_cost ?? m.laborCost ?? 0),
        totalCost: Number(m.total_cost ?? m.totalCost ?? 0),
        nextServiceOdometer: m.next_service_odometer ?? m.nextServiceOdometer,
        nextServiceDate: m.next_service_date || m.nextServiceDate,
        notes: m.notes || '',
        createdAt: m.created_at || m.createdAt || new Date().toISOString(),
        updatedAt: m.updated_at || m.updatedAt || m.created_at || new Date().toISOString(),
        deletedAt: m.deleted_at || m.deletedAt || undefined,
      })),
      expenses: (d.expenses || []).map((exp: any) => ({
        id: exp.id,
        date: exp.date,
        type: exp.type || 'living',
        category: exp.category || '日常开销',
        amount: Number(exp.amount ?? 0),
        payer: exp.payer || '本人',
        paymentMethod: exp.payment_method || exp.paymentMethod || '微信支付',
        beneficiary: exp.beneficiary || '',
        remarks: exp.remarks || '',
        direction: exp.direction || 'out',
        createdAt: exp.created_at || exp.createdAt || new Date().toISOString(),
        updatedAt: exp.updated_at || exp.updatedAt || exp.created_at || new Date().toISOString(),
        deletedAt: exp.deleted_at || exp.deletedAt || undefined,
      })),
      settings: d.settings,
      syncMeta: d.syncMeta,
    },
  };
}
