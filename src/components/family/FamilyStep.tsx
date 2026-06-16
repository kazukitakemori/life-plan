import { formatReferenceDate } from '../../lib/birthDate';
import { createFamilyMember } from '../../lib/familyDefaults';
import type { FamilyMember, FamilyMemberRole } from '../../types/family';
import type { TaxSocialState } from '../../types/taxSocial';
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
    <div className="step-page">
      <div className="step-header">
        <h2 className="step-title">
          Q1. ご家族情報
          <span className="step-subtitle">
            （{formatReferenceDate(referenceDate)}）
          </span>
        </h2>
        <div className="step-actions">
          <button type="button" className="step-action-btn" disabled>
            解説
          </button>
          <button type="button" className="step-action-btn" disabled>
            ガイド
          </button>
          <button type="button" className="step-action-btn" disabled>
            メモ
          </button>
        </div>
      </div>

      <div className="family-table">
        <div className="family-table-header">
          <div className="family-table-header-cell" />
          <div className="family-table-header-cell">プロフィール</div>
          <div className="family-table-header-cell">趣味/関心</div>
          <div className="family-table-header-cell">
            世帯主と生計を一にする期間
          </div>
          <div className="family-table-header-cell" />
        </div>

        <div className="family-table-body">
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
