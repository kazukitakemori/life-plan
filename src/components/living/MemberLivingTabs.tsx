import { HOUSEHOLD_LIVING_KEY } from '../../types/living';
import type { FamilyMember } from '../../types/family';
import {
  MemberPersonTab,
  MemberTabAddInBar,
  MemberTabHouseholdGuidance,
} from '../shared/MemberTabExtrasControls';

interface MemberLivingTabsProps {
  members: FamilyMember[];
  activeTargetId: string;
  scheduleCounts: Record<string, number>;
  referenceDate: Date;
  onSelect: (targetId: string) => void;
  addableMembers?: FamilyMember[];
  onAddMemberTab?: (memberId: string) => void;
  removableMemberIds?: string[];
  onRemoveMemberTab?: (memberId: string) => void;
  showHouseholdGuidance?: boolean;
}

export function MemberLivingTabs({
  members,
  activeTargetId,
  scheduleCounts,
  referenceDate,
  onSelect,
  addableMembers = [],
  onAddMemberTab,
  removableMemberIds = [],
  onRemoveMemberTab,
  showHouseholdGuidance = false,
}: MemberLivingTabsProps) {
  const householdCount = scheduleCounts[HOUSEHOLD_LIVING_KEY] ?? 0;
  const removable = new Set(removableMemberIds);

  return (
    <div className="member-tabs-block">
      <div className="member-tabs-row">
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
            </div>
          </button>

          {members.map((member) => (
            <MemberPersonTab
              key={member.id}
              member={member}
              active={member.id === activeTargetId}
              count={scheduleCounts[member.id] ?? 0}
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

      {showHouseholdGuidance ? (
        <div className="member-tabs-meta">
          <MemberTabHouseholdGuidance />
        </div>
      ) : null}
    </div>
  );
}
