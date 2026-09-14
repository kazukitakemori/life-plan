import { useEffect, useMemo, useState } from 'react';
import {
  SCHOOL_CATEGORY_LABELS,
  SCHOOL_TYPE_LABELS,
  resolveSchoolType,
} from '../../lib/educationLabels';
import type { FamilyMember } from '../../types/family';
import type { EducationExpenseEntry } from '../../types/education';
import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';
import type { TaxSocialState } from '../../types/taxSocial';
import { EducationExpenseRow } from './EducationExpenseRow';

interface EducationExpenseTableProps {
  entries: EducationExpenseEntry[];
  member: FamilyMember;
  headMember: FamilyMember;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
  autoExpandEntryId?: string | null;
  onChange: (entries: EducationExpenseEntry[]) => void;
}

const YEN_FORMATTER = new Intl.NumberFormat('ja-JP');

export function EducationExpenseTable({
  entries,
  member,
  headMember,
  familyMembers,
  incomeByMember,
  priorYearIncomeByMember,
  taxSocialState,
  referenceDate,
  autoExpandEntryId,
  onChange,
}: EducationExpenseTableProps) {
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!autoExpandEntryId) return;
    setExpandedEntryIds((current) => {
      const next = new Set(current);
      next.add(autoExpandEntryId);
      return next;
    });
  }, [autoExpandEntryId]);

  const entryIds = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);

  useEffect(() => {
    setExpandedEntryIds((current) => {
      const next = new Set(
        [...current].filter((entryId) => entryIds.has(entryId)),
      );
      if (next.size === current.size) return current;
      return next;
    });
  }, [entryIds]);

  const updateEntry = (entryId: string, updated: EducationExpenseEntry) => {
    onChange(entries.map((entry) => (entry.id === entryId ? updated : entry)));
  };

  const removeEntry = (entryId: string) => {
    onChange(entries.filter((entry) => entry.id !== entryId));
  };

  const toggleEntry = (entryId: string) => {
    setExpandedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  return (
    <div className="education-table-card">
      <div className="education-table">
        <div className="education-table-header">
          <div className="education-header-cell education-header-school">
            学校種別
          </div>
          <div className="education-header-cell education-header-period">
            在籍期間
          </div>
          <div className="education-header-cell education-header-fetch">
            費用取得
          </div>
          <div className="education-header-cell education-header-entrance">
            入学金（円）
          </div>
          <div className="education-header-cell education-header-tuition-group">
            授業料
          </div>
          <div className="education-header-cell education-header-other">
            その他費用
          </div>
          <div className="education-header-cell education-header-action" />
          <div className="education-header-cell education-header-sub-tuition-amount">
            年額（円）
          </div>
          <div className="education-header-cell education-header-sub-tuition-monthly">
            月額（円）
          </div>
        </div>

        <div className="education-table-body">
          {entries.length === 0 ? (
            <div className="education-empty">
              教育費が登録されていません。下のボタンから追加してください。
            </div>
          ) : (
            entries.map((entry) => {
              const expanded = expandedEntryIds.has(entry.id);
              const schoolType = resolveSchoolType(
                entry.schoolCategory,
                entry.schoolType,
              );
              const title = `${SCHOOL_CATEGORY_LABELS[entry.schoolCategory]}・${SCHOOL_TYPE_LABELS[schoolType]}`;
              const period = `${entry.startAge}歳${entry.startMonth}月〜${entry.endAge}歳${entry.endMonth}月`;
              const tuition =
                entry.tuitionAnnual > 0
                  ? `授業料 年額 ${YEN_FORMATTER.format(entry.tuitionAnnual)}円`
                  : '授業料 未設定';

              return (
                <div
                  key={entry.id}
                  className={`education-mobile-accordion-item${expanded ? ' is-expanded' : ''}`}
                >
                  <button
                    type="button"
                    className="education-mobile-summary"
                    aria-expanded={expanded}
                    onClick={() => toggleEntry(entry.id)}
                  >
                    <span className="education-mobile-summary-copy">
                      <span className="education-mobile-summary-title">{title}</span>
                      {entry.schoolName ? (
                        <span className="education-mobile-summary-school-name">
                          {entry.schoolName}
                        </span>
                      ) : null}
                      <span className="education-mobile-summary-meta">
                        {period} ・ {tuition}
                      </span>
                    </span>
                    <span className="education-mobile-summary-action">
                      <span>{expanded ? '閉じる' : '詳細を開く'}</span>
                      <span aria-hidden>{expanded ? '−' : '＋'}</span>
                    </span>
                  </button>

                  <EducationExpenseRow
                    entry={entry}
                    member={member}
                    headMember={headMember}
                    familyMembers={familyMembers}
                    incomeByMember={incomeByMember}
                    priorYearIncomeByMember={priorYearIncomeByMember}
                    taxSocialState={taxSocialState}
                    referenceDate={referenceDate}
                    canRemove={member.role !== 'child' || entries.length > 1}
                    onChange={(updated) => updateEntry(entry.id, updated)}
                    onRemove={() => removeEntry(entry.id)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
