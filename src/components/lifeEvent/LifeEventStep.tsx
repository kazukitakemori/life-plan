import { useCallback, useMemo, useState } from 'react';
import {
  createLifeEventEntryFromPreset,
} from '../../lib/lifeEventDefaults';
import { isSecondLifeManagedLifeEvent } from '../../lib/lifeEventSource';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import { memberHasLifeEventData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type { LifeEventPresetId, LifeEventState } from '../../types/lifeEvent';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { SecondLifeState } from '../../types/secondLife';
import { CopySettingsBar, StepHeading } from '../ui';
import { AddLifeEventCards } from './AddLifeEventCards';
import { LifeEventTable } from './LifeEventTable';
import { MemberLifeEventTabs } from './MemberLifeEventTabs';

interface LifeEventStepProps {
  members: FamilyMember[];
  lifeEventState: LifeEventState;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  secondLifeState?: SecondLifeState;
  purposeNote?: string;
  onChange: (state: LifeEventState) => void;
  onSecondLifeChange?: (state: SecondLifeState) => void;
  onAddSecondLifeNursing?: () => void;
}

export function LifeEventStep({
  members,
  lifeEventState,
  referenceDate,
  memberTabExtras,
  onMemberTabExtrasChange,
  purposeNote,
  onChange,
}: LifeEventStepProps) {
  const headMember = members.find((m) => m.role === 'head');
  const [activeMemberId, setActiveMemberId] = useState(headMember?.id ?? '');
  const [copySourceId, setCopySourceId] = useState(headMember?.id ?? '');

  const memberHasData = useCallback(
    (memberId: string) => memberHasLifeEventData(lifeEventState, memberId),
    [lifeEventState],
  );

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'lifeEvent',
    members,
    memberTabExtras,
    onMemberTabExtrasChange,
    memberHasData,
    fallbackActiveId: headMember?.id ?? '',
    activeId: activeMemberId,
    setActiveId: setActiveMemberId,
  });

  const fallbackActiveId = headMember?.id ?? visibleMembers[0]?.id ?? '';

  const resolvedActiveId = visibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : fallbackActiveId;

  const activeMember = visibleMembers.find((m) => m.id === resolvedActiveId);
  const entries = activeMember
    ? (lifeEventState.byMember[activeMember.id] ?? [])
    : [];

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of visibleMembers) {
      counts[member.id] = lifeEventState.byMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [visibleMembers, lifeEventState.byMember]);

  const copySourceOptions = useMemo(
    () =>
      visibleMembers.map((member) => ({
        id: member.id,
        label: getMemberTabLabel(member),
      })),
    [visibleMembers],
  );

  const copySourceManualCount = useMemo(
    () =>
      (lifeEventState.byMember[copySourceId] ?? []).filter(
        (entry) => !isSecondLifeManagedLifeEvent(entry),
      ).length,
    [lifeEventState.byMember, copySourceId],
  );

  const persistEntries = (memberId: string, updated: typeof entries) => {
    onChange({
      ...lifeEventState,
      byMember: { ...lifeEventState.byMember, [memberId]: updated },
    });
  };

  const addEntryFromPreset = (presetId: LifeEventPresetId) => {
    if (!activeMember) return;
    const refMonth = referenceDate.getMonth() + 1;
    const nextEntry = createLifeEventEntryFromPreset(
      presetId,
      activeMember,
      refMonth,
      members,
    );
    persistEntries(resolvedActiveId, [...entries, nextEntry]);
  };

  const copySettingsFrom = () => {
    const source = lifeEventState.byMember[copySourceId] ?? [];
    if (copySourceId === resolvedActiveId) return;

    const destinationManaged = entries.filter(isSecondLifeManagedLifeEvent);
    const clonedManual = source
      .filter((entry) => !isSecondLifeManagedLifeEvent(entry))
      .map((entry) => ({
        ...entry,
        id: crypto.randomUUID(),
        celebrationBeneficiaries: entry.celebrationBeneficiaries?.map(
          (beneficiary) => ({ ...beneficiary }),
        ),
      }));

    if (clonedManual.length === 0) return;
    persistEntries(resolvedActiveId, [...destinationManaged, ...clonedManual]);
  };

  if (!headMember || !activeMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page life-event-step">
      <StepHeading
        number={3}
        title="ライフイベント"
        subtitle="結婚・夢・医療・介護など"
      />

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      <div className="life-event-toolbar">
        <MemberLifeEventTabs
          members={visibleMembers}
          activeMemberId={resolvedActiveId}
          entryCounts={entryCounts}
          referenceDate={referenceDate}
          onSelect={setActiveMemberId}
          addableMembers={addableMembers}
          onAddMemberTab={handleAddMemberTab}
          removableMemberIds={removableMemberIds}
          onRemoveMemberTab={handleRemoveMemberTab}
        />

        <CopySettingsBar
          value={copySourceId}
          options={copySourceOptions}
          onChange={setCopySourceId}
          onCopy={copySettingsFrom}
          disabled={
            copySourceId === resolvedActiveId || copySourceManualCount === 0
          }
        />
      </div>

      <LifeEventTable
        entries={entries}
        member={activeMember}
        familyMembers={members}
        referenceDate={referenceDate}
        onChange={(updated) => persistEntries(resolvedActiveId, updated)}
      />

      <AddLifeEventCards activeMember={activeMember} onAdd={addEntryFromPreset} />
    </div>
  );
}
