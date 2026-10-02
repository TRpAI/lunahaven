import { SyncPayload } from './types';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateSyncPayload(payload: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: '请求载荷必须是合法的 JSON 对象' }] };
  }

  // 1. 校验薪资 (Salaries)
  if (payload.salaries !== undefined) {
    if (!Array.isArray(payload.salaries)) {
      errors.push({ field: 'salaries', message: 'salaries 必须为数组' });
    } else {
      for (let i = 0; i < payload.salaries.length; i++) {
        const s = payload.salaries[i];
        if (!s.id || typeof s.id !== 'string') {
          errors.push({ field: `salaries[${i}].id`, message: '缺少有效的记录 ID' });
        }
        if (!s.month || typeof s.month !== 'string' || !/^\d{4}-\d{2}$/.test(s.month)) {
          errors.push({ field: `salaries[${i}].month`, message: '月份格式必须为 YYYY-MM' });
        }
      }
    }
  }

  // 2. 校验加班 (Overtimes)
  if (payload.overtimes !== undefined) {
    if (!Array.isArray(payload.overtimes)) {
      errors.push({ field: 'overtimes', message: 'overtimes 必须为数组' });
    } else {
      for (let i = 0; i < payload.overtimes.length; i++) {
        const o = payload.overtimes[i];
        if (!o.id || typeof o.id !== 'string') {
          errors.push({ field: `overtimes[${i}].id`, message: '缺少有效的记录 ID' });
        }
        if (!o.date || typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) {
          errors.push({ field: `overtimes[${i}].date`, message: '日期格式必须为 YYYY-MM-DD' });
        }
        const hours = o.durationHours ?? o.duration_hours;
        if (hours !== undefined && (typeof hours !== 'number' || hours < 0 || hours > 24)) {
          errors.push({ field: `overtimes[${i}].durationHours`, message: '加班时长必须在 0 到 24 小时之间' });
        }
      }
    }
  }

  // 3. 校验人情 (Social Gifts)
  if (payload.gifts !== undefined) {
    if (!Array.isArray(payload.gifts)) {
      errors.push({ field: 'gifts', message: 'gifts 必须为数组' });
    } else {
      for (let i = 0; i < payload.gifts.length; i++) {
        const g = payload.gifts[i];
        if (!g.id || typeof g.id !== 'string') {
          errors.push({ field: `gifts[${i}].id`, message: '缺少有效的记录 ID' });
        }
        if (!g.date || typeof g.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(g.date)) {
          errors.push({ field: `gifts[${i}].date`, message: '日期格式必须为 YYYY-MM-DD' });
        }
        if (!g.direction || !['in', 'out'].includes(g.direction)) {
          errors.push({ field: `gifts[${i}].direction`, message: '礼金方向必须为 in 或 out' });
        }
      }
    }
  }

  // 4. 校验车辆 (Vehicles)
  if (payload.vehicles !== undefined) {
    if (!Array.isArray(payload.vehicles)) {
      errors.push({ field: 'vehicles', message: 'vehicles 必须为数组' });
    } else {
      for (let i = 0; i < payload.vehicles.length; i++) {
        const v = payload.vehicles[i];
        if (!v.id || typeof v.id !== 'string') {
          errors.push({ field: `vehicles[${i}].id`, message: '缺少有效的车辆 ID' });
        }
        if (!v.name || typeof v.name !== 'string') {
          errors.push({ field: `vehicles[${i}].name`, message: '缺少车辆名称' });
        }
      }
    }
  }

  // 5. 校验加油/充电流水 (Fuels)
  if (payload.fuels !== undefined) {
    if (!Array.isArray(payload.fuels)) {
      errors.push({ field: 'fuels', message: 'fuels 必须为数组' });
    } else {
      for (let i = 0; i < payload.fuels.length; i++) {
        const f = payload.fuels[i];
        if (!f.id || typeof f.id !== 'string') {
          errors.push({ field: `fuels[${i}].id`, message: '缺少有效的记录 ID' });
        }
        const odo = f.odometer;
        if (odo !== undefined && (typeof odo !== 'number' || odo < 0)) {
          errors.push({ field: `fuels[${i}].odometer`, message: '里程表读数不能为负数' });
        }
      }
    }
  }

  // 6. 校验维保记录 (Maintenances)
  if (payload.maintenances !== undefined) {
    if (!Array.isArray(payload.maintenances)) {
      errors.push({ field: 'maintenances', message: 'maintenances 必须为数组' });
    } else {
      for (let i = 0; i < payload.maintenances.length; i++) {
        const m = payload.maintenances[i];
        if (!m.id || typeof m.id !== 'string') {
          errors.push({ field: `maintenances[${i}].id`, message: '缺少有效的记录 ID' });
        }
      }
    }
  }

  // 7. 校验综合开销 (Expenses)
  if (payload.expenses !== undefined) {
    if (!Array.isArray(payload.expenses)) {
      errors.push({ field: 'expenses', message: 'expenses 必须为数组' });
    } else {
      for (let i = 0; i < payload.expenses.length; i++) {
        const exp = payload.expenses[i];
        if (!exp.id || typeof exp.id !== 'string') {
          errors.push({ field: `expenses[${i}].id`, message: '缺少有效的记录 ID' });
        }
        if (!exp.date || typeof exp.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(exp.date)) {
          errors.push({ field: `expenses[${i}].date`, message: '日期格式必须为 YYYY-MM-DD' });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 生产环境统一 JSON 错误响应结构
 */
export function createErrorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  corsHeaders: Record<string, string>,
  details?: any
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code,
        message,
        details: details || undefined,
      },
      requestId,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      },
    }
  );
}

/**
 * 生产环境统一 JSON 成功响应结构
 */
export function createSuccessResponse(
  data: any,
  requestId: string,
  corsHeaders: Record<string, string>,
  extra?: Record<string, any>
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...extra,
      data,
      requestId,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      },
    }
  );
}
