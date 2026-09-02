import {
  calcHousingLoanRepaymentAmountsByPeriod,
  formatHousingLoanRepaymentAmountYen,
  type HousingLoanRepaymentTrackDetail,
} from '../../lib/housingLoanRepaymentView';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty, OwnedPropertyLoanSettings } from '../../types/housing';
import type { VehicleEntry } from '../../types/vehicle';

interface HousingLoanRepaymentAmountTableProps {
  settings: OwnedPropertyLoanSettings;
  referenceDate: Date;
  member?: FamilyMember;
  linkedHousingProperty?: OwnedProperty;
  linkedVehicle?: VehicleEntry;
  pairSharePct?: number;
}

function formatPrincipalMan(man: number): string {
  return `${man.toLocaleString('ja-JP')}万円`;
}

function formatMonthlyPaymentCell(
  paymentYen: number,
  note?: string,
): string {
  const amount = formatHousingLoanRepaymentAmountYen(paymentYen);
  if (amount === '---' || !note) return amount;
  return `${amount}（${note}）`;
}

function RepaymentTrackDetailCell({
  track,
  paymentLabel,
  paymentNote,
}: {
  track: HousingLoanRepaymentTrackDetail;
  paymentLabel: string;
  paymentNote?: string;
}) {
  const paymentText = formatHousingLoanRepaymentAmountYen(track.paymentYen);
  const paymentDisplay =
    paymentText === '---' || !paymentNote
      ? paymentText
      : `${paymentText}（${paymentNote}）`;

  return (
    <div className="loan-repayment-amount-track">
      <div className="loan-repayment-amount-track-line">
        <span className="loan-repayment-amount-track-label">借入額：</span>
        <span>{formatPrincipalMan(track.principalMan)}</span>
      </div>
      <div className="loan-repayment-amount-track-line">
        <span className="loan-repayment-amount-track-label">{paymentLabel}：</span>
        <span>{paymentDisplay}</span>
      </div>
      <div className="loan-repayment-amount-track-line loan-repayment-amount-track-line--sub">
        <span className="loan-repayment-amount-track-label">うち元金：</span>
        <span>{formatHousingLoanRepaymentAmountYen(track.principalPaymentYen)}</span>
      </div>
      <div className="loan-repayment-amount-track-line loan-repayment-amount-track-line--sub">
        <span className="loan-repayment-amount-track-label">うち利息：</span>
        <span>{formatHousingLoanRepaymentAmountYen(track.interestYen)}</span>
      </div>
    </div>
  );
}

export function HousingLoanRepaymentAmountTable({
  settings,
  referenceDate,
  member,
  linkedHousingProperty,
  linkedVehicle,
  pairSharePct,
}: HousingLoanRepaymentAmountTableProps) {
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const rows = calcHousingLoanRepaymentAmountsByPeriod(
    linkedHousingProperty,
    settings,
    member?.age ?? undefined,
    referenceYear,
    referenceMonth,
    {
      ...(pairSharePct != null ? { pairSharePct } : {}),
      ...(linkedVehicle ? { vehicle: linkedVehicle } : {}),
    },
  );

  if (rows.length === 0) return null;

  return (
    <div className="housing-rental-card loan-settings-table-card loan-repayment-amount-table-wrap">
      <div className="loan-repayment-amount-table-scroll">
        <table className="loan-repayment-amount-table">
          <thead>
            <tr>
              <th scope="col" className="loan-repayment-amount-table-row-label">
                金利期間
              </th>
              <th scope="col">金利</th>
              <th scope="col">毎月返済分</th>
              <th scope="col">ボーナス返済分</th>
              <th scope="col">年間返済分</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.period.id}>
                <th scope="row" className="loan-repayment-amount-table-row-label">
                  {row.periodRangeLabel}
                </th>
                <td>{row.rateLabel}</td>
                <td>
                  {row.monthlyTrack ? (
                    <RepaymentTrackDetailCell
                      track={row.monthlyTrack}
                      paymentLabel="毎月の返済額"
                      paymentNote={row.monthlyPaymentNote}
                    />
                  ) : (
                    formatMonthlyPaymentCell(
                      row.monthlyPaymentYen,
                      row.monthlyPaymentNote,
                    )
                  )}
                </td>
                <td>
                  {row.bonusTrack ? (
                    <RepaymentTrackDetailCell
                      track={row.bonusTrack}
                      paymentLabel="ボーナス1回あたりの支払額（年2回）"
                    />
                  ) : (
                    '---'
                  )}
                </td>
                <td>{formatHousingLoanRepaymentAmountYen(row.annualPaymentYen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
