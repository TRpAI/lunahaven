import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// 注册并监听 Service Worker，发布新版本时自动静默刷新激活
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // 发现线上新版本资源，立即触发静默更新并接管
      updateSW(true);
    },
    onOfflineReady() {
      console.log('栖月账本已进入本地优先离线沙盒运行状态');
    },
    onRegisterError(error) {
      console.warn('Service Worker 注册异常:', error);
    },
  });

  // 当用户重新切回当前标签页或窗口时，主动向服务器检测最新构建版本
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateSW();
    }
  });

  // 窗口重新获得焦点时也检测一次
  window.addEventListener('focus', () => {
    updateSW();
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
