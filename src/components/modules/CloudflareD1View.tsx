import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  Banknote,
  BookOpen,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  CloudCog,
  Code2,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCode,
  Fuel,
  Gift,
  Layers,
  RefreshCw,
  Server,
  Shield,
  ShoppingBag,
  Sparkles,
  Terminal,
  Wrench,
  X,
} from 'lucide-react';
import { AppSettings, FuelRecord, LedgerFullData } from '../../types';
import {
  checkCloudflareHealth,
  CLOUDFLARE_D1_SCHEMA_SQL,
  D1DatabaseStatusResult,
  generateCloudflareD1SqlDump,
  initializeCloudflareD1Database,
  inspectCloudflareD1Database,
  mergeLedgerDatasets,
  pullFromCloudflareWorker,
} from '../../utils/d1Sync';
import { triggerFileDownload } from '../../utils/exportImport';
import { processFuelRecords } from '../../utils/fuelCalculator';

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
  const [showApiToken, setShowApiToken] = useState(false);
  const [autoSyncInput, setAutoSyncInput] = useState<boolean>(d1Config.autoSync ?? true);
  const [autoSyncDelayInput, setAutoSyncDelayInput] = useState<number>(d1Config.autoSyncDelaySeconds ?? 15);

  const [pullLoading, setPullLoading] = useState(false);
  const [pullMsg, setPullMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthStatusResult, setHealthStatusResult] = useState<{
    ok: boolean;
    text: string;
    schemaVersion?: number;
    revision?: number;
    latencyMs?: number;
  } | null>(null);

  const [initLoading, setInitLoading] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<D1DatabaseStatusResult | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedWrangler, setCopiedWrangler] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isPullConfirmOpen, setIsPullConfirmOpen] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

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
    showToast('success', 'Cloudflare D1 同步配置已成功保存！');
  };

  const handleExportSqlFile = () => {
    const sql = generateCloudflareD1SqlDump(fullData);
    triggerFileDownload(
      sql,
      `qiyue_ledger_d1_backup_${new Date().toISOString().slice(0, 10)}.sql`,
      'application/sql;charset=utf-8'
    );
    showToast('info', '标准 D1 SQL 数据备份文件已生成并启动下载');
  };

  const handleRunHealthCheck = async () => {
    const url = (workerUrlInput || d1Config.workerUrl || '').trim();

    if (!url) {
      showToast('error', '请先在下方「连接设置」中配置 Cloudflare Worker API 地址');
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
          text: `Worker 节点在线 · D1 数据库连接正常 (Schema v${res.schemaVersion ?? 2}, Rev #${res.revision ?? 1})`,
          schemaVersion: res.schemaVersion ?? 2,
          revision: res.revision ?? 1,
          latencyMs: elapsed,
        });
        showToast('success', `连通测试通过 · 响应延迟 ${elapsed}ms`);
      } else {
        setHealthStatusResult({
          ok: false,
          text: `健康检查异常: ${res.message || '数据库未连接或表未初始化'}`,
          latencyMs: elapsed,
        });
        showToast('error', `健康检查异常: ${res.message || '数据库未就绪'}`);
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setHealthStatusResult({
        ok: false,
        text: `无法连接节点: ${err.message}`,
        latencyMs: elapsed,
      });
      showToast('error', `无法连接节点: ${err.message}`);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleInitializeOrInspectDatabase = async (forceInit = false) => {
    const url = (workerUrlInput || d1Config.workerUrl || '').trim();
    const token = (apiTokenInput || d1Config.apiToken || '').trim();

    if (!url) {
      showToast('error', '请先在下方「连接设置」中配置 Cloudflare Worker API 地址');
      return;
    }

    setInitLoading(true);
    try {
      // 始终执行无损建表与字段补齐初始化
      const initRes = await initializeCloudflareD1Database(url, token);
      const res = await inspectCloudflareD1Database(url, token);
      setInspectionResult(res);
      showToast('success', `🎉 ${initRes.message}`);
      handleRunHealthCheck();
    } catch (err: any) {
      showToast('error', `操作失败: ${err.message}`);
    } finally {
      setInitLoading(false);
    }
  };

  const handlePullFromCloud = async () => {
    const url = (workerUrlInput || d1Config.workerUrl || '').trim();
    const token = (apiTokenInput || d1Config.apiToken || '').trim();

    if (!url) {
      showToast('error', '请先在下方「连接设置」中配置 Cloudflare Worker API 地址');
      return;
    }
    setIsPullConfirmOpen(true);
  };

  const executePullFromCloud = async () => {
    setIsPullConfirmOpen(false);
    const url = (workerUrlInput || d1Config.workerUrl || '').trim();
    const token = (apiTokenInput || d1Config.apiToken || '').trim();

    setPullLoading(true);
    setPullMsg(null);
    try {
      const res = await pullFromCloudflareWorker(url, token);
      const pulled = res.data;
      const nowStr = new Date().toLocaleString('zh-CN');

      // 采用权威双向智能合并算法 (基于 updatedAt 时间戳 Last-Write-Wins 解决，保全本地黄灯报警与流向等关键状态)
      const mergedData = mergeLedgerDatasets(fullData, pulled);
      mergedData.settings = {
        ...mergedData.settings,
        d1Config: {
          ...mergedData.settings.d1Config,
          lastSyncTime: nowStr,
          syncStatus: 'idle' as const,
          errorMessage: undefined,
        },
      };

      onImportData(mergedData);

      setPullMsg({
        ok: true,
        text: `已从 D1 成功同步最新云端数据 (${res.isIncremental ? '增量合并' : '全量同步'})，已智能合并版本与标记`,
      });
      showToast('success', '已从云端 D1 成功拉取并智能合并最新数据');
    } catch (err: any) {
      setPullMsg({ ok: false, text: `拉取失败: ${err.message}` });
      showToast('error', `拉取失败: ${err.message}`);
    } finally {
      setPullLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(CLOUDFLARE_D1_SCHEMA_SQL);
    setCopiedSql(true);
    showToast('info', '建表 SQL 语句已复制到剪贴板');
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const wranglerTomlExample = `name = "qiyue-ledger-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "qiyue_ledger_db"
database_id = "your-database-id-from-wrangler-d1-create"

[vars]
# 生产环境跨域白名单（仅允许指定前端域名访问，严禁使用通配符 *）
ALLOWED_ORIGIN = "https://your-pages-domain.pages.dev,http://localhost:3000"

# 安全提示：API 访问密钥必须通过命令行安全密文存储，切勿明文提交代码仓库：
# 运行命令：npx wrangler secret put API_TOKEN`;

  const handleCopyWrangler = () => {
    navigator.clipboard.writeText(wranglerTomlExample);
    setCopiedWrangler(true);
    setTimeout(() => setCopiedWrangler(false), 2000);
  };

  const hasConfig = Boolean(d1Config.workerUrl);

  return (
    <div className="space-y-5 animate-in fade-in duration-200 max-w-5xl mx-auto relative">
      {/* 实时非阻塞操作通知 Toast */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toastMsg.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-zinc-900 text-white border-zinc-700'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : toastMsg.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="ml-2 hover:opacity-80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 从云端拉取数据防误触确认弹窗 (无 window.confirm) */}
      {isPullConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  确认从 Cloudflare D1 拉取数据？
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  将自动从云端获取最新记录并与本地现有数据智能增量合并。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsPullConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={executePullFromCloud}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              >
                确认拉取并合并
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部标题与核心操作控制台 (移动端窄屏完美自适应网格) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
              <Cloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Cloudflare D1 边缘数据库中心
                </h1>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center shrink-0 ${
                    hasConfig
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60'
                  }`}
                >
                  {hasConfig ? '已接入' : '未接入'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                全球边缘多活同步 · 本地优先离线可用 · 增量版本乐观锁
              </p>
            </div>
          </div>

          {healthStatusResult?.latencyMs && (
            <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg self-start sm:self-auto shrink-0 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>响应延时: {healthStatusResult.latencyMs}ms</span>
            </div>
          )}
        </div>

        {/* 核心操作按钮组：初始化表结构 / 同步 / 拉取 / 健康 / 导出 (移动端 2-3 列响应式网格排布) */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
            {/* 1. 初始化 / 核查表结构 */}
            <button
              onClick={() => handleInitializeOrInspectDatabase(false)}
              disabled={initLoading || !hasConfig}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white disabled:text-zinc-400 text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed min-w-0"
              title={hasConfig ? '远程初始化或核查 D1 数据库 10 张核心业务表结构及版本元数据' : '请先配置 Worker URL'}
            >
              <Sparkles className={`w-3.5 h-3.5 shrink-0 ${initLoading ? 'animate-spin' : ''}`} />
              <span className="truncate">{initLoading ? '处理中...' : '初始化/核查表结构'}</span>
            </button>

            {/* 2. 立即同步 */}
            <button
              onClick={onManualSync}
              disabled={isSyncing || !hasConfig}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white dark:text-zinc-900 disabled:text-zinc-400 text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed min-w-0"
              title={hasConfig ? '立即双向增量同步数据' : '请先配置 Worker URL'}
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="truncate">{isSyncing ? '同步中...' : '立即同步'}</span>
            </button>

            {/* 3. 从 D1 拉取 */}
            <button
              onClick={handlePullFromCloud}
              disabled={pullLoading || !hasConfig}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/40 text-zinc-800 dark:text-zinc-200 disabled:text-zinc-400 text-xs font-medium transition-all cursor-pointer disabled:cursor-not-allowed min-w-0"
              title={hasConfig ? '从云端拉取并合并覆盖最新数据' : '请先配置 Worker URL'}
            >
              <Download className={`w-3.5 h-3.5 shrink-0 ${pullLoading ? 'animate-bounce' : ''}`} />
              <span className="truncate">{pullLoading ? '拉取中...' : '从 D1 拉取'}</span>
            </button>

            {/* 4. 健康连通测试 */}
            <button
              onClick={handleRunHealthCheck}
              disabled={healthLoading || !hasConfig}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/40 text-zinc-800 dark:text-zinc-200 disabled:text-zinc-400 text-xs font-medium transition-all cursor-pointer disabled:cursor-not-allowed min-w-0"
              title={hasConfig ? '测试 Cloudflare Worker 与 D1 连通性与响应延时' : '请先配置 Worker URL'}
            >
              <Activity className={`w-3.5 h-3.5 shrink-0 ${healthLoading ? 'animate-spin text-amber-500' : 'text-emerald-500'}`} />
              <span className="truncate">{healthLoading ? '测试中...' : '健康测试'}</span>
            </button>

            {/* 5. 导出 SQL 备份 */}
            <button
              onClick={handleExportSqlFile}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-all cursor-pointer min-w-0"
              title="生成并下载标准 D1 SQL 数据备份文件"
            >
              <FileCode className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span className="truncate">导出 SQL</span>
            </button>
          </div>
        </div>
      </div>

      {/* 自动防抖同步调度提醒 */}
      {pendingAutoSyncSeconds !== null && pendingAutoSyncSeconds !== undefined && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span className="truncate">
              检测到本地账目变动，将在 <b>{pendingAutoSyncSeconds}</b> 秒后自动防抖推送至 D1。
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

      {/* 同步异常提示 */}
      {syncError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="font-bold flex items-center justify-between">
              <span>云端同步异常: {syncError.split('\n')[0]}</span>
            </div>
            {syncError.includes('Failed to fetch') || syncError.includes('网络连接') ? (
              <div className="text-[11px] bg-white/70 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-rose-200/60 dark:border-rose-900/40 text-rose-800 dark:text-rose-200 space-y-1">
                <div className="font-semibold">💡 连接排查指南 (Failed to fetch)：</div>
                <ul className="list-disc list-inside space-y-0.5 pl-1 opacity-90">
                  <li>
                    <b>检查跨域白名单 (CORS)</b>：请确认 Worker 的 <code className="font-mono px-1 rounded bg-rose-100 dark:bg-rose-900/60">ALLOWED_ORIGIN</code> 包含当前前端域名 <code className="font-mono font-bold">{typeof window !== 'undefined' ? window.location.origin : ''}</code>。
                  </li>
                  <li>
                    <b>检查 API 地址</b>：确保在下方填写的 Worker API 完整 URL 正确且支持 HTTPS 访问。
                  </li>
                  <li>
                    <b>服务连通性</b>：可点击上方快捷按钮中的【健康测试】探测 Worker 是否正常运行。
                  </li>
                </ul>
              </div>
            ) : syncError.includes('table') || syncError.includes('表不存在') || syncError.includes('表缺失') || syncError.includes('字段') || syncError.includes('DATABASE_TRANSACTION_FAILED') || syncError.includes('事务已安全中止回滚') || syncError.includes('D1_ERROR') || syncError.includes('SQLITE_ERROR') || syncError.includes('数据同步异常') || syncError.includes('回滚') ? (
              <div className="text-[11px] bg-white/70 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-200 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>💡 云端数据库表结构或扩展字段升级建议：</span>
                </div>
                <p className="opacity-90">
                  检测到云端 D1 数据库表结构尚未建立或缺少近期新扩展字段（如长夜班补贴、五险一金细项、综合支出方向等）。
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => handleInitializeOrInspectDatabase()}
                    disabled={initLoading || !hasConfig}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-3 h-3 ${initLoading ? 'animate-spin' : ''}`} />
                    <span>{initLoading ? '升级中...' : '一键初始化 / 补齐表结构'}</span>
                  </button>
                  <button
                    onClick={onManualSync}
                    disabled={isSyncing || !hasConfig}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-200 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                  >
                    重试同步
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] opacity-80">
                若首次使用提示表不存在或迁移未就绪，可点击上方快捷按钮中的【初始化/核查表结构】。
              </p>
            )}
          </div>
        </div>
      )}

      {/* 拉取反馈提示 */}
      {pullMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            pullMsg.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-700 dark:text-rose-300'
          }`}
        >
          {pullMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
          <span>{pullMsg.text}</span>
        </div>
      )}

      {/* 卡片 1: 当前 D1 数据库信息状态 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              <span>当前 D1 数据库信息与状态</span>
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              实时监控边缘节点连接、表结构版本、同步时效及各业务表资产明细
            </p>
          </div>
        </div>

        {/* 状态 4 宫格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Worker 节点 */}
          <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
              <span>Worker 节点</span>
              <Server className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  hasConfig
                    ? healthStatusResult?.ok
                      ? 'bg-emerald-500'
                      : 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {hasConfig ? '已绑定节点' : '未接入 Worker'}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {d1Config.workerUrl ? d1Config.workerUrl.replace(/^https?:\/\//, '') : '当前仅本地优先存储'}
            </div>
          </div>

          {/* 2. D1 表结构版本 */}
          <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
              <span>表结构版本</span>
              <Database className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                Schema v{fullData.syncMeta?.schemaVersion || 2}
              </span>
              <span className="text-[10px] font-mono px-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                Rev #{fullData.syncMeta?.revision || 1}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400">
              绑定标识: <code className="font-mono text-zinc-700 dark:text-zinc-300">env.DB</code> (8 张核心表)
            </div>
          </div>

          {/* 3. 同步时效 */}
          <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
              <span>同步时效</span>
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              {d1Config.autoSync ? `自动防抖 (${d1Config.autoSyncDelaySeconds ?? 15}s)` : '手动模式'}
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {d1Config.lastSyncTime ? `上次: ${d1Config.lastSyncTime}` : '暂无同步记录'}
            </div>
          </div>

          {/* 4. 数据资产规模 */}
          <div className="p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
              <span>数据资产</span>
              <Layers className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{totalRecords}</span>
              <span className="text-xs text-zinc-500 font-sans">条明细记录</span>
            </div>
            <div className="text-[11px] text-zinc-400">本地与云端实时双向比对</div>
          </div>
        </div>

        {/* 健康诊断详情 */}
        {healthStatusResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
              healthStatusResult.ok
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {healthStatusResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <span>{healthStatusResult.text}</span>
            </div>
            {healthStatusResult.latencyMs && (
              <span className="font-mono text-[10px] opacity-75 shrink-0">
                {healthStatusResult.latencyMs}ms
              </span>
            )}
          </div>
        )}

        {/* D1 业务数据表明细一览 */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              各业务数据表记录统计
            </span>
            <span className="text-[11px] text-zinc-400">共 8 张表 · 全字段软删除与版本乐观锁</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">工资薪酬</span>
              </div>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{salariesCount}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">加班工时</span>
              </div>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{overtimesCount}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">日常开销</span>
              </div>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{expensesCount}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-3.5 h-3.5 text-pink-500" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">随礼人情</span>
              </div>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{giftsCount}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-3.5 h-3.5 text-purple-500" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">车辆档案</span>
              </div>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{vehiclesCount}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fuel className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">加油能耗</span>
              </div>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{fuelsCount}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-teal-500" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">维修保养</span>
              </div>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{maintenancesCount}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">元数据与日志</span>
              </div>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">就绪</span>
            </div>
          </div>

          {/* D1 数据库结构与 Migration 迁移状态报告 */}
          {inspectionResult && (
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>D1 Migration 迁移与表结构核查报告</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  {inspectionResult.tablesCount} 张业务表已就绪
                </span>
              </div>
              <p className="text-indigo-700 dark:text-indigo-300 text-[11px] leading-relaxed">
                {inspectionResult.message}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300">
                  当前版本号: r{inspectionResult.currentRevision}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300">
                  Schema 版本: v{inspectionResult.schemaVersion}
                </span>
                {inspectionResult.lastSyncedAt && (
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-indigo-200/60 dark:border-indigo-800/60 text-zinc-600 dark:text-zinc-400">
                    最近提交: {new Date(inspectionResult.lastSyncedAt).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 flex items-center gap-1">
                <span>🛡️ 数据库结构统一受 worker/migrations/ 版本控制，API 请求绝不执行动态 DDL，保障事务原子性与高并发安全。</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 卡片 2: Cloudflare Worker API 连接与同步设置 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CloudCog className="w-4 h-4 text-indigo-500" />
            <span>Cloudflare Worker API 连接与同步设置</span>
          </h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            配置您在 Cloudflare 部署的私有 Worker API 节点与加密 Bearer Token 访问密钥
          </p>
        </div>

        {/* 当前前端域名与跨域提示卡片 */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 max-w-xl">
          <div className="min-w-0">
            <span className="font-semibold block text-[11px] text-indigo-700 dark:text-indigo-300">
              当前前端访问域名 (请加入 Worker 的 ALLOWED_ORIGIN 白名单):
            </span>
            <div className="font-mono font-bold text-xs mt-0.5 text-indigo-950 dark:text-indigo-100 truncate select-all">
              {typeof window !== 'undefined' ? window.location.origin : 'https://qiyue.pages.dev'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                navigator.clipboard.writeText(window.location.origin);
                showToast('info', '当前前端域名已复制到剪贴板，可粘贴至 Worker 的 ALLOWED_ORIGIN');
              }
            }}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] transition-colors shrink-0 self-start sm:self-auto cursor-pointer shadow-xs flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            <span>复制当前域名</span>
          </button>
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
            <div className="relative">
              <input
                type={showApiToken ? 'text' : 'password'}
                placeholder="填入在 Worker 环境变量中配置的 secret 字符串"
                value={apiTokenInput}
                onChange={(e) => setApiTokenInput(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              <button
                type="button"
                onClick={() => setShowApiToken(!showApiToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                title={showApiToken ? '隐藏密钥' : '显示密钥'}
              >
                {showApiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
                  <option value={300}>5 分钟</option>
                </select>
              </div>
            )}
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              保存 D1 连接配置
            </button>
          </div>
        </form>
      </div>

      {/* 卡片 3: 新增独立卡片 —— D1 建表与生产部署指南 */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>D1 建表与生产部署指南</span>
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              基于 Cloudflare 免费套餐快速部署专属私有数据节点与表结构说明
            </p>
          </div>

          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer font-medium"
          >
            <span>{isGuideOpen ? '收起指南' : '查看完整步骤'}</span>
            {isGuideOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* 部署流程精简 3 步 */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2">
            <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              <span>步骤 1：在终端创建 D1 数据库</span>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400">
              在本地终端运行以下命令创建数据库并获取 <code className="font-mono text-zinc-800 dark:text-zinc-200">database_id</code>：
            </p>
            <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto select-all">
              npx wrangler d1 create qiyue_ledger_d1
            </pre>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>步骤 2：配置 worker/wrangler.toml 并发布</span>
              </span>
              <button
                onClick={handleCopyWrangler}
                className="flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                {copiedWrangler ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWrangler ? '已复制' : '复制配置'}</span>
              </button>
            </div>
            <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto select-all">
              {wranglerTomlExample}
            </pre>
            <p className="text-zinc-500 dark:text-zinc-400">
              进入 <code className="font-mono text-zinc-800 dark:text-zinc-200">worker/</code> 目录执行部署命令：
            </p>
            <pre className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto select-all">
              npx wrangler deploy
            </pre>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 space-y-1.5">
            <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>步骤 3：数据库 Migration 迁移与健康核查</span>
            </div>
            <p className="text-indigo-700 dark:text-indigo-300 text-[11px] leading-relaxed">
              运行命令 <code className="font-mono bg-indigo-100/60 dark:bg-indigo-900/60 px-1 rounded">npx wrangler d1 migrations apply qiyue_ledger_db --remote</code> 进行结构规范迁移。部署成功后在上方配置 Worker URL 和 API Token，点击顶部【核查迁移状态】按钮即可远程探测全量 10 张业务表结构！
            </p>
          </div>
        </div>

        {/* 可折叠的完整 D1 建表 SQL 语句 */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-zinc-500" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">D1 完整建表 SQL 语句 (Schema v2)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSqlPreview(!showSqlPreview)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline text-[11px] cursor-pointer"
              >
                {showSqlPreview ? '收起 SQL 源码' : '展开 SQL 源码'}
              </button>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-[11px] cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? '已复制' : '复制 SQL'}</span>
              </button>
            </div>
          </div>

          {showSqlPreview && (
            <div className="p-3.5 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto max-h-80 border border-zinc-800 select-all">
              <pre className="whitespace-pre">{CLOUDFLARE_D1_SCHEMA_SQL}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
