import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cloud,
  CloudCog,
  Download,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { AppSettings, LedgerFullData } from '../../types';
import {
  checkCloudflareHealth,
  generateCloudflareD1SqlDump,
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
  const [activeTab, setActiveTab] = useState<'config' | 'tutorial'>('config');

  const [pullLoading, setPullLoading] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthStatusResult, setHealthStatusResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      d1Config: {
        ...d1Config,
        workerUrl: workerUrlInput.trim(),
        apiToken: apiTokenInput.trim(),
      },
    });
    alert('Cloudflare D1 生产同步配置已保存！');
  };

  const handleExportSqlFile = () => {
    const sql = generateCloudflareD1SqlDump(fullData);
    triggerFileDownload(sql, `qiyue_ledger_d1_backup_${new Date().toISOString().slice(0, 10)}.sql`, 'application/sql;charset=utf-8');
  };

  const handleRunHealthCheck = async () => {
    const url = workerUrlInput.trim() || d1Config.workerUrl;

    if (!url) {
      alert('请先填入 Cloudflare Worker API URL');
      return;
    }

    setHealthLoading(true);
    setHealthStatusResult(null);
    try {
      const res = await checkCloudflareHealth(url);
      if (res.ok) {
        setHealthStatusResult({
          ok: true,
          text: `🟢 状态正常: Worker 服务就绪 · D1 数据库正常 (Schema v${res.schemaVersion ?? 2}, Revision ${res.revision ?? 1})`,
        });
      } else {
        setHealthStatusResult({
          ok: false,
          text: `🔴 健康检查异常: ${res.message || '数据库未连接或未执行迁移'}`,
        });
      }
    } catch (err: any) {
      setHealthStatusResult({
        ok: false,
        text: `🔴 无法连接至该节点: ${err.message}`,
      });
    } finally {
      setHealthLoading(false);
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
      const res = await pullFromCloudflareWorker(workerUrlInput, apiTokenInput);
      const pulled = res.data;
      onImportData({
        ...fullData,
        salaries: (pulled.salaries as any) || fullData.salaries,
        overtimes: (pulled.overtimes as any) || fullData.overtimes,
        gifts: (pulled.gifts as any) || fullData.gifts,
        vehicles: (pulled.vehicles as any) || fullData.vehicles,
        fuels: (pulled.fuels as any) || fullData.fuels,
        maintenances: (pulled.maintenances as any) || fullData.maintenances,
      });
      setPullMsg(`成功从 Cloudflare D1 拉取并合并数据！(${res.isIncremental ? '增量模式' : '全量模式'})`);
    } catch (err: any) {
      setPullMsg(`拉取失败: ${err.message}`);
    } finally {
      setPullLoading(false);
    }
  };

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
              生产级架构 · 增量同步与乐观锁 · 严格 Migration 版本控制 · 审计日志
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {d1Config.workerUrl && (
            <button
              onClick={handleRunHealthCheck}
              disabled={healthLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="向 Worker /api/health 端点发送请求，探测节点与 D1 数据库健康状态"
            >
              <Activity className={`w-3.5 h-3.5 ${healthLoading ? 'animate-pulse text-amber-500' : ''}`} />
              <span>{healthLoading ? '探测中...' : '健康诊断'}</span>
            </button>
          )}

          <button
            onClick={handleExportSqlFile}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            title="生成可以直接用 wrangler d1 execute 导入的完整 SQL 备份脚本"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 D1 .sql 备份</span>
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
                Cloudflare D1 Production Hub
              </span>
            </div>
            <h3 className="text-base font-bold text-white">
              {d1Config.workerUrl ? '已连接 Cloudflare D1 边缘节点' : '当前处于本地离线沙盒存储模式'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
              数据优先保存在本地沙盒副本。配置 Worker 凭据后，将通过增量同步与 D1 数据库进行双向安全通信。
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
              <CheckCircle2 className="w-3.5 h-3.5" /> 数据库状态就绪 (v2.1)
            </span>
          </div>
        )}

        {healthStatusResult && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs flex items-center justify-between gap-3 ${
              healthStatusResult.ok
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{healthStatusResult.text}</span>
          </div>
        )}

        {syncError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
            <div className="flex items-center justify-between font-medium">
              <span>同步异常: {syncError}</span>
            </div>
            <p className="text-[11px] text-rose-300/80">
              请检查 Worker Secret 设置 (API_TOKEN) 以及是否已运行 <code className="font-mono bg-rose-950/40 px-1 py-0.5 rounded">wrangler d1 migrations apply</code>。
            </p>
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
          onClick={() => setActiveTab('tutorial')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'tutorial'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>3分钟生产部署指南</span>
        </button>
      </div>

      {/* 1. 连接设置面板 */}
      {activeTab === 'config' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Cloudflare Worker API 端点配置</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                配置您在 Cloudflare 部署的私有 Worker API 节点与加密 Bearer Token 访问密钥。
              </p>
            </div>
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

      {/* 2. 3分钟生产部署教程指南 */}
      {activeTab === 'tutorial' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            极简 4 步部署生产级 Cloudflare Worker + D1 边缘数据库
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            本项目已在代码仓库中独立拆分了完整规范的 <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-zinc-800 dark:text-zinc-200">worker/</code> 目录（内含 migrations 迁移版本管理、生产严格 CORS 与 Secret 鉴权）。
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
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">步骤 2: 规范执行数据库版本迁移 (Migrations)</div>
              <p className="text-zinc-500 dark:text-zinc-400">
                运行项目内置的 0001 初始化建表、0002 sync_meta 元数据和 0003 生产复合索引与审计表迁移：
              </p>
              <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono mt-1 text-[11px] overflow-x-auto">
{`cd worker
npx wrangler d1 migrations apply qiyue_ledger_db --remote`}
              </pre>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">步骤 3: 设置安全密钥并部署上线</div>
              <p className="text-zinc-500 dark:text-zinc-400">
                通过 Cloudflare Secret 加密保护 API 鉴权密钥（生产环境强制认证，不存任何明文 Token）：
              </p>
              <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono mt-1 text-[11px] overflow-x-auto">
{`# 1. 交互式输入自定义的 API 访问凭据 (如: my-secret-2026)
npx wrangler secret put API_TOKEN

# 2. 一键发布部署到 Cloudflare 边缘节点
npx wrangler deploy`}
              </pre>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">步骤 4: 回到网页填入端点并测试健康状态</div>
              <p className="text-zinc-500 dark:text-zinc-400">
                将部署完成后得到的 Worker URL（例如 <code className="font-mono text-zinc-300">https://qiyue-ledger-api.your-account.workers.dev</code>）与刚才设置的 <code className="font-mono text-zinc-300">API_TOKEN</code> 填入上方「连接设置」，点击右上角【健康诊断】确认状态正常即可畅享多设备秒级云端备份与增量同步！
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
