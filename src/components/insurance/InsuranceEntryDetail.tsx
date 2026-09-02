import {
  calcBirthYear,
  formatEndYearLabel,
  formatYearAtAgeLabel,
} from '../../lib/birthDate';
import { resolveMemberBirthMonth } from '../../lib/familyDefaults';
import { roundAmountMan } from '../../lib/incomeAmount';
import { getVehicleAgeOptions } from '../../lib/vehicleDefaults';
import {
  INSURANCE_BENEFIT_PAYOUT_MODE_LABELS,
  INSURANCE_BENEFIT_PAYOUT_MODES,
  INSURANCE_CATEGORY_LABELS,
  INSURANCE_PREMIUM_PAYMENT_MODE_LABELS,
  INSURANCE_PREMIUM_PAYMENT_MODE_UNITS,
  INSURANCE_PREMIUM_PAYMENT_MODES,
  LIFE_INSURANCE_DEDUCTION_KIND_LABELS,
  LIFE_INSURANCE_DEDUCTION_KIND_OPTIONS,
  PERSONAL_PENSION_ANNUITY_KIND_DESCRIPTIONS,
  PERSONAL_PENSION_ANNUITY_KIND_LABELS,
  PERSONAL_PENSION_ANNUITY_KINDS,
  PERSONAL_PENSION_ANNUITY_YEAR_OPTIONS,
  EDUCATION_ANNUITY_YEAR_OPTIONS,
  calcEducationAnnuityEndAge,
  formatAutoInsuranceName,
  formatFireInsuranceName,
  hasBenefitAmountInput,
  hasBenefitPayoutInput,
  hasBeneficiaryInput,
  hasReturnValueInput,
  showsReturnValueBeneficiary,
  isFixedLifeDeductionCategory,
  isLifeInsuranceCategory,
  needsPersonalPensionAnnuityPeriod,
  resolveEducationAnnuityYears,
  resolveInsuranceBenefitPayoutMode,
  resolveInsurancePremiumPaymentMode,
  resolveLifeDeductionKind,
  resolvePersonalPensionAnnuityKind,
  resolvePersonalPensionAnnuityYears,
} from '../../lib/insuranceLabels';
import {
  getIncomeEligibleMembers,
  getMemberTabLabel,
} from '../../lib/memberDisplay';
import { getBenefitReceiveMemberOptions } from '../../lib/insuranceDefaults';
import {
  applyPeriodToInsuranceEntry,
  calcPremiumEndJustBeforeBenefit,
  formatInsurancePeriodRangeLabel,
  getInsurancePeriodLinkLabel,
  getLinkedInsuranceAsset,
  periodPatchFromAsset,
  resolveInsurancePeriodSource,
  resolveInsurancePremiumPeriod,
} from '../../lib/insurancePeriod';
import {
  calcInsuranceEntryIncomeTaxPreview,
  formatInsuranceEntryIncomeTaxPreviewParts,
} from '../../lib/insuranceIncomeTax';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type {
  HousingInsuranceLink,
  InsuranceBenefitPayoutMode,
  InsuranceEntry,
  InsurancePeriodSource,
  InsurancePremiumPaymentMode,
  LifeInsuranceDeductionKind,
  PersonalPensionAnnuityKind,
} from '../../types/insurance';
import type { VehicleEntry, VehicleState } from '../../types/vehicle';
import { LoanSettingsField } from '../loan/LoanSettingsFields';

interface HousingPropertyOption {
  key: string;
  label: string;
  link: HousingInsuranceLink;
  name: string;
}

interface VehicleOption {
  key: string;
  label: string;
  memberId: string;
  vehicle: VehicleEntry;
}

export type InsuranceEntryDetailVariant =
  | 'full'
  | 'housing-linked'
  | 'vehicle-linked';

interface InsuranceEntryDetailProps {
  entry: InsuranceEntry;
  member: FamilyMember;
  members: FamilyMember[];
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  housingPropertyName?: string;
  vehicleName?: string;
  variant?: InsuranceEntryDetailVariant;
  onChange: (entry: InsuranceEntry) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const END_AGES = Array.from({ length: 101 }, (_, i) => i);

function collectHousingOptions(
  housingState: HousingState,
): HousingPropertyOption[] {
  if (!housingState?.byTarget) return [];
  const options: HousingPropertyOption[] = [];
  for (const [targetId, data] of Object.entries(housingState.byTarget)) {
    for (const property of data.owned) {
      options.push({
        key: `owned:${targetId}:${property.id}`,
        label: `所有・${property.name || '名称未設定'}`,
        name: property.name,
        link: {
          targetId,
          propertyId: property.id,
          propertyKind: 'owned',
        },
      });
    }
    for (const property of data.rentals) {
      options.push({
        key: `rental:${targetId}:${property.id}`,
        label: `賃貸・${property.name || '名称未設定'}`,
        name: property.name,
        link: {
          targetId,
          propertyId: property.id,
          propertyKind: 'rental',
        },
      });
    }
  }
  return options;
}

function collectVehicleOptions(
  vehicleState: VehicleState,
  members: FamilyMember[],
): VehicleOption[] {
  if (!vehicleState?.byMember) return [];
  const options: VehicleOption[] = [];
  for (const member of members) {
    const vehicles = vehicleState.byMember[member.id] ?? [];
    for (const vehicle of vehicles) {
      options.push({
        key: `${member.id}:${vehicle.id}`,
        label: `${getMemberTabLabel(member)}・${vehicle.label || '乗り物'}`,
        memberId: member.id,
        vehicle,
      });
    }
  }
  return options;
}

export function InsuranceEntryDetail({
  entry,
  member,
  members,
  housingState,
  vehicleState,
  referenceDate,
  housingPropertyName,
  vehicleName,
  variant = 'full',
  onChange,
}: InsuranceEntryDetailProps) {
  const isLinkedVariant = variant !== 'full';
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageOptions = getVehicleAgeOptions(member);
  const housingOptions = collectHousingOptions(housingState);
  const vehicleOptions = collectVehicleOptions(vehicleState, members);
  const beneficiaryOptions = getIncomeEligibleMembers(members);
  const receiveMemberOptions = getBenefitReceiveMemberOptions(members);
  const isLife = isLifeInsuranceCategory(entry.category);
  const isFire = entry.category === 'fire';
  const isAuto = entry.category === 'auto';
  const showBenefitPayout = hasBenefitPayoutInput(entry.category);
  const showBeneficiary = hasBeneficiaryInput(entry.category);
  const showReturnValueBeneficiary = showsReturnValueBeneficiary(
    entry.category,
    entry.hasReturnValue,
  );
  const payoutMode = resolveInsuranceBenefitPayoutMode(entry.benefitPayoutMode);
  const showPersonalPensionAnnuityKind =
    entry.category === 'personal_pension' && payoutMode === 'annuity';
  const personalPensionAnnuityKind = resolvePersonalPensionAnnuityKind(
    entry.personalPensionAnnuityKind,
  );
  const showPersonalPensionAnnuityPeriod =
    showPersonalPensionAnnuityKind &&
    needsPersonalPensionAnnuityPeriod(personalPensionAnnuityKind);
  const showEducationAnnuityPeriod =
    entry.category === 'education' && payoutMode === 'annuity';
  const showBenefitAmount = hasBenefitAmountInput(entry.category);
  const educationAnnuityYears = resolveEducationAnnuityYears(
    entry.educationAnnuityYears,
  );
  const educationAnnuityEndAge = calcEducationAnnuityEndAge(
    entry.benefitReceiveAge,
    educationAnnuityYears,
  );
  const isLinkedName =
    (isFire && Boolean(entry.housingLink && housingPropertyName)) ||
    (isAuto && Boolean(entry.vehicleLink && vehicleName));

  const resolvedBeneficiaryId = beneficiaryOptions.some(
    (item) => item.id === entry.beneficiaryMemberId,
  )
    ? entry.beneficiaryMemberId
    : member.id;
  const resolvedReceiveMemberId = receiveMemberOptions.some(
    (item) => item.id === entry.benefitReceiveMemberId,
  )
    ? entry.benefitReceiveMemberId
    : (receiveMemberOptions[0]?.id ?? member.id);
  const incomeTaxPreviewParts = formatInsuranceEntryIncomeTaxPreviewParts(
    calcInsuranceEntryIncomeTaxPreview({
      entry,
      contractor: member,
      familyMembers: members,
      housingState,
      vehicleState,
      referenceDate,
    }),
  );

  const benefitMember =
    receiveMemberOptions.find((item) => item.id === resolvedReceiveMemberId) ??
    member;
  const benefitAgeOptions = getVehicleAgeOptions(benefitMember);
  const benefitBirthYear = calcBirthYear(
    benefitMember.age,
    benefitMember.birthMonth,
    referenceDate,
  );
  const linkedAsset = getLinkedInsuranceAsset(
    entry,
    housingState,
    vehicleState,
  );
  const periodSource = resolveInsurancePeriodSource(entry, linkedAsset);
  const resolvedPeriod = resolveInsurancePremiumPeriod(
    entry,
    member,
    housingState,
    vehicleState,
  );
  const periodLinked = periodSource === 'linked' && linkedAsset != null;
  const periodRangeLabel = formatInsurancePeriodRangeLabel(
    resolvedPeriod,
    birthYear,
    resolveMemberBirthMonth(member),
    formatYearAtAgeLabel,
    formatEndYearLabel,
  );

  const update = (patch: Partial<InsuranceEntry>) => {
    onChange({ ...entry, ...patch });
  };

  /**
   * 受取時期変更時、払込が「終了年齢指定」なら受取直前に揃える。
   * 「一生涯」にしている場合は触らない。
   */
  const updateBenefitReceive = (
    patch: Pick<InsuranceEntry, 'benefitReceiveMemberId' | 'benefitReceiveAge'>,
  ) => {
    if (entry.endMode === 'lifetime') {
      update(patch);
      return;
    }
    const nextReceiveMemberId =
      patch.benefitReceiveMemberId ?? resolvedReceiveMemberId;
    const nextReceiveAge = patch.benefitReceiveAge ?? entry.benefitReceiveAge;
    const nextReceiveMember =
      receiveMemberOptions.find((item) => item.id === nextReceiveMemberId) ??
      member;
    update({
      ...patch,
      periodSource: 'manual',
      ...calcPremiumEndJustBeforeBenefit({
        contractor: member,
        receiveMember: nextReceiveMember,
        benefitReceiveAge: nextReceiveAge,
        startAge: entry.startAge,
        startMonth: entry.startMonth,
        referenceDate,
      }),
    });
  };

  const paymentMode = resolveInsurancePremiumPaymentMode(
    entry.premiumPaymentMode,
  );

  const setPremiumPaymentMode = (next: InsurancePremiumPaymentMode) => {
    const current = resolveInsurancePremiumPaymentMode(entry.premiumPaymentMode);
    let premiumMan = entry.premiumMan;
    if (current === 'monthly' && next === 'annual') {
      premiumMan = roundAmountMan(premiumMan * 12);
    } else if (current === 'annual' && next === 'monthly') {
      premiumMan = roundAmountMan(premiumMan / 12);
    }
    update({ premiumPaymentMode: next, premiumMan });
  };

  const setPeriodSource = (next: InsurancePeriodSource) => {
    if (next === 'linked' && linkedAsset) {
      onChange({
        ...entry,
        ...periodPatchFromAsset(linkedAsset),
      });
      return;
    }
    onChange(
      applyPeriodToInsuranceEntry(entry, resolvedPeriod, 'manual'),
    );
  };

  const housingLinkValue = entry.housingLink
    ? `${entry.housingLink.propertyKind}:${entry.housingLink.targetId}:${entry.housingLink.propertyId}`
    : '';

  const vehicleLinkValue = entry.vehicleLink
    ? `${entry.vehicleLink.memberId}:${entry.vehicleLink.vehicleId}`
    : '';

  const handleHousingLinkChange = (value: string) => {
    if (!value) {
      update({
        housingLink: undefined,
        periodSource: 'manual',
      });
      return;
    }
    const option = housingOptions.find((item) => item.key === value);
    if (!option) return;
    const asset =
      option.link.propertyKind === 'rental'
        ? ({
            kind: 'rental' as const,
            property: housingState.byTarget[option.link.targetId]?.rentals.find(
              (p) => p.id === option.link.propertyId,
            )!,
          })
        : ({
            kind: 'owned' as const,
            property: housingState.byTarget[option.link.targetId]?.owned.find(
              (p) => p.id === option.link.propertyId,
            )!,
          });
    if (!asset.property) {
      update({
        housingLink: option.link,
        name: formatFireInsuranceName(option.name),
        periodSource: 'linked',
      });
      return;
    }
    update({
      housingLink: option.link,
      name: formatFireInsuranceName(option.name),
      ...periodPatchFromAsset(asset),
    });
  };

  const handleVehicleLinkChange = (value: string) => {
    if (!value) {
      update({
        vehicleLink: undefined,
        periodSource: 'manual',
      });
      return;
    }
    const option = vehicleOptions.find((item) => item.key === value);
    if (!option) return;
    update({
      vehicleLink: {
        memberId: option.memberId,
        vehicleId: option.vehicle.id,
      },
      name: formatAutoInsuranceName(option.vehicle.label),
      ...periodPatchFromAsset({ kind: 'vehicle', vehicle: option.vehicle }),
    });
  };

  return (
    <div
      className={`insurance-entry-detail${isLinkedVariant ? ' insurance-entry-detail--linked' : ''}`}
    >
      <div className="loan-settings-table-card">
        <div className="loan-settings-form-table">
          {variant === 'full' ? (
            <LoanSettingsField label="種類">
              <span className="insurance-entry-detail-value">
                {INSURANCE_CATEGORY_LABELS[entry.category]}
              </span>
            </LoanSettingsField>
          ) : null}

          {!isLinkedName ? (
            <LoanSettingsField label="名称" labelFor={`ins-name-${entry.id}`}>
              <input
                id={`ins-name-${entry.id}`}
                type="text"
                className="loan-entry-note-input"
                value={entry.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </LoanSettingsField>
          ) : null}

          <LoanSettingsField label="保険料">
            <div className="insurance-premium-fields">
              <select
                className="select-input insurance-premium-mode-select"
                value={paymentMode}
                aria-label="保険料の払込方法"
                onChange={(e) =>
                  setPremiumPaymentMode(
                    e.target.value as InsurancePremiumPaymentMode,
                  )
                }
              >
                {INSURANCE_PREMIUM_PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {INSURANCE_PREMIUM_PAYMENT_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
              <div className="life-event-amount-field">
                <input
                  id={`ins-premium-${entry.id}`}
                  type="number"
                  className="amount-input"
                  value={entry.premiumMan}
                  min={0}
                  step={0.1}
                  onChange={(e) =>
                    update({
                      premiumMan: roundAmountMan(
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
                <span className="amount-unit">
                  {INSURANCE_PREMIUM_PAYMENT_MODE_UNITS[paymentMode]}
                </span>
              </div>
            </div>
          </LoanSettingsField>

          <LoanSettingsField label="保険料払込期間">
            <div className="insurance-period-fields">
              {linkedAsset ? (
                <select
                  className="select-input insurance-period-source-select"
                  value={periodSource}
                  aria-label="払込期間の参照元"
                  onChange={(e) =>
                    setPeriodSource(e.target.value as InsurancePeriodSource)
                  }
                >
                  <option value="linked">
                    {getInsurancePeriodLinkLabel(linkedAsset)}（{periodRangeLabel}）
                  </option>
                  <option value="manual">期間を指定</option>
                </select>
              ) : null}

              {periodLinked ? null : (
                <>
                  <div className="insurance-period-start">
                    <select
                      className="select-input"
                      value={entry.startAge}
                      aria-label="払込開始年齢"
                      onChange={(e) =>
                        update({
                          periodSource: 'manual',
                          startAge: Number(e.target.value),
                        })
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
                      aria-label="払込開始月"
                      onChange={(e) =>
                        update({
                          periodSource: 'manual',
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

                  {entry.endMode === 'lifetime' ? (
                    <div className="insurance-period-end">
                      <span className="insurance-period-end-label">一生涯</span>
                      <button
                        type="button"
                        className="insurance-period-toggle"
                        onClick={() =>
                          update({
                            periodSource: 'manual',
                            endMode: 'until',
                            endAge: Math.max(entry.startAge, member.age ?? 0),
                            endMonth: 12,
                          })
                        }
                      >
                        終了年齢を指定
                      </button>
                    </div>
                  ) : (
                    <div className="insurance-period-end">
                      <select
                        className="select-input"
                        value={entry.endAge}
                        aria-label="払込終了年齢"
                        onChange={(e) =>
                          update({
                            periodSource: 'manual',
                            endAge: Number(e.target.value),
                          })
                        }
                      >
                        {END_AGES.map((age) => (
                          <option key={age} value={age}>
                            {age}歳
                          </option>
                        ))}
                      </select>
                      <select
                        className="select-input"
                        value={entry.endMonth}
                        aria-label="払込終了月"
                        onChange={(e) =>
                          update({
                            periodSource: 'manual',
                            endMonth: Number(e.target.value),
                          })
                        }
                      >
                        {MONTHS.map((month) => (
                          <option key={month} value={month}>
                            {month}月
                          </option>
                        ))}
                      </select>
                      <span className="period-start-label">
                        {formatEndYearLabel(
                          entry.endAge,
                          entry.endMonth,
                          birthYear,
                          member.birthMonth,
                        )}
                      </span>
                      <button
                        type="button"
                        className="insurance-period-toggle"
                        onClick={() =>
                          update({
                            periodSource: 'manual',
                            endMode: 'lifetime',
                          })
                        }
                      >
                        一生涯にする
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </LoanSettingsField>

          {isFire && variant !== 'housing-linked' ? (
            <LoanSettingsField
              label="対象の住まい"
              labelFor={`ins-housing-${entry.id}`}
            >
              <select
                id={`ins-housing-${entry.id}`}
                className="select-input insurance-link-select"
                value={housingLinkValue}
                onChange={(e) => handleHousingLinkChange(e.target.value)}
              >
                <option value="">紐付けなし</option>
                {housingOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              {housingOptions.length === 0 ? (
                <p className="insurance-link-hint">
                  住まい（Q5）で物件を登録すると選択できます
                </p>
              ) : null}
            </LoanSettingsField>
          ) : null}

          {isAuto && variant !== 'vehicle-linked' ? (
            <LoanSettingsField
              label="対象の乗り物"
              labelFor={`ins-vehicle-${entry.id}`}
            >
              <select
                id={`ins-vehicle-${entry.id}`}
                className="select-input insurance-link-select"
                value={vehicleLinkValue}
                onChange={(e) => handleVehicleLinkChange(e.target.value)}
              >
                <option value="">紐付けなし</option>
                {vehicleOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              {vehicleOptions.length === 0 ? (
                <p className="insurance-link-hint">
                  乗り物（Q6）で登録すると選択できます
                </p>
              ) : null}
            </LoanSettingsField>
          ) : null}

          {isLife ? (
            <LoanSettingsField
              label="生命保険料控除"
              labelFor={
                isFixedLifeDeductionCategory(entry.category)
                  ? undefined
                  : `ins-deduction-${entry.id}`
              }
            >
              {isFixedLifeDeductionCategory(entry.category) ? (
                <span className="insurance-entry-detail-value">
                  {
                    LIFE_INSURANCE_DEDUCTION_KIND_LABELS[
                      resolveLifeDeductionKind(entry.category)
                    ]
                  }
                </span>
              ) : (
                <select
                  id={`ins-deduction-${entry.id}`}
                  className="select-input"
                  value={resolveLifeDeductionKind(
                    entry.category,
                    entry.lifeDeductionKind,
                  )}
                  onChange={(e) =>
                    update({
                      lifeDeductionKind: e.target
                        .value as LifeInsuranceDeductionKind,
                    })
                  }
                >
                  {LIFE_INSURANCE_DEDUCTION_KIND_OPTIONS.map((kind) => (
                    <option key={kind} value={kind}>
                      {LIFE_INSURANCE_DEDUCTION_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              )}
              <p className="insurance-link-hint">
                {isFixedLifeDeductionCategory(entry.category)
                  ? 'この保険種目では控除区分が固定です。所得税・住民税の生命保険料控除（新制度）に反映されます。'
                  : '区分は所得税・住民税の生命保険料控除（新制度）に反映されます。'}
              </p>
            </LoanSettingsField>
          ) : null}

          {showBenefitPayout ? (
            <>
              <LoanSettingsField
                label="受取時期"
                labelFor={`ins-receive-member-${entry.id}`}
              >
                <div className="insurance-return-fields">
                  <select
                    id={`ins-receive-member-${entry.id}`}
                    className="select-input insurance-beneficiary-select"
                    value={resolvedReceiveMemberId}
                    aria-label="受取時期の基準となる人"
                    onChange={(e) =>
                      updateBenefitReceive({
                        benefitReceiveMemberId: e.target.value,
                        benefitReceiveAge: entry.benefitReceiveAge,
                      })
                    }
                  >
                    {receiveMemberOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getMemberTabLabel(item)}
                      </option>
                    ))}
                  </select>
                  <select
                    id={`ins-receive-age-${entry.id}`}
                    className="select-input"
                    value={entry.benefitReceiveAge}
                    aria-label="受取時期の年齢"
                    onChange={(e) =>
                      updateBenefitReceive({
                        benefitReceiveMemberId: resolvedReceiveMemberId,
                        benefitReceiveAge: Number(e.target.value),
                      })
                    }
                  >
                    {benefitAgeOptions.map((age) => (
                      <option key={age} value={age}>
                        {age}歳
                      </option>
                    ))}
                  </select>
                  <span className="period-start-label">
                    {showEducationAnnuityPeriod ? 'から（' : 'のとき（'}
                    {formatYearAtAgeLabel(
                      entry.benefitReceiveAge,
                      resolveMemberBirthMonth(benefitMember),
                      benefitBirthYear,
                      benefitMember.birthMonth,
                    )}
                    ）
                  </span>
                </div>
              </LoanSettingsField>

              <LoanSettingsField
                label="受取形式"
                labelFor={`ins-payout-${entry.id}`}
              >
                <select
                  id={`ins-payout-${entry.id}`}
                  className="select-input insurance-payout-select"
                  value={payoutMode}
                  onChange={(e) =>
                    update({
                      benefitPayoutMode: e.target
                        .value as InsuranceBenefitPayoutMode,
                    })
                  }
                >
                  {INSURANCE_BENEFIT_PAYOUT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {INSURANCE_BENEFIT_PAYOUT_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </LoanSettingsField>

              {showPersonalPensionAnnuityKind ? (
                <LoanSettingsField
                  label="年金の種類"
                  labelFor={`ins-annuity-kind-${entry.id}`}
                >
                  <select
                    id={`ins-annuity-kind-${entry.id}`}
                    className="select-input insurance-payout-select"
                    value={personalPensionAnnuityKind}
                    onChange={(e) =>
                      update({
                        personalPensionAnnuityKind: e.target
                          .value as PersonalPensionAnnuityKind,
                      })
                    }
                  >
                    {PERSONAL_PENSION_ANNUITY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {PERSONAL_PENSION_ANNUITY_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                  <p className="insurance-link-hint">
                    {
                      PERSONAL_PENSION_ANNUITY_KIND_DESCRIPTIONS[
                        personalPensionAnnuityKind
                      ]
                    }
                  </p>
                </LoanSettingsField>
              ) : null}

              {showPersonalPensionAnnuityPeriod ? (
                <LoanSettingsField
                  label="受取期間"
                  labelFor={`ins-annuity-years-${entry.id}`}
                >
                  <select
                    id={`ins-annuity-years-${entry.id}`}
                    className="select-input insurance-payout-select"
                    value={resolvePersonalPensionAnnuityYears(
                      entry.personalPensionAnnuityYears,
                    )}
                    onChange={(e) =>
                      update({
                        personalPensionAnnuityYears: Number(e.target.value),
                      })
                    }
                  >
                    {PERSONAL_PENSION_ANNUITY_YEAR_OPTIONS.map((years) => (
                      <option key={years} value={years}>
                        {years}年
                      </option>
                    ))}
                  </select>
                </LoanSettingsField>
              ) : null}

              {showEducationAnnuityPeriod ? (
                <LoanSettingsField
                  label="受取期間"
                  labelFor={`ins-edu-annuity-years-${entry.id}`}
                >
                  <div className="insurance-return-fields">
                    <select
                      id={`ins-edu-annuity-years-${entry.id}`}
                      className="select-input insurance-payout-select"
                      value={educationAnnuityYears}
                      onChange={(e) =>
                        update({
                          educationAnnuityYears: Number(e.target.value),
                        })
                      }
                    >
                      {EDUCATION_ANNUITY_YEAR_OPTIONS.map((years) => (
                        <option key={years} value={years}>
                          {years}年
                        </option>
                      ))}
                    </select>
                    <span className="period-start-label">
                      （{entry.benefitReceiveAge}歳〜{educationAnnuityEndAge}歳）
                    </span>
                  </div>
                  <p className="insurance-link-hint">
                    受取開始から毎年受け取る年数です。例：18歳から4年なら18〜21歳。
                  </p>
                </LoanSettingsField>
              ) : null}

              {showBenefitAmount ? (
                <LoanSettingsField
                  label={payoutMode === 'annuity' ? '年間受取額' : '受取額'}
                  labelFor={`ins-benefit-amount-${entry.id}`}
                >
                  <div className="life-event-amount-field">
                    <input
                      id={`ins-benefit-amount-${entry.id}`}
                      type="number"
                      className="amount-input"
                      value={entry.benefitAmountMan}
                      min={0}
                      step={0.1}
                      onChange={(e) =>
                        update({
                          benefitAmountMan: roundAmountMan(
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                    <span className="amount-unit">
                      {payoutMode === 'annuity' ? '万円/年' : '万円'}
                    </span>
                  </div>
                </LoanSettingsField>
              ) : null}
            </>
          ) : null}

          {showBeneficiary ? (
            <LoanSettingsField
              label="受取人"
              labelFor={`ins-beneficiary-${entry.id}`}
            >
              <select
                id={`ins-beneficiary-${entry.id}`}
                className="select-input insurance-beneficiary-select"
                value={resolvedBeneficiaryId}
                onChange={(e) =>
                  update({ beneficiaryMemberId: e.target.value })
                }
              >
                {beneficiaryOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getMemberTabLabel(item)}
                  </option>
                ))}
              </select>
              <p className="insurance-link-hint">
                契約者と同じ受取人は一括受取を一時所得、年金形式を雑所得（収入−必要経費）として試算します。必要経費は払込保険料総額÷総支給見込額の割合で按分します。異なる受取人は贈与税です。
              </p>
            </LoanSettingsField>
          ) : null}

          {hasReturnValueInput(entry.category) ? (
            <LoanSettingsField
              label="返戻金"
              labelFor={`ins-return-${entry.id}`}
            >
              <div className="insurance-return-fields">
                <select
                  id={`ins-return-${entry.id}`}
                  className="select-input insurance-return-select"
                  value={entry.hasReturnValue ? 'yes' : 'no'}
                  onChange={(e) => {
                    const enabled = e.target.value === 'yes';
                    if (!enabled) {
                      update({
                        hasReturnValue: false,
                        beneficiaryMemberId: member.id,
                      });
                      return;
                    }
                    update({
                      hasReturnValue: true,
                      returnValueAge:
                        entry.returnValueAge ||
                        entry.endAge ||
                        member.expectedLifespan,
                      beneficiaryMemberId:
                        entry.beneficiaryMemberId || member.id,
                    });
                  }}
                >
                  <option value="no">なし</option>
                  <option value="yes">あり</option>
                </select>
                {entry.hasReturnValue ? (
                  <>
                    <select
                      className="select-input"
                      value={entry.returnValueAge}
                      aria-label="返戻金を受け取る年齢"
                      onChange={(e) =>
                        update({ returnValueAge: Number(e.target.value) })
                      }
                    >
                      {ageOptions.map((age) => (
                        <option key={age} value={age}>
                          {age}歳
                        </option>
                      ))}
                    </select>
                    <span className="period-start-label">
                      {formatYearAtAgeLabel(
                        entry.returnValueAge,
                        resolveMemberBirthMonth(member),
                        birthYear,
                        member.birthMonth,
                      )}
                    </span>
                    <div className="life-event-amount-field">
                      <input
                        id={`ins-return-amount-${entry.id}`}
                        type="number"
                        className="amount-input"
                        value={entry.returnValueMan}
                        min={0}
                        step={0.1}
                        aria-label="返戻金額"
                        onChange={(e) =>
                          update({
                            returnValueMan: roundAmountMan(
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                      <span className="amount-unit">万円</span>
                    </div>
                  </>
                ) : null}
              </div>
              {showReturnValueBeneficiary ? (
                <div className="insurance-return-beneficiary">
                  <label
                    className="insurance-return-beneficiary-label"
                    htmlFor={`ins-return-beneficiary-${entry.id}`}
                  >
                    受取人
                  </label>
                  <select
                    id={`ins-return-beneficiary-${entry.id}`}
                    className="select-input insurance-beneficiary-select"
                    value={resolvedBeneficiaryId}
                    aria-label="返戻金の受取人"
                    onChange={(e) =>
                      update({ beneficiaryMemberId: e.target.value })
                    }
                  >
                    {beneficiaryOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getMemberTabLabel(item)}
                      </option>
                    ))}
                  </select>
                  <p className="insurance-link-hint">
                    返戻金の受取人です。契約者と同じなら一時所得（払込保険料を差し引き）、異なる場合は贈与税として試算します。
                  </p>
                </div>
              ) : null}
            </LoanSettingsField>
          ) : null}

          {incomeTaxPreviewParts ? (
            <LoanSettingsField label="課税区分">
              <div className="insurance-income-tax-result" aria-live="polite">
                <div className="insurance-income-tax-summary">
                  {incomeTaxPreviewParts.summary}
                </div>
                {incomeTaxPreviewParts.formula ? (
                  <p className="insurance-income-tax-formula">
                    {incomeTaxPreviewParts.formula}
                  </p>
                ) : null}
                {incomeTaxPreviewParts.expenseMissing ? (
                  <p className="insurance-link-hint">
                    {incomeTaxPreviewParts.kind === 'gift_tax'
                      ? '保険料が未入力（または払込期間内の累計が0円）です。金額を入力すると累計払込保険料として表示されます（贈与税では控除されません）。'
                      : '保険料が未入力（または払込期間内の累計が0円）のため、必要経費は0円です。保険料を入力すると控除に反映されます。'}
                  </p>
                ) : null}
              </div>
            </LoanSettingsField>
          ) : null}
        </div>
      </div>
    </div>
  );
}
