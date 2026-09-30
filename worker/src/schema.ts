import { Env } from './types';

export const D1_SCHEMA_SQL = `
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
);

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
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS social_gifts (
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
);

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

CREATE TABLE IF NOT EXISTS fuel_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    date TEXT NOT NULL,
    odometer REAL NOT NULL,
    fuel_amount REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_cost REAL NOT NULL,
    is_full_tank INTEGER DEFAULT 1,
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

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    revision INTEGER DEFAULT 1,
    schema_version INTEGER DEFAULT 2,
    last_synced_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salaries_month ON salaries(month);
CREATE INDEX IF NOT EXISTS idx_overtimes_date ON overtimes(date);
CREATE INDEX IF NOT EXISTS idx_social_gifts_date ON social_gifts(date);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_date ON fuel_records(vehicle_id, date);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_date ON maintenance_records(vehicle_id, date);
`;

export async function ensureDatabaseSchema(env: Env): Promise<void> {
  const statements = [
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
    `CREATE TABLE IF NOT EXISTS fuel_records (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      fuel_amount REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_cost REAL NOT NULL,
      is_full_tank INTEGER DEFAULT 1,
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
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      revision INTEGER DEFAULT 1,
      schema_version INTEGER DEFAULT 2,
      last_synced_at TEXT,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_salaries_month ON salaries(month)`,
    `CREATE INDEX IF NOT EXISTS idx_overtimes_date ON overtimes(date)`,
    `CREATE INDEX IF NOT EXISTS idx_social_gifts_date ON social_gifts(date)`,
    `CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_date ON fuel_records(vehicle_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_date ON maintenance_records(vehicle_id, date)`,
  ];

  if (typeof env.DB.exec === 'function') {
    try {
      await env.DB.exec(D1_SCHEMA_SQL);
    } catch {
      // If exec fails or has issues with multi-statement, fallback to batch
      const prepList = statements.map((sql) => env.DB.prepare(sql));
      await env.DB.batch(prepList);
    }
  } else {
    const prepList = statements.map((sql) => env.DB.prepare(sql));
    await env.DB.batch(prepList);
  }

  // Ensure default sync_meta row exists
  const nowIso = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO sync_meta (key, revision, schema_version, last_synced_at, updated_at)
       VALUES ('global', 1, 2, NULL, ?)`
    ).bind(nowIso).run();
  } catch (err) {
    console.error('Failed to insert default sync_meta:', err);
  }
}
