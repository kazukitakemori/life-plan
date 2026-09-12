import { useMemo, useState } from 'react';

import {
  buildSecondLifeGuide,
  getSecondLifeChecklistStatusLabel,
  type SecondLifeChecklistItem,
} from '../../lib/secondLifeGuide';
import { SECOND_LIFE_DEFAULT_START_AGE } from '../../lib/secondLifeDefaults';
import { buildSecondLifeLivingOptions } from '../../lib/secondLifeEstimates';
import {
  buildSecondLifeHousingConsistency,
  getSecondLifeHousingConsistencyStatusLabel,
} from '../../lib/secondLifeHousingConsistency';
import {
  formatSecondLifeHousingApplyPreviewLines,
  getSecondLifeHousingApplyWarnings,
} from '../../lib/secondLifeHousingApplySummary';
import {
  getSecondLifeHousingDesignSummary,
  getSecondLifeLivingDesignSummary,
} from '../../lib/secondLifeLabels';
import type { SecondLifeHousingApplyResult } from '../../lib/secondLifeTemplates';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type { LifeEventState } from '../../types/lifeEvent';
import type { LivingExpenseState } from '../../types/living';
import type { HousingState } from '../../types/housing';
import type { PensionByMember } from '../../types/pension';
import type { SecondLifeState } from '../../types/secondLife';
import type { StepId } from '../../types/steps';
import { HousingSecondLifeApplyConfirmModal } from '../housing/HousingSecondLifeApplyConfirmModal';
import { StepHeading } from '../ui';
import { SecondLifeHousingSection } from './SecondLifeHousingSection';
import { SecondLifeLivingSection } from './SecondLifeLivingSection';
import { SecondLifeNursingSection } from './SecondLifeNursingSection';

interface SecondLifeGuideStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  livingState: LivingExpenseState;
  lifeEventState: LifeEventState;
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  secondLifeState: SecondLifeState;
  onSecondLifeChange: (state: SecondLifeState) => void;
  onApplySecondLifeHousing?: () => SecondLifeHousingApplyResult | void;
  onPreviewSecondLifeHousing?: () => SecondLifeHousingApplyResult | void;
  onApplySecondLifeLiving?: () => void;
  onApplySecondLifeNursing: () => void;
  onNavigateToStep: (stepId: StepId) => void;
}

function ChecklistCard({
  item,
  designNote,
  actionLabel,
  onNavigate,
}: {
  item: SecondLifeChecklistItem;
  designNote?: string;
  actionLabel?: string;
  onNavigate: () => void;
}) {
  return (
    <article className={`second-life-guide-card second-life-guide-card--${item.status}`}>
      <div className="second-life-guide-card-head">
        <div>
          <p className="second-life-guide-card-step">
            {item.stepLabel} {item.title}
          </p>
          <p className="second-life-guide-card-summary">{item.summary}</p>
          {designNote ? (
            <p className="second-life-guide-card-design">設計：{designNote}</p>
          ) : null}
        </div>
        <span className={`second-life-guide-status second-life-guide-status--${item.status}`}>
          {getSecondLifeChecklistStatusLabel(item.status)}
        </span>
      </div>

      {item.detailLines.length > 0 ? (
        <ul className="second-life-guide-card-details">
          {item.detailLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        className="second-life-guide-nav-btn"
        onClick={onNavigate}
      >
        {actionLabel ?? `${item.stepLabel} の詳細を見る →`}
      </button>
    </article>
  );
}

export function SecondLifeGuideStep({
  members,
  housingState,
  livingState,
  lifeEventState,
  incomeByMember,
  pensionByMember,
  referenceDate,
  secondLifeState,
  onSecondLifeChange,
  onApplySecondLifeHousing,
  onPreviewSecondLifeHousing,
  onApplySecondLifeLiving,
  onApplySecondLifeNursing,
  onNavigateToStep,
}: SecondLifeGuideStepProps) {
  const head = members.find((member) => member.role === 'head');
  const [housingConfirmOpen, setHousingConfirmOpen] = useState(false);
  const [housingPreviewLines, setHousingPreviewLines] = useState<string[]>([]);
  const [housingWarnings, setHousingWarnings] = useState<string[]>([]);

  const guide = useMemo(
    () =>
      buildSecondLifeGuide({
        startAge: secondLifeState.startAge,
        secondLifeState,
        familyMembers: members,
        housingState,
        livingState,
        lifeEventState,
        referenceDate,
      }),
    [
      secondLifeState,
      members,
      housingState,
      livingState,
      lifeEventState,
      referenceDate,
    ],
  );

  const livingOptions = useMemo(
    () =>
      buildSecondLifeLivingOptions({
        livingState,
        familyMembers: members,
        incomeByMember,
        pensionByMember,
        referenceDate,
        startAge: secondLifeState.startAge,
      }),
    [
      livingState,
      members,
      incomeByMember,
      pensionByMember,
      referenceDate,
      secondLifeState.startAge,
    ],
  );

  const housingConsistency = useMemo(
    () =>
      buildSecondLifeHousingConsistency({
        housingState,
        secondLifeState,
      }),
    [housingState, secondLifeState],
  );

  if (!head) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  const beginHousingApply = () => {
    if (!onApplySecondLifeHousing) return;
    const preview = onPreviewSecondLifeHousing?.();
    if (!preview) {
      onApplySecondLifeHousing();
      return;
    }
    const target = housingState.byTarget[head.id];
    const existingHousingCount =
      (target?.rentals.length ?? 0) + (target?.owned.length ?? 0);
    setHousingPreviewLines(
      preview.changes.length > 0
        ? formatSecondLifeHousingApplyPreviewLines(preview.changes)
        : preview.changeLines,
    );
    setHousingWarnings(
      getSecondLifeHousingApplyWarnings({
        secondLifeState,
        existingHousingCount,
        changes: preview.changes,
      }),
    );
    setHousingConfirmOpen(true);
  };

  const confirmHousingApply = () => {
    onApplySecondLifeHousing?.();
    setHousingConfirmOpen(false);
  };

  return (
    <div className="step-page second-life-step">
      <StepHeading
        number={12}
        title="セカンドライフ"
        lead="これからの暮らし方をここで具体化し、住まい・生活費・介護へ反映します"
      />

      <p className="second-life-guide-intro">
        セカンドライフ開始年齢を基準に、老後の住まい・生活水準・介護をこの画面で設計します。Q4・Q5・Q3は詳細データや反映結果を確認する画面として使います。
      </p>

      <div className="second-life-guide-start-age">
        <label className="second-life-timing">
          <span>セカンドライフ開始年齢（世帯主）</span>
          <input
            type="number"
            className="second-life-age-input"
            min={60}
            max={100}
            value={secondLifeState.startAge}
            onChange={(event) => {
              const startAge =
                Number(event.target.value) || SECOND_LIFE_DEFAULT_START_AGE;
              onSecondLifeChange({
                ...secondLifeState,
                startAge,
                housingActionAge: Math.max(
                  startAge,
                  secondLifeState.housingActionAge ?? startAge,
                ),
              });
            }}
          />
          <span>歳〜</span>
        </label>
      </div>

      <SecondLifeHousingSection
        state={secondLifeState}
        onChange={(patch) =>
          onSecondLifeChange({ ...secondLifeState, ...patch })
        }
        onApply={onApplySecondLifeHousing ? beginHousingApply : undefined}
      />

      <SecondLifeLivingSection
        state={secondLifeState}
        onChange={(patch) =>
          onSecondLifeChange({ ...secondLifeState, ...patch })
        }
        options={livingOptions}
        onApply={onApplySecondLifeLiving}
      />

      <section
        className={`second-life-consistency second-life-consistency--${housingConsistency.status}`}
        aria-labelledby="second-life-housing-consistency-title"
      >
        <div className="second-life-consistency-head">
          <div>
            <p className="second-life-consistency-kicker">住まいとの整合性</p>
            <h3 id="second-life-housing-consistency-title">
              {housingConsistency.title}
            </h3>
          </div>
          <span
            className={`second-life-consistency-status second-life-consistency-status--${housingConsistency.status}`}
          >
            {getSecondLifeHousingConsistencyStatusLabel(housingConsistency.status)}
          </span>
        </div>
        <p className="second-life-consistency-summary">
          {housingConsistency.summary}
        </p>
        {housingConsistency.detailLines.length > 0 ? (
          <ul className="second-life-consistency-details">
            {housingConsistency.detailLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <div className="second-life-consistency-actions">
          <span className="second-life-consistency-design">
            希望：{getSecondLifeHousingDesignSummary(secondLifeState)}
          </span>
          <button
            type="button"
            className="second-life-guide-nav-btn"
            onClick={() => onNavigateToStep('housing')}
          >
            住まいの詳細を見る →
          </button>
        </div>
      </section>

      <SecondLifeNursingSection
        members={members}
        state={secondLifeState}
        onChange={onSecondLifeChange}
        applyStatus={guide.items.find((item) => item.id === 'nursing')?.status ?? 'missing'}
        onApply={onApplySecondLifeNursing}
        onOpenLifeEvent={() => onNavigateToStep('life-event')}
      />

      <h3 className="second-life-guide-checklist-title">整合性・反映状況</h3>
      <p className="second-life-guide-checklist-lead">
        Q12で決めた内容が、計算用データへ正しく反映されているか確認できます。
      </p>

      <div className="second-life-guide-grid">
        {guide.items.map((item) => (
          <ChecklistCard
            key={item.id}
            item={item}
            designNote={
              item.id === 'housing'
                ? getSecondLifeHousingDesignSummary(secondLifeState)
                : item.id === 'living'
                  ? getSecondLifeLivingDesignSummary(secondLifeState)
                  : undefined
            }
            actionLabel={
              item.id === 'housing'
                ? '住まいの詳細を見る →'
                : item.id === 'living'
                  ? '生活費の詳細を見る →'
                  : item.id === 'nursing'
                    ? 'ライフイベントの反映先を見る →'
                    : undefined
            }
            onNavigate={() => onNavigateToStep(item.stepId)}
          />
        ))}
      </div>

      <HousingSecondLifeApplyConfirmModal
        open={housingConfirmOpen}
        previewLines={housingPreviewLines}
        warnings={housingWarnings}
        onClose={() => setHousingConfirmOpen(false)}
        onConfirm={confirmHousingApply}
      />
    </div>
  );
}
