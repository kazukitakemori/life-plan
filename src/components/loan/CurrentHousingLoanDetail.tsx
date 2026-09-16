import {
  calcCurrentHousingLoanInitialPaymentYen,
  syncCurrentBalanceLoanSchedule,
} from '../../lib/currentHousingLoan';
import { HOUSING_LOAN_REPAYMENT_METHOD_LABELS } from '../../lib/loanLabels';
import { resolveLoanCurrentBalancePeriod } from '../../lib/loanPaymentMode';
import type { HousingLoanRepaymentMethod } from '../../types/housing';
import type { LoanEntry } from '../../types/loan';
import { HousingManInput } from '../housing/HousingManInput';
import { HousingRenewalDateFields } from '../housing/HousingRenewalDateFields';
import { LoanSettingsField } from './LoanSettingsFields';

interface CurrentHousingLoanDetailProps {
  entry: LoanEntry;
  referenceDate: Date;
  onChange: (entry: LoanEntry) => void;
}

const REPAYMENT_METHODS: HousingLoanRepaymentMethod[] = [
  'equal_payment',
  'equal_principal',
];

function formatPaymentYen(yen: number): string {
  if (yen <= 0) return '—';
  return `${Math.round(yen).toLocaleString('ja-JP')}円 / 月`;
}

export function CurrentHousingLoanDetail({
  entry,
  referenceDate,
  onChange,
}: CurrentHousingLoanDetailProps) {
  const referenceYear = referenceDate.getFullYear();
  const period = resolveLoanCurrentBalancePeriod(entry, referenceDate);
  const currentRatePct =
    entry.settings.interestRatePeriods[0]?.interestRatePct ?? 0;
  const estimatedMonthlyPaymentYen = calcCurrentHousingLoanInitialPaymentYen(
    entry,
    referenceDate,
  );

  const updateBalance = (currentBalanceMan: number) => {
    onChange({
      ...entry,
      currentBalanceMan,
      settingsConfigured: currentBalanceMan > 0,
    });
  };

  const updateEnd = (repaymentEndYear: number, repaymentEndMonth: number) => {
    const next = syncCurrentBalanceLoanSchedule(
      {
        ...entry,
        repaymentEndYear,
        repaymentEndMonth,
      },
      referenceDate,
    );
    onChange({
      ...next,
      settingsConfigured: next.currentBalanceMan > 0,
    });
  };

  const updateCurrentRate = (interestRatePct: number) => {
    const periods = entry.settings.interestRatePeriods.length > 0
      ? [...entry.settings.interestRatePeriods]
      : [
          {
            id: crypto.randomUUID(),
            rateType: 'variable' as const,
            interestRatePct: 0,
            startYear: 0,
            startMonth: 0,
            endYear: 0,
            endMonth: 0,
          },
        ];
    periods[0] = {
      ...periods[0],
      interestRatePct,
      startYear: 0,
      startMonth: 0,
      endYear: 0,
      endMonth: 0,
    };
    onChange({
      ...entry,
      settings: {
        ...entry.settings,
        interestRatePeriods: periods.slice(0, 1),
      },
      settingsConfigured: entry.currentBalanceMan > 0,
    });
  };

  const updateRepaymentMethod = (repaymentMethod: HousingLoanRepaymentMethod) => {
    onChange({
      ...entry,
      settings: {
        ...entry.settings,
        repaymentMethod,
      },
      settingsConfigured: entry.currentBalanceMan > 0,
    });
  };

  return (
    <section className="loan-detail-subsection">
      <h4 className="loan-detail-subsection-title">現在のローン状況</h4>
      <p className="housing-owned-loan-existing-note">
        現在残高を起点に、これからの返済だけを試算します。取得価格や購入時の諸費用は使いません。
      </p>
      <div className="housing-rental-card loan-settings-table-card">
        <div className="loan-settings-form-table">
          <LoanSettingsField
            label="現在残高"
            labelFor={`${entry.id}-current-balance`}
            cellClassName="loan-settings-form-value--loan-amount"
          >
            <HousingManInput
              compact
              value={entry.currentBalanceMan}
              onChange={updateBalance}
              min={0}
              step={1}
              unit="万円"
            />
          </LoanSettingsField>

          <LoanSettingsField label="返済終了">
            <HousingRenewalDateFields
              year={period.endYear}
              month={period.endMonth}
              referenceYear={referenceYear}
              minYear={referenceYear}
              onChange={updateEnd}
            />
          </LoanSettingsField>

          <LoanSettingsField
            label="現在金利"
            labelFor={`${entry.id}-current-rate`}
          >
            <HousingManInput
              compact
              value={currentRatePct}
              onChange={updateCurrentRate}
              min={0}
              step={0.01}
              unit="%"
            />
          </LoanSettingsField>

          <LoanSettingsField label="返済方式">
            <div className="housing-owned-payment-options housing-owned-payment-options--compact">
              {REPAYMENT_METHODS.map((method) => (
                <label key={method} className="housing-owned-payment-option">
                  <input
                    type="radio"
                    name={`${entry.id}-current-balance-repayment-method`}
                    checked={entry.settings.repaymentMethod === method}
                    onChange={() => updateRepaymentMethod(method)}
                  />
                  <span>{HOUSING_LOAN_REPAYMENT_METHOD_LABELS[method]}</span>
                </label>
              ))}
            </div>
          </LoanSettingsField>

          <LoanSettingsField label="返済額の目安">
            <strong>{formatPaymentYen(estimatedMonthlyPaymentYen)}</strong>
          </LoanSettingsField>
        </div>
      </div>
      <p className="housing-owned-loan-existing-note">
        現在金利は、団信などの上乗せを含めた実際の適用金利を入力してください。
      </p>
    </section>
  );
}
