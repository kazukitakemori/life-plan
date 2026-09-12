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
  getSecondLifeHousingDesignSummary,
  getSecondLifeLivingDesignSummary,
} from '../../lib/secondLifeLabels';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type { LifeEventState } from '../../types/lifeEvent';
import type { LivingExpenseState } from '../../types/living';
import type { HousingState } from '../../types/housing';
import type { PensionByMember } from '../../types/pension';
import type { SecondLifeState } from '../../types/secondLife';
import type { StepId } from '../../types/steps';
import { StepHeading } from '../ui';
import { SecondLifeHousingSection } from './SecondLifeHousingSection';
import { SecondLifeLivingSection } from './SecondLifeLivingSection';
import { SecondLifeNursingSection } from './SecondLifeNursingSection';
import './SecondLifeWorkspaceTabs.css';

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
  onApplySecondLifeNursing: () => void;
  onNavigateToStep: (stepId: StepId) => void;
}

type SecondLifeWorkspaceTab = 'housing' | 'living' | 'third-life' | 'summary';

const SECOND_LIFE_WORKSPACE_TABS: { id: SecondLifeWorkspaceTab; label: string }[] = [
  { id: 'housing', label: '住まい' },
  { id: 'living', label: '生活費' },
  { id: 'third-life', label: '介護・サードライフ' },
  { id: 'summary', label: 'まとめ' },
];

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
  onApplySecondLifeNursing,
  onNavigateToStep,
}: SecondLifeGuideStepProps) {
  const head = members.find((member) => member.role === 'head');
  const [activeTab, setActiveTab] = useState<SecondLifeWorkspaceTab>('housing');

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

  return (
    <div className="step-page second-life-step">
      <StepHeading
        number={12}
        title="老後の暮らし"
        lead="元気に暮らす時期と、介護が必要になった後まで分けて整理します"
      />

      <p className="second-life-guide-intro">
        元気に暮らす時期を「セカンドライフ」、介護が必要になった後をこのソフトでは「サードライフ」と呼び、同じ「老後の暮らし」の中で分けて設計します。元の入力は消えません。
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

      <div className="second-life-workspace-tabs" role="tablist" aria-label="セカンドライフ設計">
        {SECOND_LIFE_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            id={`second-life-tab-${tab.id}`}
            className={
              activeTab === tab.id
                ? 'second-life-workspace-tab is-active'
                : 'second-life-workspace-tab'
            }
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`second-life-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'housing' ? (
        <div
          id="second-life-panel-housing"
          className="second-life-workspace-panel"
          role="tabpanel"
          aria-labelledby="second-life-tab-housing"
        >
          <SecondLifeHousingSection
            state={secondLifeState}
            onChange={(patch) =>
              onSecondLifeChange({ ...secondLifeState, ...patch })
            }
          />

          <section
            className={`second-life-consistency second-life-consistency--${housingConsistency.status}`}
            aria-labelledby="second-life-housing-consistency-title"
          >
            <div className="second-life-consistency-head">
              <div>
                <p className="second-life-consistency-kicker">現在の住まいとの確認</p>
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
                今回の設定：{getSecondLifeHousingDesignSummary(secondLifeState)}
              </span>
              <button
                type="button"
                className="second-life-guide-nav-btn"
                onClick={() => onNavigateToStep('housing')}
              >
                現在の住まい入力を確認する →
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'living' ? (
        <div
          id="second-life-panel-living"
          className="second-life-workspace-panel"
          role="tabpanel"
          aria-labelledby="second-life-tab-living"
        >
          <SecondLifeLivingSection
            state={secondLifeState}
            onChange={(patch) =>
              onSecondLifeChange({ ...secondLifeState, ...patch })
            }
            options={livingOptions}
          />
        </div>
      ) : null}

      {activeTab === 'third-life' ? (
        <div
          id="second-life-panel-third-life"
          className="second-life-workspace-panel"
          role="tabpanel"
          aria-labelledby="second-life-tab-third-life"
        >
          <SecondLifeNursingSection
            members={members}
            state={secondLifeState}
            onChange={onSecondLifeChange}
            applyStatus={guide.items.find((item) => item.id === 'nursing')?.status ?? 'missing'}
            onApply={onApplySecondLifeNursing}
            onOpenLifeEvent={() => onNavigateToStep('life-event')}
          />
        </div>
      ) : null}

      {activeTab === 'summary' ? (
        <div
          id="second-life-panel-summary"
          className="second-life-workspace-panel second-life-workspace-panel--summary"
          role="tabpanel"
          aria-labelledby="second-life-tab-summary"
        >
          <h3 className="second-life-guide-checklist-title">設定内容の確認</h3>
          <p className="second-life-guide-checklist-lead">
            「今の計画をそのまま使う」を選んだ項目は現在の入力で計算します。「見直す」を選んだ項目は、指定した年齢から今回の設定に切り替えて試算します。
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
                    ? '住まいを編集する →'
                    : item.id === 'living'
                      ? '生活費を編集する →'
                      : 'サードライフを編集する →'
                }
                onNavigate={() =>
                  setActiveTab(
                    item.id === 'housing'
                      ? 'housing'
                      : item.id === 'living'
                        ? 'living'
                        : 'third-life',
                  )
                }
              />
            ))}
          </div>
        </div>
      ) : null}

    </div>
  );
}
