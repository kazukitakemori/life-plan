import { useCallback, useState } from 'react';
import { createDefaultPensionMemberState } from '../../lib/pensionDefaults';
import { memberHasPensionData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { PensionByMember } from '../../types/pension';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { StepHeading } from '../ui';
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
  const hasCurrentDisabilityPension =
    (activeMember?.disabilityPension ?? 'none') !== 'none';
  const hasUnconfirmedPensionChildResidence = members.some(
    (member) =>
      (member.role === 'child' ||
        (member.role === 'other' &&
          member.otherRelationship === 'grandchild')) &&
      (member.pensionChildResidence ?? 'unknown') === 'unknown',
  );
  const activeMemberCanReceiveChildAddition =
    activeMember?.role === 'head' ||
    activeMember?.role === 'spouse' ||
    (activeMember?.role === 'other' &&
      activeMember.otherRelationship === 'common_law_partner');
  const hasUnconfirmedPensionChildLivelihood =
    activeMemberCanReceiveChildAddition &&
    members.some(
      (member) =>
        member.role === 'child' &&
        (member.pensionChildLivelihoodByMember?.[resolvedActiveId] ??
          'unknown') === 'unknown',
    );

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
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page pension-step">
      <StepHeading number={8} title="年金" />

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      {hasCurrentDisabilityPension ? (
        <p className="purpose-input-note" role="note">
          Q1で障害年金の受給権が登録されています。障害年金額は自動計算対象外のため、現時点ではQ8・キャッシュフローへ金額を自動反映していません。また、障害年金の全額支給停止、受給開始・失権年月、65歳前の特別支給の老齢厚生年金との選択、65歳以降の年金選択は保存していないため、加給年金・振替加算・経過的寡婦加算などとの調整や、65歳前に受給権を失った場合の繰下げ可否までは完全に自動判定できません。現在登録されている受給権が続く前提で、確認できる範囲だけを反映します。
        </p>
      ) : null}

      {hasUnconfirmedPensionChildResidence ? (
        <p className="purpose-input-note" role="note">
          2028年4月以降の「子の加算」を正確に試算するには、Q1「家族」の詳細設定で対象となる子の「年金上の居住状況」を確認してください。未確認のままでは加算を自動計上しません。
        </p>
      ) : null}

      {hasUnconfirmedPensionChildLivelihood ? (
        <p className="purpose-input-note" role="note">
          老齢年金の「子の加算」には、年金を受ける本人が子の生計を維持していることの確認が必要です。Q1「家族」の詳細設定で、対象となる子の「年金上の生計維持」を受給者ごとに確認してください。未確認の子は加算を自動計上しません。
        </p>
      ) : null}

      <p className="purpose-input-note" role="note">
        寡婦年金は現在、自動計算・キャッシュフロー反映の対象外です。Q8の年金見込み額には含まれていません。
      </p>

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
        referenceDate={referenceDate}
        memberState={memberState}
        onChange={(state) => updateMemberState(resolvedActiveId, state)}
      />

      <PensionBenefitEstimatePanel
        member={activeMember}
        memberState={memberState}
        incomeEntries={incomeEntries}
        familyMembers={members}
        pensionByMember={pensionByMember}
        incomeByMember={incomeByMember}
        referenceDate={referenceDate}
      />
    </div>
  );
}
