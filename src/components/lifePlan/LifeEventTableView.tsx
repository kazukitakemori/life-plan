import { useEffect, useMemo, useState } from 'react';

import {
  buildLifeEventTableData,
  LIFE_MILESTONE_CATEGORY_LABELS,
  type LifeEventTableData,
  type LifeMilestone,
} from '../../lib/lifeMilestoneData';
import { calcBirthYear } from '../../lib/birthDate';
import { getLastOpenedPlanId } from '../../lib/lastOpenedPlan';
import { getLocalPlanRepository } from '../../lib/localPlanRepository';
import { fromPlanPayload } from '../../lib/planDocument';
import type { PlanAppState } from '../../types/plan';
import { StepHeading } from '../ui/StepHeading';
import type { StepGuidance } from '../ui/stepGuidance';
import './life-event-table.css';

const planRepository = getLocalPlanRepository();

const LIFE_EVENT_TABLE_GUIDANCE: StepGuidance = {
  overview:
    '入力済みの家族情報や教育、住まい、乗り物、仕事、年金、老後などから、人生の節目を年ごとにまとめて確認する画面です。金額の推移ではなく「いつ、誰に、何が起こるか」を見るための一覧です。',
  firstSteps: [
    '西暦ごとに、ご家族それぞれが何歳になる年かを確認します。',
    '色分けされたイベントから、教育・住まい・仕事・年金などの大きな節目が重なる時期を確認します。',
    '気になる予定があれば、該当する入力画面に戻って時期や内容を見直します。',
  ],
  whenUnsure:
    'お金の増減や資産残高まで確認したい場合は「資産形成」を見てください。ライフイベント表は、人生上の予定と家族の年齢を時系列で把握するための画面です。',
  note:
    'この表は入力内容から自動生成される確認用画面です。ここでは直接編集せず、変更は各入力画面から行います。',
};

function EventBadge({ milestone }: { milestone: LifeMilestone }) {
  return (
    <div
      className={`life-event-table-event life-event-table-event--${milestone.category}`}
    >
      <span className="life-event-table-event-category">
        {LIFE_MILESTONE_CATEGORY_LABELS[milestone.category]}
      </span>
      <span className="life-event-table-event-title">
        {milestone.title}
      </span>
      <span className="life-event-table-event-month">{milestone.month}月</span>
      {milestone.detail ? (
        <span className="life-event-table-event-detail">{milestone.detail}</span>
      ) : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="life-event-table-state" role="status">
      <p>{text}</p>
    </div>
  );
}

function limitToHeadOrSpouseLifespan(
  data: LifeEventTableData,
  planState: PlanAppState,
): LifeEventTableData {
  const householdLifeEndYears = planState.familyMembers
    .filter(
      (member) =>
        (member.role === 'head' || member.role === 'spouse') &&
        member.age != null,
    )
    .map((member) => {
      const birthYear = calcBirthYear(
        member.age,
        member.birthMonth,
        planState.referenceDate,
      );
      return birthYear + member.expectedLifespan;
    });

  if (householdLifeEndYears.length === 0) return data;

  const endYear = Math.max(data.startYear, ...householdLifeEndYears);
  return {
    ...data,
    endYear,
    years: data.years.filter((year) => year.calendarYear <= endYear),
  };
}

export function LifeEventTableView() {
  const [planState, setPlanState] = useState<PlanAppState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const planId = getLastOpenedPlanId();
        if (!planId) {
          if (!cancelled) {
            setErrorMessage('表示するプランがありません。');
          }
          return;
        }
        const record = await planRepository.get(planId);
        if (!record) {
          if (!cancelled) {
            setErrorMessage('プランを読み込めませんでした。');
          }
          return;
        }
        if (!cancelled) {
          setPlanState(fromPlanPayload(record.payload));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setErrorMessage('ライフイベント表の読み込みに失敗しました。');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo<LifeEventTableData | null>(() => {
    if (!planState) return null;
    return limitToHeadOrSpouseLifespan(
      buildLifeEventTableData(planState),
      planState,
    );
  }, [planState]);

  if (errorMessage) return <EmptyState text={errorMessage} />;
  if (!data) return <EmptyState text="ライフイベント表を読み込んでいます。" />;

  const currentYear = planState?.referenceDate.getFullYear() ?? data.startYear;

  return (
    <section className="life-event-table-view">
      <StepHeading
        title="ライフイベント表"
        guidance={LIFE_EVENT_TABLE_GUIDANCE}
        guidanceKicker="ライフイベント表"
        guidanceOverviewTitle="この画面で確認できること"
        guidanceStepsTitle="見方"
        actions={
          <p className="life-event-table-readonly-note">
            入力内容から自動表示しています。変更は各入力画面から行ってください。
          </p>
        }
      />

      <div className="life-event-table-legend" aria-label="イベント分類">
        {Object.entries(LIFE_MILESTONE_CATEGORY_LABELS).map(
          ([category, label]) => (
            <span
              key={category}
              className={`life-event-table-legend-item life-event-table-legend-item--${category}`}
            >
              {label}
            </span>
          ),
        )}
      </div>

      <div className="life-event-table-desktop-wrap">
        <table className="life-event-table-desktop">
          <thead>
            <tr>
              <th className="life-event-table-year-heading" scope="col">
                西暦
              </th>
              {data.members.map((member) => (
                <th key={member.id} scope="col">
                  {member.label}
                </th>
              ))}
              <th className="life-event-table-events-heading" scope="col">
                ライフイベント
              </th>
            </tr>
          </thead>
          <tbody>
            {data.years.map((year) => (
              <tr
                key={year.calendarYear}
                className={
                  year.calendarYear === currentYear
                    ? 'life-event-table-row is-current-year'
                    : 'life-event-table-row'
                }
              >
                <th scope="row" className="life-event-table-year-cell">
                  <span>{year.calendarYear}年</span>
                  {year.calendarYear === currentYear ? (
                    <small>現在</small>
                  ) : null}
                </th>
                {data.members.map((member) => (
                  <td key={member.id} className="life-event-table-age-cell">
                    {year.agesByMember[member.id] == null
                      ? '—'
                      : `${year.agesByMember[member.id]}歳`}
                  </td>
                ))}
                <td className="life-event-table-events-cell">
                  {year.milestones.length > 0 ? (
                    <div className="life-event-table-events">
                      {year.milestones.map((milestone) => (
                        <EventBadge key={milestone.id} milestone={milestone} />
                      ))}
                    </div>
                  ) : (
                    <span className="life-event-table-no-event">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="life-event-table-mobile"
        aria-label="ライフイベント表 モバイル表示"
      >
        {data.years.map((year) => (
          <article
            key={year.calendarYear}
            className={
              year.calendarYear === currentYear
                ? 'life-event-table-year-card is-current-year'
                : 'life-event-table-year-card'
            }
          >
            <div className="life-event-table-year-card-header">
              <h3>{year.calendarYear}年</h3>
              {year.calendarYear === currentYear ? <span>現在</span> : null}
            </div>
            <div className="life-event-table-age-chips">
              {data.members.map((member) => (
                <span key={member.id} className="life-event-table-age-chip">
                  <strong>{member.label}</strong>
                  {year.agesByMember[member.id] == null
                    ? '—'
                    : `${year.agesByMember[member.id]}歳`}
                </span>
              ))}
            </div>
            {year.milestones.length > 0 ? (
              <div className="life-event-table-card-events">
                {year.milestones.map((milestone) => (
                  <EventBadge key={milestone.id} milestone={milestone} />
                ))}
              </div>
            ) : (
              <p className="life-event-table-card-empty">
                大きな予定はありません
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
