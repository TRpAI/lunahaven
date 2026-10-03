import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  Banknote,
  BookOpen,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  CloudCog,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Fuel,
  Gift,
  Globe,
  HelpCircle,
  Layers,
  Lock,
  RefreshCw,
  Server,
  Shield,
  ShoppingBag,
  Sparkles,
  Terminal,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import { AppSettings, LedgerFullData } from '../../types';
import {
  checkCloudflareHealth,
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
  pendingAutoSyncSeconds?: number | null;
  syncError: string | null;
}

export const CloudflareD1View: React.FC<CloudflareD1ViewProps> = ({
  settings,
  onUpdateSettings,
  fullData,
  onImportData,
  onManualSync,
  isSyncing,
  pendingAutoSyncSeconds,
  syncError,
}) => {
  const { d1Config } = settings;

  const [workerUrlInput, setWorkerUrlInput] = useState(d1Config.workerUrl || '');
  const [apiTokenInput, setApiTokenInput] = useState(d1Config.apiToken || '');
  const [autoSyncInput, setAutoSyncInput] = useState<boolean>(d1Config.autoSync ?? true);
  const [autoSyncDelayInput, setAutoSyncDelayInput] = useState<number>(d1Config.autoSyncDelaySeconds ?? 15);
  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'guide' | 'sql'>('status');

  const [pullLoading, setPullLoading] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthStatusResult, setHealthStatusResult] = useState<{
    ok: boolean;
    text: string;
    schemaVersion?: number;
    revision?: number;
    latencyMs?: number;
  } | null>(null);

  const [initLoading, setInitLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedWrangler, setCopiedWrangler] = useState(false);
  const [copiedWorkerCode, setCopiedWorkerCode] = useState(false);

  // 统计各类数据明细条数
  const salariesCount = (fullData.salaries || []).length;
  const overtimesCount = (fullData.overtimes || []).length;
  const expensesCount = (fullData.expenses || []).length;
  const giftsCount = (fullData.gifts || []).length;
  const vehiclesCount = (fullData.vehicles || []).length;
  const fuelsCount = (fullData.fuels || []).length;
  const maintenancesCount = (fullData.maintenances || []).length;
  const totalRecords =
    salariesCount +
    overtimesCount +
    expensesCount +
    giftsCount +
    vehiclesCount +
    fuelsCount +
    maintenancesCount;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      d1Config: {
        ...d1Config,
        workerUrl: workerUrlInput.trim(),
        apiToken: apiTokenInput.trim(),
        autoSync: autoSyncInput,
        autoSyncDelaySeconds: autoSyncDelayInput,
      },
    });
    alert('Cloudflare D1 同步配置已成功保存！');
  };

  const handleExportSqlFile = () => {
    const sql = generateCloudflareD1SqlDump(fullData);
    triggerFileDownload(
      sql,
      `qiyue_ledger_d1_backup_${new Date().toISOString().slice(0, 10)}.sql`,
      'application/sql;charset=utf-8'
    );
  };

  const handleRunHealthCheck = async () => {
    const url = workerUrlInput.trim() || d1Config.workerUrl;

    if (!url) {
      alert('请先填入 Cloudflare Worker API URL');
      return;
    }

    setHealthLoading(true);
    setHealthStatusResult(null);
    const start = performance.now();
    try {
      const res = await checkCloudflareHealth(url);
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        setHealthStatusResult({
          ok: true,
          text: `🟢 状态正常: Worker 服务就绪 · D1 数据库连接正常 (Schema v${res.schemaVersion ?? 2}, Revision ${res.revision ?? 1}) · 延时 ${elapsed}ms`,
          schemaVersion: res.schemaVersion ?? 2,
          revision: res.revision ?? 1,
          latencyMs: elapsed,
        });
      } else {
        setHealthStatusResult({
          ok: false,
          text: `🔴 健康检查异常: ${res.message || '数据库未连接或未执行迁移'}`,
          latencyMs: elapsed,
        });
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setHealthStatusResult({
        ok: false,
        text: `🔴 无法连接至该节点: ${err.message}`,
        latencyMs: elapsed,
      });
    } finally {
      setHealthLoading(false);
    }
  };

  const handleInitRemoteDatabase = async () => {
    const url = workerUrlInput.trim() || d1Config.workerUrl;
    const token = apiTokenInput.trim() || d1Config.apiToken;

    if (!url) {
      alert('请先填入 Cloudflare Worker API URL');
      return;
    }

    setInitLoading(true);
    try {
      const res = await initCloudflareD1Database(url, token);
      alert(`🎉 ${res.message || 'D1 数据库表结构已全部初始化就绪！'}\n现在您可以正常执行拉取与双向同步。`);
      handleRunHealthCheck();
    } catch (err: any) {
      alert(`初始化失败: ${err.message}\n您也可以切换到「建表与部署指南」标签页，复制建表 SQL 到 Cloudflare 控制台手动执行。`);
    } finally {
      setInitLoading(false);
    }
  };

  const handlePullFromCloud = async () => {
    const url = (workerUrlInput || d1Config.workerUrl || '').trim();
    const token = (apiTokenInput || d1Config.apiToken || '').trim();

    if (!url) {
      alert('请先配置 Cloudflare Worker API 地址');
      return;
    }
    if (!window.confirm('从 Cloudflare D1 拉取数据将与本地数据合并更新，是否继续？')) {
      return;
    }

    setPullLoading(true);
    setPullMsg(null);
    try {
      const res = await pullFromCloudflareWorker(url, token);
      const pulled = res.data;
      const nowStr = new Date().toLocaleString('zh-CN');
      const updatedSettings = {
        ...fullData.settings,
        d1Config: {
          ...fullData.settings.d1Config,
          lastSyncTime: nowStr,
          syncStatus: 'idle' as const,
          errorMessage: undefined,
        },
      };

      onImportData({
        ...fullData,
        salaries: (pulled.salaries as any) || fullData.salaries,
        overtimes: (pulled.overtimes as any) || fullData.overtimes,
        expenses: (pulled.expenses as any) || fullData.expenses,
        gifts: (pulled.gifts as any) || fullData.gifts,
        vehicles: (pulled.vehicles as any) || fullData.vehicles,
        fuels: (pulled.fuels as any) || fullData.fuels,
        maintenances: (pulled.maintenances as any) || fullData.maintenances,
        settings: updatedSettings,
        syncMeta: pulled.syncMeta || fullData.syncMeta,
      });
      setPullMsg(`成功从 Cloudflare D1 拉取并合并数据！(${res.isIncremental ? '增量拉取' : '全量拉取'})`);
    } catch (err: any) {
      setPullMsg(`拉取失败: ${err.message}`);
    } finally {
      setPullLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(CLOUDFLARE_D1_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const wranglerTomlExample = `name = "qiyue-ledger-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "qiyue_ledger_d1"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[vars]
AUTH_TOKEN = "your-custom-secret-password"`;

  const handleCopyWrangler = () => {
    navigator.clipboard.writeText(wranglerTomlExample);
    setCopiedWrangler(true);
    setTimeout(() => setCopiedWrangler(false), 2000);
  };

  const hasConfig = Boolean(d1Config.workerUrl);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-5xl mx-auto">
      {/* 顶部标题栏与移动端自适应操作按钮组 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            <Cloud className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <span>Cloudflare D1 边缘数据库中心</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                v2.1 生产版
              </span>
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              全球边缘低延时存储 · 增量同步与乐观锁 · 严格 Schema 控制 · 离线优先无缝双向同步
            </p>
          </div>
        </div>

        {/* 修复移动端窄屏排布异常的操作按钮组 */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
          {hasConfig && (
            <button
              onClick={handleInitRemoteDatabase}
              disabled={initLoading}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 min-w-0"
              title="一键远程调用 Worker 自动创建全部 8 张业务数据表与索引"
            >
              <Sparkles className={`w-3.5 h-3.5 shrink-0 ${initLoading ? 'animate-spin' : ''}`} />
              <span className="truncate">{initLoading ? '建表中...' : '初始化表结构'}</span>
            </button>
          )}

          {hasConfig && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 min-w-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="truncate">{isSyncing ? '同步中...' : '立即同步'}</span>
            </button>
          )}

          {hasConfig && (
            <button
              onClick={handlePullFromCloud}
              disabled={pullLoading}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 min-w-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{pullLoading ? '拉取中...' : '拉取云端'}</span>
            </button>
          )}

          {hasConfig && (
            <button
              onClick={handleRunHealthCheck}
              disabled={healthLoading}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 min-w-0"
              title="向 Worker /api/health 发送探测请求"
            >
              <Activity className={`w-3.5 h-3.5 shrink-0 ${healthLoading ? 'animate-pulse text-amber-500' : ''}`} />
              <span className="truncate">{healthLoading ? '探测中...' : '健康检查'}</span>
            </button>
          )}

          <button
            onClick={handleExportSqlFile}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer min-w-0 ${
              hasConfig ? 'col-span-2 sm:col-span-1' : 'col-span-2 sm:col-span-1'
            }`}
            title="生成可以直接导入的完整 D1 SQL 备份脚本"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">导出 SQL</span>
          </button>
        </div>
      </div>

      {/* 自动同步倒计时调度提醒 */}
      {pendingAutoSyncSeconds !== null && pendingAutoSyncSeconds !== undefined && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span className="truncate">
              检测到账目变动，将在 <b>{pendingAutoSyncSeconds}</b> 秒后自动推送同步至 D1 (连续操作自动防抖合并)。
            </span>
          </div>
          <button
            onClick={onManualSync}
            className="text-[11px] font-bold underline hover:text-amber-900 dark:hover:text-amber-100 shrink-0 cursor-pointer"
          >
            立即发送
          </button>
        </div>
      )}

      {/* 同步错误提示 */}
      {syncError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
            !
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold">云端同步出现异常</div>
            <p className="mt-0.5 opacity-90">{syncError}</p>
            <p className="mt-1 text-[11px] opacity-75">
              提示：若首次部署且提示表不存在，可点击上方【初始化表结构】或在 Cloudflare 控制台执行建表 SQL。
            </p>
          </div>
        </div>
      )}

      {/* 拉取提示 */}
      {pullMsg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
            pullMsg.includes('失败')
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{pullMsg}</span>
        </div>
      )}

      {/* 健康诊断状态 */}
      {healthStatusResult && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
            healthStatusResult.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{healthStatusResult.text}</span>
        </div>
      )}

      {/* 标签栏导航 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('status')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'status'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>当前 D1 数据库信息状态</span>
        </button>

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
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'guide'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>D1 建表和部署指南</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'sql'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>完整建表 SQL</span>
        </button>
      </div>

      {/* 1. 当前 D1 数据库信息状态卡片 (核心状态监控看板) */}
      {activeTab === 'status' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* 状态总览 4 宫格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. 边缘节点状态 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Worker 边缘节点</span>
                <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Server className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasConfig
                      ? healthStatusResult
                        ? healthStatusResult.ok
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-rose-500'
                        : 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {hasConfig ? '已接入 Worker' : '未配置 Worker'}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 truncate" title={d1Config.workerUrl || '请先在连接设置中配置 Worker 地址'}>
                {d1Config.workerUrl ? d1Config.workerUrl.replace(/^https?:\/\//, '') : '离线优先沙盒模式运行中'}
              </div>
            </div>

            {/* 2. D1 数据库绑定与 Schema 版本 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">D1 表结构版本</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Database className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                  Schema v{fullData.syncMeta?.schemaVersion || 2}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
                  Rev #{fullData.syncMeta?.revision || 1}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Binding 标识: <code className="font-mono text-zinc-700 dark:text-zinc-300">env.DB</code> (8 张核心表)
              </div>
            </div>

            {/* 3. 同步时效与策略 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">同步策略与时效</span>
                <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {d1Config.autoSync ? '自动防抖同步' : '纯手动同步'}
                </span>
                {d1Config.autoSync && (
                  <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                    ({d1Config.autoSyncDelaySeconds ?? 15}s)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                {d1Config.lastSyncTime ? `上次同步: ${d1Config.lastSyncTime}` : '暂无云端同步历史'}
              </div>
            </div>

            {/* 4. 账本数据资产总规模 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">数据资产总规模</span>
                <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Layers className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                  {totalRecords}
                </span>
                <span className="text-xs text-zinc-500">笔明细数据</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                双端增量比对 · 乐观锁冲突自愈
              </div>
            </div>
          </div>

          {/* D1 数据表明细卡片 */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-500" />
                  <span>D1 边缘数据库已注册业务表结构清单</span>
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  所有表均包含主键 UUID、逻辑删除 deleted_at 与增量索引字段
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunHealthCheck}
                  disabled={healthLoading}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin text-amber-500' : ''}`} />
                  <span>探测 D1 连通状态</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* salaries */}
              <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">salaries</div>
                    <div className="text-[10px] text-zinc-400">工资薪酬与五险一金</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{salariesCount} 笔</span>
              </div>

              {/* overtimes */}
              <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">overtimes</div>
                    <div className="text-[10px] text-zinc-400">加班工时与调休池</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{overtimesCount} 笔</span>
              </div>

              {/* expenses */}
              <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">expenses</div>
                    <div className="text-[10px] text-zinc-400">日常/医疗/教育开销</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{expensesCount} 笔</span>
              </div>

              {/* social_gifts */}
              <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-600 flex items-center justify-center shrink-0">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">social_gifts</div>
                    <div className="text-[10px] text-zinc-400">人情随礼与往来账</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{giftsCount} 笔</span>
              </div>

              {/* vehicles */}
              <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">vehicles</div>
                    <div className="text-[10px] text-zinc-400">车辆档案与参数</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{vehiclesCount} 辆</span>
              </div>

              {/* fuel_records */}
              <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center shrink-0">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">fuel_records</div>
                    <div className="text-[10px] text-zinc-400">加油补能与能耗</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{fuelsCount} 笔</span>
              </div>

              {/* maintenance_records */}
              <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">maintenances</div>
                    <div className="text-[10px] text-zinc-400">维修保养与车险</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{maintenancesCount} 笔</span>
              </div>

              {/* sync_meta & settings */}
              <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">sync_meta & logs</div>
                    <div className="text-[10px] text-zinc-400">同步元数据与审计</div>
                  </div>
                </div>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">在线</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. 连接设置面板 */}
      {activeTab === 'config' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CloudCog className="w-4 h-4 text-indigo-500" />
                <span>Cloudflare Worker API 端点配置</span>
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
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

            {/* 操作触发自动推送同步设置 */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    操作后自动推送同步
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    在账本发生增删改变动后，自动将最新本地数据推送同步至 D1
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoSyncInput(!autoSyncInput)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    autoSyncInput ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      autoSyncInput ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {autoSyncInput && (
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      操作后推送等待时间 (防抖缓冲)
                    </span>
                    <p className="text-[11px] text-zinc-400">连续多笔操作将在此时间段内合并为单次增量请求</p>
                  </div>
                  <select
                    value={autoSyncDelayInput}
                    onChange={(e) => setAutoSyncDelayInput(parseInt(e.target.value))}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs focus:outline-hidden shrink-0"
                  >
                    <option value={0}>0 秒 (每次操作后立即推送)</option>
                    <option value={5}>5 秒</option>
                    <option value={15}>15 秒 (默认推荐)</option>
                    <option value={30}>30 秒</option>
                    <option value={60}>1 分钟</option>
                    <option value={300}>5 分钟 (大批记录批量汇总结算)</option>
                  </select>
                </div>
              )}
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

      {/* 3. 新卡片：D1 建表和部署指南 (全面生产级说明指南) */}
      {activeTab === 'guide' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-6 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <span>Cloudflare D1 边缘数据库建表与生产部署指南</span>
            </h3>
            <p className="text-zinc-400 dark:text-zinc-500 mt-1">
              通过 Cloudflare Workers + D1 免费搭建个人高可用边缘数据库，实现手机、电脑、平板全端实时增量多活同步。
            </p>
          </div>

          {/* 步骤一：创建 D1 数据库 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <span className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs font-mono">
                1
              </span>
              <span>创建 Cloudflare D1 数据库</span>
            </div>
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2">
              <p>在本地终端或项目根目录运行以下命令（或直接在 Cloudflare Dashboard 控制台创建）：</p>
              <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto select-all">
                npx wrangler d1 create qiyue_ledger_d1
              </pre>
              <p className="text-[11px] text-zinc-400">
                执行后命令行将输出对应的 <code className="font-mono text-zinc-700 dark:text-zinc-300">database_id</code>（例如：<code className="font-mono">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>）。
              </p>
            </div>
          </div>

          {/* 步骤二：绑定 Worker 与环境变量 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <span className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs font-mono">
                2
              </span>
              <span>配置 wrangler.toml 与 Worker 绑定</span>
            </div>
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span>在 <code className="font-mono text-zinc-800 dark:text-zinc-200">worker/wrangler.toml</code> 中填入您的 database_id 与 AUTH_TOKEN：</span>
                <button
                  onClick={handleCopyWrangler}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  {copiedWrangler ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWrangler ? '已复制' : '复制配置'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto select-all">
                {wranglerTomlExample}
              </pre>
            </div>
          </div>

          {/* 步骤三：初始化数据库建表 (3 种方式) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <span className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs font-mono">
                3
              </span>
              <span>初始化 D1 数据表结构（三选一）</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 space-y-1.5">
                <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>方式 A（最简推荐）</span>
                </div>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  部署 Worker 后，在上方填入 Worker URL，直接点击顶部【初始化表结构】按钮，Worker 会远程自动创建 8 张数据表与索引。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5">
                <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-zinc-500" />
                  <span>方式 B（控制台执行）</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  登录 Cloudflare 控制台 → 进入 D1 Database → 点击你的数据库 → 切换到 <b>Console</b> → 粘贴「完整建表 SQL」执行。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5">
                <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-zinc-500" />
                  <span>方式 C（Wrangler 迁移）</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  npx wrangler d1 execute qiyue_ledger_d1 --file=./schema.sql --remote
                </p>
              </div>
            </div>
          </div>

          {/* 步骤四：部署 Worker 并应用 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              <span className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs font-mono">
                4
              </span>
              <span>发布部署 Worker 并连接账本</span>
            </div>
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2">
              <p>进入 <code className="font-mono text-zinc-800 dark:text-zinc-200">worker/</code> 目录并执行发布：</p>
              <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto select-all">
                npx wrangler deploy
              </pre>
              <p className="text-[11px] text-zinc-400">
                发布完成后，将获得的 Worker URL（如 <code className="font-mono text-zinc-600 dark:text-zinc-300">https://qiyue-ledger-api.xxx.workers.dev</code>）与 AUTH_TOKEN 填入上方【连接设置】中，即可享受秒级全球同步！
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. SQL 手动执行面板 */}
      {activeTab === 'sql' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-500" />
                <span>Cloudflare D1 完整建表 SQL 语句 (Schema v2)</span>
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                可直接复制下方 SQL，在 Cloudflare 控制台（D1 Database → 你的数据库 → Console）中一键粘贴执行。
              </p>
            </div>

            <button
              onClick={handleCopySql}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              {copiedSql ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? '已复制 SQL' : '一键复制完整 SQL'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto max-h-96 border border-zinc-800 select-all">
            <pre className="whitespace-pre">{CLOUDFLARE_D1_SCHEMA_SQL}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
