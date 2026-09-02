import type { CalculationBreakdownConfig } from '../../types/calculationBreakdown';
import type { LateElderlyHealthViewConfig } from '../../types/lateElderlyHealthView';
import type { LongTermCareViewConfig } from '../../types/longTermCareView';
import type { NationalHealthInsuranceViewConfig } from '../../types/nationalHealthInsuranceView';
import type { NationalPensionViewConfig } from '../../types/nationalPensionView';
import type { SecondLifeTaxSummaryConfig } from '../../types/secondLifeTaxSummary';
import type { TaxBreakdownReferenceDetail } from '../../types/taxBreakdownReference';
import { CalculationBreakdownView } from './CalculationBreakdownView';
import { LateElderlyHealthBreakdownView } from './LateElderlyHealthBreakdownView';
import { LongTermCareBreakdownView } from './LongTermCareBreakdownView';
import { NationalHealthInsuranceBreakdownView } from './NationalHealthInsuranceBreakdownView';
import { NationalPensionBreakdownView } from './NationalPensionBreakdownView';
import { SecondLifeTaxSummaryView } from './SecondLifeTaxSummaryView';

const NHI_TAB_ID = 'national-health-insurance';
const NATIONAL_PENSION_TAB_ID = 'national-pension';
const TAX_SUMMARY_TAB_ID = 'tax-summary';
const LATE_ELDERLY_TAB_ID = 'late-elderly-health';
const LONG_TERM_CARE_TAB_ID = 'long-term-care';

export interface OtherBreakdownPanelProps {
  activeTabId: string;
  breakdownTabs: CalculationBreakdownConfig[];
  nationalPensionViewConfig?: NationalPensionViewConfig | null;
  nhiViewConfig: NationalHealthInsuranceViewConfig | null;
  secondLifeTaxSummaryConfig?: SecondLifeTaxSummaryConfig | null;
  lateElderlyHealthViewConfig?: LateElderlyHealthViewConfig | null;
  longTermCareViewConfig?: LongTermCareViewConfig | null;
  onOpenReference?: (detail: TaxBreakdownReferenceDetail) => void;
}

export function OtherBreakdownPanel({
  activeTabId,
  breakdownTabs,
  nationalPensionViewConfig,
  nhiViewConfig,
  secondLifeTaxSummaryConfig = null,
  lateElderlyHealthViewConfig = null,
  longTermCareViewConfig = null,
  onOpenReference,
}: OtherBreakdownPanelProps) {
  const activeConfig =
    breakdownTabs.find((tab) => tab.id === activeTabId) ?? breakdownTabs[0];

  if (activeTabId === TAX_SUMMARY_TAB_ID && secondLifeTaxSummaryConfig) {
    return <SecondLifeTaxSummaryView config={secondLifeTaxSummaryConfig} />;
  }

  if (activeTabId === TAX_SUMMARY_TAB_ID) {
    return (
      <p className="placeholder-message">
        試算サマリーを表示できません。
      </p>
    );
  }

  if (activeTabId === NATIONAL_PENSION_TAB_ID && nationalPensionViewConfig) {
    return (
      <NationalPensionBreakdownView config={nationalPensionViewConfig} />
    );
  }

  if (activeTabId === NATIONAL_PENSION_TAB_ID) {
    return (
      <p className="placeholder-message">
        国民年金の計算内訳を表示できません。
      </p>
    );
  }

  if (activeTabId === NHI_TAB_ID && nhiViewConfig) {
    return <NationalHealthInsuranceBreakdownView config={nhiViewConfig} />;
  }

  if (activeTabId === NHI_TAB_ID) {
    return (
      <p className="placeholder-message">
        国民健康保険の計算内訳を表示できません。
      </p>
    );
  }

  if (activeTabId === LATE_ELDERLY_TAB_ID && lateElderlyHealthViewConfig) {
    return (
      <LateElderlyHealthBreakdownView config={lateElderlyHealthViewConfig} />
    );
  }

  if (activeTabId === LATE_ELDERLY_TAB_ID) {
    return (
      <p className="placeholder-message">
        後期高齢者医療の計算内訳を表示できません。
      </p>
    );
  }

  if (activeTabId === LONG_TERM_CARE_TAB_ID && longTermCareViewConfig) {
    return <LongTermCareBreakdownView config={longTermCareViewConfig} />;
  }

  if (activeTabId === LONG_TERM_CARE_TAB_ID) {
    return (
      <p className="placeholder-message">
        介護保険の計算内訳を表示できません。
      </p>
    );
  }

  if (activeConfig) {
    return (
      <CalculationBreakdownView
        config={activeConfig}
        onOpenReference={onOpenReference}
      />
    );
  }

  return (
    <p className="placeholder-message">表示できる計算内訳がありません。</p>
  );
}
