import { useCallback, useEffect, useMemo, useState } from 'react';
import { memberHasIncomeData } from '../../lib/memberTabVisibility';
import { useMemberTabDomain } from '../../lib/useMemberTabDomain';
import {
  buildOtherTabYearView,
  OTHER_TAB_IDS,
  resolveOtherTabActiveTabId,
} from '../../lib/otherTabYearView';
import type { CashFlowTableData } from '../../types/cashFlow';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';
import type { MemberTabExtras } from '../../types/memberTabVisibility';
import type { PensionByMember } from '../../types/pension';
import type { TaxBreakdownReferenceDetail } from '../../types/taxBreakdownReference';
import { MemberIncomeTabs } from '../income/MemberIncomeTabs';
import { OtherBreakdownPanel } from './OtherBreakdownPanel';

export interface OtherTaxSocialBreakdownProps {
  members: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  cashFlowData: CashFlowTableData;
  calendarYear: number;
  /** 未指定時は基本ルール＋収入データのみ（分析モーダル向け） */
  memberTabExtras?: MemberTabExtras;
  onMemberTabExtrasChange?: (extras: MemberTabExtras) => void;
  initialMemberId?: string;
  onOpenReference?: (detail: TaxBreakdownReferenceDetail) => void;
}

export function OtherTaxSocialBreakdown({
  members,
  incomeByMember,
  priorYearIncomeByMember,
  pensionByMember,
  referenceDate,
  cashFlowData,
  calendarYear,
  memberTabExtras = {},
  onMemberTabExtrasChange,
  initialMemberId,
  onOpenReference,
}: OtherTaxSocialBreakdownProps) {
  const headMember = members.find((m) => m.role === 'head');
  const [activeMemberId, setActiveMemberId] = useState(
    initialMemberId ?? headMember?.id ?? '',
  );
  const [activeTabId, setActiveTabId] = useState<string>(
    OTHER_TAB_IDS.incomeTax,
  );

  const memberHasData = useCallback(
    (memberId: string) => memberHasIncomeData(incomeByMember, memberId),
    [incomeByMember],
  );

  const handleExtrasChange = useCallback(
    (extras: MemberTabExtras) => {
      onMemberTabExtrasChange?.(extras);
    },
    [onMemberTabExtrasChange],
  );

  const {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  } = useMemberTabDomain({
    domain: 'taxSocialBreakdown',
    members,
    memberTabExtras,
    onMemberTabExtrasChange: handleExtrasChange,
    memberHasData,
    fallbackActiveId: headMember?.id ?? '',
    activeId: activeMemberId,
    setActiveId: setActiveMemberId,
  });

  useEffect(() => {
    if (!initialMemberId) return;
    if (!visibleMembers.some((member) => member.id === initialMemberId)) {
      return;
    }
    setActiveMemberId(initialMemberId);
    setActiveTabId(OTHER_TAB_IDS.incomeTax);
  }, [calendarYear, initialMemberId, visibleMembers]);

  const fallbackActiveId = headMember?.id ?? visibleMembers[0]?.id ?? '';

  const resolvedActiveId = visibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : fallbackActiveId;

  const activeMember = useMemo(
    () => visibleMembers.find((member) => member.id === resolvedActiveId),
    [visibleMembers, resolvedActiveId],
  );

  const yearView = useMemo(() => {
    if (!headMember || !activeMember) {
      return null;
    }

    return buildOtherTabYearView({
      cashFlowData,
      members,
      incomeByMember,
      priorYearIncomeByMember,
      pensionByMember,
      referenceDate,
      headMember,
      member: activeMember,
      calendarYear,
    });
  }, [
    headMember,
    activeMember,
    cashFlowData,
    members,
    incomeByMember,
    priorYearIncomeByMember,
    pensionByMember,
    referenceDate,
    calendarYear,
  ]);

  const resolvedActiveTabId = useMemo(() => {
    if (!yearView) {
      return OTHER_TAB_IDS.incomeTax;
    }
    return resolveOtherTabActiveTabId(activeTabId, yearView.visibleTabIds);
  }, [activeTabId, yearView]);

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of visibleMembers) {
      counts[member.id] = incomeByMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [visibleMembers, incomeByMember]);

  if (!headMember) {
    return (
      <p className="placeholder-message">
        ご家族（Q1）で世帯主を登録してください。
      </p>
    );
  }

  return (
    <div className="other-tax-social-breakdown">
      <MemberIncomeTabs
        members={visibleMembers}
        activeMemberId={resolvedActiveId}
        entryCounts={entryCounts}
        referenceDate={referenceDate}
        onSelect={setActiveMemberId}
        addableMembers={onMemberTabExtrasChange ? addableMembers : []}
        onAddMemberTab={
          onMemberTabExtrasChange ? handleAddMemberTab : undefined
        }
        removableMemberIds={
          onMemberTabExtrasChange ? removableMemberIds : []
        }
        onRemoveMemberTab={
          onMemberTabExtrasChange ? handleRemoveMemberTab : undefined
        }
      />

      {yearView ? (
        <section
          className="other-breakdown-year-section"
          aria-label={`${yearView.yearLabel}の計算内訳`}
        >
          <div className="other-breakdown-year-header">
            <h3 className="other-breakdown-year-title">{yearView.yearLabel}</h3>
            <p className="other-breakdown-year-desc">{yearView.description}</p>
          </div>

          <div className="other-breakdown-tab-groups">
            {yearView.tabGroups.map((group) => (
              <div key={group.label} className="other-breakdown-tab-group">
                <span className="other-breakdown-tab-group-label">
                  {group.label}
                </span>
                <div
                  className="other-breakdown-tabs"
                  role="tablist"
                  aria-label={`${yearView.yearLabel}・${group.label}`}
                >
                  {group.tabs.map((tab) => {
                    const active = tab.id === resolvedActiveTabId;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`other-breakdown-tab${active ? ' active' : ''}`}
                        onClick={() => setActiveTabId(tab.id)}
                      >
                        {tab.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div
            role="tabpanel"
            className="other-breakdown-panel other-breakdown-panel--nested"
          >
            <OtherBreakdownPanel
              activeTabId={resolvedActiveTabId}
              onOpenReference={onOpenReference}
              {...yearView.panelProps}
            />
          </div>
        </section>
      ) : (
        <p className="placeholder-message">
          選択した年の計算内訳を表示できません。
        </p>
      )}
    </div>
  );
}
