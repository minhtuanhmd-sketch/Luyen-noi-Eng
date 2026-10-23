import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Share,
  PlusSquare,
  CheckCircle2,
  WifiOff,
  X,
  ShieldCheck,
  Volume2,
  Mic,
  Sun,
  Download,
} from 'lucide-react';
import { iOSHardwareManager, IOSHardwareSnapshot } from '../utils/iOSHardwareManager';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    const ua = window.navigator.userAgent;
    const isIPadOS =
      navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const ios = (/iPad|iPhone|iPod/.test(ua) || isIPadOS) && !(window as any).MSStream;
    setIsIOS(ios);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIOSGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Show iOS Safari / standalone PWA guide modal
      setShowIOSGuide(true);
    }
  }, [deferredPrompt]);

  return {
    canInstall: !isInstalled,
    isInstalled,
    isIOS,
    showIOSGuide,
    setShowIOSGuide,
    triggerInstall,
  };
}

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[11px] font-semibold"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline PWA</span>
    </div>
  );
}

interface PWAInstallButtonProps {
  onOpenBackupSection?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenBackupSection,
}) => {
  const {
    isInstalled,
    showIOSGuide,
    setShowIOSGuide,
    triggerInstall,
  } = usePWAInstall();

  const [hwState, setHwState] = useState<IOSHardwareSnapshot>(() =>
    iOSHardwareManager.getSnapshot()
  );

  useEffect(() => {
    return iOSHardwareManager.subscribe(setHwState);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={triggerInstall}
        aria-label="Cài ứng dụng iOS PWA & Trạng thái Phần cứng"
        className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition-colors touch-target flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800 text-[#0284C7] dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/80"
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span className="hidden lg:inline text-xs font-semibold">
          {isInstalled ? 'iOS PWA Active' : 'Cài App iPhone'}
        </span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-pwa-modal-title"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0284C7] dark:text-sky-400">
                  <Smartphone className="w-4 h-4" />
                  <span>Native iOS WebKit Standalone Architecture</span>
                </div>
                <h3
                  id="ios-pwa-modal-title"
                  className="text-base sm:text-lg font-bold font-serif-display mt-0.5"
                >
                  Cài Đặt Ứng Dụng Lên Màn Hình Chính iPhone
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Đóng hướng dẫn"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3-Step iOS Safari Add to Home Screen Guide */}
            <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#151F32] border border-slate-200/80 dark:border-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0284C7] text-white font-bold text-xs">
                  1
                </span>
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Nhấn biểu tượng Chia sẻ (Share) trên Safari</span>
                    <Share className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Nằm ở thanh công cụ phía dưới màn hình iPhone khi truy cập botkeep.xyz.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#151F32] border border-slate-200/80 dark:border-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0284C7] text-white font-bold text-xs">
                  2
                </span>
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Chọn “Thêm vào MH chính” (Add to Home Screen)</span>
                    <PlusSquare className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Cuộn nhẹ danh sách tùy chọn của Safari và nhấn vào mục có dấu cộng.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#151F32] border border-slate-200/80 dark:border-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#059669] text-white font-bold text-xs">
                  3
                </span>
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Nhấn “Thêm” (Add) ở góc trên bên phải</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Mở LexiSpeak từ màn hình chính để chạy toàn màn hình (Standalone 120Hz), dùng Offline 100% và lưu trữ bền vững qua IndexedDB.
                  </p>
                </div>
              </li>
            </ol>

            {/* Live iOS WebKit Hardware & Media Lifecycle Status */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#151F32] border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
                  <span>Trạng Thái iOSHardwareManager & IndexedDB</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  ProMotion GPU
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-200/70 dark:border-slate-800">
                  <div className="text-slate-400 flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-sky-400" />
                    <span>WebAudio</span>
                  </div>
                  <div className="font-bold mt-0.5 text-slate-900 dark:text-white">
                    {hwState.audioUnlocked ? 'Đã Mở Khóa' : 'Chờ Chạm'}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-200/70 dark:border-slate-800">
                  <div className="text-slate-400 flex items-center gap-1">
                    <Mic className="w-3 h-3 text-emerald-400" />
                    <span>Mic Stream</span>
                  </div>
                  <div className="font-bold mt-0.5 text-slate-900 dark:text-white">
                    {hwState.micStreamReady ? 'Giữ Kết Nối' : 'Sẵn Sàng'}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-200/70 dark:border-slate-800">
                  <div className="text-slate-400 flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-400" />
                    <span>WakeLock</span>
                  </div>
                  <div className="font-bold mt-0.5 text-slate-900 dark:text-white">
                    {hwState.wakeLockActive ? 'Chống Tắt Màn' : 'Tự Động'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {onOpenBackupSection && (
                <button
                  type="button"
                  onClick={() => {
                    setShowIOSGuide(false);
                    onOpenBackupSection();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                >
                  <Download className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" />
                  <span>Sao Lưu / Nhập JSON</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  iOSHardwareManager.unlockAudioContext();
                  void iOSHardwareManager.requestWakeLock();
                  setShowIOSGuide(false);
                }}
                className="ml-auto px-4 py-2 rounded-xl bg-[#0284C7] dark:bg-sky-600 text-white text-xs font-bold hover:bg-[#0369A1]"
              >
                Đã Hiểu & Kích Hoạt Âm Thanh iOS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
