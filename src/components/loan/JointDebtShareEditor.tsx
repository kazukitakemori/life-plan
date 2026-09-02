import {
  calcHousingLoanTotalAmountMan,
  formatHousingLoanAmountBreakdownDetail,
  calcHousingLoanFeeBreakdown,
} from '../../lib/housingLoanAmount';
import { getPairSideLabel } from '../../lib/groupCreditLife';
import {
  clampPairSharePct,
  complementPairSharePct,
  MIN_PAIR_SHARE_PCT,
  resolveJointDebtPrimaryDeductionSharePct,
} from '../../lib/pairLoanShare';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty } from '../../types/housing';
import type { LoanEntry } from '../../types/loan';
import { HousingManInput } from '../housing/HousingManInput';
import { LoanSettingsField } from './LoanSettingsFields';

interface JointDebtShareEditorProps {
  entry: LoanEntry;
  linkedHousingProperty: OwnedProperty;
  member?: FamilyMember;
  spouseMember?: FamilyMember;
  onShareChange: (sharePct: number) => void;
}

export function JointDebtShareEditor({
  entry,
  linkedHousingProperty,
  member,
  spouseMember,
  onShareChange,
}: JointDebtShareEditorProps) {
  const sharePct = resolveJointDebtPrimaryDeductionSharePct(entry) ?? 50;
  const spouseSharePct = complementPairSharePct(sharePct);
  const totalLoanMan = calcHousingLoanTotalAmountMan(
    linkedHousingProperty,
    entry.settings,
  );
  const loanBreakdown = calcHousingLoanFeeBreakdown(
    linkedHousingProperty,
    entry.settings,
  );
  const memberLabel = member ? getPairSideLabel(member.role) : '主契約者';
  const spouseLabel = spouseMember
    ? getPairSideLabel(spouseMember.role)
    : '配偶者';

  return (
    <div className="loan-joint-debt-share-editor">
      <p className="loan-pair-share-caption">
        連帯債務は契約1本ですが、住宅ローン控除は夫婦で按分して受けられます。
      </p>

      <div className="housing-rental-card loan-settings-table-card">
        <div className="loan-settings-form-table">
          <LoanSettingsField
            label="借入額（契約1本）"
            cellClassName="loan-settings-form-value--loan-amount"
          >
            <div className="loan-amount-linked loan-amount-linked--table">
              <span className="loan-amount-linked-value">
                {totalLoanMan.toLocaleString()}万円
              </span>
              <span className="loan-amount-linked-detail">
                {formatHousingLoanAmountBreakdownDetail(loanBreakdown)}
              </span>
            </div>
          </LoanSettingsField>

          <LoanSettingsField label={`${memberLabel}の控除按分`}>
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

          <LoanSettingsField label={`${spouseLabel}の控除按分`}>
            <span className="loan-amount-linked-value">{spouseSharePct}%</span>
          </LoanSettingsField>
        </div>
      </div>
    </div>
  );
}
