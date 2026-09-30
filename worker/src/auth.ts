import { Env } from './types';

/**
 * Handle CORS headers based on environment configuration
 */
export function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGIN || '*';

  let allowOrigin = '*';
  if (allowed === '*') {
    allowOrigin = origin || '*';
  } else {
    const list = allowed.split(',').map((s) => s.trim().toLowerCase());
    if (list.includes(origin.toLowerCase())) {
      allowOrigin = origin;
    } else {
      allowOrigin = list[0] || origin || '*';
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Verify Bearer token authorization
 */
export function isAuthorized(request: Request, env: Env): boolean {
  // If no API_TOKEN configured in Worker secrets, permit access (initial setup mode)
  if (!env.API_TOKEN) {
    return true;
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  return token === env.API_TOKEN.trim();
}
