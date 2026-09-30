import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Cloud,
  CloudCog,
  Copy,
  Download,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react';
import { AppSettings, LedgerFullData } from '../../types';
import {
  CLOUDFLARE_D1_SCHEMA_SQL,
  generateCloudflareD1SqlDump,
  initCloudflareD1Database,
  pullFromCloudflareWorker,
} from '../../utils/d1Sync';
import { triggerFileDownload } from '../../utils/exportImport';

interface CloudflareD1ViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  fullData: LedgerFullData;
  onImportData: (data: LedgerFullData) => void;
  onManualSync: () => Promise<boolean>;
  isSyncing: boolean;
  syncError: string | null;
}

export const CloudflareD1View: React.FC<CloudflareD1ViewProps> = ({
  settings,
  onUpdateSettings,
  fullData,
  onImportData,
  onManualSync,
  isSyncing,
  syncError,
}) => {
  const { d1Config } = settings;

  const [workerUrlInput, setWorkerUrlInput] = useState(d1Config.workerUrl || '');
  const [apiTokenInput, setApiTokenInput] = useState(d1Config.apiToken || '');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'schema' | 'tutorial'>('config');

  const [pullLoading, setPullLoading] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);

  const [initLoading, setInitLoading] = useState(false);
  const [initMsg, setInitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      d1Config: {
        ...d1Config,
        workerUrl: workerUrlInput.trim(),
        apiToken: apiTokenInput.trim(),
      },
    });
    alert('Cloudflare D1 同步配置已保存！');
  };

  const handleCopy = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleExportSqlFile = () => {
    const sql = generateCloudflareD1SqlDump(fullData);
    triggerFileDownload(sql, `qiyue_ledger_d1_backup_${new Date().toISOString().slice(0, 10)}.sql`, 'application/sql;charset=utf-8');
  };

  const handleInitDatabase = async () => {
    const url = workerUrlInput.trim() || d1Config.workerUrl;
    const token = apiTokenInput.trim() || d1Config.apiToken;

    if (!url) {
      alert('请先填入并保存 Cloudflare Worker API URL');
      return;
    }

    setInitLoading(true);
    setInitMsg(null);
    try {
      const res = await initCloudflareD1Database(url, token);
      setInitMsg({
        type: 'success',
        text: res.message || 'D1 数据库表结构（salaries, vehicles, sync_meta 等）已全部初始化成功！',
      });
      // 成功初始化后，自动尝试触发一次同步
      setTimeout(() => {
        onManualSync();
      }, 500);
    } catch (err: any) {
      setInitMsg({
        type: 'error',
        text: `初始化失败: ${err.message}`,
      });
    } finally {
      setInitLoading(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (!workerUrlInput) {
      alert('请先配置 Cloudflare Worker API 地址');
      return;
    }
    if (!window.confirm('从 Cloudflare D1 拉取数据将与本地数据合并更新，是否继续？')) {
      return;
    }

    setPullLoading(true);
    setPullMsg(null);
    try {
      const pulled = await pullFromCloudflareWorker(workerUrlInput, apiTokenInput);
      onImportData({
        ...fullData,
        salaries: (pulled.salaries as any) || fullData.salaries,
        overtimes: (pulled.overtimes as any) || fullData.overtimes,
        gifts: (pulled.gifts as any) || fullData.gifts,
        vehicles: (pulled.vehicles as any) || fullData.vehicles,
        fuels: (pulled.fuels as any) || fullData.fuels,
        maintenances: (pulled.maintenances as any) || fullData.maintenances,
      });
      setPullMsg('成功从 Cloudflare D1 恢复并合并数据！');
    } catch (err: any) {
      setPullMsg(`拉取失败: ${err.message}`);
    } finally {
      setPullLoading(false);
    }
  };

  const isTableMissingError = syncError && syncError.includes('no such table');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部标题栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            <Cloud className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Cloudflare D1 边缘数据库中心
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              原生支持 Cloudflare Workers + D1 边缘 SQLite · 本地优先沙盒 · 双向自愈同步
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {d1Config.workerUrl && (
            <button
              onClick={handleInitDatabase}
              disabled={initLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="向 Worker 发送指令自动执行 CREATE TABLE IF NOT EXISTS 初始化建表"
            >
              <Wrench className={`w-3.5 h-3.5 ${initLoading ? 'animate-spin' : ''}`} />
              <span>{initLoading ? '初始化中...' : '一键修复 D1 表结构'}</span>
            </button>
          )}

          <button
            onClick={handleExportSqlFile}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            title="生成可以直接用 wrangler d1 execute 导入的 SQL 脚本"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 D1 .sql 脚本</span>
          </button>
        </div>
      </div>

      {/* 状态总览卡片 */}
      <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900 text-white shadow-xs border border-zinc-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                Cloudflare D1 Architecture
              </span>
            </div>
            <h3 className="text-base font-bold text-white">
              {d1Config.workerUrl ? '已绑定 Cloudflare D1 远程节点' : '当前处于本地离线沙盒存储模式'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
              数据 100% 优先保存在本地沙盒中。配置 Cloudflare Worker API 密钥后，系统可将数据双向无缝同步至您的私有 D1 分布式数据库。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {d1Config.workerUrl && (
              <button
                onClick={onManualSync}
                disabled={isSyncing}
                className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? '同步中...' : '立即同步至 D1'}</span>
              </button>
            )}

            {d1Config.workerUrl && (
              <button
                onClick={handlePullFromCloud}
                disabled={pullLoading}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-zinc-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{pullLoading ? '拉取中...' : '从 D1 拉取恢复'}</span>
              </button>
            )}
          </div>
        </div>

        {d1Config.lastSyncTime && (
          <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>上次同步成功时间: {d1Config.lastSyncTime}</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 数据库状态就绪
            </span>
          </div>
        )}

        {initMsg && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs flex items-center justify-between gap-3 ${
              initMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{initMsg.text}</span>
          </div>
        )}

        {syncError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span>同步出错: {syncError}</span>
            </div>
            {isTableMissingError && (
              <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                <span className="text-rose-200">提示: D1 数据库尚未执行建表初始化 (缺少 sync_meta 等表)</span>
                <button
                  onClick={handleInitDatabase}
                  disabled={initLoading}
                  className="px-3 py-1 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors cursor-pointer shrink-0"
                >
                  {initLoading ? '正在初始化...' : '点击立即初始化 D1 表结构'}
                </button>
              </div>
            )}
          </div>
        )}

        {pullMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs">
            {pullMsg}
          </div>
        )}
      </div>

      {/* 标签栏导航 */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'config'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <CloudCog className="w-3.5 h-3.5" />
          <span>连接设置</span>
        </button>

        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'schema'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>D1 SQL Schema</span>
        </button>

        <button
          onClick={() => setActiveTab('tutorial')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'tutorial'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>3分钟部署指南</span>
        </button>
      </div>

      {/* 1. 连接设置面板 */}
      {activeTab === 'config' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Cloudflare Worker API 端点配置</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                如果您已经在 Cloudflare 部署了附带的 Worker API 脚本，可在此填入 Worker 域名和鉴权 Token。
              </p>
            </div>

            {workerUrlInput && (
              <button
                type="button"
                onClick={handleInitDatabase}
                disabled={initLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
              >
                <Sparkles className={`w-3.5 h-3.5 ${initLoading ? 'animate-spin' : ''}`} />
                <span>{initLoading ? '正在初始化...' : '一键初始化 / 修复表结构'}</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs max-w-xl">
            <div>
              <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                Cloudflare Worker API 完整 URL
              </label>
              <input
                type="url"
                placeholder="如: https://qiyue-ledger-api.your-name.workers.dev"
                value={workerUrlInput}
                onChange={(e) => setWorkerUrlInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <div>
              <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                API 鉴权密钥 (AUTH_TOKEN)
              </label>
              <input
                type="password"
                placeholder="填入在 Worker 环境变量中配置的 secret 字符串"
                value={apiTokenInput}
                onChange={(e) => setApiTokenInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                保存并应用 D1 配置
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. D1 SQL Schema 结构面板 */}
      {activeTab === 'schema' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Cloudflare D1 (SQLite) 建表语句</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                包含薪资、工时、人情、车辆、加油与维保完整建表 DDL 及 sync_meta
              </p>
            </div>
            <button
              onClick={() => handleCopy(CLOUDFLARE_D1_SCHEMA_SQL, 'schema')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium cursor-pointer"
            >
              {copiedSection === 'schema' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'schema' ? '已复制' : '复制代码'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-300 text-xs font-mono overflow-x-auto max-h-96 border border-zinc-800 leading-relaxed">
            {CLOUDFLARE_D1_SCHEMA_SQL}
          </pre>
        </div>
      )}

      {/* 3. 3分钟部署教程指南 */}
      {activeTab === 'tutorial' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            极简 4 步部署 Cloudflare Worker + D1 边缘备份云
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            本项目已在代码仓库中独立拆分了完整规范的 <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-zinc-800 dark:text-zinc-200">worker/</code> 目录（内含 migrations 迁移脚本、CORS 动态白名单和安全 Secret 鉴权）。
          </p>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">步骤 1: 创建 Cloudflare D1 边缘数据库</div>
              <p className="text-zinc-500 dark:text-zinc-400">打开终端进入项目，使用 Wrangler CLI 创建 D1 数据库：</p>
              <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono mt-1 text-[11px] overflow-x-auto">
{`npx wrangler d1 create qiyue_ledger_db`}
              </pre>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                记录终端返回的 <code className="font-mono text-zinc-300">database_id</code>，填写到 <code className="font-mono text-zinc-300">worker/wrangler.toml</code> 中。
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">步骤 2: 执行数据库版本迁移 (Migrations)</div>
              <p className="text-zinc-500 dark:text-zinc-400">
                运行项目内置的 0001 初始化建表与 0002 sync_meta 元数据迁移（或部署后在网页端点击「一键初始化表结构」）：
              </p>
              <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono mt-1 text-[11px] overflow-x-auto">
{`cd worker
npx wrangler d1 migrations apply qiyue_ledger_db --remote`}
              </pre>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">步骤 3: 设置安全密钥并部署上线</div>
              <p className="text-zinc-500 dark:text-zinc-400">
                通过 Cloudflare Secret 加密保护 API 鉴权密钥（代码中不存任何明文 Token）：
              </p>
              <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono mt-1 text-[11px] overflow-x-auto">
{`# 1. 交互式输入自定义的 API 访问凭据 (如: my-secret-2026)
npx wrangler secret put API_TOKEN

# 2. 一键发布部署到 Cloudflare 边缘节点
npx wrangler deploy`}
              </pre>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">步骤 4: 回到网页填入端点与密钥</div>
              <p className="text-zinc-500 dark:text-zinc-400">
                将部署完成后得到的 Worker URL（例如 <code className="font-mono text-zinc-300">https://qiyue-ledger-api.your-account.workers.dev</code>）与刚才设置的 <code className="font-mono text-zinc-300">API_TOKEN</code> 填入上方「连接设置」，即可畅享多设备秒级云端备份与双向同步！
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
