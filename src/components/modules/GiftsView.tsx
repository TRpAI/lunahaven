import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Edit2,
  Gift,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  GiftDirection,
  GiftOccasion,
  GiftRelation,
  ReturnStatus,
  SocialGiftRecord,
} from '../../types';
import { exportGiftsToCsv, triggerFileDownload } from '../../utils/exportImport';
import { formatCurrency } from '../../utils/taxCalculator';

interface GiftsViewProps {
  gifts: SocialGiftRecord[];
  onSaveGift: (record: SocialGiftRecord) => void;
  onDeleteGift: (id: string) => void;
  hidePrivacy: boolean;
}

export const GiftsView: React.FC<GiftsViewProps> = ({
  gifts,
  onSaveGift,
  onDeleteGift,
  hidePrivacy,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 筛选与搜索状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'out' | 'in'>('all');
  const [relationFilter, setRelationFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    direction: 'out' as GiftDirection,
    personName: '',
    relation: 'friend' as GiftRelation,
    eventType: 'wedding' as GiftOccasion,
    amount: 1000,
    returnStatus: 'pending' as ReturnStatus,
    returnAmount: 0,
    location: '',
    notes: '',
  });

  // 提取历史随礼对象/关系人列表供下拉选择
  const frequentGiftContacts = useMemo(() => {
    const set = new Set<string>();
    gifts.forEach((g) => {
      if (g.personName && g.personName.trim()) {
        set.add(g.personName.trim());
      }
    });
    return Array.from(set).slice(0, 30);
  }, [gifts]);

  const relationLabels: Record<GiftRelation, string> = {
    relative: '亲戚长辈',
    friend: '朋友挚友',
    colleague: '同事',
    leader: '领导',
    classmate: '同学',
    client: '客户',
    neighbor: '邻居',
    other: '其他关系',
  };

  const eventLabels: Record<GiftOccasion, string> = {
    wedding: '结婚喜宴',
    baby: '满月生子',
    housewarming: '乔迁之喜',
    birthday: '生日聚会',
    longevity: '长辈寿辰',
    funeral: '白事慰问',
    illness: '探病问候',
    holiday: '节日拜年',
    education: '升学谢师',
    other: '其他事由',
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      direction: 'out',
      personName: '',
      relation: 'friend',
      eventType: 'wedding',
      amount: 1000,
      returnStatus: 'pending',
      returnAmount: 0,
      location: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (g: SocialGiftRecord) => {
    setEditingId(g.id);
    setFormData({
      date: g.date,
      direction: g.direction,
      personName: g.personName,
      relation: g.relation,
      eventType: g.eventType,
      amount: g.amount,
      returnStatus: g.returnStatus,
      returnAmount: g.returnAmount || 0,
      location: g.location || '',
      notes: g.notes,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: SocialGiftRecord = {
      id: editingId || `gift-${Date.now()}`,
      date: formData.date,
      direction: formData.direction,
      personName: formData.personName.trim() || '未命名',
      relation: formData.relation,
      eventType: formData.eventType,
      amount: Number(formData.amount) || 0,
      returnStatus: formData.returnStatus,
      returnAmount: Number(formData.returnAmount) || 0,
      location: formData.location.trim(),
      notes: formData.notes.trim(),
      createdAt: editingId ? (gifts.find((g) => g.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    onSaveGift(newRecord);
    setIsModalOpen(false);
  };

  const handleExportCsv = () => {
    const csv = exportGiftsToCsv(gifts);
    triggerFileDownload(csv, `人情往来礼金明细_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  };

  // 统计数据
  const totalOut = gifts.filter((g) => g.direction === 'out').reduce((acc, g) => acc + g.amount, 0);
  const totalIn = gifts.filter((g) => g.direction === 'in').reduce((acc, g) => acc + g.amount, 0);
  const balance = totalIn - totalOut;
  const pendingReturnCount = gifts.filter((g) => g.direction === 'in' && g.returnStatus === 'pending').length;

  // 过滤列表
  const filteredGifts = useMemo(() => {
    return gifts.filter((g) => {
      const matchKeyword =
        !searchKeyword ||
        g.personName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (g.location && g.location.toLowerCase().includes(searchKeyword.toLowerCase())) ||
        (g.notes && g.notes.toLowerCase().includes(searchKeyword.toLowerCase()));

      const matchDir = directionFilter === 'all' || g.direction === directionFilter;
      const matchRel = relationFilter === 'all' || g.relation === relationFilter;
      const matchEvent = eventFilter === 'all' || g.eventType === eventFilter;

      return matchKeyword && matchDir && matchRel && matchEvent;
    });
  }, [gifts, searchKeyword, directionFilter, relationFilter, eventFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部标题栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            <Gift className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              人情往来随礼账本
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              送礼支出 · 礼金收礼 · 往来差额自动对账 · 待回礼提醒
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
            <span>记一笔随礼</span>
          </button>
        </div>
      </div>

      {/* 4 统计指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">总送出随礼 (支出)</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {formatCurrency(totalOut, hidePrivacy)}
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">总收到礼金 (收入)</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {formatCurrency(totalIn, hidePrivacy)}
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">人情净差额 (收-支)</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2 flex items-center gap-1">
            {balance >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-500" /> : <ArrowDownRight className="w-5 h-5 text-rose-500" />}
            <span>{formatCurrency(Math.abs(balance), hidePrivacy)}</span>
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">待跟进回礼事项</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {pendingReturnCount} <span className="text-xs font-normal text-zinc-400">笔</span>
          </div>
        </div>
      </div>

      {/* 搜索与筛选工具条 */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col md:flex-row items-center gap-3 text-xs">
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索姓名、地点、事由备注..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* 方向过滤 */}
          <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setDirectionFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                directionFilter === 'all'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setDirectionFilter('out')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                directionFilter === 'out'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              送出 (支)
            </button>
            <button
              onClick={() => setDirectionFilter('in')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                directionFilter === 'in'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              收到 (收)
            </button>
          </div>

          {/* 关系过滤 */}
          <select
            value={relationFilter}
            onChange={(e) => setRelationFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
          >
            <option value="all">所有关系</option>
            {Object.entries(relationLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* 事由过滤 */}
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
          >
            <option value="all">所有事由</option>
            {Object.entries(eventLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 人情记录列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>共找到 {filteredGifts.length} 笔往来流水</span>
        </div>

        {filteredGifts.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
            <Gift className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium">暂无人情随礼记录</p>
            <button
              onClick={handleOpenAdd}
              className="mt-3 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs"
            >
              录入第一笔随礼
            </button>
          </div>
        ) : (
          filteredGifts.map((g) => (
            <div
              key={g.id}
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 font-bold border border-zinc-200/60 dark:border-zinc-700/60"
                >
                  {g.direction === 'out' ? '支' : '收'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{g.personName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                      {relationLabels[g.relation]}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                      {eventLabels[g.eventType]}
                    </span>
                    {g.direction === 'in' && g.returnStatus === 'pending' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60 font-medium">
                        待回礼
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
                    <span>{g.date}</span>
                    {g.location && <span>· {g.location}</span>}
                    {g.notes && <span>· 备注: {g.notes}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block">{g.direction === 'out' ? '送出金额' : '收到礼金'}</span>
                  <span className="font-mono font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                    {g.direction === 'out' ? '-' : '+'}{formatCurrency(g.amount, hidePrivacy)}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(g)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                    title="编辑"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('确定删除该笔随礼记录吗？')) {
                        onDeleteGift(g.id);
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

      {/* 模态框：录入/编辑人情 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs my-auto max-h-[calc(100vh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Gift className="w-5 h-5 text-zinc-500" />
                <span>{editingId ? '编辑随礼记录' : '记一笔人情随礼'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 flex-1">
              {/* 方向与金额 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">随礼方向</label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as GiftDirection })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <option value="out">送出礼金 (我的支出)</option>
                    <option value="in">收到礼金 (我的收入)</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">礼金金额 (元)</label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              {/* 姓名与日期 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium">
                      {formData.direction === 'in' ? '送礼人 / 关系对象' : '随礼对象 / 关系人'}
                    </label>
                    <span className="text-[10px] text-zinc-400">支持下拉选择</span>
                  </div>
                  <div className="space-y-1.5">
                    <select
                      value={
                        frequentGiftContacts.includes(formData.personName) ||
                        ['父母长辈', '公婆岳父母', '叔伯姑姨', '舅父舅母', '表哥表姐', '大学同窗', '高中同学', '部门同事', '直属领导', '挚友闺蜜'].includes(formData.personName)
                          ? formData.personName
                          : formData.personName
                          ? '__custom__'
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && val !== '__custom__') {
                          setFormData({ ...formData, personName: val });
                        }
                      }}
                      className="w-full min-w-0 block px-2.5 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-medium cursor-pointer"
                    >
                      <option value="">
                        {formData.direction === 'in' ? '-- 下拉选择送礼人/关系人 --' : '-- 下拉选择随礼对象/关系人 --'}
                      </option>
                      {frequentGiftContacts.length > 0 && (
                        <optgroup label="曾往来对象">
                          {frequentGiftContacts.map((contact) => (
                            <option key={contact} value={contact}>
                              {contact}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="常见亲友与同僚">
                        {['父母长辈', '公婆岳父母', '叔伯姑姨', '舅父舅母', '表哥表姐', '大学同窗', '高中同学', '部门同事', '直属领导', '挚友闺蜜'].map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </optgroup>
                      <option value="__custom__">-- 手动输入其他姓名 --</option>
                    </select>

                    <input
                      type="text"
                      required
                      placeholder="或输入具体姓名/如: 李雷 / 王叔..."
                      value={formData.personName}
                      onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                      className="w-full min-w-0 block px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">发生日期</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {/* 关系与事由 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">社交关系</label>
                  <select
                    value={formData.relation}
                    onChange={(e) => setFormData({ ...formData, relation: e.target.value as GiftRelation })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    {Object.entries(relationLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">事由场合</label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value as GiftOccasion })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  >
                    {Object.entries(eventLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 回礼状态 (若为收到) */}
              {formData.direction === 'in' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">回礼跟进状态</label>
                    <select
                      value={formData.returnStatus}
                      onChange={(e) => setFormData({ ...formData, returnStatus: e.target.value as ReturnStatus })}
                      className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="pending">待回礼 (需择机回礼)</option>
                      <option value="returned">已回礼</option>
                      <option value="none_needed">无需回礼 (长辈赐福等)</option>
                    </select>
                  </div>
                  {formData.returnStatus === 'returned' && (
                    <div>
                      <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">已回礼金额 (元)</label>
                      <input
                        type="number"
                        step="100"
                        value={formData.returnAmount}
                        onChange={(e) => setFormData({ ...formData, returnAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">举办地点 / 酒店 (选填)</label>
                <input
                  type="text"
                  placeholder="如: 金陵饭店 3楼宴会厅"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1">随礼详情备注</label>
                <input
                  type="text"
                  placeholder="如: 赠送定制金锁 + 现金红包"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
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
