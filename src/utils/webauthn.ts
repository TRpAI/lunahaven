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
 * 注册绑定本设备的生物识别凭据
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

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    // 获取当前设备环境推断设备名称
    const ua = navigator.userAgent;
    let deviceName = '当前设备生物凭据';
    if (/iPhone|iPad|iPod/.test(ua)) {
      deviceName = 'iOS 平台 (Face ID / Touch ID)';
    } else if (/Macintosh/.test(ua)) {
      deviceName = 'macOS 平台 (Touch ID)';
    } else if (/Windows/.test(ua)) {
      deviceName = 'Windows Hello (指纹/面容/PIN)';
    } else if (/Android/.test(ua)) {
      deviceName = 'Android 生物指纹/人脸识别';
    }

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: '栖月账本',
        id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      },
      user: {
        id: userId,
        name: 'master_user',
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // 限制为本设备指纹/面容/平台认证器
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, credentialId: '', deviceName: '', error: '用户取消或未完成生物识别注册' };
    }

    const credentialId = bufferToBase64URL(credential.rawId);

    return {
      success: true,
      credentialId,
      deviceName,
    };
  } catch (err: any) {
    console.error('Biometric registration error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, credentialId: '', deviceName: '', error: '操作已取消或超时，未完成生物识别验证' };
    }
    if (err.name === 'InvalidStateError') {
      return { success: false, credentialId: '', deviceName: '', error: '该设备生物凭据已存在或状态冲突' };
    }
    return { success: false, credentialId: '', deviceName: '', error: err.message || '生物识别绑定失败' };
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

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credentialId) {
      allowCredentials.push({
        id: base64URLToBuffer(credentialId),
        type: 'public-key',
        transports: ['internal'],
      });
    }

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      userVerification: 'required',
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: '生物识别验证未完成' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Biometric auth error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: '生物识别已取消或验证超时' };
    }
    return { success: false, error: err.message || '生物识别验证失败' };
  }
}
