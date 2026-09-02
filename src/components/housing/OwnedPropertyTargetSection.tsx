import { resolveMemberAge, resolveMemberBirthMonth } from '../../lib/familyDefaults';
import { getOwnershipStartCalendar } from '../../lib/housingLoanAmortization';
import {
  resolveHousingLoanDeductionHouseholdType,
} from '../../lib/housingLoanDeductionHousehold';
import {
  getNewConstructionHousingLoanDeductionTableRows,
  getUsedHousingLoanDeductionTableRows,
  HOUSING_LOAN_DEDUCTION_RATE_PCT,
} from '../../lib/housingLoanDeduction';
import {
  getOwnedPropertyTargetCategories,
  getOwnedPropertyTargetCategoryLabel,
  normalizeOwnedPropertyTargetSettings,
} from '../../lib/housingLabels';
import type { FamilyMember } from '../../types/family';
import type {
  HousingLoanDeductionCategory,
  OwnedProperty,
  OwnedPropertyLoanSettings,
} from '../../types/housing';

interface OwnedPropertyTargetSectionProps {
  property: OwnedProperty;
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  sectionNumber: number;
  onChange: (property: OwnedProperty) => void;
}

function formatLimitMan(value: number): string {
  if (value <= 0) return '対象外（0円）';
  return `${value.toLocaleString()}万円`;
}

export function OwnedPropertyTargetSection({
  property,
  member,
  members,
  referenceDate,
  sectionNumber,
  onChange,
}: OwnedPropertyTargetSectionProps) {
  if (property.type === 'land') {
    return null;
  }

  const referenceYear = referenceDate.getFullYear();
  const { isNewConstruction, deductionCategory } = normalizeOwnedPropertyTargetSettings(
    property.loan.isNewConstruction,
    property.loan.deductionCategory,
  );
  const categories = getOwnedPropertyTargetCategories(isNewConstruction);
  const occupancyYear = getOwnershipStartCalendar(
    property,
    resolveMemberAge(member),
    referenceYear,
    resolveMemberBirthMonth(member),
    referenceDate.getMonth() + 1,
  ).year;
  const householdType = resolveHousingLoanDeductionHouseholdType(
    members,
    referenceDate,
    occupancyYear,
  );

  const updateLoanTarget = (
    patch: Partial<
      Pick<OwnedPropertyLoanSettings, 'isNewConstruction' | 'deductionCategory'>
    >,
  ) => {
    const next = normalizeOwnedPropertyTargetSettings(
      patch.isNewConstruction ?? property.loan.isNewConstruction,
      patch.deductionCategory ?? property.loan.deductionCategory,
    );
    onChange({
      ...property,
      loan: {
        ...property.loan,
        ...next,
      },
    });
  };

  return (
    <section className="housing-owned-detail-section">
      <h4 className="housing-owned-detail-title">({sectionNumber}) 対象物件</h4>

      <div className="housing-owned-target">
        <div
          className="housing-owned-payment-options"
          role="radiogroup"
          aria-label="新築/中古"
        >
          <label className="housing-owned-payment-option">
            <input
              type="radio"
              name={`owned-target-condition-${property.id}`}
              checked={isNewConstruction}
              onChange={() => updateLoanTarget({ isNewConstruction: true })}
            />
            <span>新築</span>
          </label>
          <label className="housing-owned-payment-option">
            <input
              type="radio"
              name={`owned-target-condition-${property.id}`}
              checked={!isNewConstruction}
              onChange={() => updateLoanTarget({ isNewConstruction: false })}
            />
            <span>中古</span>
          </label>
        </div>

        <div className="housing-owned-target-select">
          <label
            className="housing-owned-target-select-label"
            htmlFor={`owned-target-category-${property.id}`}
          >
            住宅区分
          </label>
          <select
            id={`owned-target-category-${property.id}`}
            className="select-input select-input--compact housing-owned-target-category-select"
            value={deductionCategory}
            onChange={(e) =>
              updateLoanTarget({
                deductionCategory: e.target.value as HousingLoanDeductionCategory,
              })
            }
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {getOwnedPropertyTargetCategoryLabel(category, isNewConstruction)}
              </option>
            ))}
          </select>
        </div>

        <div className="housing-owned-deduction-table-wrap">
          <p className="housing-owned-deduction-table-caption">
            住宅ローン控除の目安（控除率 {HOUSING_LOAN_DEDUCTION_RATE_PCT}%・住民税分の上限 97,500円/年）
          </p>

          {isNewConstruction ? (
            <>
              <table className="education-ref-data-table housing-owned-deduction-table">
                <thead>
                  <tr>
                    <th scope="col">住宅の省エネ性能</th>
                    <th scope="col">子育て・若者夫婦世帯の控除限度額</th>
                    <th scope="col">その他の世帯の控除限度額</th>
                    <th scope="col">控除期間</th>
                  </tr>
                </thead>
                <tbody>
                  {getNewConstructionHousingLoanDeductionTableRows().map((row) => {
                    const isSelected = row.category === deductionCategory;

                    return (
                      <tr
                        key={row.category}
                        className={
                          isSelected
                            ? 'housing-owned-deduction-row--selected'
                            : undefined
                        }
                      >
                        <th scope="row">
                          {getOwnedPropertyTargetCategoryLabel(row.category, true)}
                        </th>
                        <td
                          className={
                            householdType === 'child_rearing_young_couple' &&
                            isSelected
                              ? 'housing-owned-deduction-cell--applicable'
                              : undefined
                          }
                        >
                          {formatLimitMan(row.childRearingYoungLimitMan)}
                        </td>
                        <td
                          className={
                            householdType === 'other' && isSelected
                              ? 'housing-owned-deduction-cell--applicable'
                              : undefined
                          }
                        >
                          {formatLimitMan(row.otherLimitMan)}
                        </td>
                        <td>
                          {row.childRearingYoungLimitMan <= 0 &&
                          row.otherLimitMan <= 0
                            ? 'ー'
                            : `${row.years}年`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <table className="education-ref-data-table housing-owned-deduction-table">
                <thead>
                  <tr>
                    <th scope="col">住宅の省エネ性能（中古）</th>
                    <th scope="col">全世帯共通の控除限度額</th>
                    <th scope="col">控除期間</th>
                  </tr>
                </thead>
                <tbody>
                  {getUsedHousingLoanDeductionTableRows().map((row) => {
                    const isSelected = row.category === deductionCategory;

                    return (
                      <tr
                        key={row.category}
                        className={
                          isSelected
                            ? 'housing-owned-deduction-row--selected'
                            : undefined
                        }
                      >
                        <th scope="row">
                          {getOwnedPropertyTargetCategoryLabel(row.category, false)}
                        </th>
                        <td>{formatLimitMan(row.limitMan)}</td>
                        <td>{row.years}年</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="housing-owned-deduction-table-note">
                ZEH水準や省エネ基準適合の中古は「省エネ・認定住宅など」を選んでください。
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
