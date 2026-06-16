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
  onChange: (entries: EducationExpenseEntry[]) => void;
}

export function EducationExpenseTable({
  entries,
  member,
  headMember,
  familyMembers,
  incomeByMember,
  priorYearIncomeByMember,
  taxSocialState,
  referenceDate,
  onChange,
}: EducationExpenseTableProps) {
  const updateEntry = (entryId: string, updated: EducationExpenseEntry) => {
    onChange(entries.map((entry) => (entry.id === entryId ? updated : entry)));
  };

  const removeEntry = (entryId: string) => {
    onChange(entries.filter((entry) => entry.id !== entryId));
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
            entries.map((entry) => (
              <EducationExpenseRow
                key={entry.id}
                entry={entry}
                member={member}
                headMember={headMember}
                familyMembers={familyMembers}
                incomeByMember={incomeByMember}
                priorYearIncomeByMember={priorYearIncomeByMember}
                taxSocialState={taxSocialState}
                referenceDate={referenceDate}
                canRemove={
                  member.role !== 'child' || entries.length > 1
                }
                onChange={(updated) => updateEntry(entry.id, updated)}
                onRemove={() => removeEntry(entry.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
