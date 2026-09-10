import type { SecondLifeHousingApplyChange } from '../../types/secondLifeHousingApply';
import type { SecondLifeHousingTemplateKind } from '../../lib/secondLifeLabels';

export type HousingSecondLifeApplyFeedback = {
  /** 再反映でもスクロール／フラッシュさせるための一意キー */
  id: number;
  kind: SecondLifeHousingTemplateKind;
  changeLines: string[];
  changes: SecondLifeHousingApplyChange[];
};

type HousingDomainFilter = 'rental' | 'owned';

function touchesPropertyKind(
  changes: SecondLifeHousingApplyChange[],
  propertyKind: 'rental' | 'owned',
): boolean {
  return changes.some(
    (change) =>
      (change.type === 'added' ||
        change.type === 'ended' ||
        change.type === 'cleared') &&
      change.propertyKind === propertyKind,
  );
}

/** 反映後に見せるタブ。賃貸／所有のどちらか一方 */
export function resolveHousingDomainFilterFromApplyChanges(
  changes: SecondLifeHousingApplyChange[],
): HousingDomainFilter {
  const rental = touchesPropertyKind(changes, 'rental');
  const owned = touchesPropertyKind(changes, 'owned');
  if (owned && !rental) return 'owned';
  if (rental && !owned) return 'rental';
  // 両方触れた場合は「追加」を優先。なければ賃貸
  const addedOwned = changes.some(
    (change) => change.type === 'added' && change.propertyKind === 'owned',
  );
  if (addedOwned) return 'owned';
  return 'rental';
}

export function getHousingApplyHighlightSets(
  changes: SecondLifeHousingApplyChange[],
): {
  highlightedIds: Set<string>;
  endedIds: Set<string>;
} {
  const highlightedIds = new Set<string>();
  const endedIds = new Set<string>();
  for (const change of changes) {
    if (change.type === 'added') {
      highlightedIds.add(change.id);
    }
    if (change.type === 'ended') {
      endedIds.add(change.id);
    }
  }
  return { highlightedIds, endedIds };
}

export function housingPropertyElementId(
  kind: 'rental' | 'owned',
  propertyId: string,
): string {
  return `housing-${kind}-${propertyId}`;
}

interface HousingSecondLifeApplySummaryProps {
  feedback: HousingSecondLifeApplyFeedback;
  onDismiss: () => void;
  onShowRental?: () => void;
  onShowOwned?: () => void;
  onOpenLifeEvent?: () => void;
}

export function HousingSecondLifeApplySummary({
  feedback,
  onDismiss,
  onShowRental,
  onShowOwned,
  onOpenLifeEvent,
}: HousingSecondLifeApplySummaryProps) {
  const showRentalJump =
    Boolean(onShowRental) && touchesPropertyKind(feedback.changes, 'rental');
  const showOwnedJump =
    Boolean(onShowOwned) && touchesPropertyKind(feedback.changes, 'owned');
  const hasLifeEvent = feedback.changes.some(
    (change) => change.type === 'life_event',
  );

  return (
    <div
      id="housing-second-life-apply-summary"
      className="second-life-apply-status second-life-apply-status--applied housing-second-life-apply-summary"
      role="status"
      aria-live="polite"
    >
      <div className="housing-second-life-apply-summary-header">
        <strong>セカンドライフの住まいを反映しました</strong>
        <button
          type="button"
          className="housing-second-life-apply-summary-dismiss"
          onClick={onDismiss}
          aria-label="反映結果を閉じる"
        >
          ×
        </button>
      </div>
      <ul className="housing-second-life-apply-summary-list">
        {feedback.changeLines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
      {showRentalJump || showOwnedJump || hasLifeEvent ? (
        <div className="housing-second-life-apply-summary-actions">
          {showRentalJump ? (
            <button
              type="button"
              className="housing-second-life-apply-summary-jump"
              onClick={onShowRental}
            >
              賃貸を見る
            </button>
          ) : null}
          {showOwnedJump ? (
            <button
              type="button"
              className="housing-second-life-apply-summary-jump"
              onClick={onShowOwned}
            >
              所有を見る
            </button>
          ) : null}
          {hasLifeEvent ? (
            onOpenLifeEvent ? (
              <button
                type="button"
                className="housing-second-life-apply-summary-jump"
                onClick={onOpenLifeEvent}
              >
                ライフイベント（Q3）を見る
              </button>
            ) : (
              <span className="housing-second-life-apply-summary-note">
                一時金はライフイベント（Q3）にも反映されています
              </span>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
