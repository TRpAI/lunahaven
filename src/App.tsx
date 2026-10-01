import React, { useState } from 'react';
import { MobileNav } from './components/MobileNav';
import { AnalyticsView } from './components/modules/AnalyticsView';
import { CloudflareD1View } from './components/modules/CloudflareD1View';
import { DashboardView } from './components/modules/DashboardView';
import { ExpensesView } from './components/modules/ExpensesView';
import { GiftsView } from './components/modules/GiftsView';
import { SalaryOvertimeView } from './components/modules/SalaryOvertimeView';
import { SettingsView } from './components/modules/SettingsView';
import { VehicleView } from './components/modules/VehicleView';
import { Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PrivacyLockModal } from './components/PrivacyLockModal';
import { QuickAddModal } from './components/QuickAddModal';
import { Sidebar } from './components/Sidebar';
import { useLedgerData } from './hooks/useLedgerData';
import { useOneDriveAutoBackup } from './hooks/useOneDriveAutoBackup';
import { usePrivacyLock } from './hooks/usePrivacyLock';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);

  const {
    data,
    saveSalary,
    deleteSalary,
    saveOvertime,
    deleteOvertime,
    saveGift,
    deleteGift,
    saveExpense,
    deleteExpense,
    saveVehicle,
    deleteVehicle,
    saveFuel,
    deleteFuel,
    saveMaintenance,
    deleteMaintenance,
    updateSettings,
    importFullData,
    resetDemo,
    clearAll,
    refreshData,
    syncWithCloudflare,
    isSyncing,
    pendingAutoSyncSeconds,
    syncError,
  } = useLedgerData();

  const {
    isUnlocked,
    hasPassword,
    verifyPassword,
    verify2FACode,
    setMasterPassword,
    enable2FA,
    disable2FA,
    lockNow,
    recordActivity,
  } = usePrivacyLock(data.settings, updateSettings);

  // 全局定时增量自动备份至 OneDrive
  useOneDriveAutoBackup(data.settings, data, updateSettings);

  const handleToggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(isSystemDark ? 'light' : 'dark');
    }
  };

  const handleQuickAction = (type: 'salary' | 'overtime' | 'expense' | 'gift' | 'fuel' | 'maintenance') => {
    if (type === 'salary' || type === 'overtime') setActiveTab('salary');
    else if (type === 'expense') setActiveTab('expenses');
    else if (type === 'gift') setActiveTab('gift');
    else if (type === 'fuel' || type === 'maintenance') setActiveTab('vehicle');
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900 transition-colors"
      onClick={recordActivity}
      onKeyDown={recordActivity}
    >
      {/* 单用户与二步验证 (2FA) 锁屏遮罩 */}
      {!isUnlocked && (
        <PrivacyLockModal
          hasPassword={hasPassword}
          onVerifyPassword={verifyPassword}
          onVerify2FACode={verify2FACode}
          onSetPassword={setMasterPassword}
        />
      )}

      {/* 离线状态提示 */}
      <OfflineIndicator />

      {/* 全局快捷新建悬浮/弹窗 */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSelectAction={handleQuickAction}
      />

      {/* 顶部主导航栏 */}
      <Navbar
        settings={data.settings}
        onUpdateSettings={updateSettings}
        onLockScreen={lockNow}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onManualSync={syncWithCloudflare}
        onRefreshData={refreshData}
        isSyncing={isSyncing}
        pendingAutoSyncSeconds={pendingAutoSyncSeconds}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* 桌面端左侧导航 */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          counts={{
            salaries: data.salaries.length,
            overtimes: data.overtimes.length,
            expenses: (data.expenses || []).length,
            gifts: data.gifts.length,
            fuels: data.fuels.length,
          }}
        />

        {/* 主内容区域 */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-full overflow-x-hidden">
          {activeTab === 'dashboard' && (
            <DashboardView
              data={data}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
              onSelectTab={setActiveTab}
              onSaveFuel={saveFuel}
              onSaveMaintenance={saveMaintenance}
            />
          )}

          {(activeTab === 'salary' || activeTab === 'overtime') && (
            <SalaryOvertimeView
              salaries={data.salaries}
              onSaveSalary={saveSalary}
              onDeleteSalary={deleteSalary}
              overtimes={data.overtimes}
              onSaveOvertime={saveOvertime}
              onDeleteOvertime={deleteOvertime}
              hidePrivacy={data.settings.privacyMaskNumbers}
              defaultRates={data.settings.insuranceRates}
              defaultBaseSalary={data.salaries.length > 0 ? data.salaries[0].baseSalary : 18000}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={data.expenses || []}
              onSaveExpense={saveExpense}
              onDeleteExpense={deleteExpense}
              hidePrivacy={data.settings.privacyMaskNumbers}
            />
          )}

          {activeTab === 'gift' && (
            <GiftsView
              gifts={data.gifts}
              onSaveGift={saveGift}
              onDeleteGift={deleteGift}
              hidePrivacy={data.settings.privacyMaskNumbers}
            />
          )}

          {activeTab === 'vehicle' && (
            <VehicleView
              vehicles={data.vehicles}
              fuels={data.fuels}
              maintenances={data.maintenances}
              activeVehicleId={data.settings.activeVehicleId}
              onChangeActiveVehicle={(id) => updateSettings({ activeVehicleId: id })}
              onSaveVehicle={saveVehicle}
              onDeleteVehicle={deleteVehicle}
              onSaveFuel={saveFuel}
              onDeleteFuel={deleteFuel}
              onSaveMaintenance={saveMaintenance}
              onDeleteMaintenance={deleteMaintenance}
              hidePrivacy={data.settings.privacyMaskNumbers}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView data={data} hidePrivacy={data.settings.privacyMaskNumbers} />
          )}

          {activeTab === 'cloudflare' && (
            <CloudflareD1View
              settings={data.settings}
              onUpdateSettings={updateSettings}
              fullData={data}
              onImportData={importFullData}
              onManualSync={syncWithCloudflare}
              isSyncing={isSyncing}
              pendingAutoSyncSeconds={pendingAutoSyncSeconds}
              syncError={syncError}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={data.settings}
              onUpdateSettings={updateSettings}
              fullData={data}
              onImportFullData={importFullData}
              onResetDemo={resetDemo}
              onClearAll={clearAll}
              onSetPin={setMasterPassword}
              onEnable2FA={enable2FA}
              onDisable2FA={disable2FA}
              onLockScreen={lockNow}
              theme={theme}
              onSetTheme={setTheme}
            />
          )}
        </main>
      </div>

      {/* 移动端底部导航 */}
      <MobileNav activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
}
