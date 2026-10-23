import React, { useEffect, useState } from 'react';
import { iOSHardwareManager } from '../utils/iOSHardwareManager';

interface AudioWaveformProps {
  isActive: boolean;
  mode: 'idle' | 'recording' | 'tts_normal' | 'tts_slow' | 'simulating';
  audioLevels?: number[];
}

const BAR_COUNT = 28;

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isActive,
  mode,
  audioLevels,
}) => {
  const [animatedBars, setAnimatedBars] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => 0.18 + Math.sin(i * 0.5) * 0.08)
  );

  useEffect(() => {
    if (!isActive) {
      setAnimatedBars(
        Array.from({ length: BAR_COUNT }, (_, i) => 0.16 + Math.sin(i * 0.45) * 0.06)
      );
      return;
    }

    const intervalMs = mode === 'tts_slow' ? 110 : 65;
    const timer = window.setInterval(() => {
      const liveMicLevels =
        mode === 'recording'
          ? iOSHardwareManager.sampleMicWaveformLevels(BAR_COUNT)
          : null;

      setAnimatedBars((prev) =>
        prev.map((_, idx) => {
          if (liveMicLevels && liveMicLevels[idx] !== undefined) {
            return liveMicLevels[idx];
          }
          if (audioLevels && audioLevels[idx] !== undefined) {
            return Math.max(0.15, Math.min(1, audioLevels[idx]));
          }
          const wave =
            0.35 +
            0.35 * Math.sin(Date.now() / 140 + idx * 0.55) +
            0.25 * Math.cos(Date.now() / 90 - idx * 0.3);
          return Math.max(0.15, Math.min(0.98, wave));
        })
      );
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isActive, mode, audioLevels]);

  const statusText =
    mode === 'recording'
      ? 'Đang thu âm trực tiếp qua Persistent MediaStream (iOS WebKit)...'
      : mode === 'tts_normal'
      ? 'Đang phát âm mẫu chuẩn bản xứ (Tốc độ tự nhiên 1.0x)...'
      : mode === 'tts_slow'
      ? 'Đang phát âm mẫu phân tách âm tiết (Tốc độ chậm 0.8x)...'
      : mode === 'simulating'
      ? 'Đang phân tích phổ âm học qua Web Worker & đối chiếu phụ âm cuối...'
      : 'Sẵn sàng thu âm hoặc nghe mẫu phát âm (1.0x / 0.8x)';

  const barColorClass =
    mode === 'recording'
      ? 'bg-[#DC2626] dark:bg-rose-400'
      : mode === 'tts_normal' || mode === 'tts_slow'
      ? 'bg-[#0284C7] dark:bg-sky-400'
      : mode === 'simulating'
      ? 'bg-[#059669] dark:bg-emerald-400'
      : 'bg-slate-300 dark:bg-slate-700';

  return (
    <div
      className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#151F32] border border-slate-200 dark:border-slate-800 transition-colors gpu-layer"
      data-testid="audio-waveform-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {statusText}
        </span>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          {mode === 'tts_slow'
            ? '0.8x (Articulatory Focus)'
            : mode === 'tts_normal'
            ? '1.0x (Natural Prosody)'
            : '16kHz PCM / ProMotion GPU'}
        </span>
      </div>

      <div
        className="h-11 flex items-center justify-between gap-1 px-2"
        aria-hidden="true"
      >
        {animatedBars.map((level, index) => (
          <div
            key={index}
            className={`w-1.5 rounded-full transition-transform duration-100 gpu-animate waveform-bar ${barColorClass}`}
            style={{
              height: '38px',
              transform: `translateZ(0) scaleY(${level.toFixed(2)})`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
