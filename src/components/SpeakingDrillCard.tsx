import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Volume2,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  Play,
  ArrowRight,
} from 'lucide-react';
import {
  CEFRLevel,
  SentenceVariation,
  SpeakingEvaluationSummary,
  WordEvaluationResult,
} from '../types/sla';
import {
  buildSimulatedTranscript,
} from '../utils/phoneticScoring';
import { slaWorkerClient } from '../utils/slaWorkerClient';
import { iOSHardwareManager, IOSHardwareSnapshot } from '../utils/iOSHardwareManager';
import { AudioWaveform } from './AudioWaveform';

interface SpeakingDrillCardProps {
  variation: SentenceVariation;
  cefrLevel: CEFRLevel;
  isUnlocked: boolean;
  onEvaluationComplete: (summary: SpeakingEvaluationSummary) => void;
  onNextSentence: () => void;
  hasNextSentence: boolean;
}

export const SpeakingDrillCard: React.FC<SpeakingDrillCardProps> = ({
  variation,
  cefrLevel,
  isUnlocked,
  onEvaluationComplete,
  onNextSentence,
  hasNextSentence,
}) => {
  const [audioMode, setAudioMode] = useState<
    'idle' | 'recording' | 'tts_normal' | 'tts_slow' | 'simulating'
  >('idle');
  const [evaluation, setEvaluation] = useState<SpeakingEvaluationSummary | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [customTranscript, setCustomTranscript] = useState('');
  const [micNote, setMicNote] = useState<string | null>(null);
  const [hwSnapshot, setHwSnapshot] = useState<IOSHardwareSnapshot>(() =>
    iOSHardwareManager.getSnapshot()
  );

  const recognitionRef = useRef<any>(null);
  const recordingStartRef = useRef<number>(0);

  useEffect(() => {
    return iOSHardwareManager.subscribe(setHwSnapshot);
  }, []);

  // Reset state when switching sentences, muting persistent Mic track via track.enabled = false
  useEffect(() => {
    setAudioMode('idle');
    setEvaluation(null);
    setSelectedWordIndex(null);
    setCustomTranscript('');
    setMicNote(null);
    iOSHardwareManager.setMicTrackEnabled(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, [variation.id]);

  const handlePlayTTS = (rate: 1.0 | 0.8) => {
    // Ensure iOS WebKit AudioContext is unlocked on user gesture
    iOSHardwareManager.unlockAudioContext();
    void iOSHardwareManager.requestWakeLock();
    setAudioMode(rate === 1.0 ? 'tts_normal' : 'tts_slow');

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(variation.fullSentence);
        utterance.lang = 'en-US';
        utterance.rate = rate;
        utterance.onend = () => setAudioMode('idle');
        utterance.onerror = () => setAudioMode('idle');
        window.speechSynthesis.speak(utterance);

        const estMs = Math.round((variation.fullSentence.length * 65) / rate);
        window.setTimeout(() => {
          setAudioMode((prev) =>
            prev === 'tts_normal' || prev === 'tts_slow' ? 'idle' : prev
          );
        }, Math.min(4500, Math.max(1200, estMs)));
        return;
      } catch {
        // fallback below
      }
    }

    window.setTimeout(() => {
      setAudioMode('idle');
    }, 1500);
  };

  const runScoringPipeline = async (transcript: string, durationSec: number) => {
    const result = await slaWorkerClient.evaluateSentenceAsync(
      variation.fullSentence,
      transcript,
      cefrLevel,
      durationSec
    );
    setEvaluation(result);
    setCustomTranscript(transcript);
    const firstNonExact = result.wordResults.findIndex((w) => w.status !== 'accurate');
    setSelectedWordIndex(firstNonExact !== -1 ? firstNonExact : 0);
    onEvaluationComplete(result);
  };

  const handleToggleRecording = async () => {
    if (!isUnlocked) return;

    // Unlock iOS WebAudio & request Screen WakeLock during active speaking drill
    iOSHardwareManager.unlockAudioContext();
    void iOSHardwareManager.requestWakeLock();

    if (audioMode === 'recording') {
      // Mute persistent stream via track.enabled = false (no getUserMedia re-prompt!)
      iOSHardwareManager.setMicTrackEnabled(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setAudioMode('idle');
      return;
    }

    // Initialize or unmute persistent MediaStream once per session
    await iOSHardwareManager.acquirePersistentMicStream(true);

    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      iOSHardwareManager.setMicTrackEnabled(false);
      setMicNote(
        'Trình duyệt hiện tại không hỗ trợ trực tiếp Web Speech API hoặc đang chạy trong môi trường không có Microphone vật lý. Hệ thống đã kích hoạt Bộ mô phỏng Âm học L1 bên dưới để bạn kiểm thử chấm điểm tức thì.'
      );
      handleSimulateProfile('vn_l1_final_consonant');
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recordingStartRef.current = performance.now();
      setAudioMode('recording');
      setMicNote(null);

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        finalTranscript = transcript;
        const elapsedSec = Math.max(
          1.8,
          (performance.now() - recordingStartRef.current) / 1000
        );
        iOSHardwareManager.setMicTrackEnabled(false);
        setAudioMode('idle');
        void runScoringPipeline(transcript, elapsedSec);
      };

      recognition.onerror = () => {
        iOSHardwareManager.setMicTrackEnabled(false);
        setAudioMode('idle');
        setMicNote(
          'Không thu nhận được tín hiệu Microphone (hoặc quyền truy cập bị từ chối). Bạn có thể sử dụng các nút Mô phỏng Giọng đọc Thực tế ngay bên dưới để phân tích lỗi phát âm.'
        );
      };

      recognition.onend = () => {
        iOSHardwareManager.setMicTrackEnabled(false);
        setAudioMode('idle');
        if (!finalTranscript) {
          // Keep current state if error already handled
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      iOSHardwareManager.setMicTrackEnabled(false);
      setAudioMode('idle');
      handleSimulateProfile('vn_l1_final_consonant');
    }
  };

  const handleSimulateProfile = (
    profile: 'native_accurate' | 'vn_l1_final_consonant' | 'hesitant_omission'
  ) => {
    if (!isUnlocked) return;
    iOSHardwareManager.unlockAudioContext();
    setAudioMode('simulating');
    const simulatedText = buildSimulatedTranscript(variation.fullSentence, profile);
    const simulatedDuration =
      profile === 'native_accurate'
        ? 4.0
        : profile === 'vn_l1_final_consonant'
        ? 4.6
        : 5.8;

    window.setTimeout(() => {
      setAudioMode('idle');
      void runScoringPipeline(simulatedText, simulatedDuration);
    }, 280);
  };

  const handleEvaluateCustomTranscript = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnlocked || !customTranscript.trim()) return;
    void runScoringPipeline(customTranscript.trim(), 4.3);
  };

  const selectedWordDetail: WordEvaluationResult | null =
    evaluation && selectedWordIndex !== null
      ? evaluation.wordResults[selectedWordIndex] || null
      : null;

  return (
    <section
      aria-labelledby="speaking-stage-heading"
      className={`p-3.5 sm:p-5 md:p-6 bg-white dark:bg-[#0F172A] rounded-2xl border transition-all gpu-layer ${
        isUnlocked
          ? 'border-slate-200 dark:border-slate-800 opacity-100'
          : 'border-slate-200/80 dark:border-slate-800/60 opacity-80'
      }`}
    >
      {/* Header Row with clean unboxed metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            02. Luyện Nói & Chấm Điểm Phát Âm
          </span>
          <span aria-hidden="true">·</span>
          <span>CEFR {cefrLevel}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {hwSnapshot.micStreamReady
              ? 'Persistent Mic Active'
              : 'WebKit ASR + Worker'}
          </span>
        </div>

        {!isUnlocked && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Hoàn thành Điền từ để mở khóa</span>
          </span>
        )}
      </div>

      <h3 id="speaking-stage-heading" className="sr-only">
        Luyện phát âm và chấm điểm câu
      </h3>

      {/* Target Sentence with highlighted Target Lexical Item & Phonetic Focus (full width, never clipped) */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#151F32] border border-slate-200 dark:border-slate-800 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
          <span>Câu mục tiêu phát âm:</span>
          <span className="font-ipa font-medium text-slate-700 dark:text-sky-300">
            Trọng điểm: {variation.l1PhoneticTrap.phoneme} ({variation.ipa})
          </span>
        </div>

        <p
          className="text-base sm:text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-relaxed break-words"
          data-testid="target-full-sentence"
        >
          {variation.fullSentence}
        </p>

        {/* Vietnamese translation immediately visible */}
        <div className="mt-1 text-xs sm:text-sm font-medium text-[#0284C7] dark:text-sky-300 leading-normal">
          “{variation.vietnameseTranslation}”
        </div>

        {/* Expandable L1 Phonetic Trap & Articulation Tip */}
        <details className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs group">
          <summary className="font-semibold text-amber-600 dark:text-amber-400 cursor-pointer flex items-center justify-between list-none">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Cạm bẫy âm học L1 & Mẹo khẩu hình (Người Việt)</span>
            </span>
            <span className="text-[11px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="mt-2 space-y-1 pl-5 text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <strong className="text-slate-800 dark:text-slate-200">
                Lỗi thường gặp:
              </strong>{' '}
              {variation.l1PhoneticTrap.vietnameseTrap}
            </p>
            <p>
              <strong className="text-[#0284C7] dark:text-sky-400">
                Mẹo khẩu hình chuẩn:
              </strong>{' '}
              {variation.l1PhoneticTrap.articulationTip}
            </p>
          </div>
        </details>
      </div>

      {/* Audio Waveform Animation */}
      <div className="mb-3">
        <AudioWaveform isActive={audioMode !== 'idle'} mode={audioMode} />
      </div>

      {/* Primary Audio & Recording Controls — Thumb-friendly row, never cut off */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 mb-3">
        <button
          type="button"
          onClick={() => handlePlayTTS(1.0)}
          className="touch-btn inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-[#151F32] border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Volume2 className="w-4 h-4 text-[#0284C7] dark:text-sky-400 shrink-0" />
          <span>Nghe 1.0x (Chuẩn)</span>
        </button>

        <button
          type="button"
          onClick={() => handlePlayTTS(0.8)}
          className="touch-btn inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-[#151F32] border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Gauge className="w-4 h-4 text-[#0284C7] dark:text-sky-400 shrink-0" />
          <span>Nghe 0.8x (Chậm)</span>
        </button>

        <button
          type="button"
          disabled={!isUnlocked}
          onClick={handleToggleRecording}
          className={`touch-btn col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-xs ${
            !isUnlocked
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
              : audioMode === 'recording'
              ? 'bg-[#DC2626] text-white hover:bg-red-700 animate-pulse'
              : 'bg-[#0284C7] dark:bg-sky-600 text-white hover:bg-[#0369A1] dark:hover:bg-sky-500'
          }`}
        >
          {audioMode === 'recording' ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>Dừng & Chấm Điểm</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Thu Âm Giọng Nói (Mic)</span>
            </>
          )}
        </button>
      </div>

      {/* Expandable Acoustic Simulation & Diagnostic Sandbox */}
      <details className="mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151F32] overflow-hidden text-xs group">
        <summary className="px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center justify-between list-none hover:bg-slate-100 dark:hover:bg-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-[#0284C7] dark:text-sky-400" />
            <span>Bộ Mô Phỏng Âm Học L1 & Chuỗi ASR (Dành Cho Thiết Bị Không Mic)</span>
          </div>
          <span className="text-[11px] text-slate-400 group-open:rotate-180 transition-transform">▾</span>
        </summary>

        <div className="p-3 pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
            Kiểm thử thuật toán chấm điểm theo 3 kịch bản phát âm thực tế của người học Việt Nam:
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => handleSimulateProfile('native_accurate')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
              <span>Chuẩn Âm Cuối (95–100%)</span>
            </button>

            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => handleSimulateProfile('vn_l1_final_consonant')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 text-[#D97706] dark:text-amber-400" />
              <span>Bỏ Âm Cuối L1 (75–86%)</span>
            </button>

            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => handleSimulateProfile('hesitant_omission')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 text-[#DC2626] dark:text-rose-400" />
              <span>Ngập Ngừng / Sót Từ</span>
            </button>
          </div>

          {/* Optional manual ASR transcript override */}
          <form
            onSubmit={handleEvaluateCustomTranscript}
            className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <input
              id="custom-asr-input"
              type="text"
              disabled={!isUnlocked}
              value={customTranscript}
              onChange={(e) => setCustomTranscript(e.target.value)}
              placeholder="Nhập chuỗi ASR phân tích..."
              className="flex-1 px-3 py-1.5 text-xs font-mono bg-white dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#0284C7]"
            />
            <button
              type="submit"
              disabled={!isUnlocked || !customTranscript.trim()}
              className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300/80 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              Phân Tích Âm
            </button>
          </form>
        </div>
      </details>

      {micNote && (
        <div className="mb-5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          {micNote}
        </div>
      )}

      {/* Real-Time Evaluation Results & Word-by-Word Color-Coded Diagnostics */}
      {evaluation && (
        <div
          className="p-5 rounded-xl bg-white dark:bg-[#151F32] border border-slate-200 dark:border-slate-700/80 space-y-5"
          data-testid="speaking-evaluation-results"
        >
          {/* Quantitative Score Row (Tabular Numerals) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Điểm Tổng Thể (Overall)
              </div>
              <div
                className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5"
                data-testid="overall-speaking-score"
              >
                {evaluation.overallScore}%
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {evaluation.overallScore >= 85
                  ? '● ĐẠT CHUẨN TỰ ĐỘNG HÓA'
                  : evaluation.overallScore >= 70
                  ? '▲ CẦN CHỈNH ÂM CUỐI'
                  : '✕ CẦN LUYỆN LẠI NHỊP CÂU'}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Độ Chính Xác Âm Học
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {evaluation.phoneticAccuracyScore}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Levenshtein + L1 Rules
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Độ Trôi Chảy (Fluency)
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {evaluation.fluencyScore}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                Tốc độ: ~{evaluation.estimatedWpm} WPM
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Độ Đầy Đủ Từ (Completeness)
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {evaluation.completenessScore}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Chuẩn chấm: CEFR {evaluation.cefrLevelApplied}
              </div>
            </div>
          </div>

          {/* Word-by-Word Color-Coded + Icon-Labeled Interactive Tokens */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Phân Tích Từng Từ (Nhấn vào từng từ để xem chẩn đoán khẩu hình chi tiết):
              </span>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1 text-[#059669] dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xanh: Chuẩn xác</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[#D97706] dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Vàng: Thiếu âm cuối / Gần đúng</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[#DC2626] dark:text-rose-400 font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Đỏ: Sai hoặc bỏ sót</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
              {evaluation.wordResults.map((w, idx) => {
                const isSelected = selectedWordIndex === idx;
                const statusStyles =
                  w.status === 'accurate'
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-[#059669]/40 dark:border-emerald-500/50 text-emerald-950 dark:text-emerald-200 hover:border-[#059669]'
                    : w.status === 'minor'
                    ? 'bg-amber-50/90 dark:bg-amber-950/60 border-[#D97706]/50 dark:border-amber-500/60 text-amber-950 dark:text-amber-200 hover:border-[#D97706]'
                    : 'bg-red-50/90 dark:bg-rose-950/60 border-[#DC2626]/50 dark:border-rose-500/60 text-red-950 dark:text-rose-200 hover:border-[#DC2626]';

                return (
                  <button
                    key={`${w.expectedWord}-${idx}`}
                    type="button"
                    onClick={() => setSelectedWordIndex(idx)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${statusStyles} ${
                      isSelected
                        ? 'ring-2 ring-slate-900 dark:ring-sky-400 ring-offset-1 dark:ring-offset-slate-900'
                        : ''
                    }`}
                  >
                    {w.status === 'accurate' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                    ) : w.status === 'minor' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] dark:text-amber-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-[#DC2626] dark:text-rose-400 shrink-0" />
                    )}
                    <span>{w.expectedWord}</span>
                    <span className="text-xs font-mono opacity-80 tabular-nums">
                      {Math.round(w.similarity * 100)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Word Phonetic Inspector */}
          {selectedWordDetail && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Từ mục tiêu: “{selectedWordDetail.expectedWord}”
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    Thu nhận ASR: “{selectedWordDetail.spokenWord || 'Bỏ sót'}”
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Độ tương đồng âm học: {Math.round(selectedWordDetail.similarity * 100)}%
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedWordDetail.diagnosticNoteVi}
                </p>
              </div>
            </div>
          )}

          {/* Linguistic Coach Feedback & Next Sentence CTA */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
              <p>
                <strong className="text-slate-900 dark:text-white">
                  Nhận xét Chuyên gia Ngữ âm:
                </strong>{' '}
                {evaluation.coachFeedbackVi}
              </p>
              <p className="text-[#0284C7] dark:text-sky-400 font-medium">
                {evaluation.l1RemediationActionVi}
              </p>
            </div>

            {hasNextSentence && (
              <button
                type="button"
                onClick={onNextSentence}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 rounded-lg hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Sang Biến Thể Câu Tiếp Theo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
