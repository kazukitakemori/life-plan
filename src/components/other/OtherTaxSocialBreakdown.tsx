import { useEffect, useMemo, useState } from 'react';

import { getIncomeEligibleMembers } from '../../lib/memberDisplay';
import {
  buildOtherTabYearView,
  OTHER_TAB_IDS,
  resolveOtherTabActiveTabId,
} from '../../lib/otherTabYearView';
import type { CashFlowTableData } from '../../types/cashFlow';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';
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
  initialMemberId,
  onOpenReference,
}: OtherTaxSocialBreakdownProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );

  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = headMember?.id ?? eligibleMembers[0]?.id ?? '';

  const [activeMemberId, setActiveMemberId] = useState(
    initialMemberId ?? defaultActiveId,
  );
  const [activeTabId, setActiveTabId] = useState<string>(
    OTHER_TAB_IDS.incomeTax,
  );

  useEffect(() => {
    if (!initialMemberId) return;
    if (!eligibleMembers.some((member) => member.id === initialMemberId)) {
      return;
    }
    setActiveMemberId(initialMemberId);
    setActiveTabId(OTHER_TAB_IDS.incomeTax);
  }, [calendarYear, initialMemberId, eligibleMembers]);

  const resolvedActiveId = eligibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : defaultActiveId;

  const activeMember = useMemo(
    () => eligibleMembers.find((member) => member.id === resolvedActiveId),
    [eligibleMembers, resolvedActiveId],
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
    for (const member of eligibleMembers) {
      counts[member.id] = incomeByMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [eligibleMembers, incomeByMember]);

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
        members={eligibleMembers}
        activeMemberId={resolvedActiveId}
        entryCounts={entryCounts}
        referenceDate={referenceDate}
        onSelect={setActiveMemberId}
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
