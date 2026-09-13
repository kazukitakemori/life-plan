import { SecondLifeChoiceCard } from './SecondLifeChoiceCard';
import './SecondLifeModeSelector.css';

interface SecondLifeModeSelectorProps {
  title?: string;
  /** false のときはどちらの選択肢も選択済みに見せない */
  configured?: boolean;
  useCurrent: boolean;
  currentLabel: string;
  reviewLabel: string;
  currentDescription: string;
  reviewDescription: string;
  name: string;
  onUseCurrent: () => void;
  onReview: () => void;
}

export function SecondLifeModeSelector({
  title,
  configured = true,
  useCurrent,
  currentLabel,
  reviewLabel,
  currentDescription,
  reviewDescription,
  name,
  onUseCurrent,
  onReview,
}: SecondLifeModeSelectorProps) {
  return (
    <div className="second-life-mode-selector">
      <p className="second-life-mode-selector-title">{title ?? 'この項目をどうしますか？'}</p>
      <div
        className="second-life-mode-grid"
        role="radiogroup"
        aria-label="セカンドライフでの扱い"
      >
        <SecondLifeChoiceCard
          active={configured && useCurrent}
          label={currentLabel}
          name={name}
          onSelect={onUseCurrent}
        >
          <p className="second-life-mode-description">{currentDescription}</p>
        </SecondLifeChoiceCard>
        <SecondLifeChoiceCard
          active={configured && !useCurrent}
          label={reviewLabel}
          name={name}
          onSelect={onReview}
        >
          <p className="second-life-mode-description">{reviewDescription}</p>
        </SecondLifeChoiceCard>
      </div>
    </div>
  );
}
