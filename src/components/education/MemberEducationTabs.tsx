import { formatBirthShort, getMemberTabLabel } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import { MemberAvatar } from '../family/MemberAvatar';

export const EDUCATION_AGGREGATE_TAB_ID = '__education_aggregate__';

interface MemberEducationTabsProps {
  members: FamilyMember[];
  activeMemberId: string;
  entryCounts: Record<string, number>;
  totalEntryCount: number;
  referenceDate: Date;
  onSelect: (memberId: string) => void;
}

export function MemberEducationTabs({
  members,
  activeMemberId,
  entryCounts,
  totalEntryCount,
  referenceDate,
  onSelect,
}: MemberEducationTabsProps) {
  const isAggregateActive = activeMemberId === EDUCATION_AGGREGATE_TAB_ID;

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

      <button
        type="button"
        className={`member-tab member-tab--aggregate ${isAggregateActive ? 'active' : ''}`}
        onClick={() => onSelect(EDUCATION_AGGREGATE_TAB_ID)}
      >
        <div className="member-avatar member-avatar--aggregate" aria-hidden>
          ∑
        </div>
        <div className="member-tab-info">
          <span className="member-tab-name">
            合算
            {totalEntryCount > 0 && (
              <span className="member-tab-badge">（{totalEntryCount}件）</span>
            )}
          </span>
          <span className="member-tab-birth">世帯全体</span>
        </div>
      </button>
    </div>
  );
}
