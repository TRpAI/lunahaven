-- ==========================================
-- 栖月账本 (Qiyue Ledger) D1 数据库迁移 0002
-- 同步元信息与版本审计表 (sync_meta)
-- ==========================================

CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,               -- 'global'
    revision INTEGER DEFAULT 1,         -- 数据版本号
    schema_version INTEGER DEFAULT 2,   -- D1 Schema 结构版本
    last_synced_at TEXT,                -- 最近同步时间戳
    updated_at TEXT NOT NULL
);

-- 初始化默认全局元数据记录
INSERT OR IGNORE INTO sync_meta (key, revision, schema_version, updated_at)
VALUES ('global', 1, 2, datetime('now'));
