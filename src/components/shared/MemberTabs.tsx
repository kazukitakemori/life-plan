import type { FamilyMember } from '../../types/family';
import {
  MemberPersonTab,
  MemberTabAddInBar,
} from './MemberTabExtrasControls';

export interface MemberTabsSummaryAction {
  active: boolean;
  onToggle: () => void;
  showLabel?: string;
  hideLabel?: string;
  ariaLabel?: string;
}

export interface MemberTabsProps {
  members: FamilyMember[];
  activeMemberId: string;
  entryCounts: Record<string, number>;
  referenceDate: Date;
  onSelect: (memberId: string) => void;
  addableMembers?: FamilyMember[];
  onAddMemberTab?: (memberId: string) => void;
  removableMemberIds?: string[];
  onRemoveMemberTab?: (memberId: string) => void;
  summaryAction?: MemberTabsSummaryAction;
}

export function MemberTabs({
  members,
  activeMemberId,
  entryCounts,
  referenceDate,
  onSelect,
  addableMembers = [],
  onAddMemberTab,
  removableMemberIds = [],
  onRemoveMemberTab,
  summaryAction,
}: MemberTabsProps) {
  const removable = new Set(removableMemberIds);
  const summaryLabel = summaryAction?.active
    ? (summaryAction.hideLabel ?? '個人ごとに表示')
    : (summaryAction?.showLabel ?? '全員まとめて表示');

  return (
    <div className="ui-member-tabs-block">
      {summaryAction ? (
        <div className="ui-member-tabs-actions">
          <button
            type="button"
            className={`ui-member-tabs-summary-toggle${summaryAction.active ? ' active' : ''}`}
            aria-pressed={summaryAction.active}
            aria-label={summaryAction.ariaLabel ?? summaryLabel}
            onClick={summaryAction.onToggle}
          >
            {summaryLabel}
          </button>
        </div>
      ) : null}

      <div className="ui-member-tabs-row">
        <div className="ui-member-tabs-list">
          {members.map((member) => (
            <MemberPersonTab
              key={member.id}
              member={member}
              active={member.id === activeMemberId}
              count={entryCounts[member.id] ?? 0}
              referenceDate={referenceDate}
              canRemove={removable.has(member.id)}
              onSelect={onSelect}
              onRemove={onRemoveMemberTab}
            />
          ))}
        </div>

        {onAddMemberTab ? (
          <MemberTabAddInBar
            addableMembers={addableMembers}
            onAdd={onAddMemberTab}
            referenceDate={referenceDate}
          />
        ) : null}
      </div>
    </div>
  );
}
