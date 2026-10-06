-- ==========================================
-- 栖月账本 (Qiyue Ledger) D1 数据库迁移 0006
-- 加班长夜班标志与补贴，薪酬加点细项、长夜班津贴、全勤奖、五险一金自定义与自定义扣除项
-- ==========================================

-- 1. overtimes 表新增长夜班标志与长夜班单日补贴
ALTER TABLE overtimes ADD COLUMN is_night_shift INTEGER DEFAULT 0;
ALTER TABLE overtimes ADD COLUMN night_shift_subsidy REAL DEFAULT 0;

-- 2. salaries 表新增加班明细拆解 (1.5x / 2.0x / 3.0x)
ALTER TABLE salaries ADD COLUMN overtime_15_hours REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN overtime_15_pay REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN overtime_20_hours REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN overtime_20_pay REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN overtime_30_hours REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN overtime_30_pay REAL DEFAULT 0;

-- 3. salaries 表新增长夜班天数与补贴统计
ALTER TABLE salaries ADD COLUMN night_shift_days REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN night_shift_rate REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN night_shift_pay REAL DEFAULT 0;

-- 4. salaries 表新增全勤补贴与常规基础津贴与自定义补贴 JSON
ALTER TABLE salaries ADD COLUMN full_attendance_pay REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN base_allowance REAL DEFAULT 0;
ALTER TABLE salaries ADD COLUMN custom_allowances_json TEXT;

-- 5. salaries 表新增五险一金自定义微调标志、自定义扣除项与其它扣除项合计
ALTER TABLE salaries ADD COLUMN is_custom_insurance INTEGER DEFAULT 0;
ALTER TABLE salaries ADD COLUMN custom_deductions_json TEXT;
ALTER TABLE salaries ADD COLUMN other_deductions_total REAL DEFAULT 0;
