import { formatBirthShort, getMemberTabLabel } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import { MemberAvatar } from '../family/MemberAvatar';

interface MemberLifeEventTabsProps {
  members: FamilyMember[];
  activeMemberId: string;
  entryCounts: Record<string, number>;
  referenceDate: Date;
  onSelect: (memberId: string) => void;
}

export function MemberLifeEventTabs({
  members,
  activeMemberId,
  entryCounts,
  referenceDate,
  onSelect,
}: MemberLifeEventTabsProps) {
  return (
    <div className="member-tabs">
      {members.map((member) => {
        const active = member.id === activeMemberId;
        const count = entryCounts[member.id] ?? 0;

        return (
          <button
            key={member.id}
            type="button"
            className={`member-tab ${active ? 'active' : ''}`}
            onClick={() => onSelect(member.id)}
          >
            <MemberAvatar role={member.role} />
            <div className="member-tab-info">
              <span className="member-tab-name">
                {getMemberTabLabel(member)}
                {count > 0 && (
                  <span className="member-tab-badge">（{count}件）</span>
                )}
              </span>
              <span className="member-tab-birth">
                {formatBirthShort(member, referenceDate)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
