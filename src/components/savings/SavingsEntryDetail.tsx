import {
  calcNisaLifetimeQuotaWithEntry,
  calcNisaRemainingAnnualQuotaMan,
  calcNisaValuationMan,
  calcPlannedAnnualContributionMan,
  ensureNisaFields,
  estimateNisaQuotaFill,
  getNisaAnnualLimitMan,
  getNisaLifetimeRemainingForCategory,
  isNisaAnnualContributionOverLimit,
  isNisaCategory,
  NISA_GROWTH_LIFETIME_LIMIT_MAN,
  NISA_LIFETIME_LIMIT_MAN,
  resolveNisaPrincipalMan,
  resolveNisaUtilization,
  resolveNisaValuationMode,
} from '../../lib/nisaQuota';
import {
  applyIdecoOccupancySelection,
  calcMemberCorporateDcMonthlyYen,
  calcMemberDbOtherSystemMonthlyYen,
  clampIdecoContributionPeriod,
  clampIdecoContributionToLimit,
  formatIdecoYen,
  IDECO_OCCUPANCY_LABELS,
  isCorporateDcContributionOverCeiling,
  isIdecoCategory,
  isIdecoContributionOverLimit,
  listIdecoOccupancyOptionsFromIncome,
  memberHasCorporateDcEntry,
  memberHasDbEntry,
  resolveCorporateDcCombinedCeilingYen,
  resolveEffectiveIdecoOccupancy,
  resolveIdecoContributionEndCap,
  resolveIdecoCorporatePensionFlags,
  resolveIdecoMonthlyLimitYen,
  showsIdecoCorporatePensionFlags,
  yenToMan,
  ensureIdecoFields,
} from '../../lib/idecoContributionLimit';
import {
  applyIdecoPastContributionEnabled,
  appendDcPastContributionSegment,
  arePastContributionSegmentsEqual,
  buildDcPastSegmentsFromEnrollmentYears,
  isIdecoPastContributionEnabled,
  migrateDcScalarPastToSegments,
  resolveDcPastEnrollmentYearsFromSegments,
  resolveIdecoDcMainContributionStart,
  resolveIdecoDcOpeningBalanceMan,
  resolveIdecoDcReferenceNow,
  resolveIdecoPastContributionInputMode,
  suggestDcPastSegmentsFromIncome,
  syncIdecoDcPastContributionPeriods,
} from '../../lib/idecoPastContribution';
import {
  applyDbOccupancySelection,
  DB_ENROLLMENT_AGE_ONLY_MONTH,
  ensureDbEnrollmentFields,
  resolveDbEnrollmentEndCap,
  resolveDbEnrollmentMode,
  resolveDbEnrollmentYears,
  resolveEffectiveDbOccupancy,
} from '../../lib/dbEnrollment';
import {
  createSavingsEntry,
  setMemberCorporateDcEnrollment,
  setMemberDbEnrollment,
} from '../../lib/savingsDefaults';
import {
  applyDcOccupancySelection,
  clampDcContributionPeriod,
  CORPORATE_DC_CONTRIBUTION_MAX_AGE,
  DC_OCCUPANCY_LABELS,
  ensureDcContributionFields,
  listDcOccupancyOptionsFromIncome,
  resolveDcContributionEndCap,
  resolveEffectiveDcOccupancy,
} from '../../lib/dcContribution';
import {
  findIdecoTransferTarget,
  needsDcIdecoTransferOnEnd,
} from '../../lib/dcIdecoTransfer';
import {
  DB_EARLY_EXIT_MODE_LABELS,
  DB_EARLY_EXIT_MODES,
  isDbTransferToIdeco,
  needsDbEarlyExitChoice,
  resolveDbEarlyExitMode,
  resolveDbQualificationEnd,
} from '../../lib/dbEarlyExit';
import type {
  DbEarlyExitMode,
  DbEnrollmentMode,
  DcOccupancy,
  IdecoOccupancy,
  SavingsPastContributionSegment,
} from '../../types/savings';
import {
  calcInclusiveMonthCount,
  calcMonthlyDrawdownFromMonths,
  clampPensionPayoutFields,
  IDECO_ANNUITY_DEFAULT_YEARS,
  IDECO_ANNUITY_PERIOD_MODE_LABELS,
  IDECO_ANNUITY_YEAR_OPTIONS,
  IDECO_PAYOUT_MIN_AGE,
  IDECO_PAYOUT_MODE_LABELS,
  IDECO_PAYOUT_MODES,
  getIdecoPayoutAgeOptions,
  getPensionPayoutAgeOptions,
  resolveIdecoAnnuityPeriodMode,
  resolveIdecoAnnuityYears,
  resolveIdecoPayoutStart,
  resolvePensionEnrollmentPayoutFloorAge,
  resolvePensionPayoutStart,
  calcPensionEnrollmentYearsAsOf,
  calcPensionRetirementDeductionEnrollmentYears,
} from '../../lib/idecoPayout';
import {
  calcRetirementIncomeTaxBreakdown,
  calcRetirementLumpNetMan,
  RETIREMENT_INCOME_DEDUCTION_BASE_OVER_20_YEN,
  RETIREMENT_INCOME_DEDUCTION_EXTRA_PER_YEAR_YEN,
  RETIREMENT_INCOME_DEDUCTION_PER_YEAR_YEN,
} from '../../lib/retirementIncomeTax';
import { previewPensionOnceTaxWithOverlap } from '../../lib/retirementDeductionOverlap';
import type { IdecoAnnuityPeriodMode } from '../../types/savings';
import { estimateInvestBalanceManAt } from '../../lib/savingsCashFlow';
import {
  calcBirthYear,
  formatEndYearLabel,
  formatYearAtAgeLabel,
} from '../../lib/birthDate';
import {
  resolveMemberAge,
  resolveMemberBirthMonth,
} from '../../lib/familyDefaults';
import { getVehicleAgeOptions } from '../../lib/vehicleDefaults';
import {
  formatReturnRateLabel,
  getSavingsRateFieldLabel,
  isTaxableSavingsCategory,
  NISA_UTILIZATION_LABELS,
  NISA_VALUATION_MODE_LABELS,
  SAVINGS_CATEGORY_LABELS,
  SAVINGS_CONTRIBUTION_MODE_LABELS,
  SAVINGS_CONTRIBUTION_MODE_UNITS,
  SAVINGS_CONTRIBUTION_MODES,
  SAVINGS_DEFAULT_WITHDRAWAL_YEARS,
  SAVINGS_WITHDRAWAL_MODE_LABELS,
  SAVINGS_WITHDRAWAL_MODES,
  resolveDefaultSavingsContributionEndAge,
  resolveSavingsContributionMode,
  resolveSavingsWithdrawalMode,
  supportsSavingsWithdrawal,
  isInvestSavingsCategory,
  isPensionStylePayoutCategory,
} from '../../lib/savingsLabels';
import {
  calcDrawdownAmounts,
  ensureSavingsWithdrawalFields,
  getContributionWithdrawalOverlapKind,
  resolveWithdrawalYears,
  suggestWithdrawalStart,
  withdrawalEndFromYears,
} from '../../lib/savingsWithdrawalPeriod';
import {
  calcTaxableValuationMan,
  ensureTaxableFields,
  resolveTaxablePrincipalMan,
  resolveTaxableUtilization,
  TAXABLE_CAPITAL_GAINS_TAX_RATE,
} from '../../lib/taxableCapitalGains';
import {
  calcTimeDepositMaturityProceedsFromEntry,
  ensureTimeDepositFields,
  getTimeDepositMaturity,
  isTimeDepositCategory,
  resolveTimeDepositTermYears,
  TIME_DEPOSIT_INTEREST_TAX_RATE,
  TIME_DEPOSIT_TERM_YEAR_OPTIONS,
} from '../../lib/timeDeposit';
import type { FamilyMember } from '../../types/family';
import type { IncomeEntry } from '../../types/income';
import type {
  NisaUtilization,
  NisaValuationMode,
  SavingsContributionMode,
  SavingsEntry,
  TaxableUtilization,
} from '../../types/savings';
import { LoanSettingsField } from '../loan/LoanSettingsFields';
import { useEffect } from 'react';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** DC/DB 正規化 useEffect が onChange すべきか（参照ではなく値で判定） */
function dcDbNormalizeNeedsWrite(
  prev: SavingsEntry,
  next: SavingsEntry,
): boolean {
  if (prev === next) return false;
  return (
    prev.balanceMan !== next.balanceMan ||
    prev.startAge !== next.startAge ||
    prev.startMonth !== next.startMonth ||
    prev.endAge !== next.endAge ||
    prev.endMonth !== next.endMonth ||
    prev.endMode !== next.endMode ||
    prev.pastContributionEnabled !== next.pastContributionEnabled ||
    prev.pastContributionInputMode !== next.pastContributionInputMode ||
    prev.pastStartAge !== next.pastStartAge ||
    prev.pastStartMonth !== next.pastStartMonth ||
    prev.pastEndAge !== next.pastEndAge ||
    prev.pastEndMonth !== next.pastEndMonth ||
    prev.pastContributionMan !== next.pastContributionMan ||
    prev.pastBalanceMan !== next.pastBalanceMan ||
    prev.pastExpectedReturnRatePct !== next.pastExpectedReturnRatePct ||
    prev.dbEnrollmentMode !== next.dbEnrollmentMode ||
    prev.dbEnrollmentYears !== next.dbEnrollmentYears ||
    prev.dbEnrollmentStartAge !== next.dbEnrollmentStartAge ||
    prev.dbEnrollmentStartMonth !== next.dbEnrollmentStartMonth ||
    prev.dbEnrollmentEndAge !== next.dbEnrollmentEndAge ||
    prev.dbEnrollmentEndMonth !== next.dbEnrollmentEndMonth ||
    prev.dbOccupancy !== next.dbOccupancy ||
    prev.dbEarlyExitMode !== next.dbEarlyExitMode ||
    prev.transferBalanceToIdecoOnEnd !== next.transferBalanceToIdecoOnEnd ||
    prev.withdrawalMode !== next.withdrawalMode ||
    prev.withdrawalMan !== next.withdrawalMan ||
    prev.withdrawalStartAge !== next.withdrawalStartAge ||
    prev.withdrawalStartMonth !== next.withdrawalStartMonth ||
    prev.withdrawalYears !== next.withdrawalYears ||
    prev.withdrawalEndAge !== next.withdrawalEndAge ||
    prev.withdrawalEndMonth !== next.withdrawalEndMonth ||
    !arePastContributionSegmentsEqual(
      prev.pastContributionSegments,
      next.pastContributionSegments,
    ) ||
    prev.employerContributionMode !== next.employerContributionMode ||
    prev.employerContributionMan !== next.employerContributionMan ||
    prev.employeeContributionMode !== next.employeeContributionMode ||
    prev.employeeContributionMan !== next.employeeContributionMan ||
    prev.dcOccupancy !== next.dcOccupancy
  );
}

interface SavingsEntryDetailProps {
  entry: SavingsEntry;
  member: FamilyMember;
  /** 同一メンバーの全口座（生涯枠は両枠合算のため） */
  memberEntries: SavingsEntry[];
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
  onChange: (entry: SavingsEntry) => void;
  /** 企業型DC・DB などメンバー横断の更新 */
  onChangeMemberEntries: (entries: SavingsEntry[]) => void;
  /** 企業型DC口座カードを開く導線 */
  onRequestExpandEntry?: (entryId: string) => void;
}

function formatMan(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}

export function formatSavingsEntrySummary(
  entry: SavingsEntry,
  memberEntries: SavingsEntry[] = [entry],
): string {
  const mode = resolveSavingsContributionMode(entry.contributionMode);
  const rateLabel = getSavingsRateFieldLabel(entry.category);
  const rate = formatReturnRateLabel(
    Math.max(0, Number(entry.expectedReturnRatePct) || 0),
  );
  const parts: string[] = [];
  if (isNisaCategory(entry.category)) {
    const utilization = resolveNisaUtilization(entry.nisaUtilization);
    if (utilization === 'active') {
      const principal = resolveNisaPrincipalMan(entry);
      const valuation = calcNisaValuationMan(entry);
      parts.push(`元本 ${formatMan(principal)}万円`);
      parts.push(`評価額 ${formatMan(valuation)}万円`);
    } else {
      parts.push('これから開始');
    }
    const annualRemaining = calcNisaRemainingAnnualQuotaMan(entry);
    const annualLimit = getNisaAnnualLimitMan(entry.category);
    parts.push(
      `年枠残 ${formatMan(annualRemaining)}/${formatMan(annualLimit)}万`,
    );
    const lifetime = calcNisaLifetimeQuotaWithEntry(memberEntries, entry);
    const lifetimeRemaining = getNisaLifetimeRemainingForCategory(
      lifetime,
      entry.category,
    );
    parts.push(`生涯残 ${formatMan(lifetimeRemaining)}万`);
  } else if (isTaxableSavingsCategory(entry.category)) {
    const utilization = resolveTaxableUtilization(entry.taxableUtilization);
    if (utilization === 'active') {
      const principal = resolveTaxablePrincipalMan(entry);
      const valuation = calcTaxableValuationMan(entry);
      parts.push(`元本 ${formatMan(principal)}万円`);
      parts.push(`評価額 ${formatMan(valuation)}万円`);
    } else {
      parts.push('これから開始');
    }
    parts.push(`${rateLabel} ${rate}`);
  } else if (isTimeDepositCategory(entry.category)) {
    const deposit = Math.max(0, Number(entry.balanceMan) || 0);
    const termYears = resolveTimeDepositTermYears(entry);
    const maturity = getTimeDepositMaturity(entry);
    parts.push(`預入 ${formatMan(deposit)}万円`);
    parts.push(`${termYears}年`);
    parts.push(`満期 ${maturity.age}歳${maturity.month}月`);
    parts.push(`${rateLabel} ${rate}`);
  } else if (entry.category === 'db') {
    const withdrawalMode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
    const amount = Math.max(0, Number(entry.withdrawalMan) || 0);
    if (withdrawalMode === 'once') {
      parts.push(`一時金見込 ${formatMan(amount)}万円`);
    } else if (withdrawalMode === 'drawdown') {
      const years = Math.max(
        1,
        Number(entry.withdrawalYears) || SAVINGS_DEFAULT_WITHDRAWAL_YEARS,
      );
      parts.push(`年金見込 月${formatMan(amount)}万円・${years}年`);
    } else {
      parts.push('給付未設定');
    }
    return parts.join(' · ');
  } else if (entry.category === 'dc') {
    const dc = ensureDcContributionFields(entry);
    const balance = Math.max(0, Number(dc.balanceMan) || 0);
    parts.push(`残高 ${formatMan(balance)}万円`);
    parts.push(`${rateLabel} ${rate}`);
    const employerMode = resolveSavingsContributionMode(
      dc.employerContributionMode,
    );
    const employeeMode = resolveSavingsContributionMode(
      dc.employeeContributionMode,
    );
    if (employerMode !== 'none') {
      parts.push(
        `事業主 ${formatMan(dc.employerContributionMan ?? 0)}${SAVINGS_CONTRIBUTION_MODE_UNITS[employerMode]}`,
      );
    }
    if (employeeMode !== 'none') {
      parts.push(
        `選択型 ${formatMan(dc.employeeContributionMan ?? 0)}${SAVINGS_CONTRIBUTION_MODE_UNITS[employeeMode]}`,
      );
    }
    if (employerMode === 'none' && employeeMode === 'none') {
      parts.push('掛金なし');
    }
  } else {
    const balance = Math.max(0, Number(entry.balanceMan) || 0);
    parts.push(`残高 ${formatMan(balance)}万円`);
    parts.push(`${rateLabel} ${rate}`);
  }
  if (
    entry.category !== 'dc' &&
    mode !== 'none' &&
    isInvestSavingsCategory(entry.category)
  ) {
    const amount = Math.max(0, Number(entry.contributionMan) || 0);
    parts.push(
      `積立 ${formatMan(amount)}${SAVINGS_CONTRIBUTION_MODE_UNITS[mode]}`,
    );
  }
  if (
    (isNisaCategory(entry.category) ||
      isTaxableSavingsCategory(entry.category)) &&
    mode === 'none'
  ) {
    if (isNisaCategory(entry.category)) {
      parts.push(`${rateLabel} ${rate}`);
    }
  }
  if (supportsSavingsWithdrawal(entry.category)) {
    const withdrawalMode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
    if (withdrawalMode === 'once') {
      const amount = Math.max(0, Number(entry.withdrawalMan) || 0);
      parts.push(
        isPensionStylePayoutCategory(entry.category)
          ? `一括受取 ${formatMan(amount)}万円`
          : `一括取崩 ${formatMan(amount)}万円`,
      );
    } else if (withdrawalMode === 'drawdown') {
      const years = Math.max(1, Number(entry.withdrawalYears) || SAVINGS_DEFAULT_WITHDRAWAL_YEARS);
      parts.push(
        isPensionStylePayoutCategory(entry.category)
          ? `年金受取 ${years}年`
          : `分割取崩 ${years}年`,
      );
    }
  }
  return parts.join(' · ');
}

function NisaQuotaSummary({
  entry,
  memberEntries,
}: {
  entry: SavingsEntry;
  memberEntries: SavingsEntry[];
}) {
  const annualLimit = getNisaAnnualLimitMan(entry.category);
  const planned = calcPlannedAnnualContributionMan(
    entry.contributionMode,
    entry.contributionMan,
  );
  const annualRemaining = calcNisaRemainingAnnualQuotaMan(entry);
  const overAnnual = isNisaAnnualContributionOverLimit(entry);
  const lifetime = calcNisaLifetimeQuotaWithEntry(memberEntries, entry);
  const overLifetime =
    lifetime.usedTotalMan > NISA_LIFETIME_LIMIT_MAN ||
    lifetime.usedGrowthMan > NISA_GROWTH_LIFETIME_LIMIT_MAN;

  return (
    <div className="savings-nisa-quota-summary">
      <div className="savings-nisa-quota-group">
        <div className="savings-nisa-quota-group-title">年間投資枠</div>
        <div className="savings-nisa-quota-row">
          <span>年間上限</span>
          <strong>{formatMan(annualLimit)}万円</strong>
        </div>
        <div className="savings-nisa-quota-row">
          <span>年間積立予定</span>
          <strong>{formatMan(planned)}万円</strong>
        </div>
        <div className="savings-nisa-quota-row">
          <span>年間の残り</span>
          <strong className={overAnnual ? 'savings-nisa-quota-over' : undefined}>
            {formatMan(annualRemaining)}万円
          </strong>
        </div>
        {overAnnual ? (
          <p className="savings-entry-detail-hint savings-nisa-quota-warning">
            積立予定が年間上限を超えています。試算では年間上限までしか買い付けません。
          </p>
        ) : null}
      </div>

      <div className="savings-nisa-quota-group">
        <div className="savings-nisa-quota-group-title">
          生涯の非課税枠（簿価＝投資元本）
        </div>
        <div className="savings-nisa-quota-row">
          <span>つみたて投資枠の残り</span>
          <strong
            className={overLifetime ? 'savings-nisa-quota-over' : undefined}
          >
            {formatMan(lifetime.remainingTsumitateMan)}万円
          </strong>
        </div>
        <div className="savings-nisa-quota-row">
          <span>成長投資枠の残り</span>
          <strong
            className={overLifetime ? 'savings-nisa-quota-over' : undefined}
          >
            {formatMan(lifetime.remainingGrowthMan)}万円
          </strong>
        </div>
        {overLifetime ? (
          <p className="savings-entry-detail-hint savings-nisa-quota-warning">
            投資元本が生涯の非課税枠を超えています。元本の入力を確認してください。
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatIdecoCorporateDcLimitHint(
  employerDcMonthlyYen: number,
  hasDb: boolean,
  dbOtherSystemMonthlyYen: number,
): string {
  const residualParts = [
    '5.5万円',
    employerDcMonthlyYen > 0
      ? `事業主掛金 ${formatIdecoYen(employerDcMonthlyYen)}`
      : '事業主掛金',
  ];
  if (hasDb) {
    residualParts.push(`DB等月額 ${formatIdecoYen(dbOtherSystemMonthlyYen)}`);
  }
  return `iDeCoの月額上限は、2万円と（${residualParts.join(' − ')}）のうち小さい方です（千円未満切捨て）`;
}

function IdecoLimitPanel({
  entry,
  occupancy,
  occupancyOptions,
  monthlyLimitYen,
  employerDcMonthlyYen,
  dbOtherSystemMonthlyYen,
  showCorporateFlags,
  hasCorporateDc,
  hasDb,
  firstDcEntryId,
  firstDbEntryId,
  onChangeOccupancy,
  onChangeCorporateDc,
  onChangeHasDb,
  onOpenDcAccount,
  onOpenDbAccount,
}: {
  entry: SavingsEntry;
  occupancy: IdecoOccupancy;
  occupancyOptions: IdecoOccupancy[];
  monthlyLimitYen: number;
  employerDcMonthlyYen: number;
  dbOtherSystemMonthlyYen: number;
  showCorporateFlags: boolean;
  hasCorporateDc: boolean;
  hasDb: boolean;
  firstDcEntryId: string | null;
  firstDbEntryId: string | null;
  onChangeOccupancy: (occupancy: IdecoOccupancy) => void;
  onChangeCorporateDc: (enabled: boolean) => void;
  onChangeHasDb: (hasDb: boolean) => void;
  onOpenDcAccount?: () => void;
  onOpenDbAccount?: () => void;
}) {
  const overLimit = isIdecoContributionOverLimit(entry, monthlyLimitYen);
  const annualLimitYen = monthlyLimitYen * 12;
  const options =
    occupancyOptions.includes(occupancy)
      ? occupancyOptions
      : [occupancy, ...occupancyOptions];

  const corporatePensionHelp = hasCorporateDc
    ? hasDb
      ? '企業型DC・DBの詳細は各口座で入力します。口座を開くボタンから移動できます'
      : '企業型DCの残高・積立は「企業型DC」口座で入力します。追加すると事業主掛金との残余で iDeCo 上限が決まります（最大月2万円）'
    : hasDb
      ? 'DBの給付見込みは「DB（確定給付）」口座で入力します。ありにすると口座を作成し、他制度掛金相当額を差し引いて上限を計算します'
      : '企業型DCを追加すると事業主掛金との残余で iDeCo 上限が決まります（最大月2万円・口座を作成）。DBありにすると給付見込み口座を作成します';

  return (
    <>
      <LoanSettingsField
        label="加入区分"
        help="Q7の職歴に合わせて選択。積立期間は選んだ区分の収入期間に自動反映されます"
      >
        <div className="savings-ideco-occupancy">
          <select
            className="select-input savings-ideco-occupancy-select"
            value={occupancy}
            aria-label="iDeCo加入区分"
            onChange={(e) =>
              onChangeOccupancy(e.target.value as IdecoOccupancy)
            }
          >
            {options.map((occ) => (
              <option key={occ} value={occ}>
                {IDECO_OCCUPANCY_LABELS[occ]}
              </option>
            ))}
          </select>
        </div>
      </LoanSettingsField>

      {showCorporateFlags ? (
        <LoanSettingsField label="企業年金の加入" help={corporatePensionHelp}>
          <div className="savings-ideco-pension-flags">
            <label className="savings-ideco-flag">
              <span>企業型DC</span>
              <select
                className="select-input"
                value={hasCorporateDc ? 'yes' : 'no'}
                aria-label="企業型DCの加入"
                onChange={(e) =>
                  onChangeCorporateDc(e.target.value === 'yes')
                }
              >
                <option value="no">なし</option>
                <option value="yes">あり</option>
              </select>
            </label>
            <label className="savings-ideco-flag">
              <span>
                {occupancy === 'civil_servant'
                  ? 'DB等（共済含む）'
                  : 'DB（確定給付）'}
              </span>
              <select
                className="select-input"
                value={hasDb ? 'yes' : 'no'}
                aria-label="DBの加入"
                onChange={(e) => onChangeHasDb(e.target.value === 'yes')}
              >
                <option value="no">なし</option>
                <option value="yes">あり</option>
              </select>
            </label>
          </div>
          {hasCorporateDc && firstDcEntryId && onOpenDcAccount ? (
            <div className="savings-ideco-dc-actions">
              <button
                type="button"
                className="step-action-btn savings-ideco-open-dc-btn"
                onClick={onOpenDcAccount}
              >
                企業型DC口座を開く
              </button>
            </div>
          ) : null}
          {hasDb && firstDbEntryId && onOpenDbAccount ? (
            <div className="savings-ideco-dc-actions">
              <button
                type="button"
                className="step-action-btn savings-ideco-open-dc-btn"
                onClick={onOpenDbAccount}
              >
                DB口座を開く
              </button>
            </div>
          ) : null}
        </LoanSettingsField>
      ) : null}

      <LoanSettingsField
        label="掛金上限"
        help={
          hasCorporateDc
            ? formatIdecoCorporateDcLimitHint(
                employerDcMonthlyYen,
                hasDb,
                dbOtherSystemMonthlyYen,
              )
            : hasDb
              ? '企業年金（DB等）ありの場合、iDeCoの月額上限は最大2万円です。他制度掛金相当額はDB口座で入力します'
              : showCorporateFlags
                ? '企業年金なしの場合、iDeCoの月額上限は2.3万円です'
                : undefined
        }
      >
        <div className="savings-nisa-quota-summary">
          <div className="savings-nisa-quota-group">
            <div className="savings-nisa-quota-row">
              <span>月額上限</span>
              <strong>{formatMan(yenToMan(monthlyLimitYen))}万円</strong>
            </div>
            <div className="savings-nisa-quota-row">
              <span>年額換算</span>
              <strong>{formatMan(yenToMan(annualLimitYen))}万円</strong>
            </div>
            {overLimit ? (
              <p className="savings-entry-detail-hint savings-nisa-quota-warning">
                掛金が上限を超えています。加入区分・企業年金の有無を確認するか、掛金を下げてください。
              </p>
            ) : null}
          </div>
        </div>
      </LoanSettingsField>
    </>
  );
}

export function SavingsEntryDetail({
  entry,
  member,
  memberEntries,
  incomeEntries,
  referenceDate,
  onChange,
  onChangeMemberEntries,
  onRequestExpandEntry,
}: SavingsEntryDetailProps) {
  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const memberAge = resolveMemberAge(member);
  const memberBirthMonth = resolveMemberBirthMonth(member);
  const ageOptions = getVehicleAgeOptions(member);
  const contributionMode = resolveSavingsContributionMode(
    entry.contributionMode,
  );
  const rateFieldLabel = getSavingsRateFieldLabel(entry.category);
  const isNisa = isNisaCategory(entry.category);
  const isTaxable = isTaxableSavingsCategory(entry.category);
  const isTimeDeposit = isTimeDepositCategory(entry.category);
  const isIdeco = isIdecoCategory(entry.category);
  const isDc = entry.category === 'dc';
  const isDb = entry.category === 'db';
  const dcEntry = isDc ? ensureDcContributionFields(entry) : entry;
  const employerContributionMode = resolveSavingsContributionMode(
    dcEntry.employerContributionMode ?? entry.contributionMode,
  );
  const employeeContributionMode = resolveSavingsContributionMode(
    dcEntry.employeeContributionMode,
  );
  const hasDcContribution =
    employerContributionMode !== 'none' || employeeContributionMode !== 'none';
  const isPensionPayout = isPensionStylePayoutCategory(entry.category);
  const idecoDcNow = resolveIdecoDcReferenceNow(member, referenceDate);
  const idecoDcMainFloor = resolveIdecoDcMainContributionStart(
    member,
    referenceDate,
  );
  const idecoContributionStart = {
    age: entry.startAge,
    month: entry.startMonth,
  };
  const pastStartAgeOptions = ageOptions.filter((age) => age <= idecoDcNow.age);
  const pastEndAgeOptions = ageOptions.filter(
    (age) =>
      age <= idecoDcNow.age &&
      age >= (entry.pastStartAge ?? 0),
  );
  const pastStartMonthOptions =
    (entry.pastStartAge ?? idecoDcNow.age) >= idecoDcNow.age
      ? MONTHS.filter((month) => month <= idecoDcNow.month)
      : MONTHS;
  const pastEndMonthOptions = (() => {
    let months = MONTHS;
    if ((entry.pastEndAge ?? idecoDcNow.age) >= idecoDcNow.age) {
      months = months.filter((month) => month <= idecoDcNow.month);
    }
    if (
      (entry.pastEndAge ?? 0) <= (entry.pastStartAge ?? 0)
    ) {
      months = months.filter(
        (month) => month >= (entry.pastStartMonth ?? 1),
      );
    }
    return months;
  })();
  const contributionStartAgeOptions = ageOptions.filter(
    (age) => age >= idecoDcMainFloor.age,
  );
  const contributionStartMonthOptions =
    entry.startAge <= idecoDcMainFloor.age
      ? MONTHS.filter((month) => month >= idecoDcMainFloor.month)
      : MONTHS;
  const idecoOccupancy = isIdeco
    ? resolveEffectiveIdecoOccupancy(
        entry,
        member,
        incomeEntries,
        referenceDate,
      )
    : null;
  const idecoOccupancyOptions = isIdeco
    ? listIdecoOccupancyOptionsFromIncome(member, incomeEntries)
    : [];
  const dcOccupancy = isDc
    ? resolveEffectiveDcOccupancy(entry, member, incomeEntries, referenceDate)
    : null;
  const dcOccupancyOptions = isDc
    ? listDcOccupancyOptionsFromIncome(incomeEntries)
    : [];
  const dbOccupancy = isDb
    ? resolveEffectiveDbOccupancy(entry, member, incomeEntries, referenceDate)
    : null;
  const dbOccupancyOptions = isDb
    ? listDcOccupancyOptionsFromIncome(incomeEntries)
    : [];
  const memberHasDc = memberHasCorporateDcEntry(memberEntries);
  const memberHasDb = memberHasDbEntry(memberEntries);
  const firstDcEntryId =
    memberEntries.find((e) => e.category === 'dc')?.id ?? null;
  const firstDbEntryId =
    memberEntries.find((e) => e.category === 'db')?.id ?? null;
  const idecoFlags =
    isIdeco && idecoOccupancy
      ? resolveIdecoCorporatePensionFlags(
          entry,
          idecoOccupancy,
          memberHasDc,
          memberHasDb,
        )
      : null;
  const corporateDcMonthly = calcMemberCorporateDcMonthlyYen(memberEntries);
  const dbOtherSystemMonthlyYen =
    calcMemberDbOtherSystemMonthlyYen(memberEntries);
  const corporateDcCeilingYen = resolveCorporateDcCombinedCeilingYen(
    memberHasDb,
    dbOtherSystemMonthlyYen,
  );
  const corporateDcOverCeiling = isCorporateDcContributionOverCeiling(
    corporateDcMonthly,
    memberHasDb,
    dbOtherSystemMonthlyYen,
  );
  const idecoMonthlyLimitYen =
    isIdeco && idecoOccupancy && idecoFlags
      ? resolveIdecoMonthlyLimitYen(idecoOccupancy, idecoFlags, {
          employerDcMonthlyYen: corporateDcMonthly.employerYen,
          dbOtherSystemMonthlyYen,
        })
      : 0;
  const idecoEndCap =
    isIdeco && idecoOccupancy
      ? resolveIdecoContributionEndCap(idecoOccupancy, member, {
          incomeEntries,
          referenceDate,
          startAge: idecoContributionStart.age,
          startMonth: idecoContributionStart.month,
        })
      : null;
  const dcEndCap =
    isDc && dcOccupancy
      ? resolveDcContributionEndCap(member, {
          incomeEntries,
          referenceDate,
          startAge: entry.startAge,
          startMonth: entry.startMonth,
          occupancy: dcOccupancy,
        })
      : null;
  const contributionEndCap = idecoEndCap ?? dcEndCap;
  const contributionEndAgeOptions = contributionEndCap
    ? ageOptions.filter(
        (age) =>
          age <= contributionEndCap.endAge &&
          (!(isIdeco || isDc) || age >= entry.startAge),
      )
    : isIdeco || isDc
      ? ageOptions.filter((age) => age >= entry.startAge)
      : ageOptions;
  const contributionEndMonthOptions = (() => {
    let months = MONTHS;
    if (contributionEndCap && entry.endAge >= contributionEndCap.endAge) {
      months = months.filter((month) => month <= contributionEndCap.endMonth);
    }
    if ((isIdeco || isDc) && entry.endAge <= entry.startAge) {
      months = months.filter((month) => month >= entry.startMonth);
    }
    return months;
  })();
  const canWithdraw = supportsSavingsWithdrawal(entry.category);
  /** iDeCo / 企業型DC は一生涯積立不可 */
  const blocksLifetimeContribution = isIdeco || isDc;

  useEffect(() => {
    if (!isIdeco || !idecoOccupancy) return;
    let withPeriod = clampIdecoContributionPeriod(
      entry,
      member,
      idecoOccupancy,
      incomeEntries,
      referenceDate,
    );
    withPeriod = syncIdecoDcPastContributionPeriods(
      withPeriod,
      member,
      referenceDate,
    );
    const payoutMode = resolveSavingsWithdrawalMode(withPeriod.withdrawalMode);
    let assetsMan: number | undefined;
    if (payoutMode !== 'none') {
      const start = resolveIdecoPayoutStart(withPeriod, member, {
        age: withPeriod.withdrawalStartAge ?? memberAge,
        month: withPeriod.withdrawalStartMonth ?? 1,
      });
      assetsMan = Math.round(
        estimateInvestBalanceManAt({
          entry: withPeriod,
          member,
          memberEntries,
          referenceDate,
          targetAge: start.age,
          targetMonth: start.month,
        }),
      );
    }
    const clamped = ensureIdecoFields(withPeriod, {
      member,
      occupancy: idecoOccupancy,
      assetsMan,
      incomeEntries,
      referenceDate,
    });
    const flags = resolveIdecoCorporatePensionFlags(
      clamped,
      idecoOccupancy,
      memberHasCorporateDcEntry(memberEntries),
      memberHasDbEntry(memberEntries),
    );
    const limited = clampIdecoContributionToLimit(
      clamped,
      idecoOccupancy,
      flags,
      {
        employerDcMonthlyYen: corporateDcMonthly.employerYen,
        dbOtherSystemMonthlyYen,
      },
    );
    if (limited !== entry) {
      onChange(limited);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ideco normalize 専用
  }, [
    isIdeco,
    idecoOccupancy,
    member.birthMonth,
    memberAge,
    entry.id,
    entry.endMode,
    entry.endAge,
    entry.endMonth,
    entry.withdrawalMode,
    entry.contributionMan,
    entry.contributionMode,
    entry.balanceMan,
    entry.expectedReturnRatePct,
    entry.startAge,
    entry.startMonth,
    entry.withdrawalStartAge,
    entry.withdrawalStartMonth,
    incomeEntries,
    corporateDcMonthly.employerYen,
    dbOtherSystemMonthlyYen,
  ]);

  useEffect(() => {
    if (!isDc && !isDb) return;
    let withPeriod = isDc
      ? clampDcContributionPeriod(
          entry,
          member,
          incomeEntries,
          referenceDate,
        )
      : ensureDbEnrollmentFields(entry, member, {
          incomeEntries,
          referenceDate,
        });
    if (isDc) {
      withPeriod = syncIdecoDcPastContributionPeriods(
        withPeriod,
        member,
        referenceDate,
      );
    }
    const payoutMode = resolveSavingsWithdrawalMode(withPeriod.withdrawalMode);
    let assetsMan: number | undefined;
    if (isDc && payoutMode !== 'none') {
      const start = resolvePensionPayoutStart(withPeriod, member, {
        age: withPeriod.withdrawalStartAge ?? memberAge,
        month: withPeriod.withdrawalStartMonth ?? 1,
      });
      assetsMan = Math.round(
        estimateInvestBalanceManAt({
          entry: withPeriod,
          member,
          memberEntries,
          referenceDate,
          targetAge: start.age,
          targetMonth: start.month,
        }),
      );
    }
    const clamped = clampPensionPayoutFields(withPeriod, member, assetsMan);
    if (dcDbNormalizeNeedsWrite(entry, clamped)) {
      onChange(clamped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dc/db period + payout normalize
  }, [
    isDc,
    isDb,
    member.birthMonth,
    entry.id,
    entry.endMode,
    entry.endAge,
    entry.endMonth,
    entry.startAge,
    entry.startMonth,
    entry.withdrawalMode,
    entry.withdrawalMan,
    entry.withdrawalStartAge,
    entry.withdrawalStartMonth,
    entry.withdrawalYears,
    entry.withdrawalEndAge,
    entry.withdrawalEndMonth,
    entry.idecoAnnuityPeriodMode,
    entry.balanceMan,
    entry.contributionMan,
    entry.contributionMode,
    entry.expectedReturnRatePct,
    entry.pastContributionEnabled,
    entry.pastContributionInputMode,
    entry.pastContributionMan,
    entry.pastBalanceMan,
    entry.pastStartAge,
    entry.pastStartMonth,
    entry.pastEndAge,
    entry.pastEndMonth,
    entry.pastExpectedReturnRatePct,
    entry.pastContributionSegments,
    entry.employerContributionMode,
    entry.employerContributionMan,
    entry.employeeContributionMode,
    entry.employeeContributionMan,
    entry.dcOccupancy,
    entry.dbEnrollmentMode,
    entry.dbEnrollmentYears,
    entry.dbEnrollmentStartAge,
    entry.dbEnrollmentStartMonth,
    entry.dbEnrollmentEndAge,
    entry.dbEnrollmentEndMonth,
    entry.dbOccupancy,
    entry.dbEarlyExitMode,
    entry.transferBalanceToIdecoOnEnd,
    incomeEntries,
  ]);

  const showDcIdecoTransfer = isDc && needsDcIdecoTransferOnEnd(entry);
  const showDbEarlyExit = isDb && needsDbEarlyExitChoice(entry, member);
  const dbEarlyExitMode = resolveDbEarlyExitMode(entry.dbEarlyExitMode);
  const dbQualificationEnd = isDb
    ? resolveDbQualificationEnd(entry, member)
    : null;
  const dbEndCap =
    isDb && resolveDbEnrollmentMode(entry.dbEnrollmentMode) === 'period'
      ? resolveDbEnrollmentEndCap(
          entry,
          member,
          incomeEntries,
          referenceDate,
        )
      : null;
  const dbEnrollmentEndAgeOptions = (() => {
    if (!dbEndCap) return ageOptions;
    const capped = ageOptions.filter((age) => age <= dbEndCap.endAge);
    const current = entry.dbEnrollmentEndAge ?? memberAge;
    if (capped.includes(current)) return capped;
    return [...capped, current].sort((a, b) => a - b);
  })();

  const withdrawalMode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
  const pensionPayoutMonth = isPensionPayout ? member.birthMonth || 1 : 1;
  const pensionPayoutStart = isPensionPayout
    ? resolvePensionPayoutStart(entry, member, {
        age: entry.withdrawalStartAge ?? memberAge,
        month: entry.withdrawalStartMonth ?? pensionPayoutMonth,
      })
    : null;
  const withdrawalStartAge =
    pensionPayoutStart?.age ?? entry.withdrawalStartAge ?? memberAge;
  // 一時金も resolve 後の月を使う（誕生日月固定だと拠出終了より前になり重複判定が歪む）
  const withdrawalStartMonth = isPensionPayout
    ? (pensionPayoutStart?.month ?? pensionPayoutMonth)
    : (entry.withdrawalStartMonth ?? 1);
  const withdrawalYears = resolveWithdrawalYears(entry, member);
  const nisaUtilization = resolveNisaUtilization(entry.nisaUtilization);
  const nisaValuationMode = resolveNisaValuationMode(entry.nisaValuationMode);
  const nisaValuation = calcNisaValuationMan(entry);
  const taxableUtilization = resolveTaxableUtilization(entry.taxableUtilization);
  const taxableValuation = calcTaxableValuationMan(entry);
  const nisaFillEstimate = isNisa
    ? estimateNisaQuotaFill(entry, memberEntries, member)
    : null;
  const nisaFillPoint =
    nisaFillEstimate?.fillAge != null && nisaFillEstimate.fillMonth != null
      ? { age: nisaFillEstimate.fillAge, month: nisaFillEstimate.fillMonth }
      : null;
  const timeDepositTermYears = resolveTimeDepositTermYears(entry);
  const timeDepositMaturity = isTimeDeposit
    ? getTimeDepositMaturity(entry)
    : null;
  const timeDepositProceeds = isTimeDeposit
    ? calcTimeDepositMaturityProceedsFromEntry(entry)
    : null;
  const estimatedAssetsAtWithdrawal = Math.round(
    estimateInvestBalanceManAt({
      entry,
      member,
      memberEntries,
      referenceDate,
      targetAge: withdrawalStartAge,
      targetMonth: withdrawalStartMonth,
    }),
  );
  const drawdownAmounts = calcDrawdownAmounts(
    estimatedAssetsAtWithdrawal,
    withdrawalYears,
  );
  const update = (patch: Partial<SavingsEntry>) => {
    let next: SavingsEntry = { ...entry, ...patch };
    const nextMode = resolveSavingsWithdrawalMode(next.withdrawalMode);
    if (canWithdraw && !isPensionPayout && nextMode === 'drawdown') {
      const startAge = next.withdrawalStartAge ?? memberAge;
      const startMonth = next.withdrawalStartMonth ?? 1;
      const years = resolveWithdrawalYears(next, member);
      const assets = Math.round(
        estimateInvestBalanceManAt({
          entry: next,
          member,
          memberEntries,
          referenceDate,
          targetAge: startAge,
          targetMonth: startMonth,
        }),
      );
      const amounts = calcDrawdownAmounts(assets, years);
      const end = withdrawalEndFromYears(startAge, startMonth, years);
      next = {
        ...next,
        withdrawalMode: 'drawdown',
        withdrawalMan: amounts.monthlyMan,
        withdrawalYears: years,
        withdrawalEndMode: 'until',
        withdrawalEndAge: end.age,
        withdrawalEndMonth: end.month,
      };
    }
    if (isNisa) {
      onChange(ensureNisaFields(next));
      return;
    }
    if (isTaxable) {
      onChange(ensureTaxableFields(next));
      return;
    }
    if (isTimeDeposit) {
      onChange(ensureTimeDepositFields(next));
      return;
    }
    if (isIdeco) {
      const occupancy =
        idecoOccupancy ??
        resolveEffectiveIdecoOccupancy(
          next,
          member,
          incomeEntries,
          referenceDate,
        );
      let withPeriod = clampIdecoContributionPeriod(
        next,
        member,
        occupancy,
        incomeEntries,
        referenceDate,
      );
      withPeriod = syncIdecoDcPastContributionPeriods(
        withPeriod,
        member,
        referenceDate,
      );
      const payoutMode = resolveSavingsWithdrawalMode(
        withPeriod.withdrawalMode,
      );
      let assetsMan: number | undefined;
      if (payoutMode !== 'none') {
        const start = resolveIdecoPayoutStart(withPeriod, member, {
          age: withPeriod.withdrawalStartAge ?? memberAge,
          month: withPeriod.withdrawalStartMonth ?? 1,
        });
        assetsMan = Math.round(
          estimateInvestBalanceManAt({
            entry: withPeriod,
            member,
            memberEntries,
            referenceDate,
            targetAge: start.age,
            targetMonth: start.month,
          }),
        );
      }
      onChange(
        ensureIdecoFields(withPeriod, {
          member,
          occupancy,
          assetsMan,
          incomeEntries,
          referenceDate,
        }),
      );
      return;
    }
    if (isDc) {
      let withPeriod = clampDcContributionPeriod(
        next,
        member,
        incomeEntries,
        referenceDate,
      );
      withPeriod = syncIdecoDcPastContributionPeriods(
        withPeriod,
        member,
        referenceDate,
      );
      onChange(
        canWithdraw
          ? ensureSavingsWithdrawalFields(withPeriod)
          : withPeriod,
      );
      return;
    }
    if (isDb) {
      onChange(ensureDbEnrollmentFields(next, member));
      return;
    }
    onChange(
      canWithdraw ? ensureSavingsWithdrawalFields(next) : next,
    );
  };

  useEffect(() => {
    if (!isDc) return;
    if (showDcIdecoTransfer) return;
    if (!entry.transferBalanceToIdecoOnEnd) return;
    update({ transferBalanceToIdecoOnEnd: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear obsolete transfer flag
  }, [isDc, showDcIdecoTransfer, entry.transferBalanceToIdecoOnEnd, entry.id]);

  useEffect(() => {
    if (!isDb) return;
    if (showDbEarlyExit) return;
    if (entry.dbEarlyExitMode == null || entry.dbEarlyExitMode === 'defer') {
      return;
    }
    update({ dbEarlyExitMode: 'defer' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear obsolete early-exit mode
  }, [isDb, showDbEarlyExit, entry.dbEarlyExitMode, entry.id]);

  const dcPastSegments: SavingsPastContributionSegment[] = isDc
    ? migrateDcScalarPastToSegments(entry)
    : [];

  const dcPastDefaults = {
    expectedReturnRatePct:
      entry.pastExpectedReturnRatePct ?? entry.expectedReturnRatePct,
    contributionMan: Math.max(
      0,
      (Number(entry.employerContributionMan ?? entry.contributionMan) || 0) +
        (Number(entry.employeeContributionMan) || 0),
    ),
  };

  const updateDcPastSegments = (
    segments: SavingsPastContributionSegment[],
  ) => {
    update({ pastContributionSegments: segments });
  };

  const patchDcPastSegment = (
    segmentId: string,
    patch: Partial<SavingsPastContributionSegment>,
  ) => {
    updateDcPastSegments(
      dcPastSegments.map((seg) =>
        seg.id === segmentId ? { ...seg, ...patch } : seg,
      ),
    );
  };

  const addDcPastSegment = () => {
    updateDcPastSegments(
      appendDcPastContributionSegment(
        dcPastSegments,
        idecoDcNow,
        dcPastDefaults,
      ),
    );
  };

  const removeDcPastSegment = (segmentId: string) => {
    if (dcPastSegments.length <= 1) return;
    updateDcPastSegments(dcPastSegments.filter((seg) => seg.id !== segmentId));
  };

  const applyDcPastSegmentsFromIncome = () => {
    if (
      dcPastSegments.length > 0 &&
      !window.confirm(
        '職歴から期間を提案すると、現在の過去区間は置き換わります。よろしいですか？',
      )
    ) {
      return;
    }
    const suggested = suggestDcPastSegmentsFromIncome(
      incomeEntries,
      member,
      referenceDate,
      dcPastDefaults,
    );
    if (suggested.length === 0) {
      window.alert(
        'Q7に会社員・パート等の過去期間がありません。手入力で区間を追加してください。',
      );
      return;
    }
    updateDcPastSegments(suggested);
  };

  const dcPastEnrollmentYears =
    resolveDcPastEnrollmentYearsFromSegments(dcPastSegments);

  const setDcPastEnrollmentYears = (years: number) => {
    updateDcPastSegments(
      buildDcPastSegmentsFromEnrollmentYears({
        years,
        now: idecoDcNow,
        birthMonth: memberBirthMonth,
        expectedReturnRatePct: dcPastDefaults.expectedReturnRatePct,
        contributionMan: dcPastDefaults.contributionMan,
      }),
    );
  };

  const handleDcPastInputModeChange = (mode: 'amount' | 'balance') => {
    if (mode === 'balance') {
      const years = Math.max(
        1,
        resolveDcPastEnrollmentYearsFromSegments(dcPastSegments),
      );
      update({
        pastContributionInputMode: 'balance',
        pastContributionSegments: buildDcPastSegmentsFromEnrollmentYears({
          years,
          now: idecoDcNow,
          birthMonth: memberBirthMonth,
          expectedReturnRatePct: dcPastDefaults.expectedReturnRatePct,
          contributionMan: dcPastDefaults.contributionMan,
        }),
      });
      return;
    }
    update({ pastContributionInputMode: 'amount' });
  };

  const handleWithdrawalModeChange = (
    mode: 'none' | 'once' | 'drawdown',
  ) => {
    if (mode === 'none') {
      update({
        withdrawalMode: 'none',
        withdrawalMan: 0,
        withdrawalYears: undefined,
      });
      return;
    }
    const previousMode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
    const suggested = suggestWithdrawalStart(entry, member, nisaFillPoint);
    const isFirstEnable = previousMode === 'none';
    const targetAge = isFirstEnable
      ? suggested.age
      : (entry.withdrawalStartAge ?? suggested.age);
    const targetMonth = isFirstEnable
      ? suggested.month
      : (entry.withdrawalStartMonth ?? suggested.month);
    const years = isFirstEnable
      ? Math.min(
          SAVINGS_DEFAULT_WITHDRAWAL_YEARS,
          Math.max(1, member.expectedLifespan - targetAge),
        )
      : resolveWithdrawalYears(entry, member);
    applyWithdrawalTiming(mode, targetAge, targetMonth, years);
  };
  const applyWithdrawalTiming = (
    mode: 'once' | 'drawdown',
    startAge: number,
    startMonth: number,
    years: number,
  ) => {
    const resolvedMonth =
      mode === 'once' ? member.birthMonth || 1 : startMonth;
    const assets = Math.round(
      estimateInvestBalanceManAt({
        entry,
        member,
        memberEntries,
        referenceDate,
        targetAge: startAge,
        targetMonth: resolvedMonth,
      }),
    );
    if (mode === 'once') {
      update({
        withdrawalMode: 'once',
        withdrawalMan: assets,
        withdrawalStartAge: startAge,
        withdrawalStartMonth: resolvedMonth,
        withdrawalYears: undefined,
        withdrawalEndMode: 'until',
        withdrawalEndAge: startAge,
        withdrawalEndMonth: resolvedMonth,
      });
      return;
    }
    update({
      withdrawalMode: 'drawdown',
      withdrawalYears: years,
      withdrawalStartAge: startAge,
      withdrawalStartMonth: resolvedMonth,
    });
  };
  const handleIdecoPayoutModeChange = (mode: 'once' | 'drawdown') => {
    const previousMode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
    const suggested = resolvePensionPayoutStart(entry, member);
    const isFirstEnable = previousMode === 'none';
    const payoutMonth = member.birthMonth || 1;
    const start = isFirstEnable
      ? suggested
      : resolvePensionPayoutStart(entry, member, {
          age: entry.withdrawalStartAge ?? suggested.age,
          month: payoutMonth,
        });
    if (isDb) {
      const amount = Math.max(0, Number(entry.withdrawalMan) || 0);
      if (mode === 'once') {
        update({
          withdrawalMode: 'once',
          withdrawalMan: amount,
          withdrawalStartAge: start.age,
          withdrawalStartMonth: payoutMonth,
        });
        return;
      }
      update({
        withdrawalMode: 'drawdown',
        idecoAnnuityPeriodMode: entry.idecoAnnuityPeriodMode ?? 'years',
        withdrawalYears: resolveIdecoAnnuityYears(entry),
        withdrawalStartAge: start.age,
        withdrawalStartMonth: payoutMonth,
        withdrawalMan: amount,
      });
      return;
    }
    const assets = Math.round(
      estimateInvestBalanceManAt({
        entry,
        member,
        memberEntries,
        referenceDate,
        targetAge: start.age,
        targetMonth: payoutMonth,
      }),
    );
    if (mode === 'once') {
      update({
        withdrawalMode: 'once',
        withdrawalMan: assets,
        withdrawalStartAge: start.age,
        withdrawalStartMonth: payoutMonth,
      });
      return;
    }
    update({
      withdrawalMode: 'drawdown',
      idecoAnnuityPeriodMode: entry.idecoAnnuityPeriodMode ?? 'years',
      withdrawalYears: resolveIdecoAnnuityYears(entry),
      withdrawalStartAge: start.age,
      withdrawalStartMonth: payoutMonth,
      withdrawalMan: calcDrawdownAmounts(
        assets,
        resolveIdecoAnnuityYears(entry),
      ).monthlyMan,
    });
  };
  const idecoAnnuityPeriodMode = resolveIdecoAnnuityPeriodMode(
    entry.idecoAnnuityPeriodMode,
  );
  const pensionEnrollmentFloorAge =
    isIdeco || isDc
      ? resolvePensionEnrollmentPayoutFloorAge(entry, member)
      : null;
  const pensionPayoutFloor = isIdeco || isDc
    ? resolvePensionPayoutStart(entry, member, { age: 0, month: 1 })
    : null;
  const idecoPayoutAgeOptions = isIdeco
    ? getIdecoPayoutAgeOptions(
        pensionPayoutFloor?.age ?? pensionEnrollmentFloorAge ?? undefined,
      )
    : getPensionPayoutAgeOptions(
        member,
        entry.category,
        pensionPayoutFloor?.age ?? pensionEnrollmentFloorAge ?? undefined,
      );
  const enrollmentYearsAtFloor =
    isIdeco || isDc
      ? calcPensionEnrollmentYearsAsOf(entry, {
          age: pensionEnrollmentFloorAge ?? IDECO_PAYOUT_MIN_AGE,
          month: memberBirthMonth,
        })
      : null;
  const idecoAnnuityYears = resolveIdecoAnnuityYears(entry);
  const idecoPayoutEndAge =
    entry.withdrawalEndAge ??
    withdrawalEndFromYears(
      withdrawalStartAge,
      withdrawalStartMonth,
      idecoAnnuityYears,
    ).age;
  const idecoPayoutEndMonth =
    idecoAnnuityPeriodMode === 'until_age'
      ? pensionPayoutMonth
      : (entry.withdrawalEndMonth ??
        withdrawalEndFromYears(
          withdrawalStartAge,
          withdrawalStartMonth,
          idecoAnnuityYears,
        ).month);
  const idecoAnnuityMonths = calcInclusiveMonthCount(
    withdrawalStartAge,
    withdrawalStartMonth,
    idecoPayoutEndAge,
    idecoPayoutEndMonth,
  );
  const idecoAnnuityAmounts = isDb
    ? {
        monthlyMan: Math.max(0, Number(entry.withdrawalMan) || 0),
        annualMan: Math.round(
          Math.max(0, Number(entry.withdrawalMan) || 0) * 12,
        ),
        years: idecoAnnuityYears,
      }
    : idecoAnnuityPeriodMode === 'until_age'
      ? calcMonthlyDrawdownFromMonths(
          estimatedAssetsAtWithdrawal,
          idecoAnnuityMonths,
        )
      : calcDrawdownAmounts(estimatedAssetsAtWithdrawal, idecoAnnuityYears);
  const idecoEnrollmentYears = calcPensionRetirementDeductionEnrollmentYears(
    entry,
    member,
    { age: withdrawalStartAge, month: withdrawalStartMonth },
  );
  // 一括の税基は残高見込み（税引前）。表示の「一括受取額」は税引後手取り。
  const idecoLumpSumMan =
    isPensionPayout && withdrawalMode === 'once'
      ? isDb
        ? Math.max(0, Number(entry.withdrawalMan) || 0)
        : estimatedAssetsAtWithdrawal
      : 0;
  const idecoLumpSumTaxOverlap =
    isPensionPayout && withdrawalMode === 'once' && idecoLumpSumMan > 0
      ? previewPensionOnceTaxWithOverlap({
          entry,
          member,
          incomeEntries,
          memberEntries,
          referenceDate,
          revenueMan: idecoLumpSumMan,
          payoutStart: {
            age: withdrawalStartAge,
            month: withdrawalStartMonth,
          },
        })
      : null;
  const idecoLumpSumTax =
    idecoLumpSumTaxOverlap?.breakdown ??
    (isPensionPayout && withdrawalMode === 'once'
      ? calcRetirementIncomeTaxBreakdown(
          idecoLumpSumMan * 10_000,
          idecoEnrollmentYears,
        )
      : null);
  const idecoLumpSumNetMan = calcRetirementLumpNetMan(
    idecoLumpSumMan,
    idecoLumpSumTax,
  );
  const idecoCompletionAgeOptions = Array.from(
    {
      length: Math.max(
        0,
        member.expectedLifespan - withdrawalStartAge,
      ),
    },
    (_, i) => withdrawalStartAge + 1 + i,
  ).filter((age) => age > withdrawalStartAge);
  const overlapKind = canWithdraw
    ? getContributionWithdrawalOverlapKind(entry, member, nisaFillPoint)
    : 'none';
  const overlapWarning =
    overlapKind === 'overlap'
      ? isPensionPayout
        ? '積立（拠出）期間と受取期間が重なっています。通常は拠出終了の翌月以降に受取を開始します。'
        : isNisa && entry.endMode === 'lifetime'
          ? '積立（枠が埋まるまで）の見込み期間と取崩期間が重なっています。通常は枠埋まり後に取崩しを開始します。'
          : '積立期間と取崩期間が重なっています。通常は積立終了の翌月以降に取崩しを開始します。'
      : null;
  const handleNisaUtilizationChange = (utilization: NisaUtilization) => {
    update({
      nisaUtilization: utilization,
      principalMan: utilization === 'active' ? entry.principalMan ?? 0 : 0,
      gainsMan: utilization === 'active' ? entry.gainsMan ?? 0 : 0,
    });
  };
  const handleTaxableUtilizationChange = (utilization: TaxableUtilization) => {
    update({
      taxableUtilization: utilization,
      principalMan: utilization === 'active' ? entry.principalMan ?? 0 : 0,
      gainsMan: utilization === 'active' ? entry.gainsMan ?? 0 : 0,
    });
  };
  const handleNisaValuationModeChange = (mode: NisaValuationMode) => {
    update({
      nisaValuationMode: mode,
      gainsMan: mode === 'gains' ? entry.gainsMan ?? 0 : 0,
      nisaCurrentReturnRatePct:
        mode === 'rate' ? entry.nisaCurrentReturnRatePct ?? 0 : 0,
    });
  };
  return (
    <div className="savings-entry-detail">
      <div className="loan-settings-table-card">
        <div className="loan-settings-form-table">
          <LoanSettingsField label="種類">
            <span className="savings-entry-detail-value">
              {SAVINGS_CATEGORY_LABELS[entry.category]}
            </span>
          </LoanSettingsField>
          <LoanSettingsField label="名称" labelFor={`sav-name-${entry.id}`}>
            <input
              id={`sav-name-${entry.id}`}
              type="text"
              className="text-input"
              value={entry.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </LoanSettingsField>
          {isNisa ? (
            <>
              <LoanSettingsField label="NISAの状況">
                <select
                  className="select-input"
                  value={nisaUtilization}
                  aria-label="NISAの活用状況"
                  onChange={(e) =>
                    handleNisaUtilizationChange(
                      e.target.value as NisaUtilization,
                    )
                  }
                >
                  {(Object.keys(NISA_UTILIZATION_LABELS) as NisaUtilization[]).map(
                    (value) => (
                      <option key={value} value={value}>
                        {NISA_UTILIZATION_LABELS[value]}
                      </option>
                    ),
                  )}
                </select>
              </LoanSettingsField>
              {nisaUtilization === 'active' ? (
                <>
                  <LoanSettingsField
                    label="投資元本"
                    labelFor={`sav-principal-${entry.id}`}
                    help="これまでの買付累計（簿価）。生涯の非課税枠の使用済みとして集計します"
                  >
                    <div className="life-event-amount-field">
                      <input
                        id={`sav-principal-${entry.id}`}
                        type="number"
                        className="amount-input"
                        value={entry.principalMan ?? 0}
                        min={0}
                        step={1}
                        onChange={(e) =>
                          update({
                            principalMan: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="amount-unit">万円</span>
                    </div>
                  </LoanSettingsField>
                  <LoanSettingsField label="評価額の入力">
                    <select
                      className="select-input"
                      value={nisaValuationMode}
                      aria-label="評価額の入力方法"
                      onChange={(e) =>
                        handleNisaValuationModeChange(
                          e.target.value as NisaValuationMode,
                        )
                      }
                    >
                      {(
                        Object.keys(
                          NISA_VALUATION_MODE_LABELS,
                        ) as NisaValuationMode[]
                      ).map((value) => (
                        <option key={value} value={value}>
                          {NISA_VALUATION_MODE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </LoanSettingsField>
                  {nisaValuationMode === 'gains' ? (
                    <LoanSettingsField
                      label="運用益"
                      labelFor={`sav-gains-${entry.id}`}
                    >
                      <div className="life-event-amount-field">
                        <input
                          id={`sav-gains-${entry.id}`}
                          type="number"
                          className="amount-input"
                          value={entry.gainsMan ?? 0}
                          min={0}
                          step={0.1}
                          onChange={(e) =>
                            update({ gainsMan: Number(e.target.value) || 0 })
                          }
                        />
                        <span className="amount-unit">万円</span>
                      </div>
                    </LoanSettingsField>
                  ) : (
                    <LoanSettingsField
                      label="現在の利回り"
                      labelFor={`sav-current-return-${entry.id}`}
                      help="元本に対する累積利回り（評価額の算出に使用）"
                    >
                      <div className="life-event-amount-field">
                        <input
                          id={`sav-current-return-${entry.id}`}
                          type="number"
                          className="amount-input"
                          value={entry.nisaCurrentReturnRatePct ?? 0}
                          min={0}
                          step={0.1}
                          onChange={(e) =>
                            update({
                              nisaCurrentReturnRatePct:
                                Number(e.target.value) || 0,
                            })
                          }
                        />
                        <span className="amount-unit">%</span>
                      </div>
                    </LoanSettingsField>
                  )}
                  <LoanSettingsField
                    label="現在の評価額"
                    help={
                      nisaValuationMode === 'gains'
                        ? '投資元本＋運用益'
                        : '投資元本＋現在の利回りから算出した運用益'
                    }
                  >
                    <span className="savings-entry-detail-value">
                      {formatMan(nisaValuation)}万円
                    </span>
                  </LoanSettingsField>
                </>
              ) : (
                <LoanSettingsField
                  label="開始時点"
                  help="積立設定に応じて年間枠の残りを表示します"
                >
                  <span className="savings-entry-detail-value">
                    元本・評価額は0万円から開始
                  </span>
                </LoanSettingsField>
              )}
              <LoanSettingsField label="投資枠の残り">
                <NisaQuotaSummary
                  entry={entry}
                  memberEntries={memberEntries}
                />
              </LoanSettingsField>
            </>
          ) : isTaxable ? (
            <>
              <LoanSettingsField label="特定口座の状況">
                <select
                  className="select-input"
                  value={taxableUtilization}
                  aria-label="特定口座の活用状況"
                  onChange={(e) =>
                    handleTaxableUtilizationChange(
                      e.target.value as TaxableUtilization,
                    )
                  }
                >
                  {(
                    Object.keys(NISA_UTILIZATION_LABELS) as TaxableUtilization[]
                  ).map((value) => (
                    <option key={value} value={value}>
                      {NISA_UTILIZATION_LABELS[value]}
                    </option>
                  ))}
                </select>
              </LoanSettingsField>
              {taxableUtilization === 'active' ? (
                <>
                  <LoanSettingsField
                    label="投資元本"
                    labelFor={`sav-principal-${entry.id}`}
                    help="これまでの買付累計（簿価）。売却益税の原価に使います"
                  >
                    <div className="life-event-amount-field">
                      <input
                        id={`sav-principal-${entry.id}`}
                        type="number"
                        className="amount-input"
                        value={entry.principalMan ?? 0}
                        min={0}
                        step={1}
                        onChange={(e) =>
                          update({
                            principalMan: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="amount-unit">万円</span>
                    </div>
                  </LoanSettingsField>
                  <LoanSettingsField label="評価額の入力">
                    <select
                      className="select-input"
                      value={nisaValuationMode}
                      aria-label="評価額の入力方法"
                      onChange={(e) =>
                        handleNisaValuationModeChange(
                          e.target.value as NisaValuationMode,
                        )
                      }
                    >
                      {(
                        Object.keys(
                          NISA_VALUATION_MODE_LABELS,
                        ) as NisaValuationMode[]
                      ).map((value) => (
                        <option key={value} value={value}>
                          {NISA_VALUATION_MODE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </LoanSettingsField>
                  {nisaValuationMode === 'gains' ? (
                    <LoanSettingsField
                      label="運用益"
                      labelFor={`sav-gains-${entry.id}`}
                    >
                      <div className="life-event-amount-field">
                        <input
                          id={`sav-gains-${entry.id}`}
                          type="number"
                          className="amount-input"
                          value={entry.gainsMan ?? 0}
                          min={0}
                          step={0.1}
                          onChange={(e) =>
                            update({ gainsMan: Number(e.target.value) || 0 })
                          }
                        />
                        <span className="amount-unit">万円</span>
                      </div>
                    </LoanSettingsField>
                  ) : (
                    <LoanSettingsField
                      label="現在の利回り"
                      labelFor={`sav-current-return-${entry.id}`}
                      help="元本に対する累積利回り（評価額の算出に使用）"
                    >
                      <div className="life-event-amount-field">
                        <input
                          id={`sav-current-return-${entry.id}`}
                          type="number"
                          className="amount-input"
                          value={entry.nisaCurrentReturnRatePct ?? 0}
                          min={0}
                          step={0.1}
                          onChange={(e) =>
                            update({
                              nisaCurrentReturnRatePct:
                                Number(e.target.value) || 0,
                            })
                          }
                        />
                        <span className="amount-unit">%</span>
                      </div>
                    </LoanSettingsField>
                  )}
                  <LoanSettingsField
                    label="現在の評価額"
                    help={
                      nisaValuationMode === 'gains'
                        ? '投資元本＋運用益'
                        : '投資元本＋現在の利回りから算出した運用益'
                    }
                  >
                    <span className="savings-entry-detail-value">
                      {formatMan(taxableValuation)}万円
                    </span>
                  </LoanSettingsField>
                </>
              ) : (
                <LoanSettingsField
                  label="開始時点"
                  help="積立と想定利回りで残高が増えます。取崩し時に売却益へ課税します"
                >
                  <span className="savings-entry-detail-value">
                    元本・評価額は0万円から開始
                  </span>
                </LoanSettingsField>
              )}
            </>
          ) : isTimeDeposit ? (
            <>
              <LoanSettingsField
                label="預入金額"
                labelFor={`sav-balance-${entry.id}`}
              >
                <div className="life-event-amount-field">
                  <input
                    id={`sav-balance-${entry.id}`}
                    type="number"
                    className="amount-input"
                    value={entry.balanceMan}
                    min={0}
                    step={1}
                    onChange={(e) =>
                      update({ balanceMan: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="amount-unit">万円</span>
                </div>
              </LoanSettingsField>
              <LoanSettingsField label="預入開始">
                <div className="savings-period-fields">
                  <div className="savings-period-start">
                    <select
                      className="select-input"
                      value={entry.startAge}
                      aria-label="預入開始年齢"
                      onChange={(e) =>
                        update({ startAge: Number(e.target.value) })
                      }
                    >
                      {ageOptions.map((age) => (
                        <option key={age} value={age}>
                          {age}歳
                        </option>
                      ))}
                    </select>
                    <select
                      className="select-input"
                      value={entry.startMonth}
                      aria-label="預入開始月"
                      onChange={(e) =>
                        update({ startMonth: Number(e.target.value) })
                      }
                    >
                      {MONTHS.map((month) => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </select>
                    <span className="savings-period-end-label">
                      {formatYearAtAgeLabel(
                        entry.startAge,
                        entry.startMonth,
                        birthYear,
                        member.birthMonth,
                      )}
                    </span>
                  </div>
                </div>
              </LoanSettingsField>
              <LoanSettingsField label="預入期間">
                <select
                  className="select-input"
                  value={timeDepositTermYears}
                  aria-label="預入期間（年）"
                  onChange={(e) =>
                    update({ termYears: Number(e.target.value) })
                  }
                >
                  {TIME_DEPOSIT_TERM_YEAR_OPTIONS.map((years) => (
                    <option key={years} value={years}>
                      {years}年
                    </option>
                  ))}
                </select>
              </LoanSettingsField>
              {timeDepositMaturity ? (
                <LoanSettingsField label="満期">
                  <span className="savings-entry-detail-value">
                    {timeDepositMaturity.age}歳{timeDepositMaturity.month}月
                    （
                    {formatYearAtAgeLabel(
                      timeDepositMaturity.age,
                      timeDepositMaturity.month,
                      birthYear,
                      member.birthMonth,
                    )}
                    ）
                  </span>
                </LoanSettingsField>
              ) : null}
              <LoanSettingsField
                label="利息"
                labelFor={`sav-return-${entry.id}`}
                help={`満期時に元本×年率×預入年数（単利）で一括計上。利息に${(TIME_DEPOSIT_INTEREST_TAX_RATE * 100).toFixed(3)}%を源泉徴収し、元本＋税引後利息は普通預金（残現金）へ振替します`}
              >
                <div className="savings-return-fields">
                  <div className="life-event-amount-field">
                    <input
                      id={`sav-return-${entry.id}`}
                      type="number"
                      className="amount-input"
                      value={entry.expectedReturnRatePct}
                      min={0}
                      step={0.1}
                      onChange={(e) =>
                        update({
                          expectedReturnRatePct: Number(e.target.value) || 0,
                        })
                      }
                    />
                    <span className="amount-unit">%/年</span>
                  </div>
                </div>
              </LoanSettingsField>
              {timeDepositProceeds ? (
                <LoanSettingsField label="満期時の受取見込み">
                  <span className="savings-entry-detail-value">
                    税引後 約{formatMan(timeDepositProceeds.netProceedsMan)}
                    万円
                  </span>
                  <span className="savings-entry-detail-hint">
                    利息 約{formatMan(timeDepositProceeds.interestMan)}万円 −
                    税 約{formatMan(timeDepositProceeds.taxMan)}万円（
                    {(TIME_DEPOSIT_INTEREST_TAX_RATE * 100).toFixed(3)}
                    %）＋元本
                    {formatMan(timeDepositProceeds.principalMan)}万円
                  </span>
                </LoanSettingsField>
              ) : null}
            </>
          ) : isIdeco || isDc ? (
            <>
              <LoanSettingsField
                label="過去の積み立て"
                help={
                  isDc
                    ? '移換や加入済みの資産がある場合に入力します。転職などで掛金が変わった期間は分けて入力できます。終了の最大は今月、これからの開始の初期値は来月です'
                    : '移換や加入済みの資産がある場合に入力します。終了の最大は今月、これからの開始の初期値は来月です'
                }
              >
                <select
                  className="select-input"
                  value={isIdecoPastContributionEnabled(entry) ? 'yes' : 'no'}
                  aria-label="過去の積み立てを入力するか"
                  onChange={(e) =>
                    onChange(
                      applyIdecoPastContributionEnabled(
                        entry,
                        e.target.value === 'yes',
                        member,
                        referenceDate,
                      ),
                    )
                  }
                >
                  <option value="no">入力しない</option>
                  <option value="yes">入力する</option>
                </select>
              </LoanSettingsField>
              {isIdecoPastContributionEnabled(entry) ? (
                isDc ? (
                  <>
                    <LoanSettingsField label="過去の入力方法">
                      <select
                        className="select-input"
                        value={resolveIdecoPastContributionInputMode(entry)}
                        aria-label="過去の入力方法"
                        onChange={(e) =>
                          handleDcPastInputModeChange(
                            e.target.value as 'amount' | 'balance',
                          )
                        }
                      >
                        <option value="amount">積立額から推計</option>
                        <option value="balance">現在残高を直接入力</option>
                      </select>
                    </LoanSettingsField>
                    {resolveIdecoPastContributionInputMode(entry) ===
                    'balance' ? (
                      <>
                        <LoanSettingsField
                          label="試算開始時の残高"
                          labelFor={`sav-past-bal-${entry.id}`}
                          help="移換金などを含む、いま時点の評価額"
                        >
                          <div className="life-event-amount-field">
                            <input
                              id={`sav-past-bal-${entry.id}`}
                              type="number"
                              className="amount-input"
                              value={entry.pastBalanceMan ?? 0}
                              min={0}
                              step={1}
                              onChange={(e) =>
                                update({
                                  pastBalanceMan: Number(e.target.value) || 0,
                                })
                              }
                            />
                            <span className="amount-unit">万円</span>
                          </div>
                        </LoanSettingsField>
                        <LoanSettingsField
                          label="過去の加入年数"
                          labelFor={`sav-past-enroll-years-${entry.id}`}
                          help="退職所得控除の加入年数に使います。月までの入力は不要です"
                        >
                          <div className="life-event-amount-field">
                            <input
                              id={`sav-past-enroll-years-${entry.id}`}
                              type="number"
                              className="amount-input"
                              value={dcPastEnrollmentYears}
                              min={1}
                              step={1}
                              onChange={(e) =>
                                setDcPastEnrollmentYears(
                                  Math.max(1, Number(e.target.value) || 1),
                                )
                              }
                            />
                            <span className="amount-unit">年</span>
                          </div>
                        </LoanSettingsField>
                      </>
                    ) : (
                      <LoanSettingsField
                        label="過去の積立区間"
                        help="事業主＋加入者の合計月額の想定。転職などで掛金が変わった期間は分けて入力できます"
                      >
                        <div className="savings-past-segments">
                          {dcPastSegments.map((seg, index) => (
                            <div
                              key={seg.id}
                              className="savings-past-segment-row"
                            >
                              <div className="savings-past-segment-heading">
                                <span>区間 {index + 1}</span>
                                {dcPastSegments.length > 1 ? (
                                  <button
                                    type="button"
                                    className="savings-period-toggle"
                                    onClick={() => removeDcPastSegment(seg.id)}
                                  >
                                    削除
                                  </button>
                                ) : null}
                              </div>
                              <div className="savings-period-fields">
                                <div className="savings-period-start">
                                  <select
                                    className="select-input"
                                    value={seg.startAge}
                                    aria-label={`過去区間${index + 1}開始年齢`}
                                    onChange={(e) =>
                                      patchDcPastSegment(seg.id, {
                                        startAge: Number(e.target.value),
                                      })
                                    }
                                  >
                                    {pastStartAgeOptions.map((age) => (
                                      <option key={age} value={age}>
                                        {age}歳
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="select-input"
                                    value={seg.startMonth}
                                    aria-label={`過去区間${index + 1}開始月`}
                                    onChange={(e) =>
                                      patchDcPastSegment(seg.id, {
                                        startMonth: Number(e.target.value),
                                      })
                                    }
                                  >
                                    {MONTHS.map((month) => (
                                      <option key={month} value={month}>
                                        {month}月
                                      </option>
                                    ))}
                                  </select>
                                  <span className="period-start-label">〜</span>
                                </div>
                                <div className="savings-period-end">
                                  <select
                                    className="select-input"
                                    value={seg.endAge}
                                    aria-label={`過去区間${index + 1}終了年齢`}
                                    onChange={(e) =>
                                      patchDcPastSegment(seg.id, {
                                        endAge: Number(e.target.value),
                                      })
                                    }
                                  >
                                    {pastEndAgeOptions.map((age) => (
                                      <option key={age} value={age}>
                                        {age}歳
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="select-input"
                                    value={seg.endMonth}
                                    aria-label={`過去区間${index + 1}終了月`}
                                    onChange={(e) =>
                                      patchDcPastSegment(seg.id, {
                                        endMonth: Number(e.target.value),
                                      })
                                    }
                                  >
                                    {MONTHS.filter((month) =>
                                      seg.endAge >= idecoDcNow.age
                                        ? month <= idecoDcNow.month
                                        : true,
                                    ).map((month) => (
                                      <option key={month} value={month}>
                                        {month}月
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="savings-past-segment-amounts">
                                <div className="life-event-amount-field">
                                  <input
                                    type="number"
                                    className="amount-input"
                                    value={seg.contributionMan}
                                    min={0}
                                    step={0.1}
                                    aria-label={`過去区間${index + 1}積立額`}
                                    onChange={(e) =>
                                      patchDcPastSegment(seg.id, {
                                        contributionMan:
                                          Number(e.target.value) || 0,
                                        contributionMode: 'monthly',
                                      })
                                    }
                                  />
                                  <span className="amount-unit">万円/月</span>
                                </div>
                                <div className="life-event-amount-field">
                                  <input
                                    type="number"
                                    className="amount-input"
                                    value={seg.expectedReturnRatePct}
                                    min={0}
                                    step={0.1}
                                    aria-label={`過去区間${index + 1}想定利回り`}
                                    onChange={(e) =>
                                      patchDcPastSegment(seg.id, {
                                        expectedReturnRatePct:
                                          Number(e.target.value) || 0,
                                      })
                                    }
                                  />
                                  <span className="amount-unit">%/年</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="savings-past-segment-actions">
                            <button
                              type="button"
                              className="savings-period-toggle"
                              onClick={addDcPastSegment}
                            >
                              区間を追加
                            </button>
                            <button
                              type="button"
                              className="savings-period-toggle"
                              onClick={applyDcPastSegmentsFromIncome}
                            >
                              職歴から期間を提案
                            </button>
                          </div>
                        </div>
                      </LoanSettingsField>
                    )}
                    <LoanSettingsField label="開始時点の残高見込み">
                      <span className="savings-entry-detail-value">
                        {formatMan(
                          resolveIdecoDcOpeningBalanceMan(
                            entry,
                            member,
                            referenceDate,
                          ),
                        )}
                        万円
                      </span>
                    </LoanSettingsField>
                  </>
                ) : (
                  <>
                    <LoanSettingsField
                      label="過去の積立期間"
                      help="終了は今月まで選択できます。これからの積立と連続していなくても構いません"
                    >
                      <div className="savings-period-fields">
                        <div className="savings-period-start">
                          <select
                            className="select-input"
                            value={entry.pastStartAge ?? idecoDcNow.age}
                            aria-label="過去積立開始年齢"
                            onChange={(e) =>
                              update({ pastStartAge: Number(e.target.value) })
                            }
                          >
                            {pastStartAgeOptions.map((age) => (
                              <option key={age} value={age}>
                                {age}歳
                              </option>
                            ))}
                          </select>
                          <select
                            className="select-input"
                            value={entry.pastStartMonth ?? 1}
                            aria-label="過去積立開始月"
                            onChange={(e) =>
                              update({ pastStartMonth: Number(e.target.value) })
                            }
                          >
                            {pastStartMonthOptions.map((month) => (
                              <option key={month} value={month}>
                                {month}月
                              </option>
                            ))}
                          </select>
                          <span className="period-start-label">〜</span>
                        </div>
                        <div className="savings-period-end">
                          <select
                            className="select-input"
                            value={entry.pastEndAge ?? idecoDcNow.age}
                            aria-label="過去積立終了年齢"
                            onChange={(e) =>
                              update({ pastEndAge: Number(e.target.value) })
                            }
                          >
                            {pastEndAgeOptions.map((age) => (
                              <option key={age} value={age}>
                                {age}歳
                              </option>
                            ))}
                          </select>
                          <select
                            className="select-input"
                            value={entry.pastEndMonth ?? idecoDcNow.month}
                            aria-label="過去積立終了月"
                            onChange={(e) =>
                              update({ pastEndMonth: Number(e.target.value) })
                            }
                          >
                            {pastEndMonthOptions.map((month) => (
                              <option key={month} value={month}>
                                {month}月
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </LoanSettingsField>
                    <LoanSettingsField
                      label="過去の想定利回り"
                      labelFor={`sav-past-rate-${entry.id}`}
                    >
                      <div className="life-event-amount-field">
                        <input
                          id={`sav-past-rate-${entry.id}`}
                          type="number"
                          className="amount-input"
                          value={
                            entry.pastExpectedReturnRatePct ??
                            entry.expectedReturnRatePct
                          }
                          min={0}
                          step={0.1}
                          onChange={(e) =>
                            update({
                              pastExpectedReturnRatePct:
                                Number(e.target.value) || 0,
                            })
                          }
                        />
                        <span className="amount-unit">%/年</span>
                      </div>
                    </LoanSettingsField>
                    <LoanSettingsField label="過去の入力方法">
                      <select
                        className="select-input"
                        value={resolveIdecoPastContributionInputMode(entry)}
                        aria-label="過去の入力方法"
                        onChange={(e) =>
                          update({
                            pastContributionInputMode: e.target.value as
                              | 'amount'
                              | 'balance',
                          })
                        }
                      >
                        <option value="amount">積立額から推計</option>
                        <option value="balance">現在残高を直接入力</option>
                      </select>
                    </LoanSettingsField>
                    {resolveIdecoPastContributionInputMode(entry) ===
                    'balance' ? (
                      <LoanSettingsField
                        label="試算開始時の残高"
                        labelFor={`sav-past-bal-${entry.id}`}
                        help="移換金などを含む、いま時点の評価額"
                      >
                        <div className="life-event-amount-field">
                          <input
                            id={`sav-past-bal-${entry.id}`}
                            type="number"
                            className="amount-input"
                            value={entry.pastBalanceMan ?? 0}
                            min={0}
                            step={1}
                            onChange={(e) =>
                              update({
                                pastBalanceMan: Number(e.target.value) || 0,
                              })
                            }
                          />
                          <span className="amount-unit">万円</span>
                        </div>
                      </LoanSettingsField>
                    ) : (
                      <LoanSettingsField
                        label="過去の積立額"
                        labelFor={`sav-past-amt-${entry.id}`}
                        help="当時の月額掛金の想定"
                      >
                        <div className="life-event-amount-field">
                          <input
                            id={`sav-past-amt-${entry.id}`}
                            type="number"
                            className="amount-input"
                            value={entry.pastContributionMan ?? 0}
                            min={0}
                            step={0.1}
                            onChange={(e) =>
                              update({
                                pastContributionMan:
                                  Number(e.target.value) || 0,
                                pastContributionMode: 'monthly',
                              })
                            }
                          />
                          <span className="amount-unit">万円/月</span>
                        </div>
                      </LoanSettingsField>
                    )}
                    <LoanSettingsField label="開始時点の残高見込み">
                      <span className="savings-entry-detail-value">
                        {formatMan(
                          resolveIdecoDcOpeningBalanceMan(
                            entry,
                            member,
                            referenceDate,
                          ),
                        )}
                        万円
                      </span>
                    </LoanSettingsField>
                  </>
                )
              ) : null}
            </>
          ) : !isDb ? (
            <LoanSettingsField
              label="現在残高"
              labelFor={`sav-balance-${entry.id}`}
            >
              <div className="life-event-amount-field">
                <input
                  id={`sav-balance-${entry.id}`}
                  type="number"
                  className="amount-input"
                  value={entry.balanceMan}
                  min={0}
                  step={1}
                  onChange={(e) =>
                    update({ balanceMan: Number(e.target.value) || 0 })
                  }
                />
                <span className="amount-unit">万円</span>
              </div>
            </LoanSettingsField>
          ) : (
            <>
              <LoanSettingsField
                label="加入区分"
                help="企業型DBは第2号被保険者（厚生年金加入）向けです。Q7の会社員・パート等から選択し、期間モードでは職歴に連動します"
              >
                <div className="savings-ideco-occupancy">
                  <select
                    className="select-input savings-ideco-occupancy-select"
                    value={dbOccupancy ?? 'employee'}
                    aria-label="DB加入区分"
                    onChange={(e) =>
                      update(
                        applyDbOccupancySelection(
                          entry,
                          e.target.value as DcOccupancy,
                          member,
                          incomeEntries,
                          referenceDate,
                        ),
                      )
                    }
                  >
                    {(
                      dbOccupancy &&
                      !dbOccupancyOptions.includes(dbOccupancy)
                        ? [dbOccupancy, ...dbOccupancyOptions]
                        : dbOccupancyOptions
                    ).map((occ) => (
                      <option key={occ} value={occ}>
                        {DC_OCCUPANCY_LABELS[occ]}
                      </option>
                    ))}
                  </select>
                </div>
              </LoanSettingsField>
              <LoanSettingsField
                label="加入期間"
                help="退職所得控除の加入年数に使います。通常は年数で十分です。期間モードでは加入区分の職歴に合わせて開始・終了を置けます。給付額自体は下の一時金／年金見込で入力します"
              >
                <div className="income-retirement-years">
                  <select
                    className="select-input"
                    value={resolveDbEnrollmentMode(entry.dbEnrollmentMode)}
                    aria-label="DB加入期間の入力方法"
                    onChange={(e) => {
                      const mode = e.target.value as DbEnrollmentMode;
                      if (mode === 'period' && dbOccupancy) {
                        update(
                          applyDbOccupancySelection(
                            entry,
                            dbOccupancy,
                            member,
                            incomeEntries,
                            referenceDate,
                          ),
                        );
                        return;
                      }
                      update({ dbEnrollmentMode: mode });
                    }}
                  >
                    <option value="years">年数を入力</option>
                    <option value="period">期間（職歴連動）</option>
                  </select>
                  {resolveDbEnrollmentMode(entry.dbEnrollmentMode) ===
                  'period' ? (
                    <div className="income-retirement-period-row">
                      <select
                        className="select-input"
                        value={entry.dbEnrollmentStartAge ?? 0}
                        aria-label="DB加入開始年齢"
                        onChange={(e) =>
                          update({
                            dbEnrollmentStartAge: Number(e.target.value),
                            dbEnrollmentStartMonth: DB_ENROLLMENT_AGE_ONLY_MONTH,
                          })
                        }
                      >
                        {ageOptions.map((age) => (
                          <option key={age} value={age}>
                            {age}歳
                          </option>
                        ))}
                      </select>
                      <span className="period-start-label">〜</span>
                      <select
                        className="select-input"
                        value={entry.dbEnrollmentEndAge ?? memberAge}
                        aria-label="DB加入終了年齢"
                        onChange={(e) =>
                          update({
                            dbEnrollmentEndAge: Number(e.target.value),
                            dbEnrollmentEndMonth: DB_ENROLLMENT_AGE_ONLY_MONTH,
                          })
                        }
                      >
                        {dbEnrollmentEndAgeOptions.map((age) => (
                          <option key={age} value={age}>
                            {age}歳
                          </option>
                        ))}
                      </select>
                      <span className="income-retirement-period-years">
                        （{resolveDbEnrollmentYears(entry)}年）
                      </span>
                    </div>
                  ) : (
                    <div className="life-event-amount-field">
                      <input
                        type="number"
                        className="amount-input"
                        min={1}
                        step={1}
                        value={entry.dbEnrollmentYears ?? 30}
                        aria-label="DB加入年数"
                        onChange={(e) =>
                          update({
                            dbEnrollmentYears: Math.max(
                              1,
                              Number(e.target.value) || 1,
                            ),
                          })
                        }
                      />
                      <span className="amount-unit">年</span>
                    </div>
                  )}
                </div>
                {dbEndCap && dbOccupancy ? (
                  <p className="savings-entry-detail-hint">
                    加入区分「{DC_OCCUPANCY_LABELS[dbOccupancy]}
                    」に対応する加入は
                    {dbEndCap.endAge}
                    歳までです。別の勤務期間は加入区分を切り替えるか、口座を分けてください
                  </p>
                ) : null}
              </LoanSettingsField>
              {showDbEarlyExit ? (
                <LoanSettingsField
                  label="退職時の扱い"
                  help="加入終了が原則60歳より前のとき、脱退一時金・ポータビリティ（移換）・据置のいずれかを選びます。移換額・一時金額は下の見込額を使います"
                >
                  <div className="savings-ideco-pension-flags">
                    <label className="savings-ideco-flag">
                      <span>選択肢</span>
                      <select
                        className="select-input"
                        value={dbEarlyExitMode}
                        aria-label="DB退職時の扱い"
                        onChange={(e) => {
                          const mode = e.target.value as DbEarlyExitMode;
                          if (mode === 'transfer_ideco') {
                            const hasIdeco = findIdecoTransferTarget(
                              memberEntries,
                              entry.id,
                            );
                            if (!hasIdeco) {
                              if (
                                !window.confirm(
                                  '移換先のiDeCo口座がありません。iDeCo口座を作成して移換を有効にしますか？',
                                )
                              ) {
                                return;
                              }
                              const withMode = memberEntries.map((item) =>
                                item.id === entry.id
                                  ? {
                                      ...item,
                                      dbEarlyExitMode: mode,
                                      withdrawalMode: 'none' as const,
                                    }
                                  : item,
                              );
                              onChangeMemberEntries([
                                ...withMode,
                                createSavingsEntry(
                                  'ideco',
                                  member,
                                  referenceDate,
                                ),
                              ]);
                              return;
                            }
                            update({
                              dbEarlyExitMode: mode,
                              withdrawalMode: 'none',
                            });
                            return;
                          }
                          if (mode === 'lump_at_exit' && dbQualificationEnd) {
                            update({
                              dbEarlyExitMode: mode,
                              withdrawalMode: 'once',
                              withdrawalStartAge: dbQualificationEnd.age,
                              withdrawalStartMonth: dbQualificationEnd.month,
                            });
                            return;
                          }
                          update({
                            dbEarlyExitMode: mode,
                            withdrawalMode: 'once',
                            withdrawalStartAge: Math.max(
                              memberAge,
                              60,
                            ),
                            withdrawalStartMonth: member.birthMonth || 1,
                          });
                        }}
                      >
                        {DB_EARLY_EXIT_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {DB_EARLY_EXIT_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {dbQualificationEnd ? (
                    <p className="savings-entry-detail-hint">
                      加入終了は {dbQualificationEnd.age}歳です。
                      {dbEarlyExitMode === 'lump_at_exit'
                        ? 'その時点で脱退一時金を受取り、退職所得として課税します'
                        : dbEarlyExitMode === 'transfer_ideco'
                          ? 'その時点で見込額をiDeCoへ移換します。受取はiDeCo側で設定してください'
                          : '据置し、原則60歳以降に受取ます'}
                    </p>
                  ) : null}
                  {dbEarlyExitMode === 'transfer_ideco' ? (
                    <div className="savings-entry-detail-hint">
                      <LoanSettingsField
                        label="移換額（見込）"
                        help="脱退一時金相当額。iDeCo残高に加算します"
                      >
                        <div className="life-event-amount-field">
                          <input
                            type="number"
                            className="amount-input"
                            value={entry.withdrawalMan ?? 0}
                            min={0}
                            step={0.1}
                            aria-label="DB移換額"
                            onChange={(e) =>
                              update({
                                withdrawalMan: Number(e.target.value) || 0,
                              })
                            }
                          />
                          <span className="amount-unit">万円</span>
                        </div>
                      </LoanSettingsField>
                      {findIdecoTransferTarget(memberEntries, entry.id) &&
                      onRequestExpandEntry ? (
                        <button
                          type="button"
                          className="savings-period-toggle"
                          onClick={() => {
                            const target = findIdecoTransferTarget(
                              memberEntries,
                              entry.id,
                            );
                            if (target) onRequestExpandEntry(target.id);
                          }}
                        >
                          iDeCo口座を開く
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </LoanSettingsField>
              ) : null}
              <LoanSettingsField
                label={
                  <>
                    他制度掛金相当額
                    <br />
                    （DBの月額掛金）
                  </>
                }
                labelFor={`sav-db-other-${entry.id}`}
                labelClassName="loan-settings-form-label--multiline"
                help="この額は企業型DCの拠出枠とiDeCo上限の計算に使います。勤務先案内の額があれば入力し、不明なら既定のままにしてください"
              >
                <div className="life-event-amount-field">
                  <input
                    id={`sav-db-other-${entry.id}`}
                    type="number"
                    className="amount-input"
                    value={entry.otherSystemContributionMan ?? 0}
                    min={0}
                    step={0.1}
                    onChange={(e) =>
                      update({
                        otherSystemContributionMan:
                          Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="amount-unit">万円/月</span>
                </div>
              </LoanSettingsField>
            </>
          )}
          {isIdeco && idecoOccupancy && idecoFlags ? (
            <IdecoLimitPanel
              entry={entry}
              occupancy={idecoOccupancy}
              occupancyOptions={idecoOccupancyOptions}
              monthlyLimitYen={idecoMonthlyLimitYen}
              employerDcMonthlyYen={corporateDcMonthly.employerYen}
              dbOtherSystemMonthlyYen={dbOtherSystemMonthlyYen}
              showCorporateFlags={showsIdecoCorporatePensionFlags(
                idecoOccupancy,
              )}
              hasCorporateDc={idecoFlags.hasCorporateDc}
              hasDb={idecoFlags.hasDb}
              firstDcEntryId={firstDcEntryId}
              firstDbEntryId={firstDbEntryId}
              onChangeOccupancy={(occupancy) => {
                onChange(
                  applyIdecoOccupancySelection(
                    entry,
                    occupancy,
                    member,
                    incomeEntries,
                    referenceDate,
                    memberEntries,
                  ),
                );
              }}
              onChangeCorporateDc={(enabled) => {
                if (
                  !enabled &&
                  memberHasDc &&
                  !window.confirm(
                    '企業型DCをなしにすると、登録済みの企業型DC口座が削除されます。よろしいですか？',
                  )
                ) {
                  return;
                }
                onChangeMemberEntries(
                  setMemberCorporateDcEnrollment(
                    memberEntries,
                    enabled,
                    member,
                    incomeEntries,
                    referenceDate,
                  ),
                );
              }}
              onChangeHasDb={(enabled) => {
                if (
                  !enabled &&
                  memberHasDb &&
                  !window.confirm(
                    'DBをなしにすると、登録済みのDB（確定給付）口座が削除されます。よろしいですか？',
                  )
                ) {
                  return;
                }
                onChangeMemberEntries(
                  setMemberDbEnrollment(
                    memberEntries,
                    enabled,
                    member,
                    incomeEntries,
                    referenceDate,
                  ),
                );
              }}
              onOpenDcAccount={
                firstDcEntryId && onRequestExpandEntry
                  ? () => onRequestExpandEntry(firstDcEntryId)
                  : undefined
              }
              onOpenDbAccount={
                firstDbEntryId && onRequestExpandEntry
                  ? () => onRequestExpandEntry(firstDbEntryId)
                  : undefined
              }
            />
          ) : null}
          {isInvestSavingsCategory(entry.category) && !isDb ? (
            isDc ? (
              <>
                <LoanSettingsField
                  label="加入区分"
                  help="企業型DCは第2号被保険者（厚生年金加入）向けです。Q7の会社員・パート等から選択し、積立期間は選んだ区分の収入期間に自動反映されます。別の勤務期間は区分を切り替えるか、口座を分けてください"
                >
                  <div className="savings-ideco-occupancy">
                    <select
                      className="select-input savings-ideco-occupancy-select"
                      value={dcOccupancy ?? 'employee'}
                      aria-label="企業型DC加入区分"
                      onChange={(e) =>
                        update(
                          applyDcOccupancySelection(
                            entry,
                            e.target.value as DcOccupancy,
                            member,
                            incomeEntries,
                            referenceDate,
                          ),
                        )
                      }
                    >
                      {(
                        dcOccupancy &&
                        !dcOccupancyOptions.includes(dcOccupancy)
                          ? [dcOccupancy, ...dcOccupancyOptions]
                          : dcOccupancyOptions
                      ).map((occ) => (
                        <option key={occ} value={occ}>
                          {DC_OCCUPANCY_LABELS[occ]}
                        </option>
                      ))}
                    </select>
                  </div>
                </LoanSettingsField>
                <LoanSettingsField
                  label="事業主掛金"
                  help="会社拠出です。運用資産に加算し、残現金は減りません"
                >
                  <div className="savings-contribution-fields">
                    <select
                      className="select-input savings-contribution-mode-select"
                      value={employerContributionMode}
                      aria-label="事業主掛金の方法"
                      onChange={(e) =>
                        update(
                          ensureDcContributionFields({
                            ...entry,
                            employerContributionMode: e.target
                              .value as SavingsContributionMode,
                            contributionMode: e.target
                              .value as SavingsContributionMode,
                          }),
                        )
                      }
                    >
                      {SAVINGS_CONTRIBUTION_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {SAVINGS_CONTRIBUTION_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                    {employerContributionMode !== 'none' ? (
                      <div className="life-event-amount-field">
                        <input
                          type="number"
                          className="amount-input"
                          value={dcEntry.employerContributionMan ?? 0}
                          min={0}
                          step={0.1}
                          aria-label="事業主掛金額"
                          onChange={(e) =>
                            update(
                              ensureDcContributionFields({
                                ...entry,
                                employerContributionMan:
                                  Number(e.target.value) || 0,
                                contributionMan: Number(e.target.value) || 0,
                              }),
                            )
                          }
                        />
                        <span className="amount-unit">
                          {
                            SAVINGS_CONTRIBUTION_MODE_UNITS[
                              employerContributionMode
                            ]
                          }
                        </span>
                      </div>
                    ) : null}
                  </div>
                </LoanSettingsField>
                <LoanSettingsField
                  label="加入者掛金（選択型）"
                  help="給与からの拠出として残現金を減らし、CF表の「選択型DC拠」に表示します。小規模企業共済等掛金控除として所得税・住民税に反映し、標準報酬月額（健保・厚年）からも控除します"
                >
                  <div className="savings-contribution-fields">
                    <select
                      className="select-input savings-contribution-mode-select"
                      value={employeeContributionMode}
                      aria-label="加入者掛金（選択型）の方法"
                      onChange={(e) =>
                        update(
                          ensureDcContributionFields({
                            ...entry,
                            employeeContributionMode: e.target
                              .value as SavingsContributionMode,
                          }),
                        )
                      }
                    >
                      {SAVINGS_CONTRIBUTION_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {SAVINGS_CONTRIBUTION_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                    {employeeContributionMode !== 'none' ? (
                      <div className="life-event-amount-field">
                        <input
                          type="number"
                          className="amount-input"
                          value={dcEntry.employeeContributionMan ?? 0}
                          min={0}
                          step={0.1}
                          aria-label="加入者掛金（選択型）額"
                          onChange={(e) =>
                            update(
                              ensureDcContributionFields({
                                ...entry,
                                employeeContributionMan:
                                  Number(e.target.value) || 0,
                              }),
                            )
                          }
                        />
                        <span className="amount-unit">
                          {
                            SAVINGS_CONTRIBUTION_MODE_UNITS[
                              employeeContributionMode
                            ]
                          }
                        </span>
                      </div>
                    ) : null}
                  </div>
                </LoanSettingsField>
                <LoanSettingsField
                  label="拠出枠"
                  help={
                    memberHasDb
                      ? `DB等月額 ${formatIdecoYen(dbOtherSystemMonthlyYen)} を控除した法令上の月額拠出枠です`
                      : '法令上の月額拠出枠（5.5万円）'
                  }
                >
                  <div className="savings-nisa-quota-summary">
                    <div className="savings-nisa-quota-group">
                      <div className="savings-nisa-quota-row">
                        <span>月額換算合計</span>
                        <strong
                          className={
                            corporateDcOverCeiling
                              ? 'savings-nisa-quota-over'
                              : undefined
                          }
                        >
                          {formatIdecoYen(corporateDcMonthly.totalYen)}
                        </strong>
                      </div>
                      <div className="savings-nisa-quota-row">
                        <span>拠出枠</span>
                        <strong>
                          {formatIdecoYen(corporateDcCeilingYen)}
                        </strong>
                      </div>
                      {corporateDcOverCeiling ? (
                        <p className="savings-entry-detail-hint savings-nisa-quota-warning">
                          企業型DCの掛金合計が法令上の月額拠出枠を超えています。事業主・加入者掛金を見直してください。
                        </p>
                      ) : null}
                    </div>
                  </div>
                </LoanSettingsField>
              </>
            ) : (
              <LoanSettingsField
                label="積立"
                help={
                  isIdeco
                    ? '掛金は小規模企業共済等掛金控除として所得税・住民税の試算に反映します'
                    : undefined
                }
              >
                <div className="savings-contribution-fields">
                  <select
                    className="select-input savings-contribution-mode-select"
                    value={contributionMode}
                    aria-label="積立方法"
                    onChange={(e) =>
                      update({
                        contributionMode: e.target
                          .value as SavingsContributionMode,
                      })
                    }
                  >
                    {SAVINGS_CONTRIBUTION_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {SAVINGS_CONTRIBUTION_MODE_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                  {contributionMode !== 'none' ? (
                    <div className="life-event-amount-field">
                      <input
                        type="number"
                        className="amount-input"
                        value={entry.contributionMan}
                        min={0}
                        step={0.1}
                        aria-label="積立額"
                        onChange={(e) =>
                          update({
                            contributionMan: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="amount-unit">
                        {SAVINGS_CONTRIBUTION_MODE_UNITS[contributionMode]}
                      </span>
                    </div>
                  ) : null}
                </div>
              </LoanSettingsField>
            )
          ) : null}
          {isInvestSavingsCategory(entry.category) &&
          (isDc ? hasDcContribution : contributionMode !== 'none') ? (
            <LoanSettingsField
              label="積立期間"
              help={
                isIdeco || isDc
                  ? '開始の初期値・下限は来月です。終了はそれ以降を指定できます'
                  : undefined
              }
            >
              <div className="savings-period-fields">
                <div className="savings-period-start">
                  <select
                    className="select-input"
                    value={entry.startAge}
                    aria-label="積立開始年齢"
                    onChange={(e) =>
                      update({ startAge: Number(e.target.value) })
                    }
                  >
                    {(isIdeco || isDc
                      ? contributionStartAgeOptions
                      : blocksLifetimeContribution
                        ? contributionEndAgeOptions
                        : ageOptions
                    ).map((age) => (
                      <option key={age} value={age}>
                        {age}歳
                      </option>
                    ))}
                  </select>
                  <select
                    className="select-input"
                    value={entry.startMonth}
                    aria-label="積立開始月"
                    onChange={(e) =>
                      update({ startMonth: Number(e.target.value) })
                    }
                  >
                    {(isIdeco || isDc
                      ? contributionStartMonthOptions
                      : MONTHS
                    ).map((month) => (
                      <option key={month} value={month}>
                        {month}月
                      </option>
                    ))}
                  </select>
                  <span className="period-start-label">
                    {formatYearAtAgeLabel(
                      entry.startAge,
                      entry.startMonth,
                      birthYear,
                      member.birthMonth,
                    )}
                    〜
                  </span>
                </div>
                {entry.endMode === 'lifetime' && !blocksLifetimeContribution ? (
                  <div className="savings-period-end">
                    <span className="savings-period-end-label">
                      {isNisa ? '枠が埋まるまで' : '一生涯'}
                    </span>
                    <button
                      type="button"
                      className="savings-period-toggle"
                      onClick={() =>
                        update({
                          endMode: 'until',
                          endAge: Math.max(
                            entry.startAge,
                            nisaFillEstimate?.fillAge ??
                              resolveDefaultSavingsContributionEndAge({
                                age: memberAge,
                                expectedLifespan: member.expectedLifespan,
                              }),
                          ),
                          endMonth: nisaFillEstimate?.fillMonth ?? 12,
                        })
                      }
                    >
                      終了年齢を指定
                    </button>
                  </div>
                ) : (
                  <div className="savings-period-end">
                    <select
                      className="select-input"
                      value={entry.endAge}
                      aria-label="積立終了年齢"
                      onChange={(e) =>
                        update({ endAge: Number(e.target.value) })
                      }
                    >
                      {(blocksLifetimeContribution
                        ? contributionEndAgeOptions
                        : ageOptions
                      ).map((age) => (
                          <option key={age} value={age}>
                            {age}歳
                          </option>
                        ))}
                    </select>
                    <select
                      className="select-input"
                      value={entry.endMonth}
                      aria-label="積立終了月"
                      onChange={(e) =>
                        update({ endMonth: Number(e.target.value) })
                      }
                    >
                      {(blocksLifetimeContribution
                        ? contributionEndMonthOptions
                        : MONTHS
                      ).map((month) => (
                          <option key={month} value={month}>
                            {month}月
                          </option>
                        ))}
                    </select>
                    <span className="period-end-year-label">
                      {formatEndYearLabel(
                        entry.endAge,
                        entry.endMonth,
                        birthYear,
                        member.birthMonth,
                      )}
                    </span>
                    {!blocksLifetimeContribution ? (
                      <button
                        type="button"
                        className="savings-period-toggle"
                        onClick={() => update({ endMode: 'lifetime' })}
                      >
                        {isNisa ? '枠が埋まるまでにする' : '一生涯にする'}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
              {isIdeco && idecoEndCap && idecoOccupancy ? (
                <p className="savings-entry-detail-hint">
                  加入区分「{IDECO_OCCUPANCY_LABELS[idecoOccupancy]}
                  」に対応する積立は
                  {idecoEndCap.endAge}歳{idecoEndCap.endMonth}
                  月までです。別の職歴期間は加入区分を切り替えるか、口座を分けてください
                </p>
              ) : null}
              {isDc && dcEndCap && dcOccupancy ? (
                <p className="savings-entry-detail-hint">
                  加入区分「{DC_OCCUPANCY_LABELS[dcOccupancy]}
                  」に対応する積立は
                  {dcEndCap.endAge}歳{dcEndCap.endMonth}
                  月までです（法令上限は原則
                  {CORPORATE_DC_CONTRIBUTION_MAX_AGE}
                  歳到達月）。別の勤務期間は加入区分を切り替えるか、口座を分けてください
                </p>
              ) : null}
              {isNisa &&
              entry.endMode === 'lifetime' &&
              nisaFillEstimate?.fillAge != null &&
              nisaFillEstimate.fillMonth != null ? (
                <p className="savings-entry-detail-hint">
                  試算では枠を使い切った時点で積立を停止します（見込み{' '}
                  {nisaFillEstimate.fillAge}歳{nisaFillEstimate.fillMonth}月）
                </p>
              ) : null}
            </LoanSettingsField>
          ) : null}
          {showDcIdecoTransfer ? (
            <LoanSettingsField
              label="iDeCoへ移管"
              help="受取開始（原則60歳）より前に拠出が終わる場合、残高を同一メンバーのiDeCoへ付け替えます。転職先に企業型DCがある場合は「しない」にしてください。移管後の受取はiDeCo側で設定します"
            >
              <div className="savings-ideco-pension-flags">
                <label className="savings-ideco-flag">
                  <span>拠出終了時に移管</span>
                  <select
                    className="select-input"
                    value={entry.transferBalanceToIdecoOnEnd ? 'yes' : 'no'}
                    aria-label="企業型DCからiDeCoへの残高移管"
                    onChange={(e) => {
                      const enabled = e.target.value === 'yes';
                      if (!enabled) {
                        update({
                          transferBalanceToIdecoOnEnd: false,
                          withdrawalMode: 'once',
                        });
                        return;
                      }
                      const hasIdeco = findIdecoTransferTarget(
                        memberEntries,
                        entry.id,
                      );
                      if (!hasIdeco) {
                        if (
                          !window.confirm(
                            '移管先のiDeCo口座がありません。iDeCo口座を作成して移管を有効にしますか？',
                          )
                        ) {
                          return;
                        }
                        const withFlag = memberEntries.map((item) =>
                          item.id === entry.id
                            ? {
                                ...item,
                                transferBalanceToIdecoOnEnd: true,
                                withdrawalMode: 'none' as const,
                              }
                            : item,
                        );
                        onChangeMemberEntries([
                          ...withFlag,
                          createSavingsEntry('ideco', member, referenceDate),
                        ]);
                        return;
                      }
                      update({
                        transferBalanceToIdecoOnEnd: true,
                        withdrawalMode: 'none',
                      });
                    }}
                  >
                    <option value="no">しない</option>
                    <option value="yes">する</option>
                  </select>
                </label>
              </div>
              {entry.transferBalanceToIdecoOnEnd ? (
                <div className="savings-entry-detail-hint">
                  {(() => {
                    const idecoTarget = findIdecoTransferTarget(
                      memberEntries,
                      entry.id,
                    );
                    if (!idecoTarget) {
                      return (
                        <p>
                          移管先のiDeCo口座を追加してください。受取はiDeCo側で設定します
                        </p>
                      );
                    }
                    return (
                      <>
                        <p>
                          移管月は積立終了の {entry.endAge}歳{entry.endMonth}
                          月です。受取はiDeCo側で設定してください（DC側では受取しません）
                        </p>
                        {onRequestExpandEntry ? (
                          <button
                            type="button"
                            className="savings-period-toggle"
                            onClick={() =>
                              onRequestExpandEntry(idecoTarget.id)
                            }
                          >
                            iDeCo口座を開く
                          </button>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </LoanSettingsField>
          ) : null}
          {canWithdraw && !isPensionPayout ? (
            <>
              <LoanSettingsField
                label="取崩し（売却）"
                help={
                  isNisa
                    ? '取崩し時は非課税のまま普通預金（残現金）へ振替します'
                    : '取崩し時に売却益へ 20.315% を課税します（配当・分配は対象外）'
                }
              >
                <div className="savings-contribution-fields">
                  <select
                    className="select-input savings-contribution-mode-select"
                    value={withdrawalMode}
                    aria-label="取崩し方法"
                    onChange={(e) =>
                      handleWithdrawalModeChange(
                        e.target.value as 'none' | 'once' | 'drawdown',
                      )
                    }
                  >
                    {SAVINGS_WITHDRAWAL_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {SAVINGS_WITHDRAWAL_MODE_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                </div>
              </LoanSettingsField>
              {withdrawalMode !== 'none' ? (
                <>
                  <LoanSettingsField
                    label={withdrawalMode === 'once' ? '売却時期' : '取崩開始'}
                  >
                    <div className="savings-period-fields">
                      <div className="savings-period-start">
                        <select
                          className="select-input"
                          value={withdrawalStartAge}
                          aria-label={
                            withdrawalMode === 'once'
                              ? '売却年齢'
                              : '取崩開始年齢'
                          }
                          onChange={(e) =>
                            applyWithdrawalTiming(
                              withdrawalMode,
                              Number(e.target.value),
                              withdrawalMode === 'once'
                                ? member.birthMonth || 1
                                : withdrawalStartMonth,
                              withdrawalYears,
                            )
                          }
                        >
                          {ageOptions.map((age) => (
                            <option key={age} value={age}>
                              {age}歳
                            </option>
                          ))}
                        </select>
                        {withdrawalMode === 'drawdown' ? (
                          <select
                            className="select-input"
                            value={withdrawalStartMonth}
                            aria-label="取崩開始月"
                            onChange={(e) =>
                              applyWithdrawalTiming(
                                withdrawalMode,
                                withdrawalStartAge,
                                Number(e.target.value),
                                withdrawalYears,
                              )
                            }
                          >
                            {MONTHS.map((month) => (
                              <option key={month} value={month}>
                                {month}月
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <span className="period-start-label">
                          {formatYearAtAgeLabel(
                            withdrawalStartAge,
                            withdrawalMode === 'once'
                              ? member.birthMonth || 1
                              : withdrawalStartMonth,
                            birthYear,
                            member.birthMonth,
                          )}
                          {withdrawalMode === 'once' ? 'に売却' : 'から'}
                        </span>
                      </div>
                    </div>
                  </LoanSettingsField>
                  <LoanSettingsField
                    label="運用資産見込み"
                    help="取崩開始時点の推計残高（積立＋想定利回り）"
                  >
                    <span className="savings-entry-detail-value">
                      {formatMan(estimatedAssetsAtWithdrawal)}万円
                    </span>
                  </LoanSettingsField>
                  {withdrawalMode === 'once' ? (
                    <LoanSettingsField
                      label="一括取崩額"
                      labelFor={`sav-withdraw-${entry.id}`}
                      help="初期値は運用資産見込み（1万円単位）。変更可"
                    >
                      <div className="life-event-amount-field">
                        <input
                          id={`sav-withdraw-${entry.id}`}
                          type="number"
                          className="amount-input savings-withdrawal-amount-input"
                          value={entry.withdrawalMan ?? 0}
                          min={0}
                          step={1}
                          aria-label="一括取崩額"
                          onChange={(e) =>
                            update({
                              withdrawalMan: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <span className="amount-unit">万円</span>
                      </div>
                    </LoanSettingsField>
                  ) : (
                    <>
                      <LoanSettingsField
                        label="取崩年数"
                        labelFor={`sav-withdraw-years-${entry.id}`}
                      >
                        <div className="life-event-amount-field">
                          <input
                            id={`sav-withdraw-years-${entry.id}`}
                            type="number"
                            className="amount-input savings-withdrawal-amount-input"
                            value={withdrawalYears}
                            min={1}
                            max={80}
                            step={1}
                            aria-label="取崩年数"
                            onChange={(e) =>
                              applyWithdrawalTiming(
                                'drawdown',
                                withdrawalStartAge,
                                withdrawalStartMonth,
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                          />
                          <span className="amount-unit">年</span>
                        </div>
                        <span className="savings-entry-detail-hint">
                          終了見込み{' '}
                          {formatEndYearLabel(
                            entry.withdrawalEndAge ??
                              withdrawalEndFromYears(
                                withdrawalStartAge,
                                withdrawalStartMonth,
                                withdrawalYears,
                              ).age,
                            entry.withdrawalEndMonth ??
                              withdrawalEndFromYears(
                                withdrawalStartAge,
                                withdrawalStartMonth,
                                withdrawalYears,
                              ).month,
                            birthYear,
                            member.birthMonth,
                          )}
                        </span>
                      </LoanSettingsField>
                      <LoanSettingsField label="取崩ペース">
                        <span className="savings-entry-detail-value">
                          年額 約{formatMan(drawdownAmounts.annualMan)}万円
                          ／ 月額 約{formatMan(drawdownAmounts.monthlyMan)}
                          万円
                        </span>
                      </LoanSettingsField>
                    </>
                  )}
                  <LoanSettingsField
                    label="税の扱い"
                    help={
                      isNisa
                        ? 'NISA は非課税のため売却益税はかかりません。売却額は普通預金（残現金）へ振替し、簿価分の生涯枠が空きます'
                        : `売却益（売却額−比例簿価）×${(TAXABLE_CAPITAL_GAINS_TAX_RATE * 100).toFixed(3)}%。税引後を普通預金（残現金）へ振替`
                    }
                  >
                    {overlapWarning ? (
                      <p className="savings-entry-detail-hint savings-nisa-quota-warning">
                        {overlapWarning}
                      </p>
                    ) : null}
                  </LoanSettingsField>
                </>
              ) : null}
            </>
          ) : null}
          {isPensionPayout &&
          !(isDc && entry.transferBalanceToIdecoOnEnd) &&
          !(isDb && isDbTransferToIdeco(entry, member)) ? (
            <>
              <LoanSettingsField
                label="受取"
                help="受取額は普通預金（残現金）へ振替します。税は所得税・住民税に反映されます"
              >
                <div className="savings-contribution-fields">
                  <select
                    className="select-input savings-contribution-mode-select"
                    value={
                      withdrawalMode === 'drawdown' ? 'drawdown' : 'once'
                    }
                    aria-label="受取方法"
                    onChange={(e) =>
                      handleIdecoPayoutModeChange(
                        e.target.value as 'once' | 'drawdown',
                      )
                    }
                  >
                    {IDECO_PAYOUT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {IDECO_PAYOUT_MODE_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                </div>
              </LoanSettingsField>
              <>
                  <LoanSettingsField
                    label={
                      withdrawalMode === 'drawdown'
                        ? '受給開始'
                        : '受給開始（一括）'
                    }
                    help={
                      isIdeco
                        ? pensionEnrollmentFloorAge != null &&
                          enrollmentYearsAtFloor != null
                          ? `通算加入者等期間 約${enrollmentYearsAtFloor}年のため最早${pensionEnrollmentFloorAge}歳。受給開始は${pensionPayoutFloor?.age ?? pensionEnrollmentFloorAge}〜75歳、かつ拠出終了の翌月以降です（年齢のみ・開始月は誕生日月）`
                          : '受給開始は60〜75歳、かつ拠出終了の翌月以降です（年齢のみ・開始月は誕生日月）'
                        : isDc
                          ? pensionEnrollmentFloorAge != null &&
                            enrollmentYearsAtFloor != null
                            ? `通算加入者等期間 約${enrollmentYearsAtFloor}年のため最早${pensionEnrollmentFloorAge}歳。受給開始は${pensionPayoutFloor?.age ?? pensionEnrollmentFloorAge}歳以降、かつ拠出終了の翌月以降です（年齢のみ・開始月は誕生日月）`
                            : '60歳以降かつ拠出終了の翌月以降に設定できます（年齢のみ・開始月は誕生日月）'
                          : '給付開始年齢を入力してください（開始月は誕生日月）'
                    }
                  >
                    <div className="savings-period-fields">
                      <div className="savings-period-start">
                        <select
                          className="select-input"
                          value={withdrawalStartAge}
                          aria-label="受給開始年齢"
                          onChange={(e) =>
                            update({
                              withdrawalStartAge: Number(e.target.value),
                              withdrawalStartMonth: member.birthMonth || 1,
                            })
                          }
                        >
                          {idecoPayoutAgeOptions.map((age) => (
                            <option key={age} value={age}>
                              {age}歳
                            </option>
                          ))}
                        </select>
                        <span className="period-start-label">
                          {formatYearAtAgeLabel(
                            withdrawalStartAge,
                            member.birthMonth || 1,
                            birthYear,
                            member.birthMonth,
                          )}
                          {withdrawalMode === 'drawdown' ? 'から' : 'に受取'}
                        </span>
                      </div>
                    </div>
                  </LoanSettingsField>
                  {!isDb ? (
                  <LoanSettingsField
                    label={
                      <>
                        受給開始時点の
                        <br />
                        残高見込み
                      </>
                    }
                    labelClassName="loan-settings-form-label--multiline"
                    help="積立＋想定利回りによる推計（税引前）"
                  >
                    <span className="savings-entry-detail-value">
                      {formatMan(estimatedAssetsAtWithdrawal)}万円
                    </span>
                  </LoanSettingsField>
                  ) : null}
                  {withdrawalMode === 'drawdown' ? (
                    <>
                      <LoanSettingsField label="期間の指定">
                        <select
                          className="select-input"
                          value={idecoAnnuityPeriodMode}
                          aria-label="年金期間の指定方法"
                          onChange={(e) => {
                            const nextMode = e.target
                              .value as IdecoAnnuityPeriodMode;
                            if (nextMode === 'years') {
                              update({
                                idecoAnnuityPeriodMode: 'years',
                                withdrawalYears: idecoAnnuityYears,
                              });
                            } else {
                              update({
                                idecoAnnuityPeriodMode: 'until_age',
                                withdrawalEndMode: 'until',
                                withdrawalEndAge: idecoPayoutEndAge,
                                withdrawalEndMonth: member.birthMonth || 1,
                              });
                            }
                          }}
                        >
                          {(
                            Object.keys(
                              IDECO_ANNUITY_PERIOD_MODE_LABELS,
                            ) as IdecoAnnuityPeriodMode[]
                          ).map((mode) => (
                            <option key={mode} value={mode}>
                              {IDECO_ANNUITY_PERIOD_MODE_LABELS[mode]}
                            </option>
                          ))}
                        </select>
                      </LoanSettingsField>
                      {idecoAnnuityPeriodMode === 'years' ? (
                        <LoanSettingsField label="受取年数">
                          <select
                            className="select-input"
                            value={idecoAnnuityYears}
                            aria-label="受取年数"
                            onChange={(e) =>
                              update({
                                idecoAnnuityPeriodMode: 'years',
                                withdrawalYears: Number(e.target.value),
                              })
                            }
                          >
                            {IDECO_ANNUITY_YEAR_OPTIONS.map((years) => (
                              <option key={years} value={years}>
                                {years}年
                              </option>
                            ))}
                          </select>
                          <span className="savings-entry-detail-hint">
                            終了見込み{' '}
                            {formatEndYearLabel(
                              idecoPayoutEndAge,
                              idecoPayoutEndMonth,
                              birthYear,
                              member.birthMonth,
                            )}
                          </span>
                        </LoanSettingsField>
                      ) : (
                        <LoanSettingsField
                          label="受給完了"
                          help="受取期間はおおよそ5〜20年の範囲に補正されます（完了月は誕生日月）"
                        >
                          <div className="savings-period-fields">
                            <div className="savings-period-start">
                              <select
                                className="select-input"
                                value={idecoPayoutEndAge}
                                aria-label="受給完了年齢"
                                onChange={(e) =>
                                  update({
                                    idecoAnnuityPeriodMode: 'until_age',
                                    withdrawalEndMode: 'until',
                                    withdrawalEndAge: Number(e.target.value),
                                    withdrawalEndMonth: member.birthMonth || 1,
                                  })
                                }
                              >
                                {(idecoCompletionAgeOptions.length > 0
                                  ? idecoCompletionAgeOptions
                                  : [withdrawalStartAge + IDECO_ANNUITY_DEFAULT_YEARS]
                                ).map((age) => (
                                  <option key={age} value={age}>
                                    {age}歳
                                  </option>
                                ))}
                              </select>
                              <span className="period-end-year-label">
                                {formatEndYearLabel(
                                  idecoPayoutEndAge,
                                  member.birthMonth || 1,
                                  birthYear,
                                  member.birthMonth,
                                )}
                                まで
                              </span>
                            </div>
                          </div>
                        </LoanSettingsField>
                      )}
                      {isDb ? (
                        <LoanSettingsField
                          label="年金月額（見込）"
                          labelFor={`sav-db-annuity-${entry.id}`}
                        >
                          <div className="life-event-amount-field">
                            <input
                              id={`sav-db-annuity-${entry.id}`}
                              type="number"
                              className="amount-input"
                              value={entry.withdrawalMan}
                              min={0}
                              step={0.1}
                              onChange={(e) =>
                                update({
                                  withdrawalMan: Number(e.target.value) || 0,
                                })
                              }
                            />
                            <span className="amount-unit">万円/月</span>
                          </div>
                          <span className="savings-entry-detail-hint">
                            年額 約{formatMan(idecoAnnuityAmounts.annualMan)}万円
                          </span>
                        </LoanSettingsField>
                      ) : (
                      <LoanSettingsField label="受取ペース">
                        <span className="savings-entry-detail-value">
                          年額 約{formatMan(idecoAnnuityAmounts.annualMan)}万円
                          ／ 月額 約
                          {formatMan(idecoAnnuityAmounts.monthlyMan)}万円
                        </span>
                      </LoanSettingsField>
                      )}
                    </>
                  ) : isDb ? (
                    <>
                      <LoanSettingsField
                        label="一時金見込み"
                        labelFor={`sav-db-lump-${entry.id}`}
                        help="税引前の受取見込額（勤務先案内など）"
                      >
                        <div className="life-event-amount-field">
                          <input
                            id={`sav-db-lump-${entry.id}`}
                            type="number"
                            className="amount-input"
                            value={entry.withdrawalMan}
                            min={0}
                            step={1}
                            onChange={(e) =>
                              update({
                                withdrawalMan: Number(e.target.value) || 0,
                              })
                            }
                          />
                          <span className="amount-unit">万円</span>
                        </div>
                      </LoanSettingsField>
                      <LoanSettingsField
                        label="一括受取額"
                        help="所得税・住民税（見込）を差し引いた税引後の手取り"
                      >
                        <span className="savings-entry-detail-value">
                          {formatMan(idecoLumpSumNetMan)}万円
                        </span>
                      </LoanSettingsField>
                    </>
                  ) : (
                    <LoanSettingsField
                      label="一括受取額"
                      help="残高見込みから所得税・住民税（見込）を差し引いた税引後の手取り。CFでは残高を収入、税は別途計上します"
                    >
                      <span className="savings-entry-detail-value">
                        {formatMan(idecoLumpSumNetMan)}万円
                      </span>
                    </LoanSettingsField>
                  )}
                  {isPensionPayout ? (
                  <LoanSettingsField
                    label="税の扱い"
                    help={
                      withdrawalMode === 'once'
                        ? `税引前の受取額（${isDb ? '一時金見込み' : '残高見込み'}）を退職所得（分離課税）として試算します。別年の一時金がある場合は後受けの種類で10年／19年ルールを適用（DC/iDeCoどうしは19年）。同年は合算します`
                        : '公的年金等として合算課税（公的年金等控除適用）。試算に反映します'
                    }
                  >
                    {withdrawalMode === 'once' && idecoLumpSumTax ? (
                      <div className="savings-entry-detail-hint">
                        <ul className="savings-ideco-tax-summary">
                          <li>
                            加入年数（
                            {isDb ? '入力' : '自動・拠出期間'}）:{' '}
                            {idecoLumpSumTax.enrollmentYears}年
                            {pensionEnrollmentFloorAge != null &&
                            (isIdeco || isDc) ? (
                              <>
                                （通算加入者等期間による最早受給{' '}
                                {pensionEnrollmentFloorAge}歳）
                              </>
                            ) : null}
                          </li>
                          <li>
                            退職所得控除:{' '}
                            {formatMan(yenToMan(idecoLumpSumTax.deductionYen))}
                            万円
                            {idecoLumpSumTaxOverlap?.adjusted ? (
                              <>
                                （単独なら
                                {formatMan(
                                  yenToMan(
                                    idecoLumpSumTaxOverlap.fullDeductionYen,
                                  ),
                                )}
                                万円 → 重複
                                {idecoLumpSumTaxOverlap.overlapYears}年分を減額
                                {idecoLumpSumTaxOverlap.ruleLabel
                                  ? `・${idecoLumpSumTaxOverlap.ruleLabel}`
                                  : ''}
                                ）
                              </>
                            ) : idecoLumpSumTax.enrollmentYears <= 20 ? (
                              `（勤続20年以下: 年${formatMan(yenToMan(RETIREMENT_INCOME_DEDUCTION_PER_YEAR_YEN))}万円）`
                            ) : (
                              `（勤続20年超: ${formatMan(yenToMan(RETIREMENT_INCOME_DEDUCTION_BASE_OVER_20_YEN))}万＋${formatMan(yenToMan(RETIREMENT_INCOME_DEDUCTION_EXTRA_PER_YEAR_YEN))}万×超年数）`
                            )}
                          </li>
                          {idecoLumpSumTaxOverlap?.adjusted ? (
                            <li className="savings-ideco-tax-overlap-note">
                              会社退職金や他の一時金との受取間隔により、退職所得控除を調整しています
                            </li>
                          ) : null}
                          <li>
                            退職所得:{' '}
                            {formatMan(yenToMan(idecoLumpSumTax.retirementIncomeYen))}
                            万円
                          </li>
                          <li>
                            所得税（見込）:{' '}
                            {formatMan(yenToMan(idecoLumpSumTax.incomeTaxYen))}
                            万円
                          </li>
                          <li>
                            住民税（見込）:{' '}
                            {formatMan(yenToMan(idecoLumpSumTax.residentTaxYen))}
                            万円
                          </li>
                          <li>
                            税引後の一括受取:{' '}
                            {formatMan(idecoLumpSumNetMan)}万円
                          </li>
                        </ul>
                        <p className="savings-entry-detail-hint">
                          受取タイミングの10年・19年ルール図解は、下の「退職一時金の受取タイミング」にまとめてあります
                        </p>
                      </div>
                    ) : withdrawalMode === 'drawdown' ? (
                      <div className="savings-entry-detail-hint">
                        <ul className="savings-ideco-tax-summary">
                          <li>
                            所得区分: 公的年金等に係る雑所得（総合課税）
                          </li>
                          <li>
                            老齢基礎・老齢厚生などと合算し、公的年金等控除を適用して所得税・住民税を試算します
                          </li>
                          <li>
                            年間の受取見込は上の「受取ペース」のとおり約
                            {formatMan(idecoAnnuityAmounts.annualMan)}
                            万円（税額は他の所得により変動）
                          </li>
                        </ul>
                      </div>
                    ) : null}
                    {overlapWarning ? (
                      <p className="savings-entry-detail-hint savings-nisa-quota-warning">
                        {overlapWarning}
                      </p>
                    ) : null}
                  </LoanSettingsField>
                  ) : null}
                </>
            </>
          ) : null}
          {!isTimeDeposit && !isDb ? (
            <LoanSettingsField
              label={rateFieldLabel}
              labelFor={`sav-return-${entry.id}`}
              help={
                rateFieldLabel === '利息'
                  ? '利息は資産（金融）に反映（税は簡略化）'
                  : isNisa
                    ? '試算開始後の運用益見込み（年率・複利）。評価額の算出とは別です'
                    : isTaxable
                      ? '運用益は未実現のまま残高に反映。課税は取崩し（売却）時のみ'
                      : isIdeco
                        ? '各年の年初残高（過去推計または開始残高＋これまでの積立・運用益）に年率をかけます。当年の積立は翌年から利回り計算に含まれます'
                        : '運用益は年初残高に対する複利で資産（金融）に反映（税は簡略化）'
              }
            >
              <div className="savings-return-fields">
                <div className="life-event-amount-field">
                  <input
                    id={`sav-return-${entry.id}`}
                    type="number"
                    className="amount-input"
                    value={entry.expectedReturnRatePct}
                    min={0}
                    step={0.1}
                    onChange={(e) =>
                      update({
                        expectedReturnRatePct: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="amount-unit">%/年</span>
                </div>
              </div>
            </LoanSettingsField>
          ) : null}
        </div>
      </div>
    </div>
  );
}
