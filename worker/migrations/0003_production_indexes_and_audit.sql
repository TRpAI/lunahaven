-- ==========================================
-- 栖月账本 (Qiyue Ledger) D1 数据库迁移 0003
-- 生产级复合索引与审计日志表 (audit_logs)
-- ==========================================

-- 1. 增量查询与软删除复合索引
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

-- 2. 操作审计日志表 (audit_logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,               -- 'SYNC_PUSH', 'SYNC_PULL', 'SETTINGS_UPDATE'
    resource TEXT NOT NULL,             -- 'sync_batch', 'salaries', etc.
    resource_id TEXT,
    record_count INTEGER DEFAULT 0,     -- 变动条数
    ip_hash TEXT,                       -- 来源 IP 摘要
    user_agent TEXT,                    -- 客户端 UA 摘要
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
