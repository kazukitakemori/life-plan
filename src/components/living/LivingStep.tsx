import { useMemo, useState } from 'react';
import {
  getIncomeEligibleMembers,
  getMemberTabLabel,
} from '../../lib/memberDisplay';
import {
  createFollowUpLivingSchedule,
  createLivingExpenseSchedule,
} from '../../lib/livingDefaults';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import {
  HOUSEHOLD_LIVING_KEY,
  type LivingExpenseSchedule,
  type LivingExpenseState,
} from '../../types/living';
import type { PensionByMember } from '../../types/pension';
import { SecondLifeTemplatePanel } from '../shared/SecondLifeTemplatePanel';
import { LivingScheduleCard } from './LivingScheduleCard';
import { MemberLivingTabs } from './MemberLivingTabs';

interface LivingStepProps {
  members: FamilyMember[];
  livingState: LivingExpenseState;
  referenceDate: Date;
  secondLifeStartAge?: number;
  incomeByMember?: IncomeByMember;
  pensionByMember?: PensionByMember;
  purposeNote?: string;
  onChange: (state: LivingExpenseState) => void;
  onAddSecondLifeLiving?: () => void;
}

export function LivingStep({
  members,
  livingState,
  referenceDate,
  secondLifeStartAge,
  purposeNote,
  onChange,
  onAddSecondLifeLiving,
}: LivingStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );
  const headMember = members.find((m) => m.role === 'head');

  const [activeTargetId, setActiveTargetId] = useState(HOUSEHOLD_LIVING_KEY);
  const [copySourceId, setCopySourceId] = useState(
    headMember?.id ?? eligibleMembers[0]?.id ?? HOUSEHOLD_LIVING_KEY,
  );

  const resolvedTargetId = (() => {
    if (activeTargetId === HOUSEHOLD_LIVING_KEY) return HOUSEHOLD_LIVING_KEY;
    return eligibleMembers.some((m) => m.id === activeTargetId)
      ? activeTargetId
      : HOUSEHOLD_LIVING_KEY;
  })();

  const contextMember =
    resolvedTargetId === HOUSEHOLD_LIVING_KEY
      ? headMember
      : eligibleMembers.find((m) => m.id === resolvedTargetId);

  const schedules = livingState.byTarget[resolvedTargetId] ?? [];

  const scheduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [targetId, list] of Object.entries(livingState.byTarget)) {
      counts[targetId] = list.length;
    }
    for (const member of eligibleMembers) {
      counts[member.id] ??= 0;
    }
    counts[HOUSEHOLD_LIVING_KEY] ??= 0;
    return counts;
  }, [eligibleMembers, livingState.byTarget]);

  const copySourceOptions = useMemo(() => {
    const options: { id: string; label: string }[] = [
      { id: HOUSEHOLD_LIVING_KEY, label: 'ご家族' },
    ];
    for (const member of eligibleMembers) {
      options.push({ id: member.id, label: getMemberTabLabel(member) });
    }
    return options;
  }, [eligibleMembers]);

  const persistSchedules = (
    targetId: string,
    updated: LivingExpenseSchedule[],
  ) => {
    onChange({
      ...livingState,
      byTarget: { ...livingState.byTarget, [targetId]: updated },
    });
  };

  const updateSchedule = (scheduleId: string, updated: LivingExpenseSchedule) => {
    persistSchedules(
      resolvedTargetId,
      schedules.map((s) => (s.id === scheduleId ? updated : s)),
    );
  };

  const removeSchedule = (scheduleId: string) => {
    persistSchedules(
      resolvedTargetId,
      schedules.filter((s) => s.id !== scheduleId),
    );
  };

  const addSchedule = () => {
    if (!contextMember) return;
    const refMonth = referenceDate.getMonth() + 1;
    const last = schedules[schedules.length - 1];
    const newSchedule =
      last != null
        ? createFollowUpLivingSchedule(
            last,
            contextMember.age,
            refMonth,
            contextMember.expectedLifespan,
          )
        : createLivingExpenseSchedule(contextMember.age, refMonth);
    persistSchedules(resolvedTargetId, [...schedules, newSchedule]);
  };

  const copyPreviousSchedule = () => {
    if (schedules.length === 0) return;
    const last = schedules[schedules.length - 1];
    const cloned: LivingExpenseSchedule = {
      ...last,
      id: crypto.randomUUID(),
      items: last.items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
    };
    persistSchedules(resolvedTargetId, [...schedules, cloned]);
  };

  const copySettingsFrom = () => {
    const source = livingState.byTarget[copySourceId] ?? [];
    if (source.length === 0 || copySourceId === resolvedTargetId) return;
    const cloned = source.map((schedule) => ({
      ...schedule,
      id: crypto.randomUUID(),
      items: schedule.items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
    }));
    persistSchedules(resolvedTargetId, cloned);
  };

  if (!headMember || !contextMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族（Q1）で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page living-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">Q4. 生活費</h2>
        </div>
        <div className="step-header-right">
          <button type="button" className="step-action-btn" disabled>
            解説
          </button>
          <button type="button" className="step-action-btn" disabled>
            ガイド
          </button>
          <button type="button" className="step-action-btn" disabled>
            メモ
          </button>
          <button type="button" className="show-all-btn" disabled>
            全員まとめて表示
          </button>
        </div>
      </div>

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      {onAddSecondLifeLiving ? (
        <SecondLifeTemplatePanel
          startAge={secondLifeStartAge}
          title="セカンドライフの生活費"
          description={`世帯主 ${secondLifeStartAge}歳以降の生活費スケジュールを追加します（目安は現在の7割）。`}
          buttonLabel="セカンドライフ以降の生活費を追加"
          onAdd={onAddSecondLifeLiving}
        />
      ) : null}

      <MemberLivingTabs
        members={eligibleMembers}
        activeTargetId={resolvedTargetId}
        scheduleCounts={scheduleCounts}
        referenceDate={referenceDate}
        onSelect={setActiveTargetId}
      />

      <div className="living-copy-bar">
        <select
          className="select-input"
          value={copySourceId}
          onChange={(e) => setCopySourceId(e.target.value)}
        >
          {copySourceOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="living-copy-from">から</span>
        <button
          type="button"
          className="living-copy-btn"
          onClick={copySettingsFrom}
          disabled={
            copySourceId === resolvedTargetId ||
            (livingState.byTarget[copySourceId]?.length ?? 0) === 0
          }
        >
          設定をコピー
        </button>
      </div>

      <div className="living-schedules">
        {schedules.length === 0 ? (
          <div className="living-empty">
            <p>
              生活費スケジュールが登録されていません。下のボタンから追加してください。
            </p>
          </div>
        ) : (
          schedules.map((schedule) => (
            <LivingScheduleCard
              key={schedule.id}
              schedule={schedule}
              member={contextMember}
              referenceDate={referenceDate}
              canRemoveSchedule={schedules.length >= 1}
              onChange={(updated) => updateSchedule(schedule.id, updated)}
              onRemoveSchedule={() => removeSchedule(schedule.id)}
            />
          ))
        )}
      </div>

      <div className="living-footer-actions">
        <button type="button" className="footer-action-btn" onClick={addSchedule}>
          ＋ 生活費スケジュールを追加
        </button>
        <button
          type="button"
          className="footer-action-btn"
          onClick={copyPreviousSchedule}
          disabled={schedules.length === 0}
        >
          前のスケジュールをコピー
        </button>
      </div>
    </div>
  );
}
