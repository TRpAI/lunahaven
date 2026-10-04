import {
  ExpenseRecord,
  ExpenseType,
  FuelRecord,
  LedgerFullData,
  MaintenanceRecord,
  OvertimeRecord,
  SalaryRecord,
  SocialGiftRecord,
} from '../types';

/**
 * 格式化 CSV 字段转义
 */
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 导出工资记录为 CSV
 */
export function exportSalariesToCsv(salaries: SalaryRecord[]): string {
  const headers = [
    '月份',
    '公司/单位',
    '基本工资',
    '绩效奖金',
    '加班费',
    '津补贴',
    '其他奖金',
    '税前扣款',
    '应发工资',
    '个人养老8%',
    '个人医疗2%',
    '个人失业0.5%',
    '个人公积金',
    '个人社保公积金合计',
    '企业社保公积金合计',
    '专项附加扣除',
    '个税',
    '税后实发到手',
    '用人总成本',
    '发薪日期',
    '备注',
  ];

  const rows = salaries.map((s) => [
    escapeCsv(s.month),
    escapeCsv(s.companyName),
    escapeCsv(s.baseSalary),
    escapeCsv(s.performancePay),
    escapeCsv(s.overtimePay),
    escapeCsv(s.allowance),
    escapeCsv(s.otherBonus),
    escapeCsv(s.preTaxDeduction),
    escapeCsv(s.grossSalary),
    escapeCsv(s.pensionPersonal),
    escapeCsv(s.medicalPersonal),
    escapeCsv(s.unemploymentPersonal),
    escapeCsv(s.housingFundPersonal),
    escapeCsv(s.totalPersonalInsurance),
    escapeCsv(s.totalCompanyInsurance),
    escapeCsv(s.specialDeductions),
    escapeCsv(s.individualIncomeTax),
    escapeCsv(s.netSalary),
    escapeCsv(s.companyTotalCost),
    escapeCsv(s.payDate),
    escapeCsv(s.notes),
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * 导出加班记录为 CSV
 */
export function exportOvertimesToCsv(overtimes: OvertimeRecord[]): string {
  const headers = ['日期', '加班类型', '开始时间', '结束时间', '时长(小时)', '倍率', '结算方式', '基准时薪', '预估加班费', '已调休小时', '事由', '备注'];
  const typeMap = { workday: '工作日延时(1.5x)', weekend: '休息日加班(2.0x)', holiday: '法定节假日(3.0x)' };
  const stMap = { paid: '发放加班费', comp_time: '转入调休', pending: '待结算' };

  const rows = overtimes.map((o) => [
    escapeCsv(o.date),
    escapeCsv(typeMap[o.type] || o.type),
    escapeCsv(o.startTime),
    escapeCsv(o.endTime),
    escapeCsv(o.durationHours),
    escapeCsv(o.multiplier),
    escapeCsv(stMap[o.settlementType] || o.settlementType),
    escapeCsv(o.hourlyRate),
    escapeCsv(o.estimatedPay),
    escapeCsv(o.compTimeHoursUsed || 0),
    escapeCsv(o.reason),
    escapeCsv(o.notes),
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * 导出日常生活、医疗、人情、教育与旅行开销为 CSV
 */
export function exportExpensesToCsv(
  expenses: ExpenseRecord[],
  filterType?: ExpenseType
): string {
  const targetExpenses = filterType ? expenses.filter((e) => e.type === filterType) : expenses;
  const headers = ['支出日期', '业务大类', '细分项目', '金额(元)', '出资人员', '支付渠道', '受益对象/关系人/目的地', '备注说明'];
  const typeMap: Record<string, string> = {
    living: '日常生活开销',
    medical: '医疗健康支出',
    gift: '人情往来随礼',
    education: '教育专项支出',
    travel: '旅游度假支出',
  };

  const rows = targetExpenses.map((e) => [
    escapeCsv(e.date),
    escapeCsv(typeMap[e.type] || e.type),
    escapeCsv(e.category),
    escapeCsv(e.amount),
    escapeCsv(e.payer || '本人'),
    escapeCsv(e.paymentMethod || '微信支付'),
    escapeCsv(e.beneficiary || ''),
    escapeCsv(e.remarks),
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * 导出人情往来为 CSV
 */
export function exportGiftsToCsv(gifts: SocialGiftRecord[]): string {
  const headers = ['日期', '往来方向', '对象姓名', '关系', '事由场合', '礼金金额', '回礼状态', '回礼金额', '地点/酒店', '备注'];
  const dirMap = { out: '送出(随礼支出)', in: '收到(礼金收入)' };
  const relMap: Record<string, string> = {
    relative: '亲戚长辈',
    friend: '朋友挚友',
    colleague: '同事',
    leader: '领导',
    classmate: '同学',
    client: '客户',
    neighbor: '邻里',
    other: '其他',
  };
  const eventMap: Record<string, string> = {
    wedding: '结婚喜宴',
    baby: '满月生子',
    housewarming: '乔迁之喜',
    birthday: '生日',
    longevity: '长辈寿辰',
    funeral: '白事慰问',
    illness: '探病问候',
    holiday: '节日拜年',
    education: '升学谢师',
    other: '其他事由',
  };
  const statusMap = { pending: '待回礼', returned: '已回礼', none_needed: '无需回礼' };

  const rows = gifts.map((g) => [
    escapeCsv(g.date),
    escapeCsv(dirMap[g.direction] || g.direction),
    escapeCsv(g.personName),
    escapeCsv(relMap[g.relation] || g.relation),
    escapeCsv(eventMap[g.eventType] || g.eventType),
    escapeCsv(g.amount),
    escapeCsv(statusMap[g.returnStatus] || g.returnStatus),
    escapeCsv(g.returnAmount || 0),
    escapeCsv(g.location),
    escapeCsv(g.notes),
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * 导出汽车加油为 CSV
 */
export function exportFuelsToCsv(fuels: FuelRecord[]): string {
  const headers = ['日期', '表显里程(km)', '加油/充电量', '单价(元)', '总费用(元)', '是否加满/充满', '是否亮灯/低电', '遗漏补能', '站点品牌', '油品类型', '百公里油耗/电耗', '每公里费用', '备注'];

  const rows = fuels.map((f) => [
    escapeCsv(f.date),
    escapeCsv(f.odometer),
    escapeCsv(f.fuelAmount),
    escapeCsv(f.unitPrice),
    escapeCsv(f.totalCost),
    escapeCsv(f.isFullTank ? '加满' : '未加满'),
    escapeCsv(f.isWarningLightOn ? '是' : '否'),
    escapeCsv(f.isMissedPrevious ? '是' : '否'),
    escapeCsv(f.station),
    escapeCsv(f.fuelType),
    escapeCsv(f.calculatedFuelEconomy ? f.calculatedFuelEconomy + ' L/100km' : '-'),
    escapeCsv(f.costPerKm ? '¥' + f.costPerKm + '/km' : '-'),
    escapeCsv(f.notes),
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * 导出汽车保养为 CSV
 */
export function exportMaintenancesToCsv(maintenances: MaintenanceRecord[]): string {
  const headers = ['日期', '里程(km)', '保养分类', '项目名称', '配件/服务明细', '门店/服务商', '配件费', '工时费', '总计费用', '下次保养里程', '下次保养日期', '备注'];
  const catMap: Record<string, string> = {
    routine: '常规小保',
    major: '全车大保',
    brake: '刹车制动',
    tyre: '轮胎更换',
    battery: '蓄电池',
    air_filter: '滤芯更换',
    inspection: '车辆年检',
    insurance: '车险续保',
    paint_body: '钣金喷漆',
    washing: '精致洗车',
    repair: '故障维修',
    other: '其他维护',
  };

  const rows = maintenances.map((m) => [
    escapeCsv(m.date),
    escapeCsv(m.odometer),
    escapeCsv(catMap[m.category] || m.category),
    escapeCsv(m.title),
    escapeCsv((m.items || []).join('; ')),
    escapeCsv(m.shopName),
    escapeCsv(m.partsCost),
    escapeCsv(m.laborCost),
    escapeCsv(m.totalCost),
    escapeCsv(m.nextServiceOdometer || '-'),
    escapeCsv(m.nextServiceDate || '-'),
    escapeCsv(m.notes),
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * 导出版本化 JSON 备份 (完整导出包含综合开支在内的全业务资产)
 */
export function exportVersionedJson(data: LedgerFullData): string {
  const payload = {
    format: 'qiyue-ledger',
    version: 2,
    exportedAt: new Date().toISOString(),
    appVersion: '2.0.0',
    data: {
      salaries: data.salaries || [],
      overtimes: data.overtimes || [],
      expenses: data.expenses || [],
      gifts: data.gifts || [],
      vehicles: data.vehicles || [],
      fuels: data.fuels || [],
      maintenances: data.maintenances || [],
      settings: data.settings,
      syncMeta: data.syncMeta,
    },
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * 解析并兼容导入版本化或旧版 JSON 账本备份 (内置原型污染过滤与数据结构安全校验)
 */
export function parseVersionedJson(jsonStr: string): LedgerFullData {
  const parsed = JSON.parse(jsonStr);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('无效的 JSON 格式数据');
  }

  // 防范原型污染
  if (
    Object.prototype.hasOwnProperty.call(parsed, '__proto__') ||
    Object.prototype.hasOwnProperty.call(parsed, 'constructor') ||
    Object.prototype.hasOwnProperty.call(parsed, 'prototype')
  ) {
    throw new Error('导入失败：检测到恶意原型污染属性');
  }

  // V2 格式规范
  if (parsed.format === 'qiyue-ledger' && parsed.data) {
    const d = parsed.data;
    return {
      salaries: Array.isArray(d.salaries) ? d.salaries : [],
      overtimes: Array.isArray(d.overtimes) ? d.overtimes : [],
      expenses: Array.isArray(d.expenses) ? d.expenses : [],
      gifts: Array.isArray(d.gifts) ? d.gifts : [],
      vehicles: Array.isArray(d.vehicles) ? d.vehicles : [],
      fuels: Array.isArray(d.fuels) ? d.fuels : [],
      maintenances: Array.isArray(d.maintenances) ? d.maintenances : [],
      settings: d.settings || {},
      syncMeta: d.syncMeta,
      version: String(parsed.version || '2.0.0'),
      exportedAt: parsed.exportedAt || new Date().toISOString(),
    };
  }

  // 兼容 V1 扁平格式
  if (parsed.salaries || parsed.overtimes || parsed.gifts || parsed.vehicles || parsed.expenses) {
    return {
      salaries: Array.isArray(parsed.salaries) ? parsed.salaries : [],
      overtimes: Array.isArray(parsed.overtimes) ? parsed.overtimes : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      gifts: Array.isArray(parsed.gifts) ? parsed.gifts : [],
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
      fuels: Array.isArray(parsed.fuels) ? parsed.fuels : [],
      maintenances: Array.isArray(parsed.maintenances) ? parsed.maintenances : [],
      settings: parsed.settings || {},
      syncMeta: parsed.syncMeta,
      version: '1.0.0',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
    };
  }

  throw new Error('未识别的备份文件格式，请确保是由栖月账本导出的有效 JSON 文件');
}

/**
 * 浏览器端触发文本文件下载
 */
export function triggerFileDownload(content: string, filename: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
