import { Env } from './types';

export interface AuthResult {
  authorized: boolean;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 生产环境 CORS 配置优化
 * 默认允许所有合法客户端通过 Bearer Token 访问；若指定了 ALLOWED_ORIGIN 白名单则优先匹配白名单
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
      // 允许常见开发与本地预览
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
  };
}

/**
 * 生产环境强制 Token 鉴权
 * 规则：
 * 1. 若 Worker 内部未设置 API_TOKEN 密钥，直接拒绝访问 (503 Service Unavailable)
 * 2. 若请求头中未附带或 Token 不匹配，拒绝访问 (401 Unauthorized)
 */
export function verifyAuthorization(request: Request, env: Env): AuthResult {
  if (!env.API_TOKEN || !env.API_TOKEN.trim()) {
    return {
      authorized: false,
      status: 503,
      errorCode: 'AUTH_SECRET_MISSING',
      errorMessage: '服务端未配置安全访问凭据 (API_TOKEN)，请通过 wrangler secret put API_TOKEN 配置',
    };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || token !== env.API_TOKEN.trim()) {
    return {
      authorized: false,
      status: 401,
      errorCode: 'UNAUTHORIZED',
      errorMessage: '无效的 API Token 访问凭证，请检查客户端密钥设置',
    };
  }

  return { authorized: true };
}
