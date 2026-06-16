import { useState } from 'react';
import { calcBirthYear, formatYearAtAgeLabel } from '../../lib/birthDate';
import {
  applyFetchedEducationCosts,
  fetchEducationCosts,
  isEducationCostFetchAvailable,
} from '../../lib/educationCostFetch';
import {
  createEducationOtherExpense,
  getEducationAgeOptions,
} from '../../lib/educationDefaults';
import {
  tuitionAnnualToMonthly,
  tuitionMonthlyToAnnual,
} from '../../lib/educationAmount';
import {
  getSchoolNamePlaceholder,
  getSchoolTypeOptions,
  resolveGraduateProgramType,
  resolveSchoolType,
  resolveUniversityHousingType,
  GRADUATE_PROGRAM_TYPE_OPTIONS,
  UNIVERSITY_HOUSING_TYPE_OPTIONS,
  SCHOOL_CATEGORY_OPTIONS,
} from '../../lib/educationLabels';
import {
  applyGraduateProgramTypeChange,
  applySchoolCategoryChange,
  applySchoolTypeChange,
  clampEnrollmentYear,
  getEducationPeriodAlerts,
} from '../../lib/educationPeriod';
import type { FamilyMember } from '../../types/family';
import type {
  EducationExpenseEntry,
  EducationReferenceDetail,
} from '../../types/education';
import { EducationReferenceDetailModal } from './EducationReferenceDetailModal';
import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';
import type { TaxSocialState } from '../../types/taxSocial';
import { EducationOtherExpenseItem } from './EducationOtherExpenseItem';
import { EducationYenInput } from './EducationYenInput';

interface EducationExpenseRowProps {
  entry: EducationExpenseEntry;
  member: FamilyMember;
  headMember: FamilyMember;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
  canRemove: boolean;
  onChange: (entry: EducationExpenseEntry) => void;
  onRemove: () => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function EducationExpenseRow({
  entry,
  member,
  headMember,
  familyMembers,
  incomeByMember,
  priorYearIncomeByMember,
  taxSocialState,
  referenceDate,
  canRemove,
  onChange,
  onRemove,
}: EducationExpenseRowProps) {
  const [referenceDetail, setReferenceDetail] =
    useState<EducationReferenceDetail | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageOptions = getEducationAgeOptions(member);
  const schoolTypeOptions = getSchoolTypeOptions(entry.schoolCategory);
  const periodAlerts = getEducationPeriodAlerts(entry);
  const canFetchCosts = isEducationCostFetchAvailable(entry);
  const tuitionMonthly = tuitionAnnualToMonthly(entry.tuitionAnnual);

  const handleFetchCosts = () => {
    const costs = fetchEducationCosts({
      entry,
      member,
      headMember,
      familyMembers,
      incomeByMember,
      priorYearIncomeByMember,
      taxSocialState,
      referenceDate,
    });
    setReferenceDetail(costs.referenceDetail);
    onChange(applyFetchedEducationCosts(entry, costs));
  };

  const setSchoolCategory = (schoolCategory: EducationExpenseEntry['schoolCategory']) => {
    const schoolType = resolveSchoolType(schoolCategory, entry.schoolType);
    setReferenceDetail(null);
    const next = applySchoolCategoryChange(entry, schoolCategory, schoolType);
    onChange({
      ...next,
      otherExpenses: clampOtherExpenses(next),
    });
  };

  const addOtherExpense = () => {
    updateEntry({
      otherExpenses: [
        ...entry.otherExpenses,
        createEducationOtherExpense({ enrollmentYear: 1 }),
      ],
    });
  };

  const clampOtherExpenses = (
    nextEntry: Pick<
      EducationExpenseEntry,
      'startAge' | 'startMonth' | 'endAge' | 'endMonth' | 'otherExpenses'
    >,
  ) =>
    nextEntry.otherExpenses.map((item) => ({
      ...item,
      enrollmentYear: clampEnrollmentYear(
        item.enrollmentYear,
        nextEntry.startAge,
        nextEntry.startMonth,
        nextEntry.endAge,
        nextEntry.endMonth,
      ),
    }));

  const updateEntry = (patch: Partial<EducationExpenseEntry>) => {
    const next = { ...entry, ...patch };
    if (
      patch.startAge !== undefined ||
      patch.startMonth !== undefined ||
      patch.endAge !== undefined ||
      patch.endMonth !== undefined
    ) {
      next.otherExpenses = clampOtherExpenses(next);
    }
    onChange(next);
  };

  const updateOtherExpense = (
    expenseId: string,
    updated: EducationExpenseEntry['otherExpenses'][number],
  ) => {
    updateEntry({
      otherExpenses: entry.otherExpenses.map((item) =>
        item.id === expenseId ? updated : item,
      ),
    });
  };

  const removeOtherExpense = (expenseId: string) => {
    updateEntry({
      otherExpenses: entry.otherExpenses.filter((item) => item.id !== expenseId),
    });
  };

  return (
    <div className="education-table-row">
      <div className="education-table-cell education-col-school">
        <div className="education-school-fields">
          <select
            className="select-input select-input--compact education-select"
            value={entry.schoolCategory}
            onChange={(e) =>
              setSchoolCategory(
                e.target.value as EducationExpenseEntry['schoolCategory'],
              )
            }
          >
            {SCHOOL_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="select-input select-input--compact education-select"
            value={resolveSchoolType(entry.schoolCategory, entry.schoolType)}
            onChange={(e) => {
              const next = applySchoolTypeChange(
                entry,
                e.target.value as EducationExpenseEntry['schoolType'],
              );
              onChange({
                ...next,
                otherExpenses: clampOtherExpenses(next),
              });
            }}
          >
            {schoolTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {entry.schoolCategory === 'university' && (
            <select
              className="select-input select-input--compact education-select"
              value={
                resolveUniversityHousingType(
                  entry.schoolCategory,
                  entry.universityHousingType,
                )!
              }
              onChange={(e) => {
                setReferenceDetail(null);
                updateEntry({
                  universityHousingType: e.target
                    .value as EducationExpenseEntry['universityHousingType'],
                });
              }}
            >
              {UNIVERSITY_HOUSING_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          {entry.schoolCategory === 'graduate' && (
            <>
              <select
                className="select-input select-input--compact education-select"
                value={
                  resolveGraduateProgramType(
                    entry.schoolCategory,
                    entry.graduateProgramType,
                  )!
                }
                onChange={(e) => {
                  setReferenceDetail(null);
                  const next = applyGraduateProgramTypeChange(
                    entry,
                    e.target.value as EducationExpenseEntry['graduateProgramType'],
                  );
                  onChange({
                    ...next,
                    otherExpenses: clampOtherExpenses(next),
                  });
                }}
              >
                {GRADUATE_PROGRAM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="select-input select-input--compact education-select"
                value={
                  resolveUniversityHousingType(
                    entry.schoolCategory,
                    entry.universityHousingType,
                  )!
                }
                onChange={(e) => {
                  setReferenceDetail(null);
                  updateEntry({
                    universityHousingType: e.target
                      .value as EducationExpenseEntry['universityHousingType'],
                  });
                }}
              >
                {UNIVERSITY_HOUSING_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <input
            type="text"
            className="education-text-input"
            placeholder={getSchoolNamePlaceholder(entry.schoolCategory)}
            value={entry.schoolName}
            onChange={(e) => updateEntry({ schoolName: e.target.value })}
          />
        </div>
      </div>

      <div className="education-table-cell education-col-period">
        <div className="education-period-block">
          <div className="education-period-side">
            <div className="education-period-fields">
              <select
                className="select-input select-input--compact education-select"
                value={entry.startAge}
                onChange={(e) =>
                  updateEntry({ startAge: Number(e.target.value) })
                }
              >
                {ageOptions.map((age) => (
                  <option key={age} value={age}>
                    {age}才
                  </option>
                ))}
              </select>
              <select
                className="select-input select-input--compact education-select"
                value={entry.startMonth}
                onChange={(e) =>
                  updateEntry({ startMonth: Number(e.target.value) })
                }
              >
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </div>
            <p className="period-start-label">
              {formatYearAtAgeLabel(
                entry.startAge,
                entry.startMonth,
                birthYear,
                member.birthMonth,
              )}
            </p>
          </div>

          <span className="education-period-arrow" aria-hidden>
            →
          </span>

          <div className="education-period-side">
            <div className="education-period-fields">
              <select
                className="select-input select-input--compact education-select"
                value={entry.endAge}
                onChange={(e) =>
                  updateEntry({ endAge: Number(e.target.value) })
                }
              >
                {ageOptions.map((age) => (
                  <option key={age} value={age}>
                    {age}才
                  </option>
                ))}
              </select>
              <select
                className="select-input select-input--compact education-select"
                value={entry.endMonth}
                onChange={(e) =>
                  updateEntry({ endMonth: Number(e.target.value) })
                }
              >
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </div>
            <p className="period-start-label">
              {formatYearAtAgeLabel(
                entry.endAge,
                entry.endMonth,
                birthYear,
                member.birthMonth,
              )}
            </p>
          </div>
        </div>
        {periodAlerts.length > 0 && (
          <ul className="education-period-alerts">
            {periodAlerts.map((alert) => (
              <li key={alert.id}>{alert.message}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="education-table-cell education-col-fetch">
        <div className="education-fetch-field">
          <button
            type="button"
            className="education-fetch-btn"
            disabled={!canFetchCosts}
            onClick={handleFetchCosts}
          >
            参考
          </button>
          {referenceDetail && (
            <button
              type="button"
              className="education-fetch-detail-link"
              onClick={() => setDetailModalOpen(true)}
            >
              詳細
            </button>
          )}
        </div>
      </div>

      <EducationReferenceDetailModal
        open={detailModalOpen}
        detail={referenceDetail}
        onClose={() => setDetailModalOpen(false)}
      />

      <div className="education-table-cell education-col-entrance">
        <div className="education-entrance-field">
          <EducationYenInput
            value={entry.entranceFee}
            onChange={(entranceFee) => updateEntry({ entranceFee })}
            compact
          />
          {referenceDetail &&
            (entry.schoolCategory === 'elementary' ||
              entry.schoolCategory === 'junior_high') &&
            entry.schoolType === 'private' && (
              <p className="education-entrance-note">
                ※学校により異なるため省略
              </p>
            )}
        </div>
      </div>

      <div className="education-table-cell education-col-tuition-amount">
        <EducationYenInput
          value={entry.tuitionAnnual}
          onChange={(tuitionAnnual) =>
            updateEntry({
              tuitionAnnual,
              tuitionPaymentCycle: 'monthly',
            })
          }
          compact
        />
      </div>

      <div className="education-table-cell education-col-tuition-monthly">
        <EducationYenInput
          value={tuitionMonthly}
          onChange={(monthly) =>
            updateEntry({
              tuitionAnnual: tuitionMonthlyToAnnual(monthly),
              tuitionPaymentCycle: 'monthly',
            })
          }
          compact
        />
      </div>

      <div className="education-table-cell education-col-other">
        <div className="education-other-list">
          {entry.otherExpenses.map((item) => (
            <EducationOtherExpenseItem
              key={item.id}
              item={item}
              entry={entry}
              onChange={(updated) => updateOtherExpense(item.id, updated)}
              onRemove={() => removeOtherExpense(item.id)}
            />
          ))}
          <button
            type="button"
            className="education-add-other-btn"
            onClick={addOtherExpense}
          >
            ＋ 項目を追加
          </button>
        </div>
      </div>

      <div className="education-table-cell education-col-action">
        <button
          type="button"
          className="education-row-remove"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="教育費を削除"
        >
          −
        </button>
      </div>
    </div>
  );
}
