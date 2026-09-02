import { resolveMemberAge } from '../../lib/familyDefaults';
import {
  createFollowUpResidencePeriod,
  createResidencePeriod,
} from '../../lib/taxSocialDefaults';
import type { FamilyMember } from '../../types/family';
import type { TaxSocialState } from '../../types/taxSocial';
import { ResidenceCard } from '../taxSocial/ResidenceCard';

interface FamilyResidenceSectionProps {
  headMember: FamilyMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
  onChange: (state: TaxSocialState) => void;
}

export function FamilyResidenceSection({
  headMember,
  taxSocialState,
  referenceDate,
  onChange,
}: FamilyResidenceSectionProps) {
  const referenceMonth = referenceDate.getMonth() + 1;
  const { residencePeriods } = taxSocialState;

  const updateResidencePeriods = (
    periods: TaxSocialState['residencePeriods'],
  ) => {
    onChange({ ...taxSocialState, residencePeriods: periods });
  };

  const addResidencePeriod = () => {
    const last = residencePeriods[residencePeriods.length - 1];
    const headAge = resolveMemberAge(headMember);
    const nextPeriod =
      last != null
        ? createFollowUpResidencePeriod(last, headAge, referenceMonth)
        : createResidencePeriod(headAge, referenceMonth);

    updateResidencePeriods([...residencePeriods, nextPeriod]);
  };

  return (
    <section className="family-residence-section">
      <ResidenceCard
        periods={residencePeriods}
        headMember={headMember}
        referenceDate={referenceDate}
        onChange={updateResidencePeriods}
      />

      <button
        type="button"
        className="residence-add-btn"
        onClick={addResidencePeriod}
      >
        <span className="residence-add-icon" aria-hidden>
          ⊕
        </span>
        追加
      </button>
    </section>
  );
}
