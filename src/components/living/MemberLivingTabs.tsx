import { formatBirthShort, getMemberTabLabel } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import { HOUSEHOLD_LIVING_KEY } from '../../types/living';
import { MemberAvatar } from '../family/MemberAvatar';

interface MemberLivingTabsProps {
  members: FamilyMember[];
  headMember?: FamilyMember;
  activeTargetId: string;
  scheduleCounts: Record<string, number>;
  referenceDate: Date;
  onSelect: (targetId: string) => void;
}

export function MemberLivingTabs({
  members,
  headMember,
  activeTargetId,
  scheduleCounts,
  referenceDate,
  onSelect,
}: MemberLivingTabsProps) {
  const householdCount = scheduleCounts[HOUSEHOLD_LIVING_KEY] ?? 0;
  const householdBirth = headMember
    ? formatBirthShort(headMember, referenceDate)
    : '';

  return (
    <div className="member-tabs">
      <button
        type="button"
        className={`member-tab ${activeTargetId === HOUSEHOLD_LIVING_KEY ? 'active' : ''}`}
        onClick={() => onSelect(HOUSEHOLD_LIVING_KEY)}
      >
        <span className="member-avatar member-avatar--household">👨‍👩‍👧</span>
        <div className="member-tab-info">
          <span className="member-tab-name">
            ご家族
            {householdCount > 0 && (
              <span className="member-tab-badge">（{householdCount}件）</span>
            )}
          </span>
          <span className="member-tab-birth">{householdBirth}</span>
        </div>
      </button>

      {members.map((member) => {
        const active = member.id === activeTargetId;
        const count = scheduleCounts[member.id] ?? 0;

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
