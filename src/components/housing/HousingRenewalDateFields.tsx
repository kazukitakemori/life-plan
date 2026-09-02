const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function buildYearOptions(referenceYear: number, minYear?: number): number[] {
  const start = minYear != null ? Math.min(minYear, referenceYear) : referenceYear;
  const end = referenceYear + 60;
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

interface HousingRenewalDateFieldsProps {
  year: number;
  month: number;
  referenceYear: number;
  /** 選択肢の最古年。未指定時は referenceYear から */
  minYear?: number;
  /** true のとき年のみ表示（月は非表示・変更不可） */
  yearOnly?: boolean;
  onChange: (year: number, month: number) => void;
}

export function HousingRenewalDateFields({
  year,
  month,
  referenceYear,
  minYear,
  yearOnly = false,
  onChange,
}: HousingRenewalDateFieldsProps) {
  const yearOptions = buildYearOptions(referenceYear, minYear);
  const resolvedYear = yearOptions.includes(year) ? year : yearOptions[0];

  return (
    <div className="housing-renewal-date">
      <select
        className="select-input select-input--compact housing-renewal-year-select"
        value={resolvedYear}
        onChange={(event) => onChange(Number(event.target.value), month)}
        aria-label="次回更新年"
      >
        {yearOptions.map((optionYear) => (
          <option key={optionYear} value={optionYear}>
            {optionYear}
          </option>
        ))}
      </select>
      {!yearOnly && (
        <>
          <span className="housing-renewal-slash">/</span>
          <select
            className="select-input select-input--compact"
            value={month}
            onChange={(event) => onChange(resolvedYear, Number(event.target.value))}
            aria-label="次回更新月"
          >
            {MONTHS.map((optionMonth) => (
              <option key={optionMonth} value={optionMonth}>
                {optionMonth}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
