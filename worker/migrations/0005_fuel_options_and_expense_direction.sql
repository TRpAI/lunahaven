-- ==========================================
-- 栖月账本 (Qiyue Ledger) D1 数据库迁移 0005
-- 加油充电亮灯报警与漏记标志，以及综合支出方向字段
-- ==========================================

-- 1. fuel_records 表新增亮灯报警与漏记标志
ALTER TABLE fuel_records ADD COLUMN is_warning_light_on INTEGER DEFAULT 0;
ALTER TABLE fuel_records ADD COLUMN is_missed_previous INTEGER DEFAULT 0;

-- 2. expenses 表新增资金往来方向 (out: 支出, in: 礼金收入)
ALTER TABLE expenses ADD COLUMN direction TEXT DEFAULT 'out';
