import { calcHousingLoanBaseBorrowingMan } from '../../lib/housingLoanAmount';
import { refetchPropertyTransactionFeesFromProperty } from '../../lib/housingAcquisitionFees';
import {
  applyHousingLoanFeesInLoanMode,
  resolveHousingLoanFeesInLoanMode,
} from '../../lib/housingLoanFeeInclusion';
import { calcPairSharedAmountMan } from '../../lib/pairLoanShare';
import type { OwnedProperty, OwnedPropertyLoanSettings } from '../../types/housing';
import type { LoanStructureType } from '../../types/loan';
import { HousingManInput } from '../housing/HousingManInput';
import { HousingLoanBankFeesEditor } from './HousingLoanBankFeesEditor';
import { LoanSettingsField } from './LoanSettingsFields';
import { LoanFeeFetchActions } from './LoanFeeFetchActions';

interface HousingLoanFeeInclusionPanelProps {
  property: OwnedProperty;
  settings: OwnedPropertyLoanSettings;
  fieldIdPrefix: string;
  referenceDate: Date;
  memberAgeAtReference?: number;
  onChange: (settings: OwnedPropertyLoanSettings) => void;
  onPropertyChange: (
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => void;
  structureType?: LoanStructureType;
  pairSharePct?: number;
}

function PairSharedPropertyFeeField({
  label,
  amountMan,
  pairSharePct,
  onChange,
}: {
  label: string;
  amountMan: number;
  pairSharePct: number;
  onChange: (amountMan: number) => void;
}) {
  const sharedAmountMan = calcPairSharedAmountMan(amountMan, pairSharePct);

  return (
    <LoanSettingsField
      label={label}
      cellClassName="loan-settings-form-value--loan-amount"
    >
      <HousingManInput compact value={amountMan} onChange={onChange} />
      <span className="loan-amount-linked-share">
        按分額 {sharedAmountMan.toLocaleString()}万円（{pairSharePct}%）
      </span>
    </LoanSettingsField>
  );
}

export function HousingLoanFeeInclusionPanel({
  property,
  settings,
  fieldIdPrefix,
  referenceDate,
  memberAgeAtReference,
  onChange,
  onPropertyChange,
  structureType,
  pairSharePct,
}: HousingLoanFeeInclusionPanelProps) {
  const feesInLoanMode = resolveHousingLoanFeesInLoanMode(settings);
  const isPairLoan = structureType === 'pair' && pairSharePct != null;
  const bankFeeReferenceLoanAmountMan = calcHousingLoanBaseBorrowingMan(
    property,
    settings,
    isPairLoan ? { pairSharePct } : undefined,
  );
  const householdBaseLoanMan = calcHousingLoanBaseBorrowingMan(property, settings);
  const canRefetchPropertyFees =
    isPairLoan &&
    memberAgeAtReference != null &&
    property.buildingMan + property.landMan > 0;

  const updateSettings = (patch: Partial<OwnedPropertyLoanSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const handleFeesInLoanModeChange = (mode: 'loan' | 'cash') => {
    updateSettings(applyHousingLoanFeesInLoanMode(mode));
  };

  const handleRefetchPropertyFees = () => {
    if (memberAgeAtReference == null) return;
    const fees = refetchPropertyTransactionFeesFromProperty(
      property,
      memberAgeAtReference,
      referenceDate,
      { hasPairLoan: true },
    );
    onPropertyChange(fees);
  };

  return (
    <div className="loan-fees-panel">
      <div className="loan-fees-section">
        <h5 className="loan-fees-section-title">■ 不動産取引の諸費用</h5>
        <div className="housing-rental-card loan-settings-table-card">
          <div className="loan-settings-form-table">
            {isPairLoan ? (
              <>
                <PairSharedPropertyFeeField
                  label="仲介手数料"
                  amountMan={property.brokerageFeeMan}
                  pairSharePct={pairSharePct}
                  onChange={(brokerageFeeMan) =>
                    onPropertyChange({ brokerageFeeMan })
                  }
                />
                <PairSharedPropertyFeeField
                  label="登記手数料"
                  amountMan={property.registrationFeeMan}
                  pairSharePct={pairSharePct}
                  onChange={(registrationFeeMan) =>
                    onPropertyChange({ registrationFeeMan })
                  }
                />
                <LoanSettingsField label="費用再取得">
                  <LoanFeeFetchActions
                    canFetch={canRefetchPropertyFees}
                    onFetch={handleRefetchPropertyFees}
                  />
                </LoanSettingsField>
              </>
            ) : (
              <>
                <LoanSettingsField label="仲介手数料">
                  <HousingManInput
                    compact
                    value={property.brokerageFeeMan}
                    onChange={(brokerageFeeMan) =>
                      onPropertyChange({ brokerageFeeMan })
                    }
                  />
                </LoanSettingsField>
                <LoanSettingsField label="登記手数料">
                  <HousingManInput
                    compact
                    value={property.registrationFeeMan}
                    onChange={(registrationFeeMan) =>
                      onPropertyChange({ registrationFeeMan })
                    }
                  />
                </LoanSettingsField>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="loan-fees-section">
        <h5 className="loan-fees-section-title">■ 銀行・保証会社の諸費用</h5>
        <div className="housing-rental-card loan-settings-table-card">
          <div className="loan-settings-form-table">
            <HousingLoanBankFeesEditor
              layout="table"
              settings={settings}
              onChange={updateSettings}
              fieldIdPrefix={fieldIdPrefix}
              referenceLoanAmountMan={bankFeeReferenceLoanAmountMan}
              householdBaseLoanMan={isPairLoan ? householdBaseLoanMan : undefined}
              pairSharePct={isPairLoan ? pairSharePct : undefined}
            />
          </div>
        </div>
      </div>

      <div className="loan-fees-section">
        <h5 className="loan-fees-section-title">■ ローンの組み込み設定</h5>
        <div className="housing-rental-card loan-settings-table-card">
          <div className="loan-settings-form-table">
            <LoanSettingsField label="諸費用の扱い">
              <div className="housing-owned-payment-options housing-owned-payment-options--compact">
                <label className="housing-owned-payment-option">
                  <input
                    type="radio"
                    name={`${fieldIdPrefix}-fees-in-loan-mode`}
                    checked={feesInLoanMode === 'loan'}
                    onChange={() => handleFeesInLoanModeChange('loan')}
                  />
                  <span>諸費用をまとめてローンに含める</span>
                </label>
                <label className="housing-owned-payment-option">
                  <input
                    type="radio"
                    name={`${fieldIdPrefix}-fees-in-loan-mode`}
                    checked={feesInLoanMode === 'cash'}
                    onChange={() => handleFeesInLoanModeChange('cash')}
                  />
                  <span>諸費用はすべて現金（自腹）で支払う</span>
                </label>
              </div>
            </LoanSettingsField>
          </div>
        </div>
      </div>
    </div>
  );
}
