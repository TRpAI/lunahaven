import { SyncPayload } from './types';

export interface ValidationError {
  field: string;
  message: string;
}

// 单次批量同步数量安全阈值限制 (经生产环境深度调优，兼顾历史数据导入与 Worker CPU/D1 批量安全)
export const MAX_ARRAY_LENGTH = 2000;
export const MAX_TOTAL_RECORDS = 5000;

export function validateSyncPayload(payload: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: '请求载荷必须是合法的 JSON 对象' }] };
  }

  // 防范原型污染攻击 (Prototype Pollution Protection)
  const isDangerousObject = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    return (
      Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
      Object.prototype.hasOwnProperty.call(obj, 'prototype')
    );
  };

  if (isDangerousObject(payload)) {
    return { valid: false, errors: [{ field: 'security', message: '检测到非法原型属性篡改载荷' }] };
  }

  // 校验期望版本号 (乐观并发控制 OCC)
  if (payload.expectedRevision !== undefined && payload.expectedRevision !== null) {
    if (typeof payload.expectedRevision !== 'number' || payload.expectedRevision < 0) {
      errors.push({ field: 'expectedRevision', message: 'expectedRevision 必须为非负整数版本号' });
    }
  }

  // 统计总记录条数
  let totalRecords = 0;
  const countArray = (arr: any, name: string) => {
    if (Array.isArray(arr)) {
      if (arr.length > MAX_ARRAY_LENGTH) {
        errors.push({ field: name, message: `${name} 数量超过单表最大限制 (${MAX_ARRAY_LENGTH}条)` });
      }
      totalRecords += arr.length;
    }
  };

  countArray(payload.salaries, 'salaries');
  countArray(payload.overtimes, 'overtimes');
  countArray(payload.gifts, 'gifts');
  countArray(payload.vehicles, 'vehicles');
  countArray(payload.fuels, 'fuels');
  countArray(payload.maintenances, 'maintenances');
  countArray(payload.expenses, 'expenses');

  if (totalRecords > MAX_TOTAL_RECORDS) {
    errors.push({ field: 'totalRecords', message: `单次批量提交记录总数 (${totalRecords}) 超过系统安全上限 (${MAX_TOTAL_RECORDS}条)，请分批同步` });
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
 * 生产环境敏感数据过滤与脱敏：
 * 绝不在普通 D1 数据库表中存储 API Token、第三方授权 Token、2FA 密钥等敏感凭据
 * 统一依托 Cloudflare Secrets / 客户端本地安全加密存储
 */
export function sanitizeSettingsForStorage(settings: any): any {
  if (!settings || typeof settings !== 'object') return settings;
  try {
    const copy = JSON.parse(JSON.stringify(settings));
    if (copy.d1Config) {
      // 避免 D1 API Token 被持久化至数据库
      copy.d1Config.apiToken = '';
    }
    if (copy.oneDriveConfig) {
      // 避免微软 OAuth 访问令牌与刷新令牌被持久化至数据库
      copy.oneDriveConfig.accessToken = '';
      copy.oneDriveConfig.refreshToken = '';
    }
    // 敏感双重验证 TOTP 密钥与备用恢复码严禁持久化至云端明文表
    if (copy.twoFactorSecret) {
      copy.twoFactorSecret = '';
    }
    if (Array.isArray(copy.twoFactorBackupCodes)) {
      copy.twoFactorBackupCodes = [];
    }
    // 生物识别凭据 ID 仅保留本地硬件关联
    if (copy.biometricCredentialId) {
      copy.biometricCredentialId = '';
    }
    return copy;
  } catch {
    return settings;
  }
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
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    }
  );
}

/**
 * 生产环境统一 JSON 成功响应结构 (严格禁止 CDN 边缘与客户端缓存私人财务账本数据)
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
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    }
  );
}
