import { formatReferenceYearLabel } from '../../lib/birthDate';
import { hasPreKindergartenChild } from '../../lib/educationCostContext';
import {
  getPriorYearIncomeForMember,
} from '../../lib/priorYearIncomeDefaults';
import { INCOME_CATEGORY_LABELS } from '../../lib/incomeLabels';
import type { FamilyMember } from '../../types/family';
import type {
  IncomeByMember,
  IncomeCategory,
  PriorYearIncomeByMember,
  PriorYearIncomeForNursery,
} from '../../types/income';

const PRIOR_YEAR_CATEGORIES: IncomeCategory[] = [
  'employee',
  'civil_servant',
  'part_time',
  'self_employed',
];

interface PriorYearIncomeSectionProps {
  member: FamilyMember;
  members: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  onChange: (priorYearIncomeByMember: PriorYearIncomeByMember) => void;
}

export function PriorYearIncomeSection({
  member,
  members,
  incomeByMember,
  priorYearIncomeByMember,
  referenceDate,
  onChange,
}: PriorYearIncomeSectionProps) {
  if (member.role !== 'head' && member.role !== 'spouse') {
    return null;
  }

  if (!hasPreKindergartenChild(members)) {
    return null;
  }

  const priorYear = getPriorYearIncomeForMember(
    member,
    priorYearIncomeByMember,
    incomeByMember,
    referenceDate,
  );

  const currentYearLabel = formatReferenceYearLabel(referenceDate);

  const persist = (updated: PriorYearIncomeForNursery) => {
    onChange({
      ...priorYearIncomeByMember,
      [member.id]: updated,
    });
  };

  return (
    <section className="prior-year-income-card">
      <div className="prior-year-income-header">
        <h3 className="prior-year-income-title">
          保育料参考値用：前年度の収入
        </h3>
        <p className="prior-year-income-description">
          Q2 教育費の保育園「参考」ボタンでは、前年度の市民税所得割額を使います。
          {currentYearLabel}の収入と変わらない場合は、今年度の収入を前年度として読み替えて計算します。
        </p>
      </div>

      <label className="prior-year-income-toggle">
        <input
          type="checkbox"
          checked={priorYear.differsFromCurrentYear}
          onChange={(e) =>
            persist({
              ...priorYear,
              differsFromCurrentYear: e.target.checked,
            })
          }
        />
        <span>
          前年度収入は、今年度（{currentYearLabel}）と異なる
        </span>
      </label>

      {!priorYear.differsFromCurrentYear ? (
        <p className="prior-year-income-note">
          今年度の収入を前年度として使用します。転職・産休などで前年度の収入が異なる場合は、上のチェックをオンにしてください。
        </p>
      ) : (
        <div className="prior-year-income-fields">
          <div className="prior-year-income-field">
            <label className="prior-year-income-label">収入区分</label>
            <select
              className="select-input"
              value={priorYear.category}
              onChange={(e) =>
                persist({
                  ...priorYear,
                  category: e.target.value as IncomeCategory,
                })
              }
            >
              {PRIOR_YEAR_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {INCOME_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>

          <div className="prior-year-income-field">
            <label className="prior-year-income-label">月額（概算）</label>
            <div className="amount-inline">
              <input
                type="number"
                className="amount-input"
                value={priorYear.monthlyAmountMan}
                min={0}
                step={0.1}
                onChange={(e) =>
                  persist({
                    ...priorYear,
                    monthlyAmountMan: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <span className="amount-unit">万円</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
