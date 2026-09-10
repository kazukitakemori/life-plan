import type { FamilyMember } from '../../types/family';
import {
  MemberPersonTab,
  MemberTabAddInBar,
} from '../shared/MemberTabExtrasControls';

interface MemberEducationTabsProps {
  members: FamilyMember[];
  activeMemberId: string;
  entryCounts: Record<string, number>;
  referenceDate: Date;
  onSelect: (memberId: string) => void;
  addableMembers?: FamilyMember[];
  onAddMemberTab?: (memberId: string) => void;
  removableMemberIds?: string[];
  onRemoveMemberTab?: (memberId: string) => void;
}

export function MemberEducationTabs({
  members,
  activeMemberId,
  entryCounts,
  referenceDate,
  onSelect,
  addableMembers = [],
  onAddMemberTab,
  removableMemberIds = [],
  onRemoveMemberTab,
}: MemberEducationTabsProps) {
  const removable = new Set(removableMemberIds);

  return (
    <div className="member-tabs-block">
      <div className="member-tabs-row">
        <div className="member-tabs">
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
