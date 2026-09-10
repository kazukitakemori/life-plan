import { formatReferenceSimSubtitle } from '../../lib/simulationTiming';
import { createFamilyMember } from '../../lib/familyDefaults';
import type { FamilyMember, FamilyMemberRole } from '../../types/family';
import type { TaxSocialState } from '../../types/taxSocial';
import { StepHeading } from '../ui';
import { AddFamilyBar } from './AddFamilyBar';
import { FamilyMemberRow } from './FamilyMemberRow';
import { FamilyResidenceSection } from './FamilyResidenceSection';

interface FamilyStepProps {
  members: FamilyMember[];
  referenceDate: Date;
  taxSocialState: TaxSocialState;
  onChange: (members: FamilyMember[]) => void;
  onTaxSocialChange: (state: TaxSocialState) => void;
}

export function FamilyStep({
  members,
  referenceDate,
  taxSocialState,
  onChange,
  onTaxSocialChange,
}: FamilyStepProps) {
  const hasSpouse = members.some((m) => m.role === 'spouse');
  const headMember = members.find((m) => m.role === 'head');

  const updateMember = (id: string, updated: FamilyMember) => {
    onChange(members.map((m) => (m.id === id ? updated : m)));
  };

  const removeMember = (id: string) => {
    onChange(members.filter((m) => m.id !== id));
  };

  const addMember = (role: FamilyMemberRole) => {
    if (role === 'spouse' && hasSpouse) return;
    onChange([...members, createFamilyMember(role)]);
  };

  return (
    <div className="step-page family-step">
      <StepHeading
        number={1}
        title="ご家族"
        className="family-step-header"
        lead={
          <>
            ライフプランの基準になる家族構成を登録します。
            <span className="family-step-lead-meta">
              {formatReferenceSimSubtitle(referenceDate)}
            </span>
          </>
        }
      />

      <div className="family-member-list">
        {members.map((member) => (
          <FamilyMemberRow
            key={member.id}
            member={member}
            referenceDate={referenceDate}
            onChange={(updated) => updateMember(member.id, updated)}
            onRemove={() => removeMember(member.id)}
            canRemove={member.role !== 'head'}
          />
        ))}
      </div>

      <AddFamilyBar onAdd={addMember} canAddSpouse={!hasSpouse} />

      {headMember && (
        <FamilyResidenceSection
          headMember={headMember}
          taxSocialState={taxSocialState}
          referenceDate={referenceDate}
          onChange={onTaxSocialChange}
        />
      )}
    </div>
  );
}
