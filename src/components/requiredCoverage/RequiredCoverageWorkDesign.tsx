import { useState } from 'react';

import type { CashFlowInput } from '../../lib/cashFlow';
import {
  calcAnnualAmountMan,
  roundAmountMan,
} from '../../lib/incomeAmount';
import {
  ADD_INCOME_OPTIONS,
  INCOME_CATEGORY_LABELS,
  getIncomeEntryDisplayLabel,
  incomeCategoryShowsBonus,
  type AddIncomeOption,
} from '../../lib/incomeLabels';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import type { RequiredCoverageResult } from '../../lib/requiredCoverage';
import {
  canAddCoverageSideBusiness,
  copyCurrentIncomeAsWorkDraft,
  createCoverageWorkIncomeEntry,
  getCoverageMemberWorkDesign,
  listCoverageWorkMembers,
  patchCoverageMemberWorkDesign,
} from '../../lib/requiredCoverageIncome';
import type { FamilyMember } from '../../types/family';
import type { IncomeBonus, IncomeEntry, IncomePeriod } from '../../types/income';
import type {
  RequiredCoverageState,
  RequiredCoverageSubject,
  RequiredCoverageWorkMode,
} from '../../types/requiredCoverage';

interface RequiredCoverageWorkDesignProps {
  cashFlowInput: CashFlowInput;
  result: RequiredCoverageResult;
  state: RequiredCoverageState;
  subject: RequiredCoverageSubject;
  onChange: (state: RequiredCoverageState) => void;
  /** 簡易設計では働き方を「今のまま」固定で表示のみ */
  readonly?: boolean;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const AGES = Array.from({ length: 101 }, (_, index) => index);

const WORK_MODE_OPTIONS: {
  mode: RequiredCoverageWorkMode;
  label: string;
  description: string;
}[] = [
  {
    mode: 'keep',
    label: '今の働き方のまま',
    description: 'Q7の収入を、保障期間中も続けます。',
  },
  {
    mode: 'stop',
    label: '働かない',
    description: '給与・事業などの収入は0にします。',
  },
  {
    mode: 'redesign',
    label: '働き方を変える',
    description: 'パートから正社員など、万一後の仕事を別に入力します。',
  },
];

const WORK_DESIGN_HELP_ITEMS: Record<'detail' | 'simple', string[]> = {
  simple: [
    '亡くなった人の給与・事業などは含めません。',
    '残る世帯主・配偶者の就労収入は、Q7の働き方のまま試算します（簡易設計では変更できません）。',
    '遺族年金・老齢年金・児童手当などは詳細設計と同じルールで自動計算します。',
  ],
  detail: [
    '亡くなった人の給与・事業などは含めません。',
    '残る世帯主・配偶者は働き方を差し替えできます。',
    '差し引く収入は額面で集計し、税・社会保険料は支出側に載せます（キャッシュフロー表と同じ考え方です）。',
    '遺族基礎年金・遺族厚生年金は非課税としてそのまま足します（国税庁タックスアンサー No.1605）。',
    '遺族基礎年金は対象の子がいる間です（18歳到達年度末まで、障害がある子は20歳未満）。',
    '残る世帯主・配偶者が老齢基礎・老齢厚生年金を受け取り始めると、Q8の見込み額を額面として足します。',
    '遺族厚生年金は、亡くなった人の老齢厚生（報酬比例）の4分の3を自動計算します。',
    '在職中の死亡で加入月数が300月未満なら300月とみなします。',
    '残る配偶者が65歳以上で自身の老齢厚生を受けるときは、自身の老齢厚生を全額優先し、遺族厚生は差額のみです。',
    '子のない30歳未満の妻は5年、子のない55歳未満の夫は対象外です。',
    '該当する妻には40歳から65歳になるまでの中高齢寡婦加算を足します（これも非課税）。',
  ],
};

function WorkDesignHelpModal({
  open,
  readonly,
  onClose,
}: {
  open: boolean;
  readonly: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const items = WORK_DESIGN_HELP_ITEMS[readonly ? 'simple' : 'detail'];

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal required-coverage-work-help-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="required-coverage-work-help-title"
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
        <h3
          id="required-coverage-work-help-title"
          className="education-ref-modal-title"
        >
          万一後の収入の計算ルール
        </h3>
        <ul className="required-coverage-help-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function formatMan(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return Number.isInteger(value)
    ? value.toLocaleString('ja-JP')
    : value.toLocaleString('ja-JP', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      });
}

function withPeriodAnnual(period: IncomePeriod): IncomePeriod {
  return {
    ...period,
    annualAmountMan: calcAnnualAmountMan(
      period.monthlyAmountMan,
      period.bonuses,
    ),
  };
}

function WorkPeriodFields({
  period,
  showBonus,
  onChange,
}: {
  period: IncomePeriod;
  showBonus: boolean;
  onChange: (period: IncomePeriod) => void;
}) {
  const patch = (partial: Partial<IncomePeriod>) => {
    onChange(withPeriodAnnual({ ...period, ...partial }));
  };

  const updateBonus = (bonusId: string, partial: Partial<IncomeBonus>) => {
    patch({
      bonuses: period.bonuses.map((bonus) =>
        bonus.id === bonusId ? { ...bonus, ...partial } : bonus,
      ),
    });
  };

  return (
    <div className="required-coverage-work-period">
      <div className="required-coverage-work-period-row">
        <label className="required-coverage-work-field">
          <span>開始</span>
          <span className="required-coverage-work-age-month">
            <select
              className="select-input select-input--compact"
              value={period.startAge}
              aria-label="開始年齢"
              onChange={(event) =>
                patch({ startAge: Number(event.target.value) })
              }
            >
              {AGES.map((age) => (
                <option key={age} value={age}>
                  {age}歳
                </option>
              ))}
            </select>
            <select
              className="select-input select-input--compact"
              value={period.startMonth}
              aria-label="開始月"
              onChange={(event) =>
                patch({ startMonth: Number(event.target.value) })
              }
            >
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {month}月
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="required-coverage-work-field">
          <span>終了</span>
          <span className="required-coverage-work-age-month">
            <select
              className="select-input select-input--compact"
              value={period.endAge}
              aria-label="終了年齢"
              onChange={(event) =>
                patch({ endAge: Number(event.target.value) })
              }
            >
              {AGES.map((age) => (
                <option key={age} value={age}>
                  {age}歳
                </option>
              ))}
            </select>
            <select
              className="select-input select-input--compact"
              value={period.endMonth}
              aria-label="終了月"
              onChange={(event) =>
                patch({ endMonth: Number(event.target.value) })
              }
            >
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {month}月
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="required-coverage-work-field">
          <span>月額</span>
          <span className="amount-inline">
            <input
              type="number"
              className="amount-input"
              min={0}
              step={0.1}
              value={period.monthlyAmountMan}
              onChange={(event) =>
                patch({
                  monthlyAmountMan: roundAmountMan(
                    Number(event.target.value) || 0,
                  ),
                })
              }
            />
            <span className="amount-unit">万円</span>
          </span>
        </label>
        {showBonus ? (
          <div className="required-coverage-work-bonus-stack">
            <span>賞与</span>
            {period.bonuses.map((bonus) => (
              <div
                key={bonus.id}
                className="required-coverage-work-bonus-controls"
              >
                <select
                  className="select-input select-input--compact"
                  value={bonus.paymentMonth}
                  aria-label="賞与の支給月"
                  onChange={(event) =>
                    updateBonus(bonus.id, {
                      paymentMonth: Number(event.target.value),
                    })
                  }
                >
                  {MONTHS.map((month) => (
                    <option key={month} value={month}>
                      {month}月
                    </option>
                  ))}
                </select>
                <span className="amount-inline">
                  <input
                    type="number"
                    className="amount-input"
                    min={0}
                    step={0.1}
                    value={bonus.amountMan}
                    aria-label="賞与額"
                    onChange={(event) =>
                      updateBonus(bonus.id, {
                        amountMan: roundAmountMan(
                          Number(event.target.value) || 0,
                        ),
                      })
                    }
                  />
                  <span className="amount-unit">万円</span>
                </span>
                <button
                  type="button"
                  className="required-coverage-work-text-btn"
                  onClick={() =>
                    patch({
                      bonuses: period.bonuses.filter(
                        (item) => item.id !== bonus.id,
                      ),
                    })
                  }
                >
                  削除
                </button>
              </div>
            ))}
            <button
              type="button"
              className="required-coverage-work-add-bonus-btn"
              onClick={() =>
                patch({
                  bonuses: [
                    ...period.bonuses,
                    {
                      id: crypto.randomUUID(),
                      amountMan: 0,
                      paymentMonth: period.bonuses.length === 0 ? 6 : 12,
                    },
                  ],
                })
              }
            >
              賞与を追加
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WorkEntryCard({
  entry,
  onChange,
  onRemove,
}: {
  entry: IncomeEntry;
  onChange: (entry: IncomeEntry) => void;
  onRemove: () => void;
}) {
  const showBonus = incomeCategoryShowsBonus(entry.category);
  return (
    <article className="required-coverage-work-entry">
      <div className="required-coverage-work-entry-head">
        <h4 className="required-coverage-work-entry-title">
          {getIncomeEntryDisplayLabel(entry)}
        </h4>
        <button
          type="button"
          className="required-coverage-work-text-btn"
          onClick={onRemove}
        >
          削除
        </button>
      </div>
      {entry.periods.map((period) => (
        <WorkPeriodFields
          key={period.id}
          period={period}
          showBonus={showBonus}
          onChange={(nextPeriod) =>
            onChange({
              ...entry,
              periods: entry.periods.map((item) =>
                item.id === period.id ? nextPeriod : item,
              ),
            })
          }
        />
      ))}
    </article>
  );
}

function MemberWorkSummary({
  member,
  result,
}: {
  member: FamilyMember;
  result: RequiredCoverageResult;
}) {
  const memberIncome = result.income.byMember.find(
    (row) => row.memberId === member.id,
  );
  const keepOption = WORK_MODE_OPTIONS.find((option) => option.mode === 'keep');

  return (
    <div className="required-coverage-work-member">
      <div className="required-coverage-work-member-head">
        <h4 className="required-coverage-work-member-name">
          {getMemberTabLabel(member)}
        </h4>
        <span className="required-coverage-work-member-total">
          期間累計 {formatMan(memberIncome?.amount ?? 0)}万円
        </span>
      </div>
      <p className="required-coverage-work-mode-fixed">
        働き方：{keepOption?.label ?? '今の働き方のまま'}
        <span className="required-coverage-work-mode-fixed-desc">
          {keepOption?.description}
        </span>
      </p>
    </div>
  );
}

function MemberWorkPanel({
  member,
  cashFlowInput,
  result,
  state,
  subject,
  onChange,
}: {
  member: FamilyMember;
  cashFlowInput: CashFlowInput;
  result: RequiredCoverageResult;
  state: RequiredCoverageState;
  subject: RequiredCoverageSubject;
  onChange: (state: RequiredCoverageState) => void;
}) {
  const design = getCoverageMemberWorkDesign(state, subject, member.id);
  const memberIncome = result.income.byMember.find(
    (row) => row.memberId === member.id,
  );
  const currentEntries = cashFlowInput.incomeByMember[member.id] ?? [];

  const setDesign = (
    patch: Parameters<typeof patchCoverageMemberWorkDesign>[3],
  ) => {
    onChange(patchCoverageMemberWorkDesign(state, subject, member.id, patch));
  };

  const handleAdd = (option: AddIncomeOption) => {
    if (
      option.variant === 'side_business' &&
      !canAddCoverageSideBusiness(design.entries)
    ) {
      return;
    }
    setDesign({
      mode: 'redesign',
      entries: [
        ...design.entries,
        createCoverageWorkIncomeEntry(
          member,
          option,
          result.coverageStart,
          cashFlowInput.referenceDate,
        ),
      ],
    });
  };

  return (
    <div className="required-coverage-work-member">
      <div className="required-coverage-work-member-head">
        <h4 className="required-coverage-work-member-name">
          {getMemberTabLabel(member)}
        </h4>
        <span className="required-coverage-work-member-total">
          期間累計 {formatMan(memberIncome?.amount ?? 0)}万円
        </span>
      </div>
      <div
        className="required-coverage-work-modes"
        role="radiogroup"
        aria-label={`${getMemberTabLabel(member)}の万一後の働き方`}
      >
        {WORK_MODE_OPTIONS.map((option) => (
          <label
            key={option.mode}
            className={
              design.mode === option.mode
                ? 'required-coverage-work-mode is-active'
                : 'required-coverage-work-mode'
            }
          >
            <input
              type="radio"
              name={`coverage-work-${subject}-${member.id}`}
              checked={design.mode === option.mode}
              onChange={() => setDesign({ mode: option.mode })}
            />
            <span className="required-coverage-work-mode-copy">
              <span className="required-coverage-work-mode-label">
                {option.label}
              </span>
              <span className="required-coverage-work-mode-desc">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      {design.mode === 'redesign' ? (
        <div className="required-coverage-work-redesign">
          {design.entries.length === 0 && currentEntries.length > 0 ? (
            <button
              type="button"
              className="required-coverage-work-text-btn"
              onClick={() =>
                setDesign({
                  entries: copyCurrentIncomeAsWorkDraft(
                    currentEntries,
                    member,
                    cashFlowInput.referenceDate,
                    result.coverageStart,
                  ),
                })
              }
            >
              今の収入を下書きとしてコピー
            </button>
          ) : null}
          {design.entries.map((entry) => (
            <WorkEntryCard
              key={entry.id}
              entry={entry}
              onChange={(next) =>
                setDesign({
                  entries: design.entries.map((item) =>
                    item.id === entry.id ? next : item,
                  ),
                })
              }
              onRemove={() =>
                setDesign({
                  entries: design.entries.filter((item) => item.id !== entry.id),
                })
              }
            />
          ))}
          <div className="required-coverage-work-add">
            <p className="required-coverage-work-add-label">働き方を追加</p>
            <div className="required-coverage-work-add-grid">
              {ADD_INCOME_OPTIONS.map((option) => {
                const isSideBusiness = option.variant === 'side_business';
                const disabled =
                  isSideBusiness && !canAddCoverageSideBusiness(design.entries);
                return (
                  <button
                    key={`${option.category}-${option.variant ?? 'default'}`}
                    type="button"
                    className="required-coverage-work-add-btn"
                    disabled={disabled}
                    title={
                      disabled
                        ? '先に本業（給与）を追加してください'
                        : option.description
                    }
                    onClick={() => handleAdd(option)}
                  >
                    {option.label ?? INCOME_CATEGORY_LABELS[option.category]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RequiredCoverageWorkDesign({
  cashFlowInput,
  result,
  state,
  subject,
  onChange,
  readonly = false,
}: RequiredCoverageWorkDesignProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const members = listCoverageWorkMembers(
    cashFlowInput.familyMembers,
    subject,
  );

  return (
    <section
      className="required-coverage-card"
      aria-labelledby="required-coverage-work-heading"
    >
      <div className="required-coverage-card-title-row">
        <h3 id="required-coverage-work-heading" className="required-coverage-card-title">
          万一後の収入
        </h3>
        <button
          type="button"
          className="required-coverage-help-icon"
          aria-label="万一後の収入の計算ルール"
          aria-haspopup="dialog"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen(true)}
        >
          ?
        </button>
      </div>
      {members.length === 0 ? (
        <p className="required-coverage-horizon-help">
          働き方を変えられる世帯主・配偶者がいません。
        </p>
      ) : readonly ? (
        members.map((member) => (
          <MemberWorkSummary key={member.id} member={member} result={result} />
        ))
      ) : (
        members.map((member) => (
          <MemberWorkPanel
            key={member.id}
            member={member}
            cashFlowInput={cashFlowInput}
            result={result}
            state={state}
            subject={subject}
            onChange={onChange}
          />
        ))
      )}
      <WorkDesignHelpModal
        open={helpOpen}
        readonly={readonly}
        onClose={() => setHelpOpen(false)}
      />
    </section>
  );
}
