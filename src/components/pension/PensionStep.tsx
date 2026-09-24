import { useCallback, useState } from 'react';
import { getMemberAgeMonth } from '../../lib/birthDate';
import { createDefaultPensionMemberState } from '../../lib/pensionDefaults';
import { resolveAutomaticPensionChildLivelihood } from '../../lib/pensionChildLivelihood';
import {
  isEligiblePensionChildAdditionResidence,
  isEligibleSurvivorBasicChild,
} from '../../lib/survivorBasicPension';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import { memberHasPensionData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type {
  FamilyMember,
  PensionChildLivelihoodStatus,
} from '../../types/family';
import { PENSION_CHILD_LIVELIHOOD_LABELS } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { PensionByMember } from '../../types/pension';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import {
  DisclosureSection,
  FormField,
  FormSelect,
  StepHeading,
} from '../ui';
import { PensionBenefitEstimatePanel } from './PensionBenefitEstimatePanel';
import { PublicPensionSection } from './PublicPensionSection';

interface PensionStepProps {
  members: FamilyMember[];
  pensionByMember: PensionByMember;
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  onMembersChange: (members: FamilyMember[]) => void;
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
  onMembersChange,
  onChange,
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

  const pensionChildLivelihoodConfirmationChildren =
    activeMember && activeMemberCanReceiveChildAddition
      ? members.filter((child) => {
          if (child.role !== 'child') return false;

          const referenceYear = referenceDate.getFullYear();
          const referenceMonth = referenceDate.getMonth() + 1;
          const maxMonths = 25 * 12;

          for (let offset = 0; offset <= maxMonths; offset += 1) {
            const serial = referenceMonth - 1 + offset;
            const calendarYear = referenceYear + Math.floor(serial / 12);
            const calendarMonth = (serial % 12) + 1;
            const pensionerAge = getMemberAgeMonth(
              activeMember,
              referenceDate,
              calendarYear,
              calendarMonth,
            );

            // 子の加算が現実に重なり得る老齢年金期だけを確認対象にする。
            if (!pensionerAge || pensionerAge.age < 60) continue;
            if (
              !isEligibleSurvivorBasicChild(
                child,
                referenceDate,
                calendarYear,
                calendarMonth,
              )
            ) {
              continue;
            }
            if (
              !isEligiblePensionChildAdditionResidence(
                child,
                calendarYear,
                calendarMonth,
              )
            ) {
              continue;
            }

            const automatic = resolveAutomaticPensionChildLivelihood({
              child,
              pensioner: activeMember,
              childIncomeEntries: incomeByMember[child.id] ?? [],
              referenceDate,
              calendarYear,
              calendarMonth,
            });
            if (automatic === 'unknown') return true;
          }

          return false;
        })
      : [];

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

      {hasCurrentDisabilityPension ? (
        <div className="pension-context-notice" role="note">
          障害年金額は年金見込み額・キャッシュフローに含みません。
        </div>
      ) : null}

      {hasUnconfirmedPensionChildResidence ? (
        <div className="pension-context-notice pension-context-notice--action" role="note">
          子の加算を反映するには、Q1「家族」で居住状況を確認してください。
        </div>
      ) : null}

      {pensionChildLivelihoodConfirmationChildren.length > 0 ? (
        <DisclosureSection
          title="子の加算の追加確認"
          summary="自動判定できない場合のみ"
          defaultOpen
        >
          {pensionChildLivelihoodConfirmationChildren.map((child) => (
            <FormField
              key={child.id}
              label={`${getMemberTabLabel(child)}の生計維持`}
            >
              <FormSelect
                wide
                value={
                  child.pensionChildLivelihoodByMember?.[resolvedActiveId] ??
                  'unknown'
                }
                onValueChange={(raw) => {
                  const status = raw as PensionChildLivelihoodStatus;
                  onMembersChange(
                    members.map((member) =>
                      member.id === child.id
                        ? {
                            ...member,
                            pensionChildLivelihoodByMember: {
                              ...(member.pensionChildLivelihoodByMember ?? {}),
                              [resolvedActiveId]: status,
                            },
                          }
                        : member,
                    ),
                  );
                }}
                options={(
                  Object.entries(
                    PENSION_CHILD_LIVELIHOOD_LABELS,
                  ) as Array<[PensionChildLivelihoodStatus, string]>
                ).map(([value, label]) => ({ value, label }))}
              />
            </FormField>
          ))}
        </DisclosureSection>
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
