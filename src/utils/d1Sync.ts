import { LedgerFullData } from '../types';

export const CLOUDFLARE_D1_SCHEMA_SQL = `-- ==========================================
-- 栖月账本 (Qiyue Ledger) Cloudflare D1 Schema
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
    
    -- 个人五险一金
    pension_personal REAL DEFAULT 0,    -- 养老保险(个人)
    medical_personal REAL DEFAULT 0,    -- 医疗保险(个人)
    unemployment_personal REAL DEFAULT 0, -- 失业保险(个人)
    housing_fund_personal REAL DEFAULT 0, -- 住房公积金(个人)
    total_personal_insurance REAL DEFAULT 0,
    
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

-- 7. 用户隐私与偏好配置表
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 8. 边缘同步元信息表 (sync_meta)
CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,               -- 'global'
    revision INTEGER DEFAULT 1,         -- 数据版本号
    schema_version INTEGER DEFAULT 2,   -- D1 结构版本
    last_synced_at TEXT,
    updated_at TEXT NOT NULL
);

-- 创建索引以加速按月和按日期查询
CREATE INDEX IF NOT EXISTS idx_salaries_month ON salaries(month);
CREATE INDEX IF NOT EXISTS idx_overtimes_date ON overtimes(date);
CREATE INDEX IF NOT EXISTS idx_social_gifts_date ON social_gifts(date);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_date ON fuel_records(vehicle_id, date);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_date ON maintenance_records(vehicle_id, date);
`;

export const CLOUDFLARE_WORKER_SCRIPT_TEMPLATE = `/**
 * Cloudflare Worker + D1 API for Qiyue Ledger (栖月账本)
 * Deploy with Wrangler: wrangler deploy
 * 
 * wrangler.toml configuration:
 * --------------------------------
 * name = "qiyue-ledger-api"
 * main = "src/index.ts"
 * compatibility_date = "2024-09-23"
 * 
 * [[d1_databases]]
 * binding = "DB"
 * database_name = "qiyue_ledger_db"
 * database_id = "YOUR_D1_DATABASE_ID_HERE"
 * 
 * [vars]
 * API_TOKEN = "your-custom-secure-secret-token"
 */

export interface Env {
  DB: D1Database;
  API_TOKEN?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\\s+/i, '');

    // Optional Auth verification
    if (env.API_TOKEN && token !== env.API_TOKEN) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Invalid API Token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Health Check
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Pull All Data from D1 (GET /api/sync)
      if (request.method === 'GET' && url.pathname === '/api/sync') {
        const salaries = await env.DB.prepare('SELECT * FROM salaries ORDER BY month DESC').all();
        const overtimes = await env.DB.prepare('SELECT * FROM overtimes ORDER BY date DESC').all();
        const gifts = await env.DB.prepare('SELECT * FROM social_gifts ORDER BY date DESC').all();
        const vehicles = await env.DB.prepare('SELECT * FROM vehicles').all();
        const fuels = await env.DB.prepare('SELECT * FROM fuel_records ORDER BY date DESC').all();
        const maintenances = await env.DB.prepare('SELECT * FROM maintenance_records ORDER BY date DESC').all();
        const settings = await env.DB.prepare('SELECT * FROM app_settings').all();

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              salaries: salaries.results,
              overtimes: overtimes.results,
              gifts: gifts.results,
              vehicles: vehicles.results,
              fuels: fuels.results,
              maintenances: maintenances.results,
              settings: settings.results,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Push/Batch Sync Data to D1 (POST /api/sync)
      if (request.method === 'POST' && url.pathname === '/api/sync') {
        const payload = await request.json();
        const { salaries, overtimes, gifts, vehicles, fuels, maintenances, settings } = payload;

        const statements: D1PreparedStatement[] = [];

        // Sync Salaries
        if (Array.isArray(salaries)) {
          for (const s of salaries) {
            statements.push(
              env.DB.prepare(
                \`INSERT OR REPLACE INTO salaries (
                  id, month, company_name, base_salary, performance_pay, overtime_pay, allowance, other_bonus,
                  pre_tax_deduction, gross_salary, pension_personal, medical_personal, unemployment_personal,
                  housing_fund_personal, total_personal_insurance, pension_company, medical_company, unemployment_company,
                  injury_company, maternity_company, housing_fund_company, total_company_insurance, special_deductions,
                  tax_threshold, taxable_income, individual_income_tax, net_salary, company_total_cost, pay_date, notes,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
              ).bind(
                s.id, s.month, s.companyName, s.baseSalary, s.performancePay, s.overtimePay, s.allowance, s.otherBonus,
                s.preTaxDeduction, s.grossSalary, s.pensionPersonal, s.medicalPersonal, s.unemploymentPersonal,
                s.housingFundPersonal, s.totalPersonalInsurance, s.pensionCompany, s.medicalCompany, s.unemploymentCompany,
                s.injuryCompany, s.maternityCompany, s.housingFundCompany, s.totalCompanyInsurance, s.specialDeductions,
                s.taxThreshold || 5000, s.taxableIncome, s.individualIncomeTax, s.netSalary, s.companyTotalCost, s.payDate,
                s.notes, s.createdAt || new Date().toISOString(), s.updatedAt || new Date().toISOString()
              )
            );
          }
        }

        // Sync Overtimes
        if (Array.isArray(overtimes)) {
          for (const o of overtimes) {
            statements.push(
              env.DB.prepare(
                \`INSERT OR REPLACE INTO overtimes (
                  id, date, type, start_time, end_time, duration_hours, multiplier, settlement_type,
                  hourly_rate, estimated_pay, comp_time_hours_used, reason, approver, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
              ).bind(
                o.id, o.date, o.type, o.startTime, o.endTime, o.durationHours, o.multiplier, o.settlementType,
                o.hourlyRate, o.estimatedPay, o.compTimeHoursUsed || 0, o.reason, o.approver || '', o.notes || '', o.createdAt || new Date().toISOString()
              )
            );
          }
        }

        // Sync Gifts
        if (Array.isArray(gifts)) {
          for (const g of gifts) {
            statements.push(
              env.DB.prepare(
                \`INSERT OR REPLACE INTO social_gifts (
                  id, date, direction, person_name, relation, event_type, amount, return_status, return_amount,
                  location, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
              ).bind(
                g.id, g.date, g.direction, g.personName, g.relation, g.eventType, g.amount, g.returnStatus,
                g.returnAmount || 0, g.location || '', g.notes || '', g.createdAt || new Date().toISOString()
              )
            );
          }
        }

        // Sync Vehicles
        if (Array.isArray(vehicles)) {
          for (const v of vehicles) {
            statements.push(
              env.DB.prepare(
                \`INSERT OR REPLACE INTO vehicles (
                  id, name, plate_number, fuel_type, tank_capacity, initial_odometer, current_odometer,
                  maintenance_interval_km, maintenance_interval_days, last_maintenance_date, last_maintenance_odometer,
                  insurance_expiry_date, annual_inspection_date, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
              ).bind(
                v.id, v.name, v.plateNumber || '', v.fuelType, v.tankCapacity || 50, v.initialOdometer || 0,
                v.currentOdometer || 0, v.maintenanceIntervalKm || 10000, v.maintenanceIntervalDays || 180,
                v.lastMaintenanceDate || '', v.lastMaintenanceOdometer || 0, v.insuranceExpiryDate || '',
                v.annualInspectionDate || '', v.createdAt || new Date().toISOString()
              )
            );
          }
        }

        // Sync Fuels
        if (Array.isArray(fuels)) {
          for (const f of fuels) {
            statements.push(
              env.DB.prepare(
                \`INSERT OR REPLACE INTO fuel_records (
                  id, vehicle_id, date, odometer, fuel_amount, unit_price, total_cost, is_full_tank,
                  station, fuel_type, calculated_fuel_economy, cost_per_km, trip_distance, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
              ).bind(
                f.id, f.vehicleId, f.date, f.odometer, f.fuelAmount, f.unitPrice, f.totalCost, f.isFullTank ? 1 : 0,
                f.station || '', f.fuelType || '', f.calculatedFuelEconomy || null, f.costPerKm || null,
                f.tripDistance || null, f.notes || '', f.createdAt || new Date().toISOString()
              )
            );
          }
        }

        // Sync Maintenances
        if (Array.isArray(maintenances)) {
          for (const m of maintenances) {
            statements.push(
              env.DB.prepare(
                \`INSERT OR REPLACE INTO maintenance_records (
                  id, vehicle_id, date, odometer, category, title, items_json, shop_name, parts_cost,
                  labor_cost, total_cost, next_service_odometer, next_service_date, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`
              ).bind(
                m.id, m.vehicleId, m.date, m.odometer, m.category, m.title, JSON.stringify(m.items || []),
                m.shopName || '', m.partsCost || 0, m.laborCost || 0, m.totalCost || 0,
                m.nextServiceOdometer || null, m.nextServiceDate || null, m.notes || '', m.createdAt || new Date().toISOString()
              )
            );
          }
        }

        if (statements.length > 0) {
          // Cloudflare D1 batch execution
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, processedCount: statements.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
`;

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

  // Helper escape
  const esc = (val: any) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  // Salaries
  for (const s of data.salaries) {
    lines.push(
      `INSERT OR REPLACE INTO salaries VALUES (${esc(s.id)}, ${esc(s.month)}, ${esc(s.companyName)}, ${esc(s.baseSalary)}, ${esc(s.performancePay)}, ${esc(s.overtimePay)}, ${esc(s.allowance)}, ${esc(s.otherBonus)}, ${esc(s.preTaxDeduction)}, ${esc(s.grossSalary)}, ${esc(s.pensionPersonal)}, ${esc(s.medicalPersonal)}, ${esc(s.unemploymentPersonal)}, ${esc(s.housingFundPersonal)}, ${esc(s.totalPersonalInsurance)}, ${esc(s.pensionCompany)}, ${esc(s.medicalCompany)}, ${esc(s.unemploymentCompany)}, ${esc(s.injuryCompany)}, ${esc(s.maternityCompany)}, ${esc(s.housingFundCompany)}, ${esc(s.totalCompanyInsurance)}, ${esc(s.specialDeductions)}, ${esc(s.taxThreshold)}, ${esc(s.taxableIncome)}, ${esc(s.individualIncomeTax)}, ${esc(s.netSalary)}, ${esc(s.companyTotalCost)}, ${esc(s.payDate)}, ${esc(s.notes)}, ${esc(s.createdAt)}, ${esc(s.updatedAt || s.createdAt)}, ${esc(s.deletedAt || null)});`
    );
  }

  // Overtimes
  for (const o of data.overtimes) {
    lines.push(
      `INSERT OR REPLACE INTO overtimes VALUES (${esc(o.id)}, ${esc(o.date)}, ${esc(o.type)}, ${esc(o.startTime)}, ${esc(o.endTime)}, ${esc(o.durationHours)}, ${esc(o.multiplier)}, ${esc(o.settlementType)}, ${esc(o.hourlyRate)}, ${esc(o.estimatedPay)}, ${esc(o.compTimeHoursUsed || 0)}, ${esc(o.reason)}, ${esc(o.approver || '')}, ${esc(o.notes || '')}, ${esc(o.createdAt)}, ${esc(o.updatedAt || o.createdAt)}, ${esc(o.deletedAt || null)});`
    );
  }

  // Gifts
  for (const g of data.gifts) {
    lines.push(
      `INSERT OR REPLACE INTO social_gifts VALUES (${esc(g.id)}, ${esc(g.date)}, ${esc(g.direction)}, ${esc(g.personName)}, ${esc(g.relation)}, ${esc(g.eventType)}, ${esc(g.amount)}, ${esc(g.returnStatus)}, ${esc(g.returnAmount || 0)}, ${esc(g.location || '')}, ${esc(g.notes || '')}, ${esc(g.createdAt)}, ${esc(g.updatedAt || g.createdAt)}, ${esc(g.deletedAt || null)});`
    );
  }

  // Vehicles
  for (const v of data.vehicles) {
    lines.push(
      `INSERT OR REPLACE INTO vehicles VALUES (${esc(v.id)}, ${esc(v.name)}, ${esc(v.plateNumber || '')}, ${esc(v.fuelType)}, ${esc(v.tankCapacity || 50)}, ${esc(v.initialOdometer || 0)}, ${esc(v.currentOdometer || 0)}, ${esc(v.maintenanceIntervalKm || 10000)}, ${esc(v.maintenanceIntervalDays || 180)}, ${esc(v.lastMaintenanceDate || '')}, ${esc(v.lastMaintenanceOdometer || 0)}, ${esc(v.insuranceExpiryDate || '')}, ${esc(v.annualInspectionDate || '')}, ${esc(v.createdAt)}, ${esc(v.updatedAt || v.createdAt)}, ${esc(v.deletedAt || null)});`
    );
  }

  // Fuels
  for (const f of data.fuels) {
    lines.push(
      `INSERT OR REPLACE INTO fuel_records VALUES (${esc(f.id)}, ${esc(f.vehicleId)}, ${esc(f.date)}, ${esc(f.odometer)}, ${esc(f.fuelAmount)}, ${esc(f.unitPrice)}, ${esc(f.totalCost)}, ${f.isFullTank ? 1 : 0}, ${esc(f.station || '')}, ${esc(f.fuelType || '')}, ${esc(f.calculatedFuelEconomy)}, ${esc(f.costPerKm)}, ${esc(f.tripDistance)}, ${esc(f.notes || '')}, ${esc(f.createdAt)}, ${esc(f.updatedAt || f.createdAt)}, ${esc(f.deletedAt || null)});`
    );
  }

  // Maintenances
  for (const m of data.maintenances) {
    lines.push(
      `INSERT OR REPLACE INTO maintenance_records VALUES (${esc(m.id)}, ${esc(m.vehicleId)}, ${esc(m.date)}, ${esc(m.odometer)}, ${esc(m.category)}, ${esc(m.title)}, ${esc(JSON.stringify(m.items || []))}, ${esc(m.shopName || '')}, ${esc(m.partsCost || 0)}, ${esc(m.laborCost || 0)}, ${esc(m.totalCost || 0)}, ${esc(m.nextServiceOdometer)}, ${esc(m.nextServiceDate)}, ${esc(m.notes || '')}, ${esc(m.createdAt)}, ${esc(m.updatedAt || m.createdAt)}, ${esc(m.deletedAt || null)});`
    );
  }

  // App Settings
  if (data.settings) {
    lines.push(
      `INSERT OR REPLACE INTO app_settings VALUES ('app_settings', ${esc(JSON.stringify(data.settings))}, ${esc(new Date().toISOString())});`
    );
  }

  // Sync Meta
  const revision = data.syncMeta?.revision || 1;
  const schemaVersion = data.syncMeta?.schemaVersion || 2;
  lines.push(
    `INSERT OR REPLACE INTO sync_meta VALUES ('global', ${revision}, ${schemaVersion}, ${esc(data.syncMeta?.lastSyncedAt || null)}, ${esc(new Date().toISOString())});`
  );

  lines.push('', 'COMMIT;', '-- D1 SQL Dump Finished.');
  return lines.join('\n');
}

/**
 * 向 Cloudflare Worker 同步数据
 */
export async function syncToCloudflareWorker(workerUrl: string, apiToken: string, data: LedgerFullData) {
  const cleanUrl = workerUrl.trim().replace(/\/+$/, '');
  const targetUrl = `${cleanUrl}/api/sync`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiToken && apiToken.trim()) {
    headers['Authorization'] = `Bearer ${apiToken.trim()}`;
  }

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      salaries: data.salaries,
      overtimes: data.overtimes,
      gifts: data.gifts,
      vehicles: data.vehicles,
      fuels: data.fuels,
      maintenances: data.maintenances,
      settings: data.settings,
      syncMeta: data.syncMeta,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cloudflare D1 同步失败 (${res.status}): ${errorText || res.statusText}`);
  }

  return await res.json();
}

/**
 * 从 Cloudflare Worker 拉取最新数据
 */
export async function pullFromCloudflareWorker(workerUrl: string, apiToken: string): Promise<Partial<LedgerFullData>> {
  const cleanUrl = workerUrl.trim().replace(/\/+$/, '');
  const targetUrl = `${cleanUrl}/api/sync`;

  const headers: Record<string, string> = {};
  if (apiToken && apiToken.trim()) {
    headers['Authorization'] = `Bearer ${apiToken.trim()}`;
  }

  const res = await fetch(targetUrl, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cloudflare D1 拉取失败 (${res.status}): ${errorText || res.statusText}`);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || '返回数据格式不符合预期');
  }

  // 映射 D1 字段回驼峰命名
  const d = json.data;
  return {
    salaries: (d.salaries || []).map((s: any) => ({
      id: s.id,
      month: s.month,
      companyName: s.company_name,
      baseSalary: s.base_salary,
      performancePay: s.performance_pay,
      overtimePay: s.overtime_pay,
      allowance: s.allowance,
      otherBonus: s.other_bonus,
      preTaxDeduction: s.pre_tax_deduction,
      grossSalary: s.gross_salary,
      pensionPersonal: s.pension_personal,
      medicalPersonal: s.medical_personal,
      unemploymentPersonal: s.unemployment_personal,
      housingFundPersonal: s.housing_fund_personal,
      totalPersonalInsurance: s.total_personal_insurance,
      pensionCompany: s.pension_company,
      medicalCompany: s.medical_company,
      unemploymentCompany: s.unemployment_company,
      injuryCompany: s.injury_company,
      maternityCompany: s.maternity_company,
      housingFundCompany: s.housing_fund_company,
      totalCompanyInsurance: s.total_company_insurance,
      specialDeductions: s.special_deductions,
      taxThreshold: s.tax_threshold,
      taxableIncome: s.taxable_income,
      individualIncomeTax: s.individual_income_tax,
      netSalary: s.net_salary,
      companyTotalCost: s.company_total_cost,
      payDate: s.pay_date,
      notes: s.notes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
    overtimes: (d.overtimes || []).map((o: any) => ({
      id: o.id,
      date: o.date,
      type: o.type,
      startTime: o.start_time,
      endTime: o.end_time,
      durationHours: o.duration_hours,
      multiplier: o.multiplier,
      settlementType: o.settlement_type,
      hourlyRate: o.hourly_rate,
      estimatedPay: o.estimated_pay,
      compTimeHoursUsed: o.comp_time_hours_used,
      reason: o.reason,
      approver: o.approver,
      notes: o.notes,
      createdAt: o.created_at,
      updatedAt: o.updated_at || o.created_at,
      deletedAt: o.deleted_at || undefined,
    })),
    gifts: (d.gifts || []).map((g: any) => ({
      id: g.id,
      date: g.date,
      direction: g.direction,
      personName: g.person_name,
      relation: g.relation,
      eventType: g.event_type,
      amount: g.amount,
      returnStatus: g.return_status,
      returnAmount: g.return_amount,
      location: g.location,
      notes: g.notes,
      createdAt: g.created_at,
      updatedAt: g.updated_at || g.created_at,
      deletedAt: g.deleted_at || undefined,
    })),
    vehicles: (d.vehicles || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      plateNumber: v.plate_number,
      fuelType: v.fuel_type,
      tankCapacity: v.tank_capacity,
      initialOdometer: v.initial_odometer,
      currentOdometer: v.current_odometer,
      maintenanceIntervalKm: v.maintenance_interval_km,
      maintenanceIntervalDays: v.maintenance_interval_days,
      lastMaintenanceDate: v.last_maintenance_date,
      lastMaintenanceOdometer: v.last_maintenance_odometer,
      insuranceExpiryDate: v.insurance_expiry_date,
      annualInspectionDate: v.annual_inspection_date,
      createdAt: v.created_at,
      updatedAt: v.updated_at || v.created_at,
      deletedAt: v.deleted_at || undefined,
    })),
    fuels: (d.fuels || []).map((f: any) => ({
      id: f.id,
      vehicleId: f.vehicle_id,
      date: f.date,
      odometer: f.odometer,
      fuelAmount: f.fuel_amount,
      unitPrice: f.unit_price,
      totalCost: f.total_cost,
      isFullTank: f.is_full_tank === 1,
      station: f.station,
      fuelType: f.fuel_type,
      calculatedFuelEconomy: f.calculated_fuel_economy,
      costPerKm: f.cost_per_km,
      tripDistance: f.trip_distance,
      notes: f.notes,
      createdAt: f.created_at,
      updatedAt: f.updated_at || f.created_at,
      deletedAt: f.deleted_at || undefined,
    })),
    maintenances: (d.maintenances || []).map((m: any) => ({
      id: m.id,
      vehicleId: m.vehicle_id,
      date: m.date,
      odometer: m.odometer,
      category: m.category,
      title: m.title,
      items: typeof m.items_json === 'string' ? JSON.parse(m.items_json || '[]') : [],
      shopName: m.shop_name,
      partsCost: m.parts_cost,
      laborCost: m.labor_cost,
      totalCost: m.total_cost,
      nextServiceOdometer: m.next_service_odometer,
      nextServiceDate: m.next_service_date,
      notes: m.notes,
      createdAt: m.created_at,
      updatedAt: m.updated_at || m.created_at,
      deletedAt: m.deleted_at || undefined,
    })),
    syncMeta: d.syncMeta,
  };
}
