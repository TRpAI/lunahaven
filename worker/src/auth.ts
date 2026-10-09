import { Env } from './types';

export interface AuthResult {
  authorized: boolean;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
}

// 内存中基于客户端 IP 的鉴权防爆破限流器 (Worker Isolate 级防御)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 60 * 1000; // 60 秒窗口
const failedAuthMap = new Map<string, { count: number; lockedUntil: number }>();

function cleanupExpiredRateLimits(now: number) {
  if (failedAuthMap.size > 500) {
    for (const [ip, entry] of failedAuthMap.entries()) {
      if (entry.lockedUntil < now) {
        failedAuthMap.delete(ip);
      }
    }
  }
}

/**
 * 计算客户端 IP 的加盐不可逆摘要 (符合 GDPR/数据合规与隐私保护规范)
 */
export async function hashIpAddress(ip: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(`${ip || 'unknown'}:qiyue_salt_cf_v2`);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  } catch {
    return 'anon_edge';
  }
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
 * 校验来源 Origin 是否在受信任白名单中 (兼顾生产环境安全性与开发预览连通性)
 */
export function isOriginAllowed(origin: string, env: Env): boolean {
  if (!origin) return false;
  const configured = (env.ALLOWED_ORIGIN || '').trim();

  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  const originLower = origin.toLowerCase();

  // 1. 本地开发与标准沙箱开发环境始终允许调试
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app') ||
    host.endsWith('.googleusercontent.com')
  ) {
    return true;
  }

  // 2. 若配置了白名单列表 (严禁非法跨站越权)
  if (configured && configured !== '*') {
    const list = configured.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (list.includes(originLower)) return true;
    if (list.includes(u.origin.toLowerCase()) || list.includes(host)) return true;
    // 严格模式：配置了明确白名单时，绝不随意允许任意其它三方 pages.dev / workers.dev
    return false;
  }

  // 3. 若配置为通配符 '*'
  if (configured === '*') {
    return true;
  }

  // 4. 若未配置 ALLOWED_ORIGIN 变量 (首次部署开箱即用宽容模式，仅允许 pages.dev 与 workers.dev)
  if (!configured) {
    if (host.endsWith('.pages.dev') || host.endsWith('.workers.dev')) {
      return true;
    }
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Client-Version, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    // 关键安全响应标头 (Cloudflare Edge 规范)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-XSS-Protection': '0',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  };

  // 仅对明确校验通过的可信 Origin 返回 CORS 允许标头，严禁使用 '*'
  if (allowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/**
 * 生产环境强制 Token 鉴权 (兼容 API_TOKEN 与 AUTH_TOKEN，具备严格时序攻击与防爆破防御)
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

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  cleanupExpiredRateLimits(now);

  // 检查防爆破锁定
  const rateLimitEntry = failedAuthMap.get(clientIp);
  if (rateLimitEntry && rateLimitEntry.lockedUntil > now) {
    const remainSec = Math.ceil((rateLimitEntry.lockedUntil - now) / 1000);
    return {
      authorized: false,
      status: 429,
      errorCode: 'TOO_MANY_REQUESTS',
      errorMessage: `认证失败次数过多，边缘安全系统已自动防护限流，请在 ${remainSec} 秒后重试`,
    };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // 校验 Token 长度与格式防范超大报文 DoS 攻击
  if (!token || token.length > 512) {
    const prev = failedAuthMap.get(clientIp) || { count: 0, lockedUntil: 0 };
    const nextCount = prev.count + 1;
    failedAuthMap.set(clientIp, {
      count: nextCount,
      lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : 0,
    });

    return {
      authorized: false,
      status: 401,
      errorCode: 'UNAUTHORIZED',
      errorMessage: token.length > 512
        ? 'API Token 长度超出安全限制 (最大 512 字符)'
        : '缺少有效的 Authorization Bearer API Token 凭据',
    };
  }

  const isMatched = await timingSafeEqualAsync(token, configuredToken);
  if (!isMatched) {
    const prev = failedAuthMap.get(clientIp) || { count: 0, lockedUntil: 0 };
    const nextCount = prev.count + 1;
    const isLocked = nextCount >= MAX_FAILED_ATTEMPTS;
    failedAuthMap.set(clientIp, {
      count: nextCount,
      lockedUntil: isLocked ? now + LOCKOUT_WINDOW_MS : 0,
    });

    return {
      authorized: false,
      status: isLocked ? 429 : 401,
      errorCode: isLocked ? 'TOO_MANY_REQUESTS' : 'UNAUTHORIZED',
      errorMessage: isLocked
        ? `API Token 验证连续失败达到上限，边缘防护已对该 IP 临时限流 60 秒`
        : '无效的 API Token 访问凭据，请检查客户端密钥设置',
    };
  }

  // 认证成功，清除失败计数
  failedAuthMap.delete(clientIp);
  return { authorized: true };
}
