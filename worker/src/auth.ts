import { Env } from './types';

export interface AuthResult {
  authorized: boolean;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 生产环境严格 CORS 校验
 * 仅允许在环境变量/配置中明确指定的来源 (如: https://qiyuezb.pages.dev)
 */
export function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '').trim();

  let allowOrigin = '';

  if (allowed) {
    const list = allowed.split(',').map((s) => s.trim().toLowerCase());
    if (origin && list.includes(origin.toLowerCase())) {
      allowOrigin = origin;
    } else {
      // 若没有匹配上合法来源，指定为白名单第一项（阻止未经许可的跨域请求）
      allowOrigin = list[0] || '';
    }
  } else {
    // 未配置白名单时，生产环境绝不回退到通配符 *
    allowOrigin = origin || '';
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
