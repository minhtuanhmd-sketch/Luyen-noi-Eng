import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, ArrowRight } from 'lucide-react';
import { SentenceVariation } from '../types/sla';
import { validateClozeInput } from '../utils/phoneticScoring';

interface ClozeExerciseCardProps {
  variation: SentenceVariation;
  isUnlocked: boolean;
  onUnlockSuccess: (attempts: number) => void;
  onProceedToSpeaking?: () => void;
}

export const ClozeExerciseCard: React.FC<ClozeExerciseCardProps> = ({
  variation,
  isUnlocked,
  onUnlockSuccess,
  onProceedToSpeaking,
}) => {
  const [inputValue, setInputValue] = useState(isUnlocked ? variation.targetWord : '');
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: 'idle' | 'success' | 'near_miss' | 'error';
    message: string;
  }>({
    type: isUnlocked ? 'success' : 'idle',
    message: isUnlocked
      ? 'Đã mở khóa! Bạn đã hoàn thành bước Truy xuất Từ vựng Ngữ cảnh (Contextual Cloze). Hãy nhấn nút bên dưới để chuyển sang bước Luyện nói.'
      : '',
  });

  // Reset local state when variation changes
  useEffect(() => {
    setInputValue(isUnlocked ? variation.targetWord : '');
    setAttempts(0);
    setFeedback({
      type: isUnlocked ? 'success' : 'idle',
      message: isUnlocked
        ? 'Đã mở khóa! Bạn đã hoàn thành bước Truy xuất Từ vựng Ngữ cảnh (Contextual Cloze).'
        : '',
    });
  }, [variation.id, isUnlocked, variation.targetWord]);

  // Deterministic shuffled choices (targetWord + 3 distractors)
  const wordBankChoices = useMemo(() => {
    const all = [variation.targetWord, ...variation.distractors];
    return all.sort((a, b) => a.localeCompare(b));
  }, [variation.targetWord, variation.distractors]);

  const templateParts = useMemo(() => {
    const parts = variation.clozeTemplate.split('___');
    return {
      prefix: parts[0] || '',
      suffix: parts[1] || '',
    };
  }, [variation.clozeTemplate]);

  // Dynamically expand input width so long words are never clipped
  const inputMinWidthCh = useMemo(() => {
    const activeLen = Math.max(
      variation.targetWord.length,
      inputValue.length,
      12
    );
    return `${activeLen + 5}ch`;
  }, [variation.targetWord.length, inputValue.length]);

  const handleVerify = (candidateValue?: string) => {
    const valToCheck = candidateValue !== undefined ? candidateValue : inputValue;
    if (candidateValue !== undefined) {
      setInputValue(candidateValue);
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const validation = validateClozeInput(valToCheck, variation.targetWord);

    if (validation.isCorrect) {
      setFeedback({
        type: 'success',
        message: validation.feedbackVi,
      });
      onUnlockSuccess(nextAttempts);
    } else if (validation.isMorphologicalNearMiss) {
      setFeedback({
        type: 'near_miss',
        message: validation.feedbackVi,
      });
    } else {
      setFeedback({
        type: 'error',
        message: validation.feedbackVi,
      });
    }
  };

  const handleRevealAnswer = () => {
    setInputValue(variation.targetWord);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setFeedback({
      type: 'success',
      message: `Đã điền từ chuẩn "${variation.targetWord}" (${variation.ipa}). Hãy đọc kỹ nghĩa ngữ cảnh và chuyển sang bước Luyện nói.`,
    });
    onUnlockSuccess(nextAttempts);
  };

  return (
    <section
      aria-labelledby="cloze-stage-heading"
      className="p-3 sm:p-5 bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors"
    >
      {/* Clean unboxed metadata header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            01. Điền Từ Ngữ Cảnh (Cloze)
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate max-w-[200px] sm:max-w-none">{variation.pragmaticContext}</span>
        </div>

        {isUnlocked && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#059669] dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Đã mở khóa</span>
          </span>
        )}
      </div>

      <h3 id="cloze-stage-heading" className="sr-only">
        Bài tập điền từ vào chỗ trống
      </h3>

      {/* Interactive Cloze Sentence Display */}
      <div className="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#151F32] border border-slate-200 dark:border-slate-800 mb-2.5">
        <div className="text-base sm:text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 leading-relaxed break-words">
          <span>{templateParts.prefix}</span>
          <span className="inline-block mx-1 my-0.5 align-baseline max-w-full">
            <label htmlFor="cloze-word-input" className="sr-only">
              Từ vựng cần điền
            </label>
            <input
              id="cloze-word-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleVerify();
                }
              }}
              style={{ minWidth: inputMinWidthCh }}
              placeholder="nhập từ..."
              aria-label="Nhập từ vựng cần điền vào chỗ trống"
              className={`px-2.5 py-0.5 text-base font-semibold text-center rounded-lg border transition-colors focus:outline-none ${
                isUnlocked
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-[#059669] dark:border-emerald-500/70 text-[#059669] dark:text-emerald-300'
                  : feedback.type === 'error'
                  ? 'bg-red-50/70 dark:bg-rose-950/60 border-[#DC2626] dark:border-rose-500 text-slate-900 dark:text-rose-200'
                  : feedback.type === 'near_miss'
                  ? 'bg-amber-50/80 dark:bg-amber-950/60 border-[#D97706] dark:border-amber-500 text-slate-900 dark:text-amber-200'
                  : 'bg-white dark:bg-[#0B1120] border-slate-300 dark:border-slate-700 text-[#0284C7] dark:text-sky-300 focus:border-[#0284C7] dark:focus:border-sky-400'
              }`}
            />
          </span>
          <span>{templateParts.suffix}</span>
        </div>

        {/* Full sentence preview & Vietnamese translation */}
        <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/70 text-xs sm:text-sm text-[#0284C7] dark:text-sky-300 font-medium leading-snug">
          “{variation.vietnameseTranslation}”
        </div>
      </div>

      {/* Lexical Clue Box: Vietnamese Hint · POS · IPA */}
      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#151F32]/80 border border-slate-200/80 dark:border-slate-800 mb-2.5">
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Gợi ý nghĩa
          </div>
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
            {variation.vietnameseHint}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Từ loại
          </div>
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            {variation.partOfSpeech}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Phiên âm IPA
          </div>
          <div className="text-xs font-ipa font-semibold text-[#0284C7] dark:text-sky-400">
            {variation.ipa}
          </div>
        </div>
      </div>

      {/* Quick Word Bank Selection (Scaffolding for A2-B2) + Verify Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Chọn nhanh từ ngân hàng từ vựng (hoặc tự gõ vào ô trống):
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {wordBankChoices.map((choice) => {
              const isSelected = inputValue.trim().toLowerCase() === choice.toLowerCase();
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => handleVerify(choice)}
                  className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected && isUnlocked
                      ? 'bg-[#059669] dark:bg-emerald-600 text-white border-[#059669] dark:border-emerald-500'
                      : isSelected
                      ? 'bg-slate-900 dark:bg-sky-500 text-white border-slate-900 dark:border-sky-400'
                      : 'bg-white dark:bg-[#151F32] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isUnlocked && (
            <button
              type="button"
              onClick={handleRevealAnswer}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              Hiện Đáp Án
            </button>
          )}
          <button
            type="button"
            onClick={() => handleVerify()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] dark:bg-sky-600 rounded-xl hover:bg-[#0369A1] dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Kiểm Tra Từ Vựng</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {onProceedToSpeaking && (
            <button
              type="button"
              onClick={onProceedToSpeaking}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                isUnlocked
                  ? 'bg-[#059669] dark:bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                  : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              <span>🎙️ Sang Bước 2: Luyện Nói</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Diagnostic Feedback Banner */}
      {feedback.type !== 'idle' && (
        <div
          role="status"
          className={`mt-3 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs leading-relaxed ${
            feedback.type === 'success'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200'
              : feedback.type === 'near_miss'
              ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
              : 'bg-red-50/80 dark:bg-rose-950/50 border-red-200 dark:border-rose-800/80 text-red-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : feedback.type === 'near_miss' ? (
              <AlertTriangle className="w-4 h-4 text-[#D97706] dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <HelpCircle className="w-4 h-4 text-[#DC2626] dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-semibold">
                {feedback.type === 'success'
                  ? '● ĐẠT CHUẨN TỪ VỰNG: '
                  : feedback.type === 'near_miss'
                  ? '▲ LƯU Ý HÌNH THÁI TỪ (MORPHOLOGY): '
                  : '✕ CẦN THỬ LẠI: '}
              </span>
              <span>{feedback.message}</span>
            </div>
          </div>

          {feedback.type === 'success' && onProceedToSpeaking && (
            <button
              type="button"
              onClick={onProceedToSpeaking}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#059669] dark:bg-emerald-600 rounded-lg hover:bg-emerald-700 shrink-0 shadow-xs"
            >
              <span>🎙️ Bắt Đầu Luyện Nói Ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
};
