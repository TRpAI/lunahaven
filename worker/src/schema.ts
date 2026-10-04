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
    pension_personal REAL DEFAULT 0,
    medical_personal REAL DEFAULT 0,
    unemployment_personal REAL DEFAULT 0,
    housing_fund_personal REAL DEFAULT 0,
    total_personal_insurance REAL DEFAULT 0,
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

/**
 * 自动检测并初始化 D1 数据库结构 (零配置自愈)
 */
export async function ensureD1Schema(db: any): Promise<boolean> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error(
      "Worker 未绑定 D1 数据库变量 (env.DB is undefined)。请在 Cloudflare 仪表盘 Worker -> Settings -> Variables and Secrets -> D1 Database Bindings 中添加绑定，Variable name 必须设置为 'DB'"
    );
  }

  if (isSchemaEnsured) return true;

  // 增量字段平滑自愈迁移 (Safe Schema Column Auto-Migrations)
  try {
    await db.prepare('ALTER TABLE fuel_records ADD COLUMN is_warning_light_on INTEGER DEFAULT 0').run().catch(() => {});
    await db.prepare('ALTER TABLE fuel_records ADD COLUMN is_missed_previous INTEGER DEFAULT 0').run().catch(() => {});
    await db.prepare("ALTER TABLE expenses ADD COLUMN direction TEXT DEFAULT 'out'").run().catch(() => {});
  } catch {
    // 忽略表尚未创建时的 ALTER 失败
  }

  try {
    // 快速探测是否已存在 sync_meta 和 expenses 表
    const test = await db.prepare("SELECT key FROM sync_meta WHERE key = 'global'").first();
    const testExp = await db.prepare("SELECT id FROM expenses LIMIT 1").first().catch(() => null);
    if (test && testExp !== undefined) {
      isSchemaEnsured = true;
      return true;
    }
  } catch {
    // 表不存在或查询异常，执行逐条建表初始化
  }

  try {
    if (typeof db.exec === 'function') {
      await db.exec(D1_FULL_SCHEMA_SQL);
    } else {
      for (const stmt of D1_SCHEMA_STATEMENTS) {
        await db.prepare(stmt).run().catch((e: any) => {
          console.warn('Schema statement warning:', e);
        });
      }
    }
    isSchemaEnsured = true;
    return true;
  } catch (err: any) {
    console.error('Failed in db.exec, falling back to statement-by-statement execution:', err);
    try {
      for (const stmt of D1_SCHEMA_STATEMENTS) {
        await db.prepare(stmt).run().catch((e: any) => {
          console.warn('Schema statement warning on fallback:', e);
        });
      }
      isSchemaEnsured = true;
      return true;
    } catch (fallbackErr: any) {
      console.error('All schema initialization attempts failed:', fallbackErr);
      throw new Error(`D1 自动建表失败: ${fallbackErr.message || fallbackErr}`);
    }
  }
}
