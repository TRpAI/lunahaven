import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Qiyue Ledger] Uncaught Application Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xl text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto border border-rose-200/60 dark:border-rose-900/60">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold tracking-tight">应用运行异常已自动拦截</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                系统检测到未捕获的渲染异常，您的本地 IndexedDB 与账本数据完整无损。请点击下方按钮重新安全加载。
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-left font-mono text-[11px] text-zinc-600 dark:text-zinc-400 max-h-32 overflow-y-auto break-all border border-zinc-200/60 dark:border-zinc-700/60">
                <span className="font-semibold text-rose-600 dark:text-rose-400">Error: </span>
                {this.state.error.message || 'Unknown Error'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>安全重新加载</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
