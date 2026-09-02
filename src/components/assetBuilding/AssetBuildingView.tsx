import { ASSET_BUILDING_TABS, type AssetBuildingTabId } from '../../types/assetBuildingTabs';
import type { CashFlowTableData } from '../../types/cashFlow';
import type { EducationByMember } from '../../types/education';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';
import type { LifeEventState } from '../../types/lifeEvent';
import type { LivingExpenseState } from '../../types/living';
import type { PensionByMember } from '../../types/pension';
import { CashFlowTableView } from '../analysis/CashFlowTableView';
import { AssetBuildingChartsPanel } from './AssetBuildingChartsPanel';
import { LifetimeSimulationPanel } from './LifetimeSimulationPanel';

interface AssetBuildingViewProps {
  data: CashFlowTableData;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  livingState: LivingExpenseState;
  educationByMember: EducationByMember;
  lifeEventState: LifeEventState;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  analysisSession: number;
  activeTab: AssetBuildingTabId;
}

export function AssetBuildingView({
  data,
  familyMembers,
  incomeByMember,
  priorYearIncomeByMember,
  livingState,
  educationByMember,
  lifeEventState,
  pensionByMember,
  referenceDate,
  analysisSession,
  activeTab,
}: AssetBuildingViewProps) {
  const pageTitle =
    ASSET_BUILDING_TABS.find((tab) => tab.id === activeTab)?.label ?? '資産形成';

  return (
    <div className="asset-building-page">
      <div className="asset-building-top">
        <h2 className="asset-building-page-title">{pageTitle}</h2>
      </div>

      <div className="asset-building-panel-wrap">
        {activeTab === 'simulation' && (
          <div
            role="tabpanel"
            id="asset-building-panel-simulation"
            aria-labelledby="asset-building-tab-simulation"
            className="asset-building-panel"
          >
            <LifetimeSimulationPanel
              cashFlowData={data}
              familyMembers={familyMembers}
              incomeByMember={incomeByMember}
              livingState={livingState}
              educationByMember={educationByMember}
              lifeEventState={lifeEventState}
              pensionByMember={pensionByMember}
              referenceDate={referenceDate}
              showHeader={false}
            />
          </div>
        )}

        {activeTab === 'income-expense' && (
          <div
            role="tabpanel"
            id="asset-building-panel-income-expense"
            aria-labelledby="asset-building-tab-income-expense"
            className="asset-building-panel"
          >
            <AssetBuildingChartsPanel
              cashFlowData={data}
              group="income-expense"
            />
          </div>
        )}

        {activeTab === 'savings-assets' && (
          <div
            role="tabpanel"
            id="asset-building-panel-savings-assets"
            aria-labelledby="asset-building-tab-savings-assets"
            className="asset-building-panel"
          >
            <AssetBuildingChartsPanel
              cashFlowData={data}
              group="savings-assets"
            />
          </div>
        )}

        {activeTab === 'cashflow' && (
          <div
            role="tabpanel"
            id="asset-building-panel-cashflow"
            aria-labelledby="asset-building-tab-cashflow"
            className="asset-building-panel"
          >
            <CashFlowTableView
              key={analysisSession}
              data={data}
              showBackButton={false}
              showTitle={false}
              taxSocialBreakdown={{
                members: familyMembers,
                incomeByMember,
                priorYearIncomeByMember,
                pensionByMember,
                referenceDate,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
