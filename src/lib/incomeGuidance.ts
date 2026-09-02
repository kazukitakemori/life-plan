import {
  isBusinessIncomeStream,
  isSalaryLikeCategory,
} from './incomeBreakdown';
import type { IncomeEntry } from '../types/income';

/** 給与（会社員・公務員・パート等）の収入ブロックがあるか */
export function memberHasSalaryLikeIncomeEntry(
  entries: IncomeEntry[],
): boolean {
  return entries.some((entry) => isSalaryLikeCategory(entry.category));
}

/** 副業・事業収入カードを追加できるか（本業の給与が先にあること） */
export function canAddSideBusinessIncome(entries: IncomeEntry[]): boolean {
  return memberHasSalaryLikeIncomeEntry(entries);
}

/** 事業収入（自営業・副業）の収入ブロックがあるか */
export function memberHasBusinessIncomeEntry(entries: IncomeEntry[]): boolean {
  return entries.some(
    (entry) =>
      entry.category === 'self_employed' &&
      entry.periods.some((period) =>
        isBusinessIncomeStream(period.streamType),
      ),
  );
}

const SALARY_WITH_SIDE_BUSINESS_NOTE =
  '副業・事業収入がある期間は、所得税・住民税の試算で事業所得が給与に加算されます。社会保険料は本業の給与から天引きされる想定です。';

const SIDE_BUSINESS_WITH_SALARY_NOTE =
  '社会保険は本業の給与側（厚生年金・健康保険・雇用保険）のまま試算します。この収入は税金だけ加算されます。';

const SIDE_BUSINESS_STANDALONE_HINT =
  '本業（会社員・公務員・パートなど）の給与と組み合わせてください。社保は給与側、税だけこの事業収入が加算されます。';

/**
 * 収入ブロックに表示する注記（副業×給与の試算ルール）。
 * 本業のみの自営業（国保加入想定）では注記を出さない。
 */
export function getIncomeEntryGuidanceNote(
  entry: IncomeEntry,
  memberEntries: IncomeEntry[],
): string | null {
  const hasSalary = memberHasSalaryLikeIncomeEntry(memberEntries);
  const hasBusiness = memberHasBusinessIncomeEntry(memberEntries);
  const isBusinessEntry =
    entry.category === 'self_employed' &&
    entry.periods.some((period) =>
      isBusinessIncomeStream(period.streamType),
    );

  if (isSalaryLikeCategory(entry.category) && hasBusiness) {
    return SALARY_WITH_SIDE_BUSINESS_NOTE;
  }

  if (isBusinessEntry) {
    if (hasSalary) {
      return SIDE_BUSINESS_WITH_SALARY_NOTE;
    }
    if (entry.incomePurpose === 'side_business') {
      return SIDE_BUSINESS_STANDALONE_HINT;
    }
  }

  return null;
}
