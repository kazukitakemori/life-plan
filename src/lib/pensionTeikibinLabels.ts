export const NATIONAL_PENSION_PAYMENT_OPTIONS = [
  { value: '', label: '' },
  { value: 'paid', label: '納付済み' },
  { value: 'unpaid', label: '未納' },
  { value: 'type3', label: '3号' },
  { value: 'full-exemption', label: '全額免除' },
  { value: 'half-exemption', label: '半額免除' },
  { value: 'half-unpaid', label: '半額未納' },
  { value: 'three-quarter-exemption', label: '3/4免除' },
  { value: 'three-quarter-unpaid', label: '3/4未納' },
  { value: 'quarter-exemption', label: '1/4免除' },
  { value: 'quarter-unpaid', label: '1/4未納' },
  { value: 'student-special', label: '学生特例等' },
  { value: 'additional', label: '付加' },
  { value: 'consolidation', label: '合算' },
  { value: 'not-enrolled', label: '未加入' },
] as const;

export const EMPLOYEES_PENSION_CATEGORY_OPTIONS = [
  { value: '', label: '' },
  { value: 'employees', label: '厚年' },
  { value: 'public', label: '公共' },
  { value: 'private-mutual', label: '私共' },
] as const;

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const WESTERN_YEAR_START = 1985;

export function getWesternYearOptions(endYear = 2030): number[] {
  const length = Math.max(0, endYear - WESTERN_YEAR_START + 1);
  return Array.from({ length }, (_, i) => WESTERN_YEAR_START + i);
}

export function formatWesternYearMonth(year: number, month: number): string {
  return `${year}年${month}月`;
}

/** 選択年月の直前12か月分（選択が Y年M月 → (Y-1)年M月から12か月） */
export function buildMonthlyLabelsFromWestern(
  selectedYear: number,
  selectedMonth: number,
  count = 12,
): string[] {
  const labels: string[] = [];
  let year = selectedYear - 1;
  let month = selectedMonth;

  for (let i = 0; i < count; i++) {
    labels.push(formatWesternYearMonth(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return labels;
}

export function parseNumericInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumericDisplay(value: number | null): string {
  if (value === null) return '';
  return value.toLocaleString('ja-JP');
}
