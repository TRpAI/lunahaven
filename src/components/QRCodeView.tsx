import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeViewProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * 生产级高精度二维码组件 (基于标准 ISO/IEC 18004 规范)
 * 完美适配 Google Authenticator、iOS 密码钥匙串、Microsoft Authenticator 扫码绑定
 */
export const QRCodeView: React.FC<QRCodeViewProps> = ({ value, size = 180, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    setError(null);

    QRCode.toCanvas(
      canvasRef.current,
      value,
      {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#18181b', // zinc-900
          light: '#ffffff', // pure white background
        },
      },
      (err) => {
        if (err) {
          console.error('QR code generation error:', err);
          setError('二维码生成异常');
        }
      }
    );
  }, [value, size]);

  return (
    <div className={`inline-flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-zinc-200 shadow-xs ${className}`}>
      {error ? (
        <div
          style={{ width: size, height: size }}
          className="flex items-center justify-center text-xs text-rose-500 font-medium"
        >
          {error}
        </div>
      ) : (
        <canvas ref={canvasRef} className="block rounded-lg" />
      )}
    </div>
  );
};
