import type { FamilyMember } from '../../types/family';
import { calcBirthYear } from '../../lib/birthDate';
import { resolveMemberBirthMonth } from '../../lib/familyDefaults';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import {
  canDeferOldAgeWithDisabilityPension,
  getMaxOldAgeDeferralAgeByBirth,
  normalizeOldAgeBenefitStart,
} from '../../lib/pensionOldAge';
import {
  formatNumericDisplay,
  getWesternYearOptions,
  MONTH_OPTIONS,
  parseNumericInput,
} from '../../lib/pensionTeikibinLabels';
import type {
  BenefitAmountMode,
  BenefitSettings,
  DependentSpousePensionSettings,
  OldAgeBenefitRowSettings,
  SurvivorPremiumRequirementSetting,
} from '../../types/pension';
import {
  PENSION_START_AGE_OPTIONS,
  PENSION_START_MONTH_OPTIONS,
} from '../../types/pension';

interface BenefitSettingsSectionProps {
  member: FamilyMember;
  referenceDate: Date;
  settings: BenefitSettings;
  specialEmployeesStartAge?: number | null;
  generalSpecialStartAge?: number | null;
  publicSpecialStartAge?: number | null;
  onChange: (settings: BenefitSettings) => void;
}

function OldAgeAmountOptions({
  rowId,
  row,
  onChange,
}: {
  rowId: string;
  row: OldAgeBenefitRowSettings;
  onChange: (row: OldAgeBenefitRowSettings) => void;
}) {
  const setMode = (amountMode: BenefitAmountMode) => {
    onChange({ ...row, amountMode });
  };

  return (
    <div className="benefit-amount-options">
      <label className="benefit-amount-option">
        <input
          type="radio"
          name={`benefit-amount-${rowId}`}
          checked={row.amountMode === 'auto'}
          onChange={() => setMode('auto')}
        />
        <span className="benefit-amount-option-label benefit-amount-option-label--auto">
          加入実績から自動計算
        </span>
      </label>
      <label className="benefit-amount-option">
        <input
          type="radio"
          name={`benefit-amount-${rowId}`}
          checked={row.amountMode === 'manual'}
          onChange={() => setMode('manual')}
        />
        <span className="benefit-amount-option-manual">
          <input
            type="text"
            className="pension-field-input pension-field-input--benefit"
            value={formatNumericDisplay(row.manualAmountPerYear)}
            disabled={row.amountMode !== 'manual'}
            aria-label="年金額を手入力"
            onChange={(e) =>
              onChange({
                ...row,
                manualAmountPerYear: parseNumericInput(e.target.value),
              })
            }
          />
          <span className="pension-field-unit">円/年（手入力）</span>
        </span>
      </label>
    </div>
  );
}

function OldAgeBenefitRow({
  rowId,
  label,
  row,
  maxDeferralAge,
  allowDeferral,
  earlyClaimCutoffAge = null,
  onChange,
}: {
  rowId: string;
  label: string;
  row: OldAgeBenefitRowSettings;
  maxDeferralAge: number;
  allowDeferral: boolean;
  earlyClaimCutoffAge?: number | null;
  onChange: (row: OldAgeBenefitRowSettings) => void;
}) {
  const normalizedByAge = normalizeOldAgeBenefitStart(
    row.startAge,
    row.startMonth ?? 0,
    maxDeferralAge,
  );
  const restrictedByDisability =
    !allowDeferral && normalizedByAge.startAge > 65;
  const restrictedBySpecialPension =
    earlyClaimCutoffAge != null &&
    normalizedByAge.startAge >= earlyClaimCutoffAge &&
    normalizedByAge.startAge < 65;
  const normalizedStart =
    restrictedByDisability || restrictedBySpecialPension
      ? { startAge: 65, startMonth: 0 }
      : normalizedByAge;
  const ageOptions = PENSION_START_AGE_OPTIONS.filter(
    (age) =>
      age <= (allowDeferral ? maxDeferralAge : 65) &&
      (earlyClaimCutoffAge == null ||
        age < earlyClaimCutoffAge ||
        age >= 65),
  );
  const monthOptions =
    normalizedStart.startAge === 65 ||
    normalizedStart.startAge === maxDeferralAge
      ? [0]
      : PENSION_START_MONTH_OPTIONS;

  const updateStart = (startAge: number, startMonth: number) => {
    const normalized = normalizeOldAgeBenefitStart(
      startAge,
      startMonth,
      maxDeferralAge,
    );
    const specialRestricted =
      earlyClaimCutoffAge != null &&
      normalized.startAge >= earlyClaimCutoffAge &&
      normalized.startAge < 65;
    onChange({
      ...row,
      ...((!allowDeferral && normalized.startAge > 65) || specialRestricted
        ? { startAge: 65, startMonth: 0 }
        : normalized),
    });
  };

  return (
    <tr>
      <th className="benefit-row-label">{label}</th>
      <td className="benefit-start-age-cell">
        <div className="benefit-start-age-inner">
          <select
            className="pension-field-select pension-field-select--benefit"
            value={normalizedStart.startAge}
            onChange={(e) =>
              updateStart(Number(e.target.value), normalizedStart.startMonth)
            }
          >
            {ageOptions.map((age) => (
              <option key={age} value={age}>
                {age}才
              </option>
            ))}
          </select>
          <select
            className="pension-field-select pension-field-select--benefit-month"
            value={normalizedStart.startMonth}
            disabled={monthOptions.length === 1}
            onChange={(e) =>
              updateStart(normalizedStart.startAge, Number(e.target.value))
            }
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}ヶ月
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="benefit-amount-cell">
        <OldAgeAmountOptions
          rowId={rowId}
          row={row}
          onChange={onChange}
        />
      </td>
    </tr>
  );
}

function DependentSpousePensionRow({
  settings,
  onChange,
}: {
  settings: DependentSpousePensionSettings;
  onChange: (s: DependentSpousePensionSettings) => void;
}) {
  const setMode = (amountMode: BenefitAmountMode) => {
    onChange({ ...settings, amountMode });
  };

  return (
    <tr>
      <th className="benefit-row-label">加給年金（配偶者）</th>
      <td className="benefit-amount-cell" colSpan={2}>
        <div className="benefit-amount-options">
          <label className="benefit-amount-option">
            <input
              type="radio"
              name="benefit-dependent-spouse"
              checked={settings.amountMode === 'auto'}
              onChange={() => setMode('auto')}
            />
            <span className="benefit-amount-option-label benefit-amount-option-label--auto">
              自動計算（厚生年金20年以上・配偶者65歳未満など）
            </span>
          </label>
          <label className="benefit-amount-option">
            <input
              type="radio"
              name="benefit-dependent-spouse"
              checked={settings.amountMode === 'manual'}
              onChange={() => setMode('manual')}
            />
            <span className="benefit-amount-option-manual">
              <input
                type="text"
                className="pension-field-input pension-field-input--benefit"
                value={formatNumericDisplay(settings.manualAmountPerYear)}
                disabled={settings.amountMode !== 'manual'}
                aria-label="加給年金を手入力"
                onChange={(e) =>
                  onChange({
                    ...settings,
                    manualAmountPerYear: parseNumericInput(e.target.value),
                  })
                }
              />
              <span className="pension-field-unit">円/年（手入力）</span>
            </span>
          </label>
        </div>
        <p className="ui-note">
          配偶者が65歳に達した場合や、一定の老齢厚生年金・障害年金の受給権がある場合は支給停止を反映します。
        </p>
      </td>
    </tr>
  );
}

function formatOptionalYearMonth(
  year?: number | null,
  month?: number | null,
): string {
  if (
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return '';
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseOptionalYearMonth(
  value: string,
): { year: number | null; month: number | null } {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return { year: null, month: null };
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return { year: null, month: null };
  }
  return { year, month };
}

/** 60〜64才（繰上げ）かどうか */
function isEarlyStart(age: number) {
  return age < 65;
}

export function BenefitSettingsSection({
  member,
  referenceDate,
  settings,
  specialEmployeesStartAge = null,
  generalSpecialStartAge = null,
  publicSpecialStartAge = null,
  onChange,
}: BenefitSettingsSectionProps) {
  const yearOptions = getWesternYearOptions();
  const memberLabel = getMemberTabLabel(member);
  const memberBirthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const maxDeferralAge = getMaxOldAgeDeferralAgeByBirth(
    memberBirthYear,
    resolveMemberBirthMonth(member),
    member.birthDay,
  );
  const canDeferBasic = canDeferOldAgeWithDisabilityPension(
    member.disabilityPension,
    'basic',
  );
  const canDeferEmployees = canDeferOldAgeWithDisabilityPension(
    member.disabilityPension,
    'employees',
  );

  const update = (patch: Partial<BenefitSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const survivorBasicEndValue = formatOptionalYearMonth(
    settings.survivorBasicEndYear,
    settings.survivorBasicEndMonth,
  );
  const survivorEmployeesEndValue = formatOptionalYearMonth(
    settings.survivorEmployeesMutualEndYear,
    settings.survivorEmployeesMutualEndMonth,
  );
  const handleSurvivorEndChange = (
    kind: 'basic' | 'employees',
    value: string,
  ) => {
    const { year, month } = parseOptionalYearMonth(value);
    if (kind === 'basic') {
      update({
        survivorBasicEndYear: year,
        survivorBasicEndMonth: month,
      });
      return;
    }
    update({
      survivorEmployeesMutualEndYear: year,
      survivorEmployeesMutualEndMonth: month,
    });
  };

  /**
   * 繰上げ同時必須ルール：
   * 老齢基礎・老齢厚生（一般/公務員）のいずれかが65才未満（繰上げ）に
   * 変更された場合、他の行も同じ受給開始年月に同期する。
   */
  const handleOldAgeChange = (
    changedKey: 'oldAgeBasic' | 'oldAgeGeneralEmployees' | 'oldAgePublicPrivate',
    newRow: OldAgeBenefitRowSettings,
  ) => {
    const syncedAge = newRow.startAge;
    const syncedMonth = newRow.startMonth ?? 0;
    const syncStart = (
      row: OldAgeBenefitRowSettings,
    ): OldAgeBenefitRowSettings => ({
      ...row,
      startAge: syncedAge,
      startMonth: syncedMonth,
    });

    if (isEarlyStart(newRow.startAge)) {
      const startMonths =
        newRow.startAge * 12 + (newRow.startMonth ?? 0);
      const earliestSpecialStartMonths =
        specialEmployeesStartAge == null
          ? null
          : specialEmployeesStartAge * 12;
      const generalSpecialStartMonths =
        generalSpecialStartAge == null
          ? null
          : generalSpecialStartAge * 12;
      const publicSpecialStartMonths =
        publicSpecialStartAge == null
          ? null
          : publicSpecialStartAge * 12;
      const canStillEarlyClaim = (
        specialStartMonths: number | null,
      ) =>
        specialStartMonths == null || startMonths < specialStartMonths;

      // いずれかの特別支給が始まった後に基礎年金を繰り上げる場合は、
      // 厚生年金側を動かさず、特別支給を継続する。
      if (changedKey === 'oldAgeBasic') {
        if (
          earliestSpecialStartMonths != null &&
          startMonths >= earliestSpecialStartMonths
        ) {
          update({ oldAgeBasic: newRow });
          return;
        }
        onChange({
          ...settings,
          oldAgeBasic: newRow,
          oldAgeGeneralEmployees: syncStart(
            settings.oldAgeGeneralEmployees,
          ),
          oldAgePublicPrivate: syncStart(settings.oldAgePublicPrivate),
        });
        return;
      }

      // 複数制度のうち既に本来の特別支給開始年齢へ到達している制度は、
      // その特別支給を維持し、まだ開始前の制度だけを同時繰上げする。
      onChange({
        ...settings,
        oldAgeBasic: syncStart(settings.oldAgeBasic),
        oldAgeGeneralEmployees:
          changedKey === 'oldAgeGeneralEmployees'
            ? newRow
            : canStillEarlyClaim(generalSpecialStartMonths)
              ? syncStart(settings.oldAgeGeneralEmployees)
              : settings.oldAgeGeneralEmployees,
        oldAgePublicPrivate:
          changedKey === 'oldAgePublicPrivate'
            ? newRow
            : canStillEarlyClaim(publicSpecialStartMonths)
              ? syncStart(settings.oldAgePublicPrivate)
              : settings.oldAgePublicPrivate,
      });
      return;
    }

    // 老齢厚生年金を複数の実施機関から受ける場合、繰下げ請求は同時に行う。
    // 一般厚生と公務員厚生・私学共済の開始年月だけを常に連動させる。
    if (
      changedKey === 'oldAgeGeneralEmployees' ||
      changedKey === 'oldAgePublicPrivate'
    ) {
      onChange({
        ...settings,
        oldAgeGeneralEmployees:
          changedKey === 'oldAgeGeneralEmployees'
            ? newRow
            : syncStart(settings.oldAgeGeneralEmployees),
        oldAgePublicPrivate:
          changedKey === 'oldAgePublicPrivate'
            ? newRow
            : syncStart(settings.oldAgePublicPrivate),
      });
      return;
    }

    update({ [changedKey]: newRow });
  };

  const isEarlyPension =
    isEarlyStart(settings.oldAgeBasic.startAge) ||
    isEarlyStart(settings.oldAgeGeneralEmployees.startAge) ||
    isEarlyStart(settings.oldAgePublicPrivate.startAge);
  const isEmployeesDeferred =
    canDeferEmployees &&
    (settings.oldAgeGeneralEmployees.startAge > 65 ||
      settings.oldAgePublicPrivate.startAge > 65);
  const hasSurvivorPensionInput =
    settings.survivorBasicPerYear != null ||
    settings.survivorEmployeesMutualPerYear != null;
  const hasOldAgeDeferral =
    settings.oldAgeBasic.startAge > 65 ||
    settings.oldAgeGeneralEmployees.startAge > 65 ||
    settings.oldAgePublicPrivate.startAge > 65;
  const shouldWarnSurvivorDeferral =
    hasSurvivorPensionInput && hasOldAgeDeferral;

  return (
    <div className="pension-subsection benefit-settings">
      <h4 className="pension-subsection-title">受給設定</h4>

      <div className="benefit-settings-block">
        <h5 className="benefit-settings-block-title">
          老齢年金の受け取り方
        </h5>
        {(!canDeferBasic || !canDeferEmployees) && (
          <p className="benefit-early-pension-note">
            {canDeferEmployees
              ? '※ Q1で障害基礎年金の受給権が設定されているため、老齢基礎年金は繰下げ不可として65才から計算します。老齢厚生年金は繰下げを選べます。'
              : '※ Q1で障害厚生年金の受給権が設定されているため、老齢基礎・老齢厚生年金は繰下げ不可として65才から計算します。'}
          </p>
        )}
        {shouldWarnSurvivorDeferral && (
          <p className="benefit-early-pension-note">
            ※ 遺族年金の受給権がある場合、老齢年金の繰下げ可否は受給権の種類・時期・請求状況で変わります。2028年4月以降は、遺族厚生年金の受給権者でも老齢基礎年金は繰下げ可能となり、老齢厚生年金は遺族厚生年金を請求していない場合に限り繰下げ可能となります。Q8の「受給中」入力だけでは経過措置まで確定できないため、開始年齢は自動変更せず選択値のまま試算します。
          </p>
        )}
        {isEarlyPension && (
          <p className="benefit-early-pension-note">
            {specialEmployeesStartAge != null
              ? '※ 特別支給の老齢厚生年金がある場合、厚生年金の繰上げは本来の特別支給開始前だけ選べます。開始後は特別支給を反映したまま、老齢基礎年金だけ65才前に繰上げできます。'
              : '※ 繰上げ受給（65才未満）の場合、老齢基礎・老齢厚生は同時繰上げが必須のため、受取開始年月を連動させています。'}
          </p>
        )}
        {!isEarlyPension && isEmployeesDeferred && (
          <p className="benefit-early-pension-note">
            ※ 一般厚生と公務員厚生・私学共済は、老齢厚生年金の繰下げ請求を同時に行うため、開始年月を連動させています。
          </p>
        )}
        <table className="benefit-settings-table">
          <thead>
            <tr>
              <th className="benefit-row-label-header" />
              <th className="benefit-col-header">
                受取開始
              </th>
              <th className="benefit-col-header">年金額</th>
            </tr>
          </thead>
          <tbody>
            <OldAgeBenefitRow
              rowId="basic"
              label="老齢基礎"
              row={settings.oldAgeBasic}
              maxDeferralAge={maxDeferralAge}
              allowDeferral={canDeferBasic}
              onChange={(row) => handleOldAgeChange('oldAgeBasic', row)}
            />
            <OldAgeBenefitRow
              rowId="general"
              label="一般厚生"
              row={settings.oldAgeGeneralEmployees}
              maxDeferralAge={maxDeferralAge}
              allowDeferral={canDeferEmployees}
              earlyClaimCutoffAge={generalSpecialStartAge}
              onChange={(row) =>
                handleOldAgeChange('oldAgeGeneralEmployees', row)
              }
            />
            <OldAgeBenefitRow
              rowId="public-private"
              label="公務員厚生・私学共済"
              row={settings.oldAgePublicPrivate}
              maxDeferralAge={maxDeferralAge}
              allowDeferral={canDeferEmployees}
              earlyClaimCutoffAge={publicSpecialStartAge}
              onChange={(row) =>
                handleOldAgeChange('oldAgePublicPrivate', row)
              }
            />
            <DependentSpousePensionRow
              settings={
                settings.dependentSpousePension ?? {
                  amountMode: 'auto',
                  manualAmountPerYear: null,
                }
              }
              onChange={(dependentSpousePension) =>
                update({ dependentSpousePension })
              }
            />
          </tbody>
        </table>

        {(member.role === 'head' || member.role === 'spouse') && (
          <>
            <div className="pension-auto-benefit-note" role="note">
              <strong>万一の場合の年金</strong>
              <span>
                {memberLabel}に万が一があった場合の遺族基礎年金・遺族厚生年金は、加入状況などから自動計算します。
              </span>
            </div>

            <div className="benefit-survivor-premium-setting">
              <label
                className="pension-enrollment-label"
                htmlFor={`survivor-premium-requirement-${member.id}`}
              >
                遺族年金の保険料納付要件
              </label>
              <select
                id={`survivor-premium-requirement-${member.id}`}
                className="pension-field-select"
                value={settings.survivorPremiumRequirement ?? 'auto'}
                onChange={(e) =>
                  update({
                    survivorPremiumRequirement:
                      e.target.value as SurvivorPremiumRequirementSetting,
                  })
                }
              >
                <option value="auto">ねんきん定期便から自動確認</option>
                <option value="met">満たしている</option>
                <option value="not_met">満たしていない</option>
              </select>
              <p className="ui-note">
                自動確認で判定できない場合、遺族基礎年金・遺族厚生年金は試算へ自動計上しません。
                ねんきんネット等で要件を確認できる場合は手動で指定できます。
              </p>
            </div>
          </>
        )}
      </div>

      <details className="benefit-settings-block benefit-settings-block--optional benefit-survivor-details">
        <summary className="benefit-survivor-summary">
          <span className="benefit-survivor-summary-copy">
            <span className="benefit-survivor-summary-title">受給中の遺族年金</span>
            <span className="benefit-optional-badge">該当する場合のみ</span>
          </span>
          <span className="benefit-survivor-summary-hint">入力する</span>
        </summary>
        <div className="benefit-survivor-details-body">
          <div className="benefit-death-date">
            <span className="benefit-death-date-label">故人の死亡年月</span>
            <span className="benefit-date-field">
              <select
                className="pension-field-select pension-field-select--date"
                value={settings.survivorDeathYear}
                onChange={(e) =>
                  update({ survivorDeathYear: Number(e.target.value) })
                }
                aria-label="故人の死亡年"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <span className="benefit-date-unit">年</span>
            </span>
            <span className="benefit-date-field">
              <select
                className="pension-field-select pension-field-select--date"
                value={settings.survivorDeathMonth}
                onChange={(e) =>
                  update({ survivorDeathMonth: Number(e.target.value) })
                }
                aria-label="故人の死亡月"
              >
                {MONTH_OPTIONS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <span className="benefit-date-unit">月</span>
            </span>
          </div>

          <table className="benefit-survivor-table">
            <tbody>
              <tr>
                <th className="benefit-row-label">遺族基礎</th>
                <td className="benefit-survivor-input-cell">
                  <input
                    type="text"
                    className="pension-field-input pension-field-input--benefit-wide"
                    value={formatNumericDisplay(settings.survivorBasicPerYear)}
                    onChange={(e) =>
                      update({
                        survivorBasicPerYear: parseNumericInput(e.target.value),
                      })
                    }
                  />
                  <span className="benefit-survivor-suffix">
                    円/年（実際の受給年額・子の加算を含む合計額）
                  </span>
                  <label className="benefit-survivor-end-date">
                    <span className="benefit-survivor-end-label">
                      終了予定年月（任意）
                    </span>
                    <input
                      type="month"
                      className="pension-field-input benefit-survivor-end-input"
                      value={survivorBasicEndValue}
                      onChange={(e) =>
                        handleSurvivorEndChange('basic', e.target.value)
                      }
                      aria-label="遺族基礎年金の終了予定年月"
                    />
                    <span className="benefit-survivor-end-help">
                      この月分まで
                    </span>
                  </label>
                </td>
              </tr>
              <tr>
                <th className="benefit-row-label">遺族厚生・共済</th>
                <td className="benefit-survivor-input-cell">
                  <span className="benefit-receiving-label">受給中</span>
                  <input
                    type="text"
                    className="pension-field-input pension-field-input--benefit-wide"
                    value={formatNumericDisplay(
                      settings.survivorEmployeesMutualPerYear,
                    )}
                    onChange={(e) =>
                      update({
                        survivorEmployeesMutualPerYear: parseNumericInput(
                          e.target.value,
                        ),
                      })
                    }
                  />
                  <span className="benefit-survivor-suffix">
                    円/年（実際の受給年額・遺族厚生年金と共済年金の合計）
                  </span>
                  <label className="benefit-survivor-end-date">
                    <span className="benefit-survivor-end-label">
                      終了予定年月（任意）
                    </span>
                    <input
                      type="month"
                      className="pension-field-input benefit-survivor-end-input"
                      value={survivorEmployeesEndValue}
                      onChange={(e) =>
                        handleSurvivorEndChange('employees', e.target.value)
                      }
                      aria-label="遺族厚生・共済年金の終了予定年月"
                    />
                    <span className="benefit-survivor-end-help">
                      この月分まで
                    </span>
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="ui-note benefit-survivor-end-note">
            終了予定年月は分かる場合だけ設定してください。設定した月分までを対象とし、翌月分から終了として扱います。実際の入金は支給月の都合で後の月に現れる場合があります。未設定の場合は終了時期を自動推測せず、現在額が続く前提で試算します。
          </p>
        </div>
      </details>
    </div>
  );
}
