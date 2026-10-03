import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CreditCard,
  Download,
  Edit2,
  Gift,
  GraduationCap,
  HeartPulse,
  Palmtree,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { ExpenseRecord, ExpenseType } from '../../types';
import { exportExpensesToCsv, triggerFileDownload } from '../../utils/exportImport';
import { formatCurrency } from '../../utils/taxCalculator';

interface ExpensesViewProps {
  expenses: ExpenseRecord[];
  onSaveExpense: (record: ExpenseRecord) => void;
  onDeleteExpense: (id: string) => void;
  hidePrivacy: boolean;
}

export const RELATION_BENEFICIARY_PRESETS = [
  {
    group: '亲属家族',
    items: ['亲朋好友', '父母长辈', '公婆岳父母', '叔伯姑姨', '舅父舅母', '表哥表姐', '堂兄弟姐妹', '晚辈侄甥', '家族长辈'],
  },
  {
    group: '朋友同窗发小',
    items: ['挚友闺蜜', '大学同窗', '高中同学', '初中同学', '发小老乡', '普通朋友'],
  },
  {
    group: '职场与商务伙伴',
    items: ['部门同事', '直属领导', '公司老板', '商业合作伙伴', '大客户经理', '已离职前同事'],
  },
  {
    group: '师长邻里后辈',
    items: ['恩师导师', '邻里街坊', '学生后辈', '其他往来对象'],
  },
];

export const LIVING_CATEGORIES = [
  '餐饮美食',
  '居家物业',
  '日用百货',
  '穿戴服饰',
  '休闲娱乐',
  '交通出行',
  '数码家电',
  '其他日常',
];

export const MEDICAL_CATEGORIES = [
  '门诊就医',
  '住院治疗',
  '药品购买',
  '体检筛查',
  '齿科眼科',
  '中医调理',
  '康复理疗',
  '医疗保险',
  '医疗耗材',
  '其他医疗',
];

export const GIFT_CATEGORIES = [
  '结婚随礼',
  '生子满月',
  '乔迁之喜',
  '长辈寿宴',
  '升学谢师',
  '丧葬慰问',
  '探望慰问',
  '节日礼品',
  '商务宴请',
  '其他随礼',
];

export const EDUCATION_CATEGORIES = [
  '学费学杂',
  '课外培优',
  '兴趣特长',
  '书籍文具',
  '考试考证',
  '研学游学',
  '学习硬件',
  '自我提升',
];

export const TRAVEL_CATEGORIES = [
  '机票火车',
  '酒店住宿',
  '景区门票',
  '特色餐饮',
  '租车自驾',
  '市内交通',
  '旅游购物',
  '团费向导',
  '签证保险',
  '其他旅行',
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses = [],
  onSaveExpense,
  onDeleteExpense,
  hidePrivacy,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<'all' | ExpenseType>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [giftDirectionFilter, setGiftDirectionFilter] = useState<'all' | 'out' | 'in'>('all');

  // Form State
  const [formData, setFormData] = useState<{
    date: string;
    type: ExpenseType;
    direction: 'out' | 'in';
    category: string;
    amount: number | '';
    payer: string;
    paymentMethod: string;
    beneficiary: string;
    remarks: string;
  }>({
    date: new Date().toISOString().slice(0, 10),
    type: 'living',
    direction: 'out',
    category: '餐饮美食',
    amount: '',
    payer: '本人',
    paymentMethod: '微信支付',
    beneficiary: '全家',
    remarks: '',
  });

  // 提取历史人情往来随礼对象/关系人列表，供快速下拉复用
  const frequentGiftContacts = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.beneficiary && e.beneficiary.trim()) {
        set.add(e.beneficiary.trim());
      }
    });
    return Array.from(set).slice(0, 30);
  }, [expenses]);

  // Available months
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    expenses.forEach((e) => months.add(e.date.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [expenses]);

  // Current month for default stats
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedType !== 'all' && e.type !== selectedType) return false;
      if (selectedType === 'gift' && giftDirectionFilter !== 'all') {
        const dir = e.direction || 'out';
        if (dir !== giftDirectionFilter) return false;
      }
      if (selectedMonth !== 'all' && !e.date.startsWith(selectedMonth)) return false;
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inRemarks = (e.remarks || '').toLowerCase().includes(query);
        const inCat = (e.category || '').toLowerCase().includes(query);
        const inBeneficiary = (e.beneficiary || '').toLowerCase().includes(query);
        const inPayer = (e.payer || '').toLowerCase().includes(query);
        if (!inRemarks && !inCat && !inBeneficiary && !inPayer) return false;
      }
      return true;
    });
  }, [expenses, selectedType, giftDirectionFilter, selectedMonth, selectedCategory, searchQuery]);

  // Metric stats
  const stats = useMemo(() => {
    const curMonthExpenses = expenses.filter((e) => e.date.startsWith(currentMonthStr));
    const curMonthLiving = curMonthExpenses
      .filter((e) => e.type === 'living')
      .reduce((s, e) => s + e.amount, 0);
    const curMonthMedical = curMonthExpenses
      .filter((e) => e.type === 'medical')
      .reduce((s, e) => s + e.amount, 0);

    // 人情往来：区分随礼支出 (out) 与 收礼收入 (in)
    const curMonthGiftOut = curMonthExpenses
      .filter((e) => e.type === 'gift' && e.direction !== 'in')
      .reduce((s, e) => s + e.amount, 0);
    const curMonthGiftIn = curMonthExpenses
      .filter((e) => e.type === 'gift' && e.direction === 'in')
      .reduce((s, e) => s + e.amount, 0);
    const curMonthGiftNet = curMonthGiftIn - curMonthGiftOut;

    const curMonthEdu = curMonthExpenses
      .filter((e) => e.type === 'education')
      .reduce((s, e) => s + e.amount, 0);
    const curMonthTravel = curMonthExpenses
      .filter((e) => e.type === 'travel')
      .reduce((s, e) => s + e.amount, 0);

    // 本月实际总开销 (不叠加收礼收入)
    const curMonthTotal = curMonthLiving + curMonthMedical + curMonthGiftOut + curMonthEdu + curMonthTravel;

    const currentYear = new Date().getFullYear().toString();
    const curYearExpenses = expenses.filter((e) => e.date.startsWith(currentYear));
    const curYearMedical = curYearExpenses
      .filter((e) => e.type === 'medical')
      .reduce((s, e) => s + e.amount, 0);
    const curYearGiftOut = curYearExpenses
      .filter((e) => e.type === 'gift' && e.direction !== 'in')
      .reduce((s, e) => s + e.amount, 0);
    const curYearGiftIn = curYearExpenses
      .filter((e) => e.type === 'gift' && e.direction === 'in')
      .reduce((s, e) => s + e.amount, 0);
    const curYearGiftNet = curYearGiftIn - curYearGiftOut;
    const curYearTravel = curYearExpenses
      .filter((e) => e.type === 'travel')
      .reduce((s, e) => s + e.amount, 0);
    const curYearTotal = curYearExpenses
      .filter((e) => !(e.type === 'gift' && e.direction === 'in'))
      .reduce((s, e) => s + e.amount, 0);

    return {
      curMonthTotal,
      curMonthLiving,
      curMonthMedical,
      curMonthGift: curMonthGiftOut,
      curMonthGiftOut,
      curMonthGiftIn,
      curMonthGiftNet,
      curMonthEdu,
      curMonthTravel,
      curYearTotal,
      curYearMedical,
      curYearGift: curYearGiftOut,
      curYearGiftOut,
      curYearGiftIn,
      curYearGiftNet,
      curYearTravel,
      curMonthLivingRatio: curMonthTotal > 0 ? Math.round((curMonthLiving / curMonthTotal) * 100) : 0,
      curMonthMedicalRatio: curMonthTotal > 0 ? Math.round((curMonthMedical / curMonthTotal) * 100) : 0,
      curMonthGiftRatio: curMonthTotal > 0 ? Math.round((curMonthGiftOut / curMonthTotal) * 100) : 0,
    };
  }, [expenses, currentMonthStr]);

  // Category breakdown for filtered list
  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; total: number; type: ExpenseType }> = {};
    filteredExpenses.forEach((e) => {
      if (!map[e.category]) {
        map[e.category] = { count: 0, total: 0, type: e.type };
      }
      map[e.category].count += 1;
      map[e.category].total += e.amount;
    });

    const list = Object.entries(map).map(([name, stat]) => ({
      name,
      ...stat,
    }));
    list.sort((a, b) => b.total - a.total);
    const totalFiltered = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const totalFilteredExpense = filteredExpenses
      .filter((e) => !(e.type === 'gift' && e.direction === 'in'))
      .reduce((s, e) => s + e.amount, 0);
    const totalFilteredIncome = filteredExpenses
      .filter((e) => e.type === 'gift' && e.direction === 'in')
      .reduce((s, e) => s + e.amount, 0);

    return {
      list,
      totalFiltered,
      totalFilteredExpense,
      totalFilteredIncome,
    };
  }, [filteredExpenses]);

  // Open modal for add
  const handleOpenAdd = (defaultType: ExpenseType = 'living') => {
    setEditingId(null);
    let defaultCat = '餐饮美食';
    let defaultBeneficiary = '全家';
    if (defaultType === 'medical') {
      defaultCat = '门诊就医';
      defaultBeneficiary = '本人';
    } else if (defaultType === 'gift') {
      defaultCat = '结婚随礼';
      defaultBeneficiary = '亲朋好友';
    } else if (defaultType === 'education') {
      defaultCat = '课外培优';
      defaultBeneficiary = '孩子';
    } else if (defaultType === 'travel') {
      defaultCat = '机票火车';
      defaultBeneficiary = '全家旅行';
    }

    setFormData({
      date: new Date().toISOString().slice(0, 10),
      type: defaultType,
      direction: 'out',
      category: defaultCat,
      amount: '',
      payer: '本人',
      paymentMethod: '微信支付',
      beneficiary: defaultBeneficiary,
      remarks: '',
    });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (record: ExpenseRecord) => {
    setEditingId(record.id);
    setFormData({
      date: record.date,
      type: record.type,
      direction: record.direction || 'out',
      category: record.category,
      amount: record.amount,
      payer: record.payer || '本人',
      paymentMethod: record.paymentMethod || '微信支付',
      beneficiary: record.beneficiary || '',
      remarks: record.remarks || '',
    });
    setIsModalOpen(true);
  };

  // Submit modal form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      alert(formData.type === 'gift' && formData.direction === 'in' ? '请输入有效的收礼金额' : '请输入有效的支出金额');
      return;
    }

    const record: ExpenseRecord = {
      id: editingId || `exp-${Date.now()}`,
      date: formData.date,
      type: formData.type,
      direction: formData.type === 'gift' ? formData.direction : 'out',
      category: formData.category,
      amount: Number(formData.amount),
      payer: formData.payer,
      paymentMethod: formData.paymentMethod,
      beneficiary: formData.beneficiary.trim(),
      remarks: formData.remarks.trim(),
      createdAt: editingId ? undefined! : new Date().toISOString(),
    };

    onSaveExpense(record);
    setIsModalOpen(false);
  };

  // Export CSV
  const handleExportCsv = () => {
    const csv = exportExpensesToCsv(filteredExpenses);
    triggerFileDownload(
      csv,
      `qiyue_expenses_export_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  // Helper function to get badge info for each type
  const getTypeMeta = (type: ExpenseType) => {
    switch (type) {
      case 'medical':
        return {
          label: '医疗健康',
          icon: HeartPulse,
          color: 'text-rose-600 dark:text-rose-400',
          badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/50',
          boxClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60',
          barColor: 'bg-rose-500',
        };
      case 'gift':
        return {
          label: '人情往来',
          icon: Gift,
          color: 'text-pink-600 dark:text-pink-400',
          badgeClass: 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/50 dark:border-pink-800/50',
          boxClass: 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200/60 dark:border-pink-800/60',
          barColor: 'bg-pink-500',
        };
      case 'education':
        return {
          label: '教育专项',
          icon: GraduationCap,
          color: 'text-purple-600 dark:text-purple-400',
          badgeClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50',
          boxClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60',
          barColor: 'bg-purple-500',
        };
      case 'travel':
        return {
          label: '旅行度假',
          icon: Palmtree,
          color: 'text-amber-600 dark:text-amber-400',
          badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50',
          boxClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
          barColor: 'bg-amber-500',
        };
      case 'living':
      default:
        return {
          label: '日常生活',
          icon: ShoppingBag,
          color: 'text-blue-600 dark:text-blue-400',
          badgeClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50',
          boxClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60',
          barColor: 'bg-blue-500',
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 顶部标题栏与全局操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
            <Receipt className="w-6 h-6 text-zinc-700 dark:text-zinc-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              日常开销、医疗与人情综合支出
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              日常生活 · 医疗健康 · 人情随礼 · 教育培优 · 旅游度假
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={filteredExpenses.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            title="导出当前筛选结果为 CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 CSV</span>
          </button>
          <button
            onClick={() => handleOpenAdd('living')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>记一笔开销</span>
          </button>
        </div>
      </div>

      {/* 5 核心指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">本月总开销</span>
            <Receipt className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {hidePrivacy ? '••••••' : formatCurrency(stats.curMonthTotal)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 truncate">全口径各项综合支出</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">本月日常生活</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {hidePrivacy ? '••••••' : formatCurrency(stats.curMonthLiving)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 truncate">占比 {stats.curMonthLivingRatio}% · 餐饮/百货/水电</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">医疗健康支出</span>
            <HeartPulse className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {hidePrivacy ? '••••••' : formatCurrency(stats.curMonthMedical)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 truncate">
            本月占比 {stats.curMonthMedicalRatio}% · 本年 {hidePrivacy ? '•••' : formatCurrency(stats.curYearMedical)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">人情往来 (随礼/收礼)</span>
            <Gift className="w-4 h-4 text-pink-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {hidePrivacy ? '••••••' : formatCurrency(stats.curMonthGiftOut)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 truncate">
            支出 ¥{hidePrivacy ? '••' : stats.curMonthGiftOut} · 收到 ¥{hidePrivacy ? '••' : stats.curMonthGiftIn} · 差额 {stats.curMonthGiftNet >= 0 ? '+' : ''}{hidePrivacy ? '••' : stats.curMonthGiftNet}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-1.5">
            <span className="text-xs font-medium">教育与旅行专款</span>
            <Palmtree className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
            {hidePrivacy ? '••••••' : formatCurrency(stats.curMonthEdu + stats.curMonthTravel)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 truncate">
            教育 ¥{stats.curMonthEdu} · 旅行 ¥{stats.curMonthTravel}
          </p>
        </div>
      </div>

      {/* 搜索与多维度筛选工具条 (对标 GiftsView/SalaryView 统一规范) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* 搜索输入框 */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索分类、备注、对象、出资人..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* 大类性质切换 */}
          <div className="flex flex-wrap rounded-xl bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => {
                setSelectedType('all');
                setSelectedCategory('all');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              全部 ({expenses.length})
            </button>
            <button
              onClick={() => {
                setSelectedType('living');
                setSelectedCategory('all');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                selectedType === 'living'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3 h-3 text-blue-500" />
              <span>日常 ({expenses.filter((e) => e.type === 'living').length})</span>
            </button>
            <button
              onClick={() => {
                setSelectedType('medical');
                setSelectedCategory('all');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                selectedType === 'medical'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <HeartPulse className="w-3 h-3 text-rose-500" />
              <span>医疗 ({expenses.filter((e) => e.type === 'medical').length})</span>
            </button>
            <button
              onClick={() => {
                setSelectedType('gift');
                setSelectedCategory('all');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                selectedType === 'gift'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Gift className="w-3 h-3 text-pink-500" />
              <span>人情 ({expenses.filter((e) => e.type === 'gift').length})</span>
            </button>
            <button
              onClick={() => {
                setSelectedType('education');
                setSelectedCategory('all');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                selectedType === 'education'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <GraduationCap className="w-3 h-3 text-purple-500" />
              <span>教育 ({expenses.filter((e) => e.type === 'education').length})</span>
            </button>
            <button
              onClick={() => {
                setSelectedType('travel');
                setSelectedCategory('all');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                selectedType === 'travel'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Palmtree className="w-3 h-3 text-amber-500" />
              <span>旅行 ({expenses.filter((e) => e.type === 'travel').length})</span>
            </button>
          </div>

          {/* 人情往来收支细分子筛选 */}
          {selectedType === 'gift' && (
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setGiftDirectionFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  giftDirectionFilter === 'all'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                全部往来 ({expenses.filter((e) => e.type === 'gift').length})
              </button>
              <button
                type="button"
                onClick={() => setGiftDirectionFilter('out')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  giftDirectionFilter === 'out'
                    ? 'bg-rose-500 text-white shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3 h-3" />
                <span>随礼支出 ({expenses.filter((e) => e.type === 'gift' && e.direction !== 'in').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setGiftDirectionFilter('in')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  giftDirectionFilter === 'in'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <ArrowDownRight className="w-3 h-3" />
                <span>收礼收入 ({expenses.filter((e) => e.type === 'gift' && e.direction === 'in').length})</span>
              </button>
            </div>
          )}

          {/* 月份筛选器 */}
          {availableMonths.length > 0 && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="all">所有月份</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 支出分类结构排行榜横条 (当存在数据时展示) */}
      {categoryStats.list.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              当前筛选项目支出分布
            </span>
            <span className="text-zinc-400">
              合计: {hidePrivacy ? '••••••' : formatCurrency(categoryStats.totalFiltered)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {categoryStats.list.slice(0, 8).map((cat) => {
              const ratio = categoryStats.totalFiltered > 0
                ? Math.round((cat.total / categoryStats.totalFiltered) * 100)
                : 0;
              const meta = getTypeMeta(cat.type);
              const CatIcon = meta.icon;

              return (
                <div
                  key={cat.name}
                  onClick={() => setSelectedCategory(selectedCategory === cat.name ? 'all' : cat.name)}
                  className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    selectedCategory === cat.name
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800'
                      : 'border-zinc-200/70 dark:border-zinc-800/70 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <CatIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                      {cat.name}
                    </span>
                    <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {hidePrivacy ? '••••' : formatCurrency(cat.total)}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${meta.barColor}`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                    <span>{cat.count} 笔支出</span>
                    <span>{ratio}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 支出流水列表 (采用与薪资工时、人情往来完全一致的精美卡片样式) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>共找到 {filteredExpenses.length} 笔往来明细</span>
          <span>
            {categoryStats.totalFilteredIncome > 0 ? (
              <span>
                支出合计: {hidePrivacy ? '••••' : `¥${formatCurrency(categoryStats.totalFilteredExpense)}`} · 收礼入账: {hidePrivacy ? '••••' : `+¥${formatCurrency(categoryStats.totalFilteredIncome)}`}
              </span>
            ) : (
              <span>当前列表合计: {hidePrivacy ? '••••••' : formatCurrency(categoryStats.totalFiltered)}</span>
            )}
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium">暂无符合条件的支出记录</p>
            <button
              onClick={() => handleOpenAdd('living')}
              className="mt-3 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              记一笔新开销
            </button>
          </div>
        ) : (
          filteredExpenses.map((row) => {
            const meta = getTypeMeta(row.type);
            const RowIcon = meta.icon;

            return (
              <div
                key={row.id}
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                {/* 左侧：分类图标方块、细分类别、性质徽章、对象标签、明细备注 */}
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${meta.boxClass}`}
                  >
                    <RowIcon className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                        {row.category}
                      </span>
                      {row.type === 'gift' ? (
                        row.direction === 'in' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-0.5">
                            <ArrowDownRight className="w-3 h-3 text-emerald-500" />
                            <span>收礼入账</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 flex items-center gap-0.5">
                            <ArrowUpRight className="w-3 h-3 text-rose-500" />
                            <span>随礼支出</span>
                          </span>
                        )
                      ) : (
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      )}
                      {row.beneficiary && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                          {row.type === 'gift' && (row.direction === 'in' ? '来自: ' : '随给: ')}
                          {row.beneficiary}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono">{row.date}</span>
                      <span>·</span>
                      <span>{row.paymentMethod || '微信支付'}</span>
                      {row.payer && <span>({row.type === 'gift' && row.direction === 'in' ? '入账: ' : ''}{row.payer})</span>}
                      {row.remarks && <span className="text-zinc-600 dark:text-zinc-400">· {row.remarks}</span>}
                    </div>
                  </div>
                </div>

                {/* 右侧：支出/收入金额与操作按键 */}
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block">
                      {row.type === 'gift' && row.direction === 'in' ? '收礼金额' : '支出金额'}
                    </span>
                    <span
                      className={`font-mono font-bold text-sm sm:text-base ${
                        row.type === 'gift' && row.direction === 'in'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {hidePrivacy
                        ? '••••'
                        : `${row.type === 'gift' && row.direction === 'in' ? '+' : '-'}¥${formatCurrency(
                            row.amount
                          )}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(row)}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer transition-colors"
                      title="编辑"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`确定要删除这笔「${row.category} ¥${row.amount}」开销记录吗？`)) {
                          onDeleteExpense(row.id);
                        }
                      }}
                      className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 录入/编辑 开销模态弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden my-auto max-h-[calc(100vh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl ${
                    formData.type === 'medical'
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600'
                      : formData.type === 'gift'
                      ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-600'
                      : formData.type === 'education'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600'
                      : formData.type === 'travel'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600'
                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600'
                  }`}
                >
                  {formData.type === 'medical' ? (
                    <HeartPulse className="w-5 h-5" />
                  ) : formData.type === 'gift' ? (
                    <Gift className="w-5 h-5" />
                  ) : formData.type === 'education' ? (
                    <GraduationCap className="w-5 h-5" />
                  ) : formData.type === 'travel' ? (
                    <Palmtree className="w-5 h-5" />
                  ) : (
                    <ShoppingBag className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {editingId ? '编辑支出记录' : '新增支出开销'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {formData.type === 'medical'
                      ? '门诊就医、药品耗材、体检筛查与健康保障'
                      : formData.type === 'gift'
                      ? '婚礼随礼、寿宴满月、节日走访与人情往来'
                      : formData.type === 'education'
                      ? '教育培训、课外培优、书籍考证与育儿专款'
                      : formData.type === 'travel'
                      ? '机票火车、酒店住宿、门票餐饮与旅行度假'
                      : '家庭日常饮食、居家水电、日用百货开销'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* 五大支出性质大类切换 */}
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1.5">
                  支出性质大类
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        type: 'living',
                        category: '餐饮美食',
                        beneficiary: '全家',
                      });
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      formData.type === 'living'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 text-blue-500" />
                    <span className="text-[11px]">日常生活</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        type: 'medical',
                        category: '门诊就医',
                        beneficiary: '本人',
                      });
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      formData.type === 'medical'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    <HeartPulse className="w-4 h-4 text-rose-500" />
                    <span className="text-[11px]">医疗健康</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        type: 'gift',
                        category: '结婚随礼',
                        beneficiary: '亲朋好友',
                      });
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      formData.type === 'gift'
                        ? 'border-pink-500 bg-pink-50/50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-semibold shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    <Gift className="w-4 h-4 text-pink-500" />
                    <span className="text-[11px]">人情往来</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        type: 'education',
                        category: '课外培优',
                        beneficiary: '孩子',
                      });
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      formData.type === 'education'
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 text-purple-500" />
                    <span className="text-[11px]">教育专项</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        type: 'travel',
                        category: '机票火车',
                        beneficiary: '全家旅行',
                      });
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                      formData.type === 'travel'
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    <Palmtree className="w-4 h-4 text-amber-500" />
                    <span className="text-[11px]">旅行度假</span>
                  </button>
                </div>
              </div>

              {/* 人情往来方向切换 (随礼支出 vs 收受礼金) */}
              {formData.type === 'gift' && (
                <div className="p-3 rounded-2xl bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200/80 dark:border-pink-900/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-pink-900 dark:text-pink-200 flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-pink-500" />
                      <span>人情往来资金属性</span>
                    </span>
                    <span className="text-[11px] text-pink-600 dark:text-pink-400 font-medium">
                      {formData.direction === 'in' ? '收到随礼 (计入人情收入)' : '随礼支出 (送出红包/礼金)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, direction: 'out' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.direction !== 'in'
                          ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-rose-300'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>随礼支出 (送出礼金)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, direction: 'in' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.direction === 'in'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-emerald-300'
                      }`}
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>收礼收入 (收受礼金)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 日期与金额 (响应式单列/双列布局，添加 min-w-0 与 block 规避 iOS 日期组件固有宽度溢出) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                    {formData.type === 'gift' && formData.direction === 'in' ? '收礼日期' : '支出日期'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                    {formData.type === 'gift' && formData.direction === 'in' ? '收礼金额 (元)' : '支出金额 (元)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    className="w-full min-w-0 block px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-sm focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 分类快捷选取 */}
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1.5">
                  细分项目类别
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(formData.type === 'living'
                    ? LIVING_CATEGORIES
                    : formData.type === 'medical'
                    ? MEDICAL_CATEGORIES
                    : formData.type === 'gift'
                    ? GIFT_CATEGORIES
                    : formData.type === 'education'
                    ? EDUCATION_CATEGORIES
                    : TRAVEL_CATEGORIES
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat })}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                        formData.category === cat
                          ? formData.type === 'medical'
                            ? 'bg-rose-500 text-white border-rose-500 font-semibold shadow-xs'
                            : formData.type === 'gift'
                            ? 'bg-pink-500 text-white border-pink-500 font-semibold shadow-xs'
                            : formData.type === 'education'
                            ? 'bg-purple-500 text-white border-purple-500 font-semibold shadow-xs'
                            : formData.type === 'travel'
                            ? 'bg-amber-500 text-white border-amber-500 font-semibold shadow-xs'
                            : 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 出资人/收款人、支付方式与受益对象/关系人 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                    {formData.type === 'gift' && formData.direction === 'in' ? '收款入账人' : '出资人员'}
                  </label>
                  <select
                    value={formData.payer}
                    onChange={(e) => setFormData({ ...formData, payer: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
                  >
                    <option value="本人">本人</option>
                    <option value="配偶">配偶</option>
                    <option value="家庭共同">家庭共同</option>
                    <option value="父母支持">父母长辈</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                    {formData.type === 'gift' && formData.direction === 'in' ? '收款渠道' : '支付渠道'}
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
                  >
                    <option value="微信支付">微信支付/红包</option>
                    <option value="支付宝">支付宝</option>
                    <option value="现金礼金">现金/纸质红包</option>
                    <option value="银行转账">银行卡/转账</option>
                    <option value="信用卡">信用卡</option>
                    <option value="医保统筹/个账">医保统筹/个账</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-zinc-700 dark:text-zinc-300 font-medium truncate">
                      {formData.type === 'medical'
                        ? '就医对象/患者'
                        : formData.type === 'gift'
                        ? formData.direction === 'in'
                          ? '送礼人 / 关系对象'
                          : '随礼对象 / 关系人'
                        : formData.type === 'travel'
                        ? '行程/目的地'
                        : '受益对象'}
                    </label>
                  </div>

                  {formData.type === 'gift' ? (
                    <div className="space-y-1.5">
                      <select
                        value={
                          RELATION_BENEFICIARY_PRESETS.some((g) => g.items.includes(formData.beneficiary)) ||
                          frequentGiftContacts.includes(formData.beneficiary)
                            ? formData.beneficiary
                            : formData.beneficiary
                            ? '__custom__'
                            : ''
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            // 用户准备手动输入
                          } else if (val) {
                            setFormData({ ...formData, beneficiary: val });
                          }
                        }}
                        className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-medium cursor-pointer"
                      >
                        <option value="">
                          {formData.direction === 'in' ? '-- 下拉选择送礼人/关系人 --' : '-- 下拉选择随礼对象/关系人 --'}
                        </option>
                        {frequentGiftContacts.length > 0 && (
                          <optgroup label="曾记录的往来对象">
                            {frequentGiftContacts.map((contact) => (
                              <option key={contact} value={contact}>
                                {contact}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {RELATION_BENEFICIARY_PRESETS.map((grp) => (
                          <optgroup key={grp.group} label={grp.group}>
                            {grp.items.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <option value="__custom__">-- 手动输入其他姓名/关系 --</option>
                      </select>

                      <input
                        type="text"
                        list="gift-beneficiary-datalist"
                        placeholder={formData.direction === 'in' ? '或手动输入送礼人姓名/昵称...' : '或手动输入随礼对象姓名/昵称...'}
                        value={formData.beneficiary}
                        onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
                      />
                      <datalist id="gift-beneficiary-datalist">
                        {frequentGiftContacts.map((c) => (
                          <option key={c} value={c} />
                        ))}
                        {RELATION_BENEFICIARY_PRESETS.flatMap((g) => g.items).map((item) => (
                          <option key={item} value={item} />
                        ))}
                      </datalist>

                      <div className="flex flex-wrap gap-1">
                        {['亲朋好友', '父母长辈', '公婆岳父母', '表哥表姐', '大学同窗', '部门同事', '挚友闺蜜', '直属领导'].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setFormData({ ...formData, beneficiary: tag })}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                              formData.beneficiary === tag
                                ? 'bg-pink-600 text-white border-pink-600 font-medium shadow-xs'
                                : 'bg-zinc-100/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:text-zinc-900'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder={
                        formData.type === 'medical'
                          ? '如: 本人/父母/宝宝'
                          : formData.type === 'travel'
                          ? '如: 云南大理/三亚游'
                          : '如: 大宝/全家'
                      }
                      value={formData.beneficiary}
                      onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
                    />
                  )}
                </div>
              </div>

              {/* 明细备注说明 */}
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-medium mb-1">
                  明细描述 / 支出备注
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    formData.type === 'medical'
                      ? '记录就诊医院、科室、药品名称或诊疗项目...'
                      : formData.type === 'gift'
                      ? '记录随礼宴席场合、酒店地点或贺礼事由...'
                      : formData.type === 'travel'
                      ? '记录航班班次、酒店名称、景点门票或自驾租车详情...'
                      : '记录开销的具体商品、机构名称或用途详情...'
                  }
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {editingId ? '保存修改' : '确认记录'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
