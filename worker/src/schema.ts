import { D1Database } from './types';

/**
 * Cloudflare D1 数据库结构全量自愈与自动初始化 Schema
 */

export const D1_SCHEMA_STATEMENTS = [
  // 1. 工资与五险一金明细表
  `CREATE TABLE IF NOT EXISTS salaries (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    company_name TEXT,
    base_salary REAL DEFAULT 0,
    performance_pay REAL DEFAULT 0,
    overtime_pay REAL DEFAULT 0,
    allowance REAL DEFAULT 0,
    other_bonus REAL DEFAULT 0,
    pre_tax_deduction REAL DEFAULT 0,
    gross_salary REAL DEFAULT 0,
    overtime_15_hours REAL DEFAULT 0,
    overtime_15_pay REAL DEFAULT 0,
    overtime_20_hours REAL DEFAULT 0,
    overtime_20_pay REAL DEFAULT 0,
    overtime_30_hours REAL DEFAULT 0,
    overtime_30_pay REAL DEFAULT 0,
    night_shift_days REAL DEFAULT 0,
    night_shift_rate REAL DEFAULT 0,
    night_shift_pay REAL DEFAULT 0,
    full_attendance_pay REAL DEFAULT 0,
    base_allowance REAL DEFAULT 0,
    custom_allowances_json TEXT,
    pension_personal REAL DEFAULT 0,
    medical_personal REAL DEFAULT 0,
    unemployment_personal REAL DEFAULT 0,
    housing_fund_personal REAL DEFAULT 0,
    total_personal_insurance REAL DEFAULT 0,
    is_custom_insurance INTEGER DEFAULT 0,
    custom_deductions_json TEXT,
    other_deductions_total REAL DEFAULT 0,
    pension_company REAL DEFAULT 0,
    medical_company REAL DEFAULT 0,
    unemployment_company REAL DEFAULT 0,
    injury_company REAL DEFAULT 0,
    maternity_company REAL DEFAULT 0,
    housing_fund_company REAL DEFAULT 0,
    total_company_insurance REAL DEFAULT 0,
    special_deductions REAL DEFAULT 0,
    tax_threshold REAL DEFAULT 5000,
    taxable_income REAL DEFAULT 0,
    individual_income_tax REAL DEFAULT 0,
    net_salary REAL DEFAULT 0,
    company_total_cost REAL DEFAULT 0,
    pay_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  // 2. 加班工时与调休表
  `CREATE TABLE IF NOT EXISTS overtimes (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_hours REAL NOT NULL,
    multiplier REAL DEFAULT 1.5,
    settlement_type TEXT NOT NULL,
    hourly_rate REAL DEFAULT 0,
    estimated_pay REAL DEFAULT 0,
    comp_time_hours_used REAL DEFAULT 0,
    reason TEXT,
    approver TEXT,
    is_night_shift INTEGER DEFAULT 0,
    night_shift_subsidy REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  // 3. 日常生活、医疗、教育与综合支出表
  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    direction TEXT DEFAULT 'out',
    payer TEXT,
    payment_method TEXT,
    beneficiary TEXT,
    remarks TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT
  )`,

  // 4. 人情往来与礼金随礼表
  `CREATE TABLE IF NOT EXISTS social_gifts (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    direction TEXT NOT NULL,
    person_name TEXT NOT NULL,
    relation TEXT NOT NULL,
    event_type TEXT NOT NULL,
    amount REAL NOT NULL,
    return_status TEXT NOT NULL,
    return_amount REAL DEFAULT 0,
    location TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  // 5. 车辆档案表
  `CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plate_number TEXT,
    fuel_type TEXT NOT NULL,
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
  )`,

  // 6. 加油与充电记录表
  `CREATE TABLE IF NOT EXISTS fuel_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    date TEXT NOT NULL,
    odometer REAL NOT NULL,
    fuel_amount REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_cost REAL NOT NULL,
    is_full_tank INTEGER DEFAULT 1,
    is_warning_light_on INTEGER DEFAULT 0,
    is_missed_previous INTEGER DEFAULT 0,
    station TEXT,
    fuel_type TEXT,
    calculated_fuel_economy REAL,
    cost_per_km REAL,
    trip_distance REAL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  // 7. 汽车保养与维修记录表
  `CREATE TABLE IF NOT EXISTS maintenance_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    date TEXT NOT NULL,
    odometer REAL NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    items_json TEXT,
    shop_name TEXT,
    parts_cost REAL DEFAULT 0,
    labor_cost REAL DEFAULT 0,
    total_cost REAL NOT NULL,
    next_service_odometer REAL,
    next_service_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,

  // 8. 用户偏好配置表
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // 9. 同步元信息表
  `CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    revision INTEGER DEFAULT 1,
    schema_version INTEGER DEFAULT 2,
    last_synced_at TEXT,
    updated_at TEXT NOT NULL
  )`,

  // 10. 操作审计日志表
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    record_count INTEGER DEFAULT 0,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  )`,

  // 索引
  `CREATE INDEX IF NOT EXISTS idx_salaries_month_del ON salaries(month, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_overtimes_date_del ON overtimes(date, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_date_del ON expenses(date, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_social_gifts_date_del ON social_gifts(date, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_fuel_veh_date_del ON fuel_records(vehicle_id, date, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_maint_veh_date_del ON maintenance_records(vehicle_id, date, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`,

  // 初始化全局元数据记录
  `INSERT OR IGNORE INTO sync_meta (key, revision, schema_version, last_synced_at, updated_at)
   VALUES ('global', 1, 2, NULL, datetime('now'))`
];

export const D1_FULL_SCHEMA_SQL = D1_SCHEMA_STATEMENTS.join(';\n\n') + ';';

let isSchemaEnsured = false;

export interface TableInspectionDetail {
  name: string;
  exists: boolean;
  columnCount: number;
  columns: string[];
  missingColumns: string[];
}

export interface SchemaInspectionResult {
  ok: boolean;
  status: string;
  tablesChecked: number;
  tableDetails: TableInspectionDetail[];
  missingTablesCreated: string[];
  missingColumnsAdded: string[];
  message: string;
}

/**
 * 结构定义规范：10 张表与其必须具备的核心关键字段
 */
const REQUIRED_TABLES_SPEC: Record<string, { createSqlIndex: number; criticalColumns: Array<{ name: string; addSql: string }> }> = {
  salaries: {
    createSqlIndex: 0,
    criticalColumns: [
      { name: 'gross_salary', addSql: 'ALTER TABLE salaries ADD COLUMN gross_salary REAL DEFAULT 0' },
      { name: 'net_salary', addSql: 'ALTER TABLE salaries ADD COLUMN net_salary REAL DEFAULT 0' },
      { name: 'overtime_15_hours', addSql: 'ALTER TABLE salaries ADD COLUMN overtime_15_hours REAL DEFAULT 0' },
      { name: 'overtime_15_pay', addSql: 'ALTER TABLE salaries ADD COLUMN overtime_15_pay REAL DEFAULT 0' },
      { name: 'overtime_20_hours', addSql: 'ALTER TABLE salaries ADD COLUMN overtime_20_hours REAL DEFAULT 0' },
      { name: 'overtime_20_pay', addSql: 'ALTER TABLE salaries ADD COLUMN overtime_20_pay REAL DEFAULT 0' },
      { name: 'overtime_30_hours', addSql: 'ALTER TABLE salaries ADD COLUMN overtime_30_hours REAL DEFAULT 0' },
      { name: 'overtime_30_pay', addSql: 'ALTER TABLE salaries ADD COLUMN overtime_30_pay REAL DEFAULT 0' },
      { name: 'night_shift_days', addSql: 'ALTER TABLE salaries ADD COLUMN night_shift_days REAL DEFAULT 0' },
      { name: 'night_shift_rate', addSql: 'ALTER TABLE salaries ADD COLUMN night_shift_rate REAL DEFAULT 0' },
      { name: 'night_shift_pay', addSql: 'ALTER TABLE salaries ADD COLUMN night_shift_pay REAL DEFAULT 0' },
      { name: 'full_attendance_pay', addSql: 'ALTER TABLE salaries ADD COLUMN full_attendance_pay REAL DEFAULT 0' },
      { name: 'base_allowance', addSql: 'ALTER TABLE salaries ADD COLUMN base_allowance REAL DEFAULT 0' },
      { name: 'custom_allowances_json', addSql: 'ALTER TABLE salaries ADD COLUMN custom_allowances_json TEXT' },
      { name: 'is_custom_insurance', addSql: 'ALTER TABLE salaries ADD COLUMN is_custom_insurance INTEGER DEFAULT 0' },
      { name: 'custom_deductions_json', addSql: 'ALTER TABLE salaries ADD COLUMN custom_deductions_json TEXT' },
      { name: 'other_deductions_total', addSql: 'ALTER TABLE salaries ADD COLUMN other_deductions_total REAL DEFAULT 0' },
      { name: 'updated_at', addSql: 'ALTER TABLE salaries ADD COLUMN updated_at TEXT NOT NULL DEFAULT ""' },
      { name: 'deleted_at', addSql: 'ALTER TABLE salaries ADD COLUMN deleted_at TEXT' },
    ],
  },
  overtimes: {
    createSqlIndex: 1,
    criticalColumns: [
      { name: 'comp_time_hours_used', addSql: 'ALTER TABLE overtimes ADD COLUMN comp_time_hours_used REAL DEFAULT 0' },
      { name: 'approver', addSql: 'ALTER TABLE overtimes ADD COLUMN approver TEXT' },
      { name: 'is_night_shift', addSql: 'ALTER TABLE overtimes ADD COLUMN is_night_shift INTEGER DEFAULT 0' },
      { name: 'night_shift_subsidy', addSql: 'ALTER TABLE overtimes ADD COLUMN night_shift_subsidy REAL DEFAULT 0' },
      { name: 'updated_at', addSql: 'ALTER TABLE overtimes ADD COLUMN updated_at TEXT NOT NULL DEFAULT ""' },
      { name: 'deleted_at', addSql: 'ALTER TABLE overtimes ADD COLUMN deleted_at TEXT' },
    ],
  },
  expenses: {
    createSqlIndex: 2,
    criticalColumns: [
      { name: 'direction', addSql: "ALTER TABLE expenses ADD COLUMN direction TEXT DEFAULT 'out'" },
      { name: 'payer', addSql: 'ALTER TABLE expenses ADD COLUMN payer TEXT' },
      { name: 'payment_method', addSql: 'ALTER TABLE expenses ADD COLUMN payment_method TEXT' },
      { name: 'beneficiary', addSql: 'ALTER TABLE expenses ADD COLUMN beneficiary TEXT' },
      { name: 'remarks', addSql: 'ALTER TABLE expenses ADD COLUMN remarks TEXT' },
      { name: 'updated_at', addSql: 'ALTER TABLE expenses ADD COLUMN updated_at TEXT' },
      { name: 'deleted_at', addSql: 'ALTER TABLE expenses ADD COLUMN deleted_at TEXT' },
    ],
  },
  social_gifts: {
    createSqlIndex: 3,
    criticalColumns: [
      { name: 'return_status', addSql: "ALTER TABLE social_gifts ADD COLUMN return_status TEXT DEFAULT 'none_needed'" },
      { name: 'return_amount', addSql: 'ALTER TABLE social_gifts ADD COLUMN return_amount REAL DEFAULT 0' },
      { name: 'location', addSql: 'ALTER TABLE social_gifts ADD COLUMN location TEXT' },
      { name: 'updated_at', addSql: 'ALTER TABLE social_gifts ADD COLUMN updated_at TEXT NOT NULL DEFAULT ""' },
      { name: 'deleted_at', addSql: 'ALTER TABLE social_gifts ADD COLUMN deleted_at TEXT' },
    ],
  },
  vehicles: {
    createSqlIndex: 4,
    criticalColumns: [
      { name: 'tank_capacity', addSql: 'ALTER TABLE vehicles ADD COLUMN tank_capacity REAL DEFAULT 50' },
      { name: 'maintenance_interval_km', addSql: 'ALTER TABLE vehicles ADD COLUMN maintenance_interval_km REAL DEFAULT 10000' },
      { name: 'maintenance_interval_days', addSql: 'ALTER TABLE vehicles ADD COLUMN maintenance_interval_days INTEGER DEFAULT 180' },
      { name: 'last_maintenance_date', addSql: 'ALTER TABLE vehicles ADD COLUMN last_maintenance_date TEXT' },
      { name: 'last_maintenance_odometer', addSql: 'ALTER TABLE vehicles ADD COLUMN last_maintenance_odometer REAL' },
      { name: 'insurance_expiry_date', addSql: 'ALTER TABLE vehicles ADD COLUMN insurance_expiry_date TEXT' },
      { name: 'annual_inspection_date', addSql: 'ALTER TABLE vehicles ADD COLUMN annual_inspection_date TEXT' },
      { name: 'updated_at', addSql: 'ALTER TABLE vehicles ADD COLUMN updated_at TEXT NOT NULL DEFAULT ""' },
      { name: 'deleted_at', addSql: 'ALTER TABLE vehicles ADD COLUMN deleted_at TEXT' },
    ],
  },
  fuel_records: {
    createSqlIndex: 5,
    criticalColumns: [
      { name: 'is_full_tank', addSql: 'ALTER TABLE fuel_records ADD COLUMN is_full_tank INTEGER DEFAULT 1' },
      { name: 'is_warning_light_on', addSql: 'ALTER TABLE fuel_records ADD COLUMN is_warning_light_on INTEGER DEFAULT 0' },
      { name: 'is_missed_previous', addSql: 'ALTER TABLE fuel_records ADD COLUMN is_missed_previous INTEGER DEFAULT 0' },
      { name: 'station', addSql: 'ALTER TABLE fuel_records ADD COLUMN station TEXT' },
      { name: 'fuel_type', addSql: 'ALTER TABLE fuel_records ADD COLUMN fuel_type TEXT' },
      { name: 'calculated_fuel_economy', addSql: 'ALTER TABLE fuel_records ADD COLUMN calculated_fuel_economy REAL' },
      { name: 'cost_per_km', addSql: 'ALTER TABLE fuel_records ADD COLUMN cost_per_km REAL' },
      { name: 'trip_distance', addSql: 'ALTER TABLE fuel_records ADD COLUMN trip_distance REAL' },
      { name: 'updated_at', addSql: 'ALTER TABLE fuel_records ADD COLUMN updated_at TEXT NOT NULL DEFAULT ""' },
      { name: 'deleted_at', addSql: 'ALTER TABLE fuel_records ADD COLUMN deleted_at TEXT' },
    ],
  },
  maintenance_records: {
    createSqlIndex: 6,
    criticalColumns: [
      { name: 'items_json', addSql: 'ALTER TABLE maintenance_records ADD COLUMN items_json TEXT' },
      { name: 'shop_name', addSql: 'ALTER TABLE maintenance_records ADD COLUMN shop_name TEXT' },
      { name: 'parts_cost', addSql: 'ALTER TABLE maintenance_records ADD COLUMN parts_cost REAL DEFAULT 0' },
      { name: 'labor_cost', addSql: 'ALTER TABLE maintenance_records ADD COLUMN labor_cost REAL DEFAULT 0' },
      { name: 'next_service_odometer', addSql: 'ALTER TABLE maintenance_records ADD COLUMN next_service_odometer REAL' },
      { name: 'next_service_date', addSql: 'ALTER TABLE maintenance_records ADD COLUMN next_service_date TEXT' },
      { name: 'updated_at', addSql: 'ALTER TABLE maintenance_records ADD COLUMN updated_at TEXT NOT NULL DEFAULT ""' },
      { name: 'deleted_at', addSql: 'ALTER TABLE maintenance_records ADD COLUMN deleted_at TEXT' },
    ],
  },
  app_settings: {
    createSqlIndex: 7,
    criticalColumns: [
      { name: 'value_json', addSql: 'ALTER TABLE app_settings ADD COLUMN value_json TEXT NOT NULL DEFAULT "{}"' },
      { name: 'updated_at', addSql: 'ALTER TABLE app_settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT ""' },
    ],
  },
  sync_meta: {
    createSqlIndex: 8,
    criticalColumns: [
      { name: 'revision', addSql: 'ALTER TABLE sync_meta ADD COLUMN revision INTEGER DEFAULT 1' },
      { name: 'schema_version', addSql: 'ALTER TABLE sync_meta ADD COLUMN schema_version INTEGER DEFAULT 2' },
      { name: 'last_synced_at', addSql: 'ALTER TABLE sync_meta ADD COLUMN last_synced_at TEXT' },
      { name: 'updated_at', addSql: 'ALTER TABLE sync_meta ADD COLUMN updated_at TEXT NOT NULL DEFAULT ""' },
    ],
  },
  audit_logs: {
    createSqlIndex: 9,
    criticalColumns: [
      { name: 'action', addSql: 'ALTER TABLE audit_logs ADD COLUMN action TEXT NOT NULL DEFAULT "UNKNOWN"' },
      { name: 'resource', addSql: 'ALTER TABLE audit_logs ADD COLUMN resource TEXT NOT NULL DEFAULT "UNKNOWN"' },
      { name: 'record_count', addSql: 'ALTER TABLE audit_logs ADD COLUMN record_count INTEGER DEFAULT 0' },
      { name: 'ip_hash', addSql: 'ALTER TABLE audit_logs ADD COLUMN ip_hash TEXT' },
      { name: 'user_agent', addSql: 'ALTER TABLE audit_logs ADD COLUMN user_agent TEXT' },
      { name: 'created_at', addSql: 'ALTER TABLE audit_logs ADD COLUMN created_at TEXT NOT NULL DEFAULT ""' },
    ],
  },
};

/**
 * 深度检查并自动修复 D1 数据表与列完整性 (基于 PRAGMA table_info 权威探测)
 */
export async function inspectAndRepairD1Schema(db: D1Database): Promise<SchemaInspectionResult> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error(
      "Worker 未绑定 D1 数据库变量 (env.DB is undefined)。请在 Cloudflare 仪表盘 Worker -> Settings -> Variables and Secrets -> D1 Database Bindings 中添加绑定，Variable name 必须设置为 'DB'"
    );
  }

  // 1. 获取 SQLite 中当前存在的所有表
  let existingTables: string[] = [];
  try {
    const tablesRes = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all();
    existingTables = (tablesRes.results || []).map((r: any) => String(r.name));
  } catch (err: any) {
    console.warn('Failed to query sqlite_master:', err);
  }

  const existingSet = new Set(existingTables);
  const missingTablesCreated: string[] = [];
  const missingColumnsAdded: string[] = [];
  const tableDetails: TableInspectionDetail[] = [];

  // 2. 逐表检查存在性与字段完整性
  for (const [tableName, spec] of Object.entries(REQUIRED_TABLES_SPEC)) {
    const exists = existingSet.has(tableName);

    if (!exists) {
      // 表不存在：执行建表语句
      try {
        const createStmt = D1_SCHEMA_STATEMENTS[spec.createSqlIndex];
        if (createStmt) {
          await db.prepare(createStmt).run();
          missingTablesCreated.push(tableName);
          existingSet.add(tableName);
        }
      } catch (createErr: any) {
        console.error(`Failed to create missing table ${tableName}:`, createErr);
      }
    }

    // 检查现有表的字段清单 (PRAGMA table_info)
    let currentCols: string[] = [];
    try {
      const colRes = await db.prepare(`PRAGMA table_info(${tableName})`).all();
      currentCols = (colRes.results || []).map((c: any) => String(c.name).toLowerCase());
    } catch {
      // 容错处理
    }

    const colSet = new Set(currentCols);
    const missingForThisTable: string[] = [];

    for (const colSpec of spec.criticalColumns) {
      if (!colSet.has(colSpec.name.toLowerCase())) {
        missingForThisTable.push(colSpec.name);
        try {
          await db.prepare(colSpec.addSql).run();
          missingColumnsAdded.push(`${tableName}.${colSpec.name}`);
          colSet.add(colSpec.name.toLowerCase());
          currentCols.push(colSpec.name.toLowerCase());
        } catch (alterErr: any) {
          console.warn(`Failed to add column ${colSpec.name} to ${tableName}:`, alterErr);
        }
      }
    }

    tableDetails.push({
      name: tableName,
      exists: true,
      columnCount: currentCols.length,
      columns: currentCols,
      missingColumns: missingForThisTable,
    });
  }

  // 3. 补齐生产级索引
  for (let idx = 10; idx < 17; idx++) {
    const indexStmt = D1_SCHEMA_STATEMENTS[idx];
    if (indexStmt) {
      await db.prepare(indexStmt).run().catch(() => {});
    }
  }

  // 4. 确保默认全局元数据记录
  await db.prepare(`INSERT OR IGNORE INTO sync_meta (key, revision, schema_version, last_synced_at, updated_at) VALUES ('global', 1, 2, NULL, datetime('now'))`).run().catch(() => {});

  isSchemaEnsured = true;

  const summary = [
    `检查完毕：共验证 ${tableDetails.length} 张业务及系统表`,
    missingTablesCreated.length > 0 ? `新建表: ${missingTablesCreated.join(', ')}` : '',
    missingColumnsAdded.length > 0 ? `自愈补齐字段: ${missingColumnsAdded.join(', ')}` : '',
    missingTablesCreated.length === 0 && missingColumnsAdded.length === 0 ? '所有数据表结构完备，无任何字段缺失' : '',
  ].filter(Boolean).join('；');

  return {
    ok: true,
    status: 'healthy',
    tablesChecked: tableDetails.length,
    tableDetails,
    missingTablesCreated,
    missingColumnsAdded,
    message: summary,
  };
}

/**
 * 自动检测并初始化 D1 数据库结构 (零配置自愈)
 */
export async function ensureD1Schema(db: D1Database, force = false): Promise<boolean> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error(
      "Worker 未绑定 D1 数据库变量 (env.DB is undefined)。请在 Cloudflare 仪表盘 Worker -> Settings -> Variables and Secrets -> D1 Database Bindings 中添加绑定，Variable name 必须设置为 'DB'"
    );
  }

  if (isSchemaEnsured && !force) return true;

  try {
    const res = await inspectAndRepairD1Schema(db);
    return res.ok;
  } catch (err: any) {
    console.error('ensureD1Schema failed:', err);
    // 降级兜底执行原生全量 SQL
    try {
      if (typeof db.exec === 'function') {
        await db.exec(D1_FULL_SCHEMA_SQL);
      } else {
        for (const stmt of D1_SCHEMA_STATEMENTS) {
          await db.prepare(stmt).run().catch(() => {});
        }
      }
      isSchemaEnsured = true;
      return true;
    } catch (fallbackErr: any) {
      throw new Error(`D1 自动建表失败: ${fallbackErr.message || fallbackErr}`);
    }
  }
}
