/**
 * WebAuthn (生物识别 / 指纹 / 面容 / Windows Hello / Touch ID) 工具模块
 */

// 将 ArrayBuffer 转为 Base64URL 字符串
export function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 将 Base64URL 字符串转为 ArrayBuffer
export function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * 检测当前浏览器是否支持 WebAuthn
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof navigator?.credentials?.create === 'function' &&
    typeof navigator?.credentials?.get === 'function'
  );
}

/**
 * 检测当前设备是否具备平台级生物识别硬件 (Touch ID, Face ID, Windows Hello, Android 指纹等)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取当前设备友好显示名称
 */
function getDeviceDisplayName(): string {
  if (typeof navigator === 'undefined') return '当前设备凭据';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'iOS 平台 (Face ID / Touch ID)';
  }
  if (/Macintosh/.test(ua)) {
    return 'macOS 平台 (Touch ID)';
  }
  if (/Windows/.test(ua)) {
    return 'Windows Hello (指纹/面容/PIN)';
  }
  if (/Android/.test(ua)) {
    return 'Android 生物指纹/锁屏凭据';
  }
  return '平台生物识别凭据';
}

/**
 * 解析和人性化 WebAuthn 报错信息
 */
function formatWebAuthnError(err: any): string {
  const msg = err?.message || '';
  const name = err?.name || '';

  if (name === 'NotAllowedError') {
    return '操作已取消或验证超时，未完成生物识别认证';
  }
  if (name === 'InvalidStateError') {
    return '该设备已存在绑定的生物识别凭据，无需重复绑定';
  }
  if (name === 'SecurityError') {
    return '当前页面安全策略或域名不支持凭据管理器访问';
  }
  if (
    name === 'NotReadableError' ||
    msg.includes('credential manager') ||
    msg.includes('Credential Manager') ||
    name === 'UnknownError'
  ) {
    return '系统凭据管理器暂时无法响应。请确保手机已开启屏幕锁定（指纹/人脸/锁屏PIN），并稍后重试。';
  }
  if (name === 'NotSupportedError') {
    return '当前设备或浏览器暂不支持此类型的生物凭据算法';
  }
  return msg || '生物识别操作失败，请重试';
}

/**
 * 安全获取当前域名的 RP ID (规范要求：IP 地址不能作为 rp.id，返回 undefined 让浏览器自动缺省为当前 Origin)
 */
function getSafeRpId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  if (!host) return undefined;
  if (host === 'localhost') return 'localhost';
  // IP 地址 (IPv4) 不得作为 WebAuthn rp.id，否则会引发 SecurityError 或 Credential Manager 异常
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return undefined;
  return host;
}

/**
 * 注册绑定本设备的生物识别凭据 (兼容 Android Credential Manager、iOS FaceID/TouchID 及 Windows Hello)
 */
export async function registerBiometricCredential(
  userName = 'Qiyue Master User'
): Promise<{
  success: boolean;
  credentialId: string;
  deviceName: string;
  error?: string;
}> {
  if (!isWebAuthnSupported()) {
    return { success: false, credentialId: '', deviceName: '', error: '当前浏览器不支持生物识别功能' };
  }

  const deviceName = getDeviceDisplayName();

  // 基础公钥凭据参数配置 (涵盖常见平台算法: ES256, RS256, Ed25519, PS256)
  const pubKeyCredParams: PublicKeyCredentialParameters[] = [
    { alg: -7, type: 'public-key' },   // ES256 (ECDSA w/ SHA-256)
    { alg: -257, type: 'public-key' }, // RS256 (RSA w/ SHA-256)
    { alg: -8, type: 'public-key' },   // Ed25519 (EdDSA)
    { alg: -37, type: 'public-key' },  // PS256
  ];

  const rpId = getSafeRpId();

  // 尝试创建凭据 (优先采用最佳兼容模式 userVerification: 'preferred' 解决 Android 14+ Credential Manager 崩溃问题)
  const createCredentialWithSelection = async (
    authenticatorSelection: AuthenticatorSelectionCriteria
  ): Promise<PublicKeyCredential | null> => {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const creationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: '栖月账本',
        id: rpId || undefined,
      },
      user: {
        id: userId,
        name: 'master_user',
        displayName: userName,
      },
      pubKeyCredParams,
      authenticatorSelection,
      timeout: 60000,
      attestation: 'none',
    };

    return (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;
  };

  try {
    let credential: PublicKeyCredential | null = null;

    try {
      // 第一次尝试：针对本设备认证器平台
      credential = await createCredentialWithSelection({
        authenticatorAttachment: 'platform',
        userVerification: 'preferred', // 使用 preferred 而非 required 规避 Android Credential Manager NotReadableError
        residentKey: 'preferred',
      });
    } catch (firstErr: any) {
      console.warn('First WebAuthn attempt failed, trying fallback mode:', firstErr);
      // 若用户主动取消，则直接抛出不再重复打扰
      if (firstErr?.name === 'NotAllowedError') {
        throw firstErr;
      }
      // 第二次尝试：自适应宽松策略 (解决部分国内定制安卓 ROM 无法锁定 platform attachment 的问题)
      credential = await createCredentialWithSelection({
        userVerification: 'preferred',
        residentKey: 'preferred',
      });
    }

    if (!credential) {
      return { success: false, credentialId: '', deviceName, error: '用户取消或未完成生物识别注册' };
    }

    const credentialId = bufferToBase64URL(credential.rawId);

    return {
      success: true,
      credentialId,
      deviceName,
    };
  } catch (err: any) {
    console.error('Biometric registration error:', err);
    return {
      success: false,
      credentialId: '',
      deviceName,
      error: formatWebAuthnError(err),
    };
  }
}

/**
 * 校验生物识别凭据以完成解锁
 */
export async function authenticateWithBiometrics(
  credentialId?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: '当前环境不支持生物识别' };
  }

  const rpId = getSafeRpId();

  const runAuthentication = async (useCredentialsList: boolean): Promise<PublicKeyCredential | null> => {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (useCredentialsList && credentialId) {
      allowCredentials.push({
        id: base64URLToBuffer(credentialId),
        type: 'public-key',
      });
    }

    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      rpId: rpId || undefined,
      userVerification: 'preferred', // 使用 preferred 保证最大兼容器件成功率
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    };

    return (await navigator.credentials.get({
      publicKey: requestOptions,
    })) as PublicKeyCredential | null;
  };

  try {
    let assertion: PublicKeyCredential | null = null;
    try {
      assertion = await runAuthentication(true);
    } catch (firstErr: any) {
      if (firstErr?.name === 'NotAllowedError') {
        throw firstErr;
      }
      // 容错降级：不指定 credentialId 列表，由系统自动匹配
      assertion = await runAuthentication(false);
    }

    if (!assertion) {
      return { success: false, error: '生物识别验证未完成' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Biometric auth error:', err);
    return {
      success: false,
      error: formatWebAuthnError(err),
    };
  }
}
