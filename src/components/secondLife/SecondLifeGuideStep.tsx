import { useMemo } from 'react';

import {
  buildSecondLifeGuide,
  getSecondLifeChecklistStatusLabel,
  type SecondLifeChecklistItem,
} from '../../lib/secondLifeGuide';
import { SECOND_LIFE_DEFAULT_START_AGE } from '../../lib/secondLifeDefaults';
import {
  buildSecondLifeHousingConsistency,
  getSecondLifeHousingConsistencyStatusLabel,
} from '../../lib/secondLifeHousingConsistency';
import {
  getSecondLifeHousingDesignSummary,
  getSecondLifeLivingDesignSummary,
} from '../../lib/secondLifeLabels';
import type { FamilyMember } from '../../types/family';
import type { LifeEventState } from '../../types/lifeEvent';
import type { LivingExpenseState } from '../../types/living';
import type { HousingState } from '../../types/housing';
import type { SecondLifeState } from '../../types/secondLife';
import type { StepId } from '../../types/steps';
import { StepHeading } from '../ui';
import { SecondLifeNursingSection } from './SecondLifeNursingSection';

interface SecondLifeGuideStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  livingState: LivingExpenseState;
  lifeEventState: LifeEventState;
  referenceDate: Date;
  secondLifeState: SecondLifeState;
  onSecondLifeChange: (state: SecondLifeState) => void;
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
        {actionLabel ?? `${item.stepLabel} で入力する →`}
      </button>
    </article>
  );
}

export function SecondLifeGuideStep({
  members,
  housingState,
  livingState,
  lifeEventState,
  referenceDate,
  secondLifeState,
  onSecondLifeChange,
  onApplySecondLifeNursing,
  onNavigateToStep,
}: SecondLifeGuideStepProps) {
  const head = members.find((member) => member.role === 'head');

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

  const housingConsistency = useMemo(
    () =>
      buildSecondLifeHousingConsistency({
        housingState,
        secondLifeState,
      }),
    [housingState, secondLifeState],
  );

  const nursingItem = guide.items.find((item) => item.id === 'nursing');

  if (!head) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page second-life-step">
      <StepHeading
        number={12}
        title="セカンドライフ"
        lead="これからの暮らし方と、現在の入力内容の整合性を確認します"
      />

      <p className="second-life-guide-intro">
        セカンドライフ開始年齢を基準に、住まい・生活費・介護をここで設計し、各入力画面には計算用データとして反映します。
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
            onChange={(event) =>
              onSecondLifeChange({
                ...secondLifeState,
                startAge:
                  Number(event.target.value) || SECOND_LIFE_DEFAULT_START_AGE,
              })
            }
          />
          <span>歳〜</span>
        </label>
      </div>

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
            住まい計画を確認する →
          </button>
        </div>
      </section>

      <SecondLifeNursingSection
        members={members}
        state={secondLifeState}
        applyStatus={nursingItem?.status ?? 'missing'}
        onChange={onSecondLifeChange}
        onApply={onApplySecondLifeNursing}
        onOpenLifeEvent={() => onNavigateToStep('life-event')}
      />

      <h3 className="second-life-guide-checklist-title">設計・反映状況</h3>
      <p className="second-life-guide-checklist-lead">
        セカンドライフの設計と、各入力画面への反映状態を確認できます。
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
              item.id === 'nursing'
                ? '反映先のライフイベントを確認する →'
                : undefined
            }
            onNavigate={() => onNavigateToStep(item.stepId)}
          />
        ))}
      </div>
    </div>
  );
}
