import { useCallback, useState } from 'react';
import { createDefaultPensionMemberState } from '../../lib/pensionDefaults';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import { memberHasPensionData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { PensionByMember } from '../../types/pension';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { PensionBenefitEstimatePanel } from './PensionBenefitEstimatePanel';
import { PublicPensionSection } from './PublicPensionSection';

interface PensionStepProps {
  members: FamilyMember[];
  pensionByMember: PensionByMember;
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  onChange: (pension: PensionByMember) => void;
  purposeNote?: string;
}

export function PensionStep({
  members,
  pensionByMember,
  incomeByMember,
  referenceDate,
  memberTabExtras,
  onMemberTabExtrasChange,
  onChange,
  purposeNote,
}: PensionStepProps) {
  const headMember = members.find((m) => m.role === 'head');
  const [activeMemberId, setActiveMemberId] = useState(headMember?.id ?? '');

  const memberHasData = useCallback(
    (memberId: string) => memberHasPensionData(pensionByMember, memberId),
    [pensionByMember],
  );

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'pension',
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
  const memberState =
    pensionByMember[resolvedActiveId] ?? createDefaultPensionMemberState();
  const incomeEntries = incomeByMember[resolvedActiveId] ?? [];

  const updateMemberState = (
    memberId: string,
    patch: Partial<PensionByMember[string]>,
  ) => {
    const current =
      pensionByMember[memberId] ?? createDefaultPensionMemberState();
    onChange({
      ...pensionByMember,
      [memberId]: { ...current, ...patch },
    });
  };

  if (!activeMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族（Q1）で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page pension-step">
      <div className="step-header">
        <h2 className="step-title">Q8. 年金</h2>
        <div className="pension-header-actions">
          <div className="step-actions">
            <button type="button" className="step-action-btn" disabled>
              解説 <span aria-hidden>▼</span>
            </button>
            <button type="button" className="step-action-btn" disabled>
              <span className="step-action-icon" aria-hidden>
                ▶
              </span>{' '}
              ガイド
            </button>
            <button type="button" className="step-action-btn" disabled>
              <span className="step-action-icon" aria-hidden>
                ↗
              </span>{' '}
              参考リンク <span aria-hidden>▼</span>
            </button>
            <button type="button" className="step-action-btn" disabled>
              <span className="step-action-icon" aria-hidden>
                📝
              </span>{' '}
              メモ
            </button>
          </div>
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

      <MemberIncomeTabs
        members={visibleMembers}
        activeMemberId={resolvedActiveId}
        entryCounts={{}}
        referenceDate={referenceDate}
        onSelect={setActiveMemberId}
        addableMembers={addableMembers}
        onAddMemberTab={handleAddMemberTab}
        removableMemberIds={removableMemberIds}
        onRemoveMemberTab={handleRemoveMemberTab}
      />

      <PublicPensionSection
        member={activeMember}
        headOfHouseholdLabel={
          headMember ? getMemberTabLabel(headMember) : '世帯主さん'
        }
        referenceDate={referenceDate}
        memberState={memberState}
        onChange={(state) => updateMemberState(resolvedActiveId, state)}
      />

      <PensionBenefitEstimatePanel
        member={activeMember}
        memberState={memberState}
        incomeEntries={incomeEntries}
        referenceDate={referenceDate}
      />
    </div>
  );
}
