import { Env } from './types';

export interface AuthResult {
  authorized: boolean;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 常量时间字符串比对，防止针对 Token 的侧信道时序攻击 (Side-Channel Timing Attacks)
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 生产环境 CORS 与严格安全响应头配置
 */
export function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '').trim();

  let allowOrigin = origin || '*';

  if (allowed && allowed !== '*') {
    const list = allowed.split(',').map((s) => s.trim().toLowerCase());
    if (origin && list.includes(origin.toLowerCase())) {
      allowOrigin = origin;
    } else if (origin) {
      try {
        const u = new URL(origin);
        if (
          u.hostname === 'localhost' ||
          u.hostname === '127.0.0.1' ||
          u.hostname.endsWith('.run.app') ||
          u.hostname.endsWith('.pages.dev') ||
          u.hostname.endsWith('.workers.dev')
        ) {
          allowOrigin = origin;
        } else {
          allowOrigin = list[0] || origin;
        }
      } catch {
        allowOrigin = list[0] || origin;
      }
    } else {
      allowOrigin = list[0] || '*';
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Client-Version',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    // 关键安全响应标头
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

/**
 * 生产环境强制 Token 鉴权 (兼容 API_TOKEN 与 AUTH_TOKEN，具备时序攻击防御)
 */
export function verifyAuthorization(request: Request, env: Env): AuthResult {
  const configuredToken = (env.API_TOKEN || env.AUTH_TOKEN || '').trim();

  if (!configuredToken) {
    return {
      authorized: false,
      status: 503,
      errorCode: 'AUTH_SECRET_MISSING',
      errorMessage: '服务端未配置安全访问凭据 (API_TOKEN / AUTH_TOKEN)，请通过 wrangler secret put API_TOKEN 配置',
    };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !timingSafeEqual(token, configuredToken)) {
    return {
      authorized: false,
      status: 401,
      errorCode: 'UNAUTHORIZED',
      errorMessage: '无效的 API Token 访问凭证，请检查客户端密钥设置',
    };
  }

  return { authorized: true };
}
