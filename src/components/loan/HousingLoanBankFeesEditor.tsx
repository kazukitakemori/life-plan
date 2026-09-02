import { useState } from 'react';
import {
  calcHousingLoanBankFeeReference,
  calcHousingLoanBankFeeReferenceForPairContract,
  type HousingLoanBankFeeReference,
} from '../../lib/housingLoanFeeReference';
import type { OwnedPropertyLoanSettings } from '../../types/housing';
import { HousingManInput } from '../housing/HousingManInput';
import { LoanSettingsField } from './LoanSettingsFields';
import { LoanFeeFetchActions } from './LoanFeeFetchActions';
import { HousingLoanBankFeeReferenceModal } from './HousingLoanBankFeeReferenceModal';

interface HousingLoanBankFeesEditorProps {
  settings: OwnedPropertyLoanSettings;
  onChange: (patch: Partial<OwnedPropertyLoanSettings>) => void;
  fieldIdPrefix: string;
  /** 諸手数料の算定基準となる借入額（万円） */
  referenceLoanAmountMan: number;
  /** ペアローン時の世帯合計借入額（物件・組込諸費用ベース） */
  householdBaseLoanMan?: number;
  pairSharePct?: number;
  layout?: 'nested' | 'table';
}

export function HousingLoanBankFeesEditor({
  settings,
  onChange,
  referenceLoanAmountMan,
  householdBaseLoanMan,
  pairSharePct,
  layout = 'nested',
}: HousingLoanBankFeesEditorProps) {
  const [referenceDetail, setReferenceDetail] =
    useState<HousingLoanBankFeeReference | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const canFetchReference = referenceLoanAmountMan > 0 && settings.years > 0;

  const handleFetchReference = () => {
    const breakdown =
      householdBaseLoanMan != null && pairSharePct != null
        ? calcHousingLoanBankFeeReferenceForPairContract(
            householdBaseLoanMan,
            pairSharePct,
            settings.years,
          )
        : calcHousingLoanBankFeeReference(
            referenceLoanAmountMan,
            settings.years,
          );
    onChange({
      financingFeeMan: breakdown.financingFeeMan,
      guaranteeFeeMan: breakdown.guaranteeFeeMan,
      administrativeFeeMan: breakdown.administrativeFeeMan,
    });
    setReferenceDetail(breakdown);
  };

  const referenceActions = (
    <LoanFeeFetchActions
      canFetch={canFetchReference}
      onFetch={handleFetchReference}
      showDetail={referenceDetail != null}
      onDetail={() => setDetailModalOpen(true)}
    />
  );

  const modal = (
    <HousingLoanBankFeeReferenceModal
      open={detailModalOpen}
      breakdown={referenceDetail}
      onClose={() => setDetailModalOpen(false)}
    />
  );

  if (layout === 'table') {
    return (
      <>
        <LoanSettingsField label="融資手数料">
          <HousingManInput
            compact
            value={settings.financingFeeMan}
            onChange={(financingFeeMan) => onChange({ financingFeeMan })}
          />
        </LoanSettingsField>

        <LoanSettingsField label="保証料">
          <HousingManInput
            compact
            value={settings.guaranteeFeeMan}
            onChange={(guaranteeFeeMan) => onChange({ guaranteeFeeMan })}
          />
        </LoanSettingsField>

        <LoanSettingsField label="事務手数料">
          <HousingManInput
            compact
            value={settings.administrativeFeeMan}
            onChange={(administrativeFeeMan) =>
              onChange({ administrativeFeeMan })
            }
          />
        </LoanSettingsField>

        <LoanSettingsField label="費用取得">
          {referenceActions}
        </LoanSettingsField>

        {modal}
      </>
    );
  }

  return (
    <div className="loan-bank-fees-editor">
      <div className="loan-fees-row">
        <span className="loan-fees-row-label">融資手数料</span>
        <HousingManInput
          compact
          value={settings.financingFeeMan}
          onChange={(financingFeeMan) => onChange({ financingFeeMan })}
        />
      </div>
      <div className="loan-fees-row">
        <span className="loan-fees-row-label">保証料</span>
        <HousingManInput
          compact
          value={settings.guaranteeFeeMan}
          onChange={(guaranteeFeeMan) => onChange({ guaranteeFeeMan })}
        />
      </div>
      <div className="loan-fees-row">
        <span className="loan-fees-row-label">事務手数料</span>
        <HousingManInput
          compact
          value={settings.administrativeFeeMan}
          onChange={(administrativeFeeMan) =>
            onChange({ administrativeFeeMan })
          }
        />
      </div>
      <div className="loan-fees-row">
        <span className="loan-fees-row-label">費用取得</span>
        {referenceActions}
      </div>
      {modal}
    </div>
  );
}
