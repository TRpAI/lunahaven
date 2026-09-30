import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { OvertimeRecord, OvertimeSettlement, OvertimeType } from '../../types';
import { exportOvertimesToCsv, triggerFileDownload } from '../../utils/exportImport';
import { formatCurrency } from '../../utils/taxCalculator';
import { CalendarHeatmap } from '../charts/CalendarHeatmap';

interface OvertimeViewProps {
  overtimes: OvertimeRecord[];
  onSaveOvertime: (record: OvertimeRecord) => void;
  onDeleteOvertime: (id: string) => void;
  hidePrivacy: boolean;
  defaultBaseSalary?: number;
}

export const OvertimeView: React.FC<OvertimeViewProps> = ({
  overtimes,
  onSaveOvertime,
  onDeleteOvertime,
  hidePrivacy,
  defaultBaseSalary = 18000,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 默认每小时基准薪资 = 基本工资 / 21.75 / 8
  const defaultHourlyWage = Math.round((defaultBaseSalary / 21.75 / 8) * 100) / 100;

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'workday' as OvertimeType,
    startTime: '18:30',
    endTime: '21:30',
    durationHours: 3,
    settlementType: 'paid' as OvertimeSettlement,
    hourlyRate: defaultHourlyWage,
    compTimeHoursUsed: 0,
    reason: '',
    approver: '',
    notes: '',
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      type: 'workday',
      startTime: '18:30',
      endTime: '21:30',
      durationHours: 3,
      settlementType: 'paid',
      hourlyRate: defaultHourlyWage,
      compTimeHoursUsed: 0,
      reason: '',
      approver: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (o: OvertimeRecord) => {
    setEditingId(o.id);
    setFormData({
      date: o.date,
      type: o.type,
      startTime: o.startTime,
      endTime: o.endTime,
      durationHours: o.durationHours,
      settlementType: o.settlementType,
      hourlyRate: o.hourlyRate,
      compTimeHoursUsed: o.compTimeHoursUsed || 0,
      reason: o.reason,
      approver: o.approver || '',
      notes: o.notes,
    });
    setIsModalOpen(true);
  };

  const getMultiplier = (type: OvertimeType): number => {
    if (type === 'holiday') return 3.0;
    if (type === 'weekend') return 2.0;
    return 1.5;
  };

  const calculateHours = (start: string, end: string): number => {
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let minutes = eh * 60 + em - (sh * 60 + sm);
      if (minutes < 0) minutes += 24 * 60; // 跨夜
      return Math.round((minutes / 60) * 10) / 10;
    } catch {
      return 3;
    }
  };

  const handleTimeChange = (start: string, end: string) => {
    const hours = calculateHours(start, end);
    setFormData({
      ...formData,
      startTime: start,
      endTime: end,
      durationHours: hours,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const multiplier = getMultiplier(formData.type);
    const durationHours = Number(formData.durationHours) || 0;
    const hourlyRate = Number(formData.hourlyRate) || defaultHourlyWage;
    const estimatedPay = Math.round(durationHours * hourlyRate * multiplier * 100) / 100;

    const newRecord: OvertimeRecord = {
      id: editingId || `ot-${Date.now()}`,
      date: formData.date,
      type: formData.type,
      startTime: formData.startTime,
      endTime: formData.endTime,
      durationHours,
      multiplier,
      settlementType: formData.settlementType,
      hourlyRate,
      estimatedPay: formData.settlementType === 'paid' ? estimatedPay : 0,
      compTimeHoursUsed: formData.settlementType === 'comp_time' ? (formData.compTimeHoursUsed || 0) : 0,
      reason: formData.reason || '日常加班',
      approver: formData.approver,
      notes: formData.notes,
      createdAt: editingId ? (overtimes.find((o) => o.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    onSaveOvertime(newRecord);
    setIsModalOpen(false);
  };

  const handleExportCsv = () => {
    const csv = exportOvertimesToCsv(overtimes);
    triggerFileDownload(csv, `个人加班工时与调休流水_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  };

  // 汇总数据
  const totalHours = overtimes.reduce((acc, o) => acc + o.durationHours, 0);
  const totalPaidPay = overtimes
    .filter((o) => o.settlementType === 'paid')
    .reduce((acc, o) => acc + (o.estimatedPay || 0), 0);

  const totalCompTimeTotal = overtimes
    .filter((o) => o.settlementType === 'comp_time')
    .reduce((acc, o) => acc + o.durationHours, 0);
  const totalCompTimeUsed = overtimes
    .filter((o) => o.settlementType === 'comp_time')
    .reduce((acc, o) => acc + (o.compTimeHoursUsed || 0), 0);
  const compTimeAvailable = Math.max(0, totalCompTimeTotal - totalCompTimeUsed);

  // 热力图数据映射
  const datesWithHours: Record<string, number> = {};
  for (const o of overtimes) {
    datesWithHours[o.date] = (datesWithHours[o.date] || 0) + o.durationHours;
  }

  const typeNameMap = {
    workday: '工作日延时 (1.5x)',
    weekend: '周末休息日 (2.0x)',
    holiday: '法定节假日 (3.0x)',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部标题栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            <Clock className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              加班与工时管理
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              加班时长核算 · 1.5x/2x/3x 倍率换算 · 调休池与加班费
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 CSV</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>记一笔加班</span>
          </button>
        </div>
      </div>

      {/* 4 统计指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">可用调休余额</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2 flex items-baseline gap-1">
            <span>{compTimeAvailable}</span>
            <span className="text-xs font-normal text-zinc-400">小时 (约 {(compTimeAvailable / 8).toFixed(1)} 天)</span>
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">累计加班总时长</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2 flex items-baseline gap-1">
            <span>{totalHours}</span>
            <span className="text-xs font-normal text-zinc-400">小时</span>
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">已发放加班费总额</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {formatCurrency(totalPaidPay, hidePrivacy)}
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">计算基准时薪</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            ¥{defaultHourlyWage}/h
          </div>
        </div>
      </div>

      {/* 加班热力图 */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <CalendarHeatmap datesWithHours={datesWithHours} daysCount={70} />
      </div>

      {/* 加班记录流水列表 */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">加班与调休流水明细</h3>
        {overtimes.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
            <Clock className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium">暂无加班记录</p>
            <button
              onClick={handleOpenAdd}
              className="mt-3 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs"
            >
              录入第一笔加班
            </button>
          </div>
        ) : (
          overtimes.map((o) => (
            <div
              key={o.id}
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 font-bold border border-zinc-200/60 dark:border-zinc-700/60">
                  {o.multiplier}x
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{o.reason || '项目加班'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                      {typeNameMap[o.type]}
                    </span>
                    {o.settlementType === 'comp_time' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200/60 dark:border-zinc-700/60">
                        调休 (剩 {Math.max(0, o.durationHours - (o.compTimeHoursUsed || 0))}h)
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                        兑现加班费
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 flex items-center gap-2">
                    <span>{o.date}</span>
                    <span>·</span>
                    <span>{o.startTime} ~ {o.endTime} ({o.durationHours} 小时)</span>
                    {o.approver && <span>· 审批人: {o.approver}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                <div className="text-right">
                  {o.settlementType === 'paid' ? (
                    <div>
                      <span className="text-[10px] text-zinc-400 block">核算加班费</span>
                      <span className="font-mono font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(o.estimatedPay, hidePrivacy)}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-zinc-400 block">计入调休池</span>
                      <span className="font-mono font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                        +{o.durationHours}h
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(o)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    title="编辑"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('确定删除该笔加班记录吗？')) {
                        onDeleteOvertime(o.id);
                      }
                    }}
                    className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 模态框：录入/编辑加班 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-zinc-500" />
                <span>{editingId ? '编辑加班记录' : '登记新加班'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班日期</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班类型</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as OvertimeType })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <option value="workday">工作日延时 (1.5倍薪资)</option>
                    <option value="weekend">周末公休日 (2.0倍薪资)</option>
                    <option value="holiday">法定节假日 (3.0倍薪资)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">开始时间</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => handleTimeChange(e.target.value, formData.endTime)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">结束时间</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => handleTimeChange(formData.startTime, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">加班工时 (h)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={formData.durationHours}
                    onChange={(e) => setFormData({ ...formData, durationHours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">结算方式</label>
                  <select
                    value={formData.settlementType}
                    onChange={(e) => setFormData({ ...formData, settlementType: e.target.value as OvertimeSettlement })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="paid">发放加班费</option>
                    <option value="comp_time">存入调休池</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">基准时薪 (元/h)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {formData.settlementType === 'comp_time' && (
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">已消耗调休时数 (小时)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.compTimeHoursUsed}
                    onChange={(e) => setFormData({ ...formData, compTimeHoursUsed: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">加班事项/项目</label>
                  <input
                    type="text"
                    placeholder="如: 项目封板上线 / 应急保障"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">审批人/领导</label>
                  <input
                    type="text"
                    placeholder="如: 张经理"
                    value={formData.approver}
                    onChange={(e) => setFormData({ ...formData, approver: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* 实时预估核算 */}
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                <span>预估可获权益:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                  {formData.settlementType === 'paid'
                    ? `加班费 ¥${(formData.durationHours * formData.hourlyRate * getMultiplier(formData.type)).toFixed(2)}`
                    : `可调休 ${formData.durationHours} 小时`}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold shadow-xs cursor-pointer"
                >
                  保存记录
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
