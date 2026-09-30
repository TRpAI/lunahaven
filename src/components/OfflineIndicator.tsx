import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl bg-amber-600/95 text-white px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-xs border border-amber-500/50 animate-bounce">
      <WifiOff className="w-3.5 h-3.5" />
      <span>离线模式 — 本地数据库正常保存</span>
    </div>
  );
};
