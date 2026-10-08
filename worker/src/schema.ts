import { D1Database, D1PreparedStatement } from './types';

/**
 * 确保 D1 数据库 10 张核心业务表、索引及最新版本演进字段完整就绪 (无损自愈与自动补齐)
 */
export async function ensureDatabaseSchema(db: D1Database): Promise<{
  tablesCount: number;
  migratedColumns: string[];
}> {
  const nowIso = new Date().toISOString();
  const initStatements: D1PreparedStatement[] = [
    // 1. 工资与五险一金明细表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS salaries (
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
      );
    `),

    // 2. 加班工时与调休表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS overtimes (
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
      );
    `),

    // 3. 人情往来与礼金随礼表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS social_gifts (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        direction TEXT NOT NULL,
        person_name TEXT NOT NULL,
        relation TEXT NOT NULL,
        event_type TEXT NOT NULL,
        amount REAL NOT NULL,
        return_status TEXT DEFAULT 'pending',
        return_amount REAL DEFAULT 0,
        location TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
    `),

    // 4. 车辆信息表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS vehicles (
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
      );
    `),

    // 5. 汽车加油/充电流水表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS fuel_records (
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
      );
    `),

    // 6. 车辆维保记录表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS maintenance_records (
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
      );
    `),

    // 7. 日常综合开销表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        payer TEXT,
        payment_method TEXT,
        beneficiary TEXT,
        remarks TEXT,
        direction TEXT DEFAULT 'out',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
    `),

    // 8. 全局应用脱敏配置表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `),

    // 9. 版本乐观锁同步元数据表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        revision INTEGER DEFAULT 1,
        schema_version INTEGER DEFAULT 2,
        last_synced_at TEXT,
        updated_at TEXT NOT NULL
      );
    `),

    // 10. 生产操作审计表
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        record_count INTEGER DEFAULT 0,
        ip_hash TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      );
    `),

    // 全局版本元数据初始化占位行
    db.prepare(`
      INSERT INTO sync_meta (key, revision, schema_version, last_synced_at, updated_at)
      VALUES ('global', 1, 2, NULL, ?)
      ON CONFLICT(key) DO NOTHING;
    `).bind(nowIso),

    // 性能索引加速 (带条件容错)
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_salaries_month_del ON salaries(month, deleted_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_salaries_updated ON salaries(updated_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_overtimes_date_del ON overtimes(date, deleted_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_overtimes_updated ON overtimes(updated_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_expenses_date_del ON expenses(date, deleted_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_fuel_veh_date_del ON fuel_records(vehicle_id, date, deleted_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_fuel_updated ON fuel_records(updated_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_maint_veh_date_del ON maintenance_records(vehicle_id, date, deleted_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_maint_updated ON maintenance_records(updated_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_social_gifts_date_del ON social_gifts(date, deleted_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_social_gifts_updated ON social_gifts(updated_at);`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);`),
  ];

  // 分批容错执行建表与基础索引
  try {
    await db.batch(initStatements);
  } catch (initErr) {
    console.warn('[Schema Init] Batch create tables warning, trying individual statements:', initErr);
    for (const stmt of initStatements) {
      try {
        await stmt.run();
      } catch (stmtErr) {
        // 允许单个非致命语句（如重复索引）跳过
        console.warn('[Schema Init] Single statement warning:', stmtErr);
      }
    }
  }

  // 针对已有旧数据库表的字段平滑扩展 (全量业务表无损字段自愈与版本升级迁移)
  const REQUIRED_COLUMNS: Record<string, { col: string; def: string }[]> = {
    salaries: [
      { col: 'company_name', def: 'TEXT' },
      { col: 'base_salary', def: 'REAL DEFAULT 0' },
      { col: 'performance_pay', def: 'REAL DEFAULT 0' },
      { col: 'overtime_pay', def: 'REAL DEFAULT 0' },
      { col: 'allowance', def: 'REAL DEFAULT 0' },
      { col: 'other_bonus', def: 'REAL DEFAULT 0' },
      { col: 'pre_tax_deduction', def: 'REAL DEFAULT 0' },
      { col: 'gross_salary', def: 'REAL DEFAULT 0' },
      { col: 'overtime_15_hours', def: 'REAL DEFAULT 0' },
      { col: 'overtime_15_pay', def: 'REAL DEFAULT 0' },
      { col: 'overtime_20_hours', def: 'REAL DEFAULT 0' },
      { col: 'overtime_20_pay', def: 'REAL DEFAULT 0' },
      { col: 'overtime_30_hours', def: 'REAL DEFAULT 0' },
      { col: 'overtime_30_pay', def: 'REAL DEFAULT 0' },
      { col: 'night_shift_days', def: 'REAL DEFAULT 0' },
      { col: 'night_shift_rate', def: 'REAL DEFAULT 0' },
      { col: 'night_shift_pay', def: 'REAL DEFAULT 0' },
      { col: 'full_attendance_pay', def: 'REAL DEFAULT 0' },
      { col: 'base_allowance', def: 'REAL DEFAULT 0' },
      { col: 'custom_allowances_json', def: 'TEXT' },
      { col: 'pension_personal', def: 'REAL DEFAULT 0' },
      { col: 'medical_personal', def: 'REAL DEFAULT 0' },
      { col: 'unemployment_personal', def: 'REAL DEFAULT 0' },
      { col: 'housing_fund_personal', def: 'REAL DEFAULT 0' },
      { col: 'total_personal_insurance', def: 'REAL DEFAULT 0' },
      { col: 'is_custom_insurance', def: 'INTEGER DEFAULT 0' },
      { col: 'custom_deductions_json', def: 'TEXT' },
      { col: 'other_deductions_total', def: 'REAL DEFAULT 0' },
      { col: 'pension_company', def: 'REAL DEFAULT 0' },
      { col: 'medical_company', def: 'REAL DEFAULT 0' },
      { col: 'unemployment_company', def: 'REAL DEFAULT 0' },
      { col: 'injury_company', def: 'REAL DEFAULT 0' },
      { col: 'maternity_company', def: 'REAL DEFAULT 0' },
      { col: 'housing_fund_company', def: 'REAL DEFAULT 0' },
      { col: 'total_company_insurance', def: 'REAL DEFAULT 0' },
      { col: 'special_deductions', def: 'REAL DEFAULT 0' },
      { col: 'tax_threshold', def: 'REAL DEFAULT 5000' },
      { col: 'taxable_income', def: 'REAL DEFAULT 0' },
      { col: 'individual_income_tax', def: 'REAL DEFAULT 0' },
      { col: 'net_salary', def: 'REAL DEFAULT 0' },
      { col: 'company_total_cost', def: 'REAL DEFAULT 0' },
      { col: 'pay_date', def: 'TEXT' },
      { col: 'notes', def: 'TEXT' },
      { col: 'created_at', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
      { col: 'deleted_at', def: 'TEXT' },
    ],
    overtimes: [
      { col: 'start_time', def: 'TEXT' },
      { col: 'end_time', def: 'TEXT' },
      { col: 'duration_hours', def: 'REAL DEFAULT 0' },
      { col: 'multiplier', def: 'REAL DEFAULT 1.5' },
      { col: 'settlement_type', def: "TEXT DEFAULT 'paid'" },
      { col: 'hourly_rate', def: 'REAL DEFAULT 0' },
      { col: 'estimated_pay', def: 'REAL DEFAULT 0' },
      { col: 'comp_time_hours_used', def: 'REAL DEFAULT 0' },
      { col: 'reason', def: 'TEXT' },
      { col: 'approver', def: 'TEXT' },
      { col: 'is_night_shift', def: 'INTEGER DEFAULT 0' },
      { col: 'night_shift_subsidy', def: 'REAL DEFAULT 0' },
      { col: 'notes', def: 'TEXT' },
      { col: 'created_at', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
      { col: 'deleted_at', def: 'TEXT' },
    ],
    social_gifts: [
      { col: 'direction', def: "TEXT DEFAULT 'out'" },
      { col: 'person_name', def: 'TEXT' },
      { col: 'relation', def: 'TEXT' },
      { col: 'event_type', def: 'TEXT' },
      { col: 'amount', def: 'REAL DEFAULT 0' },
      { col: 'return_status', def: "TEXT DEFAULT 'pending'" },
      { col: 'return_amount', def: 'REAL DEFAULT 0' },
      { col: 'location', def: 'TEXT' },
      { col: 'notes', def: 'TEXT' },
      { col: 'created_at', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
      { col: 'deleted_at', def: 'TEXT' },
    ],
    vehicles: [
      { col: 'plate_number', def: 'TEXT' },
      { col: 'fuel_type', def: "TEXT DEFAULT 'gasoline_92'" },
      { col: 'tank_capacity', def: 'REAL DEFAULT 50' },
      { col: 'initial_odometer', def: 'REAL DEFAULT 0' },
      { col: 'current_odometer', def: 'REAL DEFAULT 0' },
      { col: 'maintenance_interval_km', def: 'REAL DEFAULT 10000' },
      { col: 'maintenance_interval_days', def: 'INTEGER DEFAULT 180' },
      { col: 'last_maintenance_date', def: 'TEXT' },
      { col: 'last_maintenance_odometer', def: 'REAL' },
      { col: 'insurance_expiry_date', def: 'TEXT' },
      { col: 'annual_inspection_date', def: 'TEXT' },
      { col: 'created_at', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
      { col: 'deleted_at', def: 'TEXT' },
    ],
    fuel_records: [
      { col: 'odometer', def: 'REAL DEFAULT 0' },
      { col: 'fuel_amount', def: 'REAL DEFAULT 0' },
      { col: 'unit_price', def: 'REAL DEFAULT 0' },
      { col: 'total_cost', def: 'REAL DEFAULT 0' },
      { col: 'is_full_tank', def: 'INTEGER DEFAULT 1' },
      { col: 'is_warning_light_on', def: 'INTEGER DEFAULT 0' },
      { col: 'is_missed_previous', def: 'INTEGER DEFAULT 0' },
      { col: 'station', def: 'TEXT' },
      { col: 'fuel_type', def: 'TEXT' },
      { col: 'calculated_fuel_economy', def: 'REAL' },
      { col: 'cost_per_km', def: 'REAL' },
      { col: 'trip_distance', def: 'REAL' },
      { col: 'notes', def: 'TEXT' },
      { col: 'created_at', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
      { col: 'deleted_at', def: 'TEXT' },
    ],
    maintenance_records: [
      { col: 'odometer', def: 'REAL DEFAULT 0' },
      { col: 'category', def: "TEXT DEFAULT 'routine'" },
      { col: 'title', def: 'TEXT' },
      { col: 'items_json', def: 'TEXT' },
      { col: 'shop_name', def: 'TEXT' },
      { col: 'parts_cost', def: 'REAL DEFAULT 0' },
      { col: 'labor_cost', def: 'REAL DEFAULT 0' },
      { col: 'total_cost', def: 'REAL DEFAULT 0' },
      { col: 'next_service_odometer', def: 'REAL' },
      { col: 'next_service_date', def: 'TEXT' },
      { col: 'notes', def: 'TEXT' },
      { col: 'created_at', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
      { col: 'deleted_at', def: 'TEXT' },
    ],
    expenses: [
      { col: 'date', def: 'TEXT' },
      { col: 'type', def: "TEXT DEFAULT 'living'" },
      { col: 'category', def: 'TEXT' },
      { col: 'amount', def: 'REAL DEFAULT 0' },
      { col: 'direction', def: "TEXT DEFAULT 'out'" },
      { col: 'payer', def: 'TEXT' },
      { col: 'payment_method', def: 'TEXT' },
      { col: 'beneficiary', def: 'TEXT' },
      { col: 'remarks', def: 'TEXT' },
      { col: 'created_at', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
      { col: 'deleted_at', def: 'TEXT' },
    ],
    app_settings: [
      { col: 'value_json', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
    ],
    sync_meta: [
      { col: 'revision', def: 'INTEGER DEFAULT 1' },
      { col: 'schema_version', def: 'INTEGER DEFAULT 2' },
      { col: 'last_synced_at', def: 'TEXT' },
      { col: 'updated_at', def: 'TEXT' },
    ],
    audit_logs: [
      { col: 'action', def: 'TEXT' },
      { col: 'resource', def: 'TEXT' },
      { col: 'record_count', def: 'INTEGER DEFAULT 0' },
      { col: 'ip_hash', def: 'TEXT' },
      { col: 'user_agent', def: 'TEXT' },
      { col: 'created_at', def: 'TEXT' },
    ],
  };

  const migratedColumns: string[] = [];

  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(${table})`).all();
      const existingCols = new Set((tableInfo.results || []).map((r: any) => String(r.name)));
      for (const { col, def } of cols) {
        if (!existingCols.has(col)) {
          try {
            await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run();
            migratedColumns.push(`${table}.${col}`);
          } catch (alterErr) {
            console.warn(`[Schema Migration] Alter table ${table} add column ${col} warning:`, alterErr);
          }
        }
      }
    } catch (pragmaErr) {
      console.warn(`[Schema Migration] Check table_info for ${table} warning:`, pragmaErr);
    }
  }

  // 获取当前表总数
  const tablesRes = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
  ).all().catch(() => ({ results: [] }));
  const tablesCount = (tablesRes.results || []).length;

  return {
    tablesCount,
    migratedColumns,
  };
}
