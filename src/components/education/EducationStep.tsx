import { useCallback, useMemo, useState } from 'react';
import {
  createEducationExpenseEntry,
  createStandardChildEducationPath,
} from '../../lib/educationDefaults';
import {
  getEducationDefaultActiveMemberId,
  getIncomeEligibleMembers,
  getMemberTabLabel,
} from '../../lib/memberDisplay';
import { memberHasEducationData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import type { FamilyMember } from '../../types/family';
import type { EducationByMember } from '../../types/education';
import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { TaxSocialState } from '../../types/taxSocial';
import { CopySettingsBar, SegmentedControl, StepHeading } from '../ui';
import { EducationExpenseChart } from './EducationExpenseChart';
import { EducationExpenseTable } from './EducationExpenseTable';
import { MemberEducationTabs } from './MemberEducationTabs';

const EDUCATION_VIEW_OPTIONS = [
  { value: 'individual', label: '個人別' },
  { value: 'aggregate', label: '全員まとめて' },
] as const;

interface EducationStepProps {
  members: FamilyMember[];
  educationByMember: EducationByMember;
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  onChange: (state: EducationByMember) => void;
  /** 教育費試算など、目的に応じた注記 */
  purposeNote?: string;
}

export function EducationStep({
  members,
  educationByMember,
  incomeByMember,
  priorYearIncomeByMember,
  taxSocialState,
  referenceDate,
  memberTabExtras,
  onMemberTabExtrasChange,
  onChange,
  purposeNote,
}: EducationStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );
  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = useMemo(
    () => getEducationDefaultActiveMemberId(members),
    [members],
  );

  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [copySourceId, setCopySourceId] = useState(
    headMember?.id ?? eligibleMembers[0]?.id ?? '',
  );

  const memberHasData = useCallback(
    (memberId: string) => memberHasEducationData(educationByMember, memberId),
    [educationByMember],
  );

  const personFallbackId =
    (defaultActiveId &&
    eligibleMembers.some((m) => m.id === defaultActiveId)
      ? defaultActiveId
      : eligibleMembers[0]?.id) ?? '';

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'education',
    members,
    memberTabExtras,
    onMemberTabExtrasChange,
    memberHasData,
    fallbackActiveId: personFallbackId,
    activeId: activeMemberId,
    setActiveId: setActiveMemberId,
  });

  const resolvedActiveId = visibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : (visibleMembers.some((m) => m.id === personFallbackId)
        ? personFallbackId
        : (visibleMembers[0]?.id ?? ''));

  const activeMember = visibleMembers.find((m) => m.id === resolvedActiveId);
  const entries = activeMember
    ? (educationByMember[activeMember.id] ?? [])
    : [];

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of visibleMembers) {
      counts[member.id] = educationByMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [visibleMembers, educationByMember]);

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
      ...educationByMember,
      [memberId]: updated,
    });
  };

  const addEntry = () => {
    if (!activeMember) return;
    const last = entries[entries.length - 1];
    const nextEntry = last
      ? createEducationExpenseEntry({
          schoolCategory: last.schoolCategory,
          schoolType: last.schoolType,
          universityHousingType: last.universityHousingType,
          graduateProgramType: last.graduateProgramType,
          startAge: last.endAge,
          startMonth: last.endMonth === 12 ? 1 : last.endMonth + 1,
          endAge: Math.min(last.endAge + 3, activeMember.expectedLifespan),
          endMonth: last.endMonth,
        })
      : activeMember.role === 'child'
        ? createStandardChildEducationPath()[0]
        : createEducationExpenseEntry();
    persistEntries(resolvedActiveId, [...entries, nextEntry]);
  };

  const copySettingsFrom = () => {
    const source = educationByMember[copySourceId] ?? [];
    if (source.length === 0 || copySourceId === resolvedActiveId) return;

    const cloned = source.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      otherExpenses: entry.otherExpenses.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
    }));
    persistEntries(resolvedActiveId, cloned);
  };

  if (!headMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page education-step">
      <StepHeading number={2} title="教育費" />

      {purposeNote ? (
        <p className="purpose-input-note" role="note">
          {purposeNote}
        </p>
      ) : null}

      <SegmentedControl
        className="step-view-control"
        label="表示方法"
        ariaLabel="教育費の表示方法"
        value={showAllMembers ? 'aggregate' : 'individual'}
        options={EDUCATION_VIEW_OPTIONS}
        onChange={(value) => setShowAllMembers(value === 'aggregate')}
      />

      {!showAllMembers ? (
        <div className="education-toolbar">
          <MemberEducationTabs
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

          {activeMember && (
            <CopySettingsBar
              value={copySourceId}
              options={copySourceOptions}
              onChange={setCopySourceId}
              onCopy={copySettingsFrom}
              disabled={
                copySourceId === resolvedActiveId ||
                (educationByMember[copySourceId]?.length ?? 0) === 0
              }
            />
          )}
        </div>
      ) : null}

      {showAllMembers ? (
        <>
          <p className="education-aggregate-note">
            世帯全体の教育費を合算したグラフです。個人の入力に戻すときは「個人別」を選んでください。
          </p>
          <EducationExpenseChart
            mode="aggregate"
            headMember={headMember}
            familyMembers={members}
            eligibleMembers={eligibleMembers}
            educationByMember={educationByMember}
            referenceDate={referenceDate}
          />
        </>
      ) : (
        activeMember && (
          <>
            <EducationExpenseTable
              entries={entries}
              member={activeMember}
              headMember={headMember}
              familyMembers={members}
              incomeByMember={incomeByMember}
              priorYearIncomeByMember={priorYearIncomeByMember}
              taxSocialState={taxSocialState}
              referenceDate={referenceDate}
              onChange={(updated) => persistEntries(resolvedActiveId, updated)}
            />

            <div className="education-footer-actions">
              <button
                type="button"
                className="ui-btn ui-btn--ghost footer-action-btn"
                onClick={addEntry}
              >
                ＋ 教育費を追加
              </button>
            </div>

            <EducationExpenseChart
              member={activeMember}
              headMember={headMember}
              familyMembers={members}
              entries={entries}
              referenceDate={referenceDate}
            />
          </>
        )
      )}
    </div>
  );
}
