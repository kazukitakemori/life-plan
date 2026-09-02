import { calcLoanEntryAmountMan, calcVehicleLoanEntryAmountMan } from '../../lib/loanResolution';
import { getPairSideLabel } from '../../lib/groupCreditLife';
import { normalizeOwnedPropertyLoanSettings } from '../../lib/loanInterestRatePeriod';
import {
  findPairPartnerEntry,
  getLoanContractorMemberId,
} from '../../lib/loanResolution';
import {
  LOAN_PAYMENT_MODE_LABELS,
  LOAN_PAYMENT_MODE_OPTIONS,
} from '../../lib/loanLabels';
import {
  isLoanMonthlyRepaymentMode,
  resolveLoanMonthlyRepaymentPeriod,
} from '../../lib/loanPaymentMode';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty } from '../../types/housing';
import type { LoanEntry, LoanPaymentMode, LoanState } from '../../types/loan';
import type { VehicleEntry } from '../../types/vehicle';
import { HousingManInput } from '../housing/HousingManInput';
import { HousingRenewalDateFields } from '../housing/HousingRenewalDateFields';
import { HousingLoanFeeInclusionPanel } from './HousingLoanFeeInclusionPanel';
import { HousingLoanRepaymentAmountTable } from './HousingLoanRepaymentAmountTable';
import { HousingLoanRepaymentMethodEditor } from './HousingLoanRepaymentMethodEditor';
import {
  LoanSettingsField,
  LoanSettingsFields,
} from './LoanSettingsFields';
import type { GroupCreditLifePairSide } from './HousingLoanGroupCreditLifeEditor';
import { PairLoanShareEditor } from './PairLoanShareEditor';
import { JointDebtShareEditor } from './JointDebtShareEditor';
import { resolvePairSharePct } from '../../lib/pairLoanShare';

export type LoanEntryDetailVariant =
  | 'full'
  | 'housing-linked'
  | 'vehicle-linked';

interface LoanEntryDetailProps {
  entry: LoanEntry;
  housingPropertyName?: string;
  vehicleName?: string;
  linkedHousingProperty?: OwnedProperty;
  linkedVehicle?: VehicleEntry;
  referenceDate: Date;
  member?: FamilyMember;
  members?: FamilyMember[];
  loanState?: LoanState;
  variant?: LoanEntryDetailVariant;
  onChange: (entry: LoanEntry) => void;
  onPairPartnerChange?: (entry: LoanEntry) => void;
  onPairShareChange?: (sharePct: number) => void;
  onJointDebtShareChange?: (sharePct: number) => void;
  onPropertyFeeChange?: (
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => void;
}

function buildPairGroupCreditLifeSides(
  entry: LoanEntry,
  pairPartner: LoanEntry,
  members: FamilyMember[],
  loanState: LoanState,
  onEntrySettingsChange: (settings: LoanEntry['settings']) => void,
  onPairPartnerChange: (entry: LoanEntry) => void,
): GroupCreditLifePairSide[] {
  const headMemberId = members.find((member) => member.role === 'head')?.id;
  const orderedMembers = members.filter(
    (member) => member.role === 'head' || member.role === 'spouse',
  );

  return orderedMembers
    .map((member) => {
      const contractorEntryId = getLoanContractorMemberId(loanState, entry, headMemberId);
      const partnerContractorId = getLoanContractorMemberId(
        loanState,
        pairPartner,
        headMemberId,
      );
      const targetEntry =
        member.id === contractorEntryId
          ? entry
          : member.id === partnerContractorId
            ? pairPartner
            : undefined;
      if (!targetEntry) return null;

      return {
        memberLabel: getPairSideLabel(member.role),
        settings: targetEntry.settings,
        fieldIdPrefix: targetEntry.id,
        onChange: (settings: LoanEntry['settings']) => {
          const normalized = normalizeOwnedPropertyLoanSettings(settings);
          if (targetEntry.id === entry.id) {
            onEntrySettingsChange(normalized);
            return;
          }
          onPairPartnerChange({
            ...targetEntry,
            settings: normalized,
            settingsConfigured: true,
          });
        },
      };
    })
    .filter((side): side is GroupCreditLifePairSide => side != null);
}

export function LoanEntryDetail({
  entry,
  housingPropertyName,
  vehicleName,
  linkedHousingProperty,
  linkedVehicle,
  referenceDate,
  member,
  members = [],
  loanState,
  variant = 'full',
  onChange,
  onPairPartnerChange,
  onPairShareChange,
  onJointDebtShareChange,
  onPropertyFeeChange,
}: LoanEntryDetailProps) {
  const isLinkedVariant = variant !== 'full';
  const update = (patch: Partial<LoanEntry>) => {
    onChange({ ...entry, ...patch });
  };

  const updateSettings = (settings: LoanEntry['settings']) => {
    const normalized = normalizeOwnedPropertyLoanSettings(settings);

    if (linkedHousingProperty) {
      update({
        settings: {
          ...normalized,
          amountMan: calcLoanEntryAmountMan(linkedHousingProperty, {
            ...entry,
            settings: normalized,
          }),
        },
        settingsConfigured: true,
      });
      return;
    }

    if (linkedVehicle) {
      update({
        settings: {
          ...normalized,
          amountMan: calcVehicleLoanEntryAmountMan(linkedVehicle),
        },
        settingsConfigured: true,
      });
      return;
    }

    update({ settings: normalized, settingsConfigured: true });
  };

  const isHousingLinked = entry.category === 'housing' && linkedHousingProperty;
  const isVehicleLinked = entry.category === 'vehicle' && linkedVehicle;
  const isMonthlyRepayment = isLoanMonthlyRepaymentMode(entry);
  const pairPartner =
    entry.structureType === 'pair' && loanState
      ? findPairPartnerEntry(loanState, entry)
      : undefined;
  const groupCreditLifePairSides =
    pairPartner && onPairPartnerChange
      ? buildPairGroupCreditLifeSides(
          entry,
          pairPartner,
          members,
          loanState!,
          updateSettings,
          onPairPartnerChange,
        )
      : undefined;
  const spouseMember = members.find((candidate) => {
    if (!member) return false;
    if (member.role === 'head') return candidate.role === 'spouse';
    if (member.role === 'spouse') return candidate.role === 'head';
    return false;
  });
  const hasShareSection =
    Boolean(isHousingLinked) &&
    ((entry.structureType === 'pair' && pairPartner && onPairShareChange) ||
      (entry.structureType === 'joint_debt' && onJointDebtShareChange));
  const repaymentSettings =
    entry.category === 'housing'
      ? entry.settings
      : { ...entry.settings, repaymentMethod: 'equal_payment' as const };

  const referenceYear = referenceDate.getFullYear();
  const monthlyPeriod = resolveLoanMonthlyRepaymentPeriod(entry, referenceDate);

  const handlePaymentModeChange = (mode: LoanPaymentMode) => {
    if (mode === 'monthlyRepayment') {
      const period = resolveLoanMonthlyRepaymentPeriod(
        { ...entry, paymentMode: 'monthlyRepayment' },
        referenceDate,
      );
      update({
        paymentMode: mode,
        repaymentStartYear: period.startYear,
        repaymentStartMonth: period.startMonth,
        repaymentEndYear: period.endYear,
        repaymentEndMonth: period.endMonth,
        settingsConfigured: entry.monthlyRepaymentMan > 0 || entry.settingsConfigured,
      });
      return;
    }
    update({ paymentMode: mode });
  };

  return (
    <div
      className={`loan-entry-detail${isLinkedVariant ? ' loan-entry-detail--linked' : ''}`}
    >
      {variant === 'full' && entry.housingLink && housingPropertyName ? (
        <p className="loan-entry-housing-link">
          住まい（Q5）の所有物件「{housingPropertyName}」に紐づいています
        </p>
      ) : null}

      {variant === 'full' && entry.vehicleLink && vehicleName ? (
        <p className="loan-entry-housing-link">
          乗り物（Q6）の「{vehicleName}」に紐づいています
        </p>
      ) : null}

      <div
        className="loan-payment-mode"
        role="radiogroup"
        aria-label="ローンの入力方法"
      >
        {LOAN_PAYMENT_MODE_OPTIONS.map((mode) => (
          <label key={mode} className="loan-payment-mode-option">
            <input
              type="radio"
              name={`loan-payment-mode-${entry.id}`}
              checked={
                mode === 'monthlyRepayment'
                  ? isMonthlyRepayment
                  : !isMonthlyRepayment
              }
              onChange={() => handlePaymentModeChange(mode)}
            />
            <span>{LOAN_PAYMENT_MODE_LABELS[mode]}</span>
          </label>
        ))}
      </div>

      {isMonthlyRepayment ? (
        <section className="loan-detail-subsection">
          <h4 className="loan-detail-subsection-title">返済情報</h4>
          <div className="housing-rental-card loan-settings-table-card">
            <div className="loan-settings-form-table">
              <LoanSettingsField
                label="月々の返済額"
                labelFor={`${entry.id}-monthly-repayment`}
                cellClassName="loan-settings-form-value--loan-amount"
              >
                <HousingManInput
                  compact
                  value={entry.monthlyRepaymentMan}
                  onChange={(monthlyRepaymentMan) =>
                    update({
                      monthlyRepaymentMan,
                      settingsConfigured: monthlyRepaymentMan > 0,
                    })
                  }
                  step={0.1}
                  unit="万円/月"
                />
              </LoanSettingsField>

              <LoanSettingsField label="返済開始">
                <HousingRenewalDateFields
                  year={monthlyPeriod.startYear}
                  month={monthlyPeriod.startMonth}
                  referenceYear={referenceYear}
                  minYear={referenceYear - 40}
                  onChange={(repaymentStartYear, repaymentStartMonth) =>
                    update({
                      repaymentStartYear,
                      repaymentStartMonth,
                      settingsConfigured:
                        entry.monthlyRepaymentMan > 0 ||
                        entry.settingsConfigured,
                    })
                  }
                />
              </LoanSettingsField>

              <LoanSettingsField label="返済終了">
                <HousingRenewalDateFields
                  year={monthlyPeriod.endYear}
                  month={monthlyPeriod.endMonth}
                  referenceYear={referenceYear}
                  minYear={monthlyPeriod.startYear}
                  onChange={(repaymentEndYear, repaymentEndMonth) =>
                    update({
                      repaymentEndYear,
                      repaymentEndMonth,
                      settingsConfigured:
                        entry.monthlyRepaymentMan > 0 ||
                        entry.settingsConfigured,
                    })
                  }
                />
              </LoanSettingsField>
            </div>
          </div>
        </section>
      ) : (
        <>
          {isHousingLinked && entry.structureType === 'pair' && pairPartner && onPairShareChange ? (
            <section className="loan-detail-subsection">
              <h4 className="loan-detail-subsection-title">（１）借入分担</h4>
              <PairLoanShareEditor
                entry={entry}
                partnerEntry={pairPartner}
                linkedHousingProperty={linkedHousingProperty}
                member={member}
                onShareChange={onPairShareChange}
              />
            </section>
          ) : null}

          {isHousingLinked && entry.structureType === 'joint_debt' && onJointDebtShareChange ? (
            <section className="loan-detail-subsection">
              <h4 className="loan-detail-subsection-title">（１）控除按分</h4>
              <JointDebtShareEditor
                entry={entry}
                linkedHousingProperty={linkedHousingProperty}
                member={member}
                spouseMember={spouseMember}
                onShareChange={onJointDebtShareChange}
              />
            </section>
          ) : null}

          {isHousingLinked && linkedHousingProperty ? (
            <section className="loan-detail-subsection">
              <h4 className="loan-detail-subsection-title">
                {hasShareSection ? '（２）諸費用' : '（１）諸費用'}
              </h4>
              <HousingLoanFeeInclusionPanel
                property={linkedHousingProperty}
                settings={entry.settings}
                fieldIdPrefix={entry.id}
                referenceDate={referenceDate}
                memberAgeAtReference={member?.age ?? undefined}
                onChange={updateSettings}
                onPropertyChange={(patch) => onPropertyFeeChange?.(patch)}
                structureType={entry.structureType}
                pairSharePct={resolvePairSharePct(entry)}
              />
            </section>
          ) : null}

          <section className="loan-detail-subsection">
            <h4 className="loan-detail-subsection-title">
              {isHousingLinked
                ? hasShareSection
                  ? '（３）借入情報'
                  : '（２）借入情報'
                : '借入情報'}
            </h4>
            <LoanSettingsFields
              settings={entry.settings}
              onChange={updateSettings}
              fieldIdPrefix={entry.id}
              referenceDate={referenceDate}
              showHousingFields={entry.category === 'housing'}
              linkedAcquisitionAmountMan={
                isHousingLinked
                  ? calcLoanEntryAmountMan(linkedHousingProperty, entry)
                  : isVehicleLinked
                    ? calcVehicleLoanEntryAmountMan(linkedVehicle)
                    : undefined
              }
              pairSharePct={resolvePairSharePct(entry)}
              hideAmountField={Boolean(isHousingLinked || isVehicleLinked)}
              hideBankFees={Boolean(isHousingLinked)}
              linkedHousingProperty={linkedHousingProperty}
              linkedVehicle={linkedVehicle}
              memberAgeAtReference={member?.age ?? undefined}
              memberBirthMonth={member?.birthMonth}
              structureType={entry.structureType}
              groupCreditLifePairSides={groupCreditLifePairSides}
            />
          </section>

          <section className="loan-detail-subsection">
            <h4 className="loan-detail-subsection-title">
              {isHousingLinked
                ? hasShareSection
                  ? '（４）返済方法'
                  : '（３）返済方法'
                : '返済方法'}
            </h4>
            <HousingLoanRepaymentMethodEditor
              settings={repaymentSettings}
              onChange={updateSettings}
              fieldIdPrefix={entry.id}
              referenceDate={referenceDate}
              member={member}
              linkedHousingProperty={linkedHousingProperty}
              linkedVehicle={linkedVehicle}
              pairSharePct={resolvePairSharePct(entry)}
              allowEqualPrincipal={entry.category === 'housing'}
            />
          </section>

          <section className="loan-detail-subsection">
            <h4 className="loan-detail-subsection-title">
              {isHousingLinked
                ? hasShareSection
                  ? '（５）返済額'
                  : '（４）返済額'
                : '返済額'}
            </h4>
            <HousingLoanRepaymentAmountTable
              settings={repaymentSettings}
              referenceDate={referenceDate}
              member={member}
              linkedHousingProperty={linkedHousingProperty}
              linkedVehicle={linkedVehicle}
              pairSharePct={resolvePairSharePct(entry)}
            />
          </section>
        </>
      )}
    </div>
  );
}
