import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cloud,
  CloudCog,
  Code2,
  Copy,
  Download,
  HelpCircle,
  Play,
  RefreshCw,
  Sparkles,
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
  const [activeTab, setActiveTab] = useState<'config' | 'tutorial' | 'sql'>('config');

  const [pullLoading, setPullLoading] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthStatusResult, setHealthStatusResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [initLoading, setInitLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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
      alert(`🎉 ${res.message || 'D1 数据库表结构已全部初始化就绪！'}\n现在您可以正常执行拉取与同步。`);
      handleRunHealthCheck();
    } catch (err: any) {
      alert(`初始化失败: ${err.message}\n您也可以切换到「SQL 建表语句」标签页，复制建表 SQL 到 Cloudflare 控制台手动执行。`);
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
      setPullMsg(`成功从 Cloudflare D1 拉取并合并数据！(${res.isIncremental ? '增量模式' : '全量模式'})`);
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

        <div className="flex flex-wrap items-center gap-2">
          {d1Config.workerUrl && (
            <button
              onClick={handleInitRemoteDatabase}
              disabled={initLoading}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="一键调用 Worker 远程自动创建所有缺失的 D1 数据表"
            >
              <Sparkles className={`w-3.5 h-3.5 ${initLoading ? 'animate-spin' : ''}`} />
              <span>{initLoading ? '建表中...' : '一键初始化 D1 表结构'}</span>
            </button>
          )}

          {d1Config.workerUrl && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '同步中...' : '立即同步至 D1'}</span>
            </button>
          )}

          {d1Config.workerUrl && (
            <button
              onClick={handlePullFromCloud}
              disabled={pullLoading}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{pullLoading ? '拉取中...' : '从 D1 拉取恢复'}</span>
            </button>
          )}

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

      {/* 自动同步倒计时调度提醒 */}
      {pendingAutoSyncSeconds !== null && pendingAutoSyncSeconds !== undefined && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span>
              检测到账目变动，将在 <b>{pendingAutoSyncSeconds}</b> 秒后自动推送同步至 D1。期间进行连续操作将自动防抖合并。
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
          <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</div>
          <div className="flex-1">
            <div className="font-bold">云端同步出现异常</div>
            <p className="mt-0.5 opacity-90">{syncError}</p>
            <p className="mt-1 text-[11px] opacity-75">
              提示：若首次部署且提示表不存在，可点击上方【一键初始化 D1 表结构】或在 Cloudflare 控制台执行建表 SQL。
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
          onClick={() => setActiveTab('sql')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'sql'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>D1 建表 SQL (手动执行)</span>
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

      {/* 2. SQL 手动执行面板 */}
      {activeTab === 'sql' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-500" />
                <span>Cloudflare D1 完整建表 SQL 语句</span>
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

          <div className="p-4 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto max-h-96 border border-zinc-800">
            <pre className="whitespace-pre">{CLOUDFLARE_D1_SCHEMA_SQL}</pre>
          </div>
        </div>
      )}

      {/* 3. 3分钟生产部署教程指南 */}
      {activeTab === 'tutorial' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            极简 3 步部署 Cloudflare Worker + D1 边缘数据库
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            本项目已在代码仓库中独立拆分了完整规范的 <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-zinc-800 dark:text-zinc-200">worker/</code> 目录（内含自动表结构自愈、生产严格 CORS 与 Secret 鉴权）。
          </p>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">方式 A（最简推荐）：部署 Worker 后网页一键建表</div>
              <p className="text-zinc-500 dark:text-zinc-400">
                1. 在 Cloudflare 部署 Worker 后，在网页填入 Worker URL 与 API_TOKEN。<br />
                2. 直接点击顶部【一键初始化 D1 表结构】按钮，Worker 会自动在 D1 创建全部 8 张业务表与索引！
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">方式 B：Cloudflare 控制台 Web Console 粘贴执行</div>
              <p className="text-zinc-500 dark:text-zinc-400">
                登录 Cloudflare Dashboard → 左侧进入 <b>D1 SQL Database</b> → 点击你的数据库 → 进入 <b>Console</b> 选项卡 → 复制上方「D1 建表 SQL」标签页中的语句直接点击 <b>Execute</b>。
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">方式 C：使用 Wrangler CLI 命令行迁移</div>
              <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono mt-1 text-[11px] overflow-x-auto">
{`cd worker
npx wrangler d1 migrations apply qiyue_ledger_d1 --remote`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
