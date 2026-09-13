import { useCallback, useMemo, useState } from 'react';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import {
  createFollowUpLivingSchedule,
  createLivingExpenseSchedule,
} from '../../lib/livingDefaults';
import { memberHasLivingData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import { buildSecondLifeLivingOptions } from '../../lib/secondLifeEstimates';
import { getSecondLifeLivingDesignSummary } from '../../lib/secondLifeLabels';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type {
  LivingExpenseSchedule,
  LivingExpenseState,
} from '../../types/living';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { PensionByMember } from '../../types/pension';
import type { SecondLifeState } from '../../types/secondLife';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { SecondLifeLivingSection } from '../secondLife/SecondLifeLivingSection';
import { SecondLifeRefinePanel } from '../shared/SecondLifeRefinePanel';
import { CopySettingsBar, StepHeading } from '../ui';
import { LivingScheduleCard } from './LivingScheduleCard';

interface LivingStepProps {
  members: FamilyMember[];
  livingState: LivingExpenseState;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  secondLifeState?: SecondLifeState;
  incomeByMember?: IncomeByMember;
  pensionByMember?: PensionByMember;
  purposeNote?: string;
  onChange: (state: LivingExpenseState) => void;
  onSecondLifeChange?: (state: SecondLifeState) => void;
  onApplySecondLifeLiving?: () => void;
}

export function LivingStep({
  members,
  livingState,
  referenceDate,
  memberTabExtras,
  onMemberTabExtrasChange,
  secondLifeState,
  incomeByMember,
  pensionByMember,
  purposeNote,
  onChange,
  onSecondLifeChange,
  onApplySecondLifeLiving,
}: LivingStepProps) {
  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = headMember?.id ?? '';
  const [activeTargetId, setActiveTargetId] = useState(defaultActiveId);

  const memberHasData = useCallback(
    (memberId: string) => memberHasLivingData(livingState, memberId),
    [livingState],
  );

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'living',
    members,
    memberTabExtras,
    onMemberTabExtrasChange,
    memberHasData,
    fallbackActiveId: defaultActiveId,
    activeId: activeTargetId,
    setActiveId: setActiveTargetId,
  });

  const [copySourceId, setCopySourceId] = useState(defaultActiveId);

  const livingOptions = useMemo(() => {
    if (!secondLifeState) return [];
    return buildSecondLifeLivingOptions({
      livingState,
      familyMembers: members,
      incomeByMember: incomeByMember ?? {},
      pensionByMember: pensionByMember ?? {},
      referenceDate,
      startAge: secondLifeState.startAge,
    });
  }, [
    secondLifeState,
    livingState,
    members,
    incomeByMember,
    pensionByMember,
    referenceDate,
  ]);

  const resolvedTargetId = visibleMembers.some((m) => m.id === activeTargetId)
    ? activeTargetId
    : (visibleMembers[0]?.id ?? defaultActiveId);

  const contextMember = visibleMembers.find((m) => m.id === resolvedTargetId);
  const schedules = livingState.byTarget[resolvedTargetId] ?? [];

  const scheduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [targetId, list] of Object.entries(livingState.byTarget)) {
      counts[targetId] = list.length;
    }
    for (const member of visibleMembers) {
      counts[member.id] ??= 0;
    }
    return counts;
  }, [visibleMembers, livingState.byTarget]);

  const copySourceOptions = useMemo(
    () =>
      visibleMembers.map((member) => ({
        id: member.id,
        label: getMemberTabLabel(member),
      })),
    [visibleMembers],
  );

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
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  const resolvedCopySourceId = copySourceOptions.some(
    (option) => option.id === copySourceId,
  )
    ? copySourceId
    : (copySourceOptions[0]?.id ?? '');

  return (
    <div className="step-page living-step">
      <StepHeading
        number={4}
        title="生活費"
        lead="世帯の共有費は負担している人（多くの場合は世帯主）のタブへ。小遣いなど個人分はそれぞれのタブへ入力します。"
        actions={
          <button type="button" className="show-all-btn" disabled>
            全員まとめて表示
          </button>
        }
      />

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      <MemberIncomeTabs
        members={visibleMembers}
        activeMemberId={resolvedTargetId}
        entryCounts={scheduleCounts}
        referenceDate={referenceDate}
        onSelect={setActiveTargetId}
        addableMembers={addableMembers}
        onAddMemberTab={handleAddMemberTab}
        removableMemberIds={removableMemberIds}
        onRemoveMemberTab={handleRemoveMemberTab}
      />

      <CopySettingsBar
        value={resolvedCopySourceId}
        options={copySourceOptions}
        onChange={setCopySourceId}
        onCopy={copySettingsFrom}
        disabled={
          resolvedCopySourceId === resolvedTargetId ||
          (livingState.byTarget[resolvedCopySourceId]?.length ?? 0) === 0
        }
      />

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

      {secondLifeState && onSecondLifeChange ? (
        <SecondLifeRefinePanel
          title="セカンドライフの生活水準を具体化する"
          summary={getSecondLifeLivingDesignSummary(secondLifeState)}
        >
          <SecondLifeLivingSection
            state={secondLifeState}
            options={livingOptions}
            onChange={(patch) =>
              onSecondLifeChange({
                ...secondLifeState,
                ...patch,
              })
            }
            onApply={onApplySecondLifeLiving}
          />
        </SecondLifeRefinePanel>
      ) : null}
    </div>
  );
}
