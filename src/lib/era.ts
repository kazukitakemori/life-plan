export function toJapaneseEra(year: number, month: number): string {
  const reiwaStart = { year: 2019, month: 5 };
  const heiseiStart = { year: 1989, month: 1 };
  const showaStart = { year: 1926, month: 12 };

  if (
    year > reiwaStart.year ||
    (year === reiwaStart.year && month >= reiwaStart.month)
  ) {
    return `令和${year - 2018}年`;
  }

  if (
    year > heiseiStart.year ||
    (year === heiseiStart.year && month >= heiseiStart.month)
  ) {
    return `平成${year - 1988}年`;
  }

  if (
    year > showaStart.year ||
    (year === showaStart.year && month >= showaStart.month)
  ) {
    return `昭和${year - 1925}年`;
  }

  return `${year}年`;
}
