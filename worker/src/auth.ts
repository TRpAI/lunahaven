import { Env } from './types';

export interface AuthResult {
  authorized: boolean;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 基于 WebCrypto SHA-256 摘要的严格常量时间字符串比对
 * 通过对两端凭据进行 SHA-256 哈希后固定以 32 字节比较，消除字符长度泄露与侧信道时序攻击隐患
 */
async function timingSafeEqualAsync(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const aHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(a)));
  const bHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(b)));
  let diff = 0;
  for (let i = 0; i < aHash.length; i++) {
    diff |= aHash[i] ^ bHash[i];
  }
  return diff === 0;
}

/**
 * 校验来源 Origin 是否在受信任白名单中 (拒绝通配符 *，确保生产环境跨域安全)
 */
export function isOriginAllowed(origin: string, env: Env): boolean {
  if (!origin) return false;
  const configured = (env.ALLOWED_ORIGIN || '').trim();

  // 严格安全策略：生产环境严禁使用通配符 '*'，仅允许指定前端域名访问
  if (configured === '*') {
    console.warn('[Security Warning] ALLOWED_ORIGIN 严禁使用通配符 "*"，已自动拒绝通配，仅采用严格受信默认白名单。');
  } else if (configured) {
    const list = configured.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const originLower = origin.toLowerCase();
    if (list.includes(originLower)) return true;
    try {
      const u = new URL(origin);
      if (list.includes(u.origin.toLowerCase())) return true;
    } catch {
      return false;
    }
    return false;
  }

  // 严格安全默认规则：仅允许受信的前端托管域与本地调试，绝不向任意未知域开放
  try {
    const u = new URL(origin);
    if (
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1' ||
      u.hostname.endsWith('.pages.dev') ||
      u.hostname.endsWith('.run.app')
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * 生产环境 CORS 与严格安全响应头配置 (收紧跨域策略，避免使用通配符 *)
 */
export function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, env);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Client-Version',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    // 关键安全响应标头 (Cloudflare Edge 规范)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  // 仅对明确校验通过的可信 Origin 返回 CORS 允许标头，严禁使用 '*'
  if (allowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/**
 * 生产环境强制 Token 鉴权 (兼容 API_TOKEN 与 AUTH_TOKEN，具备严格时序攻击防御)
 */
export async function verifyAuthorization(request: Request, env: Env): Promise<AuthResult> {
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

  if (!token) {
    return {
      authorized: false,
      status: 401,
      errorCode: 'UNAUTHORIZED',
      errorMessage: '缺少有效的 Authorization Bearer API Token 凭据',
    };
  }

  const isMatched = await timingSafeEqualAsync(token, configuredToken);
  if (!isMatched) {
    return {
      authorized: false,
      status: 401,
      errorCode: 'UNAUTHORIZED',
      errorMessage: '无效的 API Token 访问凭据，请检查客户端密钥设置',
    };
  }

  return { authorized: true };
}
