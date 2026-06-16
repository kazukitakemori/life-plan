import type { AssetBuildingTabId } from '../../types/assetBuildingTabs';
import type { CashFlowTableData } from '../../types/cashFlow';
import type { EducationByMember } from '../../types/education';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type { LifeEventState } from '../../types/lifeEvent';
import type { LivingExpenseState } from '../../types/living';
import type { PensionByMember } from '../../types/pension';
import { CashFlowTableView } from '../analysis/CashFlowTableView';
import { LifetimeSimulationPanel } from './LifetimeSimulationPanel';

interface AssetBuildingViewProps {
  data: CashFlowTableData;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  livingState: LivingExpenseState;
  educationByMember: EducationByMember;
  lifeEventState: LifeEventState;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  analysisSession: number;
  activeTab: AssetBuildingTabId;
  onBack: () => void;
}

export function AssetBuildingView({
  data,
  familyMembers,
  incomeByMember,
  livingState,
  educationByMember,
  lifeEventState,
  pensionByMember,
  referenceDate,
  analysisSession,
  activeTab,
  onBack,
}: AssetBuildingViewProps) {
  return (
    <div className="asset-building-page">
      <div className="asset-building-top">
        <button type="button" className="cashflow-back-btn" onClick={onBack}>
          ← 入力に戻る
        </button>
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
              onBack={onBack}
              showBackButton={false}
              showTitle={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
