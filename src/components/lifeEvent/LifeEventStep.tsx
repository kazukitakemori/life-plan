import { useCallback, useMemo, useState } from 'react';
import {
  createLifeEventEntryFromPreset,
} from '../../lib/lifeEventDefaults';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import { memberHasLifeEventData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type { LifeEventPresetId, LifeEventState } from '../../types/lifeEvent';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import { AddLifeEventCards } from './AddLifeEventCards';
import { LifeEventTable } from './LifeEventTable';
import { MemberLifeEventTabs } from './MemberLifeEventTabs';
import { SecondLifeRefinePanel } from '../shared/SecondLifeRefinePanel';
import { SecondLifeStartAgeField } from '../secondLife/SecondLifeStartAgeField';
import type { SecondLifeState } from '../../types/secondLife';

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
  secondLifeState,
  purposeNote,
  onChange,
  onSecondLifeChange,
  onAddSecondLifeNursing,
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
    if (source.length === 0 || copySourceId === resolvedActiveId) return;

    const cloned = source.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      celebrationBeneficiaries: entry.celebrationBeneficiaries?.map(
        (beneficiary) => ({ ...beneficiary }),
      ),
    }));
    persistEntries(resolvedActiveId, cloned);
  };

  if (!headMember || !activeMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族（Q1）で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page life-event-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">
            Q3. ライフイベント
            <span className="step-subtitle">
              結婚・夢・医療・介護など
            </span>
          </h2>
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
        </div>
      </div>

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

        <div className="life-event-copy-bar">
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
          <span className="life-event-copy-from">から</span>
          <button
            type="button"
            className="life-event-copy-btn"
            onClick={copySettingsFrom}
            disabled={
              copySourceId === resolvedActiveId ||
              (lifeEventState.byMember[copySourceId]?.length ?? 0) === 0
            }
          >
            設定をコピー
          </button>
        </div>
      </div>

      <LifeEventTable
        entries={entries}
        member={activeMember}
        familyMembers={members}
        referenceDate={referenceDate}
        onChange={(updated) => persistEntries(resolvedActiveId, updated)}
      />

      <AddLifeEventCards activeMember={activeMember} onAdd={addEntryFromPreset} />

      {onAddSecondLifeNursing && secondLifeState && onSecondLifeChange ? (
        <SecondLifeRefinePanel
          title="セカンドライフの介護を具体化する"
          summary="世帯主・配偶者の介護費を追加できます"
        >
          <div className="second-life-section-toolbar">
            <SecondLifeStartAgeField
              value={secondLifeState.startAge}
              onChange={(startAge) =>
                onSecondLifeChange({
                  ...secondLifeState,
                  startAge,
                })
              }
            />
          </div>
          <div className="second-life-nursing-actions">
            <p className="second-life-apply-note">
              世帯主・配偶者それぞれの介護費（継続）を追加します。内容はあとから編集できます。
            </p>
            <button
              type="button"
              className="second-life-apply-btn"
              onClick={onAddSecondLifeNursing}
            >
              セカンドライフ用の介護費を追加
            </button>
          </div>
        </SecondLifeRefinePanel>
      ) : null}
    </div>
  );
}
