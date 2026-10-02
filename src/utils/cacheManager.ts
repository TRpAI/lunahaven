/**
 * 栖月账本 · 缓存管理与强制更新机制
 * 支持一键清理 Service Worker 预缓存、Web Cache Storage、并强制更新至最新生产版本
 */

/**
 * 清理所有浏览器缓存 (Cache Storage & Service Worker) 并强制无缓存刷新
 */
export async function forceClearCacheAndReload(): Promise<void> {
  try {
    // 1. 清理 Cache Storage 中的所有旧版本缓存（如 workbox-precache 等）
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    // 2. 取消注册所有激活的 Service Worker，迫使下次加载重新下载最新 Worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }

    // 3. 附加随机时间戳执行硬重载，确保绕过 CDN 与本地 HTTP 磁盘缓存
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  } catch (err) {
    console.error('清理缓存失败，执行普通重载:', err);
    window.location.reload();
  }
}

/**
 * 检查 Service Worker 是否有待激活的新版本
 */
export async function checkForServiceWorkerUpdate(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          return true;
        }
      }
    } catch (e) {
      console.warn('检查 SW 更新失败:', e);
    }
  }
  return false;
}
