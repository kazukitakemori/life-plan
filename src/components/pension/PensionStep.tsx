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
  InfoDialog,
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
          <span>Q1で障害年金の受給権が登録されています。</span>
          <InfoDialog title="障害年金の受給権がある場合" label="試算への影響">
            <p>
              障害年金額は自動計算対象外のため、現時点ではQ8・キャッシュフローへ金額を自動反映していません。
            </p>
            <p>
              障害年金の全額支給停止、受給開始・失権年月、65歳前の特別支給の老齢厚生年金との選択、65歳以降の年金選択は保存していないため、加給年金・振替加算・経過的寡婦加算などとの調整や、65歳前に受給権を失った場合の繰下げ可否までは完全に自動判定できません。
            </p>
            <p>
              現在登録されている受給権が続く前提で、確認できる範囲だけを反映します。
            </p>
          </InfoDialog>
        </div>
      ) : null}

      {hasUnconfirmedPensionChildResidence ? (
        <div className="pension-context-notice pension-context-notice--action" role="note">
          <span>
            子の加算を試算するには、Q1「家族」で対象となる子の年金上の居住状況を確認してください。
          </span>
          <InfoDialog title="子の加算と居住状況" label="なぜ確認が必要？">
            <p>
              2028年4月以降の「子の加算」を正確に試算するには、対象となる子の「年金上の居住状況」の確認が必要です。
            </p>
            <p>
              未確認のままでは、条件を推測せず子の加算を自動計上しません。
            </p>
          </InfoDialog>
        </div>
      ) : null}

      {pensionChildLivelihoodConfirmationChildren.length > 0 ? (
        <DisclosureSection
          title="子の加算の追加確認"
          summary="自動判定できない場合のみ"
          defaultOpen
        >
          <p className="ui-note">
            生計維持は、Q1の「世帯主と生計を一にする期間」と扶養設定、Q7の収入から通常ケースを自動判定します。最終学歴連動、基準を超える収入からの減少見込み、別世帯での仕送りなど、入力済み情報だけでは判断できない場合だけ確認してください。
          </p>
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

      <div className="pension-context-info">
        <InfoDialog title="現在の自動計算対象外" label="自動計算対象外の年金">
          <p>
            寡婦年金は現在、自動計算・キャッシュフロー反映の対象外です。Q8の年金見込み額には含まれていません。
          </p>
        </InfoDialog>
      </div>

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
