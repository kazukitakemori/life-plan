import type { ReactNode } from 'react';
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
} from '../../types/pension';
import { PENSION_START_AGE_OPTIONS, PENSION_START_MONTH_OPTIONS } from '../../types/pension';
import { DEPENDENT_SPOUSE_PENSION_YEN_PER_YEAR } from '../../lib/pensionConstants';

interface BenefitSettingsSectionProps {
  settings: BenefitSettings;
  headOfHouseholdLabel: string;
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
          「1. 年金加入実績」を元に自動計算
          <span className="pension-help-icon" title="加入実績から自動計算">
            ?
          </span>
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
            onChange={(e) =>
              onChange({
                ...row,
                manualAmountPerYear: parseNumericInput(e.target.value),
              })
            }
          />
          <span className="pension-field-unit">円/年</span>
          <span className="pension-help-icon" title="手入力の基本金額">
            ?
          </span>
        </span>
      </label>
    </div>
  );
}

function OldAgeBenefitRow({
  rowId,
  label,
  row,
  survivorCell,
  omitSurvivorCell = false,
  onChange,
}: {
  rowId: string;
  label: string;
  row: OldAgeBenefitRowSettings;
  survivorCell?: ReactNode;
  omitSurvivorCell?: boolean;
  onChange: (row: OldAgeBenefitRowSettings) => void;
}) {
  return (
    <tr>
      <th className="benefit-row-label">{label}</th>
      <td className="benefit-start-age-cell">
        <div className="benefit-start-age-inner">
          <select
            className="pension-field-select pension-field-select--benefit"
            value={row.startAge}
            onChange={(e) =>
              onChange({ ...row, startAge: Number(e.target.value) })
            }
          >
            {PENSION_START_AGE_OPTIONS.map((age) => (
              <option key={age} value={age}>
                {age}才
              </option>
            ))}
          </select>
          <select
            className="pension-field-select pension-field-select--benefit-month"
            value={row.startMonth ?? 0}
            onChange={(e) =>
              onChange({ ...row, startMonth: Number(e.target.value) })
            }
          >
            {PENSION_START_MONTH_OPTIONS.map((m) => (
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
      {!omitSurvivorCell &&
        (survivorCell ?? <td className="benefit-survivor-cell" />)}
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
              自動計算（厚生年金20年以上・配偶者65歳未満の間）
              <span
                className="pension-help-icon"
                title={`2026年度: ${DEPENDENT_SPOUSE_PENSION_YEN_PER_YEAR.toLocaleString()}円/年（昭和18年4月2日以降生まれ）`}
              >
                ?
              </span>
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
      </td>
    </tr>
  );
}

/** 60〜64才（繰上げ）かどうか */
function isEarlyStart(age: number) {
  return age < 65;
}

export function BenefitSettingsSection({
  settings,
  headOfHouseholdLabel,
  onChange,
}: BenefitSettingsSectionProps) {
  const yearOptions = getWesternYearOptions();
  const update = (patch: Partial<BenefitSettings>) => {
    onChange({ ...settings, ...patch });
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
    if (isEarlyStart(newRow.startAge)) {
      const syncedAge = newRow.startAge;
      const syncedMonth = newRow.startMonth ?? 0;
      const syncStart = (r: OldAgeBenefitRowSettings): OldAgeBenefitRowSettings => ({
        ...r,
        startAge: syncedAge,
        startMonth: syncedMonth,
      });
      onChange({
        ...settings,
        oldAgeBasic: changedKey === 'oldAgeBasic' ? newRow : syncStart(settings.oldAgeBasic),
        oldAgeGeneralEmployees:
          changedKey === 'oldAgeGeneralEmployees' ? newRow : syncStart(settings.oldAgeGeneralEmployees),
        oldAgePublicPrivate:
          changedKey === 'oldAgePublicPrivate' ? newRow : syncStart(settings.oldAgePublicPrivate),
      });
    } else {
      update({ [changedKey]: newRow });
    }
  };

  const isEarlyPension =
    isEarlyStart(settings.oldAgeBasic.startAge) ||
    isEarlyStart(settings.oldAgeGeneralEmployees.startAge) ||
    isEarlyStart(settings.oldAgePublicPrivate.startAge);

  return (
    <div className="pension-subsection benefit-settings">
      <h4 className="pension-subsection-title">(2) 受給設定</h4>

      <div className="benefit-settings-block">
        <h5 className="benefit-settings-block-title">① 老齢年金</h5>
        {isEarlyPension && (
          <p className="benefit-early-pension-note">
            ※ 繰上げ受給（65才未満）の場合、老齢基礎・老齢厚生は同時繰上げが必須のため、受取開始年月を連動させています。
          </p>
        )}
        <table className="benefit-settings-table">
          <thead>
            <tr>
              <th className="benefit-row-label-header" />
              <th className="benefit-col-header">
                受取開始年齢
                <span className="pension-help-icon" title="受取開始年齢について">
                  ?
                </span>
              </th>
              <th className="benefit-col-header">基本金額</th>
              <th className="benefit-col-header benefit-col-header--survivor">
                {headOfHouseholdLabel}に万が一があった場合の遺族年金
              </th>
            </tr>
          </thead>
          <tbody>
            <OldAgeBenefitRow
              rowId="basic"
              label="老齢基礎"
              row={settings.oldAgeBasic}
              onChange={(row) => handleOldAgeChange('oldAgeBasic', row)}
              survivorCell={
                <td className="benefit-survivor-cell">
                  遺族基礎年金を自動計算
                  <span
                    className="pension-help-icon"
                    title="遺族基礎年金の自動計算"
                  >
                    ?
                  </span>
                </td>
              }
            />
            <OldAgeBenefitRow
              rowId="general"
              label="一般厚生"
              row={settings.oldAgeGeneralEmployees}
              onChange={(row) => handleOldAgeChange('oldAgeGeneralEmployees', row)}
              survivorCell={
                <td className="benefit-survivor-cell" rowSpan={2}>
                  遺族厚生年金を自動計算
                  <span
                    className="pension-help-icon"
                    title="遺族厚生年金の自動計算"
                  >
                    ?
                  </span>
                </td>
              }
            />
            <OldAgeBenefitRow
              rowId="public-private"
              label="公務員厚生・私学共済"
              row={settings.oldAgePublicPrivate}
              omitSurvivorCell
              onChange={(row) => handleOldAgeChange('oldAgePublicPrivate', row)}
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
      </div>

      <div className="benefit-settings-block">
        <h5 className="benefit-settings-block-title">
          ② 受給中の遺族年金・寡婦年金
          <span className="benefit-death-date">
            【 故人の死亡年月：
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
            年
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
            月 】
          </span>
        </h5>

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
                  円/年（子の加算を除いた額）
                </span>
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
                  円/年（遺族厚生年金と遺族共済年金の合計）
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
