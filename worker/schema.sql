-- ========================================================
-- 栖月账本 (Qiyue Ledger) Cloudflare D1 生产级完整数据库 Schema
-- SQLite Dialect for Cloudflare D1 Database (全量 10 表结构)
-- 包含：油表黄灯报警、漏记补能、开销流向、调休记录、审计日志与版本元数据
-- 运行命令：npx wrangler d1 execute <DB_NAME> --file=schema.sql
-- ========================================================

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

-- 5. 加油与充电记录表 (包含油表黄灯报警与漏记标志)
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
    is_missed_previous INTEGER DEFAULT 0,  -- 1:漏记补能, 0:正常
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

-- 7. 日常生活、医疗、教育与综合支出表 (包含 direction 字段)
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    type TEXT NOT NULL,                 -- living / medical / gift / education / travel
    category TEXT NOT NULL,             -- 细分项目
    amount REAL NOT NULL,               -- 金额
    direction TEXT DEFAULT 'out',       -- out / in
    payer TEXT,
    payment_method TEXT,
    beneficiary TEXT,
    remarks TEXT,
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
CREATE INDEX IF NOT EXISTS idx_expenses_updated ON expenses(updated_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 默认全局元数据记录
INSERT OR IGNORE INTO sync_meta (key, revision, schema_version, last_synced_at, updated_at)
VALUES ('global', 1, 2, NULL, datetime('now'));
