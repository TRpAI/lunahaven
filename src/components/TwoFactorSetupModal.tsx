import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { generateBackupRecoveryCodes, generateBase32Secret, generateOtpAuthUri, verifyTOTPCode } from '../utils/totp';
import { QRCodeView } from './QRCodeView';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnableSuccess: (secret: string, backupCodes: string[]) => void;
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  isOpen,
  onClose,
  onEnableSuccess,
}) => {
  const [step, setStep] = useState<'scan' | 'backup'>('scan');
  const [secret, setSecret] = useState('');
  const [otpUri, setOtpUri] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCopiedSecret, setIsCopiedSecret] = useState(false);
  const [isCopiedBackups, setIsCopiedBackups] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const newSecret = generateBase32Secret(16);
      const uri = generateOtpAuthUri(newSecret, 'SingleUser', '栖月账本');
      const codes = generateBackupRecoveryCodes(8);
      setSecret(newSecret);
      setOtpUri(uri);
      setBackupCodes(codes);
      setStep('scan');
      setVerifyCode('');
      setErrorMsg('');
      setIsCopiedSecret(false);
      setIsCopiedBackups(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setIsCopiedSecret(true);
    setTimeout(() => setIsCopiedSecret(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    setIsCopiedBackups(true);
    setTimeout(() => setIsCopiedBackups(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    const content = `栖月账本 (Qiyue Ledger) - 2FA 应急备用恢复码\n生成时间: ${new Date().toLocaleString()}\n\n请妥善保管，每个恢复码仅限使用一次：\n\n${backupCodes
      .map((c, i) => `${i + 1}. ${c}`)
      .join('\n')}\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qiyue_2fa_backup_codes_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerifyAndProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode || verifyCode.trim().length !== 6) {
      setErrorMsg('请输入 6 位动态口令');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const isValid = await verifyTOTPCode(verifyCode.trim(), secret);
      if (isValid) {
        setStep('backup');
      } else {
        setErrorMsg('验证码不正确或已过期，请检查手机时间与口令后重试');
      }
    } catch {
      setErrorMsg('验证过程出错，请重试');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFinish = () => {
    onEnableSuccess(secret, backupCodes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {step === 'scan' ? '绑定二步验证 (2FA / TOTP)' : '保存应急备用恢复码'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {step === 'scan' ? '使用身份验证器扫码绑定' : '手机不可用时可使用恢复码登录'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'scan' ? (
          <div className="space-y-4">
            {/* Step 1 Instructions */}
            <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1 leading-relaxed">
              <p>1. 打开 <b>Google Authenticator</b>、<b>iOS 系统密码验证器</b> 或 <b>Microsoft Authenticator</b>。</p>
              <p>2. 扫描下方二维码，或手动复制并输入密钥：</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center py-2">
              <QRCodeView value={otpUri} size={160} />
            </div>

            {/* Secret key box */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs">
              <div className="truncate mr-2">
                <span className="text-[10px] text-zinc-400 block">密钥 (Base32)</span>
                <span className="font-mono font-bold tracking-wider text-zinc-800 dark:text-zinc-200 select-all">
                  {secret}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopySecret}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium shrink-0 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                {isCopiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopiedSecret ? '已复制' : '复制'}</span>
              </button>
            </div>

            {/* Form to verify 6-digit code */}
            <form onSubmit={handleVerifyAndProceed} className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                  输入验证器生成的 6 位动态口令进行激活
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => {
                    setVerifyCode(e.target.value.replace(/\D/g, ''));
                    setErrorMsg('');
                  }}
                  placeholder="例如: 849201"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-mono tracking-widest text-center text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-500 font-medium">
                  {errorMsg}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? '验证中...' : '验证并下一步'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
              ⚠️ 请将以下 <b>8 个应急恢复码</b> 保存到安全位置（如密码管理器或离线便签）。若手机丢失或无法获取口令，可使用恢复码登录，每个仅限使用一次。
            </div>

            {/* Backup codes grid */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 font-mono text-xs text-center text-zinc-800 dark:text-zinc-200 select-all">
              {backupCodes.map((c, i) => (
                <div key={i} className="py-1 px-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/80">
                  {c}
                </div>
              ))}
            </div>

            {/* Actions for backup codes */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleCopyBackupCodes}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {isCopiedBackups ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopiedBackups ? '已全部复制' : '复制全部恢复码'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadBackupCodes}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载 TXT 备份</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>我已妥善保存，完成开启</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
