import {
  calcHousingLoanHouseholdTotalAmountMan,
  formatHousingLoanAmountBreakdownDetail,
  calcHousingLoanFeeBreakdown,
} from '../../lib/housingLoanAmount';
import { getPairSideLabel } from '../../lib/groupCreditLife';
import {
  clampPairSharePct,
  MIN_PAIR_SHARE_PCT,
  resolvePairSharePct,
} from '../../lib/pairLoanShare';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty } from '../../types/housing';
import type { LoanEntry } from '../../types/loan';
import { calcLoanEntryAmountMan } from '../../lib/loanResolution';
import { HousingManInput } from '../housing/HousingManInput';
import { LoanSettingsField } from './LoanSettingsFields';

interface PairLoanShareEditorProps {
  entry: LoanEntry;
  partnerEntry: LoanEntry;
  linkedHousingProperty: OwnedProperty;
  member?: FamilyMember;
  onShareChange: (sharePct: number) => void;
}

export function PairLoanShareEditor({
  entry,
  partnerEntry,
  linkedHousingProperty,
  member,
  onShareChange,
}: PairLoanShareEditorProps) {
  const sharePct = resolvePairSharePct(entry) ?? 50;
  const partnerSharePct = resolvePairSharePct(partnerEntry) ?? 50;
  const householdTotalMan = calcHousingLoanHouseholdTotalAmountMan(
    linkedHousingProperty,
    entry.settings,
  );
  const memberAmountMan = calcLoanEntryAmountMan(linkedHousingProperty, entry);
  const householdBreakdown = calcHousingLoanFeeBreakdown(
    linkedHousingProperty,
    entry.settings,
  );
  const memberLabel = member ? getPairSideLabel(member.role) : 'あなた';

  return (
    <div className="loan-pair-share-editor">
      <p className="loan-pair-share-caption">
        ペアローンは世帯の総借入額を夫婦で分担します。物件価格・組込諸費用は按分し、銀行手数料は契約ごとにかかります。
      </p>

      <div className="housing-rental-card loan-settings-table-card">
        <div className="loan-settings-form-table">
          <LoanSettingsField
            label="世帯の総借入額"
            cellClassName="loan-settings-form-value--loan-amount"
          >
            <div className="loan-amount-linked loan-amount-linked--table">
              <span className="loan-amount-linked-value">
                {householdTotalMan.toLocaleString()}万円
              </span>
              <span className="loan-amount-linked-detail">
                {formatHousingLoanAmountBreakdownDetail(householdBreakdown)}
              </span>
            </div>
          </LoanSettingsField>

          <LoanSettingsField label={`${memberLabel}の分担`}>
            <HousingManInput
              compact
              value={sharePct}
              min={MIN_PAIR_SHARE_PCT}
              step={1}
              unit="%"
              onChange={(value) =>
                onShareChange(clampPairSharePct(value || sharePct))
              }
            />
          </LoanSettingsField>

          <LoanSettingsField label="配偶者の分担">
            <span className="loan-amount-linked-value">{partnerSharePct}%</span>
          </LoanSettingsField>

          <LoanSettingsField label={`${memberLabel}の借入額`}>
            <span className="loan-amount-linked-value">
              {memberAmountMan.toLocaleString()}万円
            </span>
          </LoanSettingsField>
        </div>
      </div>
    </div>
  );
}
