import {
  DEFAULT_GROUP_CREDIT_LIFE_PLAN,
  formatGroupCreditLifeSurchargeRangeHint,
  getDefaultGroupCreditLifeSurchargeRatePct,
  getGroupCreditLifePlanOption,
  INDIVIDUAL_GROUP_CREDIT_LIFE_PLAN_OPTIONS,
  JOINT_DEBT_GROUP_CREDIT_LIFE_PLAN_OPTIONS,
  type GroupCreditLifePlan,
  type GroupCreditLifePlanOption,
  type IndividualGroupCreditLifePlan,
  type JointDebtGroupCreditLifePlan,
} from '../../lib/groupCreditLife';
import { LOAN_STRUCTURE_TYPE_LABELS } from '../../lib/loanLabels';
import type { OwnedPropertyLoanSettings } from '../../types/housing';
import type { LoanStructureType } from '../../types/loan';
import { HousingManInput } from '../housing/HousingManInput';

export interface GroupCreditLifePairSide {
  memberLabel: string;
  settings: OwnedPropertyLoanSettings;
  onChange: (settings: OwnedPropertyLoanSettings) => void;
  fieldIdPrefix: string;
}

interface HousingLoanGroupCreditLifeEditorProps {
  structureType: LoanStructureType;
  settings: OwnedPropertyLoanSettings;
  onChange: (settings: OwnedPropertyLoanSettings) => void;
  fieldIdPrefix: string;
  pairSides?: GroupCreditLifePairSide[];
}

function applyGroupCreditLifePlanChange(
  settings: OwnedPropertyLoanSettings,
  plan: GroupCreditLifePlan,
): OwnedPropertyLoanSettings {
  return {
    ...settings,
    groupCreditLifePlan: plan,
    groupCreditLifeSurchargeRatePct:
      getDefaultGroupCreditLifeSurchargeRatePct(plan),
  };
}

function GroupCreditLifePlanFields({
  idPrefix,
  settings,
  options,
  onChange,
}: {
  idPrefix: string;
  settings: OwnedPropertyLoanSettings;
  options: GroupCreditLifePlanOption[];
  onChange: (settings: OwnedPropertyLoanSettings) => void;
}) {
  const plan =
    settings.groupCreditLifePlan ?? DEFAULT_GROUP_CREDIT_LIFE_PLAN;
  const selectedOption = getGroupCreditLifePlanOption(plan);
  const surchargeRangeHint =
    formatGroupCreditLifeSurchargeRangeHint(selectedOption);
  const surchargeRatePct =
    settings.groupCreditLifeSurchargeRatePct ??
    getDefaultGroupCreditLifeSurchargeRatePct(plan);

  return (
    <div className="loan-group-credit-life-plan-fields">
      <div className="loan-group-credit-life-plan-row">
        <select
          id={`${idPrefix}-group-credit-life`}
          className="select-input select-input--compact loan-group-credit-life-select"
          value={plan}
          onChange={(event) =>
            onChange(
              applyGroupCreditLifePlanChange(
                settings,
                event.target.value as GroupCreditLifePlan,
              ),
            )
          }
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="loan-group-credit-life-surcharge">
          <span className="loan-group-credit-life-surcharge-label">金利上乗せ</span>
          <div className="loan-group-credit-life-surcharge-value">
            <HousingManInput
              compact
              value={surchargeRatePct}
              onChange={(groupCreditLifeSurchargeRatePct) =>
                onChange({
                  ...settings,
                  groupCreditLifeSurchargeRatePct: Math.max(
                    0,
                    groupCreditLifeSurchargeRatePct,
                  ),
                })
              }
              unit="%"
              min={0}
              step={0.01}
            />
            {surchargeRangeHint ? (
              <span className="loan-group-credit-life-surcharge-hint">
                {surchargeRangeHint}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function IndividualPlanBlock({
  title,
  settings,
  onChange,
  fieldIdPrefix,
}: {
  title: string;
  settings: OwnedPropertyLoanSettings;
  onChange: (settings: OwnedPropertyLoanSettings) => void;
  fieldIdPrefix: string;
}) {
  return (
    <div className="loan-group-credit-life-block">
      <p className="loan-group-credit-life-block-title">{title}</p>
      <GroupCreditLifePlanFields
        idPrefix={fieldIdPrefix}
        settings={settings}
        options={INDIVIDUAL_GROUP_CREDIT_LIFE_PLAN_OPTIONS}
        onChange={(next) =>
          onChange({
            ...next,
            groupCreditLifePlan: next.groupCreditLifePlan as IndividualGroupCreditLifePlan,
          })
        }
      />
    </div>
  );
}

export function HousingLoanGroupCreditLifeEditor({
  structureType,
  settings,
  onChange,
  fieldIdPrefix,
  pairSides,
}: HousingLoanGroupCreditLifeEditorProps) {
  return (
    <div className="loan-group-credit-life-editor">
      <div className="loan-group-credit-life-structure">
        <label
          className="loan-group-credit-life-structure-label"
          htmlFor={`${fieldIdPrefix}-structure-type`}
        >
          契約形態
        </label>
        <select
          id={`${fieldIdPrefix}-structure-type`}
          className="select-input select-input--compact loan-group-credit-life-structure-select"
          value={structureType}
          disabled
        >
          <option value={structureType}>
            {LOAN_STRUCTURE_TYPE_LABELS[structureType]}
          </option>
        </select>
        <p className="loan-group-credit-life-structure-note">
          Q5の所有物件に紐づく借入形態です。
        </p>
      </div>

      {structureType === 'pair' && pairSides && pairSides.length >= 2 ? (
        <div className="loan-group-credit-life-pair">
          {pairSides.map((side) => (
            <IndividualPlanBlock
              key={side.fieldIdPrefix}
              title={`【${side.memberLabel}】団信プラン`}
              settings={side.settings}
              onChange={side.onChange}
              fieldIdPrefix={side.fieldIdPrefix}
            />
          ))}
        </div>
      ) : null}

      {structureType === 'joint_debt' ? (
        <div className="loan-group-credit-life-block">
          <p className="loan-group-credit-life-block-title">
            【ローン全体】団信プラン
          </p>
          <GroupCreditLifePlanFields
            idPrefix={fieldIdPrefix}
            settings={settings}
            options={JOINT_DEBT_GROUP_CREDIT_LIFE_PLAN_OPTIONS}
            onChange={(next) =>
              onChange({
                ...next,
                groupCreditLifePlan:
                  next.groupCreditLifePlan as JointDebtGroupCreditLifePlan,
              })
            }
          />
        </div>
      ) : null}

      {structureType === 'income_combined' ? (
        <div className="loan-group-credit-life-income-combined">
          <IndividualPlanBlock
            title="【主債務者（契約者）】団信プラン"
            settings={settings}
            onChange={onChange}
            fieldIdPrefix={fieldIdPrefix}
          />
          <div className="loan-group-credit-life-block loan-group-credit-life-block--disabled">
            <p className="loan-group-credit-life-block-title">
              【収入合算者（連帯保証人）】
            </p>
            <p className="loan-group-credit-life-excluded">
              連帯保証人は団信の対象外です
            </p>
          </div>
        </div>
      ) : null}

      {structureType === 'sole' ? (
        <IndividualPlanBlock
          title="団信プラン"
          settings={settings}
          onChange={onChange}
          fieldIdPrefix={fieldIdPrefix}
        />
      ) : null}
    </div>
  );
}
