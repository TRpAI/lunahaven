-- ==========================================
-- 栖月账本 (Qiyue Ledger) D1 数据库迁移 0004
-- 综合开销与五大支出分类表 (expenses)
-- ==========================================

CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    type TEXT NOT NULL,                 -- living (日常生活) / medical (医疗健康) / gift (人情随礼) / education (教育专项) / travel (旅游度假)
    category TEXT NOT NULL,             -- 餐饮美食/居家物业/门诊就医/结婚随礼/课外培优/机票酒店等
    amount REAL NOT NULL,               -- 支出金额
    payer TEXT,                         -- 出资人
    payment_method TEXT,                -- 支付方式 (微信/支付宝/银行卡/医保等)
    beneficiary TEXT,                   -- 受益对象
    remarks TEXT,                       -- 备注说明
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_expenses_date_del ON expenses(date, deleted_at);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);
CREATE INDEX IF NOT EXISTS idx_expenses_updated ON expenses(updated_at);
