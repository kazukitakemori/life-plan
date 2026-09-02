import {
  AVAILABLE_PREFECTURES,
  NATIONAL_HEALTH_DATA_VERSION,
} from '../../data/fukuokaMunicipalities';
import { calcBirthYear, formatYearAtAgeLabel } from '../../lib/birthDate';
import { resolveMemberAge } from '../../lib/familyDefaults';
import { getResidenceAgeOptions } from '../../lib/taxSocialDefaults';
import { normalizePrefectureCode } from '../../lib/taxSocialRegions';
import type { FamilyMember } from '../../types/family';
import type { ResidencePeriod } from '../../types/taxSocial';

interface ResidenceCardProps {
  periods: ResidencePeriod[];
  headMember: FamilyMember;
  referenceDate: Date;
  onChange: (periods: ResidencePeriod[]) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function ResidencePeriodRow({
  period,
  index,
  headMember,
  referenceDate,
  canRemove,
  onChange,
  onRemove,
}: {
  period: ResidencePeriod;
  index: number;
  headMember: FamilyMember;
  referenceDate: Date;
  canRemove: boolean;
  onChange: (period: ResidencePeriod) => void;
  onRemove: () => void;
}) {
  const ageOptions = getResidenceAgeOptions(resolveMemberAge(headMember));
  const birthYear = calcBirthYear(
    headMember.age,
    headMember.birthMonth,
    referenceDate,
  );
  const isBasePeriod = index === 0;

  const updatePeriod = (patch: Partial<ResidencePeriod>) => {
    onChange({
      ...period,
      ...patch,
      prefectureCode: normalizePrefectureCode(
        patch.prefectureCode ?? period.prefectureCode,
      ),
    });
  };

  return (
    <div className="residence-period-row">
      <div className="residence-period-main">
        <div className="residence-period-label">
          {isBasePeriod ? (
            '基準年時点'
          ) : (
            <div className="residence-period-timing">
              <select
                className="select-input select-input--compact residence-age-select"
                value={period.startAge}
                onChange={(event) =>
                  updatePeriod({ startAge: Number(event.target.value) })
                }
                aria-label="開始年齢"
              >
                {ageOptions.map((age) => (
                  <option key={age} value={age}>
                    {formatYearAtAgeLabel(
                      age,
                      period.startMonth,
                      birthYear,
                      headMember.birthMonth,
                    )}
                  </option>
                ))}
              </select>
              <select
                className="select-input select-input--compact"
                value={period.startMonth}
                onChange={(event) =>
                  updatePeriod({ startMonth: Number(event.target.value) })
                }
                aria-label="開始月"
              >
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
              <span className="residence-period-from">から</span>
            </div>
          )}
        </div>

        <select
          className="select-input residence-prefecture-select"
          value={period.prefectureCode}
          onChange={(event) =>
            updatePeriod({ prefectureCode: event.target.value })
          }
          aria-label="都道府県"
        >
          {AVAILABLE_PREFECTURES.map((prefecture) => (
            <option key={prefecture.code} value={prefecture.code}>
              {prefecture.name}
            </option>
          ))}
        </select>

        {isBasePeriod && (
          <span className="residence-data-version">
            （{NATIONAL_HEALTH_DATA_VERSION}年度版 国保対応）
          </span>
        )}

        <button
          type="button"
          className="residence-calc-btn"
          title="国保料率の確認（準備中）"
          disabled
        >
          <span aria-hidden>🧮</span>
        </button>
      </div>

      {!isBasePeriod && canRemove && (
        <button
          type="button"
          className="residence-remove-btn"
          onClick={onRemove}
          aria-label="この住まいの期間を削除"
        >
          削除
        </button>
      )}
    </div>
  );
}

export function ResidenceCard({
  periods,
  headMember,
  referenceDate,
  onChange,
}: ResidenceCardProps) {
  const updatePeriod = (periodId: string, updated: ResidencePeriod) => {
    onChange(periods.map((period) => (period.id === periodId ? updated : period)));
  };

  const removePeriod = (periodId: string) => {
    if (periods.length <= 1) return;
    onChange(periods.filter((period) => period.id !== periodId));
  };

  return (
    <section className="residence-card">
      <header className="residence-card-header">
        <span className="residence-card-icon" aria-hidden>
          📍
        </span>
        <h3 className="residence-card-title">お住まい</h3>
      </header>

      <div className="residence-card-body">
        {periods.map((period, index) => (
          <ResidencePeriodRow
            key={period.id}
            period={period}
            index={index}
            headMember={headMember}
            referenceDate={referenceDate}
            canRemove={periods.length > 1}
            onChange={(updated) => updatePeriod(period.id, updated)}
            onRemove={() => removePeriod(period.id)}
          />
        ))}
      </div>
    </section>
  );
}
