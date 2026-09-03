import { useMemo } from 'react';

import {
  buildSecondLifeGuide,
  getSecondLifeChecklistStatusLabel,
  type SecondLifeChecklistItem,
} from '../../lib/secondLifeGuide';
import { SECOND_LIFE_DEFAULT_START_AGE } from '../../lib/secondLifeDefaults';
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

interface SecondLifeGuideStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  livingState: LivingExpenseState;
  lifeEventState: LifeEventState;
  referenceDate: Date;
  secondLifeState: SecondLifeState;
  onSecondLifeChange: (state: SecondLifeState) => void;
  onNavigateToStep: (stepId: StepId) => void;
}

function ChecklistCard({
  item,
  designNote,
  onNavigate,
}: {
  item: SecondLifeChecklistItem;
  designNote?: string;
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
        {item.stepLabel} で入力する →
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
  onNavigateToStep,
}: SecondLifeGuideStepProps) {
  const head = members.find((member) => member.role === 'head');

  const guide = useMemo(
    () =>
      buildSecondLifeGuide({
        startAge: secondLifeState.startAge,
        familyMembers: members,
        housingState,
        livingState,
        lifeEventState,
        referenceDate,
      }),
    [
      secondLifeState.startAge,
      members,
      housingState,
      livingState,
      lifeEventState,
      referenceDate,
    ],
  );

  if (!head) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族（Q1）で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page second-life-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">Q12. セカンドライフ</h2>
          <p className="second-life-lead">
            住まい・生活費・介護の入力状況を確認します
          </p>
        </div>
      </div>

      <p className="second-life-guide-intro">
        開始年齢は Q3・Q4・Q5 の各画面でも変更でき、すべて連動します。ここでは入力状況の確認ができます。
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

      <h3 className="second-life-guide-checklist-title">入力状況チェック</h3>
      <p className="second-life-guide-checklist-lead">
        各ステップでの設計・入力ができているか確認できます。
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
            onNavigate={() => onNavigateToStep(item.stepId)}
          />
        ))}
      </div>
    </div>
  );
}
