import { useState } from 'react';
import {
  getPriorYearIncomeForMember,
} from '../../lib/priorYearIncomeDefaults';
import { INCOME_CATEGORY_LABELS } from '../../lib/incomeLabels';
import type { FamilyMember } from '../../types/family';
import type {
  IncomeByMember,
  IncomeCategory,
  PriorYearIncomeByMember,
  PriorYearIncomeOverride,
} from '../../types/income';
import { FormSelect } from '../ui';

const PRIOR_YEAR_CATEGORIES: IncomeCategory[] = [
  'employee',
  'civil_servant',
  'part_time',
  'self_employed',
];

interface PriorYearIncomeSectionProps {
  member: FamilyMember;
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  onChange: (priorYearIncomeByMember: PriorYearIncomeByMember) => void;
}

export function PriorYearIncomeSection({
  member,
  incomeByMember,
  priorYearIncomeByMember,
  referenceDate,
  onChange,
}: PriorYearIncomeSectionProps) {
  const priorYear = getPriorYearIncomeForMember(
    member,
    priorYearIncomeByMember,
    incomeByMember,
    referenceDate,
  );

  const [open, setOpen] = useState(priorYear.differsFromCurrentYear);

  if (member.role !== 'head' && member.role !== 'spouse') {
    return null;
  }

  const currentYearLabel = `${referenceDate.getFullYear()}年`;
  const priorYearLabel = `${referenceDate.getFullYear() - 1}年`;
  const persist = (updated: PriorYearIncomeOverride) => {
    onChange({
      ...priorYearIncomeByMember,
      [member.id]: updated,
    });
  };

  return (
    <div className="retirement-timing-guide prior-year-income-guide">
      <button
        type="button"
        className="retirement-timing-guide-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>前年度の収入</span>
        <span className="retirement-timing-guide-chevron" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div className="retirement-timing-guide-body">
          <label className="prior-year-income-check">
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
              前年度（{priorYearLabel}）の収入は、今年度（{currentYearLabel}
              ）と異なる
            </span>
          </label>

          {!priorYear.differsFromCurrentYear ? (
            <p className="retirement-timing-guide-lead">
              転職・産休などで前年度の収入が異なる場合は、上のチェックをオンにしてください。
            </p>
          ) : (
            <div className="prior-year-income-fields">
              <div className="prior-year-income-field">
                <label className="prior-year-income-label">収入区分</label>
                <FormSelect
                  value={priorYear.category}
                  controlWidth="medium"
                  onValueChange={(raw) =>
                    persist({
                      ...priorYear,
                      category: raw as IncomeCategory,
                    })
                  }
                  options={PRIOR_YEAR_CATEGORIES.map((category) => ({
                    value: category,
                    label: INCOME_CATEGORY_LABELS[category],
                  }))}
                />
              </div>

              <div className="prior-year-income-field">
                <label className="prior-year-income-label">月額（概算）</label>
                <div className="ui-amount">
                  <input
                    type="number"
                    className="ui-input ui-input--amount"
                    value={priorYear.monthlyAmountMan}
                    min={0}
                    step={0.1}
                    onChange={(e) =>
                      persist({
                        ...priorYear,
                        monthlyAmountMan: Math.max(
                          0,
                          Number(e.target.value) || 0,
                        ),
                      })
                    }
                  />
                  <span className="ui-amount-unit">万円</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
