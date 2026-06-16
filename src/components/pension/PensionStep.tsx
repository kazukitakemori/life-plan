import { useMemo, useState } from 'react';
import { createDefaultPensionMemberState } from '../../lib/pensionDefaults';
import { getIncomeEligibleMembers, getMemberTabLabel } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import type { PensionByMember } from '../../types/pension';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { PublicPensionSection } from './PublicPensionSection';

interface PensionStepProps {
  members: FamilyMember[];
  pensionByMember: PensionByMember;
  referenceDate: Date;
  onChange: (pension: PensionByMember) => void;
}

export function PensionStep({
  members,
  pensionByMember,
  referenceDate,
  onChange,
}: PensionStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );

  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = headMember?.id ?? eligibleMembers[0]?.id ?? '';

  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);

  const resolvedActiveId = eligibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : defaultActiveId;

  const activeMember = eligibleMembers.find((m) => m.id === resolvedActiveId);
  const memberState =
    pensionByMember[resolvedActiveId] ?? createDefaultPensionMemberState();

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

      <MemberIncomeTabs
        members={eligibleMembers}
        activeMemberId={resolvedActiveId}
        entryCounts={{}}
        referenceDate={referenceDate}
        onSelect={setActiveMemberId}
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
    </div>
  );
}
